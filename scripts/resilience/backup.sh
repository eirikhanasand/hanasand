#!/bin/sh
set -eu
root=/home/hanasand/resilience
backups=${HANASAND_BACKUP_DIR:-/var/backups/hanasand}
secrets=/home/hanasand/resilience-secrets
image=postgres@sha256:29342cb52157b098821961d2c14eec3c019071f56a5d559e990cf07cf541ea9b
exec 9>"$root/backup.lock"
flock -n 9 || exit 0
memory_stage=false
backup_memory=256m
record_result() {
 backup_exit=$?
 trap - EXIT
 if "$memory_stage"; then
  docker rm -f hanasand-resilience-backup >/dev/null 2>&1 || true
  docker rm -f "$stage_volume-holder" >/dev/null 2>&1 || true
  docker volume rm "$stage_volume" >/dev/null || backup_exit=1
  rmdir "$backups/$stamp" || true
 fi
 python3 - "$root/backup-job-status.json" "$backup_exit" <<'RESULT'
import json,pathlib,sys,time
p=pathlib.Path(sys.argv[1]);t=p.with_suffix('.tmp')
t.write_text(json.dumps({'status':'verified' if sys.argv[2]=='0' else 'failed','at':time.time()}));t.replace(p)
RESULT
 exit "$backup_exit"
}
trap record_result EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backups/$stamp"
chmod 700 "$backups" "$backups/$stamp"
archive="$backups/$stamp/data"
mkdir "$archive"
# Keep large temporary archives off the nearly full application filesystem.
# This host has 1 TiB RAM; require room for staging, restore verification and
# the application before mounting a bounded, non-executable temporary area.
available_disk_kib=$(df -Pk "$backups" | awk 'NR == 2 {print $4}')
if [ "$available_disk_kib" -lt 134217728 ]; then
 available_memory_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
 test "${available_memory_kib:-0}" -ge 536870912 || { echo 'Backup staging needs 128 GiB free disk or 512 GiB available RAM.' >&2; exit 1; }
 stage_volume=hanasand-resilience-backup-$stamp
 if docker volume inspect "$stage_volume" >/dev/null 2>&1; then echo 'Backup staging volume already exists.' >&2; exit 1; fi
 docker volume create --driver local --opt type=tmpfs --opt device=tmpfs --opt o=size=128G,nosuid,nodev,noexec,mode=0700 "$stage_volume" >/dev/null
 memory_stage=true
 # Keep the temporary volume mounted while separate backup, verification and
 # delivery containers use it. No host namespace or privileged container is needed.
 docker run -d --name "$stage_volume-holder" --network none --read-only --memory 128m -v "$stage_volume:/backup" "$image" sleep infinity >/dev/null
 rmdir "$archive"
 archive=$stage_volume
 # tmpfs writes count against the writer's memory limit as well as the volume cap.
 backup_memory=129g
fi
docker run --rm --name hanasand-resilience-backup --network host --cpus 1 --memory "$backup_memory" --memory-swap "$backup_memory" -v "$archive:/backup" "$image" \
 pg_basebackup -h 127.0.0.1 -p 18502 -U hanasand -D /backup -Ft -X stream -z -Z 1 --max-rate=50M --progress
docker run --rm --network none -v "$archive:/backup" "$image" chown -R "$(id -u):$(id -g)" /backup
sh "$root/verify-backup.sh" "$archive"
# The dedicated SSH key can only invoke the bounded backup receiver, never a shell.
docker run --rm --network host --cpus .5 --memory 128m --entrypoint sh \
 -v "$archive:/backup:ro" -v "$secrets/backup-key:/run/key:ro" -v "$secrets/ovh-known-hosts:/run/known_hosts:ro" hanasand_api -ec '
 cd /backup
 tar -cf - base.tar.gz pg_wal.tar.gz backup_manifest verification.json | ssh -T -i /run/key -o UserKnownHostsFile=/run/known_hosts -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 ubuntu@192.99.32.185
'

# RAM staging leaves the existing verified local copy intact. The new verified
# archive is durable on OVH before this script releases its temporary staging.
if ! "$memory_stage"; then
python3 - "$backups" "$stamp" <<'RETENTION'
import pathlib,shutil,sys
root=pathlib.Path(sys.argv[1])
for path in root.iterdir():
 if len(path.name)==16 and path.name != sys.argv[2] and (path/'data/verification.json').is_file(): shutil.rmtree(path)
RETENTION
fi
