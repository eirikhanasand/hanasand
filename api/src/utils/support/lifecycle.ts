import { randomUUID } from 'node:crypto'
import { withTransaction } from '#db'

export class SupportStateError extends Error {
    constructor(message: string, public status = 409) { super(message) }
}

export async function setSupportStatus(id: string, status: 'open' | 'closed', agentId: string) {
    return withTransaction(async query => {
        const ticket = (await query('SELECT id, status, resolution_version, feedback_rating, feedback_comment, updated_at FROM support_tickets WHERE id=$1 FOR UPDATE', [id])).rows[0]
        if (!ticket) throw new SupportStateError('Support chat not found.', 404)
        if (ticket.status === status) return { ticket }
        const changed = (await query(`UPDATE support_tickets SET status=$2, updated_at=NOW(), ai_pending_id=NULL, ai_pending_at=NULL,
            resolution_version=resolution_version+CASE WHEN $2='closed' THEN 1 ELSE 0 END,
            feedback_rating=CASE WHEN $2='closed' THEN NULL ELSE feedback_rating END,
            feedback_comment=CASE WHEN $2='closed' THEN NULL ELSE feedback_comment END
            WHERE id=$1 RETURNING id, status, resolution_version, feedback_rating, feedback_comment, updated_at`, [id, status])).rows[0]
        const message = (await query(`INSERT INTO support_messages(id,ticket_id,sender_id,sender_kind,event,body)
            VALUES($1,$2,$3,'system',$4,$5) RETURNING id, sender_id, sender_kind, body, created_at`, [randomUUID(), id, agentId, status === 'closed' ? 'resolved' : 'reopened',
            status === 'closed' ? 'Chat resolved. How was your experience? Please rate your support from 1 to 5 stars.' : 'Support reopened this chat. You can send messages again.'])).rows[0]
        return { ticket: changed, message: { ...message, sender_name: 'Support' } }
    })
}

export async function saveSupportFeedback(id: string, owner: { visitor?: string; user?: string }, rating: unknown, comment: unknown, version: unknown) {
    if (!Number.isInteger(rating) || Number(rating) < 1 || Number(rating) > 5 || typeof comment !== 'string' || comment.length > 2000 || !Number.isInteger(version) || Number(version) < 0) {
        throw new SupportStateError('Choose 1–5 stars and keep feedback under 2,000 characters.', 400)
    }
    const text = Number(rating) <= 3 ? comment.trim() : ''
    return withTransaction(async query => {
        const ticket = (await query(`SELECT * FROM support_tickets WHERE id=$1 AND
            (($2::text IS NOT NULL AND COALESCE(visitor_session_hash,visitor_token_hash)=$2) OR ($3::text IS NOT NULL AND user_id=$3)) FOR UPDATE`, [id, owner.visitor || null, owner.user || null])).rows[0]
        if (!ticket) throw new SupportStateError('Support chat not found.', 404)
        if (ticket.status !== 'closed' || ticket.resolution_version !== version) throw new SupportStateError('This chat has changed. Refresh it before leaving feedback.')
        if (ticket.feedback_rating !== null) {
            if (ticket.feedback_rating === rating && (ticket.feedback_comment || '') === text) return
            throw new SupportStateError('Feedback has already been submitted for this resolution.')
        }
        await query('UPDATE support_tickets SET feedback_rating=$2,feedback_comment=$3,updated_at=NOW() WHERE id=$1', [id, Number(rating), text])
        await query(`INSERT INTO support_messages(id,ticket_id,sender_id,sender_kind,event,body)
            VALUES($1,$2,$3,'system','feedback',$4)`, [randomUUID(), id, owner.user || null, `Customer feedback: ${rating}/5 stars.${text ? `\n${text}` : ''}`])
    })
}
