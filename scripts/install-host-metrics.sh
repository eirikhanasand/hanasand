#!/bin/sh
set -eu
# Run on the monitored host. Existing API mounts expose this directory read-only.
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install -d -m 755 /var/lib/hanasand/metrics /usr/local/lib/hanasand
install -m 755 "$script_dir/host-metrics.py" /usr/local/lib/hanasand/host-metrics.py
cat > /etc/systemd/system/hanasand-host-metrics.service <<'UNIT'
[Unit]
Description=Collect Hanasand host telemetry
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/lib/hanasand/host-metrics.py
TimeoutStartSec=20
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/hanasand/metrics
UNIT
cat > /etc/systemd/system/hanasand-host-metrics.timer <<'UNIT'
[Unit]
Description=Refresh Hanasand host telemetry
[Timer]
OnBootSec=10s
OnUnitActiveSec=15s
AccuracySec=1s
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now hanasand-host-metrics.timer
systemctl start hanasand-host-metrics.service
