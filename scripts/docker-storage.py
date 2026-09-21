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
import threading
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
    # Container writable-layer accounting is unrelated and can fail during deployment.
    df = docker('/system/df?type=build-cache&type=image')
    containers = docker('/containers/json?all=1')
    cache = df.get('BuildCache') or []
    return {'checkedAt': now(), 'cacheBytes': sum(c['Size'] for c in cache),
            'reclaimableCacheBytes': sum(c['Size'] for c in cache if not c['InUse'] and not c.get('Shared')),
            'cacheBudgetBytes': CACHE_BUDGET, 'unusedImages': image_inventory(df.get('Images') or [], containers),
            'schedule': '03:00', 'timezone': 'Europe/Oslo'}


def command(args):
    result = subprocess.run(['docker', '--host', 'unix:///var/run/docker.sock', *args], capture_output=True, text=True, timeout=3600)
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
        request = read(request_path) if clear else {}
        previous = read(state_path)
        state = {**previous, 'running': clear, 'error': None if clear else previous.get('error')}
        state_lock = threading.Lock()
        stopped = threading.Event()
        reporter = None

        def publish(**changes):
            with state_lock:
                state.update(changes)
                save(state_path, state)

        def report_space(before):
            while not stopped.wait(1):
                try:
                    current = os.statvfs('/')
                    publish(freedBytes=max(0, current.f_bavail * current.f_frsize - before.f_bavail * before.f_frsize), progressAt=now())
                except OSError:
                    # Retain the last measurement; the UI can identify stale progress.
                    pass

        def stop_reporting():
            stopped.set()
            if reporter:
                reporter.join()

        if clear:
            state['freedBytes'] = 0
            state['progressAt'] = now()
            state['phase'] = 'build_cache'
            state['startedAt'] = now()
            state['lastAttemptAt'] = state['startedAt']
            save(state_path, state)
        try:
            before = os.statvfs('/')
            if clear:
                reporter = threading.Thread(target=report_space, args=(before,), daemon=True)
                reporter.start()
                # Explicit reclaim removes all unused cache; the nightly job keeps its budget.
                args = ['builder', 'prune', '--all', '--force']
                if not request:
                    args += ['--keep-storage', str(CACHE_BUDGET)]
                command(args)
                publish(phase='images')
                inventory = image_inventory(docker('/images/json?all=1'), docker('/containers/json?all=1'))
                for image in inventory:
                    if not image['eligible']:
                        continue
                    # Check again immediately before removal; never force deletion.
                    if any(c['ImageID'] == image['id'] for c in docker('/containers/json?all=1')):
                        continue
                    inspect = docker('/images/' + image['id'] + '/json')
                    references = inspect.get('RepoTags') or [image['id']]
                    command(['image', 'rm', *references])
            if clear:
                publish(phase='refresh')
            measurement = snapshot()
            stop_reporting()
            state.update(measurement)
            # A recovered metrics scan must not conceal a failed cleanup.
            recovered_scan = state.get('errorStage') == 'refresh' or (
                state.get('lastAttemptAt') and state.get('lastSuccessAt') and
                state['lastAttemptAt'] <= state['lastSuccessAt'] < state.get('failedAt', ''))
            if clear or recovered_scan:
                state.update(error=None, errorStage=None)
            state['running'] = False
            state['phase'] = None
            if clear:
                after = os.statvfs('/')
                freed = max(0, after.f_bavail * after.f_frsize - before.f_bavail * before.f_frsize)
                state.update(lastSuccessAt=now(), lastFreedBytes=freed, freedBytes=freed, progressAt=now())
            save(state_path, state)
        except Exception as error:
            stop_reporting()
            state.update(running=False, phase=None, error=str(error), errorStage='cleanup' if clear else 'refresh', failedAt=now())
            save(state_path, state)
            raise
        finally:
            stop_reporting()
            if clear and request and read(request_path) == request:
                request_path.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--clear', action='store_true')
    perform(parser.parse_args().clear)
