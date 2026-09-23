import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('shrink', Path(__file__).with_name('database-shrink.py'))
shrink = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shrink)


class ShrinkTests(unittest.TestCase):
    def inventory(self, **extra):
        return {'database_bytes': shrink.THRESHOLD + 1, 'replica': False, 'busy': False,
                'tables': [{'name': 'traffic_events', 'bytes': 100}, {'name': 'service_logs', 'bytes': 200}], **extra}

    def test_threshold_and_safety_deferrals(self):
        now = 100000
        for inventory, state, free, expected in [
            (self.inventory(database_bytes=shrink.THRESHOLD), {}, shrink.MIN_FREE, 'below_threshold'),
            (self.inventory(replica=True), {}, shrink.MIN_FREE, 'replica'),
            (self.inventory(busy=True), {}, shrink.MIN_FREE, 'maintenance_busy'),
            (self.inventory(), {}, shrink.MIN_FREE - 1, 'insufficient_headroom'),
            (self.inventory(), {'last_attempt': now - 1}, shrink.MIN_FREE, 'cooldown'),
        ]:
            self.assertEqual(shrink.select_table(inventory, state, now, free), (None, expected))
        self.assertEqual(shrink.select_table(self.inventory(), {}, now, shrink.MIN_FREE), ('traffic_events', None))
        self.assertEqual(shrink.select_table(self.inventory(), {'table_attempts': {'traffic_events': now - 10}}, now, shrink.MIN_FREE), ('service_logs', None))

    def test_measured_outcome_and_cooldown(self):
        for after, status, decrease in [(80, 'reclaimed', 20), (100, 'no_physical_reduction', 0), (120, 'no_physical_reduction', 0)]:
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'status.json'
                with patch.object(shrink, 'sql', side_effect=[[self.inventory()], [
                    {'database_bytes': 999, 'relation_bytes': 100}, {'database_bytes': 999, 'relation_bytes': after}]]), patch.object(shrink, 'free_bytes', return_value=shrink.MIN_FREE):
                    result = shrink.attempt(path)
                self.assertEqual(result['status'], status)
                self.assertEqual(result['observed_relation_decrease_bytes'], decrease)
                saved = json.loads(path.read_text())
                self.assertIn('last_attempt', saved)
                self.assertIn('traffic_events', saved['table_attempts'])

    def test_dry_run_does_not_vacuum_or_record_attempt(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'status.json'
            with patch.object(shrink, 'sql', return_value=[self.inventory()]) as sql, patch.object(shrink, 'free_bytes', return_value=shrink.MIN_FREE):
                self.assertEqual(shrink.attempt(path, True)['status'], 'eligible')
                self.assertEqual(sql.call_count, 1)
            self.assertFalse(path.exists())

    def test_failed_attempt_records_cooldown_without_claiming_savings(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'status.json'
            with patch.object(shrink, 'sql', side_effect=[[self.inventory()], subprocess.TimeoutExpired('psql', 70)]), patch.object(shrink, 'free_bytes', return_value=shrink.MIN_FREE):
                with self.assertRaises(subprocess.TimeoutExpired):
                    shrink.attempt(path)
            saved = json.loads(path.read_text())
            self.assertEqual(saved['status'], 'failed')
            self.assertIn('last_attempt', saved)
            self.assertNotIn('observed_relation_decrease_bytes', saved)

    def test_no_data_deletion_or_unbounded_rewrite(self):
        script = shrink.vacuum_script('traffic_events')
        self.assertIn('TRUNCATE ON', script)
        self.assertIn('pg_try_advisory_lock', script)
        self.assertIn('mill:live-service-logs', script)
        self.assertNotIn('VACUUM FULL', script)
        self.assertNotIn('DELETE FROM', script)
        with self.assertRaises(ValueError):
            shrink.vacuum_script('users; DROP DATABASE hanasand')

    @unittest.skipUnless(os.getenv('POSTGRES_FILTER_TEST_PORT'), 'Disposable PostgreSQL required')
    def test_real_file_reclamation_preserves_remaining_rows(self):
        port = os.environ['POSTGRES_FILTER_TEST_PORT']
        binary = '/opt/homebrew/opt/postgresql@17/bin/'
        database = 'shrink_test_' + str(os.getpid())
        subprocess.run([binary + 'createdb', '-h', '127.0.0.1', '-p', port, database], check=True)
        def query(script):
            return subprocess.run([binary + 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', port, '-d', database],
                                  input=script, text=True, capture_output=True, check=True).stdout
        try:
            query("CREATE TABLE mill_rule_reprocess_jobs(status text); CREATE TABLE traffic_events(id int, evidence text); ALTER TABLE traffic_events ALTER COLUMN evidence SET STORAGE PLAIN; INSERT INTO traffic_events SELECT n,repeat(md5(n::text),32) FROM generate_series(1,10000) n; DELETE FROM traffic_events WHERE id>100;")
            with patch.object(shrink, 'THRESHOLD', 0):
                rows = [json.loads(line) for line in query(shrink.vacuum_script('traffic_events')).splitlines() if line.startswith('{')]
            self.assertEqual(len(rows), 2)
            self.assertLess(rows[1]['relation_bytes'], rows[0]['relation_bytes'])
            self.assertLess(rows[1]['database_bytes'], rows[0]['database_bytes'])
            self.assertEqual(query('SELECT count(*),bool_and(evidence=repeat(md5(id::text),32)) FROM traffic_events;').strip(), '100|t')
        finally:
            subprocess.run([binary + 'dropdb', '-h', '127.0.0.1', '-p', port, database], check=True)


if __name__ == '__main__':
    unittest.main()
