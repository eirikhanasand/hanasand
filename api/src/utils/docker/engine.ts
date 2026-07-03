import http from 'node:http'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'

export type RuntimeContainer = {
    id: string
    name: string
    image: string
    state: string
    status: string
    created_at: string
    ports?: RuntimeContainerPort[]
    restart_count?: number
    health?: string
    uptime_seconds?: number | null
    stats?: RuntimeContainerStats | null
    stats_unavailable_reason?: string
    stats_updated_at?: string
}

export type RuntimeLogEntry = {
    id: string
    container_id: string
    service: string
    image: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    message: string
    created_at: string
    source: 'runtime'
}

export type RuntimeContainerPort = {
    ip?: string
    private_port: number
    public_port?: number
    type: string
}

export type RuntimeContainerStats = {
    cpu_percent: number | null
    memory_bytes: number | null
    memory_limit_bytes: number | null
    memory_percent: number | null
}

type DockerContainerResponse = {
    Id: string
    Names?: string[]
    Image?: string
    State?: string
    Status?: string
    Created?: number
    Ports?: {
        IP?: string
        PrivatePort?: number
        PublicPort?: number
        Type?: string
    }[]
}

type DockerInspectResponse = {
    RestartCount?: number
    State?: {
        StartedAt?: string
        Health?: {
            Status?: string
        }
    }
}

type DockerStatsResponse = {
    read?: string
    cpu_stats?: {
        online_cpus?: number
        system_cpu_usage?: number
        cpu_usage?: {
            total_usage?: number
            percpu_usage?: number[]
        }
    }
    precpu_stats?: {
        system_cpu_usage?: number
        cpu_usage?: {
            total_usage?: number
        }
    }
    memory_stats?: {
        usage?: number
        limit?: number
        stats?: {
            inactive_file?: number
            cache?: number
        }
    }
}

const DEFAULT_SOCKET_PATH = resolveDockerSocketPath()

function canUseDockerSocket() {
    return existsSync(DEFAULT_SOCKET_PATH)
}

function resolveDockerSocketPath() {
    const explicitPath = process.env.DOCKER_SOCKET_PATH
    if (explicitPath) return explicitPath

    const dockerHost = process.env.DOCKER_HOST
    if (dockerHost?.startsWith('unix://')) {
        return dockerHost.slice('unix://'.length)
    }

    const candidates = [
        '/var/run/docker.sock',
        `${homedir()}/.docker/run/docker.sock`,
    ]
    return candidates.find((candidate) => existsSync(candidate)) || candidates[0]
}

function requestDocker(path: string) {
    return new Promise<Buffer>((resolve, reject) => {
        if (!canUseDockerSocket()) {
            reject(new Error(`Docker socket is unavailable at ${DEFAULT_SOCKET_PATH}`))
            return
        }

        const req = http.request(
            {
                socketPath: DEFAULT_SOCKET_PATH,
                path,
                method: 'GET',
            },
            (res) => {
                const chunks: Buffer[] = []

                res.on('data', (chunk) => {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
                })

                res.on('end', () => {
                    const body = Buffer.concat(chunks)
                    if ((res.statusCode || 500) >= 400) {
                        reject(new Error(body.toString('utf8') || `Docker API responded with ${res.statusCode}`))
                        return
                    }

                    resolve(body)
                })
            }
        )

        req.on('error', reject)
        req.end()
    })
}

function normalizeContainerName(name?: string) {
    return (name || '').replace(/^\/+/, '')
}

function normalizePorts(ports?: DockerContainerResponse['Ports']): RuntimeContainerPort[] {
    if (!Array.isArray(ports)) return []
    return ports
        .filter((port) => typeof port.PrivatePort === 'number')
        .map((port) => ({
            ip: port.IP,
            private_port: port.PrivatePort as number,
            public_port: typeof port.PublicPort === 'number' ? port.PublicPort : undefined,
            type: port.Type || 'tcp',
        }))
}

function uptimeSeconds(startedAt?: string) {
    if (!startedAt || startedAt.startsWith('0001-01-01')) return null
    const started = new Date(startedAt).getTime()
    if (Number.isNaN(started)) return null
    return Math.max(0, Math.floor((Date.now() - started) / 1000))
}

function parseStats(stats: DockerStatsResponse): RuntimeContainerStats {
    const cpuTotal = stats.cpu_stats?.cpu_usage?.total_usage ?? 0
    const preCpuTotal = stats.precpu_stats?.cpu_usage?.total_usage ?? 0
    const systemTotal = stats.cpu_stats?.system_cpu_usage ?? 0
    const preSystemTotal = stats.precpu_stats?.system_cpu_usage ?? 0
    const cpuDelta = cpuTotal - preCpuTotal
    const systemDelta = systemTotal - preSystemTotal
    const onlineCpus = stats.cpu_stats?.online_cpus || stats.cpu_stats?.cpu_usage?.percpu_usage?.length || 1
    const cpuPercent = cpuDelta > 0 && systemDelta > 0
        ? (cpuDelta / systemDelta) * onlineCpus * 100
        : null

    const rawUsage = typeof stats.memory_stats?.usage === 'number' ? stats.memory_stats.usage : null
    const limit = typeof stats.memory_stats?.limit === 'number' ? stats.memory_stats.limit : null
    const cache = stats.memory_stats?.stats?.inactive_file ?? stats.memory_stats?.stats?.cache ?? 0
    const usage = rawUsage === null ? null : Math.max(0, rawUsage - cache)
    const memoryPercent = usage !== null && limit && limit > 0 ? (usage / limit) * 100 : null

    return {
        cpu_percent: cpuPercent,
        memory_bytes: usage,
        memory_limit_bytes: limit,
        memory_percent: memoryPercent,
    }
}

async function inspectRuntimeContainer(id: string) {
    const body = await requestDocker(`/containers/${id}/json`)
    return JSON.parse(body.toString('utf8')) as DockerInspectResponse
}

async function statsRuntimeContainer(id: string) {
    const body = await requestDocker(`/containers/${id}/stats?stream=false`)
    return parseStats(JSON.parse(body.toString('utf8')) as DockerStatsResponse)
}

function detectLevel(message: string): RuntimeLogEntry['level'] {
    const normalized = message.toLowerCase()

    if (/\b(fatal|panic|crit(ical)?)\b/.test(normalized)) return 'fatal'
    if (/\b(error|exception|failed|failure)\b/.test(normalized)) return 'error'
    if (/\b(warn|warning)\b/.test(normalized)) return 'warn'
    if (/\b(debug|trace)\b/.test(normalized)) return 'debug'
    return 'info'
}

function parseFrameBuffer(buffer: Buffer) {
    const lines: string[] = []
    let cursor = 0

    while (cursor + 8 <= buffer.length) {
        const size = buffer.readUInt32BE(cursor + 4)
        const frameStart = cursor + 8
        const frameEnd = frameStart + size

        if (frameEnd > buffer.length) break
        const payload = buffer.subarray(frameStart, frameEnd).toString('utf8')
        lines.push(...payload.split('\n'))
        cursor = frameEnd
    }

    if (!lines.length) {
        return buffer.toString('utf8').split('\n')
    }

    return lines
}

function parseLogLine(line: string, container: RuntimeContainer): RuntimeLogEntry | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>
        const structuredMessage = typeof parsed.log === 'string'
            ? parsed.log.trim()
            : typeof parsed.message === 'string'
                ? parsed.message.trim()
                : typeof parsed.msg === 'string'
                    ? parsed.msg.trim()
                    : ''
        const structuredTimestamp = typeof parsed.time === 'string'
            ? parsed.time
            : typeof parsed.timestamp === 'string'
                ? parsed.timestamp
                : null

        if (structuredMessage) {
            return {
                id: `${container.id}:${structuredTimestamp || 'json'}:${structuredMessage.slice(0, 32)}`,
                container_id: container.id,
                service: container.name,
                image: container.image,
                level: detectLevel(structuredMessage),
                message: structuredMessage,
                created_at: structuredTimestamp || new Date().toISOString(),
                source: 'runtime',
            }
        }
    } catch {
        // Non-JSON container logs fall through to text parsing.
    }

    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+(.*)$/)
    const createdAt = match?.[1] || new Date().toISOString()
    const message = (match?.[2] || trimmed).trim()

    if (!message) return null

    return {
        id: `${container.id}:${createdAt}:${message.slice(0, 32)}`,
        container_id: container.id,
        service: container.name,
        image: container.image,
        level: detectLevel(message),
        message,
        created_at: createdAt,
        source: 'runtime',
    }
}

export async function listRuntimeContainers(): Promise<RuntimeContainer[]> {
    const body = await requestDocker('/containers/json?all=true')
    const parsed = JSON.parse(body.toString('utf8')) as DockerContainerResponse[]

    return parsed.map((container) => ({
        id: container.Id,
        name: normalizeContainerName(container.Names?.[0]) || container.Id.slice(0, 12),
        image: container.Image || 'unknown',
        state: container.State || 'unknown',
        status: container.Status || 'unknown',
        created_at: new Date((container.Created || 0) * 1000).toISOString(),
        ports: normalizePorts(container.Ports),
    }))
}

export async function listRuntimeContainersWithStats(): Promise<RuntimeContainer[]> {
    const containers = await listRuntimeContainers()

    return Promise.all(containers.map(async (container) => {
        const [inspect, stats] = await Promise.allSettled([
            inspectRuntimeContainer(container.id),
            container.state === 'running'
                ? statsRuntimeContainer(container.id)
                : Promise.reject(new Error(`Container is ${container.state}; Docker stats are only available while running.`)),
        ])

        const inspected = inspect.status === 'fulfilled' ? inspect.value : null
        return {
            ...container,
            restart_count: inspected?.RestartCount,
            health: inspected?.State?.Health?.Status,
            uptime_seconds: uptimeSeconds(inspected?.State?.StartedAt),
            stats: stats.status === 'fulfilled' ? stats.value : null,
            stats_unavailable_reason: stats.status === 'rejected'
                ? stats.reason instanceof Error ? stats.reason.message : 'Docker stats are unavailable.'
                : undefined,
            stats_updated_at: stats.status === 'fulfilled' ? new Date().toISOString() : undefined,
        }
    }))
}

export async function listRuntimeLogs({
    service,
    limit = 250,
    tail = 120,
    since,
}: {
    service?: string
    limit?: number
    tail?: number
    since?: string
}) {
    const normalizedLimit = Math.min(Math.max(limit, 1), 1000)
    const normalizedTail = Math.min(Math.max(tail, 20), 400)
    const containers = await listRuntimeContainers()
    const runningContainers = containers.filter((container) => container.state === 'running')
    const filteredContainers = service
        ? runningContainers.filter((container) => container.name === service || container.id.startsWith(service))
        : runningContainers

    const sinceQuery = since
        ? `&since=${Math.floor(new Date(since).getTime() / 1000)}`
        : ''

    const settled = await Promise.allSettled(filteredContainers.map(async (container) => {
        const body = await requestDocker(
            `/containers/${container.id}/logs?stdout=1&stderr=1&timestamps=1&tail=${normalizedTail}${sinceQuery}`
        )

        return parseFrameBuffer(body)
            .map((line) => parseLogLine(line, container))
            .filter((entry): entry is RuntimeLogEntry => Boolean(entry))
    }))

    const logs = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return {
        logs: logs.slice(0, normalizedLimit),
        containers: filteredContainers,
        available: true,
    }
}

export function isRuntimeLogSourceAvailable() {
    return canUseDockerSocket()
}
