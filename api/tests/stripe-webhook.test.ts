import { beforeEach, expect, mock, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'

let userExists = true
let failWrite = false
let events = new Map<string, string>()
let writes: string[] = []
const query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes('INSERT INTO stripe_webhook_events')) {
        const id = String(params[0])
        if (events.has(id)) return { rows: [], rowCount: 0 }
        events.set(id, String(params[2]))
    } else if (sql.includes('UPDATE stripe_webhook_events')) events.set(String(params[0]), String(params[1]))
    else if (sql.includes('FROM users')) return { rows: userExists ? [{ id: 'member' }] : [], rowCount: userExists ? 1 : 0 }
    else if (sql.includes('SELECT user_id, plan_id')) return { rows: [], rowCount: 0 }
    else if (sql.includes('INSERT INTO billing_')) {
        if (failWrite) throw new Error('Database unavailable')
        writes.push(sql.includes('billing_entitlements') ? String(params[2]) : 'write')
    }
    return { rows: [{}], rowCount: 1 }
}
mock.module('../src/utils/db.ts', () => ({ default: query, withTransaction: async (work: (txQuery: typeof query) => Promise<unknown>) => {
    const savedEvents = new Map(events), savedWrites = [...writes]
    try { return await work(query) } catch (error) { events = savedEvents; writes = savedWrites; throw error }
} }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: false }) }))
const { receiveStripeWebhook } = await import('../src/handlers/billing.ts')
const secret = 'webhook-unit-test-secret'

beforeEach(() => { process.env.STRIPE_WEBHOOK_SECRET = secret; userExists = true; failWrite = false; events = new Map(); writes = [] })
async function deliver(type = 'customer.subscription.deleted', validSignature = true) {
    const body = JSON.stringify({ id: 'evt_test', type, data: { object: { id: 'sub_test', customer: 'cus_test', subscription: 'sub_test', status: 'active', metadata: { user_id: 'member', plan_id: 'browser' } } } })
    const timestamp = Math.floor(Date.now() / 1000)
    const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
    const req = { body, headers: { 'stripe-signature': `t=${timestamp},v1=${validSignature ? digest : '00'}` } } as unknown as FastifyRequest
    let status = 200, payload: unknown
    const reply = { status(code: number) { status = code; return this }, send(value: unknown) { payload = value; return value } } as unknown as FastifyReply
    await receiveStripeWebhook(req, reply)
    return { status, payload }
}

test('rejects invalid signatures without touching billing', async () => {
    expect((await deliver(undefined, false)).status).toBe(400)
    expect(events.size).toBe(0)
})
for (const type of ['checkout.session.completed', 'customer.subscription.deleted']) {
    test(`acknowledges ${type} for erased accounts without restoring their data`, async () => {
        userExists = false
        expect(await deliver(type)).toEqual({ status: 200, payload: { received: true, ignored: true } })
        expect(writes).toEqual([])
        expect(events.get('evt_test')).not.toContain('member')
    })
}
test('applies cancellation once and does not repeat it on duplicate delivery', async () => {
    await deliver()
    expect(writes).toEqual(['write', 'write', 'false'])
    expect((await deliver()).payload).toEqual({ received: true, duplicate: true })
    expect(writes).toHaveLength(3)
})
test('failed processing rolls back its event receipt so a retry can succeed', async () => {
    failWrite = true
    await expect(deliver('checkout.session.completed')).rejects.toThrow('Database unavailable')
    expect(events.size).toBe(0)
    failWrite = false
    expect((await deliver('checkout.session.completed')).status).toBe(200)
    expect(writes).toEqual(['write', 'write', 'true'])
})
