import http from 'node:http'
import { existsSync } from 'node:fs'

export type RuntimeContainer = {
    id: string
    name: string
    image: string
    state: string
    status: string
    created_at: string
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

type DockerContainerResponse = {
    Id: string
    Names?: string[]
    Image?: string
    State?: string
    Status?: string
    Created?: number
}

const DEFAULT_SOCKET_PATH = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'

function canUseDockerSocket() {
    return existsSync(DEFAULT_SOCKET_PATH)
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
