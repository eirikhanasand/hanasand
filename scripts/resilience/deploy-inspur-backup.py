#!/usr/bin/env python3
"""Deploy the independent backup worker without restarting API services."""
import json
import os
import re
import subprocess
import sys

release = sys.argv[1]
if not re.fullmatch(r'[0-9a-f]{40}', release):
    raise SystemExit('Pass the full built release commit.')
image = 'hanasand-resilience-api:' + release
source = json.loads(subprocess.check_output(['docker', 'inspect', 'hanasand_api']))[0]
original = dict(item.split('=', 1) for item in source['Config']['Env'])
settings = {key: value for key, value in original.items()
            if key in ('DB', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD') or key.startswith('DB_BACKUP_')}
settings.update(NODE_ENV='production', DB_BACKUP_WORKER='1',
                DB_BACKUP_WORKER_SOCKET='/var/lib/hanasand/backups/database/.worker.sock',
                HANASAND_RELEASE_COMMIT=release)
mount = next(item for item in source['Mounts'] if item['Destination'] == '/var/lib/hanasand')
network = next(name for name in source['NetworkSettings']['Networks'] if name.endswith('hanasandnet'))
name = 'hanasand_database_backup'
subprocess.run(['docker', 'image', 'inspect', image], check=True, stdout=subprocess.DEVNULL)
if subprocess.run(['docker', 'inspect', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
    # Never interrupt a running export to update its worker.
    state = subprocess.check_output(['docker', 'exec', name, 'cat', '/var/lib/hanasand/backups/database/.backup-state.json'], text=True)
    if any(item['status'] == 'running' for item in json.loads(state)['operations']):
        raise SystemExit('A backup operation is running; leave this worker in place until it finishes.')
    subprocess.run(['docker', 'stop', name], check=True)
    subprocess.run(['docker', 'rm', name], check=True)
command = ['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped',
           '--network', network, '--cpus', '0.5', '--memory', '512m', '--blkio-weight', '100',
           '-v', (mount.get('Name') or mount['Source']) + ':/var/lib/hanasand']
for key in settings:
    command += ['-e', key]
command += ['--entrypoint', 'bun', image, 'src/backupWorker.ts']
subprocess.run(command, env={**os.environ, **settings}, check=True)
