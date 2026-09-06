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
assert monitor.transition_embed(remote, local, [local])['color'] == 0x00CC66
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
