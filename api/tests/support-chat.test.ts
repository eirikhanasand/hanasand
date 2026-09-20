import { afterAll, beforeAll, expect, mock, test } from 'bun:test'
import { randomBytes, randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import WebSocket from 'ws'
import { once } from 'node:events'
import { supportNotifications } from '../src/utils/support/live.ts'
import registerSupportStream, { supportChangeAllowed } from '../src/handlers/supportStream.ts'
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
const { getSupportTickets, getSupportMessages, postSupportMessage, postSupportStatus, postSupportFeedback } = await import('../src/handlers/supportChat.ts')
const app = Fastify({ forceCloseConnections: true })
await app.register(websocket)
registerSupportStream(app)
app.get('/support/chat', publicSupportChat)
app.post('/support/chat', publicSupportChat)
app.get('/support/tickets', getSupportTickets)
app.get('/support/tickets/:id/messages', getSupportMessages)
app.post('/support/tickets/:id/messages', postSupportMessage)
app.post('/support/tickets/:id/status', postSupportStatus)
app.post('/support/tickets/:id/feedback', postSupportFeedback)
const session = () => supportSessionHash(randomBytes(32).toString('hex'))
const input = (message: string, handoff = false) => ({ requestId: randomUUID(), message, handoff })
const reply = async () => 'You can reset your password from the sign-in page.'

beforeAll(async () => {
    // This file refuses to run outside its disposable database.
    await query('DROP TABLE IF EXISTS support_live_tickets, support_messages, support_tickets, user_roles, roles, users, api_rate_limit_buckets CASCADE')
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
afterAll(async () => { for (const socket of app.websocketServer.clients) socket.terminate(); await app.close(); await closeDatabase() })

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
    expect(asksForHuman('let me speakk with support')).toBe(true)
    expect(asksForHuman('Kan jeg snakke med support?')).toBe(true)
    expect(asksForHuman('I do not want to speak with support')).toBe(false)
})

test('public endpoint validates session and message length; handoff works without login or AI', async () => {
    expect((await app.inject({ url: '/support/chat' })).statusCode).toBe(400)
    const headers = { 'x-support-session': randomBytes(32).toString('hex') }
    expect((await app.inject({ url: '/support/chat?ticketId=anything', headers })).json().messages).toHaveLength(0)
    expect((await app.inject({ method: 'POST', url: '/support/chat', headers, payload: input('x'.repeat(4001)) })).statusCode).toBe(400)
    const response = await app.inject({ method: 'POST', url: '/support/chat', headers, payload: input('let me speakk with support') })
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


test('one visitor can create and revisit independent chats without accessing another visitor', async () => {
    const hash = session(), first = randomUUID(), second = randomUUID()
    const firstInput = { ...input('First chat'), conversationId: first }
    await sendSupportChat(hash, firstInput, reply)
    await sendSupportChat(hash, { ...input('Second chat'), conversationId: second }, reply)
    await sendSupportChat(hash, firstInput, reply)
    const old = await readSupportConversation(hash, first)
    expect(old.tickets).toHaveLength(2)
    expect(old.messages).toHaveLength(2)
    expect(old.messages[0].body).toBe('First chat')
    expect((await readSupportConversation(hash, second)).messages[0].body).toBe('Second chat')
    expect((await readSupportConversation(session(), first)).messages).toHaveLength(0)
    await expect(sendSupportChat(session(), { ...input('Intrusion'), conversationId: first }, reply)).rejects.toThrow('Conversation not found')
    expect((await readSupportConversation(hash, first)).messages).toHaveLength(2)
    const url = `/support/tickets/${first}/messages`
    await app.inject({ method: 'POST', url, headers: { 'test-user': 'agent' }, payload: { message: 'Hello from your agent.' } })
    expect((await readSupportConversation(hash, first)).agent_name).toBe('Support Agent')
    expect((await readSupportConversation(hash, second)).agent_name).toBeNull()
})

test('WebSockets use one-use visitor tickets and deliver committed changes across database connections', async () => {
    const address = await app.listen({ port: 0, host: '127.0.0.1' })
    const connect = async (token: string) => {
        const response = await app.inject({ method: 'POST', url: '/support/chat', headers: { 'x-support-session': token }, payload: { action: 'connect' } })
        expect(response.statusCode).toBe(200)
        const ticket = response.json().ticket
        const socket = new WebSocket(address.replace('http:', 'ws:') + '/api/ws/support', { headers: { Origin: 'https://hanasand.com' } })
        await once(socket, 'open')
        const messages: any[] = []
        socket.on('message', raw => messages.push(JSON.parse(raw.toString())))
        socket.send(JSON.stringify({ type: 'auth', ticket }))
        for (let i=0; i<100 && !messages.some(message => message.type === 'ready'); i++) await Bun.sleep(10)
        expect(messages.some(message => message.type === 'ready')).toBe(true)
        return { socket, messages, ticket }
    }
    const token = randomBytes(32).toString('hex'), hash = supportSessionHash(token)
    const a = await connect(token), b = await connect(randomBytes(32).toString('hex'))
    const secondReplica = supportNotifications(error => { throw error })
    const changes: string[] = []
    const unsubscribe = secondReplica.subscribe(change => { if (change) changes.push(change.id) })
    await Bun.sleep(100)
    a.messages.length = 0; b.messages.length = 0
    const id = randomUUID(), started = Date.now()
    await sendSupportChat(hash, { ...input('Talk to a human', true), conversationId: id }, reply)
    for (let i=0; i<100 && !a.messages.some(message => message.id === id); i++) await Bun.sleep(10)
    expect(a.messages.some(message => message.id === id)).toBe(true)
    expect(Date.now()-started).toBeLessThan(1000)
    expect(b.messages.some(message => message.id === id)).toBe(false)
    expect(changes).toContain(id)
    expect(supportChangeAllowed({ id, visitor: hash, user: null, channel: 'human' }, { id: 'agent', support: true })).toBe(true)
    expect(supportChangeAllowed({ id, visitor: hash, user: null, channel: 'ai' }, { id: 'agent', support: true })).toBe(false)
    const reused = new WebSocket(address.replace('http:', 'ws:') + '/api/ws/support', { headers: { Origin: 'https://hanasand.com' } })
    await once(reused, 'open'); const closed = once(reused, 'close')
    reused.send(JSON.stringify({ type: 'auth', ticket: a.ticket }))
    expect((await closed)[0]).toBe(1008)
    const unauthorized = new WebSocket(address.replace('http:', 'ws:') + '/api/ws/support', { headers: { Origin: 'https://evil.example' } })
    expect((await once(unauthorized, 'close'))[0]).toBe(1008)
    a.socket.close(); b.socket.close(); unsubscribe(); await secondReplica.close()
})


test('resolving locks chat, notifies the visitor, stores private feedback and allows staff to reopen', async () => {
    const token = randomBytes(32).toString('hex'), hash = supportSessionHash(token)
    const chat = await sendSupportChat(hash, input('Resolution verification', true), reply)
    const url = `/support/tickets/${chat.id}/status`
    const close = () => app.inject({ method: 'POST', url, headers: { 'test-user': 'agent' }, payload: { status: 'closed' } })
    expect((await app.inject({ method: 'POST', url, headers: { 'test-user': 'customer' }, payload: { status: 'closed' } })).statusCode).toBe(403)
    const saved = await close()
    expect(saved.statusCode).toBe(200)
    expect(saved.json().ticket).toMatchObject({ id: chat.id, status: 'closed', resolution_version: 1, feedback_rating: null })
    expect(saved.json().ticket).not.toHaveProperty('visitor_session_hash')
    expect(saved.json().message).toMatchObject({ sender_kind: 'system', sender_name: 'Support' })
    expect((await close()).json()).toMatchObject({ ok: true, ticket: saved.json().ticket })
    let resolved = await readSupportConversation(hash, chat.id)
    expect(resolved.status).toBe('closed')
    expect(resolved.resolution_version).toBe(1)
    expect(resolved.reply_count).toBe(1)
    expect(resolved.messages.filter(m => m.body.startsWith('Chat resolved.'))).toHaveLength(1)
    expect((await app.inject({ method: 'POST', url: '/support/chat', headers: { 'x-support-session': token }, payload: { ...input('Do not reopen', true), conversationId: chat.id } })).statusCode).toBe(409)
    expect((await app.inject({ method: 'POST', url: `/support/tickets/${chat.id}/messages`, headers: { 'test-user': 'agent' }, payload: { message: 'Blocked reply' } })).statusCode).toBe(409)
    const feedback = { action: 'feedback', conversationId: chat.id, resolutionVersion: 1, rating: 2, comment: 'Please reply sooner.' }
    const rate = (payload = feedback, visitor = token) => app.inject({ method: 'POST', url: '/support/chat', headers: { 'x-support-session': visitor }, payload })
    expect((await rate(feedback, randomBytes(32).toString('hex'))).statusCode).toBe(404)
    expect((await rate({ ...feedback, rating: 6 })).statusCode).toBe(400)
    expect((await rate({ ...feedback, rating: 2.5 })).statusCode).toBe(400)
    expect((await rate({ ...feedback, comment: 'x'.repeat(2001) })).statusCode).toBe(400)
    expect((await rate()).statusCode).toBe(200)
    expect((await rate()).statusCode).toBe(200)
    expect((await rate({ ...feedback, rating: 4 })).statusCode).toBe(409)
    const tickets = (await app.inject({ url: '/support/tickets', headers: { 'test-user': 'agent' } })).json().tickets
    expect(tickets.find((t: any) => t.id === chat.id)).toMatchObject({ status: 'closed', feedback_rating: 2, feedback_comment: 'Please reply sooner.' })
    expect((await app.inject({ method: 'POST', url, headers: { 'test-user': 'agent' }, payload: { status: 'open' } })).statusCode).toBe(200)
    expect((await rate()).statusCode).toBe(409)
    await sendSupportChat(hash, { ...input('Reopened message'), conversationId: chat.id }, reply)
    await close()
    expect((await rate()).statusCode).toBe(409)
    expect((await rate({ ...feedback, resolutionVersion: 2, rating: 5, comment: 'Ignored high-rating comment' })).statusCode).toBe(200)
    resolved = await readSupportConversation(hash, chat.id)
    expect(resolved).toMatchObject({ status: 'closed', feedback_rating: 5, feedback_comment: '', resolution_version: 2 })
    expect(resolved.messages.filter(m => m.body.startsWith('Customer feedback:'))).toHaveLength(2)
    expect(resolved.messages.some(m => m.body.includes('Please reply sooner.'))).toBe(true)
})

test('resolution cancels a pending AI answer and authenticated feedback is owner-only', async () => {
    const hash = session(), id = randomUUID()
    let finish!: (value: string) => void, started!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    const pending = sendSupportChat(hash, { ...input('Pending resolution'), conversationId: id }, () => { started(); return new Promise<string>(resolve => { finish = resolve }) })
    await ready
    await app.inject({ method: 'POST', url: `/support/tickets/${id}/status`, headers: { 'test-user': 'agent' }, payload: { status: 'closed' } })
    finish('This late answer must be suppressed')
    const chat = await pending
    expect(chat.status).toBe('closed')
    expect(chat.pending).toBe(false)
    expect(chat.messages.some(m => m.sender_kind === 'assistant')).toBe(false)
    const ownId = randomUUID()
    await query("INSERT INTO support_tickets(id,user_id,subject,status,resolution_version) VALUES($1,'customer','Account chat','closed',0)", [ownId])
    const request = { method: 'POST' as const, url: `/support/tickets/${ownId}/feedback`, payload: { rating: 3, comment: 'More detail please', resolutionVersion: 0 } }
    expect((await app.inject({ ...request, headers: { 'test-user': 'agent' } })).statusCode).toBe(404)
    expect((await app.inject({ ...request, headers: { 'test-user': 'customer' } })).statusCode).toBe(200)
})
