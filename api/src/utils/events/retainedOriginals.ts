import type { LogInput } from './logEvent.ts'

// Lossless consolidation must not hide the original service, message or fields
// from stateless detection. Authentication login boundaries are never grouped.
export function retainedOriginals(log: LogInput & { source_event_id?: string }): LogInput[] {
    const metadata = log.metadata || {}
    const records = log.service === 'routine-group-analyzer' && /^routine-group:[a-f0-9]{64}$/.test(log.source_event_id || '') && metadata.collector === 'routine-group-analyzer'
        ? metadata.original_records
        : log.service === 'postgres-session-analyzer' && /^postgres-session:[a-f0-9]{64}$/.test(log.source_event_id || '') && metadata.collector === 'postgres-session-analyzer'
            ? metadata.lifecycle_records : undefined
    const sourceService = ({ 'postgresql.readiness_sessions.v1': 'hanasand_database', 'system.completed_telemetry_cycles.v1': 'systemd', 'ssh.completed_session_windows.v1': 'sshd', 'ssh.transport_debug.v1': 'sshd' } as Record<string, string>)[String(metadata.rule_id)]
    if (!sourceService || !Array.isArray(records) || !records.length || records.length > 200) return []
    return records.flatMap((value, index) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return []
        const row = value as Record<string, unknown>
        if (row.service !== sourceService || row.host !== log.host || typeof row.host !== 'string' || typeof row.message !== 'string' || !['debug', 'info', 'warn', 'error', 'fatal'].includes(String(row.level)) || typeof row.sourceEventId !== 'string' || !/^[a-f0-9]{64}$/.test(row.sourceEventId)
            || typeof row.timestamp !== 'string' || !Number.isFinite(Date.parse(row.timestamp))
            || !row.metadata || typeof row.metadata !== 'object' || Array.isArray(row.metadata)) return []
        return [{ id: `${log.id}:original:${index}`, service: row.service, host: row.host, level: String(row.level), message: row.message,
            created_at: row.timestamp, metadata: row.metadata as Record<string, unknown> }]
    })
}
