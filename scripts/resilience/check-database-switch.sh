#!/bin/sh
set -eu
image=postgres@sha256:29342cb52157b098821961d2c14eec3c019071f56a5d559e990cf07cf541ea9b
prefix=hanasand-resilience-drill-$(date -u +%Y%m%d%H%M%S)
a=$prefix-primary; b=$prefix-standby; c=$prefix-rejoined
cleanup() {
 for name in "$a" "$b" "$c"; do docker rm -f "$name" >/dev/null 2>&1 || true; docker volume rm "$name" >/dev/null 2>&1 || true; done
}
trap cleanup EXIT
sql() { docker exec "$1" psql -p "$2" -U postgres -d drill -At -v ON_ERROR_STOP=1 -c "$3"; }
ready() {
 for attempt in $(seq 1 60); do if docker exec "$1" pg_isready -p "$2" -U postgres -d drill >/dev/null 2>&1; then return; fi; sleep 1; done
 return 1
}
replicated() {
 for attempt in $(seq 1 60); do if test "$(sql "$1" "$2" 'SELECT count(*) FROM marker' 2>/dev/null || true)" = "$3"; then return; fi; sleep 1; done
 return 1
}
seed() {
 docker run --rm --network "container:$1" --memory 128m --cpus 1 -v "$3:/var/lib/postgresql/data" "$image" sh -ec "pg_basebackup -h 127.0.0.1 -p $2 -U postgres -D /var/lib/postgresql/data -R -X stream; chown -R postgres:postgres /var/lib/postgresql/data; chmod 700 /var/lib/postgresql/data"
 docker run -d --name "$3" --network "container:$1" --memory 256m --cpus 1 -v "$3:/var/lib/postgresql/data" "$image" postgres -p "$4" -c listen_addresses=127.0.0.1 -c shared_buffers=32MB >/dev/null
 ready "$3" "$4"
}
fence() { docker stop -t 15 "$1" >/dev/null; test "$(docker inspect -f '{{.State.Running}}' "$1")" = false; }
promote() { docker exec --user postgres "$1" pg_ctl -D /var/lib/postgresql/data promote -w >/dev/null; test "$(sql "$1" "$2" 'SELECT pg_is_in_recovery()')" = f; }
# No host ports, no production volumes, no external network, no customer records.
docker run -d --name "$a" --network none --memory 256m --cpus 1 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=drill -v "$a:/var/lib/postgresql/data" "$image" postgres -c shared_buffers=32MB >/dev/null
ready "$a" 5432
sql "$a" 5432 'CREATE TABLE marker (phase integer PRIMARY KEY); INSERT INTO marker VALUES (1)' >/dev/null
seed "$a" 5432 "$b" 5433
replicated "$b" 5433 1
fence "$a"
promote "$b" 5433
sql "$b" 5433 'INSERT INTO marker VALUES (2)' >/dev/null
# Re-seeding supports primaries without checksums/wal_log_hints; no unsafe pg_rewind assumption.
seed "$b" 5433 "$c" 5434
replicated "$c" 5434 2
fence "$b"
promote "$c" 5434
sql "$c" 5434 'INSERT INTO marker VALUES (3)' >/dev/null
test "$(sql "$c" 5434 'SELECT string_agg(phase::text,chr(44) ORDER BY phase) FROM marker')" = '1,2,3'
printf '{"replication":"passed","fencedFailover":"passed","reseedAndFailback":"passed","preservedPhases":[1,2,3],"productionDatabasesStopped":0}\n'
