import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const handler = readFileSync(path.join(root, 'src/handlers/browserSandboxProfiles.ts'), 'utf8')
const routes = readFileSync(path.join(root, 'src/routes.ts'), 'utf8')
const schema = readFileSync(path.join(root, 'src/utils/db/ensureSchema.ts'), 'utf8')

assert(schema.includes('CREATE TABLE IF NOT EXISTS browser_sandbox_profiles'), 'schema should create account-scoped browser sandbox profiles.')
assert(schema.includes('PRIMARY KEY (owner_id, id)'), 'profiles should be scoped by owner and profile id.')
assert(schema.includes('idx_browser_sandbox_profiles_owner_updated'), 'profiles should have an owner lookup index.')

assert(routes.includes('/browser-sandbox/profiles') && routes.includes('fastify.get'), 'API should expose the profile read route.')
assert(routes.includes('/browser-sandbox/profiles') && routes.includes('fastify.put'), 'API should expose the profile save route.')
assert(routes.includes('getBrowserSandboxProfiles'), 'routes should register the read handler.')
assert(routes.includes('putBrowserSandboxProfiles'), 'routes should register the save handler.')

assert(handler.includes('tokenWrapper(req, res)'), 'profile routes should require authenticated user context.')
assert(handler.includes('WHERE owner_id = $1'), 'profile reads should be owner-scoped.')
assert(handler.includes('ON CONFLICT (owner_id, id)'), 'profile saves should upsert per account/profile.')
assert(handler.includes('DELETE FROM browser_sandbox_profiles WHERE owner_id = $1'), 'profile saves should remove deleted account-owned profiles.')
assert(handler.includes('maxProfiles = 16'), 'profile saves should cap total profiles.')
assert(handler.includes('maxToolsPerProfile = 8'), 'profile saves should cap tools per profile.')
assert(handler.includes('/^https?:\\/\\//i'), 'profile tools should only accept http/https URLs.')

console.log('Browser sandbox profile persistence contract passed.')
