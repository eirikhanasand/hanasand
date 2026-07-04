import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const client = await readFile('src/utils/pwned/checkHash.ts', 'utf8')
const route = await readFile('src/app/api/pwned/route.ts', 'utf8')

assert.match(client, /fetch\('\/api\/pwned'/, 'Bloom page client should use the same-origin pwned route')
assert.doesNotMatch(client, /config\.url\.api.*pwned/, 'Bloom page client should not call api.hanasand.com directly from the browser')
assert.match(client, /body: JSON\.stringify\(\{ prefix \}\)/, 'Pwned client should send only the hash prefix to the same-origin route')
assert.match(client, /checkedPrefix: prefix/, 'Pwned client should expose the checked prefix for the result UI')
assert.doesNotMatch(client, /body: JSON\.stringify\(\{ password \}\)/, 'Pwned client should never send the raw password')
assert.match(client, /normalizeSha1Hash/, 'Pwned client should require a caller-provided SHA-1 hash')
assert.doesNotMatch(client, /window\.crypto\.subtle\.digest/, 'Pwned client should not collect and hash raw secrets in the browser')
assert.match(route, /HIBP_PWNED_RANGE_API/, 'Same-origin route should proxy to the configured HIBP range API')
assert.match(route, /\^\[A-F0-9\]\{5\}\$/, 'Same-origin route should validate the five-character SHA-1 prefix')
assert.match(route, /Add-Padding/, 'Same-origin route should request padded range responses')
assert.match(route, /Unable to check the Bloom exposure dataset right now\./, 'Same-origin route should preserve an actionable unavailable state')

console.log('Pwned proxy route checks passed.')
