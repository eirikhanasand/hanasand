#!/bin/sh
set -eu

NETWORK="${1:-hanasand_browsernet}"
CHAIN="${HANASAND_BROWSER_EGRESS_CHAIN:-HANASAND-BROWSER-EGRESS}"
TOR_CONTAINER="${HANASAND_BROWSER_TOR_CONTAINER:-hanasand_onion_tor}"
TOR_PORT="${HANASAND_BROWSER_TOR_PORT:-9050}"

bridge_name() {
    bridge="$(docker network inspect -f '{{ index .Options "com.docker.network.bridge.name" }}' "$NETWORK" 2>/dev/null || true)"
    if [ -n "$bridge" ] && [ "$bridge" != "<no value>" ]; then
        printf '%s\n' "$bridge"
        return
    fi
    id="$(docker network inspect -f '{{ .Id }}' "$NETWORK")"
    printf 'br-%.12s\n' "$id"
}

container_ip() {
    docker inspect -f "{{ with index .NetworkSettings.Networks \"$NETWORK\" }}{{ .IPAddress }}{{ end }}" "$1" 2>/dev/null || true
}

ensure_rule() {
    table="$1"
    shift
    if "$table" -C "$@" 2>/dev/null; then
        return
    fi
    "$table" -A "$@"
}

ensure_jump() {
    table="$1"
    shift
    if "$table" -C DOCKER-USER "$@" -j "$CHAIN" 2>/dev/null; then
        return
    fi
    "$table" -I DOCKER-USER 1 "$@" -j "$CHAIN"
}

install_ipv4() {
    bridge="$1"
    tor_ip="$2"
    iptables -N "$CHAIN" 2>/dev/null || true
    iptables -F "$CHAIN"
    ensure_rule iptables "$CHAIN" -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
    if [ -n "$tor_ip" ]; then
        ensure_rule iptables "$CHAIN" -d "$tor_ip" -p tcp --dport "$TOR_PORT" -j RETURN
    fi
    for cidr in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 224.0.0.0/4 240.0.0.0/4; do
        ensure_rule iptables "$CHAIN" -d "$cidr" -j REJECT
    done
    ensure_rule iptables "$CHAIN" -j RETURN
    ensure_jump iptables -i "$bridge"
}

install_ipv6() {
    bridge="$1"
    command -v ip6tables >/dev/null 2>&1 || return 0
    ip6tables -N "$CHAIN" 2>/dev/null || true
    ip6tables -F "$CHAIN"
    ensure_rule ip6tables "$CHAIN" -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
    for cidr in ::/128 ::1/128 ::ffff:0:0/96 64:ff9b::/96 fc00::/7 fe80::/10 ff00::/8; do
        ensure_rule ip6tables "$CHAIN" -d "$cidr" -j REJECT
    done
    ensure_rule ip6tables "$CHAIN" -j RETURN
    ensure_jump ip6tables -i "$bridge"
}

bridge="$(bridge_name)"
tor_ip="$(container_ip "$TOR_CONTAINER")"
install_ipv4 "$bridge" "$tor_ip"
install_ipv6 "$bridge"

printf 'Installed browser egress firewall for %s on %s\n' "$NETWORK" "$bridge"
