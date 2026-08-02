#!/usr/bin/env bash
set -euo pipefail

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
  /usr/bin/python3 - "$tmp_status" "$last_status" "$now_iso" "$run_id" <<'PY'
import json, sys
out, old, now, run_id = sys.argv[1:]
data = json.loads(old)
data.update({'schema_version': 1, 'host': 'hanasand', 'run_id': run_id,
             'checked_at': now, 'status': 'failed',
             'last_error': 'apt-get update failed; no packages were installed.',
             'policy': {'non_security_delay_hours': 72, 'security_install': 'immediate',
                        'allowed_origin': 'Ubuntu noble/noble-updates/noble-security'}})
json.dump(data, open(out, 'w'), indent=2); open(out, 'a').write('\n')
PY
  mv "$tmp_status" "$STATUS_FILE"; chmod 0644 "$STATUS_FILE"; log 'apt metadata refresh failed'; exit 1
fi

sim=$(mktemp "$STATE_DIR/sim.XXXXXX")
trap 'rm -f "$tmp_status" "$sim"' EXIT
apt-get -s -o Debug::NoLocking=true upgrade >"$sim"

plan=$(mktemp "$STATE_DIR/plan.XXXXXX")
/usr/bin/python3 - "$TRACK_FILE" "$sim" "$plan" "$now" <<'PY'
import json, re, sys
from pathlib import Path

track, sim, plan, now = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), int(sys.argv[4])
old = {}
for line in track.read_text().splitlines():
    parts = line.split('\t')
    if len(parts) >= 5:
        old[(parts[0], parts[1])] = {'first_seen': int(parts[2]), 'security': parts[3] == 'security', 'origin': parts[4]}

updates = []
for line in sim.read_text(errors='replace').splitlines():
    match = re.match(r'^Inst\s+(\S+)\s+\((\S+)\s+([^\[]+)\s+\[([^]]+)\]', line)
    if not match:
        continue
    package, version, repo, origin = match.groups()
    repo = repo.strip()
    security = 'noble-security' in repo and origin.strip().lower() == 'ubuntu'
    key = (package, version)
    prior = old.get(key)
    updates.append({'package': package, 'version': version, 'repo': repo, 'origin': origin.strip(),
                    'security': security, 'first_seen': prior['first_seen'] if prior else now})

track.write_text(''.join(f"{u['package']}\t{u['version']}\t{u['first_seen']}\t{'security' if u['security'] else 'regular'}\t{u['origin']}\n" for u in updates))
json.dump({'updates': updates}, plan.open('w'), indent=2); plan.open('a').write('\n')
PY

security_packages=$(/usr/bin/python3 - "$plan" "$now" <<'PY'
import json, sys
data = json.load(open(sys.argv[1])); now = int(sys.argv[2])
print(' '.join(u['package'] for u in data['updates'] if u['security'] and u['origin'].lower() == 'ubuntu'))
PY
)
regular_packages=$(/usr/bin/python3 - "$plan" "$now" <<'PY'
import json, sys
data = json.load(open(sys.argv[1])); now = int(sys.argv[2])
print(' '.join(u['package'] for u in data['updates'] if not u['security'] and now - u['first_seen'] >= 72 * 60 * 60 and u['origin'].lower() == 'ubuntu'))
PY
)

installed=()
errors=()
install_packages() {
  local kind="$1" packages="$2"
  [[ -n "$packages" ]] || return 0
  log "installing $kind packages: $packages"
  if DEBIAN_FRONTEND=noninteractive apt-get -y --only-upgrade install $packages >>"$LOG_FILE" 2>&1; then
    read -r -a batch <<<"$packages"
    installed+=("${batch[@]}")
  else
    errors+=("$kind package installation failed")
  fi
}
install_packages security "$security_packages"
install_packages regular "$regular_packages"

/usr/bin/python3 - "$tmp_status" "$plan" "$last_status" "$now_iso" "$run_id" "${installed[*]:-}" "${errors[*]:-}" <<'PY'
import json, sys
out, plan_path, old_text, now, run_id, installed_text, errors_text = sys.argv[1:]
plan = json.load(open(plan_path))
old = json.loads(old_text)
installed = installed_text.split() if installed_text else []
errors = errors_text.split('|') if errors_text else []
remaining = [u for u in plan['updates'] if u['package'] not in installed]
data = {
  'schema_version': 1, 'host': 'hanasand', 'run_id': run_id, 'checked_at': now,
  'status': 'failed' if errors else ('pending' if remaining else 'ok'),
  'last_error': '; '.join(errors) or None,
  'pending_updates': remaining,
  'installed_packages': [{'package': p} for p in installed],
  'last_updated_packages': installed or old.get('last_updated_packages', []),
  'last_update_at': now if installed else old.get('last_update_at'),
  'policy': {'non_security_delay_hours': 72, 'security_install': 'immediate',
             'allowed_origin': 'Ubuntu noble/noble-updates/noble-security',
             'repository_verification': 'APT Release-file signatures and Ubuntu origin allowlist'},
}
json.dump(data, open(out, 'w'), indent=2); open(out, 'a').write('\n')
PY
mv "$tmp_status" "$STATUS_FILE"
chmod 0644 "$STATUS_FILE"
log "completed: installed=${installed[*]:-none} pending=$(grep -c . "$TRACK_FILE" || true) errors=${errors[*]:-none}"
[[ ${#errors[@]} -eq 0 ]]
