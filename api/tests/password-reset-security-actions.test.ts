import { afterAll, expect, mock, test } from 'bun:test'
import crypto from 'node:crypto'
import Fastify from 'fastify'

const availableActions = new Set<string>()
const queries: Array<{ sql: string, params?: unknown[] }> = []
const revokedUsers: string[] = []
let accountLocked = false

mock.module('#db', () => ({
    default: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params })
        if (sql.includes('SELECT u.id, u.name, u.password')) {
            return { rows: [{ id: 'reset-user', name: 'Reset User', password: 'unused', account_type: 'user', active: true, password_reset_locked_at: accountLocked ? new Date().toISOString() : null }] }
        }
        return { rows: [] }
    },
    withTransaction: async (work: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<unknown>) => work(async (sql, params) => {
        queries.push({ sql, params })
        if (sql.includes('UPDATE password_reset_security_actions')) {
            const action = sql.includes('action = \'lock_account\'') ? 'lock_account' : 'reset_password'
            const tokenHash = String(params?.[0] || '')
            if (!availableActions.has(`${action}:${tokenHash}`)) return { rows: [] }
            availableActions.delete(`${action}:${tokenHash}`)
            return { rows: [{ user_id: 'reset-user' }] }
        }
        if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 'reset-user' }] }
        if (sql.includes('UPDATE users SET password_reset_locked_at')) {
            accountLocked = true
            return { rows: [{ id: 'reset-user' }] }
        }
        return { rows: [] }
    }),
}))
mock.module('../src/utils/auth/session.ts', () => ({
    issueToken: async () => null,
    validateSession: async () => ({ valid: false }),
    revokeAllTokens: async ({ userId }: { userId: string }) => { revokedUsers.push(userId) },
}))
mock.module('#utils/auth/session.ts', () => ({
    issueToken: async () => null,
    validateSession: async () => ({ valid: false }),
    revokeAllTokens: async ({ userId }: { userId: string }) => { revokedUsers.push(userId) },
}))

const { lockAccountFromPasswordReset, startPasswordResetAgain } = await import('../src/handlers/auth/passwordReset.ts')
const loginHandler = (await import('../src/handlers/auth/login.ts')).default
const app = Fastify()
app.post('/lock', lockAccountFromPasswordReset)
app.post('/reset-again', startPasswordResetAgain)
app.post('/login/:id', loginHandler)

function tokenHash(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

test('locking from the email revokes all sessions and consumes the action token', async () => {
    const token = 'L'.repeat(43)
    availableActions.add(`lock_account:${tokenHash(token)}`)
    accountLocked = false
    revokedUsers.length = 0

    const response = await app.inject({ method: 'POST', url: '/lock', payload: { token } })

    expect(response.statusCode, response.body).toBe(200)
    expect(accountLocked).toBe(true)
    expect(revokedUsers).toEqual(['reset-user'])
    expect((await app.inject({ method: 'POST', url: '/lock', payload: { token } })).statusCode).toBe(400)
})

test('the email reset action starts a fresh verified reset session once', async () => {
    const token = 'R'.repeat(43)
    availableActions.add(`reset_password:${tokenHash(token)}`)

    const response = await app.inject({ method: 'POST', url: '/reset-again', payload: { token } })
    const body = response.json()

    expect(response.statusCode, response.body).toBe(200)
    expect(body).toMatchObject({ ok: true, id: 'reset-user' })
    expect(body.resetToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(queries.some(({ sql }) => sql.includes('verified_at, expires_at'))).toBe(true)
    expect((await app.inject({ method: 'POST', url: '/reset-again', payload: { token } })).statusCode).toBe(400)
})

test('locked accounts cannot sign in', async () => {
    accountLocked = true

    const response = await app.inject({ method: 'POST', url: '/login/reset-user', payload: { password: 'any-password' } })

    expect(response.statusCode).toBe(423)
    expect(response.json().error).toContain('Reset your password')
})

test('security actions reject missing tokens without changing the account', async () => {
    accountLocked = false
    const before = queries.length

    expect((await app.inject({ method: 'POST', url: '/lock', payload: {} })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/reset-again', payload: {} })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/lock', payload: { token: 'malformed' } })).statusCode).toBe(400)
    expect(accountLocked).toBe(false)
    expect(queries.length).toBe(before)
})

afterAll(async () => { await app.close() })
