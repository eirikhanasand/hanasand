import importlib.util
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('retention',Path(__file__).with_name('retention.py'))
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

class RetentionTests(unittest.TestCase):
    def config(self,root,action='ROTATE',size=8,count=5):
        path=Path(root)/'auditd.conf'
        path.write_text(f'max_log_file = {size} # original comment\nnum_logs = {count}\nmax_log_file_action = {action}\nspace_left_action = SYSLOG\ndisk_full_action = SUSPEND\n')
        return path
    def test_small_store_expands_with_backup_and_preserves_actions(self):
        with tempfile.TemporaryDirectory() as root,patch.object(r.shutil,'disk_usage',return_value=SimpleNamespace(free=20*1024**3)):
            path=self.config(root); original=path.read_text()
            self.assertTrue(r.configure(path)['changed'])
            self.assertIn('max_log_file = 100 # original comment',path.read_text())
            self.assertIn('num_logs = 20',path.read_text())
            self.assertIn('disk_full_action = SUSPEND',path.read_text())
            self.assertEqual(path.with_name('auditd.conf.before-hanasand-retention').read_text(),original)
            self.assertFalse(r.configure(path)['changed'])
    def test_larger_and_nonrotating_policies_untouched(self):
        with tempfile.TemporaryDirectory() as root:
            for action,size,count in [('KEEP_LOGS',8,5),('HALT',8,5),('ROTATE',500,20)]:
                path=self.config(root,action,size,count); original=path.read_text()
                self.assertFalse(r.configure(path)['changed'])
                self.assertEqual(path.read_text(),original)
    def test_disk_headroom_failure_does_not_change_configuration(self):
        with tempfile.TemporaryDirectory() as root,patch.object(r.shutil,'disk_usage',return_value=SimpleNamespace(free=3*1024**3)):
            path=self.config(root); original=path.read_text()
            with self.assertRaises(RuntimeError): r.configure(path)
            self.assertEqual(path.read_text(),original)

if __name__ == '__main__': unittest.main()
