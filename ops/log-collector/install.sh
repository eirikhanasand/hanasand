#!/bin/sh
set -eu
test "$(id -u)" = 0
host=${1:?Provide the managed host identifier}
case "$host" in *[!a-zA-Z0-9_./-]*|'') exit 2;; esac
mode=${2:-host}
if ! command -v auditctl >/dev/null 2>&1; then
    # Prefer the authenticated package cache; do not let an unavailable mirror
    # leave enrollment running indefinitely in a guest.
    if ! timeout 120 env DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=1 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 install -y auditd; then
        timeout 60 apt-get -o Acquire::Retries=0 -o Acquire::http::Timeout=15 -o Acquire::https::Timeout=15 update -qq
        timeout 120 env DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=1 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 install -y auditd
    fi
fi
install -d -m 0700 /etc/hanasand /var/lib/hanasand-log-collector
install -m 0755 "$(dirname "$0")/collector.py" /usr/local/sbin/hanasand-log-collector
if [ "$mode" != --guest ]; then
    install -d -m 0755 /usr/local/lib/hanasand-log-collector
    install -m 0755 "$0" /usr/local/lib/hanasand-log-collector/install.sh
    install -m 0755 "$(dirname "$0")/retention.py" /usr/local/lib/hanasand-log-collector/retention.py
fi
# Persistent exec auditing includes all users, services and noninteractive executions.
cat > /etc/audit/rules.d/hanasand-exec.rules <<'RULES'
-a always,exit -F arch=b64 -S execve,execveat -k hanasand_exec
RULES
case "$(uname -m)" in
    x86_64) printf '%s\n' '-a always,exit -F arch=b32 -S execve,execveat -k hanasand_exec' >> /etc/audit/rules.d/hanasand-exec.rules;;
esac
systemctl enable --now auditd
python3 "$(dirname "$0")/retention.py"
augenrules --load
# Guests expose telemetry only over the host management channel. No ingest token is copied.
if [ "$mode" = --guest ]; then exit 0; fi
cat > /etc/systemd/system/hanasand-log-collector.service <<'UNIT'
[Unit]
Description=Hanasand host and guest event collection
After=network-online.target auditd.service
Wants=network-online.target
[Service]
Type=simple
ExecStart=/usr/local/sbin/hanasand-log-collector
Restart=always
RestartSec=10
User=root
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/hanasand-log-collector
SyslogIdentifier=hanasand-log-collector
[Install]
WantedBy=multi-user.target
UNIT
# Audit replay must not compete at equal disk priority with the OVH replica.
if [ "$host" = ovhcloud ]; then
    install -d -m 0755 /etc/systemd/system/hanasand-log-collector.service.d
    cat > /etc/systemd/system/hanasand-log-collector.service.d/io-priority.conf <<'PRIORITY'
[Service]
IOSchedulingClass=best-effort
IOSchedulingPriority=7
PRIORITY
fi
systemctl daemon-reload
# Configuration is installed separately with the existing internal ingestion token.
test -f /etc/hanasand/log-collector.json
systemctl enable hanasand-log-collector
