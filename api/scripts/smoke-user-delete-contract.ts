import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const deleteUser = await readFile(new URL('../src/handlers/user/deleteUser.ts', import.meta.url), 'utf8')
const deleteSelf = await readFile(new URL('../src/handlers/user/deleteSelf.ts', import.meta.url), 'utf8')

for (const source of [deleteUser, deleteSelf]) {
    assert.match(source, /revokeAllTokens/)
    assert.match(source, /revokeAllTokens[\s\S]+DELETE FROM users/)
}

assert.match(deleteUser, /id: actorId/)
assert.match(deleteUser, /revokedBy: actorId/)
assert.match(deleteSelf, /revokedBy: id/)

console.log('User delete contract smoke passed for session revocation before user removal.')
