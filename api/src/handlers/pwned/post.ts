import { fetchPwnedRange, normalizeSha1Prefix, PWNED_CONTENT_TYPE } from '#utils/pwned/checkPwned.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function postPwned(req: FastifyRequest, res: FastifyReply) {
    const { prefix } = req.body as { prefix?: unknown } ?? {}
    let normalizedPrefix: string

    try {
        normalizedPrefix = normalizeSha1Prefix(String(prefix || ''))
    } catch {
        return res.status(400).send({ error: 'A valid SHA-1 hash prefix is required. Do not send raw secrets to this endpoint.' })
    }

    try {
        const range = await fetchPwnedRange(normalizedPrefix, fetch)
        return res
            .headers({ 'cache-control': 'no-store', 'content-type': PWNED_CONTENT_TYPE, 'x-content-type-options': 'nosniff' })
            .status(200)
            .send(Buffer.from(range))
    } catch (error) {
        req.log.warn({ error }, 'Unable to check Bloom hash exposure range')
        return res.status(503).send({ error: 'Unable to check the Bloom exposure dataset right now.' })
    }
}
