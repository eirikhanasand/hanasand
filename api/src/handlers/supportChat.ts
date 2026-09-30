import { setSupportStatus, saveSupportFeedback, SupportStateError } from '#utils/support/lifecycle.ts'
import { supportIdPattern } from '#utils/support/conversation.ts'
import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction, independentSupport } from '#utils/support/db.ts'
import primaryQuery from '#db'
import { validateSupportSession } from '#utils/support/auth.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { matchApiKeyScope, validateApiKey } from '#utils/auth/apiKeys.ts'
import { hasHanasandInternalPageAccess } from '#utils/auth/organizationPageAccess.ts'

type SupportBody = { subject?: string; message?: string; requestId?: string }
const actors = new WeakMap<FastifyRequest, { id: string; support: boolean }>()

async function auth(req: FastifyRequest, res: FastifyReply) {
    let session: Awaited<ReturnType<typeof validateSupportSession>> | undefined
    const result = await tokenWrapper(req, res, async credentials => { session = await validateSupportSession(credentials); return session })
    session ||= (req as typeof req & { rateLimitSession?: Awaited<ReturnType<typeof validateSupportSession>> }).rateLimitSession
    if (!result.valid || !result.id) {
        if (!res.sent && res.statusCode < 400) res.status(401).send({ error: 'Sign in to view your support conversations.' })
        return null
    }
    if (independentSupport && session && session.user.id === result.id) actors.set(req, { id: result.id, support: await hasHanasandInternalPageAccess(result.id) })
    else if (independentSupport) {
        // API keys and impersonation remain authoritative in the main authentication database.
        const user = (await primaryQuery('SELECT name FROM users WHERE id=$1', [result.id])).rows[0]
        if (!user) { res.code(401).send({ error: 'Unauthorized.' }); return null }
        await run('INSERT INTO users(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name', [result.id, user.name])
    }
    return result.valid && result.id ? result.id : null
}

async function isSupport(userId: string, req: FastifyRequest) {
    const actor = actors.get(req)
    if (actor?.id === userId) return actor.support
    const apiKey = (req as FastifyRequest & { apiKeyAuth?: NonNullable<Awaited<ReturnType<typeof validateApiKey>>> }).apiKeyAuth
    if (apiKey?.serviceAccount && apiKey.ownerId === userId
        && matchApiKeyScope(apiKey.apiKey.scopes, 'GET', '/api/support/tickets')) return true
    return hasHanasandInternalPageAccess(userId)
}

type TicketFilters = { search: string; from: string; to: string; stars: string; feedback: string }

async function listSupportTickets(userId: string, supportQueue: boolean, filters: TicketFilters) {
    return run(`
            SELECT t.id, t.user_id, t.subject, t.status, t.created_at, t.updated_at, t.channel, t.resolution_version, t.feedback_rating, t.feedback_comment,
                   (SELECT u2.name FROM support_messages m2 JOIN users u2 ON u2.id=m2.sender_id WHERE m2.ticket_id=t.id AND m2.sender_kind='support' ORDER BY m2.created_at DESC, m2.id DESC LIMIT 1) AS agent_name,
                   (SELECT COUNT(*)::int FROM support_messages m3 WHERE m3.ticket_id=t.id AND (m3.sender_kind<>'system' OR m3.event=CASE WHEN $1::boolean THEN 'feedback' ELSE 'resolved' END OR (NOT $1::boolean AND m3.event='reopened')) AND m3.sender_id IS DISTINCT FROM $2) AS reply_count,
                   COALESCE(u.name, 'Visitor') AS user_name,
                   (SELECT body FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_message,
                   (SELECT body FROM support_messages WHERE ticket_id = t.id ORDER BY created_at ASC, id ASC LIMIT 1) AS first_message
            FROM support_tickets t
            LEFT JOIN users u ON u.id = t.user_id
            WHERE (($1::boolean AND t.channel = 'human') OR (NOT $1::boolean AND t.user_id = $2))
              AND ($3 = '' OR position(lower($3) in lower(t.subject)) > 0
                   OR position(lower($3) in lower(COALESCE(u.name, 'Visitor'))) > 0
                   OR position(lower($3) in lower(COALESCE(t.feedback_comment, ''))) > 0
                   OR EXISTS (SELECT 1 FROM support_messages m4 WHERE m4.ticket_id = t.id AND position(lower($3) in lower(m4.body)) > 0))
              AND ($4::date IS NULL OR t.created_at >= $4::date)
              AND ($5::date IS NULL OR t.created_at < $5::date + INTERVAL '1 day')
              AND ($6 = 'all' OR ($6 = 'rated' AND t.feedback_rating IS NOT NULL) OR ($6 = 'unrated' AND t.feedback_rating IS NULL) OR (CASE WHEN $6 ~ '^[1-5]$' THEN t.feedback_rating = $6::int ELSE FALSE END))
              AND ($7 = 'all' OR ($7 = 'comment' AND length(trim(COALESCE(t.feedback_comment, ''))) > 0) OR ($7 = 'none' AND length(trim(COALESCE(t.feedback_comment, ''))) = 0))
            ORDER BY t.updated_at DESC
            LIMIT 100
        `, [supportQueue, userId, filters.search, filters.from || null, filters.to || null, filters.stars, filters.feedback])
}

type SupportTicketQuery = { search?: unknown; from?: unknown; to?: unknown; stars?: unknown; feedback?: unknown }

function supportTicketFilters(query: SupportTicketQuery): TicketFilters | null {
    const search = typeof query.search === 'string' ? query.search.trim().slice(0, 160) : ''
    const from = typeof query.from === 'string' ? query.from : ''
    const to = typeof query.to === 'string' ? query.to : ''
    const stars = typeof query.stars === 'string' ? query.stars : 'all'
    const feedback = typeof query.feedback === 'string' ? query.feedback : 'all'
    const validDate = (value: string) => {
        if (!value) return true
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
        const date = new Date(`${value}T00:00:00.000Z`)
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    }
    if (!validDate(from) || !validDate(to) || from && to && from > to
        || !['all', 'rated', 'unrated', '1', '2', '3', '4', '5'].includes(stars)
        || !['all', 'comment', 'none'].includes(feedback)) return null
    return { search, from, to, stars, feedback }
}

export async function getSupportTickets(req: FastifyRequest<{ Querystring: SupportTicketQuery }>, res: FastifyReply) {
    const userId = await auth(req, res)
    if (!userId) return
    try {
        const support = await isSupport(userId, req)
        const filters = supportTicketFilters(support ? req.query : {})
        if (!filters) return res.status(400).send({ error: 'Invalid support ticket filters.' })
        const result = await listSupportTickets(userId, support, filters)
        return res.send({ isSupport: support, tickets: result.rows, realtime: true })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load support tickets.' })
    }
}

export async function getMySupportTickets(req: FastifyRequest, res: FastifyReply) {
    const userId = await auth(req, res)
    if (!userId) return
    try {
        const result = await listSupportTickets(userId, false, { search: '', from: '', to: '', stars: 'all', feedback: 'all' })
        return res.send({ isSupport: false, tickets: result.rows, realtime: true })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load your support tickets.' })
    }
}

export async function postSupportTicket(req: FastifyRequest<{ Body: SupportBody }>, res: FastifyReply) {
    const userId = await auth(req, res)
    if (!userId) return
    const subject = String(req.body?.subject || 'Support question').trim().slice(0, 160)
    const message = String(req.body?.message || '').trim().slice(0, 10_000)
    if (!message) return res.status(400).send({ error: 'Message is required.' })
    try {
        const ticketId = randomUUID()
        await withTransaction(async query => {
            await query('INSERT INTO support_tickets (id, user_id, subject) VALUES ($1, $2, $3)', [ticketId, userId, subject || 'Support question'])
            await query('INSERT INTO support_messages (id, ticket_id, sender_id, body) VALUES ($1, $2, $3, $4)', [randomUUID(), ticketId, userId, message])
        })
        return res.status(201).send({ id: ticketId })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to create support ticket.' })
    }
}

export async function getSupportMessages(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const userId = await auth(req, res)
    if (!userId) return
    try {
        const support = await isSupport(userId, req)
        const access = await run('SELECT EXISTS (SELECT 1 FROM support_tickets WHERE id = $1 AND ($2::boolean OR user_id = $3)) AS allowed', [req.params.id, support, userId])
        if (!access.rows[0]?.allowed) return res.status(404).send({ error: 'Support ticket not found.' })
        const result = await run(`
            SELECT m.id, m.sender_id, m.sender_kind, m.body, m.created_at,
                   CASE WHEN m.sender_kind = 'assistant' THEN 'Hanasand AI' WHEN m.sender_kind = 'system' THEN 'Support' ELSE COALESCE(u.name, 'Visitor') END AS sender_name
            FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id
            WHERE m.ticket_id = $1 ORDER BY m.created_at ASC, m.id
        `, [req.params.id])
        return res.send({ messages: result.rows })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load support messages.' })
    }
}

export async function postSupportMessage(req: FastifyRequest<{ Params: { id: string }; Body: SupportBody }>, res: FastifyReply) {
    const userId = await auth(req, res)
    if (!userId) return
    const body = String(req.body?.message || '').trim().slice(0, 10_000)
    if (!body) return res.status(400).send({ error: 'Message is required.' })
    const requestId = req.body?.requestId
    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))) {
        return res.status(400).send({ error: 'Invalid request ID.' })
    }
    try {
        const support = await isSupport(userId, req)
        const access = await run('SELECT EXISTS (SELECT 1 FROM support_tickets WHERE id = $1 AND ($2::boolean OR user_id = $3)) AS allowed', [req.params.id, support, userId])
        if (!access.rows[0]?.allowed) return res.status(404).send({ error: 'Support ticket not found.' })
        const messageId = randomUUID()
        const savedMessageId = await withTransaction(async query => {
            const ticket = (await query('SELECT id, status FROM support_tickets WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0]
            if (requestId) {
                const previous = (await query('SELECT id, sender_id, body FROM support_messages WHERE ticket_id=$1 AND request_id=$2 LIMIT 1', [req.params.id, requestId])).rows[0]
                if (previous) {
                    if (previous.sender_id !== userId || previous.body !== body) throw new SupportStateError('Request ID was already used for a different message.')
                    return previous.id as string
                }
            }
            if (ticket.status === 'closed') throw new SupportStateError('Chat resolved. Reopen it before sending a message.')
            const inserted = await query(`INSERT INTO support_messages (id, ticket_id, sender_id, sender_kind, body, request_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (ticket_id, request_id) WHERE request_id IS NOT NULL DO NOTHING
                RETURNING id`, [messageId, req.params.id, userId, support ? 'support' : 'user', body, requestId || null])
            let savedId = inserted.rows[0]?.id as string | undefined
            if (!savedId && requestId) {
                const previous = (await query('SELECT id, sender_id, body FROM support_messages WHERE ticket_id=$1 AND request_id=$2 LIMIT 1', [req.params.id, requestId])).rows[0]
                if (!previous || previous.sender_id !== userId || previous.body !== body) throw new SupportStateError('Request ID was already used for a different message.')
                savedId = previous.id as string
            }
            await query(`UPDATE support_tickets SET status = $2, updated_at = NOW(),
                channel = CASE WHEN $3 THEN 'human' ELSE channel END,
                ai_pending_id = CASE WHEN $3 THEN NULL ELSE ai_pending_id END,
                ai_pending_at = CASE WHEN $3 THEN NULL ELSE ai_pending_at END WHERE id = $1`, [req.params.id, 'open', support])
            return savedId || messageId
        })
        return res.send({ ok: true, messageId: savedMessageId })
    } catch (error) {
        if (error instanceof SupportStateError) return res.status(error.status).send({ error: error.message })
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to send support message.' })
    }
}

export async function postSupportStatus(req: FastifyRequest<{ Params: { id: string }; Body: { status?: unknown } }>, res: FastifyReply) {
    const userId = await auth(req, res)
    if (!userId) return
    if (!supportIdPattern.test(req.params.id) || (req.body?.status !== 'open' && req.body?.status !== 'closed')) return res.status(400).send({ error: 'Invalid chat status.' })
    try {
        if (!await isSupport(userId, req)) return res.status(403).send({ error: 'Only support agents can resolve or reopen chats.' })
        const result = await setSupportStatus(req.params.id, req.body.status as 'open' | 'closed', userId)
        return res.send({ ok: true, ...result })
    } catch (error) {
        if (error instanceof SupportStateError) return res.status(error.status).send({ error: error.message })
        req.log.error(error)
        return res.status(500).send({ error: 'Could not update this chat.' })
    }
}

export async function postSupportFeedback(req: FastifyRequest<{ Params: { id: string }; Body: { rating?: unknown; comment?: unknown; resolutionVersion?: unknown } }>, res: FastifyReply) {
    const userId = await auth(req, res)
    if (!userId) return
    if (!supportIdPattern.test(req.params.id)) return res.status(400).send({ error: 'Invalid conversation.' })
    try {
        await saveSupportFeedback(req.params.id, { user: userId }, req.body?.rating, req.body?.comment ?? '', req.body?.resolutionVersion)
        return res.send({ ok: true })
    } catch (error) {
        if (error instanceof SupportStateError) return res.status(error.status).send({ error: error.message })
        req.log.error(error)
        return res.status(500).send({ error: 'Could not save feedback.' })
    }
}
