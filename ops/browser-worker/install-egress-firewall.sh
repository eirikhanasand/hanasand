#!/bin/sh
set -eu

NETWORK="${1:-hanasand_browsernet}"
CHAIN="${HANASAND_BROWSER_EGRESS_CHAIN:-HANASAND-BROWSER-EGRESS}"
TOR_CONTAINER="${HANASAND_BROWSER_TOR_CONTAINER:-hanasand_onion_tor}"
API_CONTAINER="${HANASAND_BROWSER_API_CONTAINER:-hanasand_api}"
TOR_PORT="${HANASAND_BROWSER_TOR_PORT:-9050}"
TURN_CONTAINER="${HANASAND_BROWSER_TURN_CONTAINER:-hanasand_browser_turn}"
TURN_PORT="${HANASAND_BROWSER_TURN_PORT:-3478}"
TURN_RELAY_PORTS="${HANASAND_BROWSER_TURN_RELAY_PORTS:-49152:49252}"

# Same-bridge container traffic otherwise bypasses Docker's forwarding rules.
modprobe br_netfilter
sysctl -w net.bridge.bridge-nf-call-iptables=1
sysctl -w net.bridge.bridge-nf-call-ip6tables=1

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
    "$table" -N DOCKER-USER 2>/dev/null || true
    if ! "$table" -C FORWARD -j DOCKER-USER 2>/dev/null; then
        "$table" -I FORWARD 1 -j DOCKER-USER
    fi
    if "$table" -C DOCKER-USER "$@" -j "$CHAIN" 2>/dev/null; then
        return
    fi
    "$table" -I DOCKER-USER 1 "$@" -j "$CHAIN"
}

install_host_guard() {
    table="$1"
    bridge="$2"
    host_chain="${CHAIN}-HOST"
    "$table" -N "$host_chain" 2>/dev/null || true
    "$table" -F "$host_chain"
    # Allow replies to host-initiated browser control, never worker-initiated
    # connections to services listening on the bridge gateway or host address.
    ensure_rule "$table" "$host_chain" -m conntrack --ctstate RELATED,ESTABLISHED --ctdir REPLY -j ACCEPT
    ensure_rule "$table" "$host_chain" -j REJECT
    if ! "$table" -C INPUT -i "$bridge" -j "$host_chain" 2>/dev/null; then
        "$table" -I INPUT 1 -i "$bridge" -j "$host_chain"
    fi
}

install_ipv4() {
    bridge="$1"
    tor_ip="$2"
    api_ip="$3"
    iptables -N "$CHAIN" 2>/dev/null || true
    iptables -F "$CHAIN"
    ensure_rule iptables "$CHAIN" -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
    if [ -n "$tor_ip" ]; then
        ensure_rule iptables "$CHAIN" -d "$tor_ip" -p tcp --dport "$TOR_PORT" -j RETURN
    fi
    # Public TURN connections are DNATed to this private address by Docker.
    for protocol in tcp udp; do
        ensure_rule iptables "$CHAIN" -d "$turn_ip" -p "$protocol" --dport "$TURN_PORT" -j RETURN
    done
    ensure_rule iptables "$CHAIN" -d "$turn_ip" -p udp --dport "$TURN_RELAY_PORTS" -j RETURN
    ensure_rule iptables "$CHAIN" -s "$turn_ip" ! -d "$api_ip" -p udp --sport "$TURN_RELAY_PORTS" -j RETURN
    if [ -n "$api_ip" ]; then
        ensure_rule iptables "$CHAIN" ! -s "$api_ip" -d "$api_ip" -j REJECT
        for port in 8080 8090 9081; do
            ensure_rule iptables "$CHAIN" -s "$api_ip" -p tcp --dport "$port" -j RETURN
        done
    fi
    for cidr in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 224.0.0.0/4 240.0.0.0/4; do
        ensure_rule iptables "$CHAIN" -d "$cidr" -j REJECT
    done
    ensure_rule iptables "$CHAIN" -j RETURN
    ensure_jump iptables -i "$bridge"
    install_host_guard iptables "$bridge"
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
    install_host_guard ip6tables "$bridge"
}

bridge="$(bridge_name)"
tor_ip="$(container_ip "$TOR_CONTAINER")"
api_ip="$(container_ip "$API_CONTAINER")"
turn_ip="$(container_ip "$TURN_CONTAINER")"
[ -n "$tor_ip" ] || { printf 'FAIL: could not resolve Tor container %s on %s\n' "$TOR_CONTAINER" "$NETWORK" >&2; exit 1; }
[ -n "$api_ip" ] || { printf 'FAIL: could not resolve API container %s on %s\n' "$API_CONTAINER" "$NETWORK" >&2; exit 1; }
[ -n "$turn_ip" ] || { printf 'FAIL: could not resolve TURN container %s on %s\n' "$TURN_CONTAINER" "$NETWORK" >&2; exit 1; }
install_ipv4 "$bridge" "$tor_ip" "$api_ip"
install_ipv6 "$bridge"

printf 'Installed browser egress firewall for %s on %s\n' "$NETWORK" "$bridge"
