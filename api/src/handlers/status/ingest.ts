import type { FastifyReply, FastifyRequest } from 'fastify'
import hasInternalToken from '#utils/auth/internalToken.ts'
import run from '#db'

export default async function ingestStatus(req: FastifyRequest, res: FastifyReply) {
    if (!hasInternalToken(req)) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { service, check_name, status, latency_ms = 0, message = '' } = req.body as {
        service?: string
        check_name?: string
        status?: 'up' | 'degraded' | 'down'
        latency_ms?: number
        message?: string
    } ?? {}

    if (!service || !check_name || !status) {
        return res.status(400).send({ error: 'Missing service, check_name or status.' })
    }

    await run(`
        INSERT INTO service_monitor_results (service, check_name, status, latency_ms, message)
        VALUES ($1, $2, $3, $4, $5)
    `, [service, check_name, status, latency_ms, message])

    return res.status(201).send({ ok: true })
}
