import type { FastifyRequest } from 'fastify'
import { createHash, timingSafeEqual } from 'node:crypto'

export function hasLogIngestToken(req: Pick<FastifyRequest, 'headers'>) {
    const secrets = [process.env.LOG_INGEST_TOKEN, process.env.LOG_INGEST_TOKEN_PREVIOUS].filter((secret): secret is string => Boolean(secret))
    const header = req.headers.authorization
    if (!secrets.length || typeof header !== 'string' || !header.startsWith('Bearer ')) return false
    let supplied = header.slice(7)
    try { supplied = decodeURIComponent(supplied) } catch { /* Compare the literal token. */ }
    const suppliedHash = createHash('sha256').update(supplied).digest()
    let matched = false
    for (const secret of secrets) {
        matched = timingSafeEqual(suppliedHash, createHash('sha256').update(secret).digest()) || matched
    }
    return matched
}
