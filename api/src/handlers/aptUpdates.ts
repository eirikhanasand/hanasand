import { readFile } from 'node:fs/promises'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

const statusPath = process.env.APT_UPDATE_STATUS_PATH || '/host/var/lib/hanasand/apt-updates/status.json'

async function requireSystemAdmin(req: FastifyRequest, res: FastifyReply) {
    const access = await tokenWrapper(req, res)
    if (!access.valid) return false
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) {
        res.status(403).send({ error: 'System administrator access is required.' })
        return false
    }
    return true
}

export async function getAptUpdates(req: FastifyRequest, res: FastifyReply) {
    if (!await requireSystemAdmin(req, res)) return
    let status: Record<string, unknown>
    try {
        const parsed = JSON.parse(await readFile(statusPath, 'utf8')) as Record<string, unknown>
        status = parsed && typeof parsed === 'object' ? parsed : {}
    } catch (error) {
        status = { status: 'unknown', last_error: `Host update status unavailable: ${error instanceof Error ? error.message : String(error)}` }
    }
    const runId = typeof status.run_id === 'string' ? status.run_id : null
    if (runId) {
        await run(`
            INSERT INTO host_update_snapshots (host, run_id, status, checked_at, payload)
            VALUES ('hanasand', $1, $2, COALESCE($3::timestamptz, NOW()), $4::jsonb)
            ON CONFLICT (host) DO UPDATE SET run_id = EXCLUDED.run_id, status = EXCLUDED.status,
                checked_at = EXCLUDED.checked_at, payload = EXCLUDED.payload, updated_at = NOW()
        `, [runId, String(status.status || 'unknown'), typeof status.checked_at === 'string' ? status.checked_at : null, JSON.stringify(status)])
        await run(`
            INSERT INTO host_update_events (host, run_id, status, occurred_at, packages, error, payload)
            SELECT 'hanasand', $1, $2, COALESCE($3::timestamptz, NOW()), $4::jsonb, $5, $6::jsonb
            WHERE NOT EXISTS (SELECT 1 FROM host_update_events WHERE host = 'hanasand' AND run_id = $1)
        `, [runId, String(status.status || 'unknown'), typeof status.checked_at === 'string' ? status.checked_at : null,
            JSON.stringify(Array.isArray(status.last_updated_packages) ? status.last_updated_packages : []), typeof status.last_error === 'string' ? status.last_error : null, JSON.stringify(status)])
    }
    const history = await run(`
        SELECT run_id, status, occurred_at, packages, error
        FROM host_update_events WHERE host = 'hanasand'
        ORDER BY occurred_at DESC LIMIT 30
    `)
    return res.send({ host: 'hanasand', status, history: history.rows })
}
