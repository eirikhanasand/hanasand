import { afterAll, beforeAll, expect, mock, test } from 'bun:test'
import WebSocket from 'ws'
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { randomBytes, randomUUID } from 'node:crypto'

if (process.env.SUPPORT_DB_NAME !== 'hanasand_support_store_test' || process.env.DB_PORT !== '1') throw new Error('Use the disposable support store and an unavailable primary database on port 1.')
process.env.SUPPORT_INTERNAL_SERVICE = '1'
process.env.API_HTTP_ONLY = '1'
process.env.SUPPORT_SERVICE_KEY = 'test-private-support-key-'.repeat(3)
let authority: 'online' | 'offline' | 'revoked' | 'error' = 'online'
const token = 'known-verified-token'
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async (auth: { id?: string; token: string }) => {
    if (authority === 'offline') throw Object.assign(new Error('Primary unavailable'), { code: 'ECONNREFUSED' })
    if (authority === 'error') throw Object.assign(new Error('Permission denied'), { code: '42501' })
    if (authority === 'revoked' || auth.token !== token || auth.id && auth.id !== 'agent') return null
    return { user: { id: 'agent', name: 'Support Agent', active: true }, roles: [{ id: 'support', name: 'Support' }],
        session: { token, timestamp: new Date().toISOString() }, refreshed: { token, expires_at: new Date(Date.now() + 3600000).toISOString() } }
} }))
const { createSupportServer } = await import('../src/supportServer.ts')
const { queryOnce: query, withTransaction } = await import('../src/utils/support/db.ts')
const { default: schema } = await import('../src/utils/support/schema.ts')
const { validateSupportSession } = await import('../src/utils/support/auth.ts')
const { sendSupportChat, supportSessionHash } = await import('../src/utils/support/conversation.ts')
const app = await createSupportServer()
const key = { 'x-support-service-key': process.env.SUPPORT_SERVICE_KEY }
const staff = { ...key, id: 'agent', authorization: `Bearer ${token}` }
const visitor = randomBytes(32).toString('hex')
const guest = { ...key, 'x-support-session': visitor, 'x-support-client-ip': '192.0.2.1' }
let id = ''
beforeAll(async () => {
    await query('DROP TABLE IF EXISTS support_auth_sessions, support_live_tickets, support_messages, support_tickets, users, api_rate_limit_buckets CASCADE')
    await withTransaction(schema)
    await withTransaction(schema)
})
afterAll(async () => { await app.close() })

test('private service rejects untrusted traffic and caches only hashed verified sessions', async () => {
    expect((await app.inject({ url: '/api/support/tickets' })).statusCode).toBe(403)
    expect((await app.inject({ url: '/backup' })).statusCode).toBe(403)
    expect((await app.inject({ url: '/backup', headers: key })).statusCode).toBe(503)
    expect((await app.inject({ url: '/api/support/chat', headers: { 'x-support-service-key': 'é'.repeat(process.env.SUPPORT_SERVICE_KEY!.length) } })).statusCode).toBe(403)
    expect((await app.inject({ url: '/api/support/tickets', headers: key })).statusCode).toBe(401)
    expect((await app.inject({ url: '/api/support/tickets', headers: staff })).statusCode).toBe(200)
    const stored = (await query('SELECT * FROM support_auth_sessions')).rows
    expect(stored).toHaveLength(1)
    expect(JSON.stringify(stored)).not.toContain(token)
    expect(stored[0].token_hash).toBe(supportSessionHash(token))
})

test('guest chat, human replies, resolution, feedback and reopening persist with the main database unavailable', async () => {
    authority = 'offline'
    const result = await sendSupportChat(supportSessionHash(visitor), { requestId: randomUUID(), message: 'I need account help', handoff: false }, async () => { throw new Error('Primary model also unavailable') })
    id = result.id!
    expect(result.channel).toBe('human')
    const queue = await app.inject({ url: '/api/support/tickets', headers: staff })
    expect(queue.statusCode).toBe(200)
    expect(queue.json().tickets[0].id).toBe(id)
    const send = await app.inject({ method: 'POST', url: `/api/support/tickets/${id}/messages`, headers: staff, payload: { message: 'I can help during the outage.' } })
    expect(send.statusCode).toBe(200)
    const history = await app.inject({ url: '/api/support/chat', headers: guest })
    expect(history.json().messages.at(-1).sender_name).toBe('Support Agent')
    const resolve = await app.inject({ method: 'POST', url: `/api/support/tickets/${id}/status`, headers: staff, payload: { status: 'closed' } })
    expect(resolve.statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/support/chat', headers: guest, payload: { requestId: randomUUID(), conversationId: id, message: 'closed' } })).statusCode).toBe(409)
    const feedback = await app.inject({ method: 'POST', url: '/api/support/chat', headers: guest, payload: { action: 'feedback', conversationId: id, rating: 2, comment: 'Please improve this', resolutionVersion: 1 } })
    expect(feedback.statusCode).toBe(200)
    expect((await query('SELECT feedback_rating,feedback_comment FROM support_tickets WHERE id=$1', [id])).rows[0]).toEqual({ feedback_rating: 2, feedback_comment: 'Please improve this' })
    expect((await app.inject({ method: 'POST', url: `/api/support/tickets/${id}/status`, headers: staff, payload: { status: 'open' } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/support/chat', headers: guest, payload: { requestId: randomUUID(), conversationId: id, message: 'Reopened successfully' } })).statusCode).toBe(200)
    const stranger = { ...guest, 'x-support-session': randomBytes(32).toString('hex') }
    expect((await app.inject({ url: `/api/support/chat?conversationId=${id}`, headers: stranger })).json().messages).toEqual([])
})

test('cached access rejects unknown, mismatched, expired and revoked sessions without extending expiry offline', async () => {
    const before = (await query('SELECT expires_at FROM support_auth_sessions')).rows[0].expires_at
    expect(await validateSupportSession({ token })).not.toBeNull()
    expect((await query('SELECT expires_at FROM support_auth_sessions')).rows[0].expires_at).toEqual(before)
    expect(await validateSupportSession({ token, id: 'somebody-else' })).toBeNull()
    expect(await validateSupportSession({ token: 'unknown' })).toBeNull()
    await Bun.sleep(3050)
    authority = 'error'
    await expect(validateSupportSession({ token })).rejects.toThrow('Permission denied')
    authority = 'revoked'
    expect(await validateSupportSession({ token })).toBeNull()
    authority = 'offline'
    expect(await validateSupportSession({ token })).toBeNull()
    await Bun.sleep(3050)
    authority = 'online'
    await validateSupportSession({ token })
    await query("UPDATE support_auth_sessions SET expires_at=NOW()-INTERVAL '1 second'")
    authority = 'offline'
    expect(await validateSupportSession({ token })).toBeNull()
}, 10000)

test('anonymous quotas use the trusted client address even when visitor tokens rotate', async () => {
    await query('DELETE FROM api_rate_limit_buckets')
    for (let i = 0; i < 90; i++) expect((await app.inject({ url: '/api/support/chat', headers: { ...guest, 'x-support-session': randomBytes(32).toString('hex') } })).statusCode).toBe(200)
    expect((await app.inject({ url: '/api/support/chat', headers: guest })).statusCode).toBe(429)
    expect((await app.inject({ url: '/api/support/chat', headers: { ...guest, 'x-support-client-ip': '192.0.2.2' } })).statusCode).toBe(200)
})


test('one-use guest connections receive committed changes from the independent database', async () => {
    const headers = { ...guest, 'x-support-client-ip': '192.0.2.3' }
    const ticket = (await app.inject({ method: 'POST', url: '/api/support/chat', headers, payload: { action: 'connect' } })).json().ticket
    const address = (await app.listen({ port: 0, host: '127.0.0.1' })).replace('http:', 'ws:') + '/api/ws/support'
    expect((await app.inject({ url: '/api/ws/support', headers: { upgrade: 'websocket', origin: 'https://hanasand.com' } })).statusCode).toBe(403)
    const socket = new WebSocket(address, { headers: { ...key, origin: 'https://hanasand.com' } })
    await once(socket, 'open')
    const events: Array<{ type: string; id?: string }> = []
    socket.on('message', data => events.push(JSON.parse(data.toString())))
    socket.send(JSON.stringify({ type: 'auth', ticket }))
    const until = async (check: () => boolean) => { for (let i = 0; i < 100 && !check(); i++) await Bun.sleep(10); expect(check()).toBe(true) }
    try {
        await until(() => events.some(event => event.type === 'ready'))
        await Bun.sleep(50)
        events.length = 0
        await app.inject({ method: 'POST', url: '/api/support/chat', headers, payload: { requestId: randomUUID(), conversationId: id, message: 'A live update during the outage' } })
        await until(() => events.some(event => event.type === 'changed' && event.id === id))
        expect((await query('SELECT COUNT(*)::int AS count FROM support_live_tickets WHERE token_hash=$1', [supportSessionHash(ticket)])).rows[0].count).toBe(0)
    } finally { socket.terminate() }
})


test('maintenance resumes without restarting the service and backups stay private', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'support-maintenance-'))
    const marker = join(directory, 'paused')
    const backup = join(directory, 'snapshot.dump')
    process.env.SUPPORT_MAINTENANCE_FILE = marker
    process.env.SUPPORT_BACKUP_FILE = backup
    try {
        writeFileSync(marker, '')
        expect((await app.inject({ url: '/api/support/chat', headers: guest })).statusCode).toBe(503)
        writeFileSync(backup, 'PGDMPtest snapshot')
        expect((await app.inject({ url: '/backup' })).statusCode).toBe(403)
        const saved = await app.inject({ url: '/backup', headers: key })
        expect(saved.statusCode).toBe(200)
        expect(saved.body).toBe('PGDMPtest snapshot')
        unlinkSync(marker)
        expect((await app.inject({ url: '/api/support/chat', headers: { ...guest, 'x-support-client-ip': '192.0.2.4' } })).statusCode).toBe(200)
    } finally {
        delete process.env.SUPPORT_MAINTENANCE_FILE
        delete process.env.SUPPORT_BACKUP_FILE
        rmSync(directory, { recursive: true })
    }
})
