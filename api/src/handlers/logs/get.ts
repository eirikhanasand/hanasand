import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { isRuntimeLogSourceAvailable, listRuntimeLogs } from '#utils/docker/engine.ts'
import { listNativeLogs, listNativeLogServices } from '#utils/logs/native.ts'

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
    const nativeServices = await listNativeLogServices().catch(() => [])
    const combined = new Map<string, { service: string, last_seen: string, entries: number }>()

    for (const service of [...result.rows, ...nativeServices]) {
        const existing = combined.get(service.service)
        if (!existing) {
            combined.set(service.service, { ...service })
            continue
        }

        existing.entries += Number(service.entries || 0)
        if (new Date(service.last_seen).getTime() > new Date(existing.last_seen).getTime()) {
            existing.last_seen = service.last_seen
        }
    }

    return res.send({ services: [...combined.values()].sort((a, b) => a.service.localeCompare(b.service)) })
}

export async function getLogs(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) return res.status(403).send({ error: 'Missing system_admin role.' })

    const query = req.query as { service?: string, level?: string, search?: string, limit?: string }
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500)
    const [result, nativeLogs] = await Promise.all([
        run(`
        SELECT id, service, host, level, message, metadata, created_at
        FROM service_logs
        WHERE ($1::text IS NULL OR service = $1)
          AND ($2::text IS NULL OR level = $2)
          AND ($3::text IS NULL OR message ILIKE '%' || $3 || '%')
        ORDER BY created_at DESC
        LIMIT $4
    `, [query.service || null, query.level || null, query.search || null, limit]),
        listNativeLogs({
            service: query.service || null,
            level: query.level || null,
            search: query.search || null,
            limit,
        }).catch(() => []),
    ])

    const logs = [...result.rows.map((row) => ({ ...row, source: 'stored' as const })), ...nativeLogs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)

    return res.send({ logs })
}

export async function getRealtimeLogs(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) return res.status(403).send({ error: 'Missing system_admin role.' })

    const query = req.query as { service?: string, limit?: string, since?: string }
    const limit = Math.min(Math.max(Number(query.limit || 300), 1), 1000)

    try {
        const [runtime, nativeLogs] = await Promise.all([
            listRuntimeLogs({
                service: query.service,
                since: query.since,
                limit,
            }),
            listNativeLogs({
                service: query.service || null,
                limit: Math.min(limit, 250),
            }).catch(() => []),
        ])

        return res.send({
            logs: [...runtime.logs, ...nativeLogs]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, limit),
            containers: runtime.containers,
            runtime_available: runtime.available,
            native_available: nativeLogs.length > 0,
            source: 'docker_engine',
            generated_at: new Date().toISOString(),
        })
    } catch (error: any) {
        const nativeLogs = await listNativeLogs({
            service: query.service || null,
            limit: Math.min(limit, 250),
        }).catch(() => [])

        return res.send({
            logs: nativeLogs,
            containers: [],
            runtime_available: false,
            native_available: nativeLogs.length > 0,
            source: 'docker_engine',
            unavailable_reason: error?.message || 'Failed to load runtime logs.',
            docker_socket_available: isRuntimeLogSourceAvailable(),
            generated_at: new Date().toISOString(),
        })
    }
}
