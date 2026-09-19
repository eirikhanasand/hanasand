import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHash, timingSafeEqual } from 'node:crypto'
import hasInternalToken from '#utils/auth/internalToken.ts'
import recordLog from '#utils/logs/recordLog.ts'

export function hasLogIngestToken(req: Pick<FastifyRequest, 'headers'>) {
    const secret = process.env.LOG_INGEST_TOKEN
    const header = req.headers.authorization
    if (!secret || typeof header !== 'string' || !header.startsWith('Bearer ')) return false
    let supplied = header.slice(7)
    try { supplied = decodeURIComponent(supplied) } catch { /* Compare the literal token. */ }
    return timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(secret).digest())
}

export default async function ingestLog(req: FastifyRequest, res: FastifyReply) {
    if (!hasLogIngestToken(req) && !hasInternalToken(req)) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const body = req.body as Record<string, unknown> | undefined
    const entries = Array.isArray(body?.events) ? body.events : [body]
    if (!entries.length || entries.length > 200) return res.status(400).send({ error: 'Send 1–200 events.' })
    for (const entry of entries) {
        if (!entry || typeof entry !== 'object' || typeof entry.service !== 'string' || typeof entry.message !== 'string'
            || !entry.service || entry.service.length > 256 || !entry.message || entry.message.length > 65536
            || (entry.host !== undefined && (typeof entry.host !== 'string' || entry.host.length > 256))
            || (entry.metadata !== undefined && (!entry.metadata || typeof entry.metadata !== 'object' || Array.isArray(entry.metadata)))
            || (entry.level && !['debug', 'info', 'warn', 'error', 'fatal'].includes(entry.level))
            || (entry.timestamp && (typeof entry.timestamp !== 'string' || !Number.isFinite(Date.parse(entry.timestamp))))
            || (entry.sourceEventId && (typeof entry.sourceEventId !== 'string' || entry.sourceEventId.length > 256))) {
            return res.status(400).send({ error: 'Invalid log event.' })
        }
    }
    for (const entry of entries) await recordLog({ ...entry, level: entry.level || 'info' })
    return res.status(201).send({ ok: true, accepted: entries.length })
}
