import importlib.util
from pathlib import Path
import unittest
import tempfile
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
