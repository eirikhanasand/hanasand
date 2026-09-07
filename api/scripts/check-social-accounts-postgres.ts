import assert from 'node:assert/strict'
import { queryOnce as query, closeDatabase } from '../src/utils/db.ts'
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
    const apple = await socialAccount('apple', { subject: identity.subject, email: null })
    assert.notEqual(apple!.id, id, 'Provider namespaces remain independent')
    await query('CREATE FUNCTION reject_test_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.subject=\'rollback-test\' THEN RAISE EXCEPTION \'test write failure\'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_test_identity BEFORE INSERT ON user_social_identities FOR EACH ROW EXECUTE FUNCTION reject_test_identity()')
    const before = (await query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count
    await assert.rejects(socialAccount('google', { subject: 'rollback-test', email: null }))
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count, before, 'Failed identity writes must roll back users and roles')
    console.log('PostgreSQL social signup: concurrent first login creates one account, standard role only, identity separation, inactive/deleting accounts blocked, failed writes roll back completely.')
} finally { await closeDatabase() }
