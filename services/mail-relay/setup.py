#!/usr/bin/env python3
"""Run from the pushed Git revision on the selected host; never prints secrets."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import re
import shlex
import subprocess
import time
import tomllib
import urllib.request
import urllib.error

STALWART_IMAGE = 'stalwartlabs/stalwart@sha256:b6c2a04a79695136d5e2c16e9da0254135d0c3f3b1f8147873e812916b0ae8c4'
ROOT = Path.home() / 'resilience-mail-relay'


def write_secret(path, value):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as target:
        target.write(value)
    temporary.replace(path)


def credentials():
    path = ROOT / 'credentials.json'
    if not path.exists():
        write_secret(path, json.dumps({key: secrets.token_urlsafe(36) for key in ['admin', 'relay', 'health']}))
    return json.loads(path.read_text())


def api(base, username, password, path, body=None):
    request = urllib.request.Request(base + '/api' + path, headers={
        'Authorization': 'Basic ' + base64.b64encode((username + ':' + password).encode()).decode(),
        'Content-Type': 'application/json'}, data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(request, timeout=8) as response:
        data = json.load(response)
    if data.get('error') and data['error'] != 'notFound':
        raise RuntimeError('Mail configuration request failed: ' + data['error'])
    return data


def ensure_principal(base, admin, principal):
    if not api(base, admin['user'], admin['secret'], '/principal/' + principal['name']).get('data'):
        api(base, admin['user'], admin['secret'], '/principal', principal)


def start(name, image, network, volumes, ports, aliases=(), extra=()):
    previous_ip = None
    if subprocess.run(['docker', 'inspect', name], capture_output=True).returncode == 0:
        current = json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]
        if current['Config']['Image'] == image:
            # Health/connector config is read at startup; apply credential changes.
            action = 'start' if name == 'hanasand-mail-relay-ovh' else 'restart'
            subprocess.run(['docker', action, name], check=True, stdout=subprocess.DEVNULL)
            return
        previous_ip = current['NetworkSettings']['Networks'][network]['IPAddress']
        # Only these task-owned, stateless health/connector containers are replaced.
        if name == 'hanasand-mail-relay-ovh':
            raise RuntimeError('Relay image changes require a reviewed upgrade.')
        subprocess.run(['docker', 'stop', '-t', '15', name], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['docker', 'rm', name], check=True, stdout=subprocess.DEVNULL)
    command = ['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', network,
        '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--read-only',
        '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m', '--memory', '512m', '--cpus', '1',
        '--log-opt', 'max-size=10m', '--log-opt', 'max-file=3', '--stop-timeout', '30']
    if previous_ip and name == 'hanasand-mail-relay-inspur': command += ['--ip', previous_ip]
    for alias in aliases: command += ['--network-alias', alias]
    for volume in volumes: command += ['-v', volume]
    for port in ports: command += ['-p', port]
    subprocess.run(command + list(extra) + [image], check=True, stdout=subprocess.DEVNULL)


def refresh_tls():
    for filename in ['fullchain.pem', 'privkey.pem']:
        value = subprocess.check_output(['docker', 'exec', 'openresty', 'cat', '/etc/letsencrypt/live/hanasand.com/' + filename], text=True)
        write_secret(ROOT / 'tls' / filename, value)



def refresh_ovh_certificate():
    previous = (ROOT / 'tls/fullchain.pem').read_bytes()
    refresh_tls()
    if previous != (ROOT / 'tls/fullchain.pem').read_bytes():
        result = api('http://127.0.0.1:18081', 'admin', credentials()['admin'], '/reload/certificate')
        if result.get('data', {}).get('errors'):
            raise RuntimeError('Relay certificate reload failed')
        print('Relay TLS certificate renewed and reloaded.')


def install_certificate_refresh(revision):
    if not re.fullmatch(r'[0-9a-f]{40}', revision): raise ValueError('A full pushed Git revision is required')
    repository = Path.home() / 'hanasand'
    subprocess.run(['git', '-C', str(repository), 'cat-file', '-e', revision + ':services/mail-relay/setup.py'], check=True)
    command = 'git -C ' + shlex.quote(str(repository)) + ' show ' + revision + ':services/mail-relay/setup.py | /usr/bin/python3 - ovh --refresh-tls'
    line = '17 * * * * /usr/bin/flock -n ' + shlex.quote(str(ROOT / 'renewal.lock')) + ' /bin/bash -o pipefail -c ' + shlex.quote(command) + ' 2>&1 | /usr/bin/logger -t hanasand-mail-relay-tls # hanasand-mail-relay-renewal'
    existing = subprocess.run(['crontab', '-l'], text=True, capture_output=True)
    if existing.returncode and 'no crontab' not in existing.stderr: raise RuntimeError('Could not read existing crontab')
    lines = [item for item in existing.stdout.splitlines() if not item.endswith('# hanasand-mail-relay-renewal')]
    subprocess.run(['crontab', '-'], input='\n'.join(lines + [line, '']), text=True, check=True)
    print('Hourly certificate refresh installed; existing scheduled tasks preserved.')


def activate_inspur():
    admin = tomllib.loads(Path('/home/hanasand/hanasand/mail/stalwart/etc/config.toml').read_text())['authentication']['fallback-admin']
    def call(path, body=None):
        return api('http://127.0.0.1:8081', admin['user'], admin['secret'], path, body)
    # Queue backlog returns 503 during activation; connection checks must still pass.
    try:
        response = urllib.request.urlopen('http://127.0.0.1:19261/health', timeout=5)
    except urllib.error.HTTPError as error:
        if error.code != 503: raise
        response = error
    with response:
        health = json.load(response)
    if not all(health.get('checks', {}).get(key) for key in ['smtpAuthentication', 'relayAuthentication', 'tunnel']):
        raise RuntimeError('Private relay authentication must pass before activation')
    saved = json.loads((ROOT / 'ovh-credentials.json').read_text())
    values = {
        'queue.route.ovh-relay.type': 'relay', 'queue.route.ovh-relay.address': 'smtp-relay.hanasand.com',
        'queue.route.ovh-relay.port': '1587', 'queue.route.ovh-relay.protocol': 'smtp',
        'queue.route.ovh-relay.auth.username': 'inspur-relay', 'queue.route.ovh-relay.auth.secret': saved['relay'],
        'queue.route.ovh-relay.tls.implicit': 'false', 'queue.route.ovh-relay.tls.allow-invalid-certs': 'false',
        'queue.strategy.route.0.if': "is_local_domain('*', rcpt_domain)", 'queue.strategy.route.0.then': "'local'",
        'queue.strategy.route.1.else': "'ovh-relay'",
        'queue.tls.ovh-relay.starttls': 'require', 'queue.tls.ovh-relay.allow-invalid-certs': 'false',
        'queue.tls.ovh-relay.timeout.tls': '10s',
        'queue.strategy.tls': "'ovh-relay'",
    }
    backup = ROOT / 'route-before.json'
    if not backup.exists(): write_secret(backup, json.dumps(call('/settings/list?prefix=queue.strategy')))
    call('/settings', [
        {'type': 'clear', 'prefix': 'queue.strategy.route'},
        {'type': 'clear', 'prefix': 'queue.strategy.tls'},
        {'type': 'insert', 'assert_empty': False, 'prefix': None, 'values': list(values.items())},
    ])
    result = call('/reload')
    if result.get('data', {}).get('errors'): raise RuntimeError('Relay configuration reload failed')
    print('External mail uses the authenticated OVH relay with required TLS; local delivery is preserved.')


def setup_ovh(image):
    saved = credentials()
    refresh_tls()
    config = ROOT / 'data/etc/config.toml'
    if not config.exists():
        write_secret(config, '''[server.listener.submission]
bind = "[::]:1587"
protocol = "smtp"
[server.listener.http]
bind = "[::]:8080"
protocol = "http"
[server]
hostname = "mail.hanasand.com"
[storage]
blob = "rocksdb"
data = "rocksdb"
directory = "internal"
fts = "rocksdb"
lookup = "rocksdb"
[store.rocksdb]
type = "rocksdb"
path = "/opt/stalwart/data"
compression = "lz4"
[directory.internal]
type = "internal"
store = "rocksdb"
[authentication.fallback-admin]
user = "admin"
secret = "''' + saved['admin'] + '''"
[certificate.default]
cert = "%{file:/run/tls/fullchain.pem}%"
private-key = "%{file:/run/tls/privkey.pem}%"
default = true
[tracer.stdout]
type = "console"
level = "info"
ansi = false
enable = true
''')
    network = 'hanasand-mail-relay'
    if subprocess.run(['docker', 'network', 'inspect', network], capture_output=True).returncode:
        subprocess.run(['docker', 'network', 'create', network], check=True, stdout=subprocess.DEVNULL)
    start('hanasand-mail-relay-ovh', STALWART_IMAGE, network,
        [f'{ROOT}/data:/opt/stalwart', f'{ROOT}/tls:/run/tls:ro'],
        ['127.0.0.1:2687:1587', '127.0.0.1:18081:8080'], ['smtp-relay.hanasand.com'])
    base = 'http://127.0.0.1:18081'
    admin = {'user': 'admin', 'secret': saved['admin']}
    for attempt in range(30):
        try:
            api(base, 'admin', saved['admin'], '/principal?limit=1')
            break
        except Exception:
            if attempt == 29: raise
            time.sleep(1)
    ensure_principal(base, admin, {'type': 'domain', 'name': 'hanasand.com'})
    ensure_principal(base, admin, {'type': 'individual', 'name': 'inspur-relay', 'secrets': [saved['relay']],
        'emails': ['noreply@hanasand.com'], 'roles': [], 'enabledPermissions': ['authenticate', 'email-send']})
    ensure_principal(base, admin, {'type': 'individual', 'name': 'relay-health', 'secrets': [saved['health']],
        'roles': [], 'enabledPermissions': ['authenticate', 'message-queue-list', 'message-queue-get']})
    api(base, 'relay-health', saved['health'], '/queue/messages?limit=1')
    settings = {'site': 'ovh', 'incoming': {'host': '192.99.32.185'}, 'smtp': {'host': 'smtp-relay.hanasand.com', 'port': 1587, 'serverName': 'smtp-relay.hanasand.com', 'username': 'inspur-relay', 'password': saved['relay']},
        'queue': {'url': 'http://hanasand-mail-relay-ovh:8080', 'username': 'relay-health', 'password': saved['health']}}
    write_secret(ROOT / 'health/health.json', json.dumps(settings))
    start('hanasand-mail-relay-ovh-health', image, network, [f'{ROOT}/health:/run/config:ro'], ['127.0.0.1:19262:8080'])
    print('OVH private SMTP relay and readiness service installed.')


def setup_inspur(image):
    saved = credentials()
    relay = json.loads((ROOT / 'ovh-credentials.json').read_text())
    mail = Path('/home/hanasand/hanasand/mail/stalwart/etc/config.toml')
    admin = tomllib.loads(mail.read_text())['authentication']['fallback-admin']
    base = 'http://127.0.0.1:8081'
    ensure_principal(base, admin, {'type': 'individual', 'name': 'relay-health', 'secrets': [saved['health']],
        'roles': [], 'enabledPermissions': ['authenticate', 'message-queue-list', 'message-queue-get']})
    api(base, 'relay-health', saved['health'], '/queue/messages?limit=1')
    # Derive the existing application sender credential inside its current runtime.
    javascript = '''import {systemSenderAccess} from "./src/utils/mail/system.ts";console.log(JSON.stringify(systemSenderAccess()));process.exit(0);'''
    sender = json.loads(subprocess.check_output(['docker', 'exec', 'hanasand_api', 'bun', '-e', javascript]))
    settings = {'site': 'inspur', 'smtp': {'host': 'stalwart', 'port': 587, 'serverName': 'mail.hanasand.com', **sender},
        'relay': {'host': '127.0.0.1', 'port': 1587, 'serverName': 'smtp-relay.hanasand.com', 'username': 'inspur-relay', 'password': relay['relay']},
        'queue': {'url': 'http://stalwart:8080', 'username': 'relay-health', 'password': saved['health']}}
    write_secret(ROOT / 'health/health.json', json.dumps(settings))
    start('hanasand-mail-relay-inspur', image, 'hanasand_hanasandnet',
        [f'{ROOT}/health:/run/config:ro', f'{ROOT}/ssh:/run/ssh:ro'], ['127.0.0.1:19261:8080'],
        ['mail-relay-inspur', 'smtp-relay.hanasand.com'])
    print('Inspur connector and readiness service installed. Routing is not changed until activation.')


def configure_gateway(site):
    if site == 'inspur':
        mail = Path('/home/hanasand/hanasand/mail/stalwart/etc/config.toml')
        admin = tomllib.loads(mail.read_text())['authentication']['fallback-admin']
        info = json.loads(subprocess.check_output(['docker', 'inspect', 'hanasand-mail-relay-inspur']))[0]
        address = info['NetworkSettings']['Networks']['hanasand_hanasandnet']['IPAddress']
        # Trust only this pinned connector address, and only on incoming SMTP.
        api('http://127.0.0.1:8081', admin['user'], admin['secret'], '/settings', [{
            'type': 'insert', 'assert_empty': False, 'prefix': None,
            'values': [('server.listener.smtp.proxy.trusted-networks', address + '/32')],
        }])
        subprocess.run(['docker', 'restart', 'hanasand_mail'], check=True, stdout=subprocess.DEVNULL)
        print('Incoming SMTP trusts PROXY headers only from the private connector.')
        return

    keys = Path.home() / '.ssh/authorized_keys'
    lines = keys.read_text().splitlines(keepends=True)
    matching = [i for i, line in enumerate(lines)
                if 'permitopen="127.0.0.1:2687"' in line and 'permitopen="127.0.0.1:19262"' in line]
    if len(matching) != 1: raise RuntimeError('Expected exactly one restricted mail relay SSH key')
    index = matching[0]
    if 'permitlisten="127.0.0.1:2625"' not in lines[index]:
        write_secret(ROOT / 'authorized-keys-before-inbound', keys.read_text())
        lines[index] = 'permitlisten="127.0.0.1:2625",' + lines[index]
        write_secret(keys, ''.join(lines))
    saved = credentials()
    # This private principal represents the upstream MTA, which already checks
    # sender ownership. Health users and other accounts retain sender matching.
    api('http://127.0.0.1:18081', 'admin', saved['admin'], '/settings', [{
        'type': 'insert', 'assert_empty': False, 'prefix': None, 'values': [
            ('session.auth.match-sender.0.if', "authenticated_as == 'inspur-relay'"),
            ('session.auth.match-sender.0.then', 'false'),
            ('session.auth.match-sender.1.else', 'true'),
        ],
    }])
    result = api('http://127.0.0.1:18081', 'admin', saved['admin'], '/reload')
    if result.get('data', {}).get('errors'): raise RuntimeError('Relay configuration reload failed')
    config = ROOT / 'gateway.cfg'
    write_secret(config, Path(__file__).with_name('gateway.cfg').read_text())
    config.chmod(0o644)  # Contains no secrets; readable after the worker drops privileges.
    image = 'haproxy@sha256:6343ce34a132a5dceaa24767d739df2bd519f8f7c1079ae39e4821334e8eb42e'
    flags = ['--network', 'host', '--user', '0:0', '--cap-drop', 'ALL',
             '--cap-add', 'NET_BIND_SERVICE', '--cap-add', 'SETUID', '--cap-add', 'SETGID', '--security-opt', 'no-new-privileges:true',
             '--read-only', '--memory', '128m', '--cpus', '1',
             '-v', f'{config}:/usr/local/etc/haproxy/haproxy.cfg:ro']
    subprocess.run(['docker', 'run', '--rm'] + flags + [image, 'haproxy', '-c', '-f',
                   '/usr/local/etc/haproxy/haproxy.cfg'], check=True)
    name = 'hanasand-mail-gateway-ovh'
    if subprocess.run(['docker', 'inspect', name], capture_output=True).returncode == 0:
        # This gateway is stateless; replacing it applies changed capability/volume settings.
        subprocess.run(['docker', 'rm', '-f', name], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped',
                    '--log-opt', 'max-size=10m', '--log-opt', 'max-file=3'] + flags + [image],
                   check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['sudo', '-n', 'ufw', 'allow', 'proto', 'tcp', 'from', 'any', 'to',
                    '192.99.32.185', 'port', '25', 'comment', 'Hanasand incoming mail gateway'], check=True)
    print('OVH public SMTP gateway installed; mailboxes and recipient validation remain on Inspur.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('site', choices=['ovh', 'inspur'])
    parser.add_argument('--image')
    parser.add_argument('--refresh-tls', action='store_true')
    parser.add_argument('--activate', action='store_true')
    parser.add_argument('--configure-gateway', action='store_true')
    parser.add_argument('--renewal-revision')
    args = parser.parse_args()
    ROOT.mkdir(mode=0o700, exist_ok=True)
    if args.configure_gateway: configure_gateway(args.site)
    elif args.renewal_revision and args.site == 'ovh': install_certificate_refresh(args.renewal_revision)
    elif args.refresh_tls and args.site == 'ovh': refresh_ovh_certificate()
    elif args.activate and args.site == 'inspur': activate_inspur()
    elif args.image: (setup_ovh if args.site == 'ovh' else setup_inspur)(args.image)
    else: parser.error('Choose --image, OVH --refresh-tls, or Inspur --activate')
