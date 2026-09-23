import { createHash } from 'node:crypto'
import type { CollectorLog } from './analyzeCollector.ts'

export const readinessAuditRuleId = 'postgresql.readiness_audit.v1'
export const readinessAuditUnavailable = 'Docker healthcheck results do not identify the host audit process. Keep readiness executions until trusted completion and process identity can be linked.'
export const readinessAuditRule = {
    id: readinessAuditRuleId, version: '1', name: 'Verified PostgreSQL readiness executions', family: 'System', severity: 'low', enabled: false,
    explanation: `Disabled: ${readinessAuditUnavailable}`,
    evidence: ['host audit process', 'Docker healthcheck execution', 'successful completion', 'normal probe cadence'],
}
export const readinessAuditDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }

// This contract is for a future server-controlled verifier. There is currently
// no producer: event metadata, matching timestamps and Docker Health.Log alone
// must NEVER be converted into this proof. The rule cannot be enabled yet.
export type ReadinessExecutionProof = {
    host: string, containerName: string, containerId: string, bootId: string, execId: string,
    hostPid: string, hostParentPid: string, auditEventId: string,
    command: string[], startedAt: number, finishedAt: number, previousStartedAt: number,
    completedInLastMinute: number, exitCode: number, stdout: string, stderr: string,
}
const args = ['/usr/lib/postgresql/15/bin/pg_isready', '-U', 'hanasand', '-d', 'hanasand']
const command = args.join(' ')
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const exact = (row: Record<string, unknown>, keys: string[]) => Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key))
const digest = (text: string) => createHash('sha256').update(text).digest('hex')

export function eligibleReadinessAudit(log: CollectorLog, proof?: ReadinessExecutionProof, now = Date.now()): boolean {
    // Proof must be supplied separately by trusted code, never log.metadata.
    if (!proof || !exact(proof as unknown as Record<string, unknown>, ['host', 'containerName', 'containerId', 'bootId', 'execId',
        'hostPid', 'hostParentPid', 'auditEventId', 'command', 'startedAt', 'finishedAt', 'previousStartedAt', 'completedInLastMinute', 'exitCode', 'stdout', 'stderr'])
        || !exact(log as unknown as Record<string, unknown>, ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'])
        || log.host !== 'inspur' || log.service !== 'audit' || log.level !== 'info' || log.message !== command
        || !/^[a-f0-9]{64}$/.test(log.sourceEventId || '') || !log.timestamp) return false
    const meta = object(log.metadata), process = object(meta.process), user = object(meta.user)
    if (!exact(meta, ['collector', 'event_type', 'action', 'outcome', 'process', 'user', 'audit_id'])
        || !exact(process, ['executable', 'command_line', 'arguments', 'pid', 'parent_pid']) || !exact(user, ['id', 'login_id'])
        || meta.collector !== 'auditd' || meta.event_type !== 'process' || meta.action !== 'exec' || meta.outcome !== 'success'
        || user.id !== '0' || user.login_id !== '4294967295' || !/^[1-9]\d*$/.test(String(meta.audit_id))
        || process.executable !== args[0] || process.command_line !== command || JSON.stringify(process.arguments) !== JSON.stringify(args)
        || typeof process.pid !== 'string' || !/^[1-9]\d*$/.test(process.pid)
        || typeof process.parent_pid !== 'string' || !/^[1-9]\d*$/.test(process.parent_pid)) return false
    const time = Date.parse(log.timestamp)
    if (!Number.isFinite(now) || !Number.isFinite(time) || time < now - 60_000 || time > now + 1000
        || ![proof.startedAt, proof.finishedAt, proof.previousStartedAt, proof.completedInLastMinute].every(Number.isSafeInteger)
        || proof.finishedAt < proof.startedAt || proof.finishedAt - proof.startedAt > 1000 || proof.finishedAt > now
        || time < proof.startedAt || time > proof.finishedAt || proof.startedAt - proof.previousStartedAt < 4000
        || proof.startedAt - proof.previousStartedAt > 15_000 || proof.completedInLastMinute < 2 || proof.completedInLastMinute > 15
        || proof.host !== log.host || proof.containerName !== 'hanasand_database'
        || !/^[a-f0-9]{64}$/.test(proof.containerId) || !/^[a-f0-9]{64}$/.test(proof.execId)
        || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(proof.bootId)
        || proof.hostPid !== process.pid || proof.hostParentPid !== process.parent_pid || proof.auditEventId !== log.sourceEventId
        || JSON.stringify(proof.command) !== JSON.stringify(args) || proof.exitCode !== 0
        || proof.stdout !== '/var/run/postgresql:5432 - accepting connections\n' || proof.stderr !== '') return false
    return log.sourceEventId === digest(`${log.host}:audit:msg=audit(${(time / 1000).toFixed(3)}:${meta.audit_id})`)
}
