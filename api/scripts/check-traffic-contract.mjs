import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const legacy = await read('src/handlers/traffic/legacy.ts')
const recorder = await read('src/utils/traffic/recordTraffic.ts')
const schema = await read('src/utils/db/ensureSchema.ts')
const dockerfile = await read('Dockerfile')

for (const endpoint of [
    'getLegacyTrafficSummary',
    'getLegacyTrafficRecent',
    'getLegacyTrafficTps',
    'getLegacyTrafficIps',
    'getLegacyTrafficUserAgents',
    'getLegacyTrafficDomains',
    'getLegacyTrafficMetrics',
    'getLegacyTrafficRecords',
]) {
    assert.match(legacy, new RegExp(`export async function ${endpoint}`), `${endpoint} should be backed by async aggregation`)
}

assert.match(recorder, /INSERT INTO traffic_events/, 'requests should be persisted as traffic_events')
assert.match(recorder, /ignoredPathPrefixes/, 'traffic recording should avoid self-amplifying status/traffic endpoints')
assert.match(schema, /CREATE TABLE IF NOT EXISTS traffic_events/, 'traffic_events should be created at API startup')
assert.match(dockerfile, /RUN bun run test/, 'API Docker build must run the test gate before startup image is produced')

console.log('API traffic contract checks passed.')

function read(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8')
}
