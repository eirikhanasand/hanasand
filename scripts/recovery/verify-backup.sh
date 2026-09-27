#!/bin/sh
set -eu
backup=${1:?backup directory required}
recovery_timeout=${BACKUP_VERIFY_RECOVERY_TIMEOUT_SECONDS:-7200}
case "$recovery_timeout" in ''|*[!0-9]*) printf 'Backup recovery timeout must be a positive number of seconds.\n' >&2; exit 1;; esac
test "$recovery_timeout" -gt 0
image=postgres@sha256:29342cb52157b098821961d2c14eec3c019071f56a5d559e990cf07cf541ea9b
name=hanasand-recovery-restore-check-$(date -u +%Y%m%d%H%M%S)
manifest=$(mktemp)
proof=$(mktemp)
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -f "$manifest" "$proof"; }
trap cleanup EXIT
# The source may be a normal directory or a Docker-managed temporary RAM volume.
docker run --rm --network none -v "$backup:/backup:ro" "$image" cat /backup/backup_manifest > "$manifest"
# Size the isolated restore from the manifest; the database has outgrown the
# former fixed 96 GiB filesystem. Leave room for WAL replay and 64 GiB for the host.
restore_gib=$(/home/hanasand/.local/bin/bun /home/hanasand/hanasand/scripts/recovery/backup-helper.ts size "$manifest")
memory_gib=$((restore_gib + 32))
available_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
test "${available_kib:-0}" -ge "$(((memory_gib + 64) * 1048576))" || { printf 'Backup verification needs %s GiB of available memory.\n' "$((memory_gib + 64))" >&2; exit 1; }
# One container keeps the same temporary filesystem through extraction and replay.
# Disk throttles on the shared filesystem can also delay live database writes.
docker run --rm --name "$name" --network none --cpus 2 --memory "${memory_gib}g" --memory-swap "${memory_gib}g" \
 --tmpfs "/verify:rw,noexec,nosuid,mode=0700,size=${restore_gib}g" \
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
 psql -U hanasand -d hanasand -v ON_ERROR_STOP=1 -c "CREATE TABLE public.recovery_restore_probe (id integer PRIMARY KEY); INSERT INTO public.recovery_restore_probe VALUES (1); SELECT pg_is_in_recovery(), count(*) FROM public.recovery_restore_probe; DROP TABLE public.recovery_restore_probe;"
 gosu postgres pg_ctl -D /verify -w -t 120 -m fast stop
'
checksums=$(docker run --rm --network none -v "$backup:/backup:ro" "$image" sh -ec 'cd /backup; sha256sum base.tar.gz pg_wal.tar.gz backup_manifest')
proof=$(mktemp)
/home/hanasand/.local/bin/bun /home/hanasand/hanasand/scripts/recovery/backup-helper.ts proof "$checksums" > "$proof"
docker run --rm --network none -v "$backup:/backup" -v "$proof:/proof:ro" "$image" cp -p /proof /backup/verification.json
printf 'Backup manifest, WAL recovery and isolated read/write restore passed.\n'
