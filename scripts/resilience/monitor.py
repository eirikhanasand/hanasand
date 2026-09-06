#!/usr/bin/env python3
"""Independent recovery status and transition alerts; never promotes a database."""
import dns
import uuid
import datetime
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
STATE = ROOT / 'status' / 'state.json'
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
        sql = "SELECT json_build_object('replica', pg_is_in_recovery(), 'replayLsn', pg_last_wal_replay_lsn(), 'replayAt', pg_last_xact_replay_timestamp(), 'databaseBytes', pg_database_size(current_database()), 'receiverStatus', (SELECT status FROM pg_stat_wal_receiver LIMIT 1))"
        result = subprocess.run(['docker', 'exec', container, 'psql', '-U', 'hanasand', '-d', 'hanasand', '-p', str(config.get('databasePort', 5432)), '-Atc', sql], capture_output=True, text=True, timeout=5, check=True)
        status = {'status': 'up', **json.loads(result.stdout)}
        if config.get('primaryDatabaseContainer'):
            try:
                slots_sql = "SELECT coalesce(json_agg(json_build_object('slot', slot_name, 'walStatus', wal_status, 'active', active, 'lagBytes', pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn))), '[]'::json) FROM pg_replication_slots s LEFT JOIN pg_stat_replication r ON r.pid=s.active_pid WHERE slot_name IN ('hanasand_inspur_standby','hanasand_ovh_standby')"
                slots = subprocess.run(['docker', 'exec', config['primaryDatabaseContainer'], 'psql', '-U', 'hanasand', '-d', 'hanasand', '-Atc', slots_sql], capture_output=True, text=True, timeout=5, check=True)
                status['slots'] = json.loads(slots.stdout)
            except (subprocess.SubprocessError, ValueError): status['sourceStatus'] = 'unavailable'
        return status
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
    for stats_url in config.get('statsUrls', [config.get('statsUrl')]):
        if not stats_url: continue
        try:
            rows = csv.DictReader(io.StringIO(request(stats_url).decode().lstrip('# ')))
            proxy_status = {row['svname']: row['status'].startswith('UP') for row in rows if row.get('svname') not in ('BACKEND', 'FRONTEND')}
            break
        except (OSError, ValueError, urllib.error.URLError):
            pass
    def check(instance):
        health = instance['health']
        if health.startswith('peer:'):
            # OVH reaches both local intelligence instances through one primary-site pool.
            if instance['id'].startswith('inspur-ti-') and proxy_status.get('inspur-ti-1') is False:
                return instance['id'], False
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
    compute = {'diskTotalBytes': disk.total, 'diskFreeBytes': disk.free, 'loadAverage': os.getloadavg(), 'standbyMemoryBudgetMb': config.get('memoryBudgetMb')}
    try:
        memory = dict(line.split(':', 1) for line in pathlib.Path('/proc/meminfo').read_text().splitlines())
        compute['memoryAvailableBytes'] = int(memory['MemAvailable'].split()[0]) * 1024
        compute['memoryTotalBytes'] = int(memory['MemTotal'].split()[0]) * 1024
    except (OSError, KeyError, ValueError): pass
    sites = {config['site']: {'compute': compute, 'database': database, 'fresh': True}}
    other = 'ovhcloud' if config['site'] == 'inspur' else 'inspur'
    sites[other] = {'compute': peer.get('compute'), 'database': peer.get('database'), 'fresh': bool(peer)}
    backup = read_json(ROOT / 'backup-status.json', {'status': 'not_verified', 'restoreRequired': False})
    if config['site'] == 'inspur' and peer.get('backups'): backup = peer['backups']
    source_database = database if config['site'] == 'inspur' else peer.get('database', {})
    local_slot = 'hanasand_inspur_standby' if config['site']=='inspur' else 'hanasand_ovh_standby'
    prior_database = previous.get('database', {})
    if 'slots' in source_database:
        local_proof = next((slot for slot in source_database['slots'] if slot['slot']==local_slot), {})
        eligible = bool(local_proof.get('active') and local_proof.get('lagBytes') is not None and local_proof['lagBytes'] <= 1048576)
        database['lastVerifiedAt'] = time.time() if eligible else prior_database.get('lastVerifiedAt', 0)
    else:
        eligible = bool(not observations.get('inspur-db-primary') and ((prior_database.get('eligible') and prior_database.get('recoveryContinuity')) or time.time()-prior_database.get('lastVerifiedAt',0) <= 60))
        database['lastVerifiedAt'] = prior_database.get('lastVerifiedAt', 0)
        database['recoveryContinuity'] = eligible
    database['eligible'] = bool(eligible and database.get('status')=='up' and database.get('replica') is True)
    eligibility = {'inspur-db-standby': database['eligible'] if config['site']=='inspur' else bool(peer.get('database',{}).get('eligible')),
                   'ovh-db': database['eligible'] if config['site']=='ovhcloud' else bool(peer.get('database',{}).get('eligible'))}
    if config.get('enforceReplicaReadiness'):
        for instance, allowed in eligibility.items():
            mode = 'ready' if allowed and instance not in config.get('maintenanceInstances', []) else 'maint'
            for port in (19909,19910):
                try:
                    with socket.create_connection(('127.0.0.1',port),timeout=1) as connection:
                        connection.sendall(f'set server database/{instance} state {mode}\n'.encode())
                        connection.shutdown(socket.SHUT_WR)
                        connection.recv(4096)
                except OSError: pass
    if 'slots' in source_database:
        slots = {slot['slot']: slot for slot in source_database['slots']}
        required = {name for name, slot in slots.items() if slot['walStatus'] == 'lost'}
        for name in previous.get('backups', {}).get('restoreSlots', []):
            slot = slots.get(name, {})
            if not slot.get('active') or slot.get('lagBytes') is None or slot['lagBytes'] > 1048576: required.add(name)
        if required: backup = {**backup, 'status': 'restore_required', 'restoreRequired': True, 'restoreSlots': sorted(required), 'reason': 'Required replication WAL was lost. Reseed the affected replica from a verified source before treating it as recovered.'}
    if config.get('requireBackups') and not backup.get('restoreRequired'):

        try:
            age = time.time() - datetime.datetime.fromisoformat(backup.get('receivedAt', '').replace('Z', '+00:00')).timestamp()
        except ValueError: age = float('inf')
        if age > 36 * 3600: backup = {**backup, 'status': 'backup_failed', 'reason': 'No verified off-site backup has arrived within 36 hours.'}

    return {'sampledAt': time.time(), 'updatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'site': config['site'],
            'mode': 'read_only_recovery' if read_only else 'service_failover' if affected else 'normal',
            'readOnly': read_only, 'services': services, 'database': database, 'affected': affected,
            'compute': compute, 'sites': sites, 'replicaEligibility': eligibility,
            'healthCounters': counters, 'events': previous.get('events', [])[-99:],
            'notifications': previous.get('notifications', [])[-99:],
            'safety': {'automaticDatabasePromotion': False, 'fencingRequired': True,
                       'aiOnOvhcloud': False, 'existingOvhcloudServicesPreserved': True},
            'backups': backup}


def public_state(state):
    result = {key: value for key, value in state.items() if key not in ('healthCounters', 'pendingNotifications')}
    if time.time() - state.get('sampledAt', 0) > 60:
        result.update(mode='unknown', readOnly=True, stale=True)
    return result


def run_monitor():
    dns_worker = ThreadPoolExecutor(max_workers=1)
    dns_job = None
    while True:
        started = time.monotonic()
        config = read_json(CONFIG, {})
        if not config:
            time.sleep(5)
            continue
        previous = read_json(STATE, {})
        try:
            current = sample(config, previous)
            current['dns'] = previous.get('dns', {})
            if dns_job is not None and dns_job.done():
                try:
                    current['dns'], dns_events = dns_job.result()
                    current.setdefault('pendingNotifications', []).extend(dns_events)
                except Exception as error:
                    current['dns'] = {**current['dns'], 'status': 'error', 'reason': type(error).__name__}
                dns_job = None
            if dns_job is None:
                dns_job = dns_worker.submit(dns.reconcile, config.get('dns'), current, current['dns'])
            old_services = {service['id']: service for service in previous.get('services', [])}
            for service in current['services']:
                old = old_services.get(service['id'])
                if not old or old.get('activeInstance') == service.get('activeInstance'):
                    continue
                embed = transition_embed(old, service, current['services'], config.get('drill', False))
                current['events'].append({'at': current['updatedAt'], 'service': service['id'], 'from': old.get('activeInstance'), 'to': service.get('activeInstance'), 'summary': embed['description']})
                current.setdefault('pendingNotifications', []).append(embed)
            old_backup = previous.get('backups', {})
            backup = current['backups']
            failed_backup = backup.get('restoreRequired') or backup.get('status') in ('backup_failed', 'restore_required')
            if old_backup and (old_backup.get('status'), old_backup.get('restoreRequired')) != (backup.get('status'), backup.get('restoreRequired')):
                if failed_backup or backup.get('status') == 'verified':
                    current.setdefault('pendingNotifications', []).append({
                        'title': ('[TEST] ' if config.get('drill') else '') + ('Database restore required' if backup.get('restoreRequired') else 'Backup verification failed' if failed_backup else 'Database backup recovery verified'),
                        'description': backup.get('reason') or ('Operator action is required; no database will be promoted automatically.' if failed_backup else 'A separately stored backup passed verification and an isolated restore check.'),
                        'color': 0xFF0000 if failed_backup else 0x00CC66,
                        'fields': [{'name': 'Still affected', 'value': ', '.join(current['affected']) or 'All monitored services are back to normal.'}]})
            with LOCK:
                # Network delivery cannot delay health sampling or overwrite a newer outbox update.
                latest = read_json(STATE, {})
                current['notifications'] = latest.get('notifications', [])[-99:]
                current['notificationHealth'] = latest.get('notificationHealth', 'idle')
                new_events = [{'id': uuid.uuid4().hex, 'embed': embed} for embed in current.get('pendingNotifications', [])]
                current['pendingNotifications'] = latest.get('pendingNotifications', []) + new_events if config.get('notify', True) else []
                atomic_json(STATE, current)
        except Exception as error:
            # Do not log webhook URLs, response bodies or credentials.
            print(f'Resilience sample failed: {type(error).__name__}', flush=True)
        time.sleep(max(1, config.get('interval', 5) - (time.monotonic() - started)))


def run_notifications():
    while True:
        config = read_json(CONFIG, {})
        with LOCK:
            pending = read_json(STATE, {}).get('pendingNotifications', [])
        if not pending or not config.get('notify', True):
            time.sleep(2)
            continue
        event = pending[0]
        try:
            delivery = notify(config, event['embed'])
            with LOCK:
                state = read_json(STATE, {})
                state['pendingNotifications'] = [item for item in state.get('pendingNotifications', []) if item['id'] != event['id']]
                state.setdefault('notifications', []).append({**delivery, 'title': event['embed']['title'], 'color': event['embed']['color']})
                state['notificationHealth'] = 'delivered'
                atomic_json(STATE, state)
        except (OSError, ValueError, urllib.error.URLError):
            with LOCK:
                state = read_json(STATE, {})
                state['notificationHealth'] = 'delivery_retry_pending'
                atomic_json(STATE, state)
            time.sleep(15)


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
    STATE.parent.mkdir(parents=True, exist_ok=True)
    threading.Thread(target=run_monitor, daemon=True).start()
    threading.Thread(target=run_notifications, daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('RESILIENCE_PORT', '19901'))), Handler).serve_forever()
