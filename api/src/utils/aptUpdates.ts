import { readFile } from 'node:fs/promises'
import run from '#db'

const statusPath = process.env.APT_UPDATE_STATUS_PATH || '/host/var/lib/hanasand/apt-updates/status.json'
export const updateHosts = ['inspur', 'ovhcloud'] as const
export type UpdateHost = typeof updateHosts[number]
// Preserve the existing Inspur history, recorded before hosts could be selected.
const historyHost = (host: UpdateHost) => host === 'inspur' ? 'hanasand' : host

export async function readHostUpdateStatus(host: UpdateHost = 'inspur') {
    try {
        let parsed = JSON.parse(await readFile(host === 'inspur' ? statusPath : process.env.OVH_HOST_METRICS_PATH || '/host/var/lib/hanasand/metrics/ovhcloud.json', 'utf8'))
        if (host === 'ovhcloud') {
            const age = Date.now() - Date.parse(parsed.sampledAt)
            if (!Number.isFinite(age) || age < -5000 || age > 120000) throw new Error('OVH telemetry is stale.')
            parsed = parsed.aptUpdates
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('No update status was reported.')
        const status = parsed as Record<string, unknown>
        const age = Date.now() - Date.parse(String(status.checked_at))
        if (typeof status.run_id === 'string' && (!Number.isFinite(age) || age < -5000 || age > 8 * 3600000)) throw new Error('The host update check is overdue.')
        return { status, runId: typeof status.run_id === 'string' ? status.run_id : null }
    } catch (error) {
        return {
            status: { status: 'unknown', last_error: `Host update status unavailable: ${error instanceof Error ? error.message : String(error)}` },
            runId: null,
        }
    }
}

export async function persistHostUpdateStatus(status: Record<string, unknown>, runId: string | null, host: UpdateHost = 'inspur') {
    if (!runId) return
    await run(`
        INSERT INTO host_update_snapshots (host, run_id, status, checked_at, payload)
        VALUES ($5, $1, $2, COALESCE($3::timestamptz, NOW()), $4::jsonb)
        ON CONFLICT (host) DO UPDATE SET run_id = EXCLUDED.run_id, status = EXCLUDED.status,
            checked_at = EXCLUDED.checked_at, payload = EXCLUDED.payload, updated_at = NOW()
    `, [runId, String(status.status || 'unknown'), typeof status.checked_at === 'string' ? status.checked_at : null, JSON.stringify(status), historyHost(host)])
    await run(`
        INSERT INTO host_update_events (host, run_id, status, occurred_at, packages, error, payload)
        SELECT $7, $1, $2, COALESCE($3::timestamptz, NOW()), $4::jsonb, $5, $6::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM host_update_events WHERE host = $7 AND run_id = $1)
    `, [runId, String(status.status || 'unknown'), typeof status.checked_at === 'string' ? status.checked_at : null,
        JSON.stringify(installedPackages(status)), typeof status.last_error === 'string' ? status.last_error : null, JSON.stringify(status), historyHost(host)])
}

export async function listHostUpdateHistory(host: UpdateHost = 'inspur') {
    const result = await run(`
        SELECT run_id, status, occurred_at, packages, error, payload
        FROM host_update_events WHERE host = $1
        ORDER BY occurred_at DESC LIMIT 30
    `, [historyHost(host)])
    return result.rows.map(({ payload, ...event }) => ({ ...event, packages: installedPackages(payload || {}) }))
}

function installedPackages(status: Record<string, unknown>): string[] {
    return Array.isArray(status.installed_packages) ? status.installed_packages.flatMap(item => item && typeof item.package === 'string' ? [item.package] : []) : []
}
