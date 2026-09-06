import { readFileSync, statfsSync } from 'node:fs'
import os from 'node:os'

export default async function getStats() {
    let host: { sampledAt: string, memoryTotalBytes: number, memoryAvailableBytes: number, memoryPercent: number, [key: string]: unknown } | null
    let hostUnavailableReason: string | null = null
    try {
        host = JSON.parse(readFileSync(process.env.HOST_METRICS_FILE || '/host/var/lib/hanasand/metrics/host.json', 'utf8'))
        const age = Date.now() - Date.parse(host?.sampledAt || '')
        if (!host || ![host.memoryTotalBytes, host.memoryAvailableBytes, host.memoryPercent].every(Number.isFinite)) throw new Error('Invalid host snapshot.')
        if (!Number.isFinite(age) || age > 90_000 || age < -5_000) throw new Error('Host telemetry is stale.')
    } catch (error) {
        host = null
        hostUnavailableReason = error instanceof Error && error.message === 'Host telemetry is stale.' ? error.message : 'Host telemetry is unavailable.'
    }
    const system = runtimeSystemSnapshot()
    if (host) {
        system.memory = { total: host.memoryTotalBytes, used: host.memoryTotalBytes - host.memoryAvailableBytes, percent: host.memoryPercent.toFixed(2) }
    }
    return { status: 200, data: { system, host, hostUnavailableReason } }
}

function runtimeSystemSnapshot() {
    const total = os.totalmem()
    const free = os.freemem()
    const used = Math.max(0, total - free)
    const disk = diskUsage('/')

    return {
        load: os.loadavg(),
        memory: {
            used,
            total,
            percent: total > 0 ? ((used / total) * 100).toFixed(2) : '0.00',
        },
        swap: 'Not reported',
        disk,
        temperature: 'Not reported',
        powerUsage: 'Not reported',
        processes: 1,
        ipv4: networkAddresses('IPv4'),
        ipv6: networkAddresses('IPv6'),
        os: `${os.type()} ${os.release()} ${os.arch()}`,
    }
}

function diskUsage(path: string) {
    try {
        const stats = statfsSync(path)
        const total = Number(stats.blocks) * Number(stats.bsize)
        const available = Number(stats.bavail) * Number(stats.bsize)
        const used = Math.max(0, total - available)
        const percent = total > 0 ? Math.round((used / total) * 100) : 0
        return `${formatBytes(used)} used of ${formatBytes(total)} (${percent}%)`
    } catch {
        return 'Not reported'
    }
}

function networkAddresses(family: 'IPv4' | 'IPv6') {
    return Object.values(os.networkInterfaces())
        .flatMap((items) => items || [])
        .filter((item) => item.family === family && !item.internal)
        .map((item) => item.address)
}

function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let index = 0
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024
        index += 1
    }
    return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}
