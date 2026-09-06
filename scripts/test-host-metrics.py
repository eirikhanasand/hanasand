import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('metrics', Path(__file__).with_name('host-metrics.py'))
metrics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metrics)

class HostMetricsTests(unittest.TestCase):
    def test_limits_round_down(self):
        for limit, expected in [(83, 74), (94, 84), (300, 270), (250.5, 225)]:
            self.assertEqual(metrics.limited_sensor('GPU', expected + 0.1, limit, 'C')['alertLimit'], expected)
            self.assertLess(metrics.limited_sensor('GPU', expected + 0.1, limit, 'C')['margin'], 0)
            self.assertEqual(metrics.limited_sensor('GPU', expected, limit, 'C')['margin'], 0)
    def test_missing_limit_not_invented(self):
        self.assertIsNone(metrics.limited_sensor('sensor', 45, None, 'C')['margin'])
        self.assertIsNone(metrics.number('N/A'))
    def test_cpu_uses_interval(self):
        self.assertEqual(metrics.cpu_percent((100, 20), (200, 40)), 80)
        self.assertIsNone(metrics.cpu_percent((100, 20), (100, 20)))

unittest.main()
