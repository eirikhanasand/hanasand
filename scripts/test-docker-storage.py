import importlib.util
from pathlib import Path
import unittest
import tempfile
import threading
from types import SimpleNamespace
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('storage', Path(__file__).with_name('docker-storage.py'))
storage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(storage)

class StorageTest(unittest.TestCase):
    def test_retains_running_stopped_recent_and_rollback_images(self):
        clock = 2_000_000
        images = [{'Id': str(i), 'RepoTags': ['app:v'+str(i)], 'Created': i*100, 'Size': 100, 'SharedSize': 40} for i in range(1, 7)]
        images += [{'Id': 'recent', 'RepoTags': ['other:new'], 'Created': clock-1, 'Size': 50}]
        images += [{'Id': 'pinned', 'RepoTags': [], 'Created': 1, 'Size': 50, 'Labels': {'hanasand.keep': 'true'}}]
        rows = storage.image_inventory(images, [{'ImageID': '1'}, {'ImageID': '2'}], clock)
        self.assertEqual({r['id'] for r in rows if r['eligible']}, {'3', '4'})
        self.assertEqual({r['id'] for r in rows if r['retainedReason']=='Rollback image'}, {'5', '6'})
        self.assertEqual(rows[0]['uniqueBytes'], 60)
        self.assertNotIn('1', {r['id'] for r in rows})
        self.assertNotIn('2', {r['id'] for r in rows})

    def test_multitag_image_counts_once_for_rollback(self):
        images = [{'Id':'a','RepoTags':['app:v3','app:latest'],'Created':3,'Size':10},
                  {'Id':'b','RepoTags':['app:v2'],'Created':2,'Size':10},
                  {'Id':'c','RepoTags':['app:v1'],'Created':1,'Size':10}]
        self.assertEqual([r['id'] for r in storage.image_inventory(images, [], 2_000_000) if r['eligible']], ['c'])

class CleanupStateTest(unittest.TestCase):
    def test_snapshot_only_requests_images_and_cache(self):
        with patch.object(storage, 'docker', side_effect=[{}, []]) as docker:
            storage.snapshot()
        self.assertEqual(docker.call_args_list[0].args[0], '/system/df?type=build-cache&type=image')

    def test_successful_refresh_clears_only_refresh_error(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(storage, 'STATE_DIR', Path(directory)):
            root = Path(directory)
            storage.save(root / 'status.json', {'error': 'scan failed', 'errorStage': 'refresh', 'lastSuccessAt': 'previous-success'})
            with patch.object(storage, 'snapshot', return_value={'checkedAt': 'later'}):
                storage.perform()
            self.assertIsNone(storage.read(root / 'status.json')['error'])
            self.assertEqual(storage.read(root / 'status.json')['lastSuccessAt'], 'previous-success')

    def test_metrics_refresh_leaves_cleanup_queued(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(storage, 'STATE_DIR', Path(directory)):
            root = Path(directory)
            storage.save(root / 'status.json', {'lastSuccessAt': 'previous-success'})
            storage.save(root / 'request.json', {'requestedAt': 'now'})
            with patch.object(storage, 'snapshot', return_value={'checkedAt': 'later'}), patch.object(storage, 'command') as command:
                storage.perform()
            command.assert_not_called()
            self.assertTrue((root / 'request.json').exists())
            self.assertEqual(storage.read(root / 'status.json')['lastSuccessAt'], 'previous-success')

    def test_manual_reclaims_all_cache_and_nightly_retains_budget(self):
        for manual in (True, False):
            with self.subTest(manual=manual), tempfile.TemporaryDirectory() as directory, patch.object(storage, 'STATE_DIR', Path(directory)):
                root = Path(directory)
                if manual:
                    storage.save(root / 'request.json', {'requestedAt': 'now'})
                phases = []
                def inspect(path):
                    phases.append(storage.read(root / 'status.json')['phase'])
                    return []
                with patch.object(storage, 'docker', side_effect=inspect), patch.object(storage, 'command') as command, patch.object(storage, 'snapshot', return_value={'reclaimableCacheBytes': 0}) as snapshot:
                    storage.perform(clear=True)
                expected = ['builder', 'prune', '--all', '--force']
                if not manual:
                    expected += ['--keep-storage', str(storage.CACHE_BUDGET)]
                command.assert_called_once_with(expected)
                snapshot.assert_called_once()
                self.assertEqual(phases, ['images', 'images'])
                status = storage.read(root / 'status.json')
                self.assertFalse(status['running'])
                self.assertIsNone(status['phase'])
                self.assertEqual(status['reclaimableCacheBytes'], 0)
                self.assertFalse((root / 'request.json').exists())

    def test_nightly_cleanup_preserves_new_manual_request(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(storage, 'STATE_DIR', Path(directory)):
            root = Path(directory)
            def prune(args):
                storage.save(root / 'request.json', {'requestedAt': 'during-nightly'})
            with patch.object(storage, 'command', side_effect=prune), patch.object(storage, 'docker', return_value=[]), patch.object(storage, 'snapshot', return_value={}):
                storage.perform(clear=True)
            self.assertTrue((root / 'request.json').exists())

    def test_reports_freed_space_before_cleanup_finishes_and_stops_on_error(self):
        for fails in (False, True):
            with self.subTest(fails=fails), tempfile.TemporaryDirectory() as directory, patch.object(storage, 'STATE_DIR', Path(directory)):
                root = Path(directory)
                measured = threading.Event()
                available = [100]
                original_save = storage.save
                reports = []
                def save(path, value):
                    original_save(path, value)
                    reports.append(dict(value))
                    if value.get('running') and value.get('freedBytes', 0) > 0:
                        measured.set()
                def prune(args):
                    available[0] = 140
                    self.assertTrue(measured.wait(3), 'No progress while Docker is still deleting')
                    current = storage.read(root / 'status.json')
                    self.assertTrue(current['running'])
                    self.assertEqual(current['freedBytes'], 4000)
                    if fails:
                        raise RuntimeError('prune failed')
                with patch.object(storage, 'save', side_effect=save), patch.object(storage.os, 'statvfs', side_effect=lambda _: SimpleNamespace(f_bavail=available[0], f_frsize=100)), patch.object(storage, 'command', side_effect=prune), patch.object(storage, 'docker', return_value=[]), patch.object(storage, 'snapshot', return_value={}):
                    if fails:
                        with self.assertRaisesRegex(RuntimeError, 'prune failed'):
                            storage.perform(clear=True)
                    else:
                        storage.perform(clear=True)
                self.assertEqual(reports[0]['freedBytes'], 0)
                self.assertFalse(reports[-1]['running'])
                self.assertEqual(reports[-1]['freedBytes'], 4000)
                self.assertEqual(reports[-1].get('error'), 'prune failed' if fails else None)

    def test_failure_does_not_replace_last_success(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(storage, 'STATE_DIR', Path(directory)):
            root = Path(directory)
            storage.save(root / 'status.json', {'lastSuccessAt': 'previous-success'})
            storage.save(root / 'request.json', {'requestedAt': 'now'})
            with patch.object(storage, 'command', side_effect=RuntimeError('Docker unavailable')):
                with self.assertRaisesRegex(RuntimeError, 'Docker unavailable'):
                    storage.perform(clear=True)
            state = storage.read(root / 'status.json')
            self.assertEqual(state['lastSuccessAt'], 'previous-success')
            self.assertFalse(state['running'])
            self.assertEqual(state['error'], 'Docker unavailable')
            self.assertFalse((root / 'request.json').exists())
            with patch.object(storage, 'snapshot', return_value={'checkedAt': 'later'}):
                storage.perform()
            self.assertEqual(storage.read(root / 'status.json')['error'], 'Docker unavailable')

if __name__ == '__main__': unittest.main()
