#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install -d -m 755 /var/lib/hanasand/metrics /usr/local/lib/hanasand
install -m 755 "$script_dir/pull-ovh-host-metrics.py" /usr/local/lib/hanasand/pull-ovh-host-metrics.py
cat > /etc/systemd/system/hanasand-ovh-host-metrics.service <<'UNIT'
[Unit]
Description=Read OVH host telemetry through the existing private tunnel
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/lib/hanasand/pull-ovh-host-metrics.py
TimeoutStartSec=10
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/hanasand/metrics
UNIT
cat > /etc/systemd/system/hanasand-ovh-host-metrics.timer <<'UNIT'
[Unit]
Description=Refresh OVH host telemetry
[Timer]
OnBootSec=10s
OnUnitActiveSec=15s
AccuracySec=1s
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now hanasand-ovh-host-metrics.timer
systemctl start hanasand-ovh-host-metrics.service
