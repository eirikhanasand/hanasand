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
