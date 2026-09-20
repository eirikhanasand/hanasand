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
clock = pathlib.Path(os.environ['MOCK_LOG'] + '.clock')
elapsed = int(clock.read_text()) if clock.exists() else 0
if command == 'docker':
    with open(os.environ['MOCK_LOG'], 'a') as output:
        output.write(json.dumps(args) + '\\n')
    if args[0] == 'info': print('/mock/docker root')
    if args[0] == 'run' and '--rm' in args and os.environ.get('MOCK_FAIL_RESTORE'):
        sys.exit(47)
    if args[0] == 'inspect': print('false' if os.environ.get('MOCK_STOPPED') else 'true')
    if args[0] == 'exec' and 'pg_isready' in args:
        sys.exit(0 if elapsed >= int(os.environ.get('MOCK_READY_AFTER', '0')) else 1)
    if args[0] == 'exec' and 'psql' in args and os.environ.get('MOCK_FAIL_SQL'): sys.exit(48)
elif command == 'findmnt':
    if os.environ.get('MOCK_FAIL_DISCOVERY'): sys.exit(1)
    print('/dev/mapper/volume')
elif command == 'lsblk':
    print('/dev/sda disk\\n/dev/sda3 part\\n/dev/mapper/volume lvm\\n/dev/nvme0n1 disk')
elif command == 'date': print(elapsed if args == ['+%s'] else '20260920000000')
elif command == 'sleep': clock.write_text(str(elapsed + 120))
'''
    for command in ('docker', 'findmnt', 'lsblk', 'date', 'sleep'):
        path = binaries / command
        path.write_text(mock)
        path.chmod(0o755)
    env = {**os.environ, 'PATH': f'{binaries}:{os.environ["PATH"]}', 'MOCK_LOG': str(log)}

    def run(extra=None):
        log.write_text('')
        pathlib.Path(str(log) + '.clock').unlink(missing_ok=True)
        (backup / 'verification.json').unlink(missing_ok=True)
        result = subprocess.run(['sh', str(script), str(backup)], env={**env, **(extra or {})},
                                capture_output=True, text=True)
        return result, [json.loads(line) for line in log.read_text().splitlines()]

    result, calls = run()
    assert result.returncode == 0, result.stderr
    restores = [args for args in calls if args[0] == 'run']
    assert len(restores) == 2
    for args in restores:
        assert args[args.index('--memory') + 1] == '16g'
        assert args[args.index('--memory-swap') + 1] == '16g'
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

    result, calls = run({'MOCK_READY_AFTER': '480'})
    assert result.returncode == 0, result.stderr
    assert (backup / 'verification.json').exists()
    for scenario, message in (
        ({'MOCK_READY_AFTER': '480', 'BACKUP_VERIFY_RECOVERY_TIMEOUT_SECONDS': '300'}, 'within 300 seconds'),
        ({'MOCK_READY_AFTER': '480', 'MOCK_STOPPED': '1'}, 'stopped before'),
        ({'MOCK_FAIL_SQL': '1'}, ''),
    ):
        result, calls = run(scenario)
        assert result.returncode != 0
        assert message in result.stderr
        assert not (backup / 'verification.json').exists()
        assert any(args[:2] == ['volume', 'rm'] for args in calls)
    for invalid in ('0', '-1', 'no', '1.5'):
        result, calls = run({'BACKUP_VERIFY_RECOVERY_TIMEOUT_SECONDS': invalid})
        assert result.returncode != 0
        assert not calls

print('Backup I/O/memory limits, slow recovery, timeout, stopped database and failed-restore checks passed.')
