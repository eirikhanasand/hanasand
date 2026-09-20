"""Exercise the actual verification shell with isolated command doubles."""
import json
import os
import pathlib
import subprocess
import sys
import tempfile

script = pathlib.Path(__file__).with_name('verify-backup.sh')
with tempfile.TemporaryDirectory() as directory:
    root = pathlib.Path(directory)
    binaries, backup, verify = (root / name for name in ('bin', 'backup with spaces', 'verify'))
    for path in (binaries, backup, verify):
        path.mkdir()
    for name in ('base.tar.gz', 'pg_wal.tar.gz', 'backup_manifest'):
        (backup / name).write_bytes(name.encode())
    log = root / 'commands.jsonl'
    mock = f'''#!{sys.executable}
import json, os, pathlib, subprocess, sys
command, args = pathlib.Path(sys.argv[0]).name, sys.argv[1:]
with open(os.environ['MOCK_LOG'], 'a') as output: output.write(json.dumps([command, *args]) + '\\n')
if command == 'awk': print(os.environ.get('MOCK_MEMORY_KIB', '900000000'))
elif command == 'docker' and args[0] == 'run':
    env = dict(os.environ)
    for i, arg in enumerate(args):
        if arg == '-e':
            key, value = args[i+1].split('=', 1)
            env[key] = value
    body = args[-1].replace('/verify', os.environ['MOCK_VERIFY'])
    sys.exit(subprocess.run(['sh', '-ec', body], env=env).returncode)
elif command == 'gosu': sys.exit(subprocess.run(args[1:]).returncode)
elif command == os.environ.get('MOCK_FAIL_STAGE'): sys.exit(47)
elif command == 'pg_ctl' and args[-1] == 'start':
    timeout = int(args[args.index('-t') + 1])
    if int(os.environ.get('MOCK_RECOVERY_SECONDS', '0')) > timeout: sys.exit(48)
'''
    for command in ('docker', 'awk', 'tar', 'mkdir', 'cp', 'rm', 'chown', 'chmod', 'gosu', 'pg_verifybackup', 'pg_ctl', 'psql'):
        path = binaries / command
        path.write_text(mock)
        path.chmod(0o755)
    env = {**os.environ, 'PATH': f'{binaries}:{os.environ["PATH"]}', 'MOCK_LOG': str(log), 'MOCK_VERIFY': str(verify)}

    def run(extra=None):
        log.write_text('')
        (backup / 'verification.json').unlink(missing_ok=True)
        result = subprocess.run(['sh', str(script), str(backup)], env={**env, **(extra or {})}, capture_output=True, text=True)
        return result, [json.loads(line) for line in log.read_text().splitlines()]

    result, calls = run({'MOCK_RECOVERY_SECONDS': '480'})
    assert result.returncode == 0, result.stderr
    restores = [args for command, *args in calls if command == 'docker' and args[0] == 'run']
    assert len(restores) == 1
    args = restores[0]
    assert args[args.index('--memory') + 1] == args[args.index('--memory-swap') + 1] == '128g'
    assert args[args.index('--tmpfs') + 1] == '/verify:rw,noexec,nosuid,mode=0700,size=96g'
    assert args[args.index('--network') + 1] == 'none'
    assert not any(arg.startswith('--device-') for arg in args)
    stages = [call[0] for call in calls]
    assert stages.index('pg_verifybackup') < stages.index('pg_ctl') < stages.index('psql')
    assert [call for call in calls if call[0] == 'pg_ctl'][-1][-1] == 'stop'
    assert json.loads((backup / 'verification.json').read_text())['restoreVerified'] is True

    for scenario in [*({'MOCK_FAIL_STAGE': stage} for stage in ('tar', 'pg_verifybackup', 'pg_ctl', 'psql')),
                     {'MOCK_RECOVERY_SECONDS': '480', 'BACKUP_VERIFY_RECOVERY_TIMEOUT_SECONDS': '300'}]:
        result, calls = run(scenario)
        assert result.returncode != 0
        assert not (backup / 'verification.json').exists()
        assert any(call[:3] == ['docker', 'rm', '-f'] for call in calls)
    for scenario in [*({'BACKUP_VERIFY_RECOVERY_TIMEOUT_SECONDS': value} for value in ('0', '-1', 'no', '1.5')),
                     {'MOCK_MEMORY_KIB': '1000000'}]:
        result, calls = run(scenario)
        assert result.returncode != 0
        assert not any(call[0] == 'docker' for call in calls)

print('RAM-backed restore bounds, full verification order, slow recovery, timeout and failure handling passed.')
