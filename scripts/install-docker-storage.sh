#!/bin/sh
set -eu
case "${1:-}" in ''|--install-only) ;; *) exit 2 ;; esac
as_root() {
 if test "$(id -u)" = 0; then "$@"; else sudo -n "$@"; fi
}
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
as_root install -d -m 750 -o 1000 -g 1000 /var/lib/hanasand/docker-storage
as_root install -d -m 755 /usr/local/lib/hanasand
as_root install -m 755 "$script_dir/docker-storage.py" /usr/local/lib/hanasand/docker-storage.py
for mode in refresh cleanup; do
 extra=''
 if test "$mode" = cleanup; then extra=' --clear'; fi
 as_root tee "/etc/systemd/system/hanasand-docker-storage-$mode.service" >/dev/null <<UNIT
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
as_root tee /etc/systemd/system/hanasand-docker-storage-refresh.timer >/dev/null <<'UNIT'
[Unit]
Description=Refresh Docker storage sizes
[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
UNIT
as_root tee /etc/systemd/system/hanasand-docker-storage-cleanup.timer >/dev/null <<'UNIT'
[Unit]
Description=Clean unused Docker storage at 03:00 Oslo time
[Timer]
OnCalendar=*-*-* 03:00:00 Europe/Oslo
Persistent=true
AccuracySec=1s
[Install]
WantedBy=timers.target
UNIT
as_root tee /etc/systemd/system/hanasand-docker-storage-cleanup.path >/dev/null <<'UNIT'
[Unit]
Description=Process dashboard Docker cleanup requests
[Path]
PathExists=/var/lib/hanasand/docker-storage/request.json
Unit=hanasand-docker-storage-cleanup.service
[Install]
WantedBy=multi-user.target
UNIT
as_root systemctl daemon-reload
as_root systemctl enable hanasand-docker-storage-refresh.timer hanasand-docker-storage-cleanup.timer hanasand-docker-storage-cleanup.path
if test "${1:-}" != --install-only; then
 as_root systemctl start hanasand-docker-storage-refresh.timer hanasand-docker-storage-cleanup.timer hanasand-docker-storage-cleanup.path
 as_root systemctl start --no-block hanasand-docker-storage-refresh.service
fi
