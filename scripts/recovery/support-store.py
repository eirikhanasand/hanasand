#!/usr/bin/env python3
"""Manage OVH's independent support store. Never promotes the application replica."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time
import urllib.request

ROOT = Path('/home/ubuntu/hanasand-recovery/support')
CONFIG = ROOT.parent / 'support.json'
DB = 'hanasand-support-db'
SERVICE = 'hanasand-support'


def inspect(name):
    return json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]


def run(args, settings=None, **kwargs):
    return subprocess.run(args, env={**os.environ, **(settings or {})}, check=True, **kwargs)


def initialize(image):
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not CONFIG.exists():
        settings = {'SUPPORT_SERVICE_BASE': 'http://127.0.0.1:19181', 'SUPPORT_SERVICE_KEY': secrets.token_hex(32),
                    'SUPPORT_DB_HOST': '127.0.0.1', 'SUPPORT_DB_PORT': '18508', 'SUPPORT_DB_NAME': 'hanasand_support',
                    'SUPPORT_MAINTENANCE': '1', 'SUPPORT_DB_USER': 'support', 'SUPPORT_DB_PASSWORD': secrets.token_hex(32)}
        fd = os.open(CONFIG, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(settings, stream)
    config = json.loads(CONFIG.read_text())
    found = subprocess.run(['docker', 'inspect', DB], capture_output=True)
    if found.returncode == 0:
        if not inspect(DB)['State']['Running']:
            raise RuntimeError('Support database exists but is stopped; inspect before continuing')
        return
    # A separate volume and loopback listener leave the main replica untouched.
    settings = {'POSTGRES_USER': config['SUPPORT_DB_USER'], 'POSTGRES_PASSWORD': config['SUPPORT_DB_PASSWORD'], 'POSTGRES_DB': config['SUPPORT_DB_NAME']}
    run(['docker', 'run', '-d', '--name', DB, '--restart', 'unless-stopped', '--network', 'host', '--memory', '512m', '--cpus', '1',
         '-v', 'hanasand-support-data:/var/lib/postgresql/data', *sum((['-e', key] for key in settings), []), image,
         'postgres', '-p', '18508', '-c', 'listen_addresses=127.0.0.1', '-c', 'shared_buffers=128MB', '-c', 'max_connections=30',
         '-c', 'wal_level=replica', '-c', 'max_wal_size=1GB'], settings, stdout=subprocess.DEVNULL)
    for _ in range(300):
        if subprocess.run(['docker', 'exec', DB, 'pg_isready', '-p', '18508', '-U', 'support', '-d', 'hanasand_support'], stdout=subprocess.DEVNULL).returncode == 0:
            return
        time.sleep(1)
    raise RuntimeError('Support database did not become ready')


def start(release):
    if not re.fullmatch(r'[0-9a-f]{40}', release):
        raise RuntimeError('Use a full committed release')
    settings = dict(item.split('=', 1) for item in inspect('hanasand-api')['Config']['Env'])
    for key in ('RECOVERY_STATE_FILE', 'RECOVERY_ESSENTIAL_ONLY', 'AI_HEALTH_WORKER_BASE', 'SUPPORT_SERVICE_BASE'):
        settings.pop(key, None)
    config = json.loads(CONFIG.read_text())
    settings.update({key: value for key, value in config.items() if key != 'SUPPORT_SERVICE_BASE'})
    (ROOT / 'backups').mkdir(mode=0o700, exist_ok=True)
    if config.get('SUPPORT_MAINTENANCE') == '1': (ROOT / 'maintenance').touch(mode=0o600)
    settings.update(SUPPORT_MAINTENANCE_FILE='/support-control/maintenance', SUPPORT_BACKUP_FILE='/support-backups/latest.dump', PORT='19181', SUPPORT_INTERNAL_SERVICE='1', API_HTTP_ONLY='1', AUTH_SERVICE_ONLY='1',
                    DB_TIMEOUT_MS='1000', DB_MAX_CONN='3', SUPPORT_AI_BASE='https://api.hanasand.com', HANASAND_RELEASE_COMMIT=release)
    previous = None
    if subprocess.run(['docker', 'inspect', SERVICE], capture_output=True).returncode == 0:
        previous = SERVICE + '-previous-' + str(int(time.time()))
        run(['docker', 'stop', '-t', '65', SERVICE], stdout=subprocess.DEVNULL)
        run(['docker', 'rename', SERVICE, previous])
    try:
        run(['docker', 'run', '-d', '--name', SERVICE, '--restart', 'unless-stopped', '--network', 'host', '--memory', '512m', '--cpus', '1',
             '-v', str(ROOT) + ':/support-control:ro', '-v', str(ROOT / 'backups') + ':/support-backups:ro', '--stop-timeout', '65', '--log-opt', 'max-size=10m', '--log-opt', 'max-file=3',
             *sum((['-e', key] for key in settings), []), '--entrypoint', 'bun', 'hanasand-recovery-api:' + release, 'src/supportServer.ts'], settings, stdout=subprocess.DEVNULL)
        for _ in range(180):
            try:
                with urllib.request.urlopen('http://127.0.0.1:19181/ready', timeout=2) as response:
                    state = json.load(response)
                if state.get('ok') and state.get('release') == release:
                    print(json.dumps(state), flush=True)
                    return
            except Exception:
                pass
            time.sleep(1)
        raise RuntimeError('Independent support service did not become ready')
    except Exception:
        logs = subprocess.run(['docker', 'logs', '--tail', '40', SERVICE], capture_output=True, text=True)
        (ROOT / 'last-start-error.log').write_text(logs.stdout + logs.stderr)
        subprocess.run(['docker', 'rm', '-f', SERVICE], stdout=subprocess.DEVNULL)
        if previous:
            run(['docker', 'rename', previous, SERVICE])
            run(['docker', 'start', SERVICE], stdout=subprocess.DEVNULL)
        raise


def backup():
    destination = ROOT / 'backups'
    destination.mkdir(mode=0o700, exist_ok=True)
    stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
    temporary = destination / (stamp + '.partial')
    saved = destination / (stamp + '.dump')
    with temporary.open('wb') as stream:
        run(['docker', 'exec', DB, 'pg_dump', '-p', '18508', '-U', 'support', '-d', 'hanasand_support', '-Fc'], stdout=stream)
    if temporary.stat().st_size < 100:
        raise RuntimeError('Support backup was empty')
    temporary.chmod(0o600)
    temporary.replace(saved)
    link = destination / 'latest.next'
    link.unlink(missing_ok=True)
    link.symlink_to(saved.name)
    link.replace(destination / 'latest.dump')
    # Keep 48 hourly snapshots. This directory contains only this service's backups.
    for old in sorted(path for path in destination.glob('*.dump') if not path.is_symlink())[:-48]:
        old.unlink()
    print(str(saved))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('init', 'start', 'backup', 'pause', 'resume'))
    parser.add_argument('value', nargs='?')
    args = parser.parse_args()
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (ROOT / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.action == 'init': initialize(args.value)
        elif args.action == 'start': start(args.value)
        elif args.action == 'backup': backup()
        else:
            config = json.loads(CONFIG.read_text())
            config['SUPPORT_MAINTENANCE'] = '1' if args.action == 'pause' else '0'
            temporary = CONFIG.with_suffix('.next')
            temporary.write_text(json.dumps(config)); temporary.chmod(0o600); temporary.replace(CONFIG)
            if args.action == 'pause': (ROOT / 'maintenance').touch(mode=0o600)
            else: (ROOT / 'maintenance').unlink(missing_ok=True)
            print('Support ' + ('paused' if args.action == 'pause' else 'resumed'))
