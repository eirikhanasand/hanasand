import importlib.util
import pathlib

root = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location('monitor', root / 'monitor.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)

# Lost WAL stays lost through a failed sample; only caught-up replication clears it.
lost_slot = 'hanasand_ovh_standby'
assert monitor.restore_slots({'slots': [{'slot': lost_slot, 'walStatus': 'lost'}]}, []) == [lost_slot]
assert monitor.restore_slots({}, [lost_slot]) == [lost_slot]
assert monitor.restore_slots({'slots': []}, [lost_slot]) == [lost_slot]
assert monitor.restore_slots({'slots': [{'slot': lost_slot, 'walStatus': 'reserved', 'active': True, 'lagBytes': 2000000}]}, [lost_slot]) == [lost_slot]
assert monitor.restore_slots({'slots': [{'slot': lost_slot, 'walStatus': 'reserved', 'active': True, 'lagBytes': 0}]}, [lost_slot]) == []
# Lag timing survives restarts, clears on catch-up, and never changes eligibility inputs.
lag_slot = {'slot': 'hanasand_inspur_standby', 'walStatus': 'reserved', 'active': True, 'lagBytes': 2000000}
lag_state = {'slots': [dict(lag_slot)]}
monitor.track_replica_lag(lag_state, {}, 100)
assert lag_state['slots'][0]['lagSince'] == 100
later = {'slots': [dict(lag_slot)]}
monitor.track_replica_lag(later, lag_state, 170)
assert later['slots'][0]['lagSince'] == 100 and later['slots'][0]['lagBytes'] == 2000000
caught_up = {'slots': [{**lag_slot, 'lagBytes': 1048576}]}
monitor.track_replica_lag(caught_up, later, 180)
assert caught_up['slots'][0]['lagSince'] is None
monitor.track_replica_lag(later, caught_up, 190)
assert later['slots'][0]['lagSince'] == 190
# A failed sample must not overwrite a retained lag timer with a new grace period.
# The source's last timer is retained when no slot observations are available.
missing = {}
monitor.track_replica_lag(missing, later, 200)
assert 'slots' not in missing
returned = {'slots': [dict(lag_slot)]}
monitor.track_replica_lag(returned, missing, 260)
assert returned['slots'][0]['lagSince'] == 190
service = {'id': 'api', 'name': 'API', 'instances': [
    {'id': 'inspur-api-1', 'site': 'inspur', 'endpoint': 'https://api.hanasand.com'},
    {'id': 'inspur-api-2', 'site': 'inspur', 'endpoint': 'https://api.hanasand.com'},
    {'id': 'ovh-api', 'site': 'ovhcloud', 'endpoint': 'https://api.hanasand.com'},
]}
primary = monitor.choose_service(service, {'inspur-api-1': True, 'inspur-api-2': True, 'ovh-api': True})
local = monitor.choose_service(service, {'inspur-api-1': False, 'inspur-api-2': True, 'ovh-api': True})
remote = monitor.choose_service(service, {'inspur-api-1': False, 'inspur-api-2': False, 'ovh-api': True})
assert primary['activeInstance'] == 'inspur-api-1'
assert local['activeInstance'] == 'inspur-api-2'
assert remote['activeSite'] == 'ovhcloud'
assert monitor.transition_embed(primary, local, [local])['color'] == 0xFF0000
restored = monitor.transition_embed(remote, primary, [primary, {'name': 'TI collection', 'status': 'unavailable'}])
partial = monitor.transition_embed(remote, local, [local])
assert partial['color'] == 0x00CC66
assert partial['description'] == 'ovh-api → inspur-api-2. Traffic is back on Inspur through inspur-api-2. inspur-api-1 is still down.'
assert restored['description'].endswith('inspur-api-1 is back online.')
assert monitor.transition_embed(primary, local, [local])['description'].endswith('inspur-api-1 stopped responding. Traffic is now going to inspur-api-2.')
unavailable = monitor.choose_service(service, {})
assert monitor.transition_embed(primary, unavailable, [unavailable])['description'].endswith('None of the instances are responding right now.')
assert monitor.transition_embed(unavailable, local, [local])['description'].endswith('Service is back on inspur-api-2. inspur-api-1 is still down.')
assert restored['color'] == 0x00CC66
assert 'TI collection' in restored['fields'][1]['value']
assert monitor.choose_service(service, {})['status'] == 'unavailable'
print('Recovery priority, unavailable state, red failover and partial green failback checks passed.')

# DNS decision checks are isolated; provider credentials and live records are never used here.
import dns
import time
record = {'id': 1, 'host': 'api', 'type': 'A', 'data': '192.0.2.1', 'ttl': 60, 'checkPath': '/ready'}
config = {'enabled': True, 'domainId': 1, 'primaryIp': '192.0.2.1', 'standbyIp': '192.0.2.2', 'records': [record]}
def fake_api(_config, path, payload=None):
    assert path == '/domains/1/dns/1'
    if payload: record.update(payload)
    return dict(record)
dns.api = fake_api
dns.probe = lambda host, ip, path: ip == config['standbyIp']
state, events = dns.reconcile(config, {'affected': ['API']}, {'api.hanasand.com': {'candidate': 'ovhcloud', 'candidateSince': time.time()-59}})
assert record['data'] == config['primaryIp'] and not events
state, events = dns.reconcile(config, {'affected': ['API']}, {'api.hanasand.com': {'candidate': 'ovhcloud', 'candidateSince': time.time()-61}})
assert record['data'] == config['standbyIp'] and events[0]['color'] == 0xFF0000
dns.probe = lambda host, ip, path: True
state, events = dns.reconcile(config, {'affected': []}, {'api.hanasand.com': {'candidate': 'inspur', 'candidateSince': time.time()-130}})
assert record['data'] == config['primaryIp'] and events[0]['color'] == 0x00CC66
try:
    dns.reconcile({**config, 'records': [{**record, 'host': 'mail'}]}, {}, {})
    raise AssertionError('Unrelated DNS records must be rejected')
except ValueError: pass
print('DNS failover, stable failback and unrelated-record protection checks passed.')

assert monitor.apply_dns_placement([primary], {'api.hanasand.com': {'activeSite': 'ovhcloud'}})[0]['activeInstance'] == 'ovh-api'
assert monitor.apply_dns_placement([primary], {'api.hanasand.com': {'activeSite': 'inspur'}})[0]['activeInstance'] == 'inspur-api-1'

# Public recovery status must not disclose private host capacity.
private = {'sampledAt': monitor.time.time(), 'updatedAt': 'now', 'mode': 'normal', 'readOnly': False, 'services': [], 'compute': {'memoryTotalBytes': 123}, 'sites': {'inspur': {'compute': {'diskFreeBytes': 456}}}, 'replicaEligibility': {'memory': 123}}
public = monitor.public_state(private)
assert not ({'compute', 'sites', 'replicaEligibility'} & public.keys())
assert public['mode'] == 'normal' and private['compute']['memoryTotalBytes'] == 123

assert monitor.public_state(private, include_host=True)['compute'] == private['compute']

# Transport isolation keeps the existing physical replication connection and local priority.
isolated_spec = importlib.util.spec_from_file_location('isolated_tunnels', root / 'isolated-tunnels.py')
isolated = importlib.util.module_from_spec(isolated_spec)
isolated_spec.loader.exec_module(isolated)
fixture = {'site': 'inspur', 'peerStatusUrl': 'http://127.0.0.1:19911/status', 'services': [
    {'id': 'database', 'instances': [
        {'id': 'primary', 'site': 'inspur', 'address': '127.0.0.1:8503', 'health': 'postgres://127.0.0.1:8503'},
        {'id': 'local', 'site': 'inspur', 'address': '127.0.0.1:18502'},
        {'id': 'remote', 'site': 'ovhcloud', 'address': '127.0.0.1:18506', 'health': 'postgres://127.0.0.1:18506'}]}]}
migrated = isolated.migrate(fixture)
assert migrated['services'][0]['instances'][:2] == fixture['services'][0]['instances'][:2]
assert migrated['services'][0]['instances'][2]['address'] == '127.0.0.1:28506'
assert migrated['services'][0]['instances'][2]['health'] == 'postgres://127.0.0.1:28506'
assert fixture['services'][0]['instances'][2]['address'] == '127.0.0.1:18506'
assert isolated.migrate(migrated) == migrated
assert migrated['peerStatusUrl'] == 'http://127.0.0.1:29911/status'
remote_fixture = {'site': 'ovhcloud', 'services': [{'id': 'intelligence', 'instances': [
    {'id': 'primary', 'site': 'inspur', 'address': '127.0.0.1:18097', 'health': 'peer:inspur-ti-1'},
    {'id': 'local', 'site': 'ovhcloud', 'address': '127.0.0.1:19097'}]}]}
remote_migrated = isolated.migrate(remote_fixture)
assert remote_migrated['services'][0]['instances'][0]['address'] == '127.0.0.1:28097'
assert remote_migrated['services'][0]['instances'][0]['health'] == 'peer:inspur-ti-1'
assert remote_migrated['services'][0]['instances'][1] == remote_fixture['services'][0]['instances'][1]
assert set(isolated.GROUPS) == {'ai', 'replication', 'database', 'intelligence', 'web', 'support', 'monitor'}
for forwards in isolated.GROUPS.values():
    assert all(value.startswith('127.0.0.1:') and ':127.0.0.1:' in value for value in forwards[1::2])
# Add compressed replication without restarting existing tunnels or mixing bulk WAL with queries.
from types import SimpleNamespace
from unittest.mock import patch
started = []
def tunnel_command(command, **_kwargs):
    if command[:2] == ['docker', 'inspect']:
        if command[-1] == 'hanasand-tunnel': return SimpleNamespace(returncode=0, stdout='[]')
        return SimpleNamespace(returncode=int(command[-1] == 'hanasand-tunnel-replication'), stdout='true\n')
    if command[:2] == ['docker', 'run']: started.append(command)
    return SimpleNamespace(returncode=0, stdout='')
with patch.object(isolated.subprocess, 'run', side_effect=tunnel_command):
    isolated.start('test-image')
assert len(started) == 1 and started[0][started[0].index('--name') + 1] == 'hanasand-tunnel-replication'
assert '-C' in started[0] and '127.0.0.1:18503:127.0.0.1:8503' in started[0]
assert started[0][started[0].index('--cpus') + 1] == '2'
assert not any(value.startswith('127.0.0.1:28503:') for value in started[0])
import tempfile
with tempfile.TemporaryDirectory() as directory:
    home = pathlib.Path(directory)
    (home / '.ssh').mkdir()
    key = 'restrict,port-forwarding,command="false",' + ','.join(f'permitlisten="127.0.0.1:{port}"' for port in (18503, 28503, 28502, 28097, 29911)) + ' ssh-ed25519 fixture\n'
    authorized = home / '.ssh/authorized_keys'
    authorized.write_text('# untouched\n' + key)
    with patch.object(isolated.pathlib.Path, 'home', return_value=home):
        isolated.authorize()
        isolated.authorize()
    assert authorized.read_text() == '# untouched\n' + 'permitopen="127.0.0.1:19181",permitlisten="127.0.0.1:28080",' + key
legacy = ['-NT', '-i', '/run/key', '-o', 'StrictHostKeyChecking=yes', '-R', '127.0.0.1:18503:127.0.0.1:8503', '-L', '127.0.0.1:19300:127.0.0.1:19300', 'ubuntu@192.99.32.185']
remaining, replication = isolated.replication_commands(legacy)
assert remaining == legacy[:5] + legacy[7:]
assert replication == legacy[:5] + ['-C', *legacy[5:7], legacy[-1]]
assert legacy[5:7] == ['-R', '127.0.0.1:18503:127.0.0.1:8503']
with patch.object(isolated.subprocess, 'check_output', side_effect=[monitor.json.dumps([{'Config': {'Cmd': legacy}}]).encode(), '1\n']), patch.object(isolated.subprocess, 'run') as run:
    try:
        isolated.split_replication()
        raise AssertionError('A running backup must prevent tunnel migration')
    except RuntimeError as error:
        assert 'running database backup' in str(error)
    run.assert_not_called()
metadata = {'Config': {'Cmd': legacy, 'Entrypoint': ['ssh'], 'Env': []}, 'State': {'Running': True},
            'HostConfig': {'NetworkMode': 'host', 'Memory': 134217728, 'NanoCpus': 500000000, 'RestartPolicy': {'Name': 'unless-stopped'}},
            'Mounts': [], 'Image': 'test-image'}
commands = []
def migration_command(command, **_kwargs):
    commands.append(command)
    return SimpleNamespace(returncode=1 if command[:2] == ['docker', 'inspect'] else 0)
failed = monitor.json.dumps([{'State': {'Running': False}, 'RestartCount': 1}]).encode()
with patch.object(isolated.subprocess, 'check_output', side_effect=[monitor.json.dumps([metadata]).encode(), '0\n', failed]), patch.object(isolated.subprocess, 'run', side_effect=migration_command), patch.object(isolated.time, 'sleep'):
    try:
        isolated.split_replication()
        raise AssertionError('A failed tunnel start must restore the original tunnel')
    except RuntimeError as error:
        assert 'did not stay running' in str(error)
assert commands[-2:] == [['docker', 'rename', 'hanasand-tunnel-before-compression', 'hanasand-tunnel'], ['docker', 'start', 'hanasand-tunnel']]
assert ['docker', 'rm', '-f', 'hanasand-tunnel-before-compression'] not in commands
launches = {command[command.index('--name') + 1]: command for command in commands if command[:2] == ['docker', 'run']}
assert launches['hanasand-tunnel'][launches['hanasand-tunnel'].index('--cpus') + 1] == '0.5'
assert launches['hanasand-tunnel-replication'][launches['hanasand-tunnel-replication'].index('--cpus') + 1] == '2'
commands.clear()
def missing_image(command, **_kwargs):
    commands.append(command)
    if command[:3] == ['docker', 'image', 'inspect']:
        raise isolated.subprocess.CalledProcessError(1, command)
    return SimpleNamespace(returncode=0)
with patch.object(isolated.subprocess, 'check_output', side_effect=[monitor.json.dumps([metadata]).encode(), '0\n']), patch.object(isolated.subprocess, 'run', side_effect=missing_image):
    try:
        isolated.split_replication()
        raise AssertionError('A missing image must stop migration before any service stops')
    except isolated.subprocess.CalledProcessError:
        pass
assert ['docker', 'stop', 'hanasand-tunnel'] not in commands
observed = monitor.transition_embed(primary, {**remote, 'observedFromSite': 'ovhcloud'}, [remote])
assert observed['description'] == monitor.transition_embed(primary, remote, [remote])['description']
assert 'outage' not in observed['description'].lower()
assert observed['color'] == 0xFF0000
print('Isolated transport migration, idempotence, local preference and plain alert wording checks passed.')

from render_proxy import render
readiness_config = {'services': [{'id': 'intelligence', 'listenPort': 18097, 'checkPath': '/v1/health', 'instances': [
    {'id': 'inspur-ti-1', 'address': '172.20.0.6:8097', 'checkPort': 8098},
    {'id': 'inspur-ti-2', 'address': '127.0.0.1:18102'}]}]}
rendered = render(readiness_config)
assert 'server inspur-ti-1 172.20.0.6:8097 check port 8098' in rendered
assert 'server inspur-ti-2 127.0.0.1:18102 check backup' in rendered
print('Independent readiness port preserves serving ports and backup routing.')

site_specific = {'services': [{'id': 'frontend', 'listenPort': 13000, 'checkPath': '/api/recovery/ready', 'instances': [
    {'id': 'inspur-frontend-1', 'address': '127.0.0.1:3200'},
    {'id': 'ovh-frontend', 'address': '127.0.0.1:29300', 'checkPath': '/api/resilience/ready'}]}]}
site_rendered = render(site_specific)
assert 'uri /api/recovery/ready' in site_rendered and 'uri /api/resilience/ready' in site_rendered
print('Per-site frontend readiness paths are rendered independently.')

assert 'default-server inter 2s fall 31 rise 31' in rendered
old = {'healthy': True, 'observed': True, 'count': 3}
failed = monitor.stable_observation(old, False, 100)
assert monitor.stable_observation(failed, False, 159)['healthy']
assert not monitor.stable_observation(failed, False, 160)['healthy']
recovered = monitor.stable_observation(monitor.stable_observation(failed, False, 160), True, 170)
assert not monitor.stable_observation(recovered, True, 229)['healthy']
assert monitor.stable_observation(recovered, True, 230)['healthy']
brief = monitor.stable_observation(failed, True, 110)
assert monitor.stable_observation(brief, False, 120)['healthy']
# A saved timer survives process restarts and legacy counters start a new timer.
assert not monitor.stable_observation(dict(failed), False, 170)['healthy']
assert monitor.stable_observation(old, False, 1000)['healthy']
print('One-minute routing, fallback probes and DNS grace periods passed.')
