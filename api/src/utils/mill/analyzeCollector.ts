import { createHash } from 'node:crypto'

export const collectorRuleId = 'collector.routine_executions.v1'
export const collectorRule = {
    id: collectorRuleId, version: '1', name: 'Log collector routine executions', family: 'System', severity: 'low', enabled: false,
    explanation: 'Count and drop verified successful journalctl and ausearch executions by the host log collector. Require exact commands, root service context and a matching completion receipt with exit code zero and no stderr. Keep failures, unexpected content and unverified executions.',
    evidence: ['host', 'executable', 'arguments', 'collector service', 'process identity', 'completion receipt'],
}
export const collectorDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }
type Row = Record<string, unknown>
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
const exactKeys = (row: Row, keys: string[]) => Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key))
const quote = (value: string) => value === '' ? '\'\'' : /^[\w@%+=:,./-]+$/.test(value) ? value : '\'' + value.replaceAll('\'', '\'"\'"\'') + '\''
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
export function routineCollectorArguments(args: string[]) {
    if (args[0] === 'journalctl') return args.length === 8
        && JSON.stringify(args.slice(0, 6)) === JSON.stringify(['journalctl', '--no-pager', '-o', 'json', '--show-cursor', '--lines=+1000'])
        && args[6] === '--after-cursor' && /^s=[0-9a-f]{32};i=[0-9a-f]{1,16};b=[0-9a-f]{32};m=[0-9a-f]{1,16};t=[0-9a-f]{1,16};x=[0-9a-f]{1,16}$/.test(args[7])
    // Only the checkpointed live pass is routine. Recovery/backfill commands
    // carrying --start/--end remain visible even when successfully completed.
    return JSON.stringify(args) === JSON.stringify(['ausearch', '--input-logs', '--checkpoint', '/var/lib/hanasand-log-collector/audit-live.pending', '-k', 'hanasand_exec', '--raw'])
}
export type CollectorLog = { host?: string, service: string, level: string, message: string, metadata?: Row, sourceEventId?: string, timestamp?: string }
export function eligibleCollectorExecution(log: CollectorLog): boolean {
    if (!['inspur', 'ovhcloud'].includes(log.host || '') || log.service !== 'audit' || log.level !== 'info'
        || !/^[0-9a-f]{64}$/.test(log.sourceEventId || '') || !log.timestamp) return false
    const metadata = object(log.metadata), process = object(metadata.process), user = object(metadata.user), proof = object(metadata.collector_execution)
    if (!exactKeys(metadata, ['collector', 'event_type', 'action', 'outcome', 'process', 'user', 'audit_id', 'collector_execution'])
        || !exactKeys(process, ['executable', 'command_line', 'arguments', 'pid', 'parent_pid']) || !exactKeys(user, ['id', 'login_id'])
        || !exactKeys(proof, ['unit', 'boot_id', 'pid', 'parent_pid', 'started_at', 'finished_at', 'executable', 'arguments', 'exit_code', 'stderr_empty'])
        || metadata.collector !== 'auditd' || metadata.event_type !== 'process' || metadata.action !== 'exec' || metadata.outcome !== 'success'
        || user.id !== '0' || user.login_id !== '4294967295' || !/^\d+$/.test(String(metadata.audit_id))) return false
    const args = process.arguments
    if (!Array.isArray(args) || !args.every(item => typeof item === 'string') || !routineCollectorArguments(args)
        || process.executable !== (args[0] === 'journalctl' ? '/usr/bin/journalctl' : '/usr/sbin/ausearch')
        || process.command_line !== args.map(quote).join(' ') || log.message !== process.command_line) return false
    const started = proof.started_at, finished = proof.finished_at, time = Date.parse(log.timestamp)
    if (proof.unit !== 'hanasand-log-collector.service' || !uuid.test(String(proof.boot_id)) || proof.exit_code !== 0 || proof.stderr_empty !== true
        || !/^[1-9]\d*$/.test(String(process.pid)) || !/^[1-9]\d*$/.test(String(process.parent_pid))
        || proof.pid !== process.pid || proof.parent_pid !== process.parent_pid || proof.executable !== process.executable
        || JSON.stringify(proof.arguments) !== JSON.stringify(args)
        || typeof started !== 'number' || typeof finished !== 'number' || !Number.isSafeInteger(started) || !Number.isSafeInteger(finished)
        || !Number.isFinite(time) || time < started || time > finished || finished < started || finished - started > 60_000) return false
    // Bind the proof to the collector's stable audit event identity as well.
    const auditTime = (time / 1000).toFixed(3)
    return log.sourceEventId === createHash('sha256').update(`${log.host}:audit:msg=audit(${auditTime}:${metadata.audit_id})`).digest('hex')
}
