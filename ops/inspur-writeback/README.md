# Inspur writeback setting

This rule applies only to the root disk on Inspur (`hanasand`), identified by WWN `0x5001b448b9107bc6`. It does not depend on the current `/dev/sda` name. The disk must expose `queue/wbt_lat_usec` before the rule can write it.

On kernel `6.8.0-136-generic`, both the default 2 ms WBT target (`2000`) and a 20 ms target (`20000`) reproduced container creation/startup delays. Observed waits linked Docker filesystem sync and container mount cleanup to throttled EXT4 writeback. Setting `0` cleared the blockage twice. This is a measured host workaround; no future kernel fix has been verified.

Setting `0` disables writeback throttling's read-latency protection, so write-heavy traffic can increase read latency. It does not disable fsync, FUA, or cache flushing, and does not change filesystem or database durability settings. Keep monitoring application readiness, disk latency, and replication lag.

## Install

Run as root on Inspur from the repository root, after checking the host and disk identity. Runtime validation and any immediate sysfs write are separate, coordinated maintenance actions: on this kernel, changing WBT freezes and quiesces the device queue first and can itself wait for outstanding I/O.

```sh
set -eu
test "$(id -u)" = 0
test "$(hostname -s)" = hanasand
test -b /dev/disk/by-id/wwn-0x5001b448b9107bc6
install -o root -g root -m 0644 \
  ops/inspur-writeback/99-hanasand-inspur-writeback.rules \
  /etc/udev/rules.d/99-hanasand-inspur-writeback.rules
udevadm control --reload-rules
```

Reloading rules does not change the running queue setting. The rule applies on matching disk add/change events, including the next boot. Do not trigger all devices to apply this rule during traffic.

## Rollback

Remove only `/etc/udev/rules.d/99-hanasand-inspur-writeback.rules`, then run `udevadm control --reload-rules` as root. Removal and reload do not restore the current runtime value.

Defer restoring the original runtime value `2000` until the kernel and workload have been validated in a coordinated maintenance window. Resolve the disk through `/dev/disk/by-id/wwn-0x5001b448b9107bc6`, confirm its identity, and restore that disk's `queue/wbt_lat_usec` only. Do not issue repeated writes if the first blocks; a userspace timeout cannot guarantee that a kernel-blocked write or rollback has completed. Verify container creation **and startup**, application readiness, disk latency, and replication after restoration before calling it recovered.
