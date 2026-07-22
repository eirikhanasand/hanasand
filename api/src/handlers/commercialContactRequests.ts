import { createHash, randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { sendSystemMail } from '#utils/mail/system.ts'

type ContactBody = {
    name?: unknown
    email?: unknown
    company?: unknown
    subject?: unknown
    message?: unknown
    intent?: unknown
    plan?: unknown
    deliveryPreference?: unknown
    replyWindow?: unknown
    securityReview?: unknown
    source?: unknown
}

type ContactInput = {
    name: string
    email: string
    company: string | null
    subject: string
    message: string
    intent: string | null
    plan: string | null
    deliveryPreference: string | null
    replyWindow: string | null
    securityReview: boolean
    source: string
}

type PersistedContact = {
    ticketId: string
    receivedAt: string | Date
    payloadHash: string
    notificationStatus: string
    inserted: boolean
}

type ContactDependencies = {
    persist: (input: ContactInput, idempotencyKey: string, payloadHash: string, requestId: string) => Promise<PersistedContact>
    notify: (input: ContactInput, ticketId: string) => Promise<void>
    markNotification: (ticketId: string, status: 'notified' | 'failed', error?: string) => Promise<void>
}

const defaultDependencies: ContactDependencies = {
    persist: persistContactRequest,
    notify: notifyCommercialOwner,
    markNotification: markContactNotification,
}

export async function postCommercialContactRequest(req: FastifyRequest<{ Body: ContactBody }>, res: FastifyReply) {
    return handleCommercialContactRequest(req, res, defaultDependencies)
}

export async function handleCommercialContactRequest(
    req: FastifyRequest<{ Body: ContactBody }>,
    res: FastifyReply,
    dependencies: ContactDependencies,
) {
    res.header('Cache-Control', 'no-store, max-age=0')
    res.header('X-Request-Id', req.id)

    const normalized = normalizeCommercialContactRequest(req.body)
    if (!normalized.ok) return res.status(400).send({ error: normalized.error, code: 'invalid_contact_request', requestId: req.id })

    const idempotencyKey = header(req, 'idempotency-key')
    if (idempotencyKey.length < 16 || idempotencyKey.length > 200) {
        return res.status(400).send({ error: 'Idempotency-Key must contain 16-200 characters.', code: 'invalid_idempotency_key', requestId: req.id })
    }

    const payloadHash = createHash('sha256').update(JSON.stringify(normalized.input)).digest('hex')
    let persisted: PersistedContact
    try {
        persisted = await dependencies.persist(normalized.input, idempotencyKey, payloadHash, req.id)
    } catch (error) {
        req.log.error({ error }, 'Failed to persist commercial contact request')
        return res.status(503).send({ error: 'Contact intake is temporarily unavailable.', code: 'contact_store_unavailable', requestId: req.id })
    }

    if (persisted.payloadHash !== payloadHash) {
        return res.status(409).send({ error: 'Idempotency-Key was already used for a different request.', code: 'idempotency_conflict', requestId: req.id })
    }

    let notificationStatus = persisted.notificationStatus
    if (persisted.inserted) {
        try {
            await dependencies.notify(normalized.input, persisted.ticketId)
            notificationStatus = 'notified'
            await dependencies.markNotification(persisted.ticketId, 'notified')
        } catch (error) {
            notificationStatus = 'failed'
            await dependencies.markNotification(persisted.ticketId, 'failed', safeError(error)).catch(() => undefined)
            req.log.warn({ ticketId: persisted.ticketId, error }, 'Commercial contact request was stored but notification failed')
        }
    }

    return res.status(persisted.inserted ? 202 : 200).send({
        accepted: true,
        ticketId: persisted.ticketId,
        receivedAt: new Date(persisted.receivedAt).toISOString(),
        delivery: notificationStatus === 'notified' ? 'notified' : 'stored',
        replayed: !persisted.inserted,
        requestId: req.id,
        nextStep: normalized.input.securityReview
            ? 'We received the request. Expect a reply by email with coverage fit, setup steps, and security review material.'
            : 'We received the request. Expect a reply by email with coverage fit, setup steps, or support follow-up.',
    })
}

export async function getCommercialContactRequests(req: FastifyRequest<{ Querystring: { limit?: string } }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store, max-age=0')
    const access = await tokenWrapper(req, res)
    if (!access.valid) return res.status(401).send({ error: access.error || 'Unauthorized.' })
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) return res.status(403).send({ error: role.error || 'Missing system_admin role.' })

    const limit = Number(req.query?.limit || 50)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).send({ error: 'limit must be an integer from 1 to 100.' })
    const result = await run(`
        SELECT ticket_id, name, email, company, subject, message, intent, plan,
               delivery_preference, reply_window, security_review, source, status,
               notification_status, created_at, updated_at
        FROM commercial_contact_requests
        ORDER BY created_at DESC
        LIMIT $1
    `, [limit])
    return res.send({ requests: result.rows })
}

export function normalizeCommercialContactRequest(body: ContactBody | undefined): { ok: true, input: ContactInput } | { ok: false, error: string } {
    const limits = { name: 200, email: 320, company: 300, subject: 300, message: 8_000, intent: 100, plan: 100, deliveryPreference: 60, replyWindow: 60, source: 1_000 } as const
    const oversized = Object.entries(limits).find(([field, max]) => {
        const value = body?.[field as keyof ContactBody]
        return typeof value === 'string' && value.trim().length > max
    })
    if (oversized) return { ok: false, error: `${oversized[0]} exceeds the ${oversized[1]} character limit.` }

    const name = text(body?.name, 200)
    const email = text(body?.email, 320).toLowerCase()
    const company = text(body?.company, 300)
    const subject = text(body?.subject, 300)
    const message = text(body?.message, 8_000)
    const intent = text(body?.intent, 100)
    const plan = text(body?.plan, 100)
    const deliveryPreference = text(body?.deliveryPreference, 60)
    const replyWindow = text(body?.replyWindow, 60)
    const securityReview = body?.securityReview === true || body?.securityReview === 'true' || body?.securityReview === 'on'

    if (!name || !email || !subject || !message) return { ok: false, error: 'Name, email, subject, and message are required.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Use a valid email address.' }
    if (message.length < 20) return { ok: false, error: 'Message must be at least 20 characters.' }
    if (securityReview && !company) return { ok: false, error: 'Company is required for security review requests.' }

    return {
        ok: true,
        input: {
            name,
            email,
            company: company || null,
            subject,
            message,
            intent: intent || null,
            plan: plan || null,
            deliveryPreference: deliveryPreference || null,
            replyWindow: replyWindow || null,
            securityReview,
            source: safeSource(text(body?.source, 1_000)),
        },
    }
}

async function persistContactRequest(input: ContactInput, idempotencyKey: string, payloadHash: string, requestId: string) {
    const ticketId = `HS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`
    const inserted = await run(`
        INSERT INTO commercial_contact_requests (
            ticket_id, idempotency_key, payload_hash, name, email, company, subject,
            message, intent, plan, delivery_preference, reply_window, security_review,
            source, request_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING ticket_id, created_at, payload_hash, notification_status
    `, [
        ticketId, idempotencyKey, payloadHash, input.name, input.email, input.company,
        input.subject, input.message, input.intent, input.plan, input.deliveryPreference,
        input.replyWindow, input.securityReview, input.source, requestId,
    ])
    const row = inserted.rows[0] || (await run(`
        SELECT ticket_id, created_at, payload_hash, notification_status
        FROM commercial_contact_requests
        WHERE idempotency_key = $1
    `, [idempotencyKey])).rows[0]
    if (!row) throw new Error('Contact request could not be stored.')
    return {
        ticketId: row.ticket_id,
        receivedAt: row.created_at,
        payloadHash: row.payload_hash,
        notificationStatus: row.notification_status,
        inserted: Boolean(inserted.rows[0]),
    }
}

async function notifyCommercialOwner(input: ContactInput, ticketId: string) {
    await sendSystemMail({
        to: process.env.COMMERCIAL_CONTACT_RECIPIENT || 'contact@hanasand.com',
        subject: `[${ticketId}] ${input.subject}`,
        textBody: [
            `Ticket: ${ticketId}`,
            `Name: ${input.name}`,
            `Email: ${input.email}`,
            `Company: ${input.company || 'not provided'}`,
            `Intent: ${input.intent || 'not provided'}`,
            `Plan: ${input.plan || 'not provided'}`,
            `Preferred delivery: ${input.deliveryPreference || 'not provided'}`,
            `Reply window: ${input.replyWindow || 'not provided'}`,
            `Security review: ${input.securityReview ? 'yes' : 'no'}`,
            '',
            input.message,
        ].join('\n'),
    })
}

async function markContactNotification(ticketId: string, status: 'notified' | 'failed', error = '') {
    await run(`
        UPDATE commercial_contact_requests
        SET notification_status = $2,
            notification_error = NULLIF($3, ''),
            notified_at = CASE WHEN $2 = 'notified' THEN NOW() ELSE notified_at END,
            updated_at = NOW()
        WHERE ticket_id = $1
    `, [ticketId, status, error])
}

function text(value: unknown, max: number) {
    return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function safeSource(value: string) {
    if (!value) return '/contact'
    if (value.startsWith('/')) return value
    try {
        const url = new URL(value)
        return ['https:', 'http:'].includes(url.protocol) ? url.toString() : '/contact'
    } catch {
        return '/contact'
    }
}

function header(req: FastifyRequest, name: string) {
    const value = req.headers[name]
    return Array.isArray(value) ? value[0] || '' : typeof value === 'string' ? value.trim() : ''
}

function safeError(error: unknown) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 500)
}
