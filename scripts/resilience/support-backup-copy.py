#!/usr/bin/env python3
"""Copy the canonical support snapshot to Inspur through its private SSH tunnel."""
import json
import os
from pathlib import Path
import shutil
import time
import urllib.request

config = json.loads(Path('/home/hanasand/resilience/support.json').read_text())
assert config['SUPPORT_SERVICE_BASE'] == 'http://127.0.0.1:29181'
destination = Path('/home/hanasand/resilience/support-backups')
destination.mkdir(mode=0o700, exist_ok=True)
stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
temporary = destination / (stamp + '.partial')
saved = destination / (stamp + '.dump')
request = urllib.request.Request(config['SUPPORT_SERVICE_BASE'] + '/backup', headers={'x-support-service-key': config['SUPPORT_SERVICE_KEY']})
try:
    with urllib.request.urlopen(request, timeout=60) as response, os.fdopen(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as stream:
        shutil.copyfileobj(response, stream)
    with temporary.open('rb') as stream:
        if stream.read(5) != b'PGDMP': raise RuntimeError('Invalid PostgreSQL support snapshot')
    temporary.replace(saved)
    for old in sorted(destination.glob('*.dump'))[:-48]: old.unlink()
    print('Support snapshot copied')
finally:
    temporary.unlink(missing_ok=True)
