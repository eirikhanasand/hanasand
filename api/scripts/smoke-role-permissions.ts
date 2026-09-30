import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { roleTargetFromRequest } from '../src/utils/auth/hasPermissionToModifyRole.ts'
import { canViewHanasandInternalPages, canViewHanasandInternalRoute, HANASAND_ORGANIZATION_ID } from '../src/utils/auth/organizationPagePolicy.ts'

assert.equal(roleTargetFromRequest({ body: { target: 'administrator' } }), 'administrator')
assert.equal(roleTargetFromRequest({ body: { role_id: 'user_admin' } }), 'user_admin')
assert.equal(roleTargetFromRequest({ params: { id: 'content_admin' } }), 'content_admin')
assert.equal(
    roleTargetFromRequest({ body: { target: 'administrator', role_id: 'user_admin' }, params: { id: 'content_admin' } }),
    'administrator'
)
assert.equal(roleTargetFromRequest({ body: {}, params: {} }), undefined)

const putRole = await readFile(new URL('../src/handlers/roles/put.ts', import.meta.url), 'utf8')
const deleteRole = await readFile(new URL('../src/handlers/roles/delete.ts', import.meta.url), 'utf8')
const assignRole = await readFile(new URL('../src/handlers/roles/assignRole.ts', import.meta.url), 'utf8')
const unassignRole = await readFile(new URL('../src/handlers/roles/unassignRole.ts', import.meta.url), 'utf8')
const deletePermissionHelper = await readFile(new URL('../src/utils/auth/hasPermissionToDeleteRole.ts', import.meta.url), 'utf8')
const roleWrapper = await readFile(new URL('../src/utils/auth/roleWrapper.ts', import.meta.url), 'utf8')
const hasRole = await readFile(new URL('../src/utils/auth/hasRole.ts', import.meta.url), 'utf8')
const managementOrganizations = await readFile(new URL('../src/handlers/managementOrganizations.ts', import.meta.url), 'utf8')

for (const source of [putRole, deleteRole, assignRole, unassignRole]) {
    assert.match(source, /hasPermissionToModifyRole/)
}

assert.match(putRole, /Missing role id[\s\S]+hasPermissionToModifyRole/)
assert.match(deleteRole, /Missing role id\.[\s\S]+hasPermissionToModifyRole/)
assert.match(assignRole, /Missing user id \(id\) or role id \(role_id\)\.[\s\S]+hasPermissionToModifyRole/)
assert.match(unassignRole, /Missing user id \(id\) or role id \(role_id\)\.[\s\S]+hasPermissionToModifyRole/)
for (const compatibilityHelper of [deletePermissionHelper, roleWrapper]) {
    assert.match(compatibilityHelper, /hasPermissionToModifyRole/)
    assert.match(compatibilityHelper, /roleTargetFromRequest/)
}

for (const role of ['owner', 'editor']) {
    assert.equal(canViewHanasandInternalPages({
        organizationId: HANASAND_ORGANIZATION_ID,
        organizationStatus: 'active',
        membershipStatus: 'active',
        role,
    }), true)
}
for (const membership of [
    { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'active', membershipStatus: 'active', role: 'reader' },
    { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'archived', membershipStatus: 'active', role: 'editor' },
    { organizationId: HANASAND_ORGANIZATION_ID, organizationStatus: 'active', membershipStatus: 'removed', role: 'owner' },
    { organizationId: 'other', organizationStatus: 'active', membershipStatus: 'active', role: 'owner' },
]) assert.equal(canViewHanasandInternalPages(membership), false)

assert.match(hasRole, /canViewHanasandInternalRoute\(req\.method, route\)/)
assert.match(hasRole, /!apiKeyOwnerId/)
assert.match(managementOrganizations, /m\.role IN \('owner', 'admin', 'editor'\)/)
assert.equal(canViewHanasandInternalRoute('GET', '/logs/realtime'), true)
assert.equal(canViewHanasandInternalRoute('GET', '/api/logs/realtime?since=yesterday'), true)
assert.equal(canViewHanasandInternalRoute('GET', '/blocklist/overview'), true)
assert.equal(canViewHanasandInternalRoute('GET', '/vms/stop'), false)
assert.equal(canViewHanasandInternalRoute('POST', '/logs/search'), false)
assert.equal(canViewHanasandInternalRoute('GET', '/health'), false)

console.log('Role permission and Hanasand internal-page access smoke passed.')
