import type { FastifyReply, FastifyRequest } from 'fastify'
import { consumeSharedRateLimitBucket } from '#utils/rateLimit/config.ts'
import { queryOnce } from '#db'
import { readSupportConversation, sendSupportChat, supportSessionHash } from '#utils/support/conversation.ts'

type ChatBody = { requestId?: unknown; message?: unknown; handoff?: unknown }

export async function publicSupportChat(req: FastifyRequest<{ Body: ChatBody }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const token = req.headers['x-support-session']
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).send({ error: 'Please reopen support to start a conversation.' })
    const hash = supportSessionHash(token)
    try {
        if (req.method === 'GET') return res.send(await readSupportConversation(hash))
        const { requestId, message, handoff } = req.body || {}
        if (typeof requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)
            || (handoff !== undefined && typeof handoff !== 'boolean')
            || (message !== undefined && typeof message !== 'string')
            || (typeof message === 'string' && message.length > 4000)) {
            return res.status(400).send({ error: 'Enter a message of up to 4,000 characters.' })
        }
        const body = typeof message === 'string' ? message.trim() : ''
        if (!body && !handoff) return res.status(400).send({ error: 'Enter a message.' })
        const base = process.env.AI_HEALTH_WORKER_BASE?.replace(/\/$/, '')
        const quota = await consumeSharedRateLimitBucket({ key: `support-chat:${base ? 'edge' : 'worker'}:${hash}`, rule: { windowMs: 60_000, maxRequests: 12 } }, queryOnce)
        if (!quota.allowed) return res.status(429).send({ error: 'Please wait a minute before sending another message.' })
        if (base) {
            if (req.headers['x-support-forwarded']) return res.status(503).send({ error: 'Support is temporarily unavailable.' })
            const response = await fetch(`${base}/api/support/chat`, {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-support-session': token, 'x-support-forwarded': '1' },
                body: JSON.stringify({ requestId, message: body, handoff }), signal: AbortSignal.timeout(60_000),
            })
            return res.status(response.status).send(await response.json())
        }
        const result = await sendSupportChat(hash, { requestId, message: body || 'I\'d like to speak with a human.', handoff: handoff === true })
        return res.send(result)
    } catch (error) {
        req.log.error({ err: error }, 'Support chat request failed')
        return res.status(503).send({ error: 'Support is temporarily unavailable. Please try again.' })
    }
}
