#!/bin/sh
set -eu
root=/home/hanasand/resilience
secrets=/home/hanasand/resilience-secrets
image=postgres@sha256:29342cb52157b098821961d2c14eec3c019071f56a5d559e990cf07cf541ea9b
exec 9>"$root/backup.lock"
flock -n 9 || exit 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$root/backups/$stamp"
chmod 700 "$root/backups" "$root/backups/$stamp"
docker run --rm --name hanasand-resilience-backup --network host --cpus 1 --memory 256m -v "$root/backups/$stamp:/backup" "$image" \
 pg_basebackup -h 127.0.0.1 -p 18502 -U hanasand -D /backup/data -Ft -X stream -z -Z 1 --max-rate=50M --progress
docker run --rm --network none -v "$root/backups/$stamp:/backup" "$image" chown -R "$(id -u):$(id -g)" /backup
sh "$root/verify-backup.sh" "$root/backups/$stamp/data"
# The dedicated SSH key can only invoke the bounded backup receiver, never a shell.
docker run --rm --network host --cpus .5 --memory 128m --entrypoint sh \
 -v "$root/backups/$stamp/data:/backup:ro" -v "$secrets/backup-key:/run/key:ro" -v "$secrets/ovh-known-hosts:/run/known_hosts:ro" hanasand_api -ec '
 cd /backup
 tar -cf - base.tar.gz pg_wal.tar.gz backup_manifest verification.json | ssh -T -i /run/key -o UserKnownHostsFile=/run/known_hosts -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 ubuntu@192.99.32.185
'

python3 - "$root/backups" "$stamp" <<'RETENTION'
import pathlib,shutil,sys
root=pathlib.Path(sys.argv[1])
for path in root.iterdir():
 if len(path.name)==16 and path.name != sys.argv[2] and (path/'data/verification.json').is_file(): shutil.rmtree(path)
RETENTION
