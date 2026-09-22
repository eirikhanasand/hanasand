#!/bin/sh
# Update an enrolled host without changing its credentials, source logs or cursors.
set -eu
release=${1:?Provide the full release commit}
case "$release" in *[!0-9a-f]*|'') exit 2;; esac
test "${#release}" -eq 40
root() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo -n "$@"; fi; }
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
node --check "$base/collector.cjs"
node -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>18||(major===18&&minor>=15)?0:1)'
root systemctl is-active --quiet hanasand-log-collector
library=/usr/local/lib/hanasand-log-collector
backup=/var/lib/hanasand-log-collector/rollback/$release
root install -d -m 0700 "$backup"
root install -m 0755 /usr/local/sbin/hanasand-log-collector "$backup/launcher"
for file in collector.cjs install.sh launcher.sh release; do
    if [ -f "$library/$file" ]; then root install -m 0644 "$library/$file" "$backup/$file"; fi
done
scratch=$(mktemp -d)
cleanup() { rm -rf -- "$scratch"; }
trap cleanup EXIT
printf '%s\n' "$release" > "$scratch/release"
rollback() {
    trap - HUP INT TERM
    root systemctl stop hanasand-log-collector
    root install -m 0755 "$backup/launcher" /usr/local/sbin/hanasand-log-collector
    # install can read the root-only backup without exposing it to the invoking user.
    for file in collector.cjs install.sh launcher.sh release; do
        root install -m 0644 "$backup/$file" "$library/$file" 2>/dev/null || true
    done
    root systemctl start hanasand-log-collector
    echo 'Collector deployment failed; previous executable restored.' >&2
    exit 1
}
trap rollback HUP INT TERM
root systemctl stop hanasand-log-collector
if ! (
    root install -d -m 0755 "$library" || exit 1
    root install -m 0644 "$base/collector.cjs" "$library/collector.cjs" || exit 1
    root install -m 0755 "$base/install.sh" "$library/install.sh" || exit 1
    root install -m 0755 "$base/launcher.sh" "$library/launcher.sh" || exit 1
    root install -m 0644 "$base/ovh-memory.conf" "$library/ovh-memory.conf" || exit 1
    root install -m 0644 "$scratch/release" "$library/release" || exit 1
    root install -m 0755 "$base/launcher.sh" /usr/local/sbin/hanasand-log-collector || exit 1
    root systemctl restart hanasand-log-collector || exit 1
); then rollback; fi
# A running PID alone is insufficient: require fresh collection and an HTTP ACK.
attempt=0
while [ "$attempt" -lt 45 ]; do
    sleep 2
    root install -m 0644 /var/lib/hanasand-log-collector/health.json "$scratch/health.json" 2>/dev/null || true
    if node "$base/collector.cjs" --verify-health "$scratch/health.json" "$release" 2>/dev/null
    then
        root systemctl is-active --quiet hanasand-log-collector || rollback
        /usr/local/sbin/hanasand-log-collector --version
        echo "Collector deployed: $release"
        exit 0
    fi
    attempt=$((attempt+1))
done
rollback
