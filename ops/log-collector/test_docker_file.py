import importlib.util
import gzip
import contextlib
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('collector',Path(__file__).with_name('collector.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

def line(message,second=1,stream='stdout'):
    return (json.dumps({'log':message+'\n','time':f'2026-09-19T00:00:{second:02}.1Z','stream':stream})+'\n').encode()

class DockerFileTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.state=self.root/'state';self.state.mkdir()
        self.log=self.root/'container-json.log'
        self.config={'host':'inspur'}
        self.source={'name':'cdn','path':str(self.log),'since':'2026-09-19T00:00:00Z'}
        self.state_patch=patch.object(c,'STATE',self.state);self.state_patch.start()
        self.delivered=[]
        self.send_patch=patch.object(c,'send',side_effect=lambda cfg,events:self.delivered.extend(events));self.sender=self.send_patch.start()
    def tearDown(self):
        self.send_patch.stop();self.state_patch.stop();self.temp.cleanup()
    def batch(self,live=False):return c.docker_file_batch(self.config,'container',self.source,live)
    def messages(self):return [event['message'] for event in self.delivered if event['service']=='cdn']
    def test_preserves_cli_ids_stream_and_structured_levels(self):
        self.log.write_bytes(line('ready')+line('{"level":50,"message":"failed"}',2,'stderr'))
        self.batch()
        expected=c.docker_event(self.config,'container','cdn','2026-09-19T00:00:01.100000000Z','ready')
        self.assertEqual(self.delivered[0]['sourceEventId'],expected['sourceEventId'])
        self.assertEqual(self.delivered[1]['level'],'error')
        self.assertEqual(self.delivered[1]['metadata']['stream'],'stderr')
        self.assertEqual(c.load('docker-file-history-container.json',{})['offset'],self.log.stat().st_size)
    def test_failed_delivery_preserves_offset_and_replays_same_ids(self):
        self.log.write_bytes(line('first'))
        self.sender.side_effect=RuntimeError('offline')
        with self.assertRaises(RuntimeError):self.batch()
        self.assertFalse((self.state/'docker-file-history-container.json').exists())
        self.sender.side_effect=lambda cfg,events:self.delivered.extend(events)
        self.batch();first=self.delivered[0]['sourceEventId']
        self.batch()
        self.assertEqual(len(self.delivered),1)
        self.assertEqual(first,c.docker_event(self.config,'container','cdn','2026-09-19T00:00:01.100000000Z','first')['sourceEventId'])
    def test_partial_last_record_resumes_only_after_newline(self):
        first=line('first');second=line('second',2)
        self.log.write_bytes(first+second[:-5]);self.batch()
        self.assertEqual(self.messages(),['first'])
        self.assertEqual(c.load('docker-file-history-container.json',{})['offset'],len(first))
        with self.log.open('ab') as handle:handle.write(second[-5:])
        self.batch();self.assertEqual(self.messages(),['first','second'])
    def test_rotation_finishes_old_inode_before_new_file(self):
        self.log.write_bytes(line('first'));self.batch()
        rotated=self.log.with_name(self.log.name+'.1');self.log.rename(rotated)
        with rotated.open('ab') as handle:handle.write(line('second',2))
        self.log.write_bytes(line('third',3))
        self.batch();self.assertEqual(self.messages(),['first','second'])
        self.batch();self.assertEqual(self.messages(),['first','second','third'])
    def test_gzip_history_fails_explicitly_without_advancing_or_blocking_live(self):
        with gzip.open(self.log.with_name(self.log.name+'.1.gz'),'wb') as handle:handle.write(line('archived'))
        self.log.write_bytes(line('current',2))
        with self.assertRaisesRegex(c.DockerCollectionError,'compressed history requires CLI recovery'):self.batch()
        self.assertFalse((self.state/'docker-file-history-container.json').exists())
        self.batch(live=True)
        with self.log.open('ab') as handle:handle.write(line('new',3))
        self.batch(live=True);self.assertEqual(self.messages(),['new'])
    def test_gzip_at_enrollment_keeps_original_cli_path(self):
        with gzip.open(self.log.with_name(self.log.name+'.1.gz'),'wb') as handle:handle.write(line('archived'))
        self.log.write_bytes(line('current',2))
        with patch.object(c,'command',return_value=json.dumps({'path':str(self.log),'driver':'json-file'})):
            self.assertFalse(c.register_docker_file(self.config,'container','cdn',self.source['since']))
        self.assertFalse((self.state/'docker-file-sources.json').exists())
    def test_rotated_partial_fragment_is_preserved_before_advancing(self):
        fragment=b'{"log":"incomplete token=synthetic-private-value'
        rotated=self.log.with_name(self.log.name+'.1');rotated.write_bytes(line('old')+fragment)
        self.log.write_bytes(line('new',2))
        self.batch();self.batch()
        fragments=[event for event in self.delivered if event['metadata'].get('event_type')=='source_fragment']
        self.assertEqual(len(fragments),1);self.assertEqual(fragments[0]['level'],'error')
        self.assertNotIn('synthetic-private-value',fragments[0]['message'])
        self.assertEqual(fragments[0]['metadata']['source_fragment']['byte_length'],len(fragment))
        self.assertTrue(any(event['message']=='new' for event in self.delivered))
        self.assertEqual(rotated.read_bytes(),line('old')+fragment)
    def test_failed_rotated_fragment_delivery_retries_identical_event_before_advance(self):
        rotated=self.log.with_name(self.log.name+'.1');rotated.write_bytes(b'{"log":"unfinished')
        self.log.write_bytes(line('new',2));captured=[]
        def fail(config,events):captured.extend(events);raise RuntimeError('offline')
        self.sender.side_effect=fail
        with self.assertRaises(RuntimeError):self.batch()
        self.assertFalse((self.state/'docker-file-history-container.json').exists())
        self.sender.side_effect=lambda cfg,events:self.delivered.extend(events)
        self.batch();self.assertEqual(self.delivered[0]['sourceEventId'],captured[0]['sourceEventId'])
        self.batch();self.assertEqual(self.delivered[-1]['message'],'new')
    def test_truncation_emits_notice_then_collects_available_contents(self):
        self.log.write_bytes(line('large-original-'+('x'*200)));self.batch()
        self.log.write_bytes(line('new',2));self.batch()
        self.assertEqual(self.messages(),['large-original-'+('x'*200),'new'])
        notices=[event for event in self.delivered if event['service']=='host-log-collector']
        self.assertEqual(len(notices),1);self.assertIn('truncated',notices[0]['message'])
    def test_rewrite_growing_past_old_offset_is_detected_by_anchor(self):
        self.log.write_bytes(line('old'));self.batch()
        self.log.write_bytes(line('new-'+('y'*200),2));self.batch()
        self.assertEqual(self.messages(),['old','new-'+('y'*200)])
        self.assertTrue(any('rewritten' in event['message'] for event in self.delivered if event['service']=='host-log-collector'))
    def test_missing_previous_inode_reports_discontinuity_without_claiming_loss(self):
        self.log.write_bytes(line('first'));self.batch()
        self.log.rename(self.root/'outside-retained-files')
        self.log.write_bytes(line('new',2));self.batch()
        notice=next(event for event in self.delivered if event['service']=='host-log-collector')
        self.assertIn('previous source file unavailable',notice['message'])
        self.assertNotIn('lost',notice['message'])
        self.assertEqual(self.messages(),['first','new'])
    def test_live_path_is_independent_and_overlap_keeps_stable_ids(self):
        self.log.write_bytes(line('history'));self.batch(live=True)
        self.assertFalse((self.state/'docker-file-history-container.json').exists())
        with self.log.open('ab') as handle:handle.write(line('new',2))
        self.batch(live=True);live_id=self.delivered[0]['sourceEventId']
        self.batch()
        self.assertEqual(self.messages(),['new','history','new'])
        self.assertEqual(self.delivered[-1]['sourceEventId'],live_id)
    def test_live_partial_line_and_failed_delivery_keep_retry_position(self):
        first=line('history');second=line('new',2)
        self.log.write_bytes(first+second[:-4]);self.batch(live=True)
        initial=c.load('docker-file-live-container.json',{})
        self.assertEqual(initial['offset'],len(first))
        with self.log.open('ab') as handle:handle.write(second[-4:])
        self.sender.side_effect=RuntimeError('offline')
        with self.assertRaises(RuntimeError):self.batch(live=True)
        self.assertEqual(c.load('docker-file-live-container.json',{}),initial)
        self.sender.side_effect=lambda cfg,events:self.delivered.extend(events)
        self.batch(live=True);self.assertEqual(self.messages(),['new'])
    def test_guest_file_cursors_commit_only_after_host_ack(self):
        def collect(config):
            c.save('docker-file-sources.json',{'container':self.source})
            c.save('docker-file-history-container.json',{'inode':1,'device':2,'offset':123})
            return []
        output=io.StringIO()
        with patch.object(c,'collect',side_effect=collect),contextlib.redirect_stdout(output):
            c.guest_export({'host':'guest','start':self.source['since']})
        export=json.loads(output.getvalue())
        self.assertFalse((self.state/'docker-file-history-container.json').exists())
        c.guest_ack(export['id'])
        self.assertEqual(c.load('docker-file-history-container.json',{})['offset'],123)
        self.assertEqual(c.load('docker-file-sources.json',{})['container'],self.source)
    def test_time_budget_preserves_next_complete_record(self):
        first=line('first');self.log.write_bytes(first+line('second',2))
        with patch.object(c.time,'monotonic',side_effect=[0,0,2]):self.batch()
        self.assertEqual(self.messages(),['first'])
        self.assertEqual(c.load('docker-file-history-container.json',{})['offset'],len(first))
        self.batch();self.assertEqual(self.messages(),['first','second'])
    def test_malformed_complete_record_keeps_unacknowledged_history(self):
        self.log.write_bytes(line('first')+b'not-json\n')
        with self.assertRaisesRegex(c.DockerCollectionError,'invalid JSON log record'):self.batch()
        self.assertFalse((self.state/'docker-file-history-container.json').exists())
        self.assertEqual(self.delivered,[])
    def test_cutoff_remains_inclusive_when_switching_from_cli(self):
        self.source['since']='2026-09-19T00:00:02.100000Z'
        self.log.write_bytes(line('earlier')+line('boundary',2)+line('new',3));self.batch()
        self.assertEqual(self.messages(),['boundary','new'])
    def test_multiline_and_terminal_non_newline_records_match_cli_and_keep_content(self):
        for message in ['first\nsecond\nthird','complete record without terminal newline']:
            record={'log':message,'time':'2026-09-19T00:00:01.1Z','stream':'stdout'}
            self.log.write_text(json.dumps(record)+'\n')
            (self.state/'docker-file-history-container.json').unlink(missing_ok=True)
            self.delivered.clear();self.batch()
            cli=c.docker_cli_events(self.config,'container','cdn','2026-09-19T00:00:01.100000000Z '+message)
            self.assertEqual(len(cli),1)
            self.assertEqual(cli[0]['message'],message)
            self.assertEqual(cli[0]['sourceEventId'],self.delivered[0]['sourceEventId'])
            self.assertEqual(self.delivered[0]['message'],message)
    def test_string_level_normalization_keeps_explicit_info_and_numeric_levels(self):
        for raw,expected in [('ERROR','error'),(' ERROR ','error'),('WARN','warn'),('WARNING','warn'),('CRITICAL','fatal'),('Fatal','fatal'),('INFO','info'),(50,'error'),(30,'info')]:
            event=c.docker_event(self.config,'container','cdn','2026-09-19T00:00:01.100000000Z',json.dumps({'level':raw,'message':'benign text mentions an error'}))
            self.assertEqual(event['level'],expected)
    def test_timeout_enrolls_readable_file_without_advancing_cli_cursor(self):
        self.log.write_bytes(line('first'));c.save('docker.json',{'container':self.source['since']})
        with patch.object(c.shutil,'which',return_value='/usr/bin/docker'),patch.object(c,'command',side_effect=['container cdn','2026-09-18T00:00:00Z',json.dumps({'path':str(self.log),'driver':'json-file'})]),patch.object(c.subprocess,'run',side_effect=subprocess.TimeoutExpired('docker',60)):
            c.docker({'host':'inspur','start':'2026-09-01T00:00:00Z'})
        self.assertEqual(c.load('docker-file-sources.json',{})['container']['since'],self.source['since'])
        self.assertEqual(c.load('docker.json',{})['container'],self.source['since'])
        self.assertEqual(self.delivered,[])
    def test_failed_discontinuity_notice_does_not_advance_history(self):
        self.log.write_bytes(line('original-'+('x'*100)));self.batch()
        original=c.load('docker-file-history-container.json',{})
        self.log.write_bytes(line('new',2));self.sender.side_effect=RuntimeError('offline')
        with self.assertRaises(RuntimeError):self.batch()
        self.assertEqual(c.load('docker-file-history-container.json',{}),original)

    def test_removed_source_archives_acknowledgments_only_after_one_notice(self):
        cursor={'device':1,'inode':2,'offset':123,'anchor':'retained-hash'}
        c.save('docker-file-sources.json',{'container':self.source})
        c.save('docker-file-history-container.json',cursor)
        with patch.object(c.shutil,'which',return_value='/usr/bin/docker'),patch.object(c,'command',return_value=''):
            c.docker({'host':'inspur','start':self.source['since']});c.docker({'host':'inspur','start':self.source['since']})
        self.assertEqual(len(self.delivered),1)
        self.assertEqual(self.delivered[0]['level'],'error')
        self.assertIn('final log coverage is unknown',self.delivered[0]['message'])
        self.assertEqual(c.load('docker-file-history-container.json',{}),cursor)
        self.assertNotIn('container',c.load('docker-file-sources.json',{}))
        retired=c.load('docker-file-retired.json',{})['container']
        self.assertEqual(retired['source'],self.source)
        self.assertEqual(retired['cursors']['history']['checkpoint'],cursor)
        self.assertEqual(c.docker_file_history(self.config)['retiredUnavailableSources'],1)
    def test_failed_retirement_notice_preserves_active_source_and_retries_stable_identity(self):
        c.save('docker-file-sources.json',{'container':self.source})
        cursor={'device':1,'inode':2,'offset':123};c.save('docker-file-history-container.json',cursor)
        captured=[]
        def fail(config,events):captured.extend(events);raise RuntimeError('offline')
        self.sender.side_effect=fail
        with patch.object(c.shutil,'which',return_value='/usr/bin/docker'),patch.object(c,'command',return_value=''):
            with self.assertRaises(c.DockerCollectionError):c.docker({'host':'inspur','start':self.source['since']})
            self.assertIn('container',c.load('docker-file-sources.json',{}))
            self.assertEqual(c.load('docker-file-retired.json',{}),{})
            self.sender.side_effect=lambda cfg,events:self.delivered.extend(events)
            c.docker({'host':'inspur','start':self.source['since']})
        self.assertEqual(captured[0]['sourceEventId'],self.delivered[0]['sourceEventId'])
        self.assertEqual(c.load('docker-file-history-container.json',{}),cursor)
    def test_existing_container_missing_file_keeps_failure_and_never_retires(self):
        c.save('docker-file-sources.json',{'container':self.source})
        with patch.object(c.shutil,'which',return_value='/usr/bin/docker'),patch.object(c,'command',return_value='container cdn'):
            c.docker({'host':'inspur','start':self.source['since']})
        with self.assertRaisesRegex(c.DockerCollectionError,'source files unavailable'):self.batch()
        self.assertIn('container',c.load('docker-file-sources.json',{}));self.assertEqual(self.delivered,[])
    def test_removed_container_retained_file_remains_readable_history(self):
        self.log.write_bytes(line('retained'))
        c.save('docker-file-sources.json',{'container':self.source})
        with patch.object(c.shutil,'which',return_value='/usr/bin/docker'),patch.object(c,'command',return_value=''):
            c.docker({'host':'inspur','start':self.source['since']})
        self.batch();self.assertEqual(self.messages(),['retained'])
        self.assertIn('container',c.load('docker-file-sources.json',{}))
        self.assertEqual(c.load('docker-file-retired.json',{}),{})
    def test_replacement_automatically_enrolls_with_existing_cutoff_and_new_identity(self):
        old_source={**self.source,'path':str(self.root/'gone.json')}
        old_cursor={'device':1,'inode':2,'offset':123}
        c.save('docker-file-sources.json',{'old':old_source})
        c.save('docker-file-history-old.json',old_cursor)
        c.save('docker.json',{'new':self.source['since']})
        self.log.write_bytes(line('replacement'))
        def command(args,**kwargs):
            return 'new cdn' if args[1]=='ps' else json.dumps({'path':str(self.log),'driver':'json-file'})
        with patch.object(c.shutil,'which',return_value='/usr/bin/docker'),patch.object(c,'command',side_effect=command),patch.object(c.subprocess,'run') as cli:
            c.docker({'host':'inspur','start':'2026-09-01T00:00:00Z'})
        cli.assert_not_called()
        source=c.load('docker-file-sources.json',{})['new']
        self.assertEqual(source['since'],self.source['since'])
        self.assertEqual(c.load('docker-file-history-old.json',{}),old_cursor)
        c.docker_file_batch(self.config,'new',source)
        expected=c.docker_event(self.config,'new','cdn','2026-09-19T00:00:01.100000000Z','replacement')
        self.assertEqual(self.delivered[-1]['sourceEventId'],expected['sourceEventId'])
        self.assertEqual(c.load('docker-file-history-new.json',{})['offset'],self.log.stat().st_size)
    def test_cli_skips_only_proven_precreation_time_and_caches_creation(self):
        created='2026-09-19T00:00:05Z';calls=[]
        def command(args,**kwargs):
            calls.append(args)
            return 'new api' if args[1]=='ps' else created
        with patch.object(c.shutil,'which',return_value='/usr/bin/docker'),patch.object(c,'command',side_effect=command),patch.object(c.subprocess,'run',return_value=subprocess.CompletedProcess([],0,'')) as cli:
            c.docker({'host':'inspur','start':self.source['since']})
            self.assertEqual(cli.call_args.args[0][4],created)
            c.docker({'host':'inspur','start':self.source['since']})
        self.assertEqual(sum(args[1]=='inspect' for args in calls),1)
        self.assertEqual(c.load('docker-created.json',{})['new'],created)
    def test_failed_delivery_after_creation_clamp_keeps_original_cli_checkpoint(self):
        c.save('docker.json',{'new':self.source['since']})
        self.sender.side_effect=RuntimeError('offline')
        with patch.object(c.shutil,'which',return_value='/usr/bin/docker'),patch.object(c,'command',side_effect=['new api','2026-09-19T00:00:05Z']),patch.object(c.subprocess,'run',return_value=subprocess.CompletedProcess([],0,'2026-09-19T00:00:10.000000000Z new\n')):
            with self.assertRaises(c.DockerCollectionError):c.docker({'host':'inspur','start':self.source['since']})
        self.assertEqual(c.load('docker.json',{})['new'],self.source['since'])
    def test_inventory_failure_cannot_retire_registered_history(self):
        c.save('docker-file-sources.json',{'container':self.source})
        with patch.object(c.shutil,'which',return_value='/usr/bin/docker'),patch.object(c,'command',side_effect=RuntimeError('inventory offline')):
            with self.assertRaises(RuntimeError):c.docker({'host':'inspur','start':self.source['since']})
        self.assertIn('container',c.load('docker-file-sources.json',{}))
        self.assertEqual(c.load('docker-file-retired.json',{}),{})
        self.assertEqual(self.delivered,[])

if __name__=='__main__':unittest.main()
