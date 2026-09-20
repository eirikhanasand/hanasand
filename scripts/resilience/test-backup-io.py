"""Backup checks must limit both restore stages without recording failed checks as verified."""
import json
import os
import pathlib
import subprocess
import sys
import tempfile

script = pathlib.Path(__file__).with_name('verify-backup.sh')

with tempfile.TemporaryDirectory() as directory:
    root = pathlib.Path(directory)
    binaries = root / 'bin'
    binaries.mkdir()
    backup = root / 'backup with spaces'
    backup.mkdir()
    for name in ('base.tar.gz', 'pg_wal.tar.gz', 'backup_manifest'):
        (backup / name).write_bytes(name.encode())
    log = root / 'docker.jsonl'
    mock = f'''#!{sys.executable}
import json, os, pathlib, sys
command = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
if command == 'docker':
    with open(os.environ['MOCK_LOG'], 'a') as output:
        output.write(json.dumps(args) + '\\n')
    if args[0] == 'info': print('/mock/docker root')
    if args[0] == 'run' and '--rm' in args and os.environ.get('MOCK_FAIL_RESTORE'):
        sys.exit(47)
elif command == 'findmnt':
    if os.environ.get('MOCK_FAIL_DISCOVERY'): sys.exit(1)
    print('/dev/mapper/volume')
elif command == 'lsblk':
    print('/dev/sda disk\\n/dev/sda3 part\\n/dev/mapper/volume lvm\\n/dev/nvme0n1 disk')
'''
    for command in ('docker', 'findmnt', 'lsblk'):
        path = binaries / command
        path.write_text(mock)
        path.chmod(0o755)
    env = {**os.environ, 'PATH': f'{binaries}:{os.environ["PATH"]}', 'MOCK_LOG': str(log)}

    def run(extra=None):
        log.write_text('')
        (backup / 'verification.json').unlink(missing_ok=True)
        result = subprocess.run(['sh', str(script), str(backup)], env={**env, **(extra or {})},
                                capture_output=True, text=True)
        return result, [json.loads(line) for line in log.read_text().splitlines()]

    result, calls = run()
    assert result.returncode == 0, result.stderr
    restores = [args for args in calls if args[0] == 'run']
    assert len(restores) == 2
    for args in restores:
        for flag, rate in (('--device-read-bps', '20mb'), ('--device-write-bps', '10mb')):
            values = [args[i + 1] for i, value in enumerate(args) if value == flag]
            assert sorted(values) == [f'/dev/nvme0n1:{rate}', f'/dev/sda:{rate}'], values
    assert json.loads((backup / 'verification.json').read_text())['restoreVerified'] is True

    result, calls = run({'MOCK_FAIL_DISCOVERY': '1'})
    assert result.returncode != 0
    assert not any(args[0] in ('run', 'volume') for args in calls)
    assert not (backup / 'verification.json').exists()

    result, calls = run({'MOCK_FAIL_RESTORE': '1'})
    assert result.returncode == 47
    assert len([args for args in calls if args[0] == 'run']) == 1
    assert not (backup / 'verification.json').exists()
    assert any(args[:2] == ['volume', 'rm'] for args in calls)

print('Backup I/O limits, disk discovery failure, and failed-restore handling passed.')
