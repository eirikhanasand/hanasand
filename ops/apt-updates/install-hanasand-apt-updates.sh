#!/usr/bin/env bash
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
repo_root=${1:-/home/hanasand/hanasand}
install -d -m 0755 /var/lib/hanasand/apt-updates
install -m 0755 "$repo_root/ops/apt-updates/hanasand-apt-update.sh" /usr/local/sbin/hanasand-apt-update
install -m 0644 "$repo_root/ops/apt-updates/hanasand-apt-updates.service" /etc/systemd/system/hanasand-apt-updates.service
install -m 0644 "$repo_root/ops/apt-updates/hanasand-apt-updates.timer" /etc/systemd/system/hanasand-apt-updates.timer
systemctl daemon-reload
systemctl enable --now hanasand-apt-updates.timer
systemctl start hanasand-apt-updates.service
systemctl --no-pager --full status hanasand-apt-updates.timer
