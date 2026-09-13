#!/usr/bin/env python3
"""Load the renewed host certificate into Stalwart without exposing its private key.

Run on Inspur after certificate renewal, or periodically; unchanged certificates
are skipped. No application source or certificate files are copied.
"""
import hashlib
import os
from pathlib import Path
import subprocess
import tomllib

root = Path(__file__).resolve().parents[1]
mail = root / 'mail/stalwart'
cert_dir = Path(os.environ.get('MAIL_TLS_SOURCE', '/home/hanasand/openresty/letsencrypt/live/hanasand.com'))
cert = (cert_dir / 'fullchain.pem').read_text()
try:
    key = (cert_dir / 'privkey.pem').read_text()
except PermissionError:
    # The renewal container owns the key; read it there without changing permissions.
    key = subprocess.check_output(['docker', 'exec', 'openresty', 'cat',
        '/etc/letsencrypt/live/hanasand.com/privkey.pem'], text=True)
subprocess.run(['openssl', 'x509', '-in', str(cert_dir / 'fullchain.pem'), '-noout', '-checkend', '86400'], check=True, stdout=subprocess.DEVNULL)
state = mail / '.tls-certificate-sha256'
digest = hashlib.sha256(cert.encode()).hexdigest()
if state.exists() and state.read_text().strip() == digest:
    raise SystemExit(0)
admin = tomllib.loads((mail / 'etc/config.toml').read_text())['authentication']['fallback-admin']
base = ['docker', 'exec', 'hanasand_mail', 'stalwart-cli', '-u', 'http://127.0.0.1:8080', '-c', f"{admin['user']}:{admin['secret']}", 'server']
for field, value in [('cert', cert), ('private-key', key), ('default', 'true')]:
    result = subprocess.run(base + ['add-config', f'certificate.default.{field}', value], capture_output=True)
    if result.returncode:
        raise SystemExit(f'Stalwart certificate update failed for {field}; certificate state was not marked current.')
for action in ['reload-config', 'reload-certificates']:
    if subprocess.run(base + [action], capture_output=True).returncode:
        raise SystemExit(f'Stalwart {action} failed; certificate state was not marked current.')
state.write_text(digest + '\n')
print('Stalwart TLS certificate updated.')
