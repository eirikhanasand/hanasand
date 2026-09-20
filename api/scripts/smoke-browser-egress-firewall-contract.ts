import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const scriptUrl = new URL('../../ops/browser-worker/install-egress-firewall.sh', import.meta.url)
const verifyScriptUrl = new URL('../../ops/browser-worker/verify-egress-firewall.sh', import.meta.url)
if (!existsSync(scriptUrl)) {
    console.log('Browser egress firewall contract skipped outside the repository root.')
    process.exit(0)
}
const script = readFileSync(scriptUrl, 'utf8')
const verifyScript = readFileSync(verifyScriptUrl, 'utf8')

for (const value of [
    '0.0.0.0/8',
    '10.0.0.0/8',
    '100.64.0.0/10',
    '127.0.0.0/8',
    '169.254.0.0/16',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '224.0.0.0/4',
    '240.0.0.0/4',
    '::ffff:0:0/96',
    '64:ff9b::/96',
    'fc00::/7',
    'fe80::/10',
    'ff00::/8',
]) {
    assert(script.includes(value), `browser egress firewall should reject ${value}`)
}

assert.match(script, /DOCKER-USER/, 'browser egress firewall should hook Docker forwarding')
assert.match(script, /HANASAND-BROWSER-EGRESS/, 'browser egress firewall should isolate rules in its own chain')
assert.match(script, /TOR_PORT.*9050/, 'browser egress firewall should preserve Tor SOCKS access')
assert.match(script, /HANASAND_BROWSER_API_CONTAINER:-hanasand_api/, 'browser egress firewall should identify the API container on the browser network')
assert.match(script, /could not resolve Tor container/, 'browser egress firewall should fail closed when Tor is not on the browser network')
assert.match(script, /could not resolve API container/, 'browser egress firewall should fail closed when API is not on the browser network')
assert.match(script, /! -s "\$api_ip" -d "\$api_ip" -j REJECT/, 'browser egress firewall should block browser-worker initiated traffic to the privileged API container')
assert.match(script, /for port in 8080 8090 9081/, 'browser egress firewall should allow API-initiated stream, control, and metrics traffic')
assert.match(script, /conntrack --ctstate RELATED,ESTABLISHED/, 'browser egress firewall should allow established control responses')
assert.match(verifyScript, /DOCKER-USER/, 'browser egress verifier should check Docker forwarding')
assert.match(verifyScript, /HANASAND-BROWSER-EGRESS/, 'browser egress verifier should check the dedicated chain')
assert.match(verifyScript, /does not block browser-worker initiated API access/, 'browser egress verifier should prove workers cannot call the privileged API')
assert.match(verifyScript, /Browser egress firewall verified/, 'browser egress verifier should print a clear success line')

for (const setting of ['net.bridge.bridge-nf-call-iptables', 'net.bridge.bridge-nf-call-ip6tables']) {
    assert(script.includes(`sysctl -w ${setting}=1`), 'same-bridge traffic must pass through the firewall')
    assert(verifyScript.includes(`sysctl -n ${setting}`), 'verification must reject disabled bridge filtering')
}
assert.match(script, /modprobe br_netfilter/, 'load bridge filtering before installing rules')
assert.match(script, /-I INPUT 1 -i "\$bridge" -j "\$host_chain"/, 'guard host services as well as forwarded containers')
assert.match(script, /--ctstate RELATED,ESTABLISHED --ctdir REPLY -j ACCEPT/, 'host guard must only accept replies to host-initiated connections')
for (const source of [script, verifyScript]) {
    assert(source.includes('HANASAND_BROWSER_TURN_CONTAINER:-hanasand_browser_turn'), 'identify the dedicated live video relay')
    assert(source.includes('-d "$turn_ip" -p udp --dport "$TURN_RELAY_PORTS" -j RETURN'), 'preserve negotiated relay destinations')
    assert(source.includes('-s "$turn_ip" ! -d "$api_ip" -p udp --sport "$TURN_RELAY_PORTS" -j RETURN'), 'allow relay video without permitting delivery to the API')
    assert(source.includes('-d "$turn_public_ip" -p udp --dport "$TURN_RELAY_PORTS" -j ACCEPT'), 'host TURN exceptions must be limited to its public address and relay ports')
}
const service = readFileSync(new URL('../../ops/browser-worker/hanasand-browser-egress.service', import.meta.url), 'utf8')
assert(service.includes('PartOf=docker.service') && service.includes('WantedBy=multi-user.target docker.service'), 'restore isolation after boot and Docker restart')
assert(service.includes('ExecStartPost=/bin/sh /home/hanasand/hanasand/ops/browser-worker/verify-egress-firewall.sh'), 'service must fail when firewall verification fails')

console.log('Browser egress firewall contract passed.')
