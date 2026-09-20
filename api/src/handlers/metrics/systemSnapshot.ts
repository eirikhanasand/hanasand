import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

export default async function systemSnapshot(this: FastifyInstance, req: FastifyRequest, res: FastifyReply) {
    const started = performance.now()
    res.header('Cache-Control', 'private, no-store')
    if (!(await tokenWrapper(req, res)).valid) return res.status(401).send({ error: 'Unauthorized.' })
    if (!(await hasRole(req, res, 'system_admin')).valid) return res.status(403).send({ error: 'Host telemetry requires system administrator access.' })
    if (!this.systemSnapshot) return res.status(503).send({ error: 'System telemetry is unavailable. Please retry.' })
    const age = Date.now() - Date.parse(JSON.parse(this.systemSnapshot.toString()).generated_at)
    if (!Number.isFinite(age) || age > 30000) return res.status(503).send({ error: 'System telemetry is stale. Please retry.' })
    res.header('Server-Timing', `system_snapshot;dur=${(performance.now() - started).toFixed(2)}`)
    return res.type('application/json').send(this.systemSnapshot)
}
