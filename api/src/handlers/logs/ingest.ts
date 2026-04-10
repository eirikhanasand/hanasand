import type { FastifyReply, FastifyRequest } from 'fastify'
import hasInternalToken from '#utils/auth/internalToken.ts'
import recordLog from '#utils/logs/recordLog.ts'

export default async function ingestLog(req: FastifyRequest, res: FastifyReply) {
    if (!hasInternalToken(req)) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { service, host, level = 'error', message, metadata = {} } = req.body as {
        service?: string
        host?: string
        level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
        message?: string
        metadata?: Record<string, unknown>
    } ?? {}

    if (!service || !message) {
        return res.status(400).send({ error: 'Missing service or message.' })
    }

    await recordLog({ service, host, level, message, metadata })
    return res.status(201).send({ ok: true })
}
