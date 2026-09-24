import { applyAlwaysRunning } from '#utils/vms/ensureAlwaysRunning.ts'
import { assertFailoverAvailable } from '#utils/vms/failover.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { vmLifecycleLock } from '#utils/vms/lifecycleLock.ts'

export const containerPlans = {
    always_running: { name: 'Always running', priceNok: 49 },
    failover: { name: 'Failover', priceNok: 99 },
} as const
type Feature = keyof typeof containerPlans

export async function ensureContainerBillingSchema() {
    await run(`CREATE TABLE IF NOT EXISTS container_subscriptions (
        id UUID PRIMARY KEY, vm_name TEXT REFERENCES vms(name) ON UPDATE CASCADE ON DELETE SET NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, feature TEXT NOT NULL CHECK (feature IN ('always_running','failover')),
        stripe_subscription_id TEXT UNIQUE, stripe_checkout_id TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await run('CREATE INDEX IF NOT EXISTS container_subscriptions_vm ON container_subscriptions(vm_name, feature)')
}

async function stripe(path: string, body?: URLSearchParams, idempotencyKey?: string) {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) throw new Error('Checkout is not configured.')
    const response = await fetch('https://api.stripe.com/v1/' + path, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: 'Basic ' + Buffer.from(secret + ':').toString('base64'),
            ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
        body, signal: AbortSignal.timeout(15000),
    })
    const result = await response.json()
    if (!response.ok) throw new Error('Stripe could not complete this request.')
    return result
}

export function containerCheckoutBody(input: { id: string, userId: string, vmName: string, feature: Feature, site: string }) {
    const plan = containerPlans[input.feature]
    return new URLSearchParams({
        mode: 'subscription', 'line_items[0][price_data][currency]': 'nok',
        'line_items[0][price_data][unit_amount]': String(plan.priceNok * 100),
        'line_items[0][price_data][recurring][interval]': 'month',
        'line_items[0][price_data][product_data][name]': plan.name + ' — ' + input.vmName,
        'line_items[0][price_data][product_data][description]': 'Monthly option for one container: ' + input.vmName,
        'line_items[0][quantity]': '1',
        'metadata[container_purchase_id]': input.id,
        'subscription_data[metadata][container_purchase_id]': input.id,
        'subscription_data[metadata][user_id]': input.userId,
        success_url: input.site + '/vms/' + encodeURIComponent(input.vmName) + '?checkout=success',
        cancel_url: input.site + '/subscription?container=' + encodeURIComponent(input.vmName),
    })
}

export async function getContainerProducts(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) return res.status(401).send({ error: 'Unauthorized.' })
    const containers = await run(`SELECT name, primary_host, always_running_premium, failover_premium FROM vms
        WHERE owner = $1 AND deleted_at IS NULL ORDER BY name`, [auth.id])
    return res.header('Cache-Control', 'no-store').send({
        plans: Object.entries(containerPlans).map(([id, plan]) => ({ id, ...plan, currency: 'NOK', interval: 'month' })),
        containers: containers.rows,
    })
}

export async function createContainerCheckout(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) return res.status(401).send({ error: 'Unauthorized.' })
    const body = req.body as { vmName?: string, feature?: string } | undefined
    if (!body || typeof body.vmName !== 'string' || !Object.hasOwn(containerPlans, body.feature || '')) {
        return res.status(400).send({ error: 'Select a container and a host option.' })
    }
    if (process.env.CONTAINER_HOST_OPTIONS_ENABLED !== 'true') return res.status(503).send({ error: 'Container purchases are not available yet.' })
    const feature = body.feature as Feature
    try {
        return await vmLifecycleLock(body.vmName, async () => {
            const vm = (await run('SELECT * FROM vms WHERE name = $1 AND owner = $2 AND deleted_at IS NULL', [body.vmName!, auth.id!])).rows[0]
            if (!vm) return res.status(404).send({ error: 'Select a container you own that is not scheduled for deletion.' })
            if (vm[feature + '_premium']) return res.status(409).send({ error: 'This container already has that option.' })
            if (feature === 'failover') await assertFailoverAvailable(vm)
            let purchase = (await run(`SELECT * FROM container_subscriptions WHERE vm_name = $1 AND feature = $2
                AND user_id = $3 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`, [vm.name, feature, auth.id!])).rows[0]
            if (purchase?.stripe_checkout_id) {
                const existing = await stripe('checkout/sessions/' + encodeURIComponent(purchase.stripe_checkout_id))
                if (existing.status === 'open' && existing.url) return res.send({ url: existing.url })
                if (existing.status === 'complete') return res.status(409).send({ error: 'Payment is being confirmed. Please refresh shortly.' })
                await run('UPDATE container_subscriptions SET status = \'expired\' WHERE id = $1', [purchase.id])
                purchase = null
            }
            if (!purchase) {
                purchase = (await run('INSERT INTO container_subscriptions (id, vm_name, user_id, feature) VALUES ($1,$2,$3,$4) RETURNING *',
                    [randomUUID(), vm.name, auth.id!, feature])).rows[0]
            }
            const site = (process.env.FRONTEND_URL || 'https://hanasand.com').replace(/\/$/, '')
            const params = containerCheckoutBody({ id: purchase.id, userId: auth.id!, vmName: vm.name, feature, site })
            const customer = (await run('SELECT stripe_customer_id FROM billing_customers WHERE user_id = $1', [auth.id!])).rows[0]
            if (customer?.stripe_customer_id) params.set('customer', customer.stripe_customer_id)
            const session = await stripe('checkout/sessions', params, 'container-' + purchase.id)
            if (!session.url || !session.id) throw new Error('Checkout did not return a payment link.')
            await run('UPDATE container_subscriptions SET stripe_checkout_id = $2 WHERE id = $1', [purchase.id, session.id])
            return res.send({ url: session.url })
        })
    } catch (error) {
        req.log.error({ err: error }, 'Container checkout failed')
        return res.status(503).send({ error: 'Checkout is temporarily unavailable. Please try again.' })
    }
}

// Read current Stripe state instead of granting access from an old or unpaid checkout event.
export async function applyContainerStripeEvent(type: string, object: Record<string, unknown>) {
    if (type !== 'checkout.session.completed' && !type.startsWith('customer.subscription.')) return false
    const subscriptionId = type === 'checkout.session.completed' ? object.subscription : object.id
    const metadata = object.metadata as Record<string, unknown> | undefined
    const purchaseId = metadata?.container_purchase_id
    if (typeof subscriptionId !== 'string') return false
    let purchase = typeof purchaseId === 'string'
        ? (await run('SELECT * FROM container_subscriptions WHERE id::text = $1', [purchaseId])).rows[0]
        : (await run('SELECT * FROM container_subscriptions WHERE stripe_subscription_id = $1', [subscriptionId])).rows[0]
    if (!purchase) return false
    const subscription = type === 'customer.subscription.deleted' ? object : await stripe('subscriptions/' + encodeURIComponent(subscriptionId))
    if (subscription.metadata?.container_purchase_id !== purchase.id) throw new Error('Container subscription metadata mismatch.')
    if (purchase.stripe_subscription_id && purchase.stripe_subscription_id !== subscriptionId) throw new Error('Container subscription already bound.')
    const active = validContainerSubscription(purchase.feature as Feature, subscription)
    if (!purchase.vm_name) {
        await run('UPDATE container_subscriptions SET stripe_subscription_id = $2, status = $3, updated_at = NOW() WHERE id = $1',
            [purchase.id, subscriptionId, active ? 'active' : subscription.status === 'active' ? 'invalid' : String(subscription.status || 'inactive')])
        return true
    }
    await vmLifecycleLock(purchase.vm_name, async () => {
        purchase = (await run('SELECT * FROM container_subscriptions WHERE id = $1', [purchase.id])).rows[0]
        await run('UPDATE container_subscriptions SET stripe_subscription_id = $2, status = $3, updated_at = NOW() WHERE id = $1',
            [purchase.id, subscriptionId, active ? 'active' : subscription.status === 'active' ? 'invalid' : String(subscription.status || 'inactive')])
        const entitled = (await run('SELECT 1 FROM container_subscriptions WHERE vm_name = $1 AND feature = $2 AND user_id = $3 AND status = \'active\' LIMIT 1',
            [purchase.vm_name, purchase.feature, purchase.user_id])).rows.length > 0
        const column = purchase.feature === 'always_running' ? 'always_running' : 'failover'
        if (column === 'always_running' && !entitled) {
            const vm = (await run('SELECT * FROM vms WHERE name = $1 AND owner = $2', [purchase.vm_name, purchase.user_id])).rows[0]
            if (vm && !vm.deleted_at) await applyAlwaysRunning(vm, false)
            if (vm?.deleted_at) await run('UPDATE vms SET deletion_restore = jsonb_set(deletion_restore, \'{autostart}\', \'"false"\'::jsonb) WHERE name = $1 AND owner = $2', [purchase.vm_name, purchase.user_id])
        }

        await run(`UPDATE vms SET ${column}_premium = $3, ${column}_enabled = ${column}_enabled AND $3
            WHERE name = $1 AND owner = $2`, [purchase.vm_name, purchase.user_id, entitled])
        const customer = typeof subscription.customer === 'string' ? subscription.customer : ''
        if (customer) await run(`INSERT INTO billing_customers (user_id, stripe_customer_id) VALUES ($1,$2)
            ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = NOW()`, [purchase.user_id, customer])
    })
    return true
}

export function validContainerSubscription(feature: Feature, subscription: {
    status?: unknown; items?: { data?: Array<{ quantity?: unknown; price?: { unit_amount?: unknown; currency?: unknown; recurring?: { interval?: unknown; interval_count?: unknown } } }> }
}) {
    const item = subscription.items?.data?.[0]
    return subscription.status === 'active' && subscription.items?.data?.length === 1 && item?.quantity === 1
        && item.price?.unit_amount === containerPlans[feature].priceNok * 100 && item.price?.currency === 'nok'
        && item.price?.recurring?.interval === 'month' && (item.price.recurring.interval_count ?? 1) === 1
}
