"""The backup receiver must work when deployment owns its parent directory."""
import hashlib
import io
import json
import os
import pathlib
import subprocess
import tarfile
import tempfile

with tempfile.TemporaryDirectory() as directory:
    root = pathlib.Path(directory)
    (root / 'backups').mkdir()
    payload = {name: name.encode() for name in ('base.tar.gz', 'pg_wal.tar.gz', 'backup_manifest')}
    proof = {'restoreVerified': True, 'backup': '20260919T140000Z', 'verifiedAt': '2026-09-19T14:00:00Z',
             'checksums': {name: hashlib.sha256(body).hexdigest() for name, body in payload.items()}}
    payload['verification.json'] = json.dumps(proof).encode()
    bundle = io.BytesIO()
    with tarfile.open(fileobj=bundle, mode='w') as archive:
        for name, body in payload.items():
            info = tarfile.TarInfo(name)
            info.size = len(body)
            archive.addfile(info, io.BytesIO(body))
    root.chmod(0o555)
    try:
        result = subprocess.run(['python3', str(pathlib.Path(__file__).with_name('receive-backup.py'))],
                                input=bundle.getvalue(), capture_output=True, env={**os.environ, 'RESILIENCE_ROOT': str(root)})
        assert result.returncode == 0, result.stderr.decode()
        assert json.loads((root / 'backups/status.json').read_text())['status'] == 'verified'
        assert not (root / 'backup-status.json').exists()
        assert (root / 'backups/20260919T140000Z/base.tar.gz').read_bytes() == payload['base.tar.gz']
    finally:
        root.chmod(0o755)
print('Backup receipt works with a read-only parent directory.')

# Reject an oversized declared member before reading or allocating its payload.
with tempfile.TemporaryDirectory() as directory:
    info = tarfile.TarInfo('base.tar.gz')
    info.size = 64 * 1024**3 + 1
    result = subprocess.run(['python3', str(pathlib.Path(__file__).with_name('receive-backup.py'))],
                            input=info.tobuf(), capture_output=True,
                            env={**os.environ, 'RESILIENCE_ROOT': directory})
    assert result.returncode != 0
    assert b'Backup exceeds receiver capacity limit' in result.stderr
    assert not list((pathlib.Path(directory) / 'backups').iterdir())
print('Oversized backup rejected before payload extraction.')

# Logical replacements retain the same restore-proof and checksum requirements.
for mode in ('valid', 'wrong-checksum', 'wrong-format', 'mixed'):
    with tempfile.TemporaryDirectory() as directory:
        physical_history = []
        if mode == 'valid':
            for day in range(1, 16):
                old = pathlib.Path(directory) / 'backups' / f'202608{day:02d}T110000Z'
                old.mkdir(parents=True)
                (old / 'verification.json').write_text(json.dumps({'restoreVerified': True}))
                physical_history.append(old)
        payload = {'hanasand.dump': b'clean logical database archive'}
        proof = {'restoreVerified': True, 'backup': '20260924T110000Z',
                 'verifiedAt': '2026-09-24T11:00:00Z', 'format': 'pg_dump-custom',
                 'checksums': {'hanasand.dump': hashlib.sha256(payload['hanasand.dump']).hexdigest()}}
        if mode == 'wrong-checksum': proof['checksums']['hanasand.dump'] = '0' * 64
        if mode == 'wrong-format': proof['format'] = 'pg_basebackup'
        if mode == 'mixed': payload['base.tar.gz'] = b'physical archive'
        payload['verification.json'] = json.dumps(proof).encode()
        bundle = io.BytesIO()
        with tarfile.open(fileobj=bundle, mode='w') as archive:
            for name, body in payload.items():
                info = tarfile.TarInfo(name); info.size = len(body)
                archive.addfile(info, io.BytesIO(body))
        result = subprocess.run(['python3', str(pathlib.Path(__file__).with_name('receive-backup.py'))],
                                input=bundle.getvalue(), capture_output=True,
                                env={**os.environ, 'RESILIENCE_ROOT': directory})
        backups = pathlib.Path(directory) / 'backups'
        if mode == 'valid':
            assert result.returncode == 0, result.stderr.decode()
            assert (backups / '20260924T110000Z/hanasand.dump').read_bytes() == payload['hanasand.dump']
            assert json.loads((backups / 'status.json').read_text())['format'] == 'pg_dump-custom'
            assert all(old.exists() for old in physical_history)
        else:
            assert result.returncode != 0, mode
            assert not list(backups.iterdir()), mode
print('Logical backups require matching format, complete members, and verified checksums.')
