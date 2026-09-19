import type { FastifyRequest } from 'fastify'
import { createHash, timingSafeEqual } from 'node:crypto'

export function hasLogIngestToken(req: Pick<FastifyRequest, 'headers'>) {
    const secret = process.env.LOG_INGEST_TOKEN
    const header = req.headers.authorization
    if (!secret || typeof header !== 'string' || !header.startsWith('Bearer ')) return false
    let supplied = header.slice(7)
    try { supplied = decodeURIComponent(supplied) } catch { /* Compare the literal token. */ }
    return timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(secret).digest())
}
