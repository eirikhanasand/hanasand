import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const deleteUser = await readFile(new URL('../src/handlers/user/deleteUser.ts', import.meta.url), 'utf8')
const deleteSelf = await readFile(new URL('../src/handlers/user/deleteSelf.ts', import.meta.url), 'utf8')
const purgeDeletedAccounts = await readFile(new URL('../src/utils/auth/purgeDeletedAccounts.ts', import.meta.url), 'utf8')

for (const source of [deleteUser, deleteSelf]) {
    assert.match(source, /UPDATE users/)
    assert.match(source, /deletion_requested_at = NOW\(\)/)
    assert.match(source, /deletion_scheduled_at = NOW\(\) \+ INTERVAL '30 days'/)
    assert.match(source, /revokeAllTokens/)
    assert.doesNotMatch(source, /DELETE FROM users/, 'user-facing delete handlers should schedule deletion, not hard-delete immediately')
}

assert.match(deleteUser, /id: actorId/)
assert.match(deleteUser, /revokedBy: actorId/)
assert.match(deleteSelf, /revokedBy: id/)
assert.match(purgeDeletedAccounts, /DELETE FROM users/)
assert.match(purgeDeletedAccounts, /deletion_scheduled_at <= NOW\(\)/)

console.log('User delete contract smoke passed for scheduled deletion, token revocation, and delayed purge.')
