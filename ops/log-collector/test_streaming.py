import contextlib
import http.server
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('collector.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class StreamingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = patch.object(c, 'STATE', Path(self.temp.name))
        self.state.start()
        self.addCleanup(self.state.stop)
        self.config = {'host': 'fixture', 'token': 'synthetic-test-token'}

    def event(self, identity='one', timestamp=None):
        return c.event(self.config, identity, 'fixture', 'ready', timestamp or c.iso())

    @contextlib.contextmanager
    def server(self, reply):
        connections = set()
        requests = []
        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version = 'HTTP/1.1'
            def do_POST(self):
                connections.add(self.client_address)
                events = json.loads(self.rfile.read(int(self.headers['Content-Length'])))['events']
                requests.append(events)
                status, result = reply(events)
                body = json.dumps(result).encode()
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            def log_message(self, *_args): pass
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.config['url'] = 'http://127.0.0.1:'+str(server.server_port)+'/api/logs/ingest'
        try: yield requests, connections
        finally: server.shutdown(); server.server_close(); thread.join()

    def test_disk_queue_survives_restart_then_deletes_only_exact_acknowledged_batch(self):
        c.send(self.config, [self.event()])
        path = c.queued_batch('live')
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        original = path.read_bytes()
        for acknowledgement in ({'ok': True}, {'ok': True, 'accepted': 0}, {'ok': False, 'accepted': 1}):
            with self.server(lambda _: (201, acknowledgement)):
                delivery = c.Delivery(self.config)
                with self.assertRaises(c.DeliveryError): delivery.deliver(path)
                delivery.close()
            self.assertEqual(path.read_bytes(), original)
        with self.server(lambda rows: (201, {'ok': True, 'accepted': len(rows)})) as (requests, connections):
            # New sender instance simulates a collector restart with the same files.
            delivery = c.Delivery(self.config)
            try:
                self.assertEqual(delivery.deliver(c.queued_batch('live')), 1)
                c.send(self.config, [self.event('two')])
                delivery.deliver(c.queued_batch('live'))
            finally: delivery.close()
            self.assertEqual(len(requests), 2)
            self.assertEqual(len(connections), 1)
        self.assertIsNone(c.queued_batch('live'))

    def test_small_queue_files_share_one_request_without_deleting_unacknowledged_files(self):
        for index in range(105): c.send(self.config, [self.event(str(index))])
        paths = c.queued_batches('live')
        self.assertEqual(len(paths), 100)
        with self.server(lambda rows: (201, {'ok': True, 'accepted': len(rows)})) as (requests, _):
            delivery = c.Delivery(self.config)
            try: self.assertEqual(delivery.deliver_many(paths), 100)
            finally: delivery.close()
            self.assertEqual(len(requests), 1)
        self.assertEqual(len(c.queued_batches('live')), 5)

    def test_failed_response_and_lost_ack_replay_same_event_id(self):
        c.send(self.config, [self.event()])
        path = c.queued_batch('live')
        saved = path.read_bytes()
        with self.server(lambda _: (503, {'error': 'busy'})):
            delivery = c.Delivery(self.config)
            with self.assertRaises(c.DeliveryError): delivery.deliver(path)
            self.assertEqual(path.read_bytes(), saved)
        with self.server(lambda rows: (201, {'ok': True, 'accepted': len(rows)})) as (requests, _):
            delivery = c.Delivery(self.config)
            # Crash after the server commit but before deleting the local queue file.
            with patch.object(Path, 'unlink', side_effect=OSError('simulated crash')):
                with self.assertRaises(OSError): delivery.deliver(path)
            delivery.close()
            delivery = c.Delivery(self.config)
            delivery.deliver(path)
            delivery.close()
            self.assertEqual(requests[0][0]['sourceEventId'], requests[1][0]['sourceEventId'])

    def test_new_logs_are_acknowledged_while_history_request_is_blocked(self):
        c.send(self.config, [self.event('old', '2026-01-01T00:00:00Z'), self.event('new')])
        blocked = threading.Event(); release = threading.Event()
        def respond(rows):
            if rows[0]['timestamp'].startswith('2026-01'):
                blocked.set(); release.wait(5)
            return 201, {'ok': True, 'accepted': len(rows)}
        with self.server(respond):
            history = c.Delivery(self.config); live = c.Delivery(self.config)
            thread = threading.Thread(target=lambda: history.deliver(c.queued_batch('history')))
            thread.start()
            try:
                self.assertTrue(blocked.wait(2))
                started = time.monotonic()
                live.deliver(c.queued_batch('live'))
                self.assertLess(time.monotonic()-started, 1)
            finally:
                release.set(); thread.join(); history.close(); live.close()

    def test_queue_write_failure_never_advances_source_cursor(self):
        log = c.STATE/'application.log'
        log.write_text(json.dumps({'log': 'ready\n', 'stream': 'stdout', 'time': c.iso()})+'\n')
        source = {'name': 'application', 'path': str(log), 'since': '2026-01-01T00:00:00Z'}
        with patch.object(c.os, 'fsync', side_effect=OSError('disk full')):
            with self.assertRaises(OSError): c.docker_file_batch(self.config, 'fixture', source)
        self.assertFalse((c.STATE/'docker-file-history-fixture.json').exists())
        c.docker_file_batch(self.config, 'fixture', source)
        self.assertIsNotNone(c.queued_batch('live'))

    def test_application_log_is_durable_and_delivered_under_ten_seconds(self):
        log = c.STATE/'application.log'; log.touch()
        source = {'name': 'application', 'path': str(log), 'since': '2026-01-01T00:00:00Z'}
        c.docker_file_batch(self.config, 'fixture', source, live=True)
        with self.server(lambda rows: (201, {'ok': True, 'accepted': len(rows)})):
            started = time.monotonic()
            log.write_text(json.dumps({'log': '{"message":"realtime"}\n', 'stream': 'stdout', 'time': c.iso()})+'\n')
            c.docker_file_batch(self.config, 'fixture', source, live=True)
            delivery = c.Delivery(self.config)
            try: delivery.deliver(c.queued_batch('live'))
            finally: delivery.close()
            elapsed = time.monotonic()-started
            self.assertLess(elapsed, 10)
            print(f'Application file → durable HTTP acknowledgement: {elapsed:.3f}s')

    def test_json_export_streams_unicode_and_legacy_key_order(self):
        rows = [self.event(str(index)) for index in range(300)]
        rows[150]['message'] = '🔥'*65536
        raw = json.dumps({'id': 'retained', 'events': rows, 'failures': []}, ensure_ascii=False)
        metadata = {}
        self.assertEqual(list(c.json_events(io.StringIO(raw), metadata)), rows)
        self.assertEqual(metadata, {'id': 'retained', 'failures': []})

    def test_large_backlog_streams_with_memory_under_250mb(self):
        # The old read-all/group-all path needed several simultaneous full copies.
        script = '''
import importlib.util, json, pathlib, resource, sys
spec=importlib.util.spec_from_file_location('c',sys.argv[1]);c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
c.STATE=pathlib.Path(sys.argv[2]);count=0
producer="import sys\\nfor i in range(100000):\\n sys.stdout.write('type=SYSCALL msg=audit(1790000000.123:'+str(i)+'): success=yes exe=\\\"/usr/bin/echo\\\"\\\\n'+'type=EXECVE msg=audit(1790000000.123:'+str(i)+'): argc=2 a0=\\\"echo\\\" a1=\\\"'+'x'*2048+'\\\"\\\\n')"
size=0
def lines(output):
 global size
 for line in c.record_lines(output):
  size+=len(line.encode());yield line
with c.command_stream([sys.executable,'-c',producer],timeout=120) as output:
 for event in c.audit_events(lines(output),{'host':'fixture'}):count+=1
rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
if sys.platform!='darwin':rss*=1024
print(json.dumps({'events':count,'captureBytes':size,'peakRssBytes':rss}))
'''
        result = subprocess.run([sys.executable, '-c', script, str(Path(c.__file__).resolve()), str(c.STATE)],
                                capture_output=True, text=True, check=True, timeout=120)
        measurement = json.loads(result.stdout)
        self.assertEqual(measurement['events'], 100000)
        self.assertGreater(measurement['captureBytes'], 200_000_000)
        self.assertLess(measurement['peakRssBytes'], 250_000_000)
        print('Disk backlog memory check:', measurement)


if __name__ == '__main__': unittest.main()
