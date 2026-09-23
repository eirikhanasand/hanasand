import { createHash } from 'node:crypto'

export const postgresRuleId = 'postgresql.readiness_sessions.v1'
export const postgresRule = {
    id: postgresRuleId, version: '1', name: 'PostgreSQL completed local readiness sessions', family: 'Database', severity: 'low', enabled: false,
    explanation: 'Replace complete, normal-rate local pg_isready lifecycle records with one retained session containing the original evidence. Keep network connections, errors, unknown fields, incomplete sessions and slow or frequent probes.',
    evidence: ['original lifecycle records', 'container', 'backend PID', 'local socket', 'role', 'database', 'session duration'],
}
export const postgresDefinition = { match: 'all' as const, conditions: [
    ...[['host', 'inspur'], ['service', 'hanasand_database'], ['postgres_session.client', '[local]'], ['postgres_session.user', 'hanasand'],
        ['postgres_session.database', 'hanasand'], ['postgres_session.application', 'pg_isready']].map(([path, value]) => ({ path, operator: 'equals' as const, value, caseSensitive: true })),
], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: { maxDurationMs: 250, maxAgeMs: 60000, maxFutureMs: 5000, minSpacingMs: 2000, maxSessions: 15, windowMs: 60000 } }
export type PostgresParameters = typeof postgresDefinition.parameters
export function validPostgresParameters(value: unknown): value is PostgresParameters {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const params = value as PostgresParameters
    return Object.keys(params).length === 6 && Object.keys(postgresDefinition.parameters).every(key => Object.hasOwn(params, key))
        && Object.values(params).every(Number.isSafeInteger)
        && params.maxDurationMs >= 1 && params.maxDurationMs <= 60000 && params.maxAgeMs >= 1 && params.maxAgeMs <= 31536000000
        && params.maxFutureMs >= 0 && params.maxFutureMs <= 60000 && params.minSpacingMs >= 0 && params.minSpacingMs <= 60000
        && params.maxSessions >= 1 && params.maxSessions <= 64 && params.windowMs >= 1 && params.windowMs <= 3600000 && params.minSpacingMs <= params.windowMs
}
export function postgresTimingAllowed(session: PostgresSession, parameters: PostgresParameters, now = Date.now()) {
    return session.durationMs <= parameters.maxDurationMs && session.ended - session.started <= parameters.maxDurationMs
        && session.started >= now - parameters.maxAgeMs && session.ended <= now + parameters.maxFutureMs
}
export type PostgresLog = { service?: string, host?: string, level: string, message: string, metadata?: Record<string, unknown>, sourceEventId?: string, timestamp?: string }
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const prefix = /^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}) UTC \[([1-9]\d*)\] ([A-Z]+): {2}([^\r\n]+)$/
export type PostgresSession = { key: string, host: string, service: string, client: string, user: string, database: string, application: string, container: string, pid: string, started: number, ended: number, durationMs: number, logs: PostgresLog[] }

// No pending records are hidden from detection. A session crossing batch boundaries
// stays as ordinary logs. PID alone is not an identity: container and start time
// must also agree, and every record for that PID in the batch is examined.
export function completedPostgresSessions(logs: PostgresLog[]): PostgresSession[] {
    const groups = new Map<string, PostgresLog[]>()
    const blockedContainers = new Set<string>()
    for (const log of logs) {
        if (!log.host || !log.service || log.metadata?.collector !== 'docker') continue
        const container = String(log.metadata?.container_id || '')
        const match = prefix.exec(log.message)
        const source = JSON.stringify([log.host, log.service, container])
        if (!match) { blockedContainers.add(source); continue }
        const key = JSON.stringify([log.host, log.service, container, match[2]])
        const group = groups.get(key) || []
        group.push(log)
        groups.set(key, group)
    }
    const sessions: PostgresSession[] = []
    for (const logs of groups.values()) {
        const container = String(logs[0].metadata?.container_id || '')
        if (blockedContainers.has(JSON.stringify([logs[0].host, logs[0].service, container])) || logs.length !== 3 || !/^[a-f0-9]{12,64}$/.test(container)) continue
        if (logs.some(log => Object.keys(log).some(key => !['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'].includes(key))
            || log.level !== 'info' || !/^[a-f0-9]{64}$/.test(log.sourceEventId || '')
            || !log.metadata || log.metadata.collector !== 'docker' || log.metadata.stream !== 'stderr'
            || Object.keys(log.metadata).some(key => !['collector', 'container_id', 'stream'].includes(key)))) continue
        if (new Set(logs.map(log => log.sourceEventId)).size !== 3) continue
        const rows = logs.map(log => ({ log, match: prefix.exec(log.message)! })).map(row => ({ ...row,
            time: Date.parse(row.match[1].replace(' ', 'T') + 'Z') })).sort((a, b) => a.time - b.time)
        if (rows.some(row => row.match[3] !== 'LOG' || !Number.isFinite(row.time) || !row.log.timestamp
            || !Number.isFinite(Date.parse(row.log.timestamp)) || Math.abs(Date.parse(row.log.timestamp) - row.time) > 1000)) continue
        const [start, authorized, end] = rows
        const received = /^connection received: host=(\[local\]|[^\s]+(?: port=\d+)?)$/.exec(start.match[4])
        const authorizedTuple = /^connection authorized: user=([^\s=]+) database=([^\s=]+) application_name=([^\s=]+)$/.exec(authorized.match[4])
        const disconnected = /^disconnection: session time: (\d+):([0-5]\d):([0-5]\d)\.(\d{3}) user=([^\s=]+) database=([^\s=]+) host=(\[local\]|[^\s]+(?: port=\d+)?)$/.exec(end.match[4])
        if (!received || !authorizedTuple || !disconnected || received[1] !== disconnected[7]
            || authorizedTuple[1] !== disconnected[5] || authorizedTuple[2] !== disconnected[6]) continue
        const durationMs = ((Number(disconnected[1]) * 60 + Number(disconnected[2])) * 60 + Number(disconnected[3])) * 1000 + Number(disconnected[4])
        if (!Number.isSafeInteger(durationMs) || Math.abs(end.time - start.time - durationMs) > 5) continue
        const host = logs[0].host!, service = logs[0].service!
        sessions.push({ key: digest(JSON.stringify([postgresRuleId, host, service, container, start.match[2], start.time])), host, service,
            client: received[1], user: authorizedTuple[1], database: authorizedTuple[2], application: authorizedTuple[3], container,
            pid: start.match[2], started: start.time, ended: end.time, durationMs, logs: rows.map(row => row.log) })
    }
    return sessions.sort((a, b) => a.started - b.started)
}

export function postgresReceipt(log: PostgresLog) { return digest(JSON.stringify([postgresRuleId, log.sourceEventId,
    log.service, log.host, log.level, log.message, log.timestamp,
    log.metadata && Object.fromEntries(Object.entries(log.metadata).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))])) }

// A client can spoof application_name. Keeping the complete original records in
// the canonical session is therefore mandatory, even for this narrow allowlist.
export function postgresSessionEvidence(session: PostgresSession) {
    return { collector: 'postgres-session-analyzer', rule_id: postgresRuleId, container_id: session.container,
        backend_pid: session.pid, event_type: 'database', action: 'readiness_session', outcome: 'success',
        client: session.client, user: { name: session.user }, database: session.database,
        application: session.application, started_at: new Date(session.started).toISOString(), ended_at: new Date(session.ended).toISOString(),
        duration_ms: session.durationMs, lifecycle_records: session.logs }
}
