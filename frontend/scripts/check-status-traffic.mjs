import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(root, '..')

const statusClient = await read('src/app/status/pageClient.tsx')
const statusPage = await read('src/app/status/page.tsx')
const dockerfile = await read('Dockerfile')
const apiTraffic = await readFromRepo('api/src/handlers/traffic/legacy.ts')
const apiSchema = await readFromRepo('api/src/utils/db/ensureSchema.ts')

for (const heading of ['Live traffic', 'Most visited subdomains', 'Top endpoints']) {
    assert.match(statusClient, new RegExp(escapeRegExp(heading)), `/status should render "${heading}"`)
}

for (const emptyState of [
    'Waiting for the first live traffic reading.',
    'Subdomain rankings will appear after traffic is recorded.',
    'Endpoint rankings will appear after traffic is recorded.',
]) {
    assert.match(statusClient, new RegExp(escapeRegExp(emptyState)), `/status should not look missing when ${emptyState}`)
}

assert.match(statusPage, /monitoringPayload\?\.top_paths/, '/status should fall back to monitoring top_paths when legacy endpoint data is empty')
assert.match(statusPage, /monitoringPayload\?\.top_domains/, '/status should fall back to monitoring top_domains when legacy endpoint data is empty')
assert.match(apiTraffic, /FROM traffic_events/, 'traffic compatibility endpoints should aggregate recorded traffic events')
const summaryBody = apiTraffic.slice(
    apiTraffic.indexOf('export async function getLegacyTrafficSummary'),
    apiTraffic.indexOf('export async function getLegacyTrafficRecent')
)
assert.doesNotMatch(summaryBody, /return res\.send\(\[\]\)/, 'traffic summary must not hard-code an empty response')
assert.match(apiSchema, /CREATE TABLE IF NOT EXISTS traffic_events/, 'startup schema should create traffic_events')
assert.match(dockerfile, /RUN bun run test/, 'frontend Docker build must run the test gate before building')

console.log('Status traffic checks passed.')

function read(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8')
}

function readFromRepo(relativePath) {
    return readFile(path.join(repoRoot, relativePath), 'utf8')
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
