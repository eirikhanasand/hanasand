#!/usr/bin/env python3
"""Deploy an already-built OVH service, retaining runtime settings and rollback."""
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request
import fcntl

kind, release = sys.argv[1:]
ports = {'frontend': 19300, 'api': 19080, 'auth': 19090}
if kind not in ports:
    raise SystemExit('Choose frontend, api or auth.')
serving_port = ports[kind]
# OVH already uses19081 for another listener; do not disturb it while staging.
candidate_port = serving_port + (2 if kind == 'api' else 1)
if not re.fullmatch(r'[0-9a-f]{40}', release):
    raise SystemExit('Pass the full image release commit.')
lock = open('/tmp/hanasand-frontend-deploy.lock', 'a')
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
name = 'hanasand-' + kind
old = json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]
settings = dict(value.split('=', 1) for value in old['Config']['Env'])
if (old['HostConfig']['NetworkMode'] != 'host' or settings.get('PORT') != str(serving_port)
        or not old['State']['Running']):
    raise SystemExit(f'Expected the running OVH {kind} on host-network port{serving_port}.')
image = 'hanasand-recovery-' + kind + ':' + release
subprocess.run(['docker', 'image', 'inspect', image], check=True, stdout=subprocess.DEVNULL)
candidate, previous = name + '-candidate-' + release[:12], name + '-before-' + release[:12]
for target in (candidate, previous):
    if subprocess.run(['docker', 'inspect', target], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
        raise SystemExit(f'{target} already exists; inspect before retrying.')
with socket.socket() as listener:
    listener.bind(('127.0.0.1', candidate_port))
settings.pop('COMPACT_PWNED_RANGE_API', None)
settings.update(PWNED_LOOKUP_API='https://api.hanasand.com/api/pwned',
                HANASAND_RELEASE_COMMIT=release, HOSTNAME='127.0.0.1',
                RECOVERY_SITE='ovhcloud')
if kind == 'frontend':
    settings.update(RECOVERY_STATUS_URL=settings.get('RECOVERY_STATUS_URL', 'http://127.0.0.1:19901/status'),
                    RECOVERY_STATE_FILE=settings.get('RECOVERY_STATE_FILE', '/recovery/state.json'))
if kind == 'api':
    settings.update(AI_HEALTH_WORKER_BASE='http://127.0.0.1:28080', API_HTTP_ONLY='1')

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
    entry = {'frontend': 'server.js', 'api': 'src/index.ts', 'auth': 'src/authServer.ts'}[kind]
    subprocess.run([*command, '--entrypoint', 'bun', image, entry],
                   env={**os.environ, **env}, check=True)

def check(port, target):
    base = f'http://127.0.0.1:{port}'
    for attempt in range(20):
        try:
            path = '/api/recovery/ready' if kind == 'frontend' else '/ready'
            with urllib.request.urlopen(base + path, timeout=5) as response:
                status = json.load(response)
                if response.status == 200 and status.get('ok') and status.get('release') == release:
                    break
        except OSError:
            pass
        time.sleep(1)
    else:
        raise RuntimeError('Service readiness check failed.')
    if kind != 'frontend':
        # Exercise the same validation path used by signup/password changes;
        # no accounts are created and only a prefix is sent over HTTPS.
        result = json.loads(subprocess.check_output(['docker', 'exec', target, 'bun', '-e',
            'import check from "./src/utils/pwned/checkPwned.ts"; console.log(JSON.stringify(await check("superman123")))']))
        # Importing or deduplicating source data changes occurrence counts.
        # The invariant is that this known breached password is rejected.
        if (result.get('ok') is not False or result.get('source') != 'compact-index'
                or not isinstance(result.get('count'), int) or result['count'] <= 0):
            raise RuntimeError('Compact password validation failed.')
        return
    request = urllib.request.Request(base + '/api/pwned', data=b'{"prefix":"B79CF"}',
                                     headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=20) as response:
        header = response.read(12)
        if (response.headers.get('Content-Type') != 'application/vnd.hanasand.pwned-prefix'
                or header[:8] != b'PWNPRF02' or int.from_bytes(header[8:], 'little') != 3):
            raise RuntimeError('Expected all three compact indexes through the HTTPS API.')

# Test new runtime and HTTPS lookup without changing the serving instance.
try:
    launch(candidate, candidate_port)
    check(candidate_port, candidate)
finally:
    subprocess.run(['docker', 'rm', '-f', candidate], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.run(['docker', 'stop', name], check=True)
try:
    subprocess.run(['docker', 'rename', name, previous], check=True)
except Exception:
    subprocess.run(['docker', 'start', name], check=True)
    raise
try:
    launch(name, serving_port)
    check(serving_port, name)
except Exception:
    subprocess.run(['docker', 'rm', '-f', name], check=False)
    subprocess.run(['docker', 'rename', previous, name], check=True)
    subprocess.run(['docker', 'start', name], check=True)
    raise
print('OVH ' + kind + ' deployed and compact lookup verified: ' + release)
