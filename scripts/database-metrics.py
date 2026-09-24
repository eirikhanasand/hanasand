#!/usr/bin/env python3
"""Read database metadata, never application records; publish one shared snapshot."""
import concurrent.futures
import datetime
import json
import os
import socket
from pathlib import Path
import subprocess
import sys
import time


def command(args, timeout=15):
    return subprocess.check_output(args, timeout=timeout, stderr=subprocess.DEVNULL).decode().strip()


def engine_for(item):
    image = item['Config']['Image'].split('/')[-1].split(':')[0]
    executable = Path(item.get('Path', '')).name
    args = item.get('Args', [])
    if image == 'postgres' or executable == 'postgres' or (args and args[0] == 'postgres'):
        return 'PostgreSQL'
    if image == 'mongo':
        return 'MongoDB'
    if image == 'redis':
        return 'Redis'
    return None


def collect_database(item):
    name = item['Name'].lstrip('/')
    engine = engine_for(item)
    result = {'id': name, 'engine': engine, 'status': 'unavailable', 'databases': []}
    if not item['State']['Running']:
        return result
    try:
        if engine == 'PostgreSQL':
            # Container-local settings stay in the container. No credentials enter output.
            sql = """SELECT json_build_object('name', d.datname, 'sizeBytes', pg_database_size(d.oid),
                'connections', (SELECT count(*) FROM pg_stat_activity a WHERE a.datid=d.oid),
                'replica', pg_is_in_recovery()) FROM pg_database d
                WHERE d.datallowconn AND NOT d.datistemplate ORDER BY d.datname"""
            script = '''export PGCONNECT_TIMEOUT=3 PGOPTIONS='-c statement_timeout=5000';
                user=${POSTGRES_USER:-hanasand}; port=${PGPORT:-5432};
                for socket in /var/run/postgresql/.s.PGSQL.*; do
                  case "$socket" in *.lock) continue;; esac
                  test -S "$socket" && port=${socket##*.};
                done;
                export PGPASSWORD="${POSTGRES_PASSWORD:-}";
                exec psql -X -h /var/run/postgresql -p "$port" -U "$user" -d "$2" -At -v ON_ERROR_STOP=1 -c "$1"'''
            output = command(['docker', 'exec', item['Id'], 'sh', '-c', script, 'metrics', sql, 'postgres'])
            result['databases'] = [json.loads(line) for line in output.splitlines() if line]
            for database in result['databases']:
                try:
                    tables_sql = """SELECT json_build_object('schema', n.nspname, 'name', c.relname,
                        'sizeBytes', pg_total_relation_size(c.oid), 'estimatedRows', c.reltuples::bigint,
                        'writes', COALESCE(s.n_tup_ins,0)+COALESCE(s.n_tup_upd,0)+COALESCE(s.n_tup_del,0),
                        'columns', COALESCE((SELECT json_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a
                            WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'[]'::json))
                        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                        LEFT JOIN pg_stat_all_tables s ON s.relid=c.oid
                        WHERE c.relkind IN ('r','p','m') AND n.nspname NOT IN ('pg_catalog','information_schema')
                            AND n.nspname NOT LIKE 'pg_toast%' ORDER BY n.nspname,c.relname"""
                    output = command(['docker', 'exec', item['Id'], 'sh', '-c', script, 'metrics', tables_sql, database['name']])
                    database['tables'] = [json.loads(line) for line in output.splitlines() if line]
                    database['tableCount'] = len(database['tables'])
                except (OSError, subprocess.SubprocessError, ValueError):
                    database['tableCount'] = None
        elif engine == 'MongoDB':
            script = '''JSON.stringify(db.adminCommand({listDatabases:1}).databases.map(d=>{
                const database=db.getSiblingDB(d.name);
                const tables=database.getCollectionInfos({type:'collection'}).map(c=>{
                    const stats=database.getCollection(c.name).aggregate([{$collStats:{storageStats:{},latencyStats:{}}}]).toArray()[0];
                    const s=stats.storageStats;
                    return {schema:'',name:c.name,sizeBytes:Number(s.totalSize||s.storageSize||0),
                        estimatedRows:Number(s.count||0),columns:[],writes:Number(stats.latencyStats.writes.ops)};
                });
                return {name:d.name,sizeBytes:Number(d.sizeOnDisk),connections:null,tableCount:tables.length,tables};
            }))'''
            output = command(['docker', 'exec', item['Id'], 'mongosh', '--quiet', '--eval', script], timeout=45)
            result['databases'] = json.loads(output)
        else:
            output = command(['docker', 'exec', item['Id'], 'redis-cli', '--raw', 'INFO', 'memory'])
            memory = dict(line.split(':', 1) for line in output.splitlines() if ':' in line)
            keyspace = command(['docker', 'exec', item['Id'], 'redis-cli', '--raw', 'INFO', 'keyspace'])
            result['databases'] = []
            for line in keyspace.splitlines():
                if not line.startswith('db') or ':' not in line:
                    continue
                database, counts = line.split(':', 1)
                fields = dict(part.split('=', 1) for part in counts.split(','))
                result['databases'].append({'name': database, 'sizeBytes': None, 'connections': None,
                    'memory': True, 'tableCount': int(fields['keys'])})
            if not result['databases']:
                result['databases'] = [{'name': 'db0', 'sizeBytes': 0, 'connections': None, 'memory': True, 'tableCount': 0}]
            result['memoryBytes'] = int(memory['used_memory'])
        if not result['databases']:
            raise ValueError('Empty inventory')
        result['status'] = 'healthy'
        if item['State'].get('Health', {}).get('Status') == 'unhealthy':
            result['status'] = 'unhealthy'
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError):
        # Do not serialize command output: authentication errors can include secrets.
        result['status'] = 'unavailable'
    return result


def growth(history, now, available, device):
    samples = [s for s in history if s['device'] == device and 0 <= now - s['at'] <= 86400]
    samples.append({'at': now, 'available': available, 'device': device})
    elapsed = now - samples[0]['at']
    daily = (samples[0]['available'] - available) * 86400 / elapsed if elapsed >= 3600 else None
    days = available / daily if daily is not None and daily > 0 else None
    return samples, daily, days, elapsed


def collect(destination):
    ids = command(['docker', 'ps', '-aq']).splitlines()
    items = json.loads(command(['docker', 'inspect', *ids])) if ids else []
    items = [item for item in items if engine_for(item)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        databases = list(pool.map(collect_database, items))
    writes_path = destination.with_name('database-table-writes.json')
    try:
        previous = json.loads(writes_path.read_text())
    except (OSError, ValueError):
        previous = {}
    writes = {}
    sampled_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for instance in databases:
        for database in instance['databases']:
            for table in database.get('tables', []):
                key = json.dumps([instance['id'], database['name'], table['schema'], table['name']])
                old = previous.get(key, {})
                count = table.pop('writes', None)
                if count is None:
                    continue
                # PostgreSQL has no historical last-DML timestamp. Record observed
                # counter increases, never invent a timestamp for existing rows.
                last_write = sampled_at if count > old.get('count', count) else old.get('at')
                writes[key] = {'count': count, 'at': last_write}
                table['lastWriteObservedAt'] = last_write
    atomic_write(writes_path, writes)
    stats = os.statvfs('/')
    available = stats.f_bavail * stats.f_frsize
    device = os.stat('/').st_dev
    history_path = destination.with_name('database-storage-history.json')
    try:
        history = json.loads(history_path.read_text())
    except (OSError, ValueError):
        history = []
    samples, daily, days, elapsed = growth(history, time.time(), available, device)
    atomic_write(history_path, samples)
    return {'sampledAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'host': socket.gethostname(),
            'instances': sorted(databases, key=lambda item: item['id']),
            'disk': {'totalBytes': stats.f_blocks * stats.f_frsize, 'availableBytes': available,
                     'dailyGrowthBytes': daily, 'daysUntilFull': days, 'sampleSeconds': elapsed}}


def atomic_write(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, allow_nan=False))
    temporary.chmod(0o644)
    temporary.replace(path)


if __name__ == '__main__':
    destination = Path(sys.argv[1] if len(sys.argv) > 1 else '/var/lib/hanasand/metrics/databases.json')
    atomic_write(destination, collect(destination))
