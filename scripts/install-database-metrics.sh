#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
sudo -n install -d -m 755 /var/lib/hanasand/metrics /usr/local/lib/hanasand
sudo -n install -m 755 "$script_dir/database-metrics.py" /usr/local/lib/hanasand/database-metrics.py
sudo -n install -m 755 "$script_dir/database-redis-writes.py" /usr/local/lib/hanasand/database-redis-writes.py
sudo -n tee /etc/systemd/system/hanasand-database-redis-writes.service > /dev/null <<'UNIT'
[Unit]
Description=Observe Redis write timestamps without retaining values
After=docker.service
[Service]
ExecStart=/usr/bin/python3 /usr/local/lib/hanasand/database-redis-writes.py
Restart=always
RestartSec=10
MemoryMax=192M
CPUQuota=25%
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/hanasand/metrics
[Install]
WantedBy=multi-user.target
UNIT
sudo -n tee /etc/systemd/system/hanasand-database-metrics.service > /dev/null <<'UNIT'
[Unit]
Description=Collect database sizes and disk growth
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/lib/hanasand/database-metrics.py
TimeoutStartSec=90
Nice=10
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/hanasand/metrics
UNIT
sudo -n tee /etc/systemd/system/hanasand-database-metrics.timer > /dev/null <<'UNIT'
[Unit]
Description=Refresh database storage inventory
[Timer]
OnBootSec=20s
OnUnitInactiveSec=60s
[Install]
WantedBy=timers.target
UNIT
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now hanasand-database-metrics.timer
sudo -n systemctl enable --now hanasand-database-redis-writes.service
sudo -n systemctl start hanasand-database-metrics.service
