#!/usr/bin/env python3
"""Forced SSH command: accept only a bounded, verified PostgreSQL backup bundle."""
import hashlib
import json
import os
import pathlib
import shutil
import sys
import tarfile
import tempfile
import time

root = pathlib.Path('/home/ubuntu/hanasand-resilience')
backups = root/'backups'
backups.mkdir(mode=0o700,exist_ok=True)
staging = pathlib.Path(tempfile.mkdtemp(prefix='incoming-',dir=backups))
allowed = {'base.tar.gz','pg_wal.tar.gz','backup_manifest','verification.json'}
seen, checksums, total = set(), {}, 0
try:
    with tarfile.open(fileobj=sys.stdin.buffer, mode='r|') as archive:
        for member in archive:
            if member.name not in allowed or member.name in seen or not member.isfile(): raise ValueError('Unexpected backup member')
            total += member.size
            if total > 32 * 1024**3: raise ValueError('Backup exceeds receiver capacity limit')
            seen.add(member.name)
            digest = hashlib.sha256()
            with archive.extractfile(member) as source, (staging/member.name).open('xb') as target:
                while chunk := source.read(1024*1024): target.write(chunk); digest.update(chunk)
                target.flush(); os.fsync(target.fileno())
            (staging/member.name).chmod(0o600)
            checksums[member.name] = digest.hexdigest()
    if seen != allowed: raise ValueError('Incomplete backup')
    proof = json.loads((staging/'verification.json').read_text())
    if proof.get('restoreVerified') is not True or any(checksums.get(name) != proof.get('checksums',{}).get(name) for name in allowed-{'verification.json'}): raise ValueError('Backup verification mismatch')
    stamp = proof['backup']
    if len(stamp)!=16 or not stamp.endswith('Z') or not stamp[:8].isdecimal() or stamp[8]!='T' or not stamp[9:15].isdecimal(): raise ValueError('Invalid backup identity')
    final = backups/stamp
    if final.exists(): raise ValueError('Backup already received')
    staging.rename(final)
    state = dict(status='verified', backup=stamp, verifiedAt=proof['verifiedAt'], restoreVerifiedAt=proof['verifiedAt'], receivedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()), bytes=total, restoreRequired=False)
    temporary=root/'backup-status.tmp';temporary.write_text(json.dumps(state));temporary.replace(root/'backup-status.json')
    # Only this receiver's timestamped verified bundles are eligible for retention.
    bundles=sorted(path for path in backups.iterdir() if len(path.name)==16 and (path/'verification.json').is_file())
    for old in bundles[:-14]: shutil.rmtree(old)
    print(json.dumps({'received':stamp,'verified':True,'bytes':total}))
except Exception:
    shutil.rmtree(staging,ignore_errors=True)
    raise
