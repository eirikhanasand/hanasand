import { createHash } from 'node:crypto'

export const collectorRuleId = 'collector.routine_executions.v1'
export const collectorRule = {
    id: collectorRuleId, version: '1', name: 'Log collector routine executions', family: 'System', severity: 'low', enabled: false,
    explanation: 'Count and drop verified successful journalctl and ausearch executions by the host log collector. Require exact commands, root service context and a matching completion receipt with exit code zero and no stderr. Keep failures, unexpected content and unverified executions.',
    evidence: ['host', 'executable', 'arguments', 'collector service', 'process identity', 'completion receipt'],
}
export const collectorDefinition = {
    match: 'all' as const, stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep',
    conditions: [
        { path: 'host', operator: 'regex' as const, value: '^(inspur|ovhcloud)$', caseSensitive: true },
        { path: 'service', operator: 'equals' as const, value: 'audit', caseSensitive: true },
        { path: 'level', operator: 'equals' as const, value: 'info', caseSensitive: true },
        { path: 'user.id', operator: 'equals' as const, value: '0', caseSensitive: true },
        { path: 'user.login_id', operator: 'equals' as const, value: '4294967295', caseSensitive: true },
        { path: 'metadata.collector_execution.unit', operator: 'equals' as const, value: 'hanasand-log-collector.service', caseSensitive: true },
        { path: 'process.executable', operator: 'regex' as const, value: '^(/usr/bin/journalctl|/usr/sbin/ausearch)$', caseSensitive: true },
        { path: 'process.command_line', operator: 'regex' as const, caseSensitive: true,
            value: '^(ausearch --input-logs --checkpoint /var/lib/hanasand-log-collector/audit-live\\.pending -k hanasand_exec --raw|journalctl --no-pager -o json --show-cursor --lines=\\+1000 --after-cursor \'s=[0-9a-f]{32};i=[0-9a-f]{1,16};b=[0-9a-f]{32};m=[0-9a-f]{1,16};t=[0-9a-f]{1,16};x=[0-9a-f]{1,16}\')$' },
    ],
    parameters: { maxDurationMs: 60000 },
}
type Row = Record<string, unknown>
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
const exactKeys = (row: Row, keys: string[]) => Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key))
const quote = (value: string) => value === '' ? '\'\'' : /^[\w@%+=:,./-]+$/.test(value) ? value : '\'' + value.replaceAll('\'', '\'"\'"\'') + '\''
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
export function validCollectorParameters(value: unknown): value is { maxDurationMs: number } {
    const row = object(value)
    return exactKeys(row, ['maxDurationMs']) && typeof row.maxDurationMs === 'number'
        && Number.isSafeInteger(row.maxDurationMs) && row.maxDurationMs > 0 && row.maxDurationMs <= 60000
}
export type CollectorLog = { host?: string, service: string, level: string, message: string, metadata?: Row, sourceEventId?: string, timestamp?: string }
export function verifyCollectorExecutionEvidence(log: CollectorLog): boolean {
    if (Object.keys(log).some(key => !['host', 'service', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'].includes(key))
        || typeof log.host !== 'string' || !log.host || typeof log.service !== 'string' || typeof log.level !== 'string'
        || !/^[0-9a-f]{64}$/.test(log.sourceEventId || '') || !log.timestamp) return false
    const metadata = object(log.metadata), process = object(metadata.process), user = object(metadata.user), proof = object(metadata.collector_execution)
    if (!exactKeys(metadata, ['collector', 'event_type', 'action', 'outcome', 'process', 'user', 'audit_id', 'collector_execution'])
        || !exactKeys(process, ['executable', 'command_line', 'arguments', 'pid', 'parent_pid']) || !exactKeys(user, ['id', 'login_id'])
        || !exactKeys(proof, ['unit', 'boot_id', 'pid', 'parent_pid', 'started_at', 'finished_at', 'executable', 'arguments', 'exit_code', 'stderr_empty'])
        || metadata.collector !== 'auditd' || metadata.event_type !== 'process' || metadata.action !== 'exec' || metadata.outcome !== 'success'
        || !/^\d+$/.test(String(user.id)) || !/^\d+$/.test(String(user.login_id)) || !/^\d+$/.test(String(metadata.audit_id))) return false
    const args = process.arguments
    if (!Array.isArray(args) || !args.length || !args.every(item => typeof item === 'string' && !item.includes('\0'))
        || typeof process.executable !== 'string' || !process.executable.startsWith('/') || process.executable.split('/').at(-1) !== args[0]
        || process.command_line !== args.map(quote).join(' ') || log.message !== process.command_line) return false
    const started = proof.started_at, finished = proof.finished_at, time = Date.parse(log.timestamp)
    if (typeof proof.unit !== 'string' || !proof.unit || !uuid.test(String(proof.boot_id)) || proof.exit_code !== 0 || proof.stderr_empty !== true
        || !/^[1-9]\d*$/.test(String(process.pid)) || !/^[1-9]\d*$/.test(String(process.parent_pid))
        || proof.pid !== process.pid || proof.parent_pid !== process.parent_pid || proof.executable !== process.executable
        || JSON.stringify(proof.arguments) !== JSON.stringify(args)
        || typeof started !== 'number' || typeof finished !== 'number' || !Number.isSafeInteger(started) || !Number.isSafeInteger(finished)
        || !Number.isFinite(time) || time < started || time > finished || finished < started) return false
    // Bind the proof to the collector's stable audit event identity as well.
    const auditTime = (time / 1000).toFixed(3)
    return log.sourceEventId === createHash('sha256').update(`${log.host}:audit:msg=audit(${auditTime}:${metadata.audit_id})`).digest('hex')
}
export function eligibleCollectorExecution(log: CollectorLog, parameters: unknown): boolean {
    if (!validCollectorParameters(parameters) || !verifyCollectorExecutionEvidence(log)) return false
    const proof = log.metadata!.collector_execution as Row
    return Number(proof.finished_at) - Number(proof.started_at) <= parameters.maxDurationMs
}
