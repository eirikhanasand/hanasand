#!/usr/bin/env python3
"""Start unused local slots, inheriting the existing app's runtime settings locally."""
import json
import os
import subprocess
import socket
import sys

kind, image, source, *ports = sys.argv[1:]
assert kind in ('api', 'auth', 'frontend') and len(ports) == 2
assert all(port.isdecimal() and 1024 < int(port) < 65535 for port in ports)
original = json.loads(subprocess.check_output(['docker', 'inspect', source]))[0]
settings = dict(item.split('=', 1) for item in original['Config']['Env'])
settings.update(NODE_ENV='production', RESILIENCE_SITE='inspur', HANASAND_RELEASE_COMMIT=image.rsplit(':',1)[-1], RESILIENCE_STATE_FILE='/resilience/state.json', DB_HOST='127.0.0.1', DB_PORT='18504', DB_MAX_CONN='8' if kind=='api' else '5', DB_TIMEOUT_MS='2000', LISTEN_HOST='127.0.0.1')
if kind == 'api': settings.update(API_HTTP_ONLY='1', TI_SCRAPER_API_BASE='http://127.0.0.1:18097')
if kind == 'auth': settings.update(AUTH_SERVICE_ONLY='1')
if kind == 'frontend': settings.update(CODE_REVIEW_INVENTORY_PATH='/app/code-review/current.json', HOSTNAME='127.0.0.1', FRONTEND_AUTH_API='http://127.0.0.1:28082/api', FRONTEND_INTERNAL_API='http://127.0.0.1:28082/api', TI_SCRAPER_API_BASE='http://127.0.0.1:18097', RESILIENCE_STATUS_URL='http://127.0.0.1:19901/status')
# Reuse Docker network aliases in the host-network workers (mail, VM helpers, etc.).
aliases = {}
for item in json.loads(subprocess.check_output(['docker', 'inspect', *subprocess.check_output(['docker', 'ps', '-q']).decode().split()])):
    for network in item['NetworkSettings']['Networks'].values():
        if network.get('IPAddress'):
            for alias in network.get('Aliases') or []: aliases[alias] = network['IPAddress']
for port in ports:
    name = f'hanasand-resilience-{kind}-{port}'
    if subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode == 0:
        raise SystemExit(f'{name} already exists; choose unused slots before deploying')
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', int(port)))
    settings['PORT'] = port
    command = ['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', 'host', '--memory', '512m' if kind=='auth' else '2g', '--cpus', '1' if kind=='auth' else '2', '--stop-timeout', '65', '-v', '/home/hanasand/resilience/status:/resilience:ro']
    if kind == 'frontend': command += ['-v', '/home/hanasand/code-review/published:/app/code-review:ro']
    # Passing names, not values, keeps multiline credentials out of process arguments.
    for key in settings: command += ['-e', key]
    for alias, address in aliases.items(): command += ['--add-host', alias + ':' + address]
    if kind != 'auth':
        for mount in original['Mounts']:
            if mount['Destination'] in ('/resilience', '/app/code-review'): continue
            source_path = mount['Name'] if mount['Type']=='volume' else mount['Source']
            command += ['-v', source_path+':'+mount['Destination']+('' if mount['RW'] else ':ro')]
    command += ['--entrypoint', 'bun', image, 'src/index.ts' if kind=='api' else 'src/authServer.ts' if kind=='auth' else 'server.js']
    subprocess.run(command, env={**os.environ, **settings}, check=True)
