#!/usr/bin/env python3
"""Bounded Docker cache/image cleanup. Never removes containers or volumes."""
import argparse
import datetime
import fcntl
import http.client
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time

STATE_DIR = Path(os.environ.get('DOCKER_STORAGE_STATE_DIR', '/var/lib/hanasand/docker-storage'))
CACHE_BUDGET = 50_000_000_000


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def read(path):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return {}


def save(path, value):
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as f:
        json.dump(value, f)
        f.flush()
        os.fsync(f.fileno())
        name = f.name
    os.chmod(name, 0o640)
    os.replace(name, path)


class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect('/var/run/docker.sock')


def docker(path):
    conn = DockerConnection('localhost', timeout=600)
    try:
        conn.request('GET', path)
        response = conn.getresponse()
        data = json.loads(response.read())
        if response.status != 200:
            raise RuntimeError('Docker inspection failed: ' + str(response.status))
        return data
    finally:
        conn.close()


def image_inventory(images, containers, clock=None):
    clock = time.time() if clock is None else clock
    used = {c['ImageID'] for c in containers}
    # Keep two newest images per repository even when there are no container references.
    repositories = {}
    for image in images:
        for tag in image.get('RepoTags') or []:
            if tag != '<none>:<none>':
                repositories.setdefault(tag.rsplit(':', 1)[0], []).append(image)
    retained = set()
    for group in repositories.values():
        unique = {i['Id']: i for i in group}
        retained.update(i['Id'] for i in sorted(unique.values(), key=lambda i: i['Created'], reverse=True)[:2])
    result = []
    for image in images:
        if image['Id'] in used or image.get('Containers', 0) > 0:
            continue
        reason = ('Marked to keep' if (image.get('Labels') or {}).get('hanasand.keep') == 'true'
                  else 'Recent image' if clock - image['Created'] < 7 * 86400
                  else 'Rollback image' if image['Id'] in retained else None)
        result.append({'id': image['Id'], 'names': image.get('RepoTags') or [image['Id'][7:19]],
                       'sizeBytes': image['Size'], 'uniqueBytes': max(0, image['Size'] - max(0, image.get('SharedSize', 0))),
                       'retainedReason': reason, 'eligible': reason is None})
    return sorted(result, key=lambda i: i['sizeBytes'], reverse=True)


def snapshot():
    df = docker('/system/df')
    containers = docker('/containers/json?all=1')
    cache = df.get('BuildCache') or []
    return {'checkedAt': now(), 'cacheBytes': sum(c['Size'] for c in cache),
            'reclaimableCacheBytes': sum(c['Size'] for c in cache if not c['InUse'] and not c.get('Shared')),
            'cacheBudgetBytes': CACHE_BUDGET, 'unusedImages': image_inventory(df.get('Images') or [], containers),
            'schedule': '03:00', 'timezone': 'Europe/Oslo'}


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=3600)
    if result.returncode:
        raise RuntimeError(result.stderr.strip()[-2000:] or 'Docker cleanup failed')
    return result.stdout


def perform(clear=False):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with (STATE_DIR / 'lock').open('a') as lock:
        # Wait rather than dropping a manual request while a metrics scan is running.
        fcntl.flock(lock, fcntl.LOCK_EX)
        state_path = STATE_DIR / 'status.json'
        request_path = STATE_DIR / 'request.json'
        previous = read(state_path)
        clear = clear or request_path.exists()
        state = {**previous, 'running': clear, 'error': None if clear else previous.get('error')}
        if clear:
            state['startedAt'] = now()
            state['lastAttemptAt'] = state['startedAt']
            save(state_path, state)
        try:
            before = os.statvfs('/')
            if clear:
                command(['docker', 'builder', 'prune', '--all', '--force', '--keep-storage', str(CACHE_BUDGET)])
                inventory = snapshot()
                for image in inventory['unusedImages']:
                    if not image['eligible']:
                        continue
                    # Check again immediately before removal; never force deletion.
                    if any(c['ImageID'] == image['id'] for c in docker('/containers/json?all=1')):
                        continue
                    inspect = docker('/images/' + image['id'] + '/json')
                    references = inspect.get('RepoTags') or [image['id']]
                    command(['docker', 'image', 'rm', *references])
            state.update(snapshot())
            state['running'] = False
            if clear:
                after = os.statvfs('/')
                state.update(lastSuccessAt=now(), lastFreedBytes=max(0, after.f_bavail * after.f_frsize - before.f_bavail * before.f_frsize))
            save(state_path, state)
        except Exception as error:
            state.update(running=False, error=str(error), failedAt=now())
            save(state_path, state)
            raise
        finally:
            if clear:
                request_path.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--clear', action='store_true')
    perform(parser.parse_args().clear)
