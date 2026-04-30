import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { roleTargetFromRequest } from '../src/utils/auth/hasPermissionToModifyRole.ts'

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

console.log('Role permission target smoke passed for body.target, body.role_id, and params.id.')
