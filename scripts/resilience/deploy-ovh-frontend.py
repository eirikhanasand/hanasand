#!/usr/bin/env python3
"""Deploy an already-built frontend on OVH, retaining runtime settings and rollback."""
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request
import fcntl

release = sys.argv[1]
if not re.fullmatch(r'[0-9a-f]{40}', release):
    raise SystemExit('Pass the full frontend image release commit.')
lock = open('/tmp/hanasand-frontend-deploy.lock', 'a')
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
name = 'hanasand-frontend'
old = json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]
settings = dict(value.split('=', 1) for value in old['Config']['Env'])
if (old['HostConfig']['NetworkMode'] != 'host' or settings.get('PORT') != '19300'
        or not old['State']['Running']):
    raise SystemExit('Expected the running OVH host-network frontend on port19300.')
image = 'hanasand-resilience-frontend:' + release
subprocess.run(['docker', 'image', 'inspect', image], check=True, stdout=subprocess.DEVNULL)
candidate, previous = name + '-candidate', name + '-before-' + release[:12]
for target in (candidate, previous):
    if subprocess.run(['docker', 'inspect', target], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
        raise SystemExit(f'{target} already exists; inspect before retrying.')
with socket.socket() as listener:
    listener.bind(('127.0.0.1', 19301))
settings.update(COMPACT_PWNED_RANGE_API='http://127.0.0.1:28099/range',
                HANASAND_RELEASE_COMMIT=release, HOSTNAME='127.0.0.1')

def launch(target, port):
    env = {**settings, 'PORT': str(port)}
    command = ['docker', 'run', '-d', '--name', target, '--network', 'host',
               '--restart', old['HostConfig']['RestartPolicy']['Name'],
               '--memory', str(old['HostConfig']['Memory']),
               '--cpus', str(old['HostConfig']['NanoCpus'] / 1e9)]
    for mount in old['Mounts']:
        if mount['Type'] not in ('bind', 'volume'):
            raise RuntimeError('Unexpected mount type; refusing to omit it.')
        source = mount['Name'] if mount['Type'] == 'volume' else mount['Source']
        command += ['-v', source + ':' + mount['Destination'] + ('' if mount['RW'] else ':ro')]
    for alias in old['HostConfig'].get('ExtraHosts') or []:
        command += ['--add-host', alias]
    for key in env:
        command += ['-e', key]
    subprocess.run([*command, '--entrypoint', 'bun', image, 'server.js'],
                   env={**os.environ, **env}, check=True)

def check(port):
    base = f'http://127.0.0.1:{port}'
    for attempt in range(20):
        try:
            with urllib.request.urlopen(base + '/api/resilience/ready', timeout=5) as response:
                if response.status == 200:
                    break
        except OSError:
            pass
        time.sleep(1)
    else:
        raise RuntimeError('Frontend readiness check failed.')
    request = urllib.request.Request(base + '/api/pwned', data=b'{"prefix":"B79CF"}',
                                     headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=20) as response:
        header = response.read(12)
        if (response.headers.get('Content-Type') != 'application/vnd.hanasand.pwned-prefix'
                or header[:8] != b'PWNPRF02' or int.from_bytes(header[8:], 'little') != 3):
            raise RuntimeError('Expected all three compact indexes from the private lookup.')

# Test new runtime and private lookup without changing the serving instance.
try:
    launch(candidate, 19301)
    check(19301)
finally:
    subprocess.run(['docker', 'rm', '-f', candidate], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.run(['docker', 'stop', name], check=True)
try:
    subprocess.run(['docker', 'rename', name, previous], check=True)
except Exception:
    subprocess.run(['docker', 'start', name], check=True)
    raise
try:
    launch(name, 19300)
    check(19300)
except Exception:
    subprocess.run(['docker', 'rm', '-f', name], check=False)
    subprocess.run(['docker', 'rename', previous, name], check=True)
    subprocess.run(['docker', 'start', name], check=True)
    raise
print('OVH frontend deployed and private three-index lookup verified: ' + release)
