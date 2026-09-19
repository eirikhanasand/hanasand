import { readFile } from 'node:fs/promises'
import run from '#db'
import { recoveryReadOnly } from './resilience.ts'

const statusPath = process.env.APT_UPDATE_STATUS_PATH || '/host/var/lib/hanasand/apt-updates/status.json'
export const updateHosts = ['inspur', 'ovhcloud'] as const
export type UpdateHost = typeof updateHosts[number]
// Preserve the existing Inspur history, recorded before hosts could be selected.
const historyHost = (host: UpdateHost) => host === 'inspur' ? 'hanasand' : host
const replica = () => ['ovh', 'ovhcloud'].includes(process.env.RESILIENCE_SITE || '')

export async function readHostUpdateStatus(host: UpdateHost = 'inspur') {
    try {
        // Standby workers have no primary-host mounts and must not write to the replica.
        let parsed = replica()
            ? (await run('SELECT payload FROM host_update_snapshots WHERE host = $1', [historyHost(host)])).rows[0]?.payload
            : JSON.parse(await readFile(host === 'inspur' ? statusPath : process.env.OVH_HOST_METRICS_PATH || '/host/var/lib/hanasand/metrics/ovhcloud.json', 'utf8'))
        if (!replica() && host === 'ovhcloud') {
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
    if (!runId || replica() || recoveryReadOnly()) return
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
        SELECT ((occurred_at AT TIME ZONE 'Europe/Oslo')::date)::text AS day,
               jsonb_agg(jsonb_build_object('status', status, 'error', error,
                   'installed', COALESCE(payload->'installed_packages', '[]'::jsonb))
                   ORDER BY occurred_at DESC, run_id DESC) AS checks
        FROM host_update_events
        WHERE host = $1
          AND occurred_at < (date_trunc('day', NOW() AT TIME ZONE 'Europe/Oslo') AT TIME ZONE 'Europe/Oslo')
        GROUP BY day ORDER BY day DESC LIMIT 30
    `, [historyHost(host)])
    return result.rows.map(({ day, checks }: { day: string, checks: Array<{ status: string, error: string | null, installed: Array<{ package: string, version?: string }> }> }) => {
        const packages = [...new Set(checks.flatMap(check => installedPackages({ installed_packages: check.installed }, true)))].sort()
        const errors = [...new Set(checks.flatMap(check => check.error ? [check.error] : []))]
        return { run_id: day, occurred_at: day, status: errors.length || checks.some(check => check.status === 'failed') ? 'failed' : checks[0].status,
            packages, error: errors.join('; ') || null }
    })
}

function installedPackages(status: Record<string, unknown>, withVersions = false): string[] {
    return Array.isArray(status.installed_packages) ? status.installed_packages.flatMap(item => item && typeof item.package === 'string' ? [withVersions && typeof item.version === 'string' && item.version ? `${item.package} v${item.version}` : item.package] : []) : []
}
