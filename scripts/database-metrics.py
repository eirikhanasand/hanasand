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
                exec psql -X -h /var/run/postgresql -p "$port" -U "$user" -d postgres -At -v ON_ERROR_STOP=1 -c "$1"'''
            output = command(['docker', 'exec', item['Id'], 'sh', '-c', script, 'metrics', sql])
            result['databases'] = [json.loads(line) for line in output.splitlines() if line]
        elif engine == 'MongoDB':
            script = 'JSON.stringify(db.adminCommand({listDatabases:1}).databases.map(d=>({name:d.name,sizeBytes:Number(d.sizeOnDisk),connections:null})))'
            output = command(['docker', 'exec', item['Id'], 'mongosh', '--quiet', '--eval', script], timeout=45)
            result['databases'] = json.loads(output)
        else:
            output = command(['docker', 'exec', item['Id'], 'redis-cli', '--raw', 'INFO', 'memory'])
            memory = dict(line.split(':', 1) for line in output.splitlines() if ':' in line)
            result['databases'] = [{'name': name, 'sizeBytes': int(memory['used_memory']), 'connections': None, 'memory': True}]
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
