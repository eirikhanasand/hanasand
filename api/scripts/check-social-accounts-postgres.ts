import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import Fastify from 'fastify'
import { queryOnce as query, closeDatabase } from '../src/utils/db.ts'
import ensureIdentitySchema from '../src/utils/db/accountIdentitySchema.ts'
import ensureSchema from '../src/utils/db/socialAuthSchema.ts'
import { socialAccount } from '../src/utils/auth/socialAccounts.ts'

if (process.env.DB !== 'social_auth_test') throw new Error('Use only the disposable social_auth_test database')
try {
    await query(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, password TEXT NOT NULL, avatar TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, deletion_scheduled_at TIMESTAMPTZ);
        CREATE TABLE roles (id TEXT PRIMARY KEY);
        INSERT INTO roles VALUES ('users');
        CREATE TABLE user_roles (user_id TEXT REFERENCES users(id), role_id TEXT REFERENCES roles(id), assigned_by TEXT, PRIMARY KEY(user_id,role_id));
        INSERT INTO users (id,name,password) VALUES ('existing-owner','Owner','test');`)
    await ensureSchema()
    await ensureIdentitySchema()
    const identity = { subject: 'new-subject', email: 'existing-owner@example.test', name: 'A new user' }
    const concurrent = await Promise.all(Array.from({ length: 6 }, () => socialAccount('google', identity)))
    assert.equal(new Set(concurrent.map(user => user!.id)).size, 1)
    const id = concurrent[0]!.id
    assert.notEqual(id, 'existing-owner')
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count, 2)
    assert.deepEqual((await query('SELECT role_id FROM user_roles WHERE user_id=$1', [id])).rows, [{ role_id: 'users' }])
    await query('UPDATE users SET active=FALSE WHERE id=$1', [id])
    assert.equal(await socialAccount('google', identity), null)
    await query('UPDATE users SET active=TRUE,deletion_scheduled_at=NOW() WHERE id=$1', [id])
    assert.equal(await socialAccount('google', identity), null)
    const apple = await socialAccount('apple', { subject: identity.subject, email: 'other@example.test' })
    assert.notEqual(apple!.id, id, 'Provider namespaces remain independent')
    await query('CREATE FUNCTION reject_test_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.subject=\'rollback-test\' THEN RAISE EXCEPTION \'test write failure\'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_test_identity BEFORE INSERT ON user_social_identities FOR EACH ROW EXECUTE FUNCTION reject_test_identity()')
    const before = (await query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count
    await assert.rejects(socialAccount('google', { subject: 'rollback-test', email: 'rollback@example.test' }))
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count, before, 'Failed identity writes must roll back users and roles')
    await query("INSERT INTO users (id,name,password,email,email_verified_at) VALUES ('verified-owner','Owner','test','owner@gmail.com',NOW())");
    await query("INSERT INTO user_roles VALUES ('verified-owner','users','administrator')");
    const owner = await socialAccount('google', { subject: 'owner-subject', email: 'OWNER@gmail.com', authoritativeEmail: true });
    assert.equal(owner!.id, 'verified-owner');
    await query("INSERT INTO users (id,name,password,email) VALUES ('unverified','Unverified','test','unverified@gmail.com')");
    await assert.rejects(socialAccount('google', { subject: 'unverified-subject', email: 'unverified@gmail.com', authoritativeEmail: true }), /Sign in to that account/);
    await query("INSERT INTO users (id,name,password,email,email_verified_at) VALUES ('external','External','test','external@example.test',NOW())");
    await assert.rejects(socialAccount('google', { subject: 'external-subject', email: 'external@example.test', authoritativeEmail: false }), /Sign in to that account/);
    await assert.rejects(socialAccount('google', { subject: 'missing-email', email: null }), /verified email/);
    const readable = await query('SELECT username,email,email_verified_at FROM users WHERE id=$1', [id]);
    assert.match(readable.rows[0].username, /^existing-owner-[a-f0-9]{6}$/);
    assert.equal(readable.rows[0].email, identity.email);
    assert.ok(readable.rows[0].email_verified_at);

    await query("INSERT INTO users (id,name,password,username) VALUES ('editable','Before','test','editable'),('taken','Other','test','taken.name')");
    await query("INSERT INTO user_roles VALUES ('editable','users','administrator')");
    let allowed = true;
    mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: allowed, id: 'editable', authenticatedId: 'editable', impersonating: false }) }));
    mock.module('../src/utils/auth/login.ts', () => ({ default: async () => ({ token: 'test-token', expires_at: '2030-01-01' }) }));
    const { default: putSelf } = await import('../src/handlers/user/putSelf.ts');
    const { default: postUser } = await import('../src/handlers/user/post.ts');
    const app = Fastify();
    app.put('/user/self', putSelf);
    app.post('/user', postUser);
    const edit = (payload: Record<string, string>) => app.inject({ method: 'PUT', url: '/user/self', headers: { id: 'taken' }, payload });
    const updated = await edit({ name: 'Other ✨', username: 'New.Handle' });
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal(updated.json().id, 'editable', 'Submitted headers must not select another user');
    assert.equal(updated.json().username, 'new.handle');
    assert.equal(updated.json().password, undefined);
    assert.equal((await query("SELECT name FROM users WHERE id='taken'")).rows[0].name, 'Other');
    assert.equal((await query("SELECT user_id FROM user_roles WHERE user_id='editable'")).rows[0].user_id, 'editable');
    assert.equal((await edit({ username: 'TAKEN.NAME' })).statusCode, 409);
    assert.equal((await edit({ username: 'admin' })).statusCode, 400);
    allowed = false;
    assert.equal((await edit({ name: 'Unauthorized' })).statusCode, 401);
    const missingEmail = await app.inject({ method: 'POST', url: '/user', payload: { id: 'signup-test', name: 'Signup test', password: 'Long-enough-test-password!' } });
    assert.equal(missingEmail.statusCode, 400);
    assert.match(missingEmail.json().error, /email/);
    const invalidEmail = await app.inject({ method: 'POST', url: '/user', payload: { id: 'signup-test', name: 'Signup test', email: 'invalid', password: 'Long-enough-test-password!' } });
    assert.equal(invalidEmail.statusCode, 400);
    await app.close();
    console.log('PostgreSQL account checks: concurrent signup, verified email matching, unverified collision rejection, readable usernames, profile uniqueness and self authorization, stable IDs/roles, required signup email, rollback and inactive-account protection.')
} finally { await closeDatabase() }
