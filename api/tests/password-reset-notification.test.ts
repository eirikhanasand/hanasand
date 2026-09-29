import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let consumeSucceeds = true
let failMail = false
const sentMail: Array<{ to: string, subject: string, textBody: string, htmlBody?: string }> = []
mock.module('#db', () => ({
    default: async (sql: string) => {
        if (sql.includes('SELECT u.id, u.name, u.active')) {
            return { rows: [{ id: 'reset-user', name: 'Reset User', active: true, recovery_email: 'recovery@example.test', mail_address: null }] }
        }
        if (sql.includes('SELECT prc.id, prc.user_id')) {
            return { rows: [{ id: 'reset-code', user_id: 'reset-user', reset_token_hash: 'stored-hash', expires_at: new Date(Date.now() + 60_000).toISOString(), name: 'Reset User' }] }
        }
        return { rows: [] }
    },
    withTransaction: async (work: (query: (sql: string) => Promise<{ rows: Array<{ id: string }> }>) => Promise<unknown>) => work(async sql => {
        if (sql.includes('RETURNING id')) return { rows: consumeSucceeds ? [{ id: 'reset-code' }] : [] }
        return { rows: [] }
    }),
}))
mock.module('../src/utils/auth/session.ts', () => ({ revokeAllTokens: async () => {} }))
mock.module('../src/utils/auth/password.ts', () => ({ validatePassword: async () => ({ valid: true }) }))
mock.module('../src/utils/mail/accounts.ts', () => ({ syncMailPasswordForUser: async () => {} }))
mock.module('../src/utils/mail/system.ts', () => ({
    sendSystemMail: async (message: typeof sentMail[number]) => {
        if (failMail) throw Error('SMTP unavailable')
        sentMail.push(message)
    },
}))

const { completePasswordReset } = await import('../src/handlers/auth/passwordReset.ts')
const app = Fastify()
app.post('/reset', completePasswordReset)

test('successful reset emails a security alert after consuming the reset token', async () => {
    consumeSucceeds = true
    failMail = false
    sentMail.length = 0

    const response = await app.inject({
        method: 'POST',
        url: '/reset',
        remoteAddress: '198.51.100.24',
        headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Version/17.0 Safari/605.1.15' },
        payload: { id: 'reset-user', resetToken: 'valid-reset-token', password: 'Strong-test-password-1935!' },
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(sentMail).toHaveLength(1)
    expect(sentMail[0].to).toBe('recovery@example.test')
    expect(sentMail[0].subject).toBe('Your Hanasand password was changed')
    expect(sentMail[0].textBody).toContain('198.51.100.24')
})

test('an unconsumed reset session sends no security email', async () => {
    consumeSucceeds = false
    sentMail.length = 0

    const response = await app.inject({ method: 'POST', url: '/reset', payload: { id: 'reset-user', resetToken: 'valid-reset-token', password: 'Strong-test-password-1935!' } })

    expect(response.statusCode).toBe(400)
    expect(sentMail).toHaveLength(0)
})

test('a notification delivery failure does not undo a successful password reset', async () => {
    consumeSucceeds = true
    failMail = true

    const response = await app.inject({ method: 'POST', url: '/reset', payload: { id: 'reset-user', resetToken: 'valid-reset-token', password: 'Strong-test-password-1935!' } })

    expect(response.statusCode, response.body).toBe(200)
    failMail = false
    await app.close()
})
