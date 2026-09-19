#!/bin/sh
set -eu
# Run on the monitored host. Existing API mounts expose this directory read-only.
destination=${1:-/var/lib/hanasand/metrics/host.json}
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install -d -m 755 "$(dirname "$destination")" /var/lib/hanasand/metrics /usr/local/lib/hanasand
install -m 755 "$script_dir/host-metrics.py" /usr/local/lib/hanasand/host-metrics.py
cat > /etc/systemd/system/hanasand-host-metrics.service <<UNIT
[Unit]
Description=Collect Hanasand host telemetry
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/lib/hanasand/host-metrics.py ${destination}
TimeoutStartSec=20
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
ReadWritePaths=${destination%/*}
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

# Directory scans are independent of the fast health telemetry timer.
install -m 755 "$script_dir/disk-directories.py" /usr/local/lib/hanasand/disk-directories.py
cat > /etc/systemd/system/hanasand-disk-directories.service <<UNIT
[Unit]
Description=Collect largest directories on high-usage filesystems
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/lib/hanasand/disk-directories.py ${destination}
TimeoutStartSec=10min
Nice=19
IOSchedulingClass=idle
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${destination%/*}
UNIT
cat > /etc/systemd/system/hanasand-disk-directories.timer <<'UNIT'
[Unit]
Description=Refresh disk incident diagnostics
[Timer]
OnBootSec=30s
OnUnitActiveSec=15min
AccuracySec=10s
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now hanasand-disk-directories.timer
systemctl start --no-block hanasand-disk-directories.service
