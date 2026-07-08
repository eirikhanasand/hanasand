import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const scriptUrl = new URL('../../ops/browser-worker/install-egress-firewall.sh', import.meta.url)
if (!existsSync(scriptUrl)) {
    console.log('Browser egress firewall contract skipped outside the repository root.')
    process.exit(0)
}
const script = readFileSync(scriptUrl, 'utf8')

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
assert.match(script, /-s "\$api_ip" -p tcp --dport 8081 -j RETURN/, 'browser egress firewall should still allow API-initiated worker websocket control traffic')
assert.match(script, /conntrack --ctstate RELATED,ESTABLISHED/, 'browser egress firewall should allow established control responses')

console.log('Browser egress firewall contract passed.')
