#!/usr/bin/env python3
"""Add local service routing; --activate switches only website/API virtual hosts."""
import pathlib
import re
import shutil
import subprocess
import sys
import time

site, conf_root, *flags = sys.argv[1:]
root = pathlib.Path(conf_root)
primary = site == 'inspur'
ports = dict(frontend=(13000,), api=(18080,), auth=(18090,)) if primary else dict(frontend=(19300,), api=(19080,), auth=(19090,))
def upstream(name, values):
    return 'upstream '+name+' {\n'+''.join(f'    server 127.0.0.1:{port} max_fails=1 fail_timeout=3s'+(' backup' if i else '')+';\n' for i,port in enumerate(values))+'    keepalive 32;\n}\n'
text = ''.join(upstream('hanasand_recovery_'+name, values) for name,values in ports.items())
local_port = 28082 if primary else 19081
text += f"""
server {{
    listen 127.0.0.1:{local_port};
    server_name api.hanasand.com;
    location ^~ /api/auth/ {{
        proxy_pass http://hanasand_recovery_auth;
        include snippets/proxy-headers.conf;
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }}
    location = /api/user {{
        proxy_pass http://hanasand_recovery_auth;
        include snippets/proxy-headers.conf;
    }}
    location / {{
        proxy_pass http://hanasand_recovery_api;
        include snippets/proxy-headers.conf;
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }}
}}
"""
changes = {root/'conf.d/resilience-upstreams.conf': text}
if '--activate' in flags:
    main = root/'conf.d/default.conf'
    source = main.read_text()
    # Existing top-level server blocks have unindented closing braces.
    blocks = re.split(r'(?<=\n})\s*(?=server \{)', source)
    touched = set()
    for n,block in enumerate(blocks):
        if 'listen 443 ssl;' not in block: continue
        if re.search(r'server_name\s+hanasand.com(?:\s+www.hanasand.com)?;', block):
            block = re.sub(r'proxy_pass http://(?:localhost|127\.0\.0\.1):(?:3000|3100|3200|3300);', 'proxy_pass http://hanasand_recovery_frontend;', block)
            block = re.sub(r'proxy_pass http://(?:localhost|127\.0\.0\.1):8080;', 'proxy_pass http://hanasand_recovery_api;', block)
            touched.add('frontend')
        if re.search(r'server_name\s+api.hanasand.com;', block):
            block = re.sub(r'proxy_pass http://(?:localhost|127\.0\.0\.1):8080;', 'proxy_pass http://hanasand_recovery_api;', block)
            if 'include snippets/auth-routes.conf;' not in block:
                block = block.replace('server_name api.hanasand.com;', 'server_name api.hanasand.com;\n    include snippets/auth-routes.conf;')
            if 'location = /api/resilience/status' not in block:
                block = block.replace('server_name api.hanasand.com;', 'server_name api.hanasand.com;\n    location = /api/resilience/status { proxy_pass http://127.0.0.1:19901/status; proxy_connect_timeout 2s; proxy_read_timeout 3s; }')
            touched.add('api')
        blocks[n] = block
    if touched != {'api','frontend'}: raise SystemExit('Could not identify both public virtual hosts')
    changes[main] = '\n\n'.join(blocks)
    changes[root/'conf.d/auth-upstream.conf'] = upstream('hanasand_auth', ports['auth'])
    script_root = pathlib.Path(__file__).parent
    for name in ('auth-routes','auth-proxy'):
        target = root/f'snippets/{name}.conf'
        if not target.exists(): changes[target] = (script_root/f'nginx-{name}.conf').read_text()
backup = root/f'resilience-backup-{int(time.time())}'
backup.mkdir()
previous = {}
for path,content in changes.items():
    previous[path] = path.read_text() if path.exists() else None
    if path.exists(): shutil.copy2(path, backup/path.name)
    path.write_text(content)
try:
    subprocess.run(['docker','exec','openresty','nginx','-t'],check=True)
    subprocess.run(['docker','exec','openresty','nginx','-s','reload'],check=True)
except Exception:
    for path,content in previous.items():
        if content is None: path.unlink(missing_ok=True)
        else: path.write_text(content)
    subprocess.run(['docker','exec','openresty','nginx','-s','reload'])
    raise
print('Proxy configuration validated and reloaded; rollback files:',backup)
