import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/solutions/dwm/pageClient.tsx', import.meta.url), 'utf8')

for (const token of [
    'data-dwm-evidence-boundary',
    'Coverage boundary',
    'Verified today',
    'Example alert shape',
    'Needs tenant connection',
    'Public intelligence search returns recent ransomware and extortion records',
    'Session, token, API-key, and webhook examples show the alert shape',
    'tenant watchlist and approved source record support them',
    'Customer alerts require an approved source, a watchlist match, and safe-field review',
]) {
    assert.ok(source.includes(token), `DWM public page missing evidence boundary token: ${token}`)
}

for (const staleCopy of [
    'Active session cookie · Okta',
    'AWS IAM key · scope:* admin',
    '12 live tokens',
]) {
    assert.ok(!source.includes(staleCopy), `DWM public page still presents preview data as live: ${staleCopy}`)
}

const verifiedIndex = source.indexOf('Verified today')
const previewIndex = source.indexOf('Example alert shape')
const gatedIndex = source.indexOf('Needs tenant connection')

assert.ok(verifiedIndex >= 0 && previewIndex > verifiedIndex, 'DWM coverage boundary should show verified evidence before preview examples.')
assert.ok(gatedIndex > previewIndex, 'DWM coverage boundary should show tenant-gated collection after preview examples.')

console.log('dwm public evidence boundary ok')
