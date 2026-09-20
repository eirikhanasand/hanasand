import { setSupportStatus, saveSupportFeedback, SupportStateError } from '#utils/support/lifecycle.ts'
import { supportIdPattern } from '#utils/support/conversation.ts'
import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

type SupportBody = { subject?: string; message?: string }

async function auth(req: FastifyRequest, res: FastifyReply) {
    const result = await tokenWrapper(req, res)
    return result.valid && result.id ? result.id : null
}

async function isSupport(userId: string) {
    const result = await run(`
        SELECT EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1 AND r.id = 'support'
        ) AS allowed
    `, [userId])
    return result.rows[0]?.allowed === true
}

export async function getSupportTickets(req: FastifyRequest, res: FastifyReply) {
    const userId = await auth(req, res)
    if (!userId) return
    try {
        const support = await isSupport(userId)
        const result = await run(`
            SELECT t.id, t.user_id, t.subject, t.status, t.created_at, t.updated_at, t.channel, t.resolution_version, t.feedback_rating, t.feedback_comment,
                   (SELECT u2.name FROM support_messages m2 JOIN users u2 ON u2.id=m2.sender_id WHERE m2.ticket_id=t.id AND m2.sender_kind='support' ORDER BY m2.created_at DESC, m2.id DESC LIMIT 1) AS agent_name,
                   (SELECT COUNT(*)::int FROM support_messages m3 WHERE m3.ticket_id=t.id AND (m3.sender_kind<>'system' OR m3.event=CASE WHEN $1::boolean THEN 'feedback' ELSE 'resolved' END OR (NOT $1::boolean AND m3.event='reopened')) AND m3.sender_id IS DISTINCT FROM $2) AS reply_count,
                   COALESCE(u.name, 'Visitor') AS user_name,
                   (SELECT body FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message
            FROM support_tickets t
            LEFT JOIN users u ON u.id = t.user_id
            WHERE (($1::boolean AND t.channel = 'human') OR (NOT $1::boolean AND t.user_id = $2))
            ORDER BY t.updated_at DESC
            LIMIT 100
        `, [support, userId])
        return res.send({ role: support ? 'support' : 'user', tickets: result.rows, realtime: true })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load support tickets.' })
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
        const support = await isSupport(userId)
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
    try {
        const support = await isSupport(userId)
        const access = await run('SELECT EXISTS (SELECT 1 FROM support_tickets WHERE id = $1 AND ($2::boolean OR user_id = $3)) AS allowed', [req.params.id, support, userId])
        if (!access.rows[0]?.allowed) return res.status(404).send({ error: 'Support ticket not found.' })
        await withTransaction(async query => {
            const ticket = (await query('SELECT id, status FROM support_tickets WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0]
            if (ticket.status === 'closed') throw new SupportStateError('Chat resolved. Reopen it before sending a message.')
            await query('INSERT INTO support_messages (id, ticket_id, sender_id, sender_kind, body) VALUES ($1, $2, $3, $4, $5)', [randomUUID(), req.params.id, userId, support ? 'support' : 'user', body])
            await query(`UPDATE support_tickets SET status = $2, updated_at = NOW(),
                channel = CASE WHEN $3 THEN 'human' ELSE channel END,
                ai_pending_id = CASE WHEN $3 THEN NULL ELSE ai_pending_id END,
                ai_pending_at = CASE WHEN $3 THEN NULL ELSE ai_pending_at END WHERE id = $1`, [req.params.id, 'open', support])
        })
        return res.send({ ok: true })
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
        if (!await isSupport(userId)) return res.status(403).send({ error: 'Only support agents can resolve or reopen chats.' })
        await setSupportStatus(req.params.id, req.body.status as 'open' | 'closed', userId)
        return res.send({ ok: true })
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
