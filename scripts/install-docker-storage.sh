#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install -d -m 750 -o 1000 -g 1000 /var/lib/hanasand/docker-storage
install -d -m 755 /usr/local/lib/hanasand
install -m 755 "$script_dir/docker-storage.py" /usr/local/lib/hanasand/docker-storage.py
for mode in refresh cleanup; do
 extra=''
 if test "$mode" = cleanup; then extra=' --clear'; fi
 cat > "/etc/systemd/system/hanasand-docker-storage-$mode.service" <<UNIT
[Unit]
Description=Hanasand Docker storage $mode
After=docker.service
[Service]
Type=oneshot
User=hanasand
SupplementaryGroups=docker
ExecStart=/usr/bin/python3 /usr/local/lib/hanasand/docker-storage.py$extra
TimeoutStartSec=2h
Nice=10
IOSchedulingClass=idle
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
ReadWritePaths=/var/lib/hanasand/docker-storage
UNIT
done
cat > /etc/systemd/system/hanasand-docker-storage-refresh.timer <<'UNIT'
[Unit]
Description=Refresh Docker storage sizes
[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
UNIT
cat > /etc/systemd/system/hanasand-docker-storage-cleanup.timer <<'UNIT'
[Unit]
Description=Clean unused Docker storage at 03:00 Oslo time
[Timer]
OnCalendar=*-*-* 03:00:00 Europe/Oslo
Persistent=true
AccuracySec=1s
[Install]
WantedBy=timers.target
UNIT
cat > /etc/systemd/system/hanasand-docker-storage-cleanup.path <<'UNIT'
[Unit]
Description=Process dashboard Docker cleanup requests
[Path]
PathExists=/var/lib/hanasand/docker-storage/request.json
Unit=hanasand-docker-storage-cleanup.service
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now hanasand-docker-storage-refresh.timer hanasand-docker-storage-cleanup.timer hanasand-docker-storage-cleanup.path
systemctl start --no-block hanasand-docker-storage-refresh.service
