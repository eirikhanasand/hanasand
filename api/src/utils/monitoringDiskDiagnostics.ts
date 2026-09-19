import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import run from '#db'

type Monitor = { target_url: string | null, json_rule?: unknown }
type Directory = { path: string, sizeBytes: number }
export type DiskDiagnostics = { sampledAt: string, host: string, filesystems: Array<{ path: string, usedPercent: number, complete: boolean, directories: Directory[] }> }

export function diskDiagnosticsFor(automation: Monitor, snapshot: unknown, now = Date.now()): DiskDiagnostics | null {
    const path = (automation.json_rule as { path?: string } | null)?.path || ''
    if (automation.target_url !== 'system:metrics' || !/^(host|hosts[.]ovhcloud)[.]storage[.]/.test(path)) return null
    const data = snapshot as DiskDiagnostics
    const age = now - Date.parse(data?.sampledAt)
    if (!data || !Number.isFinite(age) || age < -5000 || age > 30 * 60_000 || typeof data.host !== 'string' || !Array.isArray(data.filesystems)) return null
    const filesystems = data.filesystems.filter(fs => fs && typeof fs.path === 'string' && fs.path.startsWith('/') && Number.isFinite(fs.usedPercent) && Array.isArray(fs.directories)).map(fs => ({
        path: fs.path, usedPercent: fs.usedPercent, complete: fs.complete === true,
        directories: fs.directories.filter(row => row && typeof row.path === 'string' && row.path.startsWith('/') && Number.isFinite(row.sizeBytes) && row.sizeBytes >= 0)
            .sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 20).map(row => ({ path: row.path, sizeBytes: row.sizeBytes })),
    }))
    return filesystems.length ? { sampledAt: data.sampledAt, host: data.host, filesystems } : null
}

export async function attachDiskDiagnostics(issueId: string, automation: Monitor) {
    const path = (automation.json_rule as { path?: string } | null)?.path || ''
    if (automation.target_url !== 'system:metrics' || !/^(host|hosts[.]ovhcloud)[.]storage[.]/.test(path)) return
    const root = dirname(process.env.HOST_METRICS_FILE || '/host/var/lib/hanasand/metrics/host.json')
    let snapshot: unknown
    try {
        snapshot = JSON.parse(await readFile(join(root, path.startsWith('hosts.ovhcloud.') ? 'ovhcloud-disk-directories.json' : 'disk-directories.json'), 'utf8'))
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
    }
    const diagnostics = diskDiagnosticsFor(automation, snapshot)
    if (diagnostics) await run('UPDATE monitoring_issues SET disk_diagnostics = $2::jsonb WHERE id = $1 AND disk_diagnostics IS NULL', [issueId, JSON.stringify(diagnostics)])
}
