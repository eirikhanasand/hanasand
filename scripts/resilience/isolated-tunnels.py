#!/usr/bin/env python3
"""Isolate interactive recovery traffic from the existing replication tunnel.

Start on Inspur, verify all new listeners, then configure each site's routing.
The legacy tunnel and its PostgreSQL replication sessions are never stopped.
"""
import argparse
import copy
import json
import pathlib
import subprocess

GROUPS = {
    'database': ['-R', '127.0.0.1:28503:127.0.0.1:8503', '-R', '127.0.0.1:28502:127.0.0.1:18502', '-L', '127.0.0.1:28506:127.0.0.1:18506'],
    'intelligence': ['-R', '127.0.0.1:28097:127.0.0.1:18097', '-L', '127.0.0.1:29097:127.0.0.1:19097'],
    'web': ['-L', '127.0.0.1:29300:127.0.0.1:19300', '-L', '127.0.0.1:29080:127.0.0.1:19080', '-L', '127.0.0.1:29090:127.0.0.1:19090'],
    'monitor': ['-R', '127.0.0.1:29911:127.0.0.1:19901', '-L', '127.0.0.1:29911:127.0.0.1:19901'],
}


def migrate(config):
    result = copy.deepcopy(config)
    ports = ({19300: 29300, 19080: 29080, 19090: 29090, 19097: 29097, 18506: 28506}
             if result['site'] == 'inspur' else {18097: 28097, 18503: 28503, 18502: 28502})
    for service in result['services']:
        for instance in service['instances']:
            if instance['site'] == result['site']:
                continue
            for field in ('address', 'health'):
                value = instance.get(field, '')
                for old, new in ports.items():
                    value = value.replace(f'127.0.0.1:{old}', f'127.0.0.1:{new}')
                if field in instance:
                    instance[field] = value
    if result.get('peerStatusUrl'):
        result['peerStatusUrl'] = result['peerStatusUrl'].replace(':19911/', ':29911/')
    return result


def authorize():
    path = pathlib.Path.home() / '.ssh' / 'authorized_keys'
    original = path.read_text()
    lines = original.splitlines(keepends=True)
    matching = [index for index, line in enumerate(lines) if 'permitlisten="127.0.0.1:18503"' in line]
    if len(matching) != 1:
        raise RuntimeError('Expected exactly one existing restricted replication tunnel key')
    index = matching[0]
    if not all(option in lines[index] for option in ('restrict,', 'port-forwarding,', 'command="false"')):
        raise RuntimeError('Existing tunnel key restrictions do not match the expected policy')
    for port in (28503, 28502, 28097, 29911):
        permission = f'permitlisten="127.0.0.1:{port}"'
        if permission not in lines[index]:
            lines[index] = permission + ',' + lines[index]
    if ''.join(lines) == original:
        return
    backup = path.with_name('authorized_keys.before-isolated-tunnels')
    if not backup.exists():
        backup.write_text(original)
        backup.chmod(0o600)
    temporary = path.with_suffix('.isolated.tmp')
    temporary.write_text(''.join(lines))
    temporary.chmod(0o600)
    temporary.replace(path)


def start(image):
    subprocess.run(["docker", "image", "inspect", image], check=True, stdout=subprocess.DEVNULL)
    for group, forwards in GROUPS.items():
        name = 'hanasand-resilience-tunnel-' + group
        existing = subprocess.run(['docker', 'inspect', '-f', '{{.State.Running}}', name], capture_output=True, text=True)
        if existing.returncode == 0:
            if existing.stdout.strip() != 'true':
                raise RuntimeError(f'{name} exists but is stopped; inspect before replacing it')
            continue
        subprocess.run(['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', 'host', '--memory', '128m', '--cpus', '.5',
                        '-v', '/home/hanasand/resilience-secrets/reverse-tunnel-key:/run/key:ro',
                        '-v', '/home/hanasand/resilience-secrets/ovh-known-hosts:/run/known_hosts:ro',
                        '--entrypoint', 'ssh', image, '-NT', '-i', '/run/key',
                        '-o', 'UserKnownHostsFile=/run/known_hosts', '-o', 'StrictHostKeyChecking=yes',
                        '-o', 'ExitOnForwardFailure=yes', '-o', 'ConnectTimeout=10',
                        '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
                        *forwards, 'ubuntu@192.99.32.185'], check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['authorize', 'start', 'configure'])
    parser.add_argument('--root', type=pathlib.Path)
    parser.add_argument('--image')
    args = parser.parse_args()
    if args.action == 'authorize':
        authorize()
    elif args.action == 'start':
        if not args.image:
            parser.error('--image must identify the built tunnel image')
        start(args.image)
    else:
        if not args.root:
            parser.error('--root is required for configure')
        path = args.root / 'config.json'
        original = path.read_text()
        config = migrate(json.loads(original))
        backup = path.with_name('config.before-isolated-tunnels.json')
        if not backup.exists():
            backup.write_text(original)
            backup.chmod(0o600)
        temporary = path.with_suffix('.isolated.tmp')
        temporary.write_text(json.dumps(config, indent=2) + '\n')
        temporary.chmod(path.stat().st_mode & 0o777)
        temporary.replace(path)
