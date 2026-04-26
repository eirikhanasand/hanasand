import { existsSync, promises as fs } from 'node:fs'
import { promisify } from 'node:util'
import { execFile as execFileCallback } from 'node:child_process'
import config from '#constants'

const execFile = promisify(execFileCallback)

export type NativeLogEntry = {
    id: string
    service: string
    host: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    message: string
    metadata: Record<string, unknown>
    created_at: string
    source: 'native'
}

const NATIVE_LOG_FILES = [
    { service: 'auth', path: '/var/log/auth.log' },
    { service: 'auth', path: '/var/log/auth.log.1' },
    { service: 'auth', path: '/var/log/secure' },
    { service: 'system', path: '/var/log/system.log' },
    { service: 'system', path: '/var/log/syslog' },
    { service: 'system', path: '/var/log/messages' },
    { service: 'kernel', path: '/var/log/kern.log' },
    { service: 'firewall', path: '/var/log/ufw.log' },
] as const

export function isNativeLogSourceAvailable() {
    return NATIVE_LOG_FILES.some((file) => existsSync(file.path))
        || existsSync('/bin/journalctl')
        || existsSync('/usr/bin/journalctl')
        || existsSync('/run/log/journal')
        || existsSync('/var/log/journal')
        || Boolean(config.internal_api && config.vm_api_token)
}

function detectLevel(message: string, priority?: string | number | null): NativeLogEntry['level'] {
    const numericPriority = typeof priority === 'number'
        ? priority
        : typeof priority === 'string' && /^\d+$/.test(priority)
            ? Number(priority)
            : null

    if (numericPriority !== null) {
        if (numericPriority <= 2) return 'fatal'
        if (numericPriority <= 3) return 'error'
        if (numericPriority === 4) return 'warn'
        if (numericPriority >= 7) return 'debug'
    }

    const normalized = message.toLowerCase()
    if (/\b(fatal|panic|crit(ical)?)\b/.test(normalized)) return 'fatal'
    if (/\b(error|exception|failed|failure|denied|invalid user|authentication failure)\b/.test(normalized)) return 'error'
    if (/\b(warn|warning)\b/.test(normalized)) return 'warn'
    if (/\b(debug|trace)\b/.test(normalized)) return 'debug'
    return 'info'
}

function normalizeService(value?: string | null, fallback = 'system') {
    const normalized = (value || '').trim().replace(/\.service$/i, '').toLowerCase()
    if (!normalized) return fallback
    if (normalized === 'sshd' || normalized === 'ssh') return 'ssh'
    if (normalized === 'sudo') return 'sudo'
    return normalized
}

function normalizeTimestamp(value?: string | null) {
    const parsed = value ? new Date(value) : new Date()
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function toNativeEntry({
    service,
    host,
    message,
    createdAt,
    metadata,
    priority,
}: {
    service: string
    host?: string | null
    message: string
    createdAt?: string | null
    metadata?: Record<string, unknown>
    priority?: string | number | null
}) {
    const cleanedMessage = message.trim()
    if (!cleanedMessage) {
        return null
    }

    const created_at = normalizeTimestamp(createdAt)

    return {
        id: `${service}:${created_at}:${cleanedMessage.slice(0, 80)}`,
        service,
        host: host || 'localhost',
        level: detectLevel(cleanedMessage, priority),
        message: cleanedMessage,
        metadata: metadata || {},
        created_at,
        source: 'native' as const,
    }
}

async function readTail(path: string, maxBytes = 256 * 1024) {
    const handle = await fs.open(path, 'r')

    try {
        const stat = await handle.stat()
        const start = Math.max(0, stat.size - maxBytes)
        const length = stat.size - start
        const buffer = Buffer.alloc(length)
        await handle.read(buffer, 0, length, start)
        return buffer.toString('utf8')
    } finally {
        await handle.close()
    }
}

async function listFileLogs(limit: number) {
    const entries: NativeLogEntry[] = []

    for (const file of NATIVE_LOG_FILES) {
        if (!existsSync(file.path)) {
            continue
        }

        try {
            const content = await readTail(file.path)
            const lines = content.split('\n').filter(Boolean).slice(-limit)

            for (const line of lines) {
                const match = line.match(/^([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:]+):\s*(.*)$/)
                if (!match) continue

                const [, timestamp, host, identifier, message] = match
                const createdAt = new Date(`${new Date().getFullYear()} ${timestamp}`).toISOString()
                const service = normalizeService(identifier.split('[')[0], file.service)
                const entry = toNativeEntry({
                    service,
                    host,
                    message,
                    createdAt,
                    metadata: {
                        native_source: 'file',
                        file_path: file.path,
                        identifier,
                    },
                })

                if (entry) {
                    entries.push(entry)
                }
            }
        } catch {
            // Best-effort native log collection should not fail the request.
        }
    }

    return entries
}

async function listJournalLogs(limit: number) {
    try {
        const { stdout } = await execFile('journalctl', ['-n', String(limit), '--no-pager', '-o', 'json'])
        const entries: NativeLogEntry[] = []

        for (const line of stdout.split('\n').filter(Boolean)) {
            try {
                const parsed = JSON.parse(line) as Record<string, unknown>
                const message = String(parsed.MESSAGE || '').trim()
                if (!message) continue

                const service = normalizeService(
                    String(parsed._SYSTEMD_UNIT || parsed.SYSLOG_IDENTIFIER || parsed.COMM || ''),
                    'systemd'
                )

                const entry = toNativeEntry({
                    service,
                    host: String(parsed._HOSTNAME || 'localhost'),
                    message,
                    createdAt: typeof parsed.__REALTIME_TIMESTAMP === 'string'
                        ? new Date(Number(parsed.__REALTIME_TIMESTAMP) / 1000).toISOString()
                        : typeof parsed._SOURCE_REALTIME_TIMESTAMP === 'string'
                            ? new Date(Number(parsed._SOURCE_REALTIME_TIMESTAMP) / 1000).toISOString()
                            : null,
                    priority: parsed.PRIORITY as string | number | null,
                    metadata: {
                        native_source: 'journalctl',
                        unit: parsed._SYSTEMD_UNIT,
                        identifier: parsed.SYSLOG_IDENTIFIER,
                        pid: parsed._PID,
                    },
                })

                if (entry) {
                    entries.push(entry)
                }
            } catch {
                // Skip malformed journal rows.
            }
        }

        return entries
    } catch {
        return []
    }
}

async function fetchRemoteNativeLogs({
    service,
    level,
    search,
    limit,
}: {
    service?: string | null
    level?: string | null
    search?: string | null
    limit: number
}) {
    if (!config.internal_api || !config.vm_api_token) {
        return [] as NativeLogEntry[]
    }

    const params = new URLSearchParams({ limit: String(limit) })
    if (service) params.set('service', service)
    if (level) params.set('level', level)
    if (search) params.set('search', search)

    try {
        const response = await fetch(`${config.internal_api}/logs?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                'Content-Type': 'application/json',
                'User-Agent': 'hanasand_api',
            },
        })

        if (!response.ok) {
            return []
        }

        const payload = await response.json() as { logs?: NativeLogEntry[] }
        return Array.isArray(payload.logs)
            ? payload.logs.map((entry) => ({
                ...entry,
                metadata: {
                    ...(entry.metadata || {}),
                    native_source: 'internal_api',
                },
                source: 'native' as const,
            }))
            : []
    } catch {
        return []
    }
}

async function fetchRemoteNativeLogServices(limit: number) {
    if (!config.internal_api || !config.vm_api_token) {
        return [] as Array<{ service: string, last_seen: string, entries: number }>
    }

    try {
        const response = await fetch(`${config.internal_api}/logs/services?limit=${limit}`, {
            headers: {
                Authorization: `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                'Content-Type': 'application/json',
                'User-Agent': 'hanasand_api',
            },
        })

        if (!response.ok) {
            return []
        }

        const payload = await response.json() as { services?: Array<{ service: string, last_seen: string, entries: number }> }
        return Array.isArray(payload.services) ? payload.services : []
    } catch {
        return []
    }
}

function dedupeLogs(logs: NativeLogEntry[]) {
    return [...new Map(logs.map((log) => [log.id, log])).values()]
}

async function listLocalNativeLogs({
    service,
    level,
    search,
    limit = 200,
}: {
    service?: string | null
    level?: string | null
    search?: string | null
    limit?: number
}) {
    const normalizedLimit = Math.min(Math.max(limit, 1), 500)
    const [journalLogs, fileLogs] = await Promise.all([
        listJournalLogs(normalizedLimit),
        listFileLogs(normalizedLimit),
    ])

    const needle = (search || '').trim().toLowerCase()
    const logs = dedupeLogs([...journalLogs, ...fileLogs])
        .filter((entry) => !service || entry.service === service)
        .filter((entry) => !level || entry.level === level)
        .filter((entry) => !needle
            || entry.message.toLowerCase().includes(needle)
            || entry.service.toLowerCase().includes(needle)
            || String(entry.metadata.identifier || '').toLowerCase().includes(needle))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return logs.slice(0, normalizedLimit)
}

export async function listNativeLogs({
    service,
    level,
    search,
    limit = 200,
}: {
    service?: string | null
    level?: string | null
    search?: string | null
    limit?: number
}) {
    const normalizedLimit = Math.min(Math.max(limit, 1), 500)
    const [localLogs, remoteLogs] = await Promise.all([
        listLocalNativeLogs({ service, level, search, limit: normalizedLimit }),
        fetchRemoteNativeLogs({ service, level, search, limit: normalizedLimit }),
    ])

    return dedupeLogs([...localLogs, ...remoteLogs])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, normalizedLimit)
}

export async function listNativeLogServices(limit = 200) {
    const [logs, remoteServices] = await Promise.all([
        listLocalNativeLogs({ limit }),
        fetchRemoteNativeLogServices(limit),
    ])
    const grouped = new Map<string, { service: string, last_seen: string, entries: number }>()

    for (const service of [
        ...logs.map((log) => ({
            service: log.service,
            last_seen: log.created_at,
            entries: 1,
        })),
        ...remoteServices,
    ]) {
        const existing = grouped.get(service.service)
        if (!existing) {
            grouped.set(service.service, { ...service })
            continue
        }

        existing.entries += Number(service.entries || 0)
        if (new Date(service.last_seen).getTime() > new Date(existing.last_seen).getTime()) {
            existing.last_seen = service.last_seen
        }
    }

    return [...grouped.values()].sort((a, b) => a.service.localeCompare(b.service))
}
