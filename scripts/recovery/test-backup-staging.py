"""Check backup staging, publication order and cleanup without production mounts."""
import json
import os
import pathlib
import shlex
import subprocess
import sys
import tempfile

source = pathlib.Path(__file__).with_name('backup.sh').read_text()
with tempfile.TemporaryDirectory() as directory:
    base = pathlib.Path(directory)
    binaries = base / 'bin'
    binaries.mkdir()
    mock = f'''#!{sys.executable}
import json, os, pathlib, shutil, sys
command, args = pathlib.Path(sys.argv[0]).name, sys.argv[1:]
with open(os.environ['MOCK_LOG'], 'a') as log: log.write(json.dumps([command, *args]) + '\\n')
failure = os.environ.get('MOCK_FAIL')
volume = pathlib.Path(os.environ['MOCK_VOLUME'])
if command == 'date': print('20260923T090000Z')
elif command == 'df': print('Filesystem 1024-blocks Used Available Capacity Mounted\\nfixture 999999999 0 ' + os.environ.get('MOCK_DISK_KIB', '1000000') + ' 1% /')
elif command == 'awk':
    if args[-1] == '/proc/meminfo': print(os.environ.get('MOCK_MEMORY_KIB', '900000000'))
    else: print(sys.stdin.read().splitlines()[1].split()[3])
elif command == 'docker' and args[:2] == ['volume', 'inspect']:
    sys.exit(0 if volume.exists() or os.environ.get('MOCK_EXISTING_VOLUME') else 1)
elif command == 'docker' and args[:2] == ['volume', 'create']:
    if failure == 'volume_create': sys.exit(47)
    volume.mkdir()
elif command == 'docker' and args[:2] == ['volume', 'rm']:
    if failure == 'cleanup': sys.exit(47)
    shutil.rmtree(volume)
elif command == 'docker' and args[0] == 'run':
    if args[-2:] == ['sleep', 'infinity']:
        if failure == 'holder': sys.exit(47)
    elif 'pg_basebackup' in args:
        mounted = args[args.index('-v') + 1].split(':')[0]
        stage = pathlib.Path(mounted) if mounted.startswith('/') else volume
        for name in ('base.tar.gz', 'pg_wal.tar.gz', 'backup_manifest'): (stage / name).write_text(name)
        if failure == 'dump': sys.exit(47)
    elif 'tar -cf -' in args[-1]:
        if failure == 'upload': sys.exit(47)
'''
    for name in ('docker', 'flock', 'df', 'awk', 'date'):
        command = binaries / name
        command.write_text(mock)
        command.chmod(0o755)

    def check(name, extra=None):
        root = base / name
        root.mkdir()
        backups = root / 'backups with spaces'
        old = backups / '20260901T000000Z' / 'data'
        old.mkdir(parents=True)
        (old / 'verification.json').write_text('{}')
        script = root / 'backup.sh'
        script.write_text(source.replace('root=/home/hanasand/runtime', 'root=' + shlex.quote(str(root)), 1))
        (root / 'verify-backup.sh').write_text('''#!/bin/sh
printf '["verify"]\\n' >> "$MOCK_LOG"
[ "${MOCK_FAIL:-}" != verify ] || exit 47
case "$1" in /*) target=$1;; *) target=$MOCK_VOLUME;; esac
printf '{}' > "$target/verification.json"
''')
        log = root / 'commands.jsonl'
        environment = {**os.environ, 'PATH': str(binaries) + ':' + os.environ['PATH'],
                       'HANASAND_BACKUP_DIR': str(backups), 'MOCK_LOG': str(log), 'MOCK_VOLUME': str(root / 'volume'), **(extra or {})}
        result = subprocess.run(['sh', str(script)], env=environment, capture_output=True, text=True)
        calls = [json.loads(line) for line in log.read_text().splitlines()]
        status = json.loads((root / 'backup-job-status.json').read_text())
        return result, calls, status, old, backups / '20260923T090000Z'

    result, calls, status, old, stage = check('memory')
    assert result.returncode == 0, result.stderr
    assert status['status'] == 'verified' and old.exists() and not stage.exists()
    volume = next(call for call in calls if call[:3] == ['docker', 'volume', 'create'])
    assert 'o=size=128G,nosuid,nodev,noexec,mode=0700' in volume
    assert not any('--privileged' in call or '--pid=host' in call for call in calls)
    writer = next(call for call in calls if 'pg_basebackup' in call)
    assert writer[writer.index('--memory') + 1] == writer[writer.index('--memory-swap') + 1] == '129g'
    assert next(i for i, call in enumerate(calls) if 'pg_basebackup' in call) < calls.index(['verify'])
    upload = next(i for i, call in enumerate(calls) if 'tar -cf -' in call[-1])
    release = next(i for i, call in enumerate(calls) if call[:3] == ['docker', 'volume', 'rm'])
    assert calls.index(['verify']) < upload < release

    result, calls, status, old, stage = check('disk', {'MOCK_DISK_KIB': '200000000'})
    assert result.returncode == 0 and status['status'] == 'verified'
    assert not any(call[:3] == ['docker', 'volume', 'create'] for call in calls)
    assert not old.exists() and (stage / 'data/verification.json').exists()

    for failure in ('volume_create', 'holder', 'dump', 'verify', 'upload', 'cleanup'):
        result, calls, status, old, stage = check(failure, {'MOCK_FAIL': failure})
        assert result.returncode != 0 and status['status'] == 'failed' and old.exists(), failure
        if failure != 'volume_create': assert any(call[:3] == ['docker', 'volume', 'rm'] for call in calls), failure
        if failure in ('dump', 'verify'): assert not any('tar -cf -' in call[-1] for call in calls)
    result, calls, status, old, stage = check('low-memory', {'MOCK_MEMORY_KIB': '200000000'})
    assert result.returncode != 0 and status['status'] == 'failed' and old.exists()
    assert not any(call[0] == 'docker' for call in calls)
    result, calls, status, old, stage = check('existing-volume', {'MOCK_EXISTING_VOLUME': '1'})
    assert result.returncode != 0 and status['status'] == 'failed' and old.exists()
    assert not any(call[:3] in (['docker', 'volume', 'create'], ['docker', 'volume', 'rm']) for call in calls)

print('Bounded RAM staging, disk retention, publication order and failure cleanup passed.')
