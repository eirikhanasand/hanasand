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
assert restored['color'] == 0x00CC66
assert 'TI collection' in restored['fields'][1]['value']
assert monitor.choose_service(service, {})['status'] == 'unavailable'
print('Recovery priority, unavailable state, red failover and partial green failback checks passed.')
