#!/usr/bin/env python3
"""Deploy the recovery monitor while keeping its mounts and local settings."""
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.request

release = sys.argv[1]
if len(release) != 40 or any(c not in '0123456789abcdef' for c in release):
    raise SystemExit('Pass the full release commit.')
name = 'hanasand-health-monitor'
old = json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]
if old['HostConfig']['NetworkMode'] != 'host':
    raise SystemExit('Expected host networking.')
image = 'hanasand-recovery-monitor:' + release
subprocess.run(['docker', 'build', '-f', 'Dockerfile.monitor', '-t', image, '.'], cwd=pathlib.Path(__file__).parent, check=True)
settings = dict(value.split('=', 1) for value in old['Config']['Env'])
settings['HANASAND_RELEASE_COMMIT'] = release
settings['RECOVERY_ROOT'] = '/recovery'
command = ['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', 'host']
for mount in old['Mounts']:
    if mount['Destination'] != '/var/run/docker.sock': continue
    source = mount.get('Name') if mount['Type'] == 'volume' else mount['Source']
    command += ['-v', source + ':' + mount['Destination'] + ('' if mount['RW'] else ':ro')]
command += ['-v', '/home/hanasand/hanasand/ops/runtime:/recovery']
for key in settings:
    if key.startswith('RECOVERY_') or key == 'HANASAND_RELEASE_COMMIT':
        command += ['-e', key]
command += [image]
previous = name + '-before-' + release[:12]
subprocess.run(['docker', 'stop', name], check=True)
subprocess.run(['docker', 'rename', name, previous], check=True)
try:
    subprocess.run(command, env={**os.environ, **settings}, check=True)
    for attempt in range(45):
        try:
            with urllib.request.urlopen('http://127.0.0.1:' + settings.get('RECOVERY_PORT', '19901') + '/status', timeout=3) as response:
                state = json.load(response)
                if state.get('notificationHealth') == 'case_monitoring' and time.time() - state.get('sampledAt', 0) < 30:
                    break
        except (OSError, ValueError):
            pass
        time.sleep(2)
    else:
        raise RuntimeError('New monitor did not produce a fresh sample.')
except Exception:
    subprocess.run(['docker', 'rm', '-f', name], check=False)
    subprocess.run(['docker', 'rename', previous, name], check=True)
    subprocess.run(['docker', 'start', name], check=True)
    raise
print('Recovery monitor deployed: ' + release)
