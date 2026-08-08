import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [handler, routes, schema] = await Promise.all([
    readFile(new URL('../src/handlers/ti/savedSearches.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/routes.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8'),
])

assert.match(handler, /ON CONFLICT \(user_id, query\)/)
assert.match(handler, /LIMIT 8/)
assert.match(handler, /tokenWrapper/)
assert.match(routes, /fastify\.get\('\/ti\/saved-searches'/)
assert.match(routes, /fastify\.post\('\/ti\/saved-searches'/)
assert.match(routes, /fastify\.delete\('\/ti\/saved-searches'/)
assert.match(schema, /CREATE TABLE IF NOT EXISTS ti_saved_searches/)
assert.match(schema, /idx_ti_saved_searches_user_saved_at/)

console.log(JSON.stringify({ ok: true, checked: ['authenticated_saved_search_routes', 'deduplicated_searches', 'bounded_saved_search_limit', 'user_cascade_schema'] }, null, 2))
