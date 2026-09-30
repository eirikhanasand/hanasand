import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { canAccessHanasandInternalPageRoute, canEditHanasandInternalPages, canViewHanasandInternalPages, canViewHanasandInternalRoute, HANASAND_ORGANIZATION_ID } from '../src/utils/auth/organizationPagePolicy.ts'

for (const role of ['owner', 'admin', 'editor', 'reader']) {
    assert.equal(canViewHanasandInternalPages({
        organizationId: HANASAND_ORGANIZATION_ID,
        organizationStatus: 'active',
        membershipStatus: 'active',
        role,
    }), true)
}
for (const role of ['owner', 'admin', 'editor']) {
    const member = { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'active', membershipStatus: 'active', role }
    assert.equal(canEditHanasandInternalPages(member), true)
    assert.equal(canAccessHanasandInternalPageRoute('PATCH', member), true)
}
for (const role of ['reader', 'member', 'viewer']) {
    const member = { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'active', membershipStatus: 'active', role }
    assert.equal(canEditHanasandInternalPages(member), false)
    assert.equal(canAccessHanasandInternalPageRoute('GET', member), true)
    assert.equal(canAccessHanasandInternalPageRoute('POST', member), false)
}
for (const membership of [
    { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'archived', membershipStatus: 'active', role: 'editor' },
    { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'active', membershipStatus: 'removed', role: 'owner' },
    { organizationId: 'other', organizationStatus: 'active', membershipStatus: 'active', role: 'owner' },
]) assert.equal(canViewHanasandInternalPages(membership), false)

for (const [method, route] of [
    ['GET', '/logs/realtime'],
    ['GET', '/api/logs/realtime?since=yesterday'],
    ['GET', '/blocklist/overview'],
    ['GET', '/vms/stop'],
    ['POST', '/logs/search'],
    ['PUT', '/system/cron/:id'],
    ['DELETE', '/users/:id'],
    ['GET', '/api/commercial/contact-requests'],
    ['GET', '/api/thesis'],
] as const) assert.equal(canViewHanasandInternalRoute(method, route), true, `${method} ${route}`)
for (const [method, route] of [
    ['POST', '/support/tickets'],
    ['GET', '/health'],
    ['OPTIONS', '/logs/realtime'],
    ['POST', '/role/assign/:id'],
] as const) assert.equal(canViewHanasandInternalRoute(method, route), false, `${method} ${route}`)

const routes = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8')
const session = await readFile(new URL('../src/utils/auth/session.ts', import.meta.url), 'utf8')
const schema = await readFile(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
assert.doesNotMatch(routes, /fastify\.(?:get|post|put|delete)\(['"]\/(?:role|roles)(?:\/|['"])/)
assert.doesNotMatch(session, /user_roles|session_roles/)
assert.match(schema, /DROP TABLE IF EXISTS user_roles/)
assert.match(schema, /DROP TABLE IF EXISTS roles/)

console.log('Organization-only internal page access smoke passed.')
