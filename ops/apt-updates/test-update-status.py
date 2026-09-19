import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

root = Path(__file__).parent
spec = importlib.util.spec_from_file_location('backfill', root / 'backfill-installed-versions.py')
backfill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backfill)


class UpdateStatusTests(unittest.TestCase):
    def test_backfill_uses_only_installations_in_the_recorded_run(self):
        events = [{'run_id': 'one', 'occurred_at': '2026-09-16T23:10:10+00:00', 'installed': [{'package': 'sqlite'}, {'package': 'unknown'}]},
                  {'run_id': 'two', 'occurred_at': '2026-09-17T00:00:00+00:00', 'installed': []}]
        # Use a local timestamp because dpkg writes in the host timezone.
        at = backfill.datetime.fromisoformat('2026-09-16T23:10:25+00:00').astimezone().strftime('%Y-%m-%d %H:%M:%S')
        later = backfill.datetime.fromisoformat('2026-09-17T01:00:00+00:00').astimezone().strftime('%Y-%m-%d %H:%M:%S')
        self.assertEqual(backfill.enrich(events, [f'{at} status installed sqlite:amd64 3.1', f'{later} status installed sqlite:amd64 4']),
                         [{'run_id': 'one', 'installed': [{'package': 'sqlite', 'version': '3.1'}, {'package': 'unknown'}]}])
        self.assertEqual(backfill.enrich(events, [f'{at} status installed sqlite:amd64 3.1', f'{at} status installed sqlite:amd64 4']), [])

    def test_collector_records_verified_versions_and_preserves_pending_packages(self):
        blocks = re.findall(r"<<'PY'\n(.*?)\nPY", (root / 'hanasand-apt-update.sh').read_text(), re.S)
        with tempfile.TemporaryDirectory() as directory:
            output, plan = Path(directory) / 'status.json', Path(directory) / 'plan.json'
            plan.write_text(json.dumps({'updates': [{'package': 'sqlite', 'version': '3.1'}, {'package': 'pending', 'version': '2'}]}))
            def query(args, **kwargs):
                return subprocess.CompletedProcess(args, 0, stdout='install ok installed\t' + ('3.1' if args[-1] == 'sqlite' else '1'))
            with patch.object(sys, 'argv', ['status', str(output), str(plan), '{}', '2026-09-17T00:00:00Z', 'run', 'sqlite', '']), patch('subprocess.run', side_effect=query):
                exec(compile(blocks[-1], 'collector', 'exec'), {})
            status = json.loads(output.read_text())
            self.assertEqual(status['installed_packages'], [{'package': 'sqlite', 'version': '3.1'}])
            self.assertEqual(status['pending_updates'], [{'package': 'pending', 'version': '2'}])
            with patch.object(sys, 'argv', ['status', str(output), json.dumps(status), '2026-09-18T00:00:00Z', 'failed-run']):
                exec(compile(blocks[0], 'collector-failure', 'exec'), {})
            self.assertEqual(json.loads(output.read_text())['installed_packages'], [])


if __name__ == '__main__':
    unittest.main()
