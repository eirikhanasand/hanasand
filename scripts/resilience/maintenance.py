#!/usr/bin/env python3
"""Maintenance for the two local routers; does not stop application containers."""
import json
import pathlib
import socket
import sys
root, service, mode, *instances = sys.argv[1:]
assert mode in ('maint','ready')
config=json.loads((pathlib.Path(root)/'config.json').read_text())
allowed={item['id'] for entry in config['services'] if entry['id']==service for item in entry['instances']}
assert instances and all(instance in allowed for instance in instances)
maintained=set(config.get('maintenanceInstances', []))
maintained = maintained.union(instances) if mode=='maint' else maintained.difference(instances)
config['maintenanceInstances']=sorted(maintained)
(pathlib.Path(root)/'config.json').write_text(json.dumps(config,indent=2))
for port in (19909,19910):
    for instance in instances:
        with socket.create_connection(('127.0.0.1',port),timeout=3) as connection:
            connection.sendall(f'set server {service}/{instance} state {mode}\n'.encode())
            connection.shutdown(socket.SHUT_WR)
            result=connection.recv(8192).decode().strip()
            if result: raise RuntimeError(result)
print(json.dumps(dict(service=service, instances=instances, state=mode, routers=2)))
