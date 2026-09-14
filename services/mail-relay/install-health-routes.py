#!/usr/bin/env python3
"""Expose relay readiness independently of application/database failover."""
import argparse
import fcntl
from pathlib import Path
import re
import subprocess
import tempfile

SITES = {'inspur': ('128.39.142.218', 19261), 'ovh': ('192.99.32.185', 19262)}
INCLUDE = '    include snippets/mail-relay-health.conf;'


def routes(site, revision):
    if site not in SITES or not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Known site and full pushed revision required')
    blocks = []
    for target, (address, port) in SITES.items():
        path = f'/api/mail-relay/{target}/health'
        endpoint = f'http://127.0.0.1:{port}/health' if target == site else f'https://{address}{path}'
        # Fixed peer address avoids following application DNS back to this gateway.
        tls = '' if target == site else """
        proxy_ssl_server_name on;
        proxy_ssl_name api.hanasand.com;
        proxy_ssl_verify on;
        proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
        proxy_ssl_verify_depth 3;"""
        blocks.append(f"""    location = {path} {{
        limit_except GET {{ deny all; }}
        limit_req zone=mail_relay_health burst=10 nodelay;
        limit_req_status 429;
        proxy_pass {endpoint}?;
        proxy_pass_request_headers off;
        proxy_pass_request_body off;
        proxy_set_header Host api.hanasand.com;
        proxy_set_header Content-Length "";
        proxy_connect_timeout 2s;
        proxy_send_timeout 3s;
        proxy_read_timeout 3s;
        proxy_cache off;
        proxy_intercept_errors off;
        proxy_hide_header Cache-Control;
        proxy_hide_header X-Mail-Relay-Health-Release;
        add_header Cache-Control "no-store" always;
        add_header X-Mail-Relay-Health-Release "{revision}" always;
        error_page 502 504 =503 @mail_relay_health_unavailable;{tls}
    }}""")
    blocks.append(f"""    location @mail_relay_health_unavailable {{
        default_type application/json;
        add_header Cache-Control "no-store" always;
        add_header X-Mail-Relay-Health-Release "{revision}" always;
        return 503 '{{"ok":false,"summary":"Mail relay health is unavailable."}}';
    }}""")
    return '\n'.join(blocks) + '\n'


def include_routes(source):
    blocks = re.split(r'(?<=\n})\s*(?=server \{)', source)
    matched = 0
    for index, block in enumerate(blocks):
        if re.search(r'listen\s+443\s+ssl', block) and re.search(r'server_name\s+api\.hanasand\.com;', block):
            matched += 1
            if INCLUDE.strip() not in block:
                blocks[index] = block.replace('server_name api.hanasand.com;', 'server_name api.hanasand.com;\n' + INCLUDE)
    if matched != 1:
        raise ValueError('Expected exactly one public API TLS virtual host')
    return '\n\n'.join(blocks)


def install(site, root, revision):
    main = root / 'conf.d/default.conf'
    changes = {
        main: include_routes(main.read_text()),
        root / 'snippets/mail-relay-health.conf': routes(site, revision),
        root / 'conf.d/mail-relay-health-limit.conf': 'limit_req_zone $binary_remote_addr zone=mail_relay_health:10m rate=2r/s;\n',
    }
    previous = {path: path.read_text() if path.exists() else None for path in changes}
    backup = Path(tempfile.mkdtemp(prefix='mail-relay-health-', dir=root))
    for path, content in previous.items():
        if content is not None: (backup / path.name).write_text(content)
    try:
        for path, content in changes.items():
            path.write_text(content)
        subprocess.run(['docker', 'exec', 'openresty', 'nginx', '-t'], check=True)
        subprocess.run(['docker', 'exec', 'openresty', 'nginx', '-s', 'reload'], check=True)
    except Exception:
        for path, content in previous.items():
            if content is None: path.unlink(missing_ok=True)
            else: path.write_text(content)
        subprocess.run(['docker', 'exec', 'openresty', 'nginx', '-s', 'reload'], check=True)
        raise
    print(f'Relay health routes deployed at {revision}; rollback files: {backup}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('site', choices=SITES)
    parser.add_argument('config_root', type=Path)
    parser.add_argument('revision')
    args = parser.parse_args()
    with open('/tmp/hanasand-frontend-deploy.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        install(args.site, args.config_root, args.revision)
