#!/usr/bin/env python3
"""Bounded physical tail reclamation; never deletes live rows or rewrites tables."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import subprocess
import time

THRESHOLD = 20_000_000_000
MIN_FREE = 5 * 1024 ** 3
COOLDOWN = 3600
TABLE_COOLDOWN = 6 * 3600
TABLES = ('traffic_events', 'mill_log_dimensions', 'service_logs', 'mill_events')
STATE = Path('/home/hanasand/resilience/database-shrink/status.json')
BUSY_SQL = """EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid <> pg_backend_pid()
  AND (application_name = 'pg_dump' AND xact_start IS NOT NULL
    OR state = 'active' AND query ~* '^\\s*(VACUUM|REINDEX|CLUSTER)\\s'))
  OR EXISTS (SELECT 1 FROM pg_stat_progress_create_index)
  OR EXISTS (SELECT 1 FROM pg_stat_progress_vacuum)
  OR EXISTS (SELECT 1 FROM pg_stat_progress_cluster)
  OR EXISTS (SELECT 1 FROM mill_rule_reprocess_jobs WHERE status IN ('queued','running'))"""
INVENTORY_SQL = """SELECT json_build_object('database_bytes',pg_database_size(current_database()),
  'replica',pg_is_in_recovery(), 'busy', (""" + BUSY_SQL + """),
  'tables',(SELECT json_agg(json_build_object('name',c.relname,'bytes',pg_total_relation_size(c.oid)))
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
    AND c.relname IN ('traffic_events','mill_log_dimensions','service_logs','mill_events')));"""


def sql(script, timeout=40):
    command = ['docker', 'exec', '-i', '-e',
               'PGOPTIONS=-c application_name=hanasand_database_shrink -c statement_timeout=30000 -c lock_timeout=500 -c vacuum_cost_delay=10 -c vacuum_cost_limit=100',
               'hanasand_database', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'hanasand', '-d', 'hanasand']
    result = subprocess.run(command, input=script, text=True, capture_output=True, timeout=timeout, check=True)
    return [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]


def free_bytes():
    result = subprocess.run(['docker', 'exec', 'hanasand_database', 'df', '-B1', '--output=avail', '/var/lib/postgresql/data'],
                            text=True, capture_output=True, timeout=10, check=True)
    return int(result.stdout.splitlines()[-1].strip())


def select_table(inventory, state, now, available):
    if inventory['replica']:
        return None, 'replica'
    if inventory['database_bytes'] <= THRESHOLD:
        return None, 'below_threshold'
    if available < MIN_FREE:
        return None, 'insufficient_headroom'
    if inventory['busy']:
        return None, 'maintenance_busy'
    if now - state.get('last_attempt', 0) < COOLDOWN:
        return None, 'cooldown'
    attempts = state.get('table_attempts', {})
    candidates = [row for row in inventory.get('tables') or [] if row['name'] in TABLES
                  and now - attempts.get(row['name'], 0) >= TABLE_COOLDOWN]
    candidates.sort(key=lambda row: (attempts.get(row['name'], 0), row['bytes']))
    return (candidates[0]['name'], None) if candidates else (None, 'table_cooldown')


def vacuum_script(table):
    if table not in TABLES:
        raise ValueError('Only registered log tables may be maintained')
    relation = 'public.' + table
    measure = "json_build_object('database_bytes',pg_database_size(current_database()),'relation_bytes',pg_total_relation_size('" + relation + "'))"
    # Session locks survive VACUUM's internal transactions and are released on
    # disconnect. Recheck busy work after locking to close the selection race.
    return """SELECT pg_try_advisory_lock(hashtextextended('hanasand:database-shrink',0))
      AND pg_try_advisory_lock(hashtextextended('mill:service-logs',0))
      AND pg_try_advisory_lock(hashtextextended('mill:live-service-logs',0)) AS acquired \\gset
\\if :acquired
SELECT NOT (""" + BUSY_SQL + """) AND NOT pg_is_in_recovery()
 AND pg_database_size(current_database()) > """ + str(THRESHOLD) + """ AS available \\gset
\\if :available
SELECT """ + measure + """;
VACUUM (SKIP_LOCKED, TRUNCATE ON, PARALLEL 0) """ + relation + """;
SELECT """ + measure + """;
\\else
SELECT json_build_object('status','maintenance_busy');
\\endif
\\else
SELECT json_build_object('status','maintenance_busy');
\\endif
"""


def save(path, state):
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as stream:
        json.dump(state, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)


def attempt(path=STATE, check_only=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with (path.parent / 'maintenance.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {'status': 'maintenance_busy'}
        state = json.loads(path.read_text()) if path.exists() else {}
        now = time.time()
        inventory = sql(INVENTORY_SQL)[0]
        available = free_bytes()
        table, reason = select_table(inventory, state, now, available)
        result = {'checked_at': now, 'database_bytes': inventory['database_bytes'], 'free_bytes': available,
                  'threshold_bytes': THRESHOLD, 'status': reason or ('eligible' if check_only else 'running'), 'table': table}
        if table and not check_only:
            state.update(last_attempt=now, table_attempts={**state.get('table_attempts', {}), table: now})
            save(path, {**state, **result})
            try:
                measurements = sql(vacuum_script(table), timeout=70)
                if len(measurements) == 2:
                    before, after = measurements
                    decrease = max(0, before['relation_bytes'] - after['relation_bytes'])
                    result.update(status='reclaimed' if decrease else 'no_physical_reduction', before=before, after=after,
                                  observed_relation_decrease_bytes=decrease, free_bytes_after=free_bytes())
                else:
                    result['status'] = 'maintenance_busy'
            except (subprocess.SubprocessError, ValueError) as error:
                result.update(status='failed', error=type(error).__name__)
                save(path, {**state, **result})
                raise
        if not check_only:
            save(path, {**state, **result})
        return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='Inspect eligibility without running VACUUM or updating attempt state')
    args = parser.parse_args()
    print(json.dumps(attempt(check_only=args.check)))
