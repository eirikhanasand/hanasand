"""Stable container names, independent of deployment port numbers."""
import sys

PORTS = {
    'api': (20802, 20803, 8082, 8083),
    'frontend': (3200, 3300, 3000, 3100),
    'auth': (8183, 8184, 8181, 8182),
}


def pair_name(kind, port):
    return f'hanasand-{kind}-{PORTS[kind].index(int(port)) + 1}'


def simple_name(name):
    if not name.startswith('hanasand-recovery-'):
        return name
    for kind, ports in PORTS.items():
        for port in ports:
            if name == f'hanasand-recovery-{kind}-{port}':
                return pair_name(kind, port)
    fixed = {'db-local': 'db-standby', 'monitor': 'health-monitor',
             'proxy-0': 'proxy-1', 'proxy-1': 'proxy-2'}
    suffix = name.removeprefix('hanasand-recovery-')
    if suffix in fixed:
        return 'hanasand-' + fixed[suffix]
    if suffix in ('api', 'auth', 'frontend', 'db', 'ti', 'ti-local', 'tunnel',
                  'tunnel-monitor', 'tunnel-web', 'tunnel-intelligence', 'tunnel-database'):
        return 'hanasand-' + suffix
    return name


if __name__ == '__main__':
    print(pair_name(*sys.argv[1:]))
