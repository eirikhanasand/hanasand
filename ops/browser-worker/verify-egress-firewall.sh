#!/bin/sh
set -eu

NETWORK="${1:-hanasand_browsernet}"
CHAIN="${HANASAND_BROWSER_EGRESS_CHAIN:-HANASAND-BROWSER-EGRESS}"
TOR_CONTAINER="${HANASAND_BROWSER_TOR_CONTAINER:-hanasand_onion_tor}"
API_CONTAINER="${HANASAND_BROWSER_API_CONTAINER:-hanasand_api}"
TOR_PORT="${HANASAND_BROWSER_TOR_PORT:-9050}"

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    exit 1
}

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

has_rule() {
    table="$1"
    shift
    "$table" -C "$@" 2>/dev/null
}

bridge="$(bridge_name)"
tor_ip="$(container_ip "$TOR_CONTAINER")"
api_ip="$(container_ip "$API_CONTAINER")"

[ -n "$tor_ip" ] || fail "could not resolve Tor container $TOR_CONTAINER on $NETWORK"
[ -n "$api_ip" ] || fail "could not resolve API container $API_CONTAINER on $NETWORK"
has_rule iptables DOCKER-USER -i "$bridge" -j "$CHAIN" || fail "DOCKER-USER does not jump from $bridge to $CHAIN"
has_rule iptables "$CHAIN" -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN || fail "$CHAIN does not allow established control responses"
has_rule iptables "$CHAIN" -d "$tor_ip" -p tcp --dport "$TOR_PORT" -j RETURN || fail "$CHAIN does not allow Tor SOCKS at $tor_ip:$TOR_PORT"
has_rule iptables "$CHAIN" ! -s "$api_ip" -d "$api_ip" -j REJECT || fail "$CHAIN does not block browser-worker initiated API access to $api_ip"
for port in 8080 8090 9081; do
    has_rule iptables "$CHAIN" -s "$api_ip" -p tcp --dport "$port" -j RETURN || fail "$CHAIN does not allow API browser stream/control traffic on $port"
done

for cidr in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 224.0.0.0/4 240.0.0.0/4; do
    has_rule iptables "$CHAIN" -d "$cidr" -j REJECT || fail "$CHAIN does not reject $cidr"
done

if command -v ip6tables >/dev/null 2>&1; then
    has_rule ip6tables DOCKER-USER -i "$bridge" -j "$CHAIN" || fail "IPv6 DOCKER-USER does not jump from $bridge to $CHAIN"
    for cidr in ::/128 ::1/128 ::ffff:0:0/96 64:ff9b::/96 fc00::/7 fe80::/10 ff00::/8; do
        has_rule ip6tables "$CHAIN" -d "$cidr" -j REJECT || fail "IPv6 $CHAIN does not reject $cidr"
    done
fi

printf 'Browser egress firewall verified for %s on %s\n' "$NETWORK" "$bridge"
