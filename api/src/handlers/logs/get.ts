import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

export async function getLogServices(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) return res.status(403).send({ error: 'Missing system_admin role.' })

    const result = await run(`
        SELECT service, MAX(created_at) AS last_seen, COUNT(*)::int AS entries
        FROM service_logs
        GROUP BY service
        ORDER BY service ASC
    `)
    return res.send({ services: result.rows })
}

export async function getLogs(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) return res.status(403).send({ error: 'Missing system_admin role.' })

    const query = req.query as { service?: string, level?: string, search?: string, limit?: string }
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500)
    const result = await run(`
        SELECT id, service, host, level, message, metadata, created_at
        FROM service_logs
        WHERE ($1::text IS NULL OR service = $1)
          AND ($2::text IS NULL OR level = $2)
          AND ($3::text IS NULL OR message ILIKE '%' || $3 || '%')
        ORDER BY created_at DESC
        LIMIT $4
    `, [query.service || null, query.level || null, query.search || null, limit])

    return res.send({ logs: result.rows })
}
