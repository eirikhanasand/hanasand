import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
if (process.env.DB !== 'signup_code_test') throw Error('Requires the disposable signup_code_test database')
const mail: Array<{ to: string, textBody: string }> = []
let failMail = false
mock.module('../src/utils/mail/system.ts', () => ({ sendSystemMail: async (message: { to: string, textBody: string }) => { if (failMail) throw Error('SMTP unavailable'); mail.push(message) } }))
mock.module('../src/utils/pwned/checkPwned.ts', () => ({ default: async () => ({ ok: true }) }))
mock.module('../src/utils/auth/login.ts', () => ({ default: async () => ({ token: 'verified-test-token', expires_at: '2030-01-01' }) }))
const { queryOnce: query, closeDatabase } = await import('../src/utils/db.ts')
const { default: postUser } = await import('../src/handlers/user/post.ts')

test('signup enforces single-use codes, expiration, attempts, binding and resend limits before creating an account', async () => {
    await query(`CREATE TABLE users(id text PRIMARY KEY,name text,password text,avatar text,username text UNIQUE,email text UNIQUE,email_verified_at timestamptz);
        CREATE TABLE roles(id text PRIMARY KEY,name text,description text,priority int);
        INSERT INTO roles VALUES ('users','Users','',100);
        CREATE TABLE user_roles(user_id text,role_id text,assigned_by text);
        CREATE TABLE root(id int); INSERT INTO root VALUES(1),(2);`)
    const app = Fastify()
    app.post('/user', postUser)
    const details = (id: string) => ({ id, name: 'Test signup', email: `${id}@example.test`, password: 'Long-test-password-123!' })
    const submit = (body: object) => app.inject({ method: 'POST', url: '/user', payload: body })
    const lastCode = () => mail.at(-1)!.textBody.match(/\b\d{6}\b/)![0]
    const count = async () => Number((await query('SELECT COUNT(*) FROM users')).rows[0].count)
    try {
        const pending = await submit(details('verified'))
        expect(pending.statusCode).toBe(202)
        expect(pending.json().token).toBeUndefined()
        expect(await count()).toBe(0)
        expect(mail.at(-1)!.to).toBe('verified@example.test')
        const code = lastCode()
        expect(JSON.stringify(pending.json())).not.toContain(code)
        const challengeId = pending.json().challengeId
        const results = await Promise.all([submit({ ...details('verified'), challengeId, code }), submit({ ...details('verified'), challengeId, code })])
        expect(results.map(r => r.statusCode).sort()).toEqual([201, 400])
        expect(await count()).toBe(1)
        expect((await query('SELECT email_verified_at FROM users')).rows[0].email_verified_at).toBeTruthy()
        const limited = await submit(details('limited'))
        const limitedCode = lastCode()
        const wrongCode = limitedCode === '000000' ? '111111' : '000000'
        const attempts = await Promise.all(Array.from({ length: 6 }, () => submit({ ...details('limited'), challengeId: limited.json().challengeId, code: wrongCode })))
        expect(attempts.every(r => r.statusCode === 400)).toBe(true)
        expect((await submit({ ...details('limited'), challengeId: limited.json().challengeId, code: limitedCode })).statusCode).toBe(400)
        expect(Number((await query('SELECT attempts FROM signup_verifications WHERE id=$1', [limited.json().challengeId])).rows[0].attempts)).toBe(5)
        const expired = await submit(details('expired'))
        const expiredCode = lastCode()
        await query('UPDATE signup_verifications SET expires_at=NOW()-INTERVAL \'1 second\' WHERE id=$1', [expired.json().challengeId])
        expect((await submit({ ...details('expired'), challengeId: expired.json().challengeId, code: expiredCode })).statusCode).toBe(400)
        const bound = await submit(details('bound'))
        expect((await submit({ ...details('bound'), email: 'changed@example.test', challengeId: bound.json().challengeId, code: lastCode() })).statusCode).toBe(400)
        expect((await submit(details('bound'))).statusCode).toBe(429)
        const oldCode = lastCode()
        await query('UPDATE signup_verifications SET created_at=NOW()-INTERVAL \'61 seconds\' WHERE id=$1', [bound.json().challengeId])
        const resent = await submit(details('bound'))
        expect(resent.statusCode).toBe(202)
        expect((await submit({ ...details('bound'), challengeId: bound.json().challengeId, code: oldCode })).statusCode).toBe(400)
        failMail = true
        expect((await submit(details('mailfailure'))).statusCode).toBe(503)
        expect((await query('SELECT consumed_at FROM signup_verifications WHERE email=\'mailfailure@example.test\'')).rows[0].consumed_at).toBeTruthy()
        expect(await count()).toBe(1)
    } finally { await app.close(); await closeDatabase() }
}, 30000)
