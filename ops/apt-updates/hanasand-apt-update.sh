#!/usr/bin/env bash
set -euo pipefail

APT_HELPER=${HANASAND_APT_HELPER:-/usr/local/lib/hanasand/apt-update-helper.ts}
run_helper() { /usr/local/bin/hanasand-run-ts "$APT_HELPER" "$@"; }

STATE_DIR=${HANASAND_APT_STATE_DIR:-/var/lib/hanasand/apt-updates}
STATUS_FILE="$STATE_DIR/status.json"
TRACK_FILE="$STATE_DIR/packages.tsv"
LOG_FILE=${HANASAND_APT_LOG_FILE:-/var/log/hanasand-apt-update.log}
LOCK_FILE="$STATE_DIR/update.lock"
DELAY_SECONDS=$((72 * 60 * 60))
mkdir -p "$STATE_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

now=$(date -u +%s)
now_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
tmp_status=$(mktemp "$STATE_DIR/status.XXXXXX")
trap 'rm -f "$tmp_status"' EXIT
touch "$TRACK_FILE"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG_FILE"; }

last_status='{}'
if [[ -s "$STATUS_FILE" ]]; then last_status=$(cat "$STATUS_FILE"); fi

if ! apt-get update -qq; then
  run_helper failed-refresh "$tmp_status" "$last_status" "$now_iso" "$run_id"
  mv "$tmp_status" "$STATUS_FILE"; chmod 0644 "$STATUS_FILE"; log 'apt metadata refresh failed'; exit 1
fi

sim=$(mktemp "$STATE_DIR/sim.XXXXXX")
trap 'rm -f "$tmp_status" "$sim"' EXIT
apt-get -s -o Debug::NoLocking=true upgrade >"$sim"

plan=$(mktemp "$STATE_DIR/plan.XXXXXX")
run_helper plan "$TRACK_FILE" "$sim" "$plan" "$now"

security_packages=$(run_helper packages "$plan" "$now" security)
regular_packages=$(run_helper packages "$plan" "$now" regular)

installed=()
failure_messages=()
install_packages() {
  local kind="$1" packages="$2"
  [[ -n "$packages" ]] || return 0
  read -r -a batch <<<"$packages"
  log "installing $kind packages: $packages"
  if DEBIAN_FRONTEND=noninteractive apt-get -y --only-upgrade install $packages >>"$LOG_FILE" 2>&1; then
    installed+=("${batch[@]}")
  else
    local count=${#batch[@]} suffix='s'
    [[ $count -eq 1 ]] && suffix=''
    failure_messages+=("Failed to install $count $kind update$suffix")
  fi
}
install_packages security "$security_packages"
install_packages regular "$regular_packages"

error_text=''
if ((${#failure_messages[@]})); then
  error_text=$(printf '%s|' "${failure_messages[@]}")
  error_text=${error_text%|}
fi

run_helper collect-status "$tmp_status" "$plan" "$last_status" "$now_iso" "$run_id" "${installed[*]:-}" "$error_text"
mv "$tmp_status" "$STATUS_FILE"
chmod 0644 "$STATUS_FILE"
log "completed: installed=${installed[*]:-none} pending=$(grep -c . "$TRACK_FILE" || true) errors=${failure_messages[*]:-none}"
[[ ${#failure_messages[@]} -eq 0 ]]
