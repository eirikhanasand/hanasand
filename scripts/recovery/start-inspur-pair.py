#!/usr/bin/env python3
"""Start unused local slots, inheriting the existing app's runtime settings locally."""
import json
import os
from pathlib import Path
import subprocess
import socket
import sys
from container_names import pair_name
from support_config import support_settings
from probe_verification_config import probe_verification_settings

kind, image, source, *ports = sys.argv[1:]
assert kind in ('api', 'auth', 'frontend') and len(ports) == 2
assert all(port.isdecimal() and 1024 < int(port) < 65535 for port in ports)
original = json.loads(subprocess.check_output(['docker', 'inspect', source]))[0]
settings = dict(item.split('=', 1) for item in original['Config']['Env'])
if kind in ('api', 'auth'):
    settings['COMPACT_PWNED_RANGE_API'] = 'http://127.0.0.1:8099/range'
if kind == 'api':
    settings.update(support_settings())
    settings.update(probe_verification_settings())
    settings['DB_BACKUP_WORKER_SOCKET']='/var/lib/hanasand/backups/database/.worker.sock'
# Collectors receive a credential that authenticates only log ingestion.
log_ingest_file = Path('/home/hanasand/hanasand/ops/runtime/log-ingest.json')
if kind == 'api' and log_ingest_file.exists():
    log_ingest = json.loads(log_ingest_file.read_text())
    if not isinstance(log_ingest, dict) or set(log_ingest) != {'LOG_INGEST_TOKEN'} or not isinstance(log_ingest['LOG_INGEST_TOKEN'], str) or len(log_ingest['LOG_INGEST_TOKEN']) < 32:
        raise SystemExit('Invalid log ingestion configuration')
    settings.update(log_ingest)

if kind in ('api', 'auth'):
    mail_file = Path('/home/hanasand/hanasand/ops/runtime/mail.json')
    if mail_file.exists():
        mail = json.loads(mail_file.read_text())
        allowed = {'MAIL_ADMIN_USERNAME', 'MAIL_ADMIN_PASSWORD', 'MAIL_SERVICE_KEY', 'MAIL_SYSTEM_SENDER_PASSWORD', 'MAIL_INTERNAL_URL', 'MAIL_SMTP_INTERNAL_PORT'}
        if not isinstance(mail, dict) or not set(mail) <= allowed or not all(isinstance(v, str) and v for v in mail.values()):
            raise SystemExit('Invalid mail runtime configuration')
        settings.update(mail)

# Keep provider secrets separate from the shared API/frontend environment.
if kind == 'auth':
    secret_file = Path('/home/hanasand/hanasand/ops/runtime/auth-providers.json')
    if secret_file.exists():
        secrets = json.loads(secret_file.read_text())
        allowed = {'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'}
        if not isinstance(secrets, dict) or not set(secrets) <= allowed or not all(isinstance(v, str) and v for v in secrets.values()):
            raise SystemExit('Invalid authentication provider configuration')
        settings.update(secrets)
settings.update(NODE_ENV='production', RECOVERY_SITE='inspur', HANASAND_RELEASE_COMMIT=image.rsplit(':',1)[-1], RECOVERY_STATE_FILE='/recovery/state.json', DB_HOST='127.0.0.1', DB_PORT='18504', DB_MAX_CONN='8' if kind=='api' else '5', DB_TIMEOUT_MS='2000', LISTEN_HOST='127.0.0.1')
if kind == 'api': settings.update(AI_HEALTH_WORKER_BASE='http://127.0.0.1:8080', API_HTTP_ONLY='1', VM_HOST_ID='inspur', TI_SCRAPER_API_BASE='http://127.0.0.1:18097')
if kind == 'auth': settings.update(AUTH_SERVICE_ONLY='1')
if kind == 'frontend': settings.update(CODE_REVIEW_INVENTORY_PATH='/app/code-review/current.json', HOSTNAME='127.0.0.1', FRONTEND_AUTH_API='http://127.0.0.1:28082/api', FRONTEND_INTERNAL_API='http://127.0.0.1:28082/api', TI_SCRAPER_API_BASE='http://127.0.0.1:18097', RECOVERY_STATUS_URL='http://127.0.0.1:19901/status')
# Reuse Docker network aliases in the host-network workers (mail, VM helpers, etc.).
aliases = {}
for item in json.loads(subprocess.check_output(['docker', 'inspect', *subprocess.check_output(['docker', 'ps', '-q']).decode().split()])):
    for network in item['NetworkSettings']['Networks'].values():
        if network.get('IPAddress'):
            for alias in network.get('Aliases') or []: aliases[alias] = network['IPAddress']
for port in ports:
    name = pair_name(kind, port)
    if subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode == 0:
        raise SystemExit(f'{name} already exists; choose unused slots before deploying')
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', int(port)))
    settings['PORT'] = port
    command = ['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', 'host', '--memory', '512m' if kind=='auth' else '2g', '--cpus', '1' if kind=='auth' else '2', '--stop-timeout', '65', '-v', '/home/hanasand/hanasand/ops/runtime/status:/recovery:ro']
    if kind == 'api': command += ['-v', '/var/lib/hanasand/docker-storage:/var/lib/hanasand/docker-storage']
    if kind in ('api', 'frontend'): command += ['-v', '/home/hanasand/hanasand/ops/code-review/published:/app/code-review:ro']
    # Passing names, not values, keeps multiline credentials out of process arguments.
    for key in settings: command += ['-e', key]
    for alias, address in aliases.items(): command += ['--add-host', alias + ':' + address]
    if kind != 'auth':
        for mount in original['Mounts']:
            if mount['Destination'] in ('/recovery', '/app/code-review', '/var/lib/hanasand/docker-storage'): continue
            source_path = mount['Name'] if mount['Type']=='volume' else mount['Source']
            command += ['-v', source_path+':'+mount['Destination']+('' if mount['RW'] else ':ro')]
    command += ['--entrypoint', 'bun', image, 'src/index.ts' if kind=='api' else 'src/authServer.ts' if kind=='auth' else 'server.js']
    subprocess.run(command, env={**os.environ, **settings}, check=True)
