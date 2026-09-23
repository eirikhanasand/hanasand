#!/bin/sh
# Installs only the passive observer. The database wrapper rollout is separate.
set -eu
test "$(id -u)" = 0
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
artifact="$base/pg-readiness-observer.cjs"
if [ ! -f "$artifact" ]; then artifact="$base/dist/pg-readiness-observer.cjs"; fi
/usr/bin/node --check "$artifact"
install -d -m 0700 /var/lib/hanasand-log-collector/readiness
install -d -m 0755 /usr/local/lib/hanasand-log-collector
install -m 0644 "$artifact" /usr/local/lib/hanasand-log-collector/pg-readiness-observer.cjs
install -m 0644 "$base/readiness-observer.service" /etc/systemd/system/hanasand-readiness-observer.service
systemctl daemon-reload
systemctl enable hanasand-readiness-observer.service
systemctl restart hanasand-readiness-observer.service
systemctl is-active --quiet hanasand-readiness-observer.service
