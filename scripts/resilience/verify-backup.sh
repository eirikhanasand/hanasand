#!/bin/sh
set -eu
backup=${1:?backup directory required}
recovery_timeout=${BACKUP_VERIFY_RECOVERY_TIMEOUT_SECONDS:-7200}
case "$recovery_timeout" in ''|*[!0-9]*) printf 'Backup recovery timeout must be a positive number of seconds.\n' >&2; exit 1;; esac
test "$recovery_timeout" -gt 0
image=postgres@sha256:29342cb52157b098821961d2c14eec3c019071f56a5d559e990cf07cf541ea9b
name=hanasand-resilience-restore-check-$(date -u +%Y%m%d%H%M%S)
# This runs on Inspur. Leave 64 GiB beyond the check's maximum memory allowance.
available_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
test "${available_kib:-0}" -ge 201326592 || { printf 'Backup verification needs 192 GiB of available memory.\n' >&2; exit 1; }
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# One container keeps the same temporary filesystem through extraction and replay.
# Disk throttles on the shared filesystem can also delay live database writes.
docker run --rm --name "$name" --network none --cpus 2 --memory 128g --memory-swap 128g \
 --tmpfs /verify:rw,noexec,nosuid,mode=0700,size=96g \
 -e BACKUP_VERIFY_RECOVERY_TIMEOUT_SECONDS="$recovery_timeout" \
 -v "$backup:/backup:ro" "$image" sh -ec '
 tar -xzf /backup/base.tar.gz -C /verify
 mkdir -p /verify/pg_wal
 tar -xzf /backup/pg_wal.tar.gz -C /verify/pg_wal
 cp /backup/backup_manifest /verify/backup_manifest
 pg_verifybackup /verify
 # Only the verified isolated copy is detached from the production replication chain.
 rm -f /verify/standby.signal
 : > /verify/postgresql.auto.conf
 chown -R postgres:postgres /verify
 chmod 700 /verify
 gosu postgres pg_ctl -D /verify -w -t "$BACKUP_VERIFY_RECOVERY_TIMEOUT_SECONDS" \
  -o "-p 5432 -c listen_addresses=127.0.0.1 -c shared_buffers=4GB" start
 psql -U hanasand -d hanasand -v ON_ERROR_STOP=1 -c "CREATE TABLE public.resilience_restore_probe (id integer PRIMARY KEY); INSERT INTO public.resilience_restore_probe VALUES (1); SELECT pg_is_in_recovery(), count(*) FROM public.resilience_restore_probe; DROP TABLE public.resilience_restore_probe;"
 gosu postgres pg_ctl -D /verify -w -t 120 -m fast stop
'
python3 - "$backup" <<'JSON'
import datetime,hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1]);checksums={}
for name in ('base.tar.gz','pg_wal.tar.gz','backup_manifest'):
 with (root/name).open('rb') as file: checksums[name]=hashlib.file_digest(file,'sha256').hexdigest()
proof=dict(backup=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'),verifiedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),restoreVerified=True,checksums=checksums)
(root/'verification.json').write_text(json.dumps(proof))
JSON
printf 'Backup manifest, WAL recovery and isolated read/write restore passed.\n'
