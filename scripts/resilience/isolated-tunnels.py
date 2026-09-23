#!/usr/bin/env python3
"""Isolate interactive recovery traffic from the existing replication tunnel.

Start on Inspur, verify all new listeners, then configure each site's routing.
Starting leaves the legacy tunnel untouched. The explicit split-replication
action moves its existing replication forward only after backups finish.
"""
import argparse
import copy
import json
import os
import pathlib
import subprocess
import time

GROUPS = {
    'ai': ['-R', '127.0.0.1:28080:127.0.0.1:8080'],
    'replication': ['-R', '127.0.0.1:18503:127.0.0.1:8503'],
    'database': ['-R', '127.0.0.1:28503:127.0.0.1:8503', '-R', '127.0.0.1:28502:127.0.0.1:18502', '-L', '127.0.0.1:28506:127.0.0.1:18506'],
    'intelligence': ['-R', '127.0.0.1:28097:127.0.0.1:18097', '-L', '127.0.0.1:29097:127.0.0.1:19097'],
    'web': ['-L', '127.0.0.1:29300:127.0.0.1:19300', '-L', '127.0.0.1:29080:127.0.0.1:19080', '-L', '127.0.0.1:29090:127.0.0.1:19090'],
    'support': ['-L', '127.0.0.1:29181:127.0.0.1:19181'],
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
    for port in (28503, 28502, 28097, 29911, 28080):
        permission = f'permitlisten="127.0.0.1:{port}"'
        if permission not in lines[index]:
            lines[index] = permission + ',' + lines[index]
    permission = 'permitopen="127.0.0.1:19181"'
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


def start(image, group=None):
    groups = GROUPS if group is None else {group: GROUPS[group]}
    subprocess.run(["docker", "image", "inspect", image], check=True, stdout=subprocess.DEVNULL)
    for group, forwards in groups.items():
        name = 'hanasand-tunnel-' + group
        existing = subprocess.run(['docker', 'inspect', '-f', '{{.State.Running}}', name], capture_output=True, text=True)
        if existing.returncode == 0:
            if existing.stdout.strip() != 'true':
                raise RuntimeError(f'{name} exists but is stopped; inspect before replacing it')
            continue
        if group == 'replication':
            legacy = subprocess.run(['docker', 'inspect', '-f', '{{json .Config.Cmd}}', 'hanasand-tunnel'], capture_output=True, text=True)
            if legacy.returncode == 0 and GROUPS['replication'][1] in json.loads(legacy.stdout):
                print('Replication still uses the legacy tunnel. Finish any backup before split-replication.')
                continue
        subprocess.run(['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', 'host', '--memory', '128m', '--cpus', '2' if group == 'replication' else '.5',
                        '-v', '/home/hanasand/resilience-secrets/reverse-tunnel-key:/run/key:ro',
                        '-v', '/home/hanasand/resilience-secrets/ovh-known-hosts:/run/known_hosts:ro',
                        '--entrypoint', 'ssh', image, '-NT',
                        *(['-C'] if group == 'replication' else []), '-i', '/run/key',
                        '-o', 'UserKnownHostsFile=/run/known_hosts', '-o', 'StrictHostKeyChecking=yes',
                        '-o', 'ExitOnForwardFailure=yes', '-o', 'ConnectTimeout=10',
                        '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
                        *forwards, 'ubuntu@192.99.32.185'], check=True)


def replication_commands(command):
    forward = GROUPS['replication'][1]
    index = command.index(forward)
    if index < 1 or command[index - 1] != '-R':
        raise RuntimeError('Expected the existing loopback replication forward')
    first_forward = min(i for i, value in enumerate(command) if value in ('-R', '-L'))
    return command[:index - 1] + command[index + 1:], command[:first_forward] + ['-C', '-R', forward, command[-1]]


def split_replication(image=None):
    name, replica, saved = 'hanasand-tunnel', 'hanasand-tunnel-replication', 'hanasand-tunnel-before-compression'
    old = json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]
    if GROUPS['replication'][1] not in old['Config']['Cmd']:
        running = subprocess.check_output(['docker', 'inspect', '-f', '{{.State.Running}}', replica], text=True).strip()
        if running != 'true': raise RuntimeError('The separate replication tunnel is not running')
        return
    # A disconnected pg_basebackup can discard its unfinished copy. Never interrupt it.
    backups = subprocess.check_output(['docker', 'exec', 'hanasand_database', 'psql', '-U', 'hanasand', '-d', 'hanasand', '-Atc',
                                      "SELECT count(*) FROM pg_stat_replication WHERE state='backup'"], text=True).strip()
    if backups != '0': raise RuntimeError('Finish the running database backup before splitting its tunnel')
    legacy_command, replica_command = replication_commands(old['Config']['Cmd'])
    if not old['State']['Running'] or old['HostConfig']['NetworkMode'] != 'host' or old['Config']['Entrypoint'] != ['ssh']:
        raise RuntimeError('Unexpected legacy tunnel configuration')
    image = image or old['Image']
    subprocess.run(['docker', 'image', 'inspect', image], check=True, stdout=subprocess.DEVNULL)
    for target in (replica, saved):
        if subprocess.run(['docker', 'inspect', target], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            raise RuntimeError(f'{target} already exists; inspect it before continuing')
    environment = dict(value.split('=', 1) for value in old['Config']['Env'])
    def launch(target, command):
        # Compression must keep up with WAL; retain the legacy connection's limit.
        cpus = 2 if target == replica else old['HostConfig']['NanoCpus'] / 1e9
        args = ['docker', 'run', '-d', '--name', target, '--restart', old['HostConfig']['RestartPolicy']['Name'], '--network', 'host',
                '--memory', str(old['HostConfig']['Memory']), '--cpus', str(cpus)]
        for mount in old['Mounts']:
            if mount['Type'] != 'bind': raise RuntimeError('Unexpected tunnel mount')
            args += ['-v', mount['Source'] + ':' + mount['Destination'] + ('' if mount['RW'] else ':ro')]
        for key in environment: args += ['-e', key]
        subprocess.run([*args, '--entrypoint', 'ssh', image, *command], env={**os.environ, **environment}, check=True)
    subprocess.run(['docker', 'stop', name], check=True)
    try:
        subprocess.run(['docker', 'rename', name, saved], check=True)
    except Exception:
        subprocess.run(['docker', 'start', name], check=True)
        raise
    try:
        launch(name, legacy_command)
        launch(replica, replica_command)
        time.sleep(3)
        for target in (name, replica):
            status = json.loads(subprocess.check_output(['docker', 'inspect', target]))[0]
            if not status['State']['Running'] or status['RestartCount']:
                raise RuntimeError(f'{target} did not stay running')
    except Exception:
        for target in (name, replica): subprocess.run(['docker', 'rm', '-f', target], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(['docker', 'rename', saved, name], check=True)
        subprocess.run(['docker', 'start', name], check=True)
        raise
    print('Replication uses the same port and key on a separate compressed connection. Verify replica catch-up.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['authorize', 'start', 'configure', 'split-replication'])
    parser.add_argument('--root', type=pathlib.Path)
    parser.add_argument('--image')
    parser.add_argument('--group', choices=GROUPS, help='Start only this private tunnel')
    args = parser.parse_args()
    if args.action == 'authorize':
        authorize()
    elif args.action == 'split-replication':
        split_replication(args.image)
    elif args.action == 'start':
        if not args.image:
            parser.error('--image must identify the built tunnel image')
        start(args.image, args.group)
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
