#!/usr/bin/env python3
"""Independent recovery status and transition alerts; never promotes a database."""
import dns
import csv
import socket
import struct
import shutil
from concurrent.futures import ThreadPoolExecutor
import io
import json
import os
import pathlib
import subprocess
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(os.environ.get('RESILIENCE_ROOT', '/home/ubuntu/hanasand-resilience'))
CONFIG = ROOT / 'config.json'
STATE = ROOT / 'state.json'
LOCK = threading.Lock()


def atomic_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2))
    temporary.replace(path)


def read_json(path, fallback):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return fallback


def request(url, timeout=4):
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read()


def choose_service(service, observations):
    # Configuration order is Inspur preferred, Inspur alternate, then OVHcloud.
    selected = next((instance for instance in service['instances'] if observations.get(instance['id'], False)), None)
    return {**service, 'activeInstance': selected['id'] if selected else None,
            'activeSite': selected['site'] if selected else None,
            'activeEndpoint': selected['endpoint'] if selected else None,
            'status': 'up' if selected and selected == service['instances'][0] else 'failed_over' if selected else 'unavailable',
            'instances': [{**instance, 'healthy': bool(observations.get(instance['id']))} for instance in service['instances']]}


def transition_embed(previous, current, services, drill=False):
    restored = current['status'] == 'up'
    remaining = [service['name'] for service in services if service['status'] != 'up']
    title = f"{'[TEST] ' if drill else ''}{'Failback' if restored else 'Failover'}: {current['name']}"
    description = (f"{previous.get('activeInstance') or 'unavailable'} → {current.get('activeInstance') or 'unavailable'}. "
                   f"{'Preferred Inspur instance restored.' if restored else 'Preferred instance unavailable; recovery priority applied.'}")
    return {'title': title, 'description': description, 'color': 0x00CC66 if restored else 0xFF0000,
            'fields': [{'name': 'Active endpoint', 'value': current.get('activeEndpoint') or 'None'},
                       {'name': 'Still affected', 'value': ', '.join(remaining) or 'All monitored services are back to normal.'}],
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}


def notify(config, embed):
    webhook = pathlib.Path(config['discordWebhookFile']).read_text().strip()
    if not webhook.startswith('https://discord.com/api/webhooks/'):
        raise ValueError('Invalid monitoring webhook configuration')
    payload = json.dumps({'embeds': [embed], 'allowed_mentions': {'parse': []}}).encode()
    req = urllib.request.Request(webhook + '?wait=true', data=payload, headers={'Content-Type': 'application/json', 'User-Agent': 'Hanasand-Resilience/1.0'}, method='POST')
    with urllib.request.urlopen(req, timeout=10) as response:
        body = json.loads(response.read())
        return {'status': 'delivered', 'messageId': body.get('id'), 'at': time.time()}


def database_status(config):
    container = config.get('databaseContainer')
    if not container:
        return {'status': 'unconfigured'}
    try:
        sql = "SELECT json_build_object('replica', pg_is_in_recovery(), 'replayLsn', pg_last_wal_replay_lsn(), 'replayAt', pg_last_xact_replay_timestamp(), 'databaseBytes', pg_database_size(current_database()))"
        result = subprocess.run(['docker', 'exec', container, 'psql', '-U', 'hanasand', '-d', 'hanasand', '-p', str(config.get('databasePort', 5432)), '-Atc', sql], capture_output=True, text=True, timeout=5, check=True)
        return {'status': 'up', **json.loads(result.stdout)}
    except (subprocess.SubprocessError, ValueError):
        return {'status': 'unavailable', 'reason': 'Database status could not be verified; automatic promotion is disabled.'}


def sample(config, previous):
    peer = {}
    if config.get('peerStatusUrl'):
        try:
            peer = json.loads(request(config['peerStatusUrl']))
        except (OSError, ValueError, urllib.error.URLError):
            pass
    if time.time() - peer.get('sampledAt', 0) > 60:
        peer = {}
    peer_instances = {instance['id']: instance['healthy'] for service in peer.get('services', []) for instance in service.get('instances', [])}
    proxy_status = {}
    if config.get('statsUrl'):
        try:
            rows = csv.DictReader(io.StringIO(request(config['statsUrl']).decode().lstrip('# ')))
            proxy_status = {row['svname']: row['status'].startswith('UP') for row in rows if row.get('svname') not in ('BACKEND', 'FRONTEND')}
        except (OSError, ValueError, urllib.error.URLError):
            pass
    def check(instance):
        health = instance['health']
        if health.startswith('peer:'):
            return instance['id'], bool(peer_instances.get(health[5:]))
        if instance['id'] in proxy_status:
            return instance['id'], proxy_status[instance['id']]
        try:
            if health.startswith('postgres://'):
                host, port = health[11:].rsplit(':', 1)
                with socket.create_connection((host, int(port)), timeout=3) as connection:
                    connection.sendall(struct.pack('!II', 8, 80877103))
                    return instance['id'], connection.recv(1) in (b'S', b'N')
            return instance['id'], bool(request(health))
        except (OSError, urllib.error.URLError, TimeoutError):
            return instance['id'], False
    instances = {instance['id']: instance for service in config['services'] for instance in service['instances']}
    with ThreadPoolExecutor(max_workers=8) as executor:
        observations = dict(executor.map(check, instances.values()))
    counters = previous.get('healthCounters', {})
    for key, healthy in observations.items():
        old = counters.get(key, {'healthy': healthy, 'count': 0, 'observed': healthy})
        count = old['count'] + 1 if old['observed'] == healthy else 1
        stable = healthy if count >= (config.get('rise', 6) if healthy else config.get('fall', 3)) else old['healthy']
        counters[key] = {'healthy': stable, 'count': count, 'observed': healthy}
    services = [choose_service(service, {key: value['healthy'] for key, value in counters.items()}) for service in config['services']]
    database = database_status(config)
    database_service = next((service for service in services if service['id'] == 'database'), None)
    read_only = bool(database_service and database_service.get('activeInstance') != 'inspur-db-primary')
    disk = shutil.disk_usage(ROOT)
    affected = [service['name'] for service in services if service['status'] != 'up']
    return {'sampledAt': time.time(), 'updatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'site': config['site'],
            'mode': 'read_only_recovery' if read_only else 'service_failover' if affected else 'normal',
            'readOnly': read_only, 'services': services, 'database': database, 'affected': affected,
            'compute': {'diskTotalBytes': disk.total, 'diskFreeBytes': disk.free, 'loadAverage': os.getloadavg(), 'standbyMemoryBudgetMb': config.get('memoryBudgetMb')},
            'healthCounters': counters, 'events': previous.get('events', [])[-99:],
            'notifications': previous.get('notifications', [])[-99:],
            'safety': {'automaticDatabasePromotion': False, 'fencingRequired': True,
                       'aiOnOvhcloud': False, 'existingOvhcloudServicesPreserved': True},
            'backups': read_json(ROOT / 'backup-status.json', {'status': 'not_verified', 'restoreRequired': False})}


def public_state(state):
    result = {key: value for key, value in state.items() if key not in ('healthCounters', 'pendingNotifications')}
    if time.time() - state.get('sampledAt', 0) > 60:
        result.update(mode='unknown', readOnly=True, stale=True)
    return result


def run_monitor():
    while True:
        started = time.monotonic()
        config = read_json(CONFIG, {})
        if not config:
            time.sleep(5)
            continue
        previous = read_json(STATE, {})
        try:
            current = sample(config, previous)
            try:
                current['dns'], dns_events = dns.reconcile(config.get('dns'), current, previous.get('dns', {}))
                current.setdefault('pendingNotifications', []).extend(dns_events)
            except Exception as error:
                current['dns'] = {**previous.get('dns', {}), 'status': 'error', 'reason': type(error).__name__}
            old_services = {service['id']: service for service in previous.get('services', [])}
            for service in current['services']:
                old = old_services.get(service['id'])
                if not old or old.get('activeInstance') == service.get('activeInstance'):
                    continue
                embed = transition_embed(old, service, current['services'])
                current['events'].append({'at': current['updatedAt'], 'service': service['id'], 'from': old.get('activeInstance'), 'to': service.get('activeInstance'), 'summary': embed['description']})
                current.setdefault('pendingNotifications', []).append(embed)
            pending = previous.get('pendingNotifications', []) + current.get('pendingNotifications', [])
            current['pendingNotifications'] = []
            if not config.get('notify', True):
                pending = []
            for embed in pending:
                try:
                    delivery = notify(config, embed)
                    current['notifications'].append({**delivery, 'title': embed['title'], 'color': embed['color']})
                except (OSError, ValueError, urllib.error.URLError):
                    current['pendingNotifications'].append(embed)
            with LOCK:
                atomic_json(STATE, current)
        except Exception as error:
            # Do not log webhook URLs, response bodies or credentials.
            print(f'Resilience sample failed: {type(error).__name__}', flush=True)
        time.sleep(max(1, config.get('interval', 5) - (time.monotonic() - started)))


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] not in ('/status', '/health'):
            self.send_error(404)
            return
        with LOCK:
            state = public_state(read_json(STATE, {'mode': 'unknown', 'readOnly': True, 'services': []}))
        body = json.dumps(state).encode()
        self.send_response(200 if state.get('updatedAt') and not state.get('stale') else 503)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    threading.Thread(target=run_monitor, daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('RESILIENCE_PORT', '19901'))), Handler).serve_forever()
