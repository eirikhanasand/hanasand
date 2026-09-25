#!/usr/bin/env python3
"""Allow screenshot reports through the existing frontend/API proxy routes."""
import pathlib
import re
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
previous = {}
for name in ('default.conf', 'recovery-upstreams.conf'):
    path = root / 'conf.d' / name
    source = path.read_text()
    blocks = re.split(r'(?<=\n})\s*(?=server \{)', source)
    for index, block in enumerate(blocks):
        if 'browser-report-upload' in block:
            continue
        if re.search(r'server_name\s+hanasand.com(?:\s+www.hanasand.com)?;', block):
            route, upstream = '/api/backend/browser/runs/', 'frontend'
        elif re.search(r'server_name\s+api.hanasand.com;', block):
            route, upstream = '/api/browser/runs/', 'api'
        else:
            continue
        location = f'''
    # browser-report-upload: keep other request limits unchanged.
    location ~ ^{route}[^/]+/report$ {{
        client_max_body_size 32m;
        proxy_pass http://hanasand_recovery_{upstream};
        include snippets/proxy-headers.conf;
    }}
'''
        blocks[index] = block.replace('    location / {', location + '\n    location / {', 1)
    updated = '\n\n'.join(blocks)
    if updated != source:
        previous[path] = source
        path.write_text(updated)
try:
    subprocess.run(['docker', 'exec', 'openresty', 'nginx', '-t'], check=True)
    subprocess.run(['docker', 'exec', 'openresty', 'nginx', '-s', 'reload'], check=True)
except Exception:
    for path, source in previous.items():
        path.write_text(source)
    raise
