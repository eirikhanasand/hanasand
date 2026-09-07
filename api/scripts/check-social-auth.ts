import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import Fastify from 'fastify'
import { digest } from '../src/utils/auth/socialOidc.ts'

const transactions = new Map<string, Record<string, any>>()
const identities = new Map<string, string>()
let active = true
let issued = 0
let linkedSubject = 'subject-one'
let exchangeCount = 0
const rows = (items: unknown[] = []) => ({ rows: items, rowCount: items.length })
let provisioned = 0
const query = async (sql: string, params: any[] = []) => {
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return rows()
    if (sql.startsWith('SELECT id,name,avatar,active,deletion_scheduled_at,email_verified_at') || sql.startsWith('SELECT 1 FROM users')) return rows()
    if (sql.startsWith('INSERT INTO users')) { provisioned++; return rows([{ id: params[0], name: params[1], avatar: '', active: true, deletion_scheduled_at: null }]) }
    if (sql.startsWith('INSERT INTO user_roles')) { assert.ok(sql.includes('\'users\'')); assert.ok(!sql.includes('\'administrators\'')); return rows() }
    if (sql.startsWith('DELETE FROM social_auth_transactions WHERE expires_at')) return rows()
    if (sql.startsWith('INSERT INTO social_auth_transactions')) {
        transactions.set(params[0], { provider: params[1], binding_hash: params[2], nonce: params[3], verifier: params[4], redirect_path: params[5], link_user_id: params[6], expires: Date.now() + 600000 })
        return rows()
    }
    if (sql.startsWith('DELETE FROM social_auth_transactions WHERE state_hash')) {
        const t = transactions.get(params[0])
        if (!t || t.provider !== params[1] || t.binding_hash !== params[2] || t.expires < Date.now()) return rows()
        transactions.delete(params[0]); return rows([t])
    }
    if (sql.startsWith('INSERT INTO user_social_identities')) {
        if (!active || identities.has(`${params[0]}:${params[1]}`) || [...identities].some(([key, user]) => key.startsWith(`${params[0]}:`) && user === params[2])) return rows()
        identities.set(`${params[0]}:${params[1]}`, params[2]); return rows([{ user_id: params[2] }])
    }
    if (sql.startsWith('SELECT 1 FROM user_social_identities')) return rows(identities.get(`${params[0]}:${params[1]}`) === params[2] ? [{}] : [])
    if (sql.startsWith('SELECT u.id,u.name')) {
        const user = identities.get(`${params[0]}:${params[1]}`)
        return rows(user ? [{ id: user, name: 'Existing account', avatar: '', active, deletion_scheduled_at: null }] : [])
    }
    if (sql.startsWith('SELECT r.id')) return rows([{ id: params[0] === 'existing-owner' ? 'existing-role' : 'users', priority: 42 }])
    if (sql.startsWith('UPDATE user_social_identities')) return rows()
    throw new Error(`Unexpected query: ${sql}`)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: (run: typeof query) => Promise<unknown>) => work(query) }))
mock.module('../src/utils/auth/session.ts', () => ({
    validateSession: async ({ token }: { token: string }) => active && token === 'valid' ? { user: { id: 'existing-owner' } } : null,
    issueToken: async ({ id }: { id: string }) => { issued++; return { token: `session-for-${id}`, expires_at: '2030-01-01' } },
}))
const actual = await import('../src/utils/auth/socialOidc.ts')
mock.module('../src/utils/auth/socialOidc.ts', () => ({ ...actual, exchangeIdentity: async () => { exchangeCount++; return { subject: linkedSubject, email: 'existing-owner@example.test' } } }))
const handlers = await import('../src/handlers/auth/social.ts')
const app = Fastify()
app.get('/providers', handlers.getSocialProviders)
app.post('/:provider/start', handlers.postSocialStart)
app.post('/:provider/callback', handlers.postSocialCallback)
const binding = actual.secret()
async function start(provider = 'google', link = false, token = '', extra: Record<string, string> = {}) {
    return app.inject({ method: 'POST', url: `/${provider}/start`, headers: { authorization: `Bearer ${token}`, ...extra }, payload: { binding, link, redirectPath: '/thesis' } })
}
async function callback(startResponse: Awaited<ReturnType<typeof start>>, provider = 'google', override: Record<string, unknown> = {}) {
    const state = new URL(startResponse.json().url).searchParams.get('state')
    return app.inject({ method: 'POST', url: `/${provider}/callback`, payload: { state, binding, code: 'code', ...override } })
}
try {
    delete process.env.GOOGLE_CLIENT_SECRET
    assert.equal((await start()).statusCode, 503)
    process.env.GOOGLE_CLIENT_ID = 'test'; process.env.GOOGLE_CLIENT_SECRET = 'secret'
    assert.equal((await start('unknown')).statusCode, 404)
    assert.equal((await start('google', true)).statusCode, 401)
    assert.equal((await start('google', true, 'valid', { 'x-impersonation-token': 'impersonating' })).statusCode, 401)
    const unlinked = await callback(await start())
    assert.equal(unlinked.statusCode, 200, 'New users can sign up directly')
    assert.notEqual(unlinked.json().id, 'existing-owner', 'Matching email must not claim another account')
    assert.equal(unlinked.json().roles[0].id, 'users')
    assert.equal(provisioned, 1)
    const repeat = await callback(await start())
    assert.equal(repeat.json().id, unlinked.json().id)
    assert.equal(provisioned, 1, 'Returning users must reuse their account')
    linkedSubject = 'link-subject'
    const linking = await start('google', true, 'valid')
    assert.equal((await callback(linking, 'google', { binding: actual.secret() })).statusCode, 400)
    assert.equal((await callback(linking, 'apple')).statusCode, 400)
    assert.equal((await callback(linking)).json().linked, true)
    assert.equal(issued, 2, 'Linking must not switch browser sessions')
    const beforeReplay = exchangeCount
    assert.equal((await callback(linking)).statusCode, 400)
    assert.equal(exchangeCount, beforeReplay)
    const login = await callback(await start())
    assert.equal(login.statusCode, 200)
    assert.equal(login.json().id, 'existing-owner')
    assert.equal(login.json().redirectPath, '/thesis')
    assert.deepEqual(login.json().roles, [{ id: 'existing-role', priority: 42 }])
    const cancelled = await start()
    assert.equal((await callback(cancelled, 'google', { cancelled: true })).statusCode, 400)
    assert.equal((await callback(cancelled)).statusCode, 400)
    const expired = await start()
    const state = new URL(expired.json().url).searchParams.get('state')!
    transactions.get(digest(state))!.expires = 0
    assert.equal((await callback(expired)).statusCode, 400)
    linkedSubject = 'another-subject'
    assert.equal((await callback(await start('google', true, 'valid'))).statusCode, 409)
    linkedSubject = 'link-subject'; active = false
    assert.equal((await callback(await start())).statusCode, 403)
    assert.equal(issued, 3)
    assert.equal(provisioned, 1, 'Inactive identities cannot create replacement accounts')
} finally { await app.close() }
console.log('Social auth: setup status, explicit authenticated linking, impersonation rejection, account isolation, state binding/provider/replay/expiry, cancellation, role inheritance and inactive-user rejection passed.')
