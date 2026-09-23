import { createHash } from 'node:crypto'

export const postgresRuleId = 'postgresql.readiness_sessions.v1'
export const postgresRule = {
    id: postgresRuleId, version: '1', name: 'PostgreSQL completed local readiness sessions', family: 'Database', severity: 'low', enabled: false,
    explanation: 'Replace complete, normal-rate local pg_isready lifecycle records with one retained session containing the original evidence. Keep network connections, errors, unknown fields, incomplete sessions and slow or frequent probes.',
    evidence: ['original lifecycle records', 'container', 'backend PID', 'local socket', 'role', 'database', 'session duration'],
}
export const postgresDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }
export type PostgresLog = { service?: string, host?: string, level: string, message: string, metadata?: Record<string, unknown>, sourceEventId?: string, timestamp?: string }
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const prefix = /^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}) UTC \[([1-9]\d*)\] ([A-Z]+): {2}([^\r\n]+)$/
export type PostgresSession = { key: string, container: string, pid: string, started: number, ended: number, durationMs: number, logs: PostgresLog[] }

// No pending records are hidden from detection. A session crossing batch boundaries
// stays as ordinary logs. PID alone is not an identity: container and start time
// must also agree, and every record for that PID in the batch is examined.
export function completedPostgresSessions(logs: PostgresLog[], now = Date.now()): PostgresSession[] {
    const groups = new Map<string, PostgresLog[]>()
    const blockedContainers = new Set<string>()
    for (const log of logs) {
        if (log.service !== 'hanasand_database' || log.host !== 'inspur') continue
        const container = String(log.metadata?.container_id || '')
        const match = prefix.exec(log.message)
        if (!match) { blockedContainers.add(container); continue }
        const key = `${container}:${match[2]}`
        const group = groups.get(key) || []
        group.push(log)
        groups.set(key, group)
    }
    const sessions: PostgresSession[] = []
    for (const logs of groups.values()) {
        const container = String(logs[0].metadata?.container_id || '')
        if (blockedContainers.has(container) || logs.length !== 3 || !/^[a-f0-9]{12,64}$/.test(container)) continue
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
        // The inspected production healthcheck uses this exact local-socket tuple.
        // Do not generalize to application_name alone or to network/SCRAM sessions.
        if (start.match[4] !== 'connection received: host=[local]'
            || authorized.match[4] !== 'connection authorized: user=hanasand database=hanasand application_name=pg_isready') continue
        const disconnected = /^disconnection: session time: 0:00:00\.(\d{3}) user=hanasand database=hanasand host=\[local\]$/.exec(end.match[4])
        if (!disconnected) continue
        const durationMs = Number(disconnected[1])
        if (durationMs > 250 || end.time - start.time > 250 || Math.abs(end.time - start.time - durationMs) > 5
            || start.time < now - 60_000 || end.time > now + 5000) continue
        sessions.push({ key: digest(`${postgresRuleId}:${container}:${start.match[2]}:${start.time}`), container,
            pid: start.match[2], started: start.time, ended: end.time, durationMs, logs: rows.map(row => row.log) })
    }
    return sessions.sort((a, b) => a.started - b.started)
}

export function postgresReceipt(log: PostgresLog) { return digest(JSON.stringify([postgresRuleId, log.sourceEventId,
    log.service, log.host, log.level, log.message, log.timestamp, log.metadata])) }

// A client can spoof application_name. Keeping the complete original records in
// the canonical session is therefore mandatory, even for this narrow allowlist.
export function postgresSessionEvidence(session: PostgresSession) {
    return { collector: 'postgres-session-analyzer', rule_id: postgresRuleId, container_id: session.container,
        backend_pid: session.pid, event_type: 'database', action: 'readiness_session', outcome: 'success',
        client: '[local]', user: { name: 'hanasand' }, database: 'hanasand',
        application: 'pg_isready', started_at: new Date(session.started).toISOString(), ended_at: new Date(session.ended).toISOString(),
        duration_ms: session.durationMs, lifecycle_records: session.logs }
}
