import { beforeEach, expect, mock, test } from 'bun:test'

let user: string | null = 'owner'
let vm: Record<string, unknown> | null
let purchase: Record<string, unknown>
let subscription: Record<string, unknown>
let calls = 0
let premium: unknown
let policyCalls: boolean[] = []
const id = '11111111-1111-4111-8111-111111111111'
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: Boolean(user), id: user }) }))
mock.module('../src/utils/vms/failover.ts', () => ({ assertFailoverAvailable: async () => 'ovhcloud' }))
mock.module('../src/utils/vms/ensureAlwaysRunning.ts', () => ({ applyAlwaysRunning: async (_vm: unknown, enabled: boolean) => { policyCalls.push(enabled) } }))
mock.module('../src/utils/db.ts', () => ({
    withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work(),
    default: async (sql: string, values: unknown[] = []) => {
        if (sql.startsWith('UPDATE container_subscriptions')) { purchase.status = values[2]; return { rows: [] } }
        if (sql.startsWith('UPDATE vms SET')) { premium = values[2]; return { rows: [] } }
        if (sql.startsWith('SELECT 1 FROM container_subscriptions')) return { rows: purchase.status === 'active' ? [{}] : [] }
        if (sql.includes('FROM container_subscriptions')) return { rows: [purchase] }
        if (sql.includes('FROM vms')) return { rows: vm && (!sql.includes('owner = $2') || values[1] === vm.owner) ? [vm] : [] }
        return { rows: [] }
    },
}))
const { containerCheckoutBody, validContainerSubscription, createContainerCheckout, applyContainerStripeEvent } = await import('../src/handlers/containerBilling.ts')
const realFetch = globalThis.fetch
beforeEach(() => {
    process.env.CONTAINER_HOST_OPTIONS_ENABLED = 'true'
    user = 'owner'; calls = 0; premium = undefined; policyCalls = []
    vm = { name: 'example-container', owner: 'owner', primary_host: 'inspur', deleted_at: null, always_running_premium: false }
    purchase = { id, vm_name: vm.name, user_id: 'owner', feature: 'always_running', status: 'pending', stripe_subscription_id: 'sub_example' }
    subscription = { id: 'sub_example', status: 'active', metadata: { container_purchase_id: id }, items: { data: [{ quantity: 1, price: { unit_amount: 4900, currency: 'nok', recurring: { interval: 'month', interval_count: 1 } } }] } }
})
function reply() {
    return { statusCode: 200, value: undefined as unknown, status(code: number) { this.statusCode = code; return this }, send(value: unknown) { this.value = value; return this } }
}
async function event(type = 'checkout.session.completed', payload: Record<string,unknown> = { subscription: 'sub_example', metadata: { container_purchase_id: id } }) {
    const previous = process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key'
    globalThis.fetch = (async () => { calls++; return Response.json(subscription) }) as typeof fetch
    try { return await applyContainerStripeEvent(type, payload) }
    finally { globalThis.fetch = realFetch; if (previous === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous }
}
test('monthly prices and container identity are explicit in checkout', () => {
    for (const [feature, amount] of [['always_running', '4900'], ['failover', '9900']] as const) {
        const body = containerCheckoutBody({ id, userId: 'owner', vmName: 'example-container', feature, site: 'https://example.com' })
        expect(body.get('line_items[0][price_data][unit_amount]')).toBe(amount)
        expect(body.get('line_items[0][price_data][currency]')).toBe('nok')
        expect(body.get('line_items[0][price_data][recurring][interval]')).toBe('month')
        expect(body.get('subscription_data[metadata][container_purchase_id]')).toBe(id)
    }
})
test('unpaid, wrong-price, wrong-currency, multiple-item and yearly subscriptions do not grant access', () => {
    expect(validContainerSubscription('always_running', subscription)).toBe(true)
    for (const value of [
        { ...subscription, status: 'trialing' }, { ...subscription, status: 'past_due' },
        { ...subscription, items: { data: [{ quantity: 1, price: { unit_amount: 49, currency: 'nok', recurring: { interval: 'month' } } }] } },
        { ...subscription, items: { data: [{ quantity: 1, price: { unit_amount: 4900, currency: 'usd', recurring: { interval: 'month' } } }] } },
        { ...subscription, items: { data: [{ quantity: 1, price: { unit_amount: 4900, currency: 'nok', recurring: { interval: 'month', interval_count: 12 } } }] } },
        { ...subscription, items: { data: [{}, {}] } },
    ]) expect(validContainerSubscription('always_running', value)).toBe(false)
})
test('checkout requires authentication, ownership, and no existing entitlement', async () => {
    const request = { body: { vmName: 'example-container', feature: 'always_running' }, log: { error() {} } }
    user = null
    let res = reply(); await createContainerCheckout(request as never, res as never); expect(res.statusCode).toBe(401)
    user = 'someone-else'
    res = reply(); await createContainerCheckout(request as never, res as never); expect(res.statusCode).toBe(404)
    user = 'owner'; vm!.always_running_premium = true
    res = reply(); await createContainerCheckout(request as never, res as never); expect(res.statusCode).toBe(409)
})
test('valid payment grants only its container entitlement', async () => {
    expect(await event()).toBe(true)
    expect(premium).toBe(true)
    expect(policyCalls).toEqual([])
})
test('an active subscription with an invalid amount stays invalid in storage', async () => {
    subscription.items = { data: [{ quantity: 1, price: { unit_amount: 1, currency: 'nok', recurring: { interval: 'month' } } }] }
    await event()
    expect(purchase.status).toBe('invalid')
    expect(premium).toBe(false)
})
test('cancellation disables the runtime policy, and a stale checkout cannot restore it', async () => {
    subscription.status = 'canceled'
    await event('customer.subscription.deleted', subscription)
    expect(calls).toBe(0)
    expect(premium).toBe(false)
    expect(policyCalls).toEqual([false])
    await event()
    expect(calls).toBe(1)
    expect(premium).toBe(false)
})
test('a deleted container identity never grants a recreated name access', async () => {
    purchase.vm_name = null
    await event()
    expect(premium).toBeUndefined()
    expect(policyCalls).toEqual([])
})
