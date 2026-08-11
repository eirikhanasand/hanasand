import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
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
            SELECT t.id, t.user_id, t.subject, t.status, t.created_at, t.updated_at,
                   u.name AS user_name,
                   (SELECT body FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message
            FROM support_tickets t
            JOIN users u ON u.id = t.user_id
            WHERE ($1::boolean OR t.user_id = $2)
            ORDER BY t.updated_at DESC
            LIMIT 100
        `, [support, userId])
        return res.send({ role: support ? 'support' : 'user', tickets: result.rows })
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
        await run('INSERT INTO support_tickets (id, user_id, subject) VALUES ($1, $2, $3)', [ticketId, userId, subject || 'Support question'])
        await run('INSERT INTO support_messages (id, ticket_id, sender_id, body) VALUES ($1, $2, $3, $4)', [randomUUID(), ticketId, userId, message])
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
            SELECT m.id, m.sender_id, m.body, m.created_at, u.name AS sender_name
            FROM support_messages m JOIN users u ON u.id = m.sender_id
            WHERE m.ticket_id = $1 ORDER BY m.created_at ASC
        `, [req.params.id])
        return res.send({ messages: result.rows })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load support messages.' })
    }
}

export async function postSupportMessage(req: FastifyRequest<{ Params: { id: string }; Body: SupportBody & { status?: 'open' | 'closed' } }>, res: FastifyReply) {
    const userId = await auth(req, res)
    if (!userId) return
    const body = String(req.body?.message || '').trim().slice(0, 10_000)
    if (!body) return res.status(400).send({ error: 'Message is required.' })
    try {
        const support = await isSupport(userId)
        const access = await run('SELECT EXISTS (SELECT 1 FROM support_tickets WHERE id = $1 AND ($2::boolean OR user_id = $3)) AS allowed', [req.params.id, support, userId])
        if (!access.rows[0]?.allowed) return res.status(404).send({ error: 'Support ticket not found.' })
        await run('INSERT INTO support_messages (id, ticket_id, sender_id, body) VALUES ($1, $2, $3, $4)', [randomUUID(), req.params.id, userId, body])
        await run('UPDATE support_tickets SET status = $2, updated_at = NOW() WHERE id = $1', [req.params.id, req.body?.status || 'open'])
        return res.send({ ok: true })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to send support message.' })
    }
}
