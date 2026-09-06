#!/usr/bin/env python3
"""Render HAProxy's native first-healthy-backup policy, not a custom router."""
import json
import pathlib
import sys


def render(config):
    lines = ['global', '    hard-stop-after 65s', '    log stdout format raw local0', f"    stats socket /run/haproxy/admin{config.get('proxyIndex', 0)}.sock mode 600 level admin",
             f"    stats socket ipv4@127.0.0.1:{19909 + config.get('proxyIndex', 0)} level admin",
             'defaults', '    log global', '    mode http', '    timeout connect 2s', '    timeout client 60s', '    timeout server 60s',
             '    retries 1', '    option redispatch', '    default-server inter 2s fall 3 rise 15',
             'listen stats', f"    bind 127.0.0.1:{config.get('statsPort', 19900)}", '    stats enable', '    stats uri /stats']
    for service in config['services']:
        if not service.get('listenPort'):
            continue
        tcp = service['id'] == 'database'
        lines += [f"listen {service['id']}", f"    bind 127.0.0.1:{service['listenPort']}"]
        if tcp:
            lines += ['    mode tcp', '    option pgsql-check user hanasand_replica', '    timeout client 1h', '    timeout server 1h']
        else:
            lines += ['    option httpchk', f"    http-check send meth GET uri {service.get('checkPath', '/ready')} ver HTTP/1.1 hdr Host {service.get('host', 'api.hanasand.com')}", '    http-check expect status 200']
        for index, instance in enumerate(service['instances']):
            if not instance.get('address'):
                continue
            suffix = ' backup' if index else ''
            if instance['id'] in config.get('maintenanceInstances', []): suffix += ' disabled'
            if tcp:
                suffix += ' on-marked-down shutdown-sessions'
                if index == 0: suffix += ' on-marked-up shutdown-backup-sessions'
            if instance.get('tlsName'):
                suffix += f" ssl verify required ca-file /etc/ssl/certs/ca-certificates.crt sni str({instance['tlsName']}) check-sni {instance['tlsName']}"
            lines.append(f"    server {instance['id']} {instance['address']} check{suffix}")
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    config = json.loads(pathlib.Path(sys.argv[1]).read_text())
    pathlib.Path(sys.argv[2]).write_text(render(config))
    if len(sys.argv) > 3:
        config['proxyIndex'] = 1
        config['statsPort'] = 19902
        # Linux SO_REUSEPORT keeps one stable endpoint backed by two independent routers.
        pathlib.Path(sys.argv[3]).write_text(render(config))
