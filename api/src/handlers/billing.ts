import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHmac, timingSafeEqual } from 'node:crypto'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

const plans = {
    'threat-intelligence': { quotas: { searchesPerDay: 100 }, features: ['actor profiles', 'intelligence search', 'API access', 'saved searches'] },
    monitoring: { quotas: { watchTerms: 25 }, features: ['customer watchlists', 'evidence-backed alerts', 'case workflow', 'source freshness'] },
    scanner: { quotas: { monitoredTargets: 10 }, features: ['scheduled scans', 'severity findings', 'scan history', 'run-now controls'] },
    browser: { quotas: { browserRunsPerMonth: 100 }, features: ['clearweb browsing', 'safe darkweb previews', 'evidence capture', 'run history'] },
} as const

export type BillingQuotaKey = 'searchesPerDay' | 'watchTerms' | 'monitoredTargets' | 'browserRunsPerMonth'
type BillingQuotaPeriod = 'day' | 'month' | 'lifetime'
type BillingQuota = { key: BillingQuotaKey, limit: number | null, used: number, remaining: number | null, periodStart: Date | null, resetsAt: Date | null }

const quotaPeriods: Record<BillingQuotaKey, BillingQuotaPeriod> = {
    searchesPerDay: 'day',
    watchTerms: 'lifetime',
    monitoredTargets: 'lifetime',
    browserRunsPerMonth: 'month',
}

export async function getBillingQuota(userId: string, key: BillingQuotaKey): Promise<BillingQuota> {
    const storagePeriod = periodStartFor(quotaPeriods[key])
    const [entitlements, usage] = await Promise.all([
        run(`
            SELECT COALESCE(SUM((quotas ->> $2)::int), 0)::int AS quota
            FROM billing_entitlements
            WHERE user_id = $1 AND active IS TRUE AND quotas ? $2
        `, [userId, key]),
        run('SELECT used FROM billing_usage WHERE user_id = $1 AND quota_key = $2 AND period_start = $3', [userId, key, storagePeriod]),
    ])
    const limit = Number(entitlements.rows[0]?.quota || 0) || null
    const used = Number(usage.rows[0]?.used || 0)
    return { key, limit, used, remaining: limit === null ? null : Math.max(0, limit - used), periodStart: quotaPeriods[key] === 'lifetime' ? null : storagePeriod, resetsAt: resetAtFor(quotaPeriods[key]) }
}

export async function consumeBillingQuota(userId: string, key: BillingQuotaKey, amount = 1) {
    if (!Number.isInteger(amount) || amount < 1) throw new Error('Quota amount must be a positive integer.')
    const period = quotaPeriods[key]
    const periodStart = periodStartFor(period)
    return withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`billing:${userId}:${key}:${periodStart?.toISOString() || 'lifetime'}`])
        const entitlements = await query(`
            SELECT COALESCE(SUM((quotas ->> $2)::int), 0)::int AS quota
            FROM billing_entitlements WHERE user_id = $1 AND active IS TRUE AND quotas ? $2
        `, [userId, key])
        const limit = Number(entitlements.rows[0]?.quota || 0) || null
        const current = await query('SELECT used FROM billing_usage WHERE user_id = $1 AND quota_key = $2 AND period_start = $3 FOR UPDATE', [userId, key, periodStart])
        const used = Number(current.rows[0]?.used || 0)
        const allowed = limit !== null && used + amount <= limit
        if (allowed) {
            await query(`
                INSERT INTO billing_usage (user_id, quota_key, period_start, used) VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, quota_key, period_start) DO UPDATE SET used = EXCLUDED.used, updated_at = NOW()
            `, [userId, key, periodStart, used + amount])
        }
        return { key, limit, used: allowed ? used + amount : used, remaining: limit === null ? null : Math.max(0, limit - (allowed ? used + amount : used)), periodStart: period === 'lifetime' ? null : periodStart, resetsAt: resetAtFor(period), allowed, subscriptionRequired: limit === null }
    })
}

export async function checkBillingCapacity(userId: string, key: BillingQuotaKey, used: number) {
    const quota = await getBillingQuota(userId, key)
    return { ...quota, allowed: quota.limit !== null && used < quota.limit, subscriptionRequired: quota.limit === null }
}

type StripeEvent = { id?: string, type?: string, data?: { object?: Record<string, unknown> } }

export async function getBillingSubscription(req: FastifyRequest, reply: FastifyReply) {
    const auth = await tokenWrapper(req, reply)
    if (!auth.valid || !auth.id) return reply.status(401).send({ error: 'Unauthorized.' })
    const result = await run(`
        SELECT plan_id, status, current_period_start, current_period_end, cancel_at_period_end
        FROM billing_subscriptions
        WHERE user_id = $1
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
    `, [auth.id])
    const entitlements = await run(`
        SELECT plan_id, quotas, features
        FROM billing_entitlements
        WHERE user_id = $1 AND active IS TRUE
        ORDER BY updated_at DESC
    `, [auth.id])
    const subscription = result.rows[0]
    const quotaKeys: BillingQuotaKey[] = ['searchesPerDay', 'watchTerms', 'monitoredTargets', 'browserRunsPerMonth']
    const quotas = await Promise.all(quotaKeys.map(key => getBillingQuota(auth.id!, key)))
    return reply.send({
        subscription: subscription ? {
            planId: subscription.plan_id,
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
        } : null,
        entitlements: entitlements.rows.map(row => ({ planId: row.plan_id, quotas: row.quotas, features: row.features })),
        quotas: quotas.map(quota => ({ ...quota, periodStart: quota.periodStart?.toISOString() || null, resetsAt: quota.resetsAt?.toISOString() || null })),
    })
}

export async function createBillingPortal(req: FastifyRequest, reply: FastifyReply) {
    const auth = await tokenWrapper(req, reply)
    if (!auth.valid || !auth.id) return reply.status(401).send({ error: 'Unauthorized.' })
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) return reply.status(503).send({ error: 'Billing is temporarily unavailable.' })
    const customer = await run('SELECT stripe_customer_id FROM billing_customers WHERE user_id = $1', [auth.id])
    const customerId = customer.rows[0]?.stripe_customer_id as string | undefined
    if (!customerId) return reply.status(409).send({ error: 'Complete a purchase before opening billing management.' })
    const body = new URLSearchParams({
        customer: customerId,
        return_url: process.env.PUBLIC_SITE_URL || 'https://hanasand.com/subscription',
    })
    const response = await stripeRequest('/v1/billing_portal/sessions', secret, body)
    if (!response.ok || typeof response.payload.url !== 'string') return reply.status(502).send({ error: 'Billing management could not be opened.' })
    return reply.send({ url: response.payload.url })
}

export async function receiveStripeWebhook(req: FastifyRequest, reply: FastifyReply) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) return reply.status(503).send({ error: 'Stripe webhook is not configured.' })
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    const signature = header(req.headers['stripe-signature'])
    if (!verifyStripeSignature(rawBody, signature, secret)) return reply.status(400).send({ error: 'Invalid Stripe signature.' })
    let event: StripeEvent
    try {
        event = JSON.parse(rawBody) as StripeEvent
    } catch {
        return reply.status(400).send({ error: 'Invalid Stripe event.' })
    }
    const eventType = event.type
    if (!event.id || !eventType || !event.data?.object) return reply.status(400).send({ error: 'Incomplete Stripe event.' })
    await applyStripeEvent({ ...event, type: eventType })
    const inserted = await run(`
        INSERT INTO stripe_webhook_events (event_id, event_type, payload)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
    `, [event.id, eventType, rawBody])
    if (!inserted.rowCount) return reply.send({ received: true, duplicate: true })
    return reply.send({ received: true })
}

async function applyStripeEvent(event: StripeEvent) {
    const object = event.data!.object!
    if (event.type === 'checkout.session.completed') {
        const userId = text((object.metadata as Record<string, unknown> | undefined)?.user_id)
        const planId = text((object.metadata as Record<string, unknown> | undefined)?.plan_id)
        const customerId = text(object.customer)
        const subscriptionId = text(object.subscription)
        if (userId && customerId) await run(`
            INSERT INTO billing_customers (user_id, stripe_customer_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = NOW()
        `, [userId, customerId])
        if (userId && customerId && subscriptionId && planId && planId in plans) {
            await upsertSubscription({ userId, customerId, subscriptionId, planId, status: 'active' })
        }
        return
    }
    if (!event.type || !event.type.startsWith('customer.subscription.')) return
    const subscriptionId = text(object.id)
    const customerId = text(object.customer)
    if (!subscriptionId || !customerId) return
    const metadata = (object.metadata as Record<string, unknown> | undefined) || {}
    const existing = await run('SELECT user_id, plan_id FROM billing_subscriptions WHERE stripe_subscription_id = $1', [subscriptionId])
    const userId = text(metadata.user_id) || text(existing.rows[0]?.user_id)
    const planId = text(metadata.plan_id) || text(existing.rows[0]?.plan_id)
    if (!userId || !(planId in plans)) return
    const status = event.type === 'customer.subscription.deleted' ? 'canceled' : text(object.status) || 'active'
    await run(`
        INSERT INTO billing_customers (user_id, stripe_customer_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = NOW()
    `, [userId, customerId])
    await upsertSubscription({
        userId,
        customerId,
        subscriptionId,
        planId,
        status,
        currentPeriodStart: stripeDate(object.current_period_start),
        currentPeriodEnd: stripeDate(object.current_period_end),
        cancelAtPeriodEnd: object.cancel_at_period_end === true,
    })
}

async function upsertSubscription(input: { userId: string, customerId: string, subscriptionId: string, planId: string, status: string, currentPeriodStart?: Date | null, currentPeriodEnd?: Date | null, cancelAtPeriodEnd?: boolean }) {
    const entitlement = plans[input.planId as keyof typeof plans]
    await run(`
        INSERT INTO billing_subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (stripe_subscription_id) DO UPDATE SET
            user_id = EXCLUDED.user_id, stripe_customer_id = EXCLUDED.stripe_customer_id, plan_id = EXCLUDED.plan_id,
            status = EXCLUDED.status, current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = NOW()
    `, [input.userId, input.customerId, input.subscriptionId, input.planId, input.status, input.currentPeriodStart || null, input.currentPeriodEnd || null, input.cancelAtPeriodEnd || false])
    await run(`
        INSERT INTO billing_entitlements (user_id, plan_id, active, quotas, features)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
        ON CONFLICT (user_id, plan_id) DO UPDATE SET active = EXCLUDED.active, quotas = EXCLUDED.quotas, features = EXCLUDED.features, updated_at = NOW()
    `, [input.userId, input.planId, ['active', 'trialing'].includes(input.status), JSON.stringify(entitlement.quotas), JSON.stringify(entitlement.features)])
}

async function stripeRequest(path: string, secret: string, body: URLSearchParams) {
    const response = await fetch(`https://api.stripe.com${path}`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    })
    const payload = await response.json() as Record<string, unknown>
    return { ok: response.ok, payload }
}

export function verifyStripeSignature(payload: string, signature: string, secret: string, now = Math.floor(Date.now() / 1000)) {
    const parts = Object.fromEntries(signature.split(',').map(item => item.split('=')))
    const timestamp = Number(parts.t)
    const digest = parts.v1
    if (!Number.isFinite(timestamp) || !digest || Math.abs(now - timestamp) > 300) return false
    const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
    const actual = Buffer.from(digest, 'hex')
    const wanted = Buffer.from(expected, 'hex')
    return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}

function header(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || '' : value || '' }
function text(value: unknown) { return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '' }
function stripeDate(value: unknown) { const number = Number(value); return Number.isFinite(number) && number > 0 ? new Date(number * 1000) : null }
function periodStartFor(period: BillingQuotaPeriod) {
    if (period === 'lifetime') return new Date(0)
    const now = new Date()
    return period === 'day'
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
function resetAtFor(period: BillingQuotaPeriod) {
    if (period === 'lifetime') return null
    const now = new Date()
    return period === 'day'
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}
