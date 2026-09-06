#!/bin/sh
set -eu
backup=${1:?backup directory required}
image=postgres@sha256:29342cb52157b098821961d2c14eec3c019071f56a5d559e990cf07cf541ea9b
volume=hanasand-resilience-restore-check-$(date -u +%Y%m%d%H%M%S)
name=$volume
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; docker volume rm "$volume" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# Every restore uses a new isolated volume; no production database is stopped or overwritten.
docker volume create "$volume" >/dev/null
docker run --rm --network none --cpus 2 --memory 512m -v "$backup:/backup:ro" -v "$volume:/verify" "$image" sh -ec '
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
'
docker run -d --name "$name" --network none --memory 1g --cpus 1 -v "$volume:/var/lib/postgresql/data" "$image" postgres -p 5432 -c listen_addresses=127.0.0.1 -c shared_buffers=128MB >/dev/null
ready=0
for attempt in $(seq 1 60); do
 if docker exec "$name" pg_isready -U hanasand -d hanasand >/dev/null 2>&1; then ready=1; break; fi
 sleep 1
done
test "$ready" = 1
docker exec "$name" psql -U hanasand -d hanasand -v ON_ERROR_STOP=1 -c "CREATE TABLE public.resilience_restore_probe (id integer PRIMARY KEY); INSERT INTO public.resilience_restore_probe VALUES (1); SELECT pg_is_in_recovery(), count(*) FROM public.resilience_restore_probe; DROP TABLE public.resilience_restore_probe;" >/dev/null
python3 - "$backup" <<'JSON'
import datetime,hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1]);checksums={}
for name in ('base.tar.gz','pg_wal.tar.gz','backup_manifest'):
 with (root/name).open('rb') as file: checksums[name]=hashlib.file_digest(file,'sha256').hexdigest()
proof=dict(backup=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'),verifiedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),restoreVerified=True,checksums=checksums)
(root/'verification.json').write_text(json.dumps(proof))
JSON
printf 'Backup manifest, WAL recovery and isolated read/write restore passed.\n'
