import importlib.util
from pathlib import Path
import unittest
import contextlib
import io
import json
import tempfile
import subprocess
import sys
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('collector',Path(__file__).with_name('collector.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

class CollectorTests(unittest.TestCase):
    def test_recent_audit_date_uses_ausearch_c_locale_two_digit_year(self):
        with patch.object(c.time,'time',return_value=1789822896):
            date,clock=c.recent_audit_start()
        self.assertEqual(date,'09/19/26')
        self.assertRegex(clock,r'^\d{2}:\d{2}:\d{2}$')
    def test_configuration_uses_api_origin_and_preserves_cursor_start(self):
        with tempfile.TemporaryDirectory() as tmp:
            config=Path(tmp)/'collector.json'; config.write_text(json.dumps({'start':'2026-09-01T00:00:00Z'}))
            credential=Path(tmp)/'credential.json'; credential.write_text(json.dumps({'LOG_INGEST_TOKEN':'synthetic-test-credential-value-only'}))
            result=subprocess.run([sys.executable,str(Path(__file__).with_name('configure.py')),'inspur',str(credential),str(config)],capture_output=True,text=True,check=True)
            value=json.loads(config.read_text())
            self.assertEqual(value['url'],'https://api.hanasand.com/api/logs/ingest')
            self.assertEqual(value['start'],'2026-09-01T00:00:00Z')
            self.assertEqual(config.stat().st_mode & 0o777,0o600)
            self.assertEqual(result.stdout,'')
    def test_exec_identity_command_and_hex_arguments(self):
        raw='''----
type=SYSCALL msg=audit(1789817000.123:456): arch=c000003e syscall=59 success=yes pid=123 ppid=100 uid=1000 auid=1000 exe="/usr/bin/whoami" key="hanasand_exec"
type=EXECVE msg=audit(1789817000.123:456): argc=1 a0="whoami"
----
type=SYSCALL msg=audit(1789817001.123:457): syscall=59 success=yes pid=124 uid=0 exe="/usr/bin/curl"
type=EXECVE msg=audit(1789817001.123:457): argc=2 a0="curl" a1=68747470733a2f2f6578616d706c652e746573742f426c6f6f64486f756e642e7a6970
'''
        rows=c.parse_audit(raw.replace('----', ''),{'host':'inspur'})
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['metadata']['process']['executable'],'/usr/bin/whoami')
        self.assertEqual(rows[0]['level'],'info')
        self.assertIn('BloodHound.zip',rows[1]['message'])
        self.assertEqual(rows[0]['sourceEventId'],c.parse_audit(raw,{'host':'inspur'})[0]['sourceEventId'])
        self.assertNotEqual(rows[0]['sourceEventId'],c.parse_audit(raw,{'host':'ovhcloud'})[0]['sourceEventId'])
    def test_scrub(self):
        self.assertNotIn('abc123',c.scrub('curl --token abc123 https://test'))
        self.assertNotIn('user:pass',c.scrub('curl https://user:pass@example.test'))
    def test_command_line_only_credentials_and_headers_are_redacted(self):
        for text in ('token: Bearer synthetic-private', 'curl --client-secret-key synthetic-private https://example.test',
                     'curl --header "Cookie: sid=synthetic-private; session=synthetic-private" https://example.test',
                     'curl -u "user:synthetic-private" https://example.test', 'sshpass -p synthetic-private ssh example.test',
                     'mysql -p synthetic-private', 'redis-cli -a synthetic-private', 'DB_PASSWORD="synthetic-private phrase"',
                     'curl -uuser:synthetic-private https://example.test', 'mysql -psynthetic-private'):
            self.assertNotIn('synthetic-private',c.scrub(text),text)
            self.assertNotIn('synthetic-private',str(c.scrub_metadata({'process':{'command_line':text}})),text)
    def test_quoted_header_retains_shell_argument_boundaries(self):
        self.assertEqual(c.scrub('curl -H \"Cookie: sid=synthetic-private; session=synthetic-private\" https://example.test'),
                         'curl -H \"Cookie: [REDACTED]\" https://example.test')
    def test_short_flags_preserve_behavior_when_they_are_not_credentials(self):
        argv=['mkdir','-p','/etc/cron.d']
        self.assertEqual(c.scrub_arguments(argv),argv)
        self.assertEqual(c.scrub('ssh -p 222 example.test'),'ssh -p 222 example.test')
        self.assertNotIn('synthetic-private',str(c.scrub_arguments(['curl','-usynthetic-private','https://example.test'])))
        self.assertNotIn('synthetic-private',str(c.scrub_arguments(['sshpass','-p','synthetic-private','ssh','example.test'])))
        self.assertNotIn('synthetic-private',str(c.scrub_arguments(['curl','--user=user:synthetic-private','https://example.test'])))
        self.assertNotIn('synthetic-private',str(c.scrub_metadata({'process':{'arguments':['curl','-u','synthetic-private']}})))
    def test_old_guest_spool_is_redacted_before_replay(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            c.save('export.json',{'id':'existing','events':[{'sourceEventId':'stable','message':'curl -usynthetic-private',
                'metadata':{'process':{'arguments':['curl','-u','synthetic-private']}}}],'failures':[]})
            output=io.StringIO()
            with contextlib.redirect_stdout(output): c.guest_export({'host':'inspur/vm'})
            self.assertNotIn('synthetic-private',output.getvalue())
            self.assertEqual(json.loads(output.getvalue())['events'][0]['sourceEventId'],'stable')
    def test_metadata_redaction(self):
        value=c.scrub_metadata({'structured': {'authorization':'Bearer private', 'nested':[{'message':'token=private'}]}})
        self.assertNotIn('private',str(value))
    def test_oversized_metadata_is_bounded_and_preserves_process_evidence(self):
        for metadata in ({'process':{'executable':'/usr/bin/whoami','command_line':'whoami','arguments':['whoami']},'structured':{'huge':'x'*2000000}},
                         {'structured':{'process':{'executable':'/usr/bin/whoami','command_line':'whoami','arguments':['whoami']},'huge':'x'*2000000}}):
            row=c.event({'host':'inspur'},'large','application','🔥'*65536,'2026-09-19T00:00:00Z',metadata)
            self.assertLess(c.json_size(row),512000)
            self.assertTrue(row['metadata']['telemetry_truncated'])
            self.assertGreater(row['metadata']['metadata_original_bytes'],2000000)
            process=row['metadata'].get('process') or row['metadata']['structured']['process']
            self.assertEqual(process['arguments'],['whoami'])
    def test_no_process_for_random_mentions(self):
        self.assertEqual(c.parse_audit('service: whoami xmrig',{'host':'inspur'}),[])
    def test_split_audit_arguments_and_argument_redaction(self):
        raw='''type=SYSCALL msg=audit(1789817000.123:456): success=yes pid=123 ppid=100 uid=1000 auid=1000 exe="/usr/bin/curl"
type=EXECVE msg=audit(1789817000.123:456): argc=5 a0="curl" a1="--password" a2="private phrase" a3_len=26 a3[0]="https://example.test/" a3[1]="sample" a4="Authorization: Bearer header-private"
'''
        row=c.parse_audit(raw,{'host':'inspur'})[0]
        self.assertNotIn('private',json.dumps(row))
        self.assertEqual(row['metadata']['process']['arguments'][3],'https://example.test/sample')
        self.assertEqual(row['metadata']['process']['arguments'][2],'[REDACTED]')
    def test_guest_export_replays_until_ack_and_only_then_commits(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            c.save('journal.json','before')
            def collect(config):
                c.send(config,[{'message':'whoami'}])
                c.save('journal.json','after')
                return []
            with patch.object(c,'collect',side_effect=collect) as run:
                output=io.StringIO()
                with contextlib.redirect_stdout(output): c.guest_export({'host':'inspur/vm'})
                first=json.loads(output.getvalue())
                self.assertEqual(c.load('journal.json',None),'before')
                output=io.StringIO()
                with contextlib.redirect_stdout(output): c.guest_export({'host':'inspur/vm'})
                self.assertEqual(first,json.loads(output.getvalue()))
                self.assertEqual(run.call_count,1)
                with self.assertRaises(RuntimeError): c.guest_ack('wrong')
                self.assertEqual(c.load('journal.json',None),'before')
                c.guest_ack(first['id'])
                self.assertEqual(c.load('journal.json',None),'after')
                self.assertFalse((c.STATE/'export.json').exists())
    def test_audit_delivery_failure_retains_checkpoint(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            (c.STATE/'audit.checkpoint').write_text('original')
            def ausearch(*args,**kwargs):
                (c.STATE/'audit.pending').write_text('next')
                return ''
            with patch.object(c,'command',side_effect=ausearch), patch.object(c,'send',side_effect=RuntimeError('offline')):
                with self.assertRaises(RuntimeError): c.audit({'host':'inspur'})
            self.assertEqual((c.STATE/'audit.checkpoint').read_text(),'original')
    def test_audit_rotated_checkpoint_uses_timestamp_recovery(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            (c.STATE/'audit.checkpoint').write_text('original')
            with patch.object(c,'command',side_effect=[c.CommandError('ausearch',12),'']) as query, patch.object(c,'send'):
                c.audit({'host':'inspur'})
            self.assertEqual(query.call_args.args[0][-2:],['--start','checkpoint'])
    def test_live_audit_uses_separate_checkpoint_and_prioritizes_newest(self):
        raw='''type=SYSCALL msg=audit(1789817000.123:456): success=yes exe="/usr/bin/whoami"
type=EXECVE msg=audit(1789817000.123:456): argc=1 a0="whoami"
type=SYSCALL msg=audit(1789817001.123:457): success=yes exe="/usr/bin/id"
type=EXECVE msg=audit(1789817001.123:457): argc=1 a0="id"
'''
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            (c.STATE/'audit.checkpoint').write_text('historical')
            def query(args,**kwargs):
                self.assertIn('--start',args)
                self.assertEqual(args[-3:],['--start',*c.recent_audit_start()])
                (c.STATE/'audit-live.pending').write_text('live')
                return raw
            delivered=[]
            with patch.object(c,'command',side_effect=query), patch.object(c,'send',side_effect=lambda _cfg,events:delivered.extend(events)):
                c.audit({'host':'inspur'},live=True)
            self.assertEqual([row['message'] for row in delivered],['id','whoami'])
            self.assertEqual((c.STATE/'audit.checkpoint').read_text(),'historical')
            self.assertEqual((c.STATE/'audit-live.checkpoint').read_text(),'live')
    def test_live_audit_reactivates_for_stale_historical_checkpoint(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)), patch.object(c.time,'time',return_value=1000):
            self.assertTrue(c.audit_behind())
            checkpoint=c.STATE/'audit.checkpoint'
            checkpoint.write_text('dev=0x903\ninode=1\noutput=- 980.123:123 0x514\n')
            self.assertFalse(c.audit_behind())
            checkpoint.write_text('dev=0x903\ninode=1\noutput=- 900.123:123 0x514\n')
            self.assertTrue(c.audit_behind())
            (c.STATE/'audit-live.checkpoint').write_text('output=- 939.123:10 0x514\n')
            with patch.object(c,'command',return_value='') as query, patch.object(c,'send'):
                c.audit({'host':'inspur'},live=True)
            self.assertEqual(query.call_args.args[0][-3:],['--start',*c.recent_audit_start()])
            self.assertIn('900.123',checkpoint.read_text())
    def test_journal_cursor_rotation_resumes_from_saved_time(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            c.save('journal.json',{'cursor':'expired','since':'2026-09-19T00:00:00Z'})
            row={'__CURSOR':'next','__REALTIME_TIMESTAMP':'1789817000000000','MESSAGE':'ready'}
            with patch.object(c,'command',side_effect=[c.CommandError('journalctl',1),json.dumps(row)]) as query, patch.object(c,'send') as sent:
                c.journal({'host':'inspur','start':'2026-01-01T00:00:00Z'})
            self.assertEqual(query.call_args.args[0][-2:],['--since','2026-09-19T00:00:00Z'])
            self.assertEqual(c.load('journal.json',{})['cursor'],'next')
            self.assertEqual(sent.call_args.args[1][0]['message'],'ready')
    def test_docker_failure_does_not_skip_other_containers(self):
        class Result:
            def __init__(self,code,output): self.returncode=code; self.stdout=output
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            with patch.object(c.shutil,'which',return_value='/usr/bin/docker'), patch.object(c,'command',return_value='bad broken\ngood healthy'), patch.object(c.subprocess,'run',side_effect=[Result(1,''),Result(0,'2026-09-19T12:00:00Z ready')]), patch.object(c,'send') as sent:
                with self.assertRaisesRegex(c.DockerCollectionError,r'broken \(log read exited 1\)'): c.docker({'host':'inspur','start':'2026-09-19T00:00:00Z'})
            self.assertEqual(sent.call_count,1)
            self.assertEqual(sent.call_args[0][1][0]['service'],'healthy')
            self.assertIn('good',c.load('docker.json',{}))
            self.assertNotIn('bad',c.load('docker.json',{}))
    def test_docker_backfill_advances_only_one_minute_after_ack(self):
        class Result:
            returncode=0
            stdout='2026-09-19T00:00:30Z ready'
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            with patch.object(c.shutil,'which',return_value='/usr/bin/docker'), patch.object(c,'command',return_value='one service'), patch.object(c.subprocess,'run',return_value=Result()) as query, patch.object(c,'send'):
                c.docker({'host':'inspur','start':'2026-09-19T00:00:00Z'})
            args=query.call_args.args[0]
            self.assertEqual(args[args.index('--until')+1],'2026-09-19T00:01:00+00:00')
            self.assertEqual(c.load('docker.json',{})['one'],'2026-09-19T00:01:00+00:00')
    def test_docker_timeout_keeps_its_cursor_and_collects_next_container(self):
        class Result:
            returncode=0
            stdout='2026-09-19T00:00:30Z ready'
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            c.save('docker.json',{'slow':'2026-09-19T00:00:00Z'})
            with patch.object(c.shutil,'which',return_value='/usr/bin/docker'), patch.object(c,'command',return_value='slow slow-service\ngood healthy-service'), patch.object(c.subprocess,'run',side_effect=[subprocess.TimeoutExpired('docker',60),Result()]), patch.object(c,'send') as sent:
                with self.assertRaisesRegex(c.DockerCollectionError,r'slow-service \(log read timed out after 60s\)'): c.docker({'host':'inspur','start':'2026-09-19T00:00:00Z'})
            self.assertEqual(sent.call_args.args[1][0]['service'],'healthy-service')
            self.assertEqual(c.load('docker.json',{})['slow'],'2026-09-19T00:00:00Z')
            self.assertEqual(c.load('docker.json',{})['good'],'2026-09-19T00:01:00+00:00')
    def test_docker_delivery_failure_has_actionable_safe_health_context(self):
        class Result:
            returncode=0
            stdout='2026-09-19T00:00:30Z ready'
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            with patch.object(c.shutil,'which',return_value='/usr/bin/docker'), patch.object(c,'command',return_value='one service'), patch.object(c.subprocess,'run',return_value=Result()), patch.object(c,'send',side_effect=c.HTTPError('https://example.invalid/private-test-value',400,'private-test-value',{},None)):
                with self.assertRaises(c.DockerCollectionError) as raised:c.docker({'host':'inspur','start':'2026-09-19T00:00:00Z'})
            detail=c.collection_error(raised.exception)
            self.assertIn('service (delivery HTTP 400)',detail)
            self.assertNotIn('private-test-value',detail)
            self.assertNotIn('one',c.load('docker.json',{}))
            self.assertEqual(c.collection_error(RuntimeError('private-test-value')),'RuntimeError')
    def test_docker_removal_and_unsupported_driver_report_source_without_stderr(self):
        class Result:
            returncode=1
            def __init__(self,message):self.stdout=message
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'STATE',Path(tmp)):
            for message,reason in [('No such container: synthetic-private-value','removed during collection'),('configured logging driver does not support reading synthetic-private-value','logging driver does not support reading')]:
                with patch.object(c.shutil,'which',return_value='/usr/bin/docker'), patch.object(c,'command',return_value='one service'), patch.object(c.subprocess,'run',return_value=Result(message)):
                    with self.assertRaises(c.DockerCollectionError) as raised:c.docker({'host':'inspur','start':'2026-09-19T00:00:00Z'})
                self.assertIn(reason,str(raised.exception))
                self.assertNotIn('synthetic-private-value',str(raised.exception))
if __name__=='__main__':unittest.main()
