#!/bin/sh
set -eu

action=${1:-}
archive=${2:-}

usage() {
  echo "usage: $0 <backup|verify|drill|restore> <archive-directory>" >&2
  exit 2
}

[ -n "$action" ] && [ -n "$archive" ] || usage
dump="$archive/threat-intel.dump"
objects="$archive/evidence.tar.gz"
checksums="$archive/SHA256SUMS"

compose() { docker compose "$@"; }
verify() {
  [ -f "$dump" ] && [ -f "$objects" ] && [ -f "$checksums" ] || { echo "incomplete threat-intelligence backup: $archive" >&2; exit 1; }
  (cd "$archive" && shasum -a 256 -c SHA256SUMS)
  compose exec -T postgres pg_restore --list < "$dump" >/dev/null
  tar -tzf "$objects" >/dev/null
}

case "$action" in
  backup)
    mkdir -p "$archive"
    compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --schema=threat_intel --no-owner' > "$dump"
    compose exec -T ti-scraper tar -C /var/lib/ti-scraper/evidence -czf - . > "$objects"
    (cd "$archive" && shasum -a 256 threat-intel.dump evidence.tar.gz > SHA256SUMS)
    verify
    ;;
  verify)
    verify
    ;;
  drill)
    verify
    drill_db="ti_restore_drill_$$"
    cleanup() { compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$1"' sh "$drill_db" >/dev/null; }
    trap cleanup EXIT INT TERM
    compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$drill_db"
    compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error' sh "$drill_db" < "$dump"
    compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM threat_intel.schema_migrations"' sh "$drill_db" >/dev/null
    compose run --rm --no-deps -T ti-scraper sh -c 'mkdir -p /tmp/ti-restore-drill && tar -C /tmp/ti-restore-drill -xzf - && find /tmp/ti-restore-drill -type f -print -quit' < "$objects" >/dev/null
    ;;
  restore)
    [ "${TI_RESTORE_CONFIRM:-}" = "restore-threat-intel" ] || { echo "set TI_RESTORE_CONFIRM=restore-threat-intel to replace production threat-intelligence data" >&2; exit 2; }
    verify
    compose stop ti-scraper
    restart() { compose up -d ti-scraper >/dev/null; }
    trap restart EXIT INT TERM
    compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS threat_intel CASCADE"'
    compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < "$dump"
    compose run --rm --no-deps -T ti-scraper sh -c 'find /var/lib/ti-scraper/evidence -mindepth 1 -delete && tar -C /var/lib/ti-scraper/evidence -xzf -' < "$objects"
    restart
    trap - EXIT INT TERM
    ;;
  *) usage ;;
esac
