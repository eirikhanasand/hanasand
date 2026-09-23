import { createHash, createPublicKey, verify } from 'node:crypto'
import type { CollectorLog } from './analyzeCollector.ts'

export const readinessAuditRuleId = 'postgresql.readiness_audit.v1'
export const readinessAuditUnavailable = 'A pinned host signing key and native Docker process-bound completion proof are required.'
export const readinessAuditRule = {
    id: readinessAuditRuleId, version: '1', name: 'Verified PostgreSQL readiness executions', family: 'System', severity: 'low', enabled: false,
    explanation: 'Retain a signed original receipt and omit the indexed log only for a successful scheduled PostgreSQL readiness execution bound to native Docker history, a live host process and normal cadence. Keep manual, failed, altered, ambiguous or unproven executions and any current detection or Keep match.',
    evidence: ['host audit process', 'Docker healthcheck execution', 'successful completion', 'normal probe cadence'],
}
export const readinessAuditDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }

export type ReadinessExecutionProof = {
    version: 1, host: string, containerId: string, execId: string, bootId: string,
    parentPid: number, parentStartTicks: string, namespacePid: number, nonce: string,
    startedAt: number, finishedAt: number, previousStartedAt: number,
}
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
const object = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
const exact = (row: Record<string, unknown>, keys: string[]) => Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key))
export const readinessCanonical = (value: any): string => Array.isArray(value) ? '[' + value.map(readinessCanonical).join(',') + ']'
    : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + readinessCanonical(value[key])).join(',') + '}' : JSON.stringify(value)
export const readinessDigest = (log: CollectorLog) => {
    const metadata = { ...log.metadata }; delete metadata.readiness_execution
    return createHash('sha256').update(readinessCanonical({ ...log, metadata })).digest('hex')
}
export function readinessAuditConfigured() { return /^[a-f0-9]{64}$/.test(process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY || '') }
export function readinessArguments(nonce: string) { return ['/usr/lib/postgresql/15/bin/pg_isready', '-U', 'hanasand', '-d', `dbname=hanasand application_name=pg_isready fallback_application_name=hanasand_probe_${nonce}`] }
const quote = (value: string) => /^[\w@%+=:,./-]+$/.test(value) ? value : '\'' + value.replaceAll('\'', '\'"\'"\'') + '\''
export function matchesReadinessFact(log: CollectorLog, fact: ReadinessExecutionProof): boolean {
    if (!exact(object(fact), ['version', 'host', 'containerId', 'execId', 'bootId', 'parentPid', 'parentStartTicks', 'namespacePid', 'nonce', 'startedAt', 'finishedAt', 'previousStartedAt'])
        || !exact(object(log), ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'])
        || fact.version !== 1 || fact.host !== 'inspur' || log.host !== fact.host || log.service !== 'audit' || log.level !== 'info'
        || !uuid.test(fact.nonce) || !uuid.test(fact.bootId) || !/^[a-f0-9]{64}$/.test(fact.containerId) || !/^[a-f0-9]{64}$/.test(fact.execId)
        || !/^[1-9]\d*$/.test(fact.parentStartTicks) || ![fact.parentPid, fact.namespacePid].every(n => Number.isSafeInteger(n) && n > 0)) return false
    const meta = object(log.metadata), proc = object(meta.process), user = object(meta.user)
    const keys = ['collector', 'event_type', 'action', 'outcome', 'process', 'user', 'audit_id']
    if (Object.hasOwn(meta, 'readiness_execution')) keys.push('readiness_execution')
    const args = readinessArguments(fact.nonce), command = args.map(quote).join(' ')
    if (!exact(meta, keys) || !exact(proc, ['executable', 'command_line', 'arguments', 'pid', 'parent_pid']) || !exact(user, ['id', 'login_id'])
        || meta.collector !== 'auditd' || meta.event_type !== 'process' || meta.action !== 'exec' || meta.outcome !== 'success'
        || user.id !== '0' || user.login_id !== '4294967295' || !/^[1-9]\d*$/.test(meta.audit_id)
        || proc.executable !== args[0] || proc.command_line !== command || log.message !== command
        || JSON.stringify(proc.arguments) !== JSON.stringify(args) || typeof proc.pid !== 'string' || !/^[1-9]\d*$/.test(proc.pid)
        || proc.parent_pid !== String(fact.parentPid)) return false
    const time = Date.parse(log.timestamp || '')
    return Number.isFinite(time) && [fact.startedAt, fact.finishedAt, fact.previousStartedAt].every(Number.isSafeInteger)
        && fact.finishedAt >= fact.startedAt && fact.finishedAt - fact.startedAt <= 1000
        && time >= fact.startedAt && time <= fact.finishedAt && fact.startedAt - fact.previousStartedAt >= 4000
        && fact.startedAt - fact.previousStartedAt <= 15000
        && log.sourceEventId === createHash('sha256').update(`${log.host}:audit:msg=audit(${(time / 1000).toFixed(3)}:${meta.audit_id})`).digest('hex')
}
export function eligibleReadinessAudit(log: CollectorLog): boolean {
    if (!readinessAuditConfigured()) return false
    const proof = object(log.metadata?.readiness_execution)
    if (!exact(proof, ['fact', 'eventDigest', 'signature']) || typeof proof.signature !== 'string'
        || !/^[A-Za-z0-9+/]{86}==$/.test(proof.signature) || !matchesReadinessFact(log, proof.fact)
        || proof.eventDigest !== readinessDigest(log)) return false
    try {
        const key = createPublicKey({ key: Buffer.from('302a300506032b6570032100' + process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY, 'hex'), format: 'der', type: 'spki' })
        return verify(null, Buffer.from(readinessCanonical({ fact: proof.fact, eventDigest: proof.eventDigest })), key, Buffer.from(proof.signature, 'base64'))
    } catch { return false }
}
