import assert from 'node:assert/strict'
import { sessionNetwork } from '../src/utils/auth/sessionNetwork.ts'

for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '::1', 'fc00::1', '169.254.1.1', '100.64.0.1', 'invalid', '::ffff:127.0.0.1']) {
    assert.deepEqual(await sessionNetwork(ip), { ip: null, network: null })
}
for (const ip of ['8.8.8.8', '2001:4860:4860::8888', '::ffff:8.8.8.8']) {
    const result = await sessionNetwork(ip)
    assert(result.ip)
    assert(result.network?.country, 'Public IP must have a country')
    assert(result.network?.provider, 'Public IP must have a network provider')
    assert.match(result.network.provider, /Google/i)
}
console.log('Local IPv4/IPv6 country and provider lookups and private/invalid IP handling passed.')
