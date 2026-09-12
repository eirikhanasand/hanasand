import { expect, mock, test, afterAll } from 'bun:test'
import Fastify from 'fastify'
import bcrypt from 'bcrypt'
if (process.env.DB !== 'account_deletion_test' || process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '18543') throw Error('Requires the disposable account_deletion_test database')
let impersonating = false
let failMail = false
let mail: { to: string, textBody: string, htmlBody: string } | undefined
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'recovery-user', authenticatedId: 'recovery-user', impersonating }) }))
mock.module('../src/utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {}, userHasAdministrativeRole: async () => false }))
mock.module('../src/utils/auth/sessionNetwork.ts', () => ({ sessionNetwork: async () => ({ ip: '198.51.100.10', network: { country: 'Norway', city: 'Oslo' } }) }))
mock.module('../src/utils/mail/system.ts', () => ({ sendSystemMail: async (message: typeof mail) => { if (failMail) throw Error('SMTP unavailable'); mail = message } }))
mock.module('../src/utils/mail/accounts.ts', () => ({ syncMailPasswordForUser: async () => {} }))
mock.module('../src/utils/pwned/checkPwned.ts', () => ({ default: async () => ({ ok: true, count: 0 }) }))
const { queryOnce: query, closeDatabase } = await import('../src/utils/db.ts')
const { default: deleteSelf } = await import('../src/handlers/user/deleteSelf.ts')
const { default: restoreSelf } = await import('../src/handlers/user/restoreSelf.ts')
const { completePasswordReset } = await import('../src/handlers/auth/passwordReset.ts')
const { accountDeletionMail } = await import('../src/utils/auth/accountDeletionMail.ts')
const app = Fastify()
app.delete('/user', deleteSelf)
app.post('/user/restore', restoreSelf)
app.post('/reset', completePasswordReset)
afterAll(async () => { await app.close(); await closeDatabase() })

await query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
await query(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, username TEXT, email TEXT, password TEXT, avatar TEXT,
    account_type TEXT DEFAULT 'user', active BOOLEAN DEFAULT TRUE, reserved BOOLEAN DEFAULT FALSE,
    deletion_requested_at TIMESTAMPTZ, deletion_scheduled_at TIMESTAMPTZ, deletion_restore_token_hash TEXT,
    deletion_email_token_hash TEXT, deactivated_at TIMESTAMPTZ, deactivated_by TEXT, last_login_at TIMESTAMPTZ);
    CREATE TABLE mail_accounts (user_id TEXT, recovery_email TEXT, mail_address TEXT);
    CREATE TABLE organizations (id TEXT, name TEXT, status TEXT, created_at TIMESTAMPTZ);
    CREATE TABLE organization_members (organization_id TEXT, user_id TEXT, role TEXT, status TEXT);
    CREATE TABLE api_keys (organization_id TEXT, enabled BOOLEAN, expires_at TIMESTAMPTZ);
    CREATE TABLE roles (id TEXT, name TEXT, description TEXT, priority INT);
    CREATE TABLE user_roles (user_id TEXT, role_id TEXT);
    CREATE TABLE tokens (token_id SERIAL PRIMARY KEY, id TEXT, token TEXT, ip TEXT, user_agent TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW(), revoked_at TIMESTAMPTZ, revoked_by TEXT);
    CREATE TABLE login_events (user_id TEXT, token_id INT, ip TEXT, user_agent TEXT, status TEXT);
    CREATE TABLE password_reset_codes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, code_hash TEXT, reset_token_hash TEXT,
        verified_at TIMESTAMPTZ, requested_ip TEXT, user_agent TEXT, expires_at TIMESTAMPTZ, consumed_at TIMESTAMPTZ,
        attempts INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE attempts (id TEXT);`)
await query(`INSERT INTO users (id, name, email) VALUES ('recovery-user', 'Recovery User', 'recovery@example.test');
    INSERT INTO tokens (id, token) VALUES ('recovery-user', 'old-session')`)

const remove = () => app.inject({ method: 'DELETE', url: '/user', remoteAddress: '198.51.100.10', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Version/17.0 Safari/605.1.15' } })
const restore = (restoreToken: string) => app.inject({ method: 'POST', url: '/user/restore', payload: { id: 'recovery-user', restoreToken } })

test('email failure rolls back deletion and access revocation; impersonation cannot delete', async () => {
    impersonating = true
    expect((await remove()).statusCode).toBe(401)
    impersonating = false
    failMail = true
    expect((await remove()).statusCode).toBe(503)
    expect((await query('SELECT deletion_scheduled_at FROM users')).rows[0].deletion_scheduled_at).toBeNull()
    expect((await query('SELECT revoked_at FROM tokens')).rows[0].revoked_at).toBeNull()
    failMail = false
})

test('deletion email, independent one-use restoration, and secure password change', async () => {
    const deleted = await remove()
    expect(deleted.statusCode).toBe(200)
    expect(mail?.to).toBe('recovery@example.test')
    for (const value of ['scheduled for deletion', '198.51.100.10', 'Norway', 'Oslo', 'Safari on Mac', 'Requested:']) expect(mail!.textBody).toContain(value)
    expect(mail!.htmlBody).toContain('>Restore account</a>')
    expect((await query('SELECT revoked_at FROM tokens')).rows[0].revoked_at).not.toBeNull()
    const url = new URL(mail!.textBody.split('Restore account: ')[1])
    expect(url.searchParams.has('restoreToken')).toBe(false)
    const emailToken = new URLSearchParams(url.hash.slice(1)).get('restoreToken')!
    expect(emailToken).not.toBe(deleted.json().restore_token)
    await query("UPDATE users SET deletion_restore_token_hash = 'rotated-by-login'")
    expect((await restore('invalid')).statusCode).toBe(400)
    const restored = await restore(emailToken)
    expect(restored.statusCode, restored.body).toBe(200)
    expect(restored.json().token).toBeTruthy()
    expect((await restore(emailToken)).statusCode).toBe(400)
    const user = (await query('SELECT * FROM users')).rows[0]
    expect(user.deletion_scheduled_at).toBeNull()
    expect(user.deletion_email_token_hash).toBeNull()
    const resetToken = restored.json().resetToken
    const reset = (password: string) => app.inject({ method: 'POST', url: '/reset', payload: { id: 'recovery-user', resetToken, password } })
    expect((await reset('weak')).statusCode).toBe(400)
    const responses = await Promise.all([reset('A-new-Long-Password!2917'), reset('Another-Long-Password!2917')])
    expect(responses.map(result => result.statusCode).sort()).toEqual([200, 400])
    expect((await query('SELECT token FROM tokens WHERE revoked_at IS NULL')).rows).toHaveLength(0)
    const password = (await query('SELECT password FROM users')).rows[0].password
    expect(await bcrypt.compare(responses[0].statusCode === 200 ? 'A-new-Long-Password!2917' : 'Another-Long-Password!2917', password)).toBe(true)
})

test('expired and administratively disabled accounts cannot be restored; unknown locations are explicit and HTML escaped', async () => {
    await remove()
    const token = new URLSearchParams(new URL(mail!.textBody.split('Restore account: ')[1]).hash.slice(1)).get('restoreToken')!
    await query("UPDATE users SET deletion_scheduled_at = NOW() - INTERVAL '1 second'")
    expect((await restore(token)).statusCode).toBe(400)
    await query("UPDATE users SET deletion_scheduled_at = NOW() + INTERVAL '1 day', active = FALSE")
    expect((await restore(token)).statusCode).toBe(400)
    const message = accountDeletionMail({ id: '<script>', restoreToken: 'secret', requestedAt: new Date(), deletionScheduledAt: new Date(), ip: '::1', userAgent: '' })
    expect(message.textBody).toContain('City: Unavailable')
    expect(message.htmlBody).not.toContain('<script>')
})
