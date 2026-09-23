import json
import tempfile
import unittest
from pathlib import Path
from probe_verification_config import probe_verification_settings


class ProbeVerificationConfigTest(unittest.TestCase):
    def test_absent_keys_leave_verification_unavailable(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertEqual(probe_verification_settings(Path(root) / 'absent'), {})

    def test_only_private_valid_key_files_are_loaded(self):
        with tempfile.TemporaryDirectory() as root:
            source = Path(root) / 'keys.json'
            valid = {'MODEL_PROBE_PROOF_KEY': 'a' * 64, 'READINESS_AUDIT_PROOF_PUBLIC_KEY': 'b' * 64}
            source.write_text(json.dumps(valid))
            source.chmod(0o600)
            self.assertEqual(probe_verification_settings(source), valid)
            source.chmod(0o644)
            with self.assertRaises(RuntimeError):
                probe_verification_settings(source)
            source.chmod(0o600)
            linked = Path(root) / 'linked'
            linked.symlink_to(source)
            with self.assertRaises(RuntimeError):
                probe_verification_settings(linked)
            for invalid in [{}, [], {'OTHER_SECRET': 'a' * 64}, {'MODEL_PROBE_PROOF_KEY': 'short'}, {'MODEL_PROBE_PROOF_KEY': 12}]:
                source.write_text(json.dumps(invalid))
                with self.assertRaises(RuntimeError):
                    probe_verification_settings(source)


if __name__ == '__main__':
    unittest.main()
