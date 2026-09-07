import assert from 'node:assert/strict'
import { queryOnce, closeDatabase } from '../src/utils/db.ts'
import { validateSession } from '../src/utils/auth/session.ts'

assert.equal(process.env.DB, 'session_test', 'Requires an isolated database')
await queryOnce(`
CREATE TABLE users (id text PRIMARY KEY, name text, avatar text, active boolean, deletion_scheduled_at timestamptz);
CREATE TABLE roles (id text PRIMARY KEY, name text, description text, priority int);
CREATE TABLE user_roles (user_id text, role_id text);
CREATE TABLE tokens (token_id int, id text, token text, ip text, user_agent text, created_at timestamptz DEFAULT NOW(), timestamp timestamptz DEFAULT NOW(), revoked_at timestamptz);
INSERT INTO users VALUES ('probe','Probe','',true,NULL);
INSERT INTO roles VALUES ('admin','Admin','',1),('viewer','Viewer','',2);
INSERT INTO user_roles VALUES ('probe','viewer'),('probe','admin');
INSERT INTO tokens(token_id,id,token,user_agent) VALUES (1,'probe','test-secret','Browser');
`)
const check = () => validateSession({ id: 'probe', token: 'test-secret' })
const valid = await check()
assert.equal(valid?.user.name, 'Probe')
assert.deepEqual(valid?.roles.map(role => role.id), ['admin','viewer'])
assert.equal(await validateSession({ id: 'someone-else', token: 'test-secret' }), null)
assert.equal(await validateSession({ token: 'wrong' }), null)
assert.equal((await validateSession({ token: 'test-secret' }))?.user.id, 'probe')
await queryOnce('DELETE FROM user_roles WHERE role_id=\'admin\'')
assert.deepEqual((await check())?.roles.map(role => role.id), ['viewer'])
await queryOnce('UPDATE users SET active=false')
assert.equal(await check(), null)
await queryOnce('UPDATE users SET active=true, deletion_scheduled_at=NOW()')
assert.equal(await check(), null)
await queryOnce('UPDATE users SET deletion_scheduled_at=NULL')
await queryOnce('UPDATE tokens SET revoked_at=NOW()')
assert.equal(await check(), null)
await queryOnce('UPDATE tokens SET revoked_at=NULL, timestamp=NOW()-INTERVAL \'25 hours\'')
assert.equal(await check(), null)
await queryOnce('UPDATE tokens SET user_agent=\'Hanasand Desktop/Test\'')
assert(await check())
await queryOnce('UPDATE tokens SET timestamp=NOW()-INTERVAL \'31 days\'')
assert.equal(await check(), null)
console.log('PASS: valid identity, ordered roles, role removal, wrong identity/token, disabled/deleting user, revocation, browser and desktop expiry.')
await closeDatabase()
