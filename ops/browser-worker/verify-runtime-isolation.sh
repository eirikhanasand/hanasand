#!/bin/sh
set -eu

LABEL="${HANASAND_BROWSER_SESSION_LABEL:-com.hanasand.role=browser-session-worker}"
NETWORK="${HANASAND_BROWSER_NETWORK:-hanasand_browsernet}"
FIREWALL_CHAIN="${HANASAND_BROWSER_EGRESS_CHAIN:-HANASAND-BROWSER-EGRESS}"
API_CONTAINER="${HANASAND_API_CONTAINER:-hanasand_api}"
PIDS_LIMIT="${HANASAND_BROWSER_PIDS_LIMIT:-512}"

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    exit 1
}

contains() {
    case "$1" in
        *"$2"*) return 0 ;;
        *) return 1 ;;
    esac
}

container_id="${1:-}"
if [ -z "$container_id" ]; then
    container_id="$(docker ps --filter "label=$LABEL" --format '{{.ID}}' | head -n 1)"
fi
[ -n "$container_id" ] || fail "no running browser session worker found"

inspect="$(docker inspect "$container_id")"
user="$(docker inspect -f '{{ .Config.User }}' "$container_id")"
readonly_root="$(docker inspect -f '{{ .HostConfig.ReadonlyRootfs }}' "$container_id")"
init_enabled="$(docker inspect -f '{{ .HostConfig.Init }}' "$container_id")"
auto_remove="$(docker inspect -f '{{ .HostConfig.AutoRemove }}' "$container_id")"
network_mode="$(docker inspect -f '{{ .HostConfig.NetworkMode }}' "$container_id")"
mounts="$(docker inspect -f '{{ json .Mounts }}' "$container_id")"
env="$(docker inspect -f '{{ range .Config.Env }}{{ . }}{{ "\n" }}{{ end }}' "$container_id")"
security="$(docker inspect -f '{{ json .HostConfig.SecurityOpt }}' "$container_id")"
cap_drop="$(docker inspect -f '{{ json .HostConfig.CapDrop }}' "$container_id")"
pids_limit="$(docker inspect -f '{{ .HostConfig.PidsLimit }}' "$container_id")"

[ "$user" = "bun" ] || fail "browser worker user is $user, expected bun"
[ "$init_enabled" = "true" ] || fail "Docker init is not enabled for browser worker"
[ "$auto_remove" = "true" ] || fail "browser worker does not auto-remove after exit"
[ "$readonly_root" = "true" ] || fail "root filesystem is not read-only"
[ "$network_mode" = "$NETWORK" ] || fail "browser worker is on $network_mode, expected $NETWORK"
contains "$cap_drop" '"ALL"' || fail "Linux capabilities are not fully dropped"
contains "$security" 'seccomp=' || fail "seccomp profile is missing"
contains "$security" 'apparmor=docker-default' || fail "AppArmor profile is missing"
contains "$security" 'no-new-privileges' || fail "no-new-privileges is missing"
contains "$mounts" '[]' || fail "browser worker has host mounts: $mounts"
[ "$pids_limit" = "$PIDS_LIMIT" ] || fail "browser worker PID limit is $pids_limit, expected $PIDS_LIMIT"

for forbidden in DB_PASSWORD DB_HOST VM_API_TOKEN MAIL_ADMIN_PASSWORD API_SSH_KEY DOCKER_HOST; do
    if printf '%s\n' "$env" | grep -q "^$forbidden="; then
        fail "forbidden environment variable present: $forbidden"
    fi
done

if docker exec "$container_id" sh -lc "ps -ef | grep chromium | grep -v grep | grep -- --no-sandbox" >/dev/null 2>&1; then
    fail "Chromium is running with --no-sandbox"
fi

if ! docker exec "$container_id" sh -lc "ps -ef | grep chromium | grep -v grep" >/dev/null 2>&1; then
    fail "Chromium is not running in the browser worker"
fi

if docker ps --format '{{.Names}}' | grep -qx "$API_CONTAINER"; then
    if docker exec "$API_CONTAINER" sh -lc "ps -ef | grep chromium | grep -v grep" >/dev/null 2>&1; then
        fail "Chromium is running inside the main API container"
    fi
    if docker exec "$API_CONTAINER" sh -lc "command -v chromium || command -v chromium-browser" >/dev/null 2>&1; then
        fail "Chromium is installed inside the main API container"
    fi
fi

if ! iptables -S DOCKER-USER 2>/dev/null | grep -q "$FIREWALL_CHAIN"; then
    fail "DOCKER-USER does not jump to $FIREWALL_CHAIN"
fi

for blocked in 10.0.0.0/8 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16; do
    iptables -S "$FIREWALL_CHAIN" 2>/dev/null | grep -q -- "-d $blocked" || fail "firewall chain does not block $blocked"
done

if command -v ip6tables >/dev/null 2>&1; then
    for blocked in ::ffff:0:0/96 64:ff9b::/96 fc00::/7 fe80::/10; do
        ip6tables -S "$FIREWALL_CHAIN" 2>/dev/null | grep -q -- "-d $blocked" || fail "IPv6 firewall chain does not block $blocked"
    done
fi

printf 'Browser runtime isolation verified for %s\n' "$container_id"
