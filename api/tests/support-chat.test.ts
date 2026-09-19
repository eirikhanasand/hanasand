import { afterAll, beforeAll, expect, mock, test } from 'bun:test'
import { randomBytes, randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { queryOnce as query, closeDatabase } from '../src/utils/db.ts'
import ensureSupportAiSchema from '../src/utils/support/schema.ts'
import { readSupportConversation, sendSupportChat, supportSessionHash } from '../src/utils/support/conversation.ts'
import { asksForHuman, handoffMarker } from '../src/utils/support/assistant.ts'
import { gpt, gptSockets, handleGptMessage } from '../src/utils/ws/handleGptMessage.ts'
import { publicSupportChat } from '../src/handlers/publicSupportChat.ts'

if (process.env.DB !== 'hanasand_support_test') throw new Error('Use the disposable hanasand_support_test database.')
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: any, res: any) => {
    const id = req.headers['test-user']
    if (!id) { res.status(401).send({ error: 'Unauthorized' }); return { valid: false } }
    return { valid: true, id }
} }))
const { getSupportTickets, getSupportMessages, postSupportMessage } = await import('../src/handlers/supportChat.ts')
const app = Fastify()
app.get('/support/chat', publicSupportChat)
app.post('/support/chat', publicSupportChat)
app.get('/support/tickets', getSupportTickets)
app.get('/support/tickets/:id/messages', getSupportMessages)
app.post('/support/tickets/:id/messages', postSupportMessage)
const session = () => supportSessionHash(randomBytes(32).toString('hex'))
const input = (message: string, handoff = false) => ({ requestId: randomUUID(), message, handoff })
const reply = async () => 'You can reset your password from the sign-in page.'

beforeAll(async () => {
    // This file refuses to run outside its disposable database.
    await query('DROP TABLE IF EXISTS support_messages, support_tickets, user_roles, roles, users, api_rate_limit_buckets CASCADE')
    await query('CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT)')
    await query('CREATE TABLE roles (id TEXT PRIMARY KEY)')
    await query('CREATE TABLE user_roles (user_id TEXT, role_id TEXT)')
    await query('INSERT INTO users VALUES (\'agent\', \'Support Agent\'), (\'customer\', \'Customer\')')
    await query('INSERT INTO roles VALUES (\'support\')')
    await query('INSERT INTO user_roles VALUES (\'agent\', \'support\')')
    await query('CREATE TABLE support_tickets (id UUID PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), subject TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'open\', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
    await query('CREATE TABLE support_messages (id UUID PRIMARY KEY, ticket_id UUID REFERENCES support_tickets(id), sender_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
    await query('CREATE TABLE api_rate_limit_buckets (bucket_key TEXT PRIMARY KEY, window_started_at TIMESTAMPTZ, request_count INTEGER, updated_at TIMESTAMPTZ)')
    await ensureSupportAiSchema()
    await ensureSupportAiSchema()
})
afterAll(async () => { await app.close(); await closeDatabase() })

test('guest AI history persists; retry is idempotent and separate visitors cannot read it', async () => {
    const hash = session(), request = input('How do I reset my password?')
    let calls = 0
    const result = await sendSupportChat(hash, request, async () => { calls++; return reply() })
    expect(result.channel).toBe('ai')
    expect(result.messages.map(m => m.sender_kind)).toEqual(['user', 'assistant'])
    await sendSupportChat(hash, request, async () => { calls++; return reply() })
    expect(calls).toBe(1)
    expect((await readSupportConversation(hash)).messages).toHaveLength(2)
    expect((await readSupportConversation(session())).messages).toHaveLength(0)
    const queue = (await app.inject({ url: '/support/tickets', headers: { 'test-user': 'agent' } })).json()
    expect(queue.tickets.some((t: any) => t.subject === request.message)).toBe(false)
})

test('handoff preserves history, enters staff queue, and returns agent replies to visitor', async () => {
    const hash = session()
    await sendSupportChat(hash, input('A billing question for testing'), reply)
    let called = false
    const result = await sendSupportChat(hash, input('Can I speak to a human?'), async () => { called = true; return reply() })
    expect(called).toBe(false)
    expect(result.channel).toBe('human')
    expect(result.messages.map(m => m.sender_kind)).toEqual(['user', 'assistant', 'user', 'system'])
    const queue = (await app.inject({ url: '/support/tickets', headers: { 'test-user': 'agent' } })).json()
    const ticket = queue.tickets.find((t: any) => t.subject === 'A billing question for testing')
    expect(ticket.user_name).toBe('Visitor')
    const url = `/support/tickets/${ticket.id}/messages`
    expect((await app.inject({ url })).statusCode).toBe(401)
    expect((await app.inject({ url, headers: { 'test-user': 'customer' } })).statusCode).toBe(404)
    expect((await app.inject({ url: '/support/tickets', headers: { 'test-user': 'customer' } })).json().tickets).toHaveLength(0)
    const transcript = (await app.inject({ url, headers: { 'test-user': 'agent' } })).json().messages
    expect(transcript.map((m: any) => m.sender_name)).toEqual(['Visitor', 'Hanasand AI', 'Visitor', 'Support'])
    expect((await app.inject({ method: 'POST', url, headers: { 'test-user': 'agent' }, payload: { message: 'I can help with that.' } })).statusCode).toBe(200)
    expect((await readSupportConversation(hash)).messages.at(-1)).toMatchObject({ body: 'I can help with that.', sender_kind: 'support', sender_name: 'Support Agent' })
    await sendSupportChat(hash, input('Thank you'), async () => { throw new Error('AI must not run after handoff') })
    expect((await readSupportConversation(hash)).messages.at(-1)?.body).toBe('Thank you')
})

test('AI failure saves the message; retry completes it exactly once', async () => {
    const hash = session(), request = input('Help me sign in')
    const failed = await sendSupportChat(hash, request, async () => { throw new Error('Model offline') })
    expect(failed.error).toContain('could not answer')
    expect(failed.messages).toHaveLength(1)
    expect(failed.pending).toBe(false)
    const recovered = await sendSupportChat(hash, request, reply)
    expect(recovered.messages).toHaveLength(2)
    expect(recovered.error).toBeUndefined()
})

test('handoff wins over pending AI, and duplicate handoff does not duplicate messages', async () => {
    const hash = session()
    let finish!: (value: string) => void
    let started!: () => void
    const waiting = new Promise<void>(resolve => { started = resolve })
    const sending = sendSupportChat(hash, input('A slow question'), () => { started(); return new Promise<string>(resolve => { finish = resolve }) })
    await waiting
    expect((await sendSupportChat(hash, input('Another question'), reply)).accepted).toBe(false)
    const transfer = input('Human please', true)
    await sendSupportChat(hash, transfer, reply)
    await sendSupportChat(hash, transfer, reply)
    finish('Late AI answer must not appear')
    await sending
    const final = await readSupportConversation(hash)
    expect(final.channel).toBe('human')
    expect(final.pending).toBe(false)
    expect(final.messages.map(m => m.sender_kind)).toEqual(['user', 'user', 'system'])
})

test('model handoff handles other languages without transferring general questions about humans', async () => {
    const result = await sendSupportChat(session(), input('Quiero hablar con una persona'), async () => handoffMarker)
    expect(result.channel).toBe('human')
    expect(result.messages.at(-1)?.sender_kind).toBe('system')
    expect(asksForHuman('I do not want a human')).toBe(false)
    expect(asksForHuman('Are you a human?')).toBe(false)
    expect(asksForHuman('Please connect me to a real person')).toBe(true)
})

test('public endpoint validates session and message length; handoff works without login or AI', async () => {
    expect((await app.inject({ url: '/support/chat' })).statusCode).toBe(400)
    const headers = { 'x-support-session': randomBytes(32).toString('hex') }
    expect((await app.inject({ url: '/support/chat?ticketId=anything', headers })).json().messages).toHaveLength(0)
    expect((await app.inject({ method: 'POST', url: '/support/chat', headers, payload: input('x'.repeat(4001)) })).statusCode).toBe(400)
    const response = await app.inject({ method: 'POST', url: '/support/chat', headers, payload: input('Talk to a human', true) })
    expect(response.statusCode).toBe(200)
    expect(response.json().channel).toBe('human')
})

test('Hanasand model answers support without broadcasting private output to AI viewers', async () => {
    const viewed: string[] = []
    const viewer = { readyState: 1, send: (message: string) => viewed.push(message) } as any
    const producer = { readyState: 1, send: (raw: string) => {
        const request = JSON.parse(raw)
        expect(request.messages[0].content).toContain('You are Hanasand AI')
        expect(request.messages.at(-1).content).toBe('Where are my subscriptions?')
        queueMicrotask(() => { void handleGptMessage('gpt', producer, Buffer.from(JSON.stringify({ type: 'prompt_complete', conversationId: request.conversationId, content: 'Open [Subscriptions](/subscription).' }))) })
    } } as any
    gpt.set('gpt', new Set([viewer, producer]))
    gptSockets.set(producer, { role: 'producer' } as any)
    gptSockets.set(viewer, { role: 'viewer' } as any)
    try {
        const result = await sendSupportChat(session(), input('Where are my subscriptions?'))
        expect(result.messages.at(-1)?.body).toContain('/subscription')
        expect(viewed).toHaveLength(0)
    } finally { gpt.delete('gpt'); gptSockets.delete(producer); gptSockets.delete(viewer) }
})


test('HTTP replica forwards inference to the model worker with only the session capability', async () => {
    const originalFetch = globalThis.fetch
    const originalBase = process.env.AI_HEALTH_WORKER_BASE
    process.env.AI_HEALTH_WORKER_BASE = 'http://127.0.0.1:8080'
    const token = randomBytes(32).toString('hex')
    globalThis.fetch = (async (url: unknown, options?: RequestInit) => {
        expect(String(url)).toBe('http://127.0.0.1:8080/api/support/chat')
        expect(new Headers(options?.headers).get('x-support-session')).toBe(token)
        expect(new Headers(options?.headers).get('authorization')).toBeNull()
        return Response.json({ channel: 'ai', pending: false, messages: [] })
    }) as typeof fetch
    try {
        const result = await app.inject({ method: 'POST', url: '/support/chat', headers: { 'x-support-session': token }, payload: input('Where is pricing?') })
        expect(result.statusCode).toBe(200)
        expect(result.json().channel).toBe('ai')
        expect((await app.inject({ method: 'POST', url: '/support/chat', headers: { 'x-support-session': token, 'x-support-forwarded': '1' }, payload: input('Help') })).statusCode).toBe(503)
    } finally {
        globalThis.fetch = originalFetch
        if (originalBase === undefined) delete process.env.AI_HEALTH_WORKER_BASE
        else process.env.AI_HEALTH_WORKER_BASE = originalBase
    }
})
