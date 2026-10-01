import { createHash, randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { hasHanasandInternalPageAccess } from '#utils/auth/organizationPageAccess.ts'
import { queryOnce, withTransaction } from '#utils/support/db.ts'
import { setSupportStatus, SupportStateError } from '#utils/support/lifecycle.ts'
import { supportIdPattern } from '#utils/support/conversation.ts'
import { DiscordIdentityError, getDiscordSupportIdentity } from '#utils/support/discordIdentity.ts'

const discordIdPattern = /^\d{17,20}$/
const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

type DiscordActionBody = {
    action?: unknown
    discordUserId?: unknown
    code?: unknown
    ticketId?: unknown
    subject?: unknown
    message?: unknown
    status?: unknown
    requestId?: unknown
}

function getBotOwner(req: FastifyRequest, res: FastifyReply) {
    const key = (req as FastifyRequest & { apiKeyAuth?: { ownerId?: string; serviceAccount?: boolean } }).apiKeyAuth
    if (!key?.serviceAccount || !key.ownerId) {
        res.code(403).send({ error: 'A support bot service account is required.' })
        return null
    }
    return key.ownerId
}

async function linkedUser(discordUserId: string) {
    return (await queryOnce('SELECT user_id FROM support_discord_links WHERE discord_user_id=$1', [discordUserId])).rows[0]?.user_id as string | undefined
}

export async function getDiscordSupportTickets(req: FastifyRequest<{ Querystring: { discordUserId?: string; page?: string } }>, res: FastifyReply) {
    if (!getBotOwner(req, res)) return
    const discordUserId = req.query.discordUserId || ''
    const page = Number(req.query.page || 0)
    if (!discordIdPattern.test(discordUserId) || !Number.isSafeInteger(page) || page < 0 || page > 10_000) {
        return res.code(400).send({ error: 'Invalid Discord account or history page.' })
    }
    try {
        const discordMember = await getDiscordSupportIdentity(discordUserId)
        if (!discordMember) return res.code(403).send({ error: 'Join the Hanasand server to view Discord support history.' })
        const userId = await linkedUser(discordUserId)
        const supportStaff = discordMember.isSupportMember
            || Boolean(userId && await hasHanasandInternalPageAccess(userId))
        const result = await queryOnce(`SELECT t.id, t.subject, t.status, t.channel, t.created_at, t.updated_at, t.resolved_at,
                COALESCE(t.requester_discord_id, (SELECT discord_user_id FROM support_discord_links WHERE user_id=t.user_id)) AS requester_discord_id,
                COALESCE(u.name, first_message.sender_display_name, 'Visitor') AS user_name,
                (SELECT body FROM support_messages WHERE ticket_id=t.id ORDER BY created_at ASC, id ASC LIMIT 1) AS first_message
            FROM support_tickets t
            LEFT JOIN users u ON u.id=t.user_id
            LEFT JOIN LATERAL (SELECT sender_display_name FROM support_messages
                WHERE ticket_id=t.id AND sender_kind='user' ORDER BY created_at, id LIMIT 1) first_message ON TRUE
            WHERE t.channel='human' AND ($1::boolean OR t.user_id=$2 OR t.requester_discord_id=$3)
            ORDER BY t.updated_at DESC, t.id DESC LIMIT 26 OFFSET $4`, [supportStaff, userId || null, discordUserId, page * 25])
        const tickets = result.rows.slice(0, 25)
        return res.send({ tickets, page, hasMore: result.rows.length > 25 })
    } catch (error) {
        if (error instanceof DiscordIdentityError) return res.code(503).send({ error: error.message })
        req.log.error(error)
        return res.code(500).send({ error: 'Could not load Discord support history.' })
    }
}

export async function postDiscordSupportAction(req: FastifyRequest<{ Body: DiscordActionBody }>, res: FastifyReply) {
    if (!getBotOwner(req, res)) return
    const body = req.body || {}
    const discordUserId = typeof body.discordUserId === 'string' ? body.discordUserId : ''
    if (!discordIdPattern.test(discordUserId)) return res.code(400).send({ error: 'Invalid Discord account.' })

    try {
        const discordMember = await getDiscordSupportIdentity(discordUserId)
        if (!discordMember) return res.code(403).send({ error: 'Join the Hanasand server to use Discord support.' })
        const discordName = discordMember.displayName
        if (body.action === 'link') return await linkDiscordAccount(req, res, discordUserId, discordName, body.code)
        const userId = await linkedUser(discordUserId)
        const supportStaff = discordMember.isSupportMember
            || Boolean(userId && await hasHanasandInternalPageAccess(userId))

        if (body.action === 'create') {
            const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 160) : 'Support question'
            const message = typeof body.message === 'string' ? body.message.trim().slice(0, 10_000) : ''
            if (!message) return res.code(400).send({ error: 'A first message is required.' })
            const id = randomUUID()
            await withTransaction(async query => {
                await query(`INSERT INTO support_tickets(id,user_id,requester_discord_id,subject,status,channel)
                    VALUES($1,$2,$3,$4,'open','human')`, [id, userId || null, discordUserId, subject || 'Support question'])
                await query(`INSERT INTO support_messages(id,ticket_id,sender_id,sender_kind,sender_display_name,body)
                    VALUES($1,$2,$3,'user',$4,$5)`, [randomUUID(), id, userId || null, discordName, message])
            })
            return res.code(201).send({ id })
        }

        if (body.action !== 'message' && body.action !== 'status' && body.action !== 'restore') return res.code(400).send({ error: 'Unknown Discord support action.' })
        const ticketId = typeof body.ticketId === 'string' ? body.ticketId : ''
        if (!supportIdPattern.test(ticketId)) return res.code(400).send({ error: 'Invalid support ticket.' })
        const ticket = (await queryOnce('SELECT user_id, requester_discord_id, status, channel FROM support_tickets WHERE id=$1', [ticketId])).rows[0]
        if (!ticket || ticket.channel !== 'human') return res.code(404).send({ error: 'Support ticket not found.' })
        const ownsTicket = Boolean(userId && ticket.user_id === userId) || ticket.requester_discord_id === discordUserId
        if (!ownsTicket && !supportStaff) return res.code(403).send({ error: 'You do not have access to this support ticket.' })

        if (body.action === 'restore') {
            const details = (await queryOnce(`SELECT t.id, t.subject, t.status, t.channel, t.created_at, t.updated_at, t.resolved_at,
                    COALESCE(t.requester_discord_id, (SELECT discord_user_id FROM support_discord_links WHERE user_id=t.user_id)) AS requester_discord_id,
                    COALESCE(u.name, first_message.sender_display_name, 'Visitor') AS user_name,
                    (SELECT body FROM support_messages WHERE ticket_id=t.id ORDER BY created_at ASC,id ASC LIMIT 1) AS first_message
                FROM support_tickets t LEFT JOIN users u ON u.id=t.user_id
                LEFT JOIN LATERAL (SELECT sender_display_name FROM support_messages
                    WHERE ticket_id=t.id AND sender_kind='user' ORDER BY created_at, id LIMIT 1) first_message ON TRUE
                WHERE t.id=$1`, [ticketId])).rows[0]
            return res.send({ ticket: details, isOwner: ownsTicket })
        }

        if (body.action === 'status') {
            if (!supportStaff) return res.code(403).send({ error: 'Only members of Hanasand Support can resolve or reopen a ticket.' })
            if (body.status !== 'open' && body.status !== 'closed') return res.code(400).send({ error: 'Invalid ticket status.' })
            const result = await setSupportStatus(ticketId, body.status, userId || null, discordName)
            return res.send({ ok: true, ...result })
        }

        const message = typeof body.message === 'string' ? body.message.trim().slice(0, 10_000) : ''
        const requestId = body.requestId
        if (!message) return res.code(400).send({ error: 'A message is required.' })
        if (requestId !== undefined && (typeof requestId !== 'string' || !requestIdPattern.test(requestId))) return res.code(400).send({ error: 'Invalid message request ID.' })
        const savedMessageId = await withTransaction(async query => {
            const current = (await query('SELECT status FROM support_tickets WHERE id=$1 FOR UPDATE', [ticketId])).rows[0]
            if (!current) throw new SupportStateError('Support ticket not found.', 404)
            if (requestId) {
                const previous = (await query('SELECT id, sender_id, body FROM support_messages WHERE ticket_id=$1 AND request_id=$2', [ticketId, requestId])).rows[0]
                if (previous) {
                    if (previous.sender_id !== userId || previous.body !== message) throw new SupportStateError('Request ID was already used for a different message.')
                    return previous.id as string
                }
            }
            if (current.status === 'closed') throw new SupportStateError('This ticket is resolved. A support agent must reopen it before you can reply.')
            const senderKind = supportStaff ? 'support' : 'user'
            const inserted = await query(`INSERT INTO support_messages(id,ticket_id,sender_id,sender_kind,sender_display_name,body,request_id)
                VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(ticket_id,request_id) WHERE request_id IS NOT NULL DO NOTHING RETURNING id`,
            [randomUUID(), ticketId, userId || null, senderKind, discordName, message, requestId || null])
            const id = inserted.rows[0]?.id as string | undefined
            if (!id && requestId) {
                const previous = (await query('SELECT id, sender_id, body FROM support_messages WHERE ticket_id=$1 AND request_id=$2', [ticketId, requestId])).rows[0]
                if (!previous || previous.sender_id !== userId || previous.body !== message) throw new SupportStateError('Request ID was already used for a different message.')
                return previous.id as string
            }
            await query("UPDATE support_tickets SET updated_at=NOW(), channel=CASE WHEN $2 THEN 'human' ELSE channel END WHERE id=$1", [ticketId, supportStaff])
            return id || ''
        })
        return res.send({ ok: true, messageId: savedMessageId })
    } catch (error) {
        if (error instanceof DiscordIdentityError) return res.code(503).send({ error: error.message })
        if (error instanceof SupportStateError) return res.code(error.status).send({ error: error.message })
        req.log.error(error)
        return res.code(500).send({ error: 'Could not complete the Discord support action.' })
    }
}

async function linkDiscordAccount(req: FastifyRequest, res: FastifyReply, discordUserId: string, discordName: string, rawCode: unknown) {
    if (typeof rawCode !== 'string' || !/^[A-F0-9]{16}$/.test(rawCode)) return res.code(400).send({ error: 'Enter the 16-character code from your Hanasand support page.' })
    const codeHash = createHash('sha256').update(rawCode).digest('hex')
    const linked = await withTransaction(async query => {
        const code = (await query('SELECT user_id FROM support_discord_link_codes WHERE code_hash=$1 AND expires_at>NOW() FOR UPDATE', [codeHash])).rows[0]
        if (!code) return 'invalid'
        const conflict = (await query(`SELECT discord_user_id, user_id FROM support_discord_links
            WHERE discord_user_id=$1 OR user_id=$2`, [discordUserId, code.user_id])).rows[0]
        if (conflict && (conflict.discord_user_id !== discordUserId || conflict.user_id !== code.user_id)) return 'conflict'
        await query(`INSERT INTO support_discord_links(discord_user_id,user_id,display_name) VALUES($1,$2,$3)
            ON CONFLICT(discord_user_id) DO UPDATE SET display_name=EXCLUDED.display_name`, [discordUserId, code.user_id, discordName])
        await query('UPDATE support_tickets SET user_id=$2 WHERE requester_discord_id=$1 AND user_id IS NULL', [discordUserId, code.user_id])
        await query('DELETE FROM support_discord_link_codes WHERE code_hash=$1 OR user_id=$2', [codeHash, code.user_id])
        return 'linked'
    })
    if (linked === 'invalid') return res.code(400).send({ error: 'That code is invalid or expired. Generate a new one on Hanasand.' })
    if (linked === 'conflict') return res.code(409).send({ error: 'This Hanasand or Discord account is already linked to another account.' })
    return res.send({ ok: true })
}
