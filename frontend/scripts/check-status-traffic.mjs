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

for (const heading of ['Data interval', 'Uptime interval', 'Current Status: Hanasand.com', 'Recent incidents']) {
    assert.match(statusClient, new RegExp(escapeRegExp(heading)), `/status should render "${heading}"`)
}

assert.match(statusClient, /const REFRESH_MS = 3000/, '/status should refresh public status every 3 seconds')
assert.match(statusClient, /const UPTIME_DAYS = 180/, '/status should show the 180-day uptime interval')

for (const rawTrafficHeading of ['Most visited subdomains', 'Top endpoints']) {
    assert.doesNotMatch(statusClient, new RegExp(escapeRegExp(rawTrafficHeading)), `/status should not expose raw traffic heading "${rawTrafficHeading}"`)
}

assert.doesNotMatch(statusPage, /getMetrics|getDomains|getTrafficMetrics/, '/status should not fetch traffic metrics for the public page')
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
