import importlib.util
from pathlib import Path
import tempfile
import unittest
spec = importlib.util.spec_from_file_location('diagnostics', Path(__file__).with_name('disk-directories.py'))
diagnostics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostics)

class DirectoryTests(unittest.TestCase):
    def test_paths_sizes_and_limit(self):
        with tempfile.TemporaryDirectory() as root:
            for i in range(25):
                directory = Path(root) / f'directory {i}'
                directory.mkdir()
                (directory / 'data').write_bytes(b'x' * (i + 1) * 8192)
            result = diagnostics.largest_directories(root)
            self.assertTrue(result['complete'])
            self.assertEqual(len(result['directories']), 20)
            self.assertEqual(result['directories'][0]['path'], str(Path(root) / 'directory 24'))
            self.assertGreaterEqual(result['directories'][0]['sizeBytes'], 25 * 8192)
            self.assertNotIn(root, [d['path'] for d in result['directories']])
            self.assertEqual([d['sizeBytes'] for d in result['directories']], sorted([d['sizeBytes'] for d in result['directories']], reverse=True))
    def test_timeout_is_explicitly_partial(self):
        with tempfile.TemporaryDirectory() as root:
            result = diagnostics.largest_directories(root, timeout=0)
            self.assertFalse(result['complete'])
    def test_stale_metrics_are_rejected(self):
        with self.assertRaises(ValueError):
            diagnostics.collect({'sampledAt': '2020-01-01T00:00:00Z', 'storage': []})

if __name__ == '__main__':
    unittest.main()
