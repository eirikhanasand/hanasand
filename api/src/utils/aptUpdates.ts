import { readFile } from 'node:fs/promises'
import run from '#db'

const statusPath = process.env.APT_UPDATE_STATUS_PATH || '/host/var/lib/hanasand/apt-updates/status.json'

export async function readHostUpdateStatus() {
    try {
        const parsed = JSON.parse(await readFile(statusPath, 'utf8')) as Record<string, unknown>
        const status = parsed && typeof parsed === 'object' ? parsed : {}
        return { status, runId: typeof status.run_id === 'string' ? status.run_id : null }
    } catch (error) {
        return {
            status: { status: 'unknown', last_error: `Host update status unavailable: ${error instanceof Error ? error.message : String(error)}` },
            runId: null,
        }
    }
}

export async function persistHostUpdateStatus(status: Record<string, unknown>, runId: string | null) {
    if (!runId) return
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

export async function listHostUpdateHistory() {
    const result = await run(`
        SELECT run_id, status, occurred_at, packages, error
        FROM host_update_events WHERE host = 'hanasand'
        ORDER BY occurred_at DESC LIMIT 30
    `)
    return result.rows
}
