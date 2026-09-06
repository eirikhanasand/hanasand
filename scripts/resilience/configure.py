#!/usr/bin/env python3
"""Emit site-local endpoints; ports are private, carried over restricted SSH."""
import json
import pathlib
import sys
site, root = sys.argv[1:]
root = pathlib.Path(root)
services = []
def service(id, name, port, check, ports):
    entries = []
    for index, (instance, remote_site, endpoint_port) in enumerate(ports):
        endpoint = f"{remote_site}:{endpoint_port}"
        health = f"postgres://127.0.0.1:{endpoint_port}" if id == 'database' else f"http://127.0.0.1:{endpoint_port}{check}"
        if site == 'ovhcloud' and remote_site == 'inspur' and id != 'database': health = f"peer:{instance}"
        entry = dict(id=instance, site=remote_site, endpoint=endpoint, health=health)
        if site == 'inspur' or id == 'database' or remote_site == 'ovhcloud': entry['address'] = f"127.0.0.1:{endpoint_port}"
        entries.append(entry)
    services.append(dict(id=id, name=name, listenPort=port if site == 'inspur' or id == 'database' else None, checkPath=check, instances=entries))
service('frontend', 'Frontend', 13000, '/', [('inspur-frontend-1','inspur',3000),('inspur-frontend-2','inspur',3100),('ovh-frontend','ovhcloud',19300)])
service('api', 'API', 18080, '/ready', [('inspur-api-1','inspur',8082),('inspur-api-2','inspur',8083),('ovh-api','ovhcloud',19080)])
service('auth', 'Authentication', 18090, '/ready', [('inspur-auth-1','inspur',8183),('inspur-auth-2','inspur',8184),('ovh-auth','ovhcloud',19090)])
service('intelligence', 'Threat intelligence queries', 18097, '/v1/health', [('inspur-ti-1','inspur',8097),('inspur-ti-2','inspur',18099),('ovh-ti','ovhcloud',19097)])
service('database', 'Database', 18504, '', [('inspur-db-primary','inspur',8503 if site == 'inspur' else 18503),('inspur-db-standby','inspur',18502),('ovh-db','ovhcloud',18506)])
config = dict(site=site, services=services, notify=site=='ovhcloud', interval=5, fall=3, rise=6, statsUrl='http://127.0.0.1:19900/stats;csv',
              peerStatusUrl='http://127.0.0.1:19911/status' if site=='ovhcloud' else None,
              databaseContainer='hanasand-resilience-db-local' if site=='inspur' else 'hanasand-resilience-db', databasePort=18502 if site=='inspur' else 18506,
              memoryBudgetMb=12288 if site=='ovhcloud' else 16384, discordWebhookFile=str(root/'secrets/discord-webhook.txt'))
# Never replace a live configuration: deployment may have changed active slots.
root.mkdir(parents=True, exist_ok=True)
with (root/'config.json').open('x') as file: json.dump(config,file,indent=2)
