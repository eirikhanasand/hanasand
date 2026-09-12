import importlib.util
import pathlib

root = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location('monitor', root / 'monitor.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)
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
state, events = dns.reconcile(config, {'affected': ['API']}, {'api.hanasand.com': {'candidate': 'ovhcloud', 'candidateSince': time.time()-30}})
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
assert len(isolated.GROUPS) == 4
for forwards in isolated.GROUPS.values():
    assert all(value.startswith('127.0.0.1:') and ':127.0.0.1:' in value for value in forwards[1::2])
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
