import { createHash, randomUUID } from 'node:crypto'
import { queryOnce, withTransaction } from '#db'
import { answerSupport, asksForHuman, handoffMarker, handoffMessage } from './assistant.ts'

type Input = { requestId: string; message: string; handoff: boolean }

export function supportSessionHash(token: string) {
    return createHash('sha256').update(token).digest('hex')
}

export async function readSupportConversation(hash: string) {
    const result = await queryOnce(`SELECT id, channel, status, ai_pending_id IS NOT NULL AND ai_pending_at > NOW() - INTERVAL '90 seconds' AS pending
        FROM support_tickets WHERE visitor_token_hash = $1`, [hash])
    const ticket = result.rows[0]
    if (!ticket) return { channel: 'ai', status: 'open', pending: false, messages: [] }
    const messages = await queryOnce(`SELECT m.id, m.body, m.sender_kind, m.request_id, m.created_at,
        CASE WHEN m.sender_kind = 'assistant' THEN 'Hanasand AI'
             WHEN m.sender_kind = 'support' THEN COALESCE(u.name, 'Support team')
             WHEN m.sender_kind = 'system' THEN 'Support' ELSE 'You' END AS sender_name
        FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.ticket_id = $1 ORDER BY m.created_at, m.id`, [ticket.id])
    return { channel: ticket.channel, status: ticket.status, pending: ticket.pending, messages: messages.rows }
}

async function transfer(query: typeof queryOnce, ticketId: string) {
    const changed = await query(`UPDATE support_tickets SET channel = 'human', status = 'open', ai_pending_id = NULL, ai_pending_at = NULL, updated_at = NOW()
        WHERE id = $1 AND channel <> 'human' RETURNING id`, [ticketId])
    if (changed.rowCount) await query(`INSERT INTO support_messages (id, ticket_id, sender_kind, body, created_at)
        VALUES ($1, $2, 'system', $3, clock_timestamp())`, [randomUUID(), ticketId, handoffMessage])
}

export async function sendSupportChat(hash: string, input: Input, answer = answerSupport) {
    const pending = await withTransaction(async query => {
        // Also serializes creation: two tabs must not create two conversations for one visitor.
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`support:${hash}`])
        await query(`INSERT INTO support_tickets (id, subject, channel, visitor_token_hash)
            VALUES ($1, $2, 'ai', $3) ON CONFLICT (visitor_token_hash) WHERE visitor_token_hash IS NOT NULL DO NOTHING`,
        [randomUUID(), input.message.slice(0, 160) || 'Support question', hash])
        const ticket = (await query('SELECT *, ai_pending_at > NOW() - INTERVAL \'90 seconds\' AS pending_fresh FROM support_tickets WHERE visitor_token_hash = $1 FOR UPDATE', [hash])).rows[0]
        const human = input.handoff || asksForHuman(input.message)
        const existing = (await query('SELECT id, body FROM support_messages WHERE ticket_id = $1 AND request_id = $2', [ticket.id, input.requestId])).rows[0]
        if (existing && existing.body !== input.message) throw new Error('Request already used for another message.')
        if (!existing && !human && ticket.channel === 'ai' && ticket.ai_pending_id && ticket.pending_fresh) {
            return { busy: true }
        }
        const messageId = existing?.id || randomUUID()
        if (!existing) {
            await query(`INSERT INTO support_messages (id, ticket_id, sender_kind, body, request_id, created_at)
                VALUES ($1, $2, 'user', $3, $4, clock_timestamp())`, [messageId, ticket.id, input.message, input.requestId])
            await query('UPDATE support_tickets SET updated_at = NOW(), status = \'open\' WHERE id = $1', [ticket.id])
        }
        if (human) await transfer(query, ticket.id)
        if (human || ticket.channel === 'human') return {}
        const replied = await query('SELECT id FROM support_messages WHERE reply_to = $1', [messageId])
        if (replied.rowCount || (ticket.ai_pending_id && ticket.pending_fresh)) return {}
        await query('UPDATE support_tickets SET ai_pending_id = $2, ai_pending_at = NOW() WHERE id = $1', [ticket.id, messageId])
        const history = await query('SELECT sender_kind, body FROM (SELECT sender_kind, body, created_at, id FROM support_messages WHERE ticket_id = $1 ORDER BY created_at DESC, id DESC LIMIT 20) recent ORDER BY created_at, id', [ticket.id])
        return { ticketId: ticket.id as string, messageId: messageId as string, history: history.rows }
    })
    if (pending.busy) return { ...await readSupportConversation(hash), error: 'Wait for the current answer, or talk to a human.', accepted: false }
    let error: string | undefined
    if (pending.ticketId && pending.messageId && pending.history) {
        try {
            const content = await answer(pending.history)
            await withTransaction(async query => {
                const ticket = (await query('SELECT channel, ai_pending_id FROM support_tickets WHERE id = $1 FOR UPDATE', [pending.ticketId!])).rows[0]
                // A human handoff wins over a late model response.
                if (ticket?.channel !== 'ai' || ticket.ai_pending_id !== pending.messageId) return
                if (content.trim() === handoffMarker) await transfer(query, pending.ticketId!)
                else {
                    await query(`INSERT INTO support_messages (id, ticket_id, sender_kind, body, reply_to, created_at)
                        VALUES ($1, $2, 'assistant', $3, $4, clock_timestamp()) ON CONFLICT (reply_to) WHERE reply_to IS NOT NULL DO NOTHING`,
                    [randomUUID(), pending.ticketId!, content, pending.messageId!])
                    await query('UPDATE support_tickets SET ai_pending_id = NULL, ai_pending_at = NULL, updated_at = NOW() WHERE id = $1', [pending.ticketId!])
                }
            })
        } catch {
            await queryOnce('UPDATE support_tickets SET ai_pending_id = NULL, ai_pending_at = NULL WHERE id = $1 AND ai_pending_id = $2', [pending.ticketId, pending.messageId])
            error = 'Hanasand AI could not answer right now. Retry your message or talk to a human.'
        }
    }
    const conversation = await readSupportConversation(hash)
    return { ...conversation, accepted: true, ...(error && conversation.channel === 'ai' ? { error } : {}) }
}
