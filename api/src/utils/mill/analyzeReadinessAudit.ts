import { createHash, createPublicKey, verify } from 'node:crypto'
import type { CollectorLog } from './analyzeCollector.ts'

export const readinessAuditRuleId = 'postgresql.readiness_audit.v1'
export const readinessAuditUnavailable = 'A pinned host signing key and native Docker process-bound completion proof are required.'
export const readinessAuditRule = {
    id: readinessAuditRuleId, version: '1', name: 'Verified PostgreSQL readiness executions', family: 'System', severity: 'low', enabled: false,
    explanation: 'Count one complete scheduled PostgreSQL healthcheck cycle and retain its four original audit events in one compressed signed receipt. Require native Docker success, exact live process identities and normal cadence; keep incomplete, manual, failed, changed or ambiguous chains and every detection or Keep match.',
    evidence: ['host audit process', 'Docker healthcheck execution', 'successful completion', 'normal probe cadence'],
}
export const readinessAuditDefinition = { match: 'all' as const, conditions: [
    { path: 'host', operator: 'equals' as const, value: 'inspur', caseSensitive: true },
    { path: 'service', operator: 'equals' as const, value: 'audit', caseSensitive: true },
    { path: 'process.executable', operator: 'regex' as const, value: '^(?:/usr/bin/dash|/usr/lib/postgresql/15/bin/pg_isready)$', caseSensitive: true },
], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: { maxDurationMs: 1000, minIntervalMs: 4000, maxIntervalMs: 15000 } }
export function validReadinessAuditParameters(value: unknown): value is { maxDurationMs: number, minIntervalMs: number, maxIntervalMs: number } {
    const params = object(value)
    return exact(params, ['maxDurationMs', 'minIntervalMs', 'maxIntervalMs'])
        && Number.isSafeInteger(params.maxDurationMs) && params.maxDurationMs >= 1 && params.maxDurationMs <= 60000
        && Number.isSafeInteger(params.minIntervalMs) && params.minIntervalMs >= 1
        && Number.isSafeInteger(params.maxIntervalMs) && params.maxIntervalMs >= params.minIntervalMs && params.maxIntervalMs <= 3600000
}
export function readinessTimingAllowed(fact: ReadinessExecutionProof, parameters: unknown) {
    return validReadinessAuditParameters(parameters) && fact.finishedAt - fact.startedAt <= parameters.maxDurationMs
        && fact.startedAt - fact.previousStartedAt >= parameters.minIntervalMs && fact.startedAt - fact.previousStartedAt <= parameters.maxIntervalMs
}

export type ReadinessExecutionProof = {
    version: 2, host: string, containerId: string, execId: string, bootId: string,
    execPid: number, execParentPid: number, execStartTicks: string,
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
export const readinessWrapperScript = 'printf "hanasand-pg-ready-v1 nonce=%s pid=%s\\n" "$1" "$$"; /usr/lib/postgresql/15/bin/pg_isready -U hanasand -d "dbname=hanasand application_name=pg_isready fallback_application_name=hanasand_probe_$1"; exit $?'
export function readinessWrapperArguments(nonce: string) { return ['/bin/sh', '-c', readinessWrapperScript, 'hanasand-readiness-v1', nonce] }
export const readinessRoles = ['root', 'entry', 'wrapper', 'probe'] as const
export type ReadinessRole = typeof readinessRoles[number]
export function readinessRole(log: CollectorLog): ReadinessRole | undefined {
    const args = object(log.metadata?.process).arguments
    if (!Array.isArray(args)) return
    if (args[0] === '/usr/lib/postgresql/15/bin/pg_isready') return 'probe'
    if (args[0] !== '/bin/sh') return
    if (args[1] === '/usr/local/bin/pg_isready') return 'entry'
    if (args[1] === '-c' && args[3] === 'hanasand-readiness-v1') return 'wrapper'
    if (args[1] === '-c' && args[2] === 'pg_isready -U hanasand -d hanasand') return 'root'
}
export function readinessRoleArguments(role: ReadinessRole, nonce: string): string[] {
    if (role === 'probe') return readinessArguments(nonce)
    if (role === 'wrapper') return readinessWrapperArguments(nonce)
    if (role === 'entry') return ['/bin/sh', '/usr/local/bin/pg_isready', '-U', 'hanasand', '-d', 'hanasand']
    return ['/bin/sh', '-c', 'pg_isready -U hanasand -d hanasand']
}
const quote = (value: string) => /^[\w@%+=:,./-]+$/.test(value) ? value : '\'' + value.replaceAll('\'', '\'"\'"\'') + '\''
export function matchesReadinessFact(log: CollectorLog, fact: ReadinessExecutionProof): boolean {
    if (!exact(object(fact), ['version', 'execPid', 'execParentPid', 'execStartTicks', 'host', 'containerId', 'execId', 'bootId', 'parentPid', 'parentStartTicks', 'namespacePid', 'nonce', 'startedAt', 'finishedAt', 'previousStartedAt'])
        || !exact(object(log), ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'])
        || fact.version !== 2 || typeof fact.host !== 'string' || !fact.host || log.host !== fact.host || log.service !== 'audit' || log.level !== 'info'
        || !uuid.test(fact.nonce) || !uuid.test(fact.bootId) || !/^[a-f0-9]{64}$/.test(fact.containerId) || !/^[a-f0-9]{64}$/.test(fact.execId)
        || !/^[1-9]\d*$/.test(fact.parentStartTicks) || !/^[1-9]\d*$/.test(fact.execStartTicks)
        || fact.execPid === fact.parentPid || ![fact.parentPid, fact.namespacePid, fact.execPid, fact.execParentPid].every(n => Number.isSafeInteger(n) && n > 0)) return false
    const meta = object(log.metadata), proc = object(meta.process), user = object(meta.user)
    const keys = ['collector', 'event_type', 'action', 'outcome', 'process', 'user', 'audit_id']
    if (Object.hasOwn(meta, 'readiness_execution')) keys.push('readiness_execution')
    const role = readinessRole(log)
    if (!role) return false
    const args = readinessRoleArguments(role, fact.nonce), command = args.map(quote).join(' ')
    if (!exact(meta, keys) || !exact(proc, ['executable', 'command_line', 'arguments', 'pid', 'parent_pid']) || !exact(user, ['id', 'login_id'])
        || meta.collector !== 'auditd' || meta.event_type !== 'process' || meta.action !== 'exec' || meta.outcome !== 'success'
        || user.id !== '0' || user.login_id !== '4294967295' || !/^[1-9]\d*$/.test(meta.audit_id)
        || proc.executable !== (role === 'probe' ? args[0] : '/usr/bin/dash') || proc.command_line !== command || log.message !== command
        || JSON.stringify(proc.arguments) !== JSON.stringify(args) || typeof proc.pid !== 'string' || !/^[1-9]\d*$/.test(proc.pid)
        || typeof proc.parent_pid !== 'string' || !/^[1-9]\d*$/.test(proc.parent_pid)
        || (role === 'probe' ? proc.parent_pid !== String(fact.parentPid) || [fact.parentPid, fact.execPid].includes(Number(proc.pid))
            : role === 'root' ? proc.pid !== String(fact.execPid) || proc.parent_pid !== String(fact.execParentPid)
                : proc.pid !== String(fact.parentPid) || proc.parent_pid !== String(fact.execPid))) return false
    const time = Date.parse(log.timestamp || '')
    return Number.isFinite(time) && [fact.startedAt, fact.finishedAt, fact.previousStartedAt].every(Number.isSafeInteger)
        && fact.finishedAt >= fact.startedAt
        && time >= fact.startedAt && time <= fact.finishedAt && fact.previousStartedAt > 0 && fact.previousStartedAt < fact.startedAt
        && log.sourceEventId === createHash('sha256').update(`${log.host}:audit:msg=audit(${(time / 1000).toFixed(3)}:${meta.audit_id})`).digest('hex')
}
export type ReadinessChainPayload = { fact: ReadinessExecutionProof, members: { role: ReadinessRole, sourceEventId: string, eventDigest: string }[] }
export function readinessChainPayload(logs: CollectorLog[], fact: ReadinessExecutionProof): ReadinessChainPayload | undefined {
    if (logs.length !== 4 || new Set(logs.map(log => log.sourceEventId)).size !== 4) return
    const ordered = readinessRoles.map(role => logs.filter(log => readinessRole(log) === role))
    if (ordered.some(matches => matches.length !== 1)) return
    const originals = ordered.map(matches => matches[0]!)
    if (originals.some((log, index) => !matchesReadinessFact(log, fact) || index > 0 && Object.hasOwn(log.metadata!, 'readiness_execution')
        || index > 0 && (Date.parse(log.timestamp!) < Date.parse(originals[index - 1]!.timestamp!)
            || BigInt(String(log.metadata!.audit_id)) <= BigInt(String(originals[index - 1]!.metadata!.audit_id))))) return
    return { fact, members: originals.map((log, index) => ({ role: readinessRoles[index]!, sourceEventId: log.sourceEventId!, eventDigest: readinessDigest(log) })) }
}
export function eligibleReadinessChain(logs: CollectorLog[]): boolean {
    if (!readinessAuditConfigured()) return false
    const root = logs.find(log => readinessRole(log) === 'root'), proof = object(root?.metadata?.readiness_execution)
    if (!exact(proof, ['fact', 'members', 'signature']) || typeof proof.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(proof.signature)) return false
    const payload = readinessChainPayload(logs, proof.fact)
    if (!payload || readinessCanonical(payload.members) !== readinessCanonical(proof.members)) return false
    try {
        const key = createPublicKey({ key: Buffer.from('302a300506032b6570032100' + process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY, 'hex'), format: 'der', type: 'spki' })
        return verify(null, Buffer.from(readinessCanonical(payload)), key, Buffer.from(proof.signature, 'base64'))
    } catch { return false }
}
export function completeReadinessChains(entries: CollectorLog[]) {
    const byId = new Map<string, CollectorLog[]>()
    for (const entry of entries) { const id = entry.sourceEventId || ''; byId.set(id, [...(byId.get(id) || []), entry]) }
    const candidates = entries.flatMap(root => {
        const proof = object(root.metadata?.readiness_execution)
        if (readinessRole(root) !== 'root' || !Array.isArray(proof.members) || proof.members.length !== 4) return []
        const sets = proof.members.map((member: any) => byId.get(member?.sourceEventId) || [])
        if (sets.some((rows: CollectorLog[]) => rows.length !== 1)) return []
        const logs = sets.map((rows: CollectorLog[]) => rows[0]!)
        if (!logs.includes(root) || !eligibleReadinessChain(logs)) return []
        const payload = readinessChainPayload(logs, proof.fact)!
        return [{ logs, fact: payload.fact, payload, digest: createHash('sha256').update(readinessCanonical(payload)).digest('hex') }]
    })
    return candidates.filter(chain => candidates.every(other => other === chain || other.fact.execId !== chain.fact.execId
        && !other.logs.some(log => chain.logs.includes(log))))
}
// A single event can never authorize a partial chain drop.
export function eligibleReadinessAudit(log: CollectorLog): boolean { void log; return false }
