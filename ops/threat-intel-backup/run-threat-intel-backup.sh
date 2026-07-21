#!/bin/sh
set -eu
umask 077

repo=${HANASAND_REPO:-/home/hanasand/hanasand}
backup_root=${TI_BACKUP_ROOT:-/home/hanasand/backups/threat-intel}
retention_days=${TI_BACKUP_RETENTION_DAYS:-14}
lock=${TI_BACKUP_LOCK_DIR:-/tmp/hanasand-ti-backup.lock}
backup_script=${TI_BACKUP_SCRIPT:-$repo/ti/scraper/scripts/threat-intel-backup.sh}

case "$retention_days" in
  ''|*[!0-9]*) echo "TI_BACKUP_RETENTION_DAYS must be a non-negative integer" >&2; exit 2 ;;
esac
[ "$backup_root" != / ] || { echo "TI_BACKUP_ROOT cannot be /" >&2; exit 2; }

if ! mkdir "$lock" 2>/dev/null; then
  echo "$(date -u +%FT%TZ) threat-intelligence backup already running"
  exit 0
fi
partial=
cleanup() {
  [ -z "$partial" ] || rm -rf -- "$partial"
  rmdir "$lock" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

archive="$backup_root/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_root"
chmod 700 "$backup_root"
[ ! -e "$archive" ] || { echo "backup archive already exists: $archive" >&2; exit 1; }
partial="$archive.partial.$$"

cd "$repo"
"$backup_script" backup "$partial"

if [ "$(date -u +%u)" = "7" ]; then
  "$backup_script" drill "$partial"
fi

mv "$partial" "$archive"
partial=
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '*.partial.*' -mtime +1 -exec rm -rf -- {} +
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -mtime "+$retention_days" -exec rm -rf -- {} +
echo "$(date -u +%FT%TZ) threat-intelligence backup verified archive=$archive retention_days=$retention_days"
