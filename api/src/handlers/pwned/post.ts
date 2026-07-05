import { fetchPwnedRange, normalizeSha1Prefix } from '#utils/pwned/checkPwned.ts'
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
            .headers({ 'cache-control': 'no-store' })
            .status(200)
            .send({
                schemaVersion: 'bloom_hash.range_proxy.v1',
                prefix: normalizedPrefix,
                range,
                privacy: 'Only the first five SHA-1 characters were sent to the range service. The full hash and underlying secret were not sent to Hanasand.',
            })
    } catch (error) {
        req.log.warn({ error }, 'Unable to check Bloom hash exposure range')
        return res.status(503).send({ error: 'Unable to check the Bloom exposure dataset right now.' })
    }
}
