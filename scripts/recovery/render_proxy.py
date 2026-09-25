#!/usr/bin/env python3
"""Render HAProxy's native first-healthy-backup policy, not a custom router."""
import json
import pathlib
import sys


def render(config):
    # 31 observations at 2-second intervals span at least 60 seconds.
    # Apply the same stability requirement before returning to a primary.
    lines = ['global', '    hard-stop-after 65s', '    log stdout format raw local0', f"    stats socket /run/haproxy/admin{config.get('proxyIndex', 0)}.sock mode 600 level admin",
             f"    stats socket ipv4@127.0.0.1:{19909 + config.get('proxyIndex', 0)} level admin",
             'defaults', '    log global', '    mode http', '    timeout connect 2s', '    timeout client 60s', '    timeout server 60s', '    timeout check 5s',
             '    retries 1', '    option redispatch', '    default-server inter 2s fall 31 rise 31',
             'listen stats', f"    bind 127.0.0.1:{config.get('statsPort', 19900)}", '    stats enable', '    stats uri /stats']
    for service in config['services']:
        if not service.get('listenPort'):
            continue
        tcp = service['id'] == 'database'
        lines += [f"listen {service['id']}", f"    bind 127.0.0.1:{service['listenPort']}"]
        if service['id'] == 'api':
            proxy = f"hanasand-proxy-{config.get('proxyIndex', 0) + 1}"
            lines += ['    tcp-request connection set-var(sess.correlation) uuid()',
                      '    log-steps accept',
                      f'    log-format "Connect from %ci:%cp to %fi:%fp (api/HTTP) correlation=%[var(sess.correlation)] proxy={proxy}"',
                      f'    http-request set-header x-hanasand-proxy-connection "%[var(sess.correlation)]|{proxy}|%ci|%cp|%fi|%fp|api"']
        if tcp:
            lines += ['    mode tcp', '    option pgsql-check user hanasand_replica', '    timeout client 1h', '    timeout server 1h']
        else:
            lines += ['    option httpchk', '    http-check expect status 200']
        for index, instance in enumerate(service['instances']):
            if not instance.get('address'):
                continue
            # Standby sites can expose a compatibility readiness route while the
            # primary uses the recovery route. Keep the check attached to the
            # instance so failover does not mark a healthy standby unavailable.
            if not tcp:
                check_path = instance.get('checkPath', service.get('checkPath', '/ready'))
                lines.append(f"    http-check send meth GET uri {check_path} ver HTTP/1.1 hdr Host {instance.get('host', service.get('host', 'api.hanasand.com'))}")
            suffix = ' backup' if index else ''
            if instance.get('checkPort'):
                check_port = int(instance['checkPort'])
                if not 1 <= check_port <= 65535: raise ValueError('Invalid health check port')
                suffix += f' port {check_port}'
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
