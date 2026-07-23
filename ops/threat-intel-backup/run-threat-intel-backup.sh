#!/bin/sh
set -eu
umask 077

repo=${HANASAND_REPO:-/home/hanasand/hanasand}
backup_root=${TI_BACKUP_ROOT:-/home/hanasand/backups/threat-intel}
retention_days=${TI_BACKUP_RETENTION_DAYS:-14}
lock=${TI_BACKUP_LOCK_FILE:-$backup_root/.backup.lock}
backup_script=${TI_BACKUP_SCRIPT:-$repo/ti/scraper/scripts/threat-intel-backup.sh}
archive_pattern='[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z'
started_at=$(date -u +%FT%TZ)
status_file="$backup_root/LATEST-STATUS"
archive=
partial=
run_status=failed
run_phase=initialize
run_reason=command_failed
status_on_exit=true

write_status() {
  status_tmp="$backup_root/.LATEST-STATUS.$$"
  {
    printf 'format=hanasand.threat_intel_backup_status.v2\n'
    printf 'status=%s\n' "$run_status"
    printf 'exit_code=%s\n' "$exit_code"
    printf 'phase=%s\n' "$run_phase"
    printf 'reason=%s\n' "$run_reason"
    printf 'started_at=%s\n' "$started_at"
    printf 'finished_at=%s\n' "$(date -u +%FT%TZ)"
    printf 'archive=%s\n' "$archive"
    printf 'retention_days=%s\n' "$retention_days"
  } > "$status_tmp" && mv "$status_tmp" "$status_file"
}

cleanup() {
  exit_code=$?
  trap - EXIT INT TERM
  [ -z "$partial" ] || rm -rf -- "$partial" || true
  if [ "$status_on_exit" = true ] && ! write_status; then
    [ "$exit_code" -ne 0 ] || exit_code=1
    printf '%s status=failed phase=status reason=status_write_failed exit_code=%s\n' "$(date -u +%FT%TZ)" "$exit_code" >&2
  fi
  if [ "$exit_code" -ne 0 ]; then
    printf '%s status=failed phase=%s reason=%s exit_code=%s\n' "$(date -u +%FT%TZ)" "$run_phase" "$run_reason" "$exit_code" >&2
  fi
  exit "$exit_code"
}

run_phase=validation
[ "$backup_root" != / ] || { echo "TI_BACKUP_ROOT cannot be /" >&2; exit 2; }
mkdir -p "$backup_root"
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
chmod 700 "$backup_root"

case "$retention_days" in
  ''|*[!0-9]*) run_reason=invalid_configuration; echo "TI_BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 2 ;;
esac
[ "$retention_days" -gt 0 ] || { run_reason=invalid_configuration; echo "TI_BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 2; }
[ "$lock" != / ] || { run_reason=invalid_configuration; echo "TI_BACKUP_LOCK_FILE cannot be /" >&2; exit 2; }
command -v flock >/dev/null 2>&1 || { run_reason=missing_dependency; echo "flock is required for threat-intelligence backup locking" >&2; exit 2; }

run_phase=lock
exec 9>"$lock"
if flock -n -E 75 9; then
  :
else
  lock_exit=$?
  if [ "$lock_exit" -eq 75 ]; then
    status_on_exit=false
    run_status=skipped
    run_reason=already_running
    printf '%s status=skipped phase=lock reason=already_running\n' "$(date -u +%FT%TZ)"
    exit 0
  fi
  run_reason=lock_failed
  echo "could not acquire threat-intelligence backup lock" >&2
  exit 1
fi

run_phase=backup
archive="$backup_root/$(date -u +%Y%m%dT%H%M%SZ)"
[ ! -e "$archive" ] || { run_reason=archive_exists; echo "backup archive already exists" >&2; exit 1; }
partial="$archive.partial.$$"

cd "$repo"
"$backup_script" backup "$partial"

if [ "${TI_BACKUP_ALWAYS_DRILL:-false}" = "true" ] || [ "$(date -u +%u)" = "${TI_BACKUP_DRILL_WEEKDAY:-7}" ]; then
  run_phase=drill
  "$backup_script" drill "$partial"
fi

run_phase=publish
mv "$partial" "$archive"
partial=
run_phase=retention
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name "$archive_pattern.partial.*" -mtime +1 -exec rm -rf -- {} +
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name "$archive_pattern" -mtime "+$retention_days" -exec rm -rf -- {} +
run_status=succeeded
run_phase=complete
run_reason=none
printf '%s status=succeeded archive=%s retention_days=%s\n' "$(date -u +%FT%TZ)" "$archive" "$retention_days"
