import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const script = readFileSync(new URL('../../ops/browser-worker/install-egress-firewall.sh', import.meta.url), 'utf8')

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
assert.match(script, /conntrack --ctstate RELATED,ESTABLISHED/, 'browser egress firewall should allow established control responses')

console.log('Browser egress firewall contract passed.')
