import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('metrics', Path(__file__).with_name('database-metrics.py'))
metrics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metrics)


class StorageTests(unittest.TestCase):
    def test_needs_history(self):
        _, daily, days, _ = metrics.growth([], 1000, 100, 1)
        self.assertIsNone(daily)
        self.assertIsNone(days)

    def test_measured_growth_and_cleanup(self):
        history = [{'at': 0, 'available': 1000, 'device': 1}]
        _, daily, days, _ = metrics.growth(history, 86400, 500, 1)
        self.assertEqual((daily, days), (500, 1))
        _, daily, days, _ = metrics.growth(history, 86400, 1500, 1)
        self.assertEqual(daily, -500)
        self.assertIsNone(days)

    def test_ignore_stale_other_disks_and_future_samples(self):
        for old in [{'at': 0, 'available': 100, 'device': 1}, {'at': 90000, 'available': 100, 'device': 2}, {'at': 999999, 'available': 100, 'device': 1}]:
            self.assertIsNone(metrics.growth([old], 100000, 90, 1)[1])

    def test_detect_database_not_backup_holder(self):
        item = {'Config': {'Image': '29342cb52157'}, 'Path': 'docker-entrypoint.sh', 'Args': ['postgres', '-p', '18502']}
        self.assertEqual(metrics.engine_for(item), 'PostgreSQL')
        item['Args'] = ['sleep', 'infinity']
        self.assertIsNone(metrics.engine_for(item))


if __name__ == '__main__':
    unittest.main()
