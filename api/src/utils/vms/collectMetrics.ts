import config from '#constants'
import run from '#db'

export const VM_METRICS_JOB_ID = 'api-vm-metrics'
type Network = { host_name?: string, counters?: { bytes_received?: number, bytes_sent?: number } }
export type Instance = {
    name: string, status: string, last_used_at?: string,
    expanded_config?: Record<string, string>, expanded_devices?: Record<string, Record<string, string>>,
    state?: { cpu?: { usage?: number }, memory?: { usage?: number, total?: number }, network?: Record<string, Network>, disk?: Record<string, { usage?: number, total?: number }> }
}
type Counter = { at: number, cpu: number | null, received: number | null, sent: number | null, boot?: string }
const previous = new Map<string, Counter>()
let active: Promise<unknown> | undefined
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
const mb = (value: number | null) => value === null ? null : Math.round(value / 1_048_576)

export function cpuCount(value?: string): number | null {
    if (!value) return null
    if (/^\d+$/.test(value)) return Number(value) || null
    const cpus = new Set<number>()
    for (const part of value.split(',')) {
        const match = /^(\d+)(?:-(\d+))?$/.exec(part)
        if (!match) return null
        const start = Number(match[1]), end = Number(match[2] ?? match[1])
        if (end < start || end - start > 4096) return null
        for (let cpu = start; cpu <= end; cpu++) cpus.add(cpu)
    }
    return cpus.size || null
}

export function memoryBytes(value?: string): number | null {
    const match = /^(\d+(?:\.\d+)?)\s*([KMGT]?)(i?B)?$/i.exec(value ?? '')
    if (!match) return null
    const exponent = 'KMGT'.indexOf(match[2].toUpperCase()) + 1
    return Number(match[1]) * (match[3]?.toLowerCase() === 'ib' ? 1024 : 1000) ** exponent
}

export function filesystemMetrics(text: string) {
    const result = new Map<string, { size?: number, free?: number }>()
    for (const line of text.split('\n')) {
        const match = /^lxd_filesystem_(size|free)_bytes\{(.*)\}\s+(\S+)$/.exec(line)
        if (!match) continue
        const labels: Record<string, string> = {}
        for (const label of match[2].matchAll(/(\w+)=("(?:[^"\\]|\\.)*")/g)) labels[label[1]] = JSON.parse(label[2])
        if (labels.project !== 'default' || labels.mountpoint !== '/' || !labels.name) continue
        const value = finite(Number(match[3]))
        if (value !== null) result.set(labels.name, { ...result.get(labels.name), [match[1]]: value })
    }
    return result
}

export function metricSample(instance: Instance, at: number, history: Map<string, Counter>, filesystem?: { size?: number, free?: number }) {
    const running = instance.status === 'Running'
    const state = instance.state
    const cores = cpuCount(instance.expanded_config?.['limits.cpu'])
    // Only host-backed NICs: guest bridges and veth interfaces double-count traffic.
    const networks = Object.values(state?.network ?? {}).filter(nic => Boolean(nic.host_name))
    const sum = (key: 'bytes_received' | 'bytes_sent') => networks.length && networks.every(n => finite(n.counters?.[key]) !== null)
        ? networks.reduce((total, n) => total + n.counters![key]!, 0) : null
    const current: Counter = { at, cpu: finite(state?.cpu?.usage), received: sum('bytes_received'), sent: sum('bytes_sent'), boot: instance.last_used_at }
    const before = history.get(instance.name)
    history.set(instance.name, current)
    const seconds = before ? (at - before.at) / 1000 : 0
    const delta = (key: 'cpu' | 'received' | 'sent', scale: number) => {
        if (!running) return instance.status === 'Stopped' ? 0 : null
        if (!before || seconds <= 0 || seconds > 180 || before.boot !== current.boot || current[key] === null || before[key] === null || current[key]! < before[key]!) return null
        return (current[key]! - before[key]!) / seconds * scale
    }
    const cpu = cores ? delta('cpu', 100 / 1e9 / cores) : null
    const boot = Date.parse(instance.last_used_at ?? '')
    const diskSize = finite(filesystem?.size)
    const diskFree = finite(filesystem?.free)
    return {
        name: instance.name,
        cpu_usage_percent: cpu === null ? null : Math.min(100, Math.round(cpu * 100) / 100), cpu_cores: cores,
        ram_used_mb: instance.status === 'Stopped' ? 0 : mb(finite(state?.memory?.usage)), ram_total_mb: mb(finite(state?.memory?.total) || memoryBytes(instance.expanded_config?.['limits.memory'])),
        disk_used_mb: diskSize !== null && diskFree !== null && diskFree <= diskSize ? mb(diskSize - diskFree) : null,
        disk_total_mb: mb(diskSize ?? finite(state?.disk?.root?.total)),
        net_in_kbps: delta('received', 8 / 1000) === null ? null : Math.round(delta('received', 8 / 1000)!),
        net_out_kbps: delta('sent', 8 / 1000) === null ? null : Math.round(delta('sent', 8 / 1000)!),
        power_state: running ? 'on' : instance.status === 'Stopped' ? 'off' : 'suspended',
        powered_on_at: running && Number.isFinite(boot) && boot > 0 ? instance.last_used_at : null,
        uptime_seconds: running && Number.isFinite(boot) && boot > 0 && boot <= at ? Math.floor((at - boot) / 1000) : instance.status === 'Stopped' ? 0 : null,
        created_at: new Date(at).toISOString(),
    }
}

async function lxd(path: string) {
    const response = await fetch(`http://localhost${path}`, { unix: config.lxd_socket_path, signal: AbortSignal.timeout(10_000) } as RequestInit & { unix: string })
    if (!response.ok) throw new Error(`VM metrics: host returned ${response.status}.`)
    return response
}

async function collect() {
    const response = await (await lxd('/1.0/instances?recursion=2')).json() as { metadata?: Instance[] }
    if (!Array.isArray(response.metadata)) throw new Error('VM metrics: host did not return its instances.')
    const registered = new Set<string>((await run('SELECT name FROM vms')).rows.map(row => row.name))
    const instances = response.metadata.filter(instance => registered.has(instance.name))
    const missing = [...registered].filter(name => !instances.some(instance => instance.name === name))
    let filesystem = new Map<string, { size?: number, free?: number }>()
    let filesystemError: unknown
    try { filesystem = filesystemMetrics(await (await lxd('/1.0/metrics')).text()) } catch (error) { filesystemError = error }
    const samples = instances.map(instance => metricSample(instance, Date.now(), previous, filesystem.get(instance.name)))
    for (const name of previous.keys()) if (!instances.some(instance => instance.name === name)) previous.delete(name)
    if (samples.length) await run(`
        INSERT INTO vm_metrics (name, cpu_usage_percent, cpu_cores, ram_used_mb, ram_total_mb, disk_used_mb, disk_total_mb, net_in_kbps, net_out_kbps, power_state, powered_on_at, uptime_seconds, created_at)
        SELECT m.name, m.cpu_usage_percent, m.cpu_cores, m.ram_used_mb, m.ram_total_mb, m.disk_used_mb, m.disk_total_mb, m.net_in_kbps, m.net_out_kbps, m.power_state, m.powered_on_at, m.uptime_seconds, m.created_at
        FROM jsonb_to_recordset($1::jsonb) AS m(name text, cpu_usage_percent numeric, cpu_cores int, ram_used_mb int, ram_total_mb int, disk_used_mb int, disk_total_mb int, net_in_kbps int, net_out_kbps int, power_state text, powered_on_at timestamptz, uptime_seconds bigint, created_at timestamptz)
        JOIN vms v ON v.name = m.name
    `, [JSON.stringify(samples)])
    if (missing.length) throw new Error(`VM metrics: ${missing.length} registered instances are missing from the host.`)
    if (filesystemError) throw filesystemError
    return { sampled: samples.length }
}

export default function collectVmMetrics() {
    if (active) return active
    active = collect().finally(() => { active = undefined })
    return active
}
