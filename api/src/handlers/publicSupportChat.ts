import { saveSupportFeedback, SupportStateError } from '#utils/support/lifecycle.ts'
import { randomBytes } from 'node:crypto'
import { asksForHuman } from '#utils/support/assistant.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { consumeSharedRateLimitBucket } from '#utils/rateLimit/config.ts'
import { queryOnce } from '#utils/support/db.ts'
import { readSupportConversation, sendSupportChat, supportSessionHash, supportIdPattern, SupportConversationNotFound } from '#utils/support/conversation.ts'

type ChatBody = { requestId?: unknown; message?: unknown; handoff?: unknown; conversationId?: unknown; action?: unknown; rating?: unknown; comment?: unknown; resolutionVersion?: unknown }

export async function publicSupportChat(req: FastifyRequest<{ Body: ChatBody; Querystring: { conversationId?: string } }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const token = req.headers['x-support-session']
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).send({ error: 'Please reopen support to start a conversation.' })
    const hash = supportSessionHash(token)
    try {
        if (req.method === 'GET') {
            const id = req.query.conversationId
            if (id && !supportIdPattern.test(id)) return res.status(400).send({ error: 'Invalid conversation.' })
            return res.send(await readSupportConversation(hash, id))
        }
        if (req.body?.action === 'connect') {
            const quota = await consumeSharedRateLimitBucket({ key: `support-connect:${hash}`, rule: { windowMs: 60_000, maxRequests: 30 } }, queryOnce)
            if (!quota.allowed) return res.status(429).send({ error: 'Please wait before reconnecting.' })
            const ticket = randomBytes(32).toString('hex')
            await queryOnce('DELETE FROM support_live_tickets WHERE expires_at < NOW()')
            await queryOnce('INSERT INTO support_live_tickets VALUES ($1, $2, NOW() + INTERVAL \'60 seconds\')', [supportSessionHash(ticket), hash])
            return res.send({ ticket })
        }
        if (req.body?.action === 'feedback') {
            const { conversationId, rating, comment, resolutionVersion } = req.body
            if (typeof conversationId !== 'string' || !supportIdPattern.test(conversationId)) return res.status(400).send({ error: 'Invalid conversation.' })
            const quota = await consumeSharedRateLimitBucket({ key: `support-feedback:${hash}`, rule: { windowMs: 60_000, maxRequests: 20 } }, queryOnce)
            if (!quota.allowed) return res.status(429).send({ error: 'Please wait before submitting feedback again.' })
            await saveSupportFeedback(conversationId, { visitor: hash }, rating, comment ?? '', resolutionVersion)
            return res.send(await readSupportConversation(hash, conversationId))
        }
        const { requestId, message, handoff, conversationId } = req.body || {}
        if (typeof requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)
            || (conversationId !== undefined && (typeof conversationId !== 'string' || !supportIdPattern.test(conversationId)))
            || (handoff !== undefined && typeof handoff !== 'boolean')
            || (message !== undefined && typeof message !== 'string')
            || (typeof message === 'string' && message.length > 4000)) {
            return res.status(400).send({ error: 'Enter a message of up to 4,000 characters.' })
        }
        const body = typeof message === 'string' ? message.trim() : ''
        if (!body && !handoff) return res.status(400).send({ error: 'Enter a message.' })
        const base = process.env.AI_HEALTH_WORKER_BASE?.replace(/\/$/, '')
        const human = handoff === true || asksForHuman(body) || (await queryOnce('SELECT channel FROM support_tickets WHERE COALESCE(visitor_session_hash, visitor_token_hash)=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY updated_at DESC, id LIMIT 1', [hash, conversationId as string || null])).rows[0]?.channel === 'human'
        const quota = await consumeSharedRateLimitBucket({ key: `support-chat:${base ? 'edge' : 'worker'}:${hash}`, rule: { windowMs: 60_000, maxRequests: human ? 60 : 12 } }, queryOnce)
        if (!quota.allowed) return res.status(429).send({ error: 'Please wait a minute before sending another message.' })

        if (base && !human) {
            if (req.headers['x-support-forwarded']) return res.status(503).send({ error: 'Support is temporarily unavailable.' })
            const response = await fetch(`${base}/api/support/chat`, {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-support-session': token, 'x-support-forwarded': '1' },
                body: JSON.stringify({ requestId, message: body, handoff, conversationId }), signal: AbortSignal.timeout(60_000),
            })
            return res.status(response.status).send(await response.json())
        }
        const result = await sendSupportChat(hash, { requestId, message: body || 'I\'d like to speak with a human.', handoff: handoff === true, conversationId: conversationId as string | undefined })
        return res.send(result)
    } catch (error) {
        if (error instanceof SupportStateError) return res.status(error.status).send({ error: error.message })
        if (error instanceof SupportConversationNotFound) return res.status(404).send({ error: 'This chat is no longer available. Start a new chat.' })
        req.log.error({ err: error }, 'Support chat request failed')
        return res.status(503).send({ error: 'Support is temporarily unavailable. Please try again.' })
    }
}
