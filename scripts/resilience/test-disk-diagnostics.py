import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

spec = importlib.util.spec_from_file_location('monitor', Path(__file__).with_name('monitor.py'))
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)

class PrivacyTests(unittest.TestCase):
    def test_directory_paths_never_enter_status_responses(self):
        with tempfile.TemporaryDirectory() as root:
            monitor.ROOT = Path(root)
            monitor.STATE = monitor.ROOT / 'state.json'
            snapshot = {'sampledAt': '2026-09-19T00:00:00Z', 'host': 'test', 'filesystems': [{'directories': [{'path': '/private/directory', 'sizeBytes': 42}]}]}
            (monitor.ROOT / 'disk-directories.json').write_text(json.dumps(snapshot))
            server = ThreadingHTTPServer(('127.0.0.1', 0), monitor.Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                base = 'http://127.0.0.1:' + str(server.server_port)
                with urllib.request.urlopen(base + '/disk-diagnostics') as response:
                    self.assertEqual(json.load(response), snapshot)
                for endpoint in ('/status', '/health', '/public-status'):
                    try:
                        response = urllib.request.urlopen(base + endpoint)
                    except urllib.error.HTTPError as error:
                        response = error
                    with response:
                        body = response.read().decode()
                    self.assertNotIn('diskDiagnostics', body)
                    self.assertNotIn('/private/directory', body)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()

if __name__ == '__main__':
    unittest.main()
