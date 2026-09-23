import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { expect, test } from 'bun:test'
import { eligibleReadinessAudit, matchesReadinessFact, readinessArguments, readinessCanonical, readinessDigest, readinessAuditRule, type ReadinessExecutionProof } from '../src/utils/mill/analyzeReadinessAudit.ts'
import type { CollectorLog } from '../src/utils/mill/analyzeCollector.ts'

export const keys = generateKeyPairSync('ed25519')
export function fixture(): { log: CollectorLog, fact: ReadinessExecutionProof } {
    const time = Date.parse('2026-09-24T00:00:00.100Z'), nonce = '3e735e7b-4d7f-444d-9806-231fa26cfcec'
    const args = readinessArguments(nonce), command = args.slice(0,4).join(' ') + " '" + args[4] + "'"
    const fact: ReadinessExecutionProof = { version: 1, host: 'inspur', containerId: 'a'.repeat(64), execId: 'b'.repeat(64), bootId: nonce,
        parentPid: 12000, parentStartTicks: '123456', namespacePid: 12, nonce, startedAt: time - 10, finishedAt: time + 100, previousStartedAt: time - 5010 }
    const log: CollectorLog = { service: 'audit', host: 'inspur', level: 'info', message: command, timestamp: new Date(time).toISOString(),
        sourceEventId: createHash('sha256').update(`inspur:audit:msg=audit(${(time / 1000).toFixed(3)}:42)`).digest('hex'),
        metadata: { collector: 'auditd', event_type: 'process', action: 'exec', outcome: 'success', audit_id: '42',
            process: { executable: args[0], command_line: command, arguments: args, pid: '12345', parent_pid: '12000' }, user: { id: '0', login_id: '4294967295' } } }
    return { log, fact }
}
export function signed(log: CollectorLog, fact: ReadinessExecutionProof) {
    const payload = { fact, eventDigest: readinessDigest(log) }
    return { ...log, metadata: { ...log.metadata, readiness_execution: { ...payload, signature: sign(null, Buffer.from(readinessCanonical(payload)), keys.privateKey).toString('base64') } } }
}
export function configure() { process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY = keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex') }

test('requires pinned signed producer proof; delayed queued originals remain eligible', () => {
    const old = process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY
    try {
        configure(); const {log,fact} = fixture()
        expect(readinessAuditRule.enabled).toBe(false)
        expect(eligibleReadinessAudit(log)).toBe(false)
        expect(eligibleReadinessAudit(signed(log, fact))).toBe(true)
        // Fixture intentionally independent of delivery clock: signature binds original event time.
        delete process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY
        expect(eligibleReadinessAudit(signed(log, fact))).toBe(false)
    } finally { if (old === undefined) delete process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY; else process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY = old }
})
test('signed but mismatched native identity and unusual timing retain the event', () => {
    configure(); const {log,fact} = fixture()
    for (const change of [{parentPid:999}, {nonce:'bad'}, {host:'ovhcloud'}, {containerId:'bad'}, {execId:'bad'}, {bootId:'bad'},
        {previousStartedAt: fact.startedAt-100}, {previousStartedAt:fact.startedAt-16000}, {finishedAt:fact.startedAt-1},
        {finishedAt:fact.startedAt+1001}, {startedAt: fact.finishedAt}, {namespacePid:0}, {parentStartTicks:'0'}]) {
        expect(eligibleReadinessAudit(signed(log, {...fact,...change}))).toBe(false)
    }
})
test('tampering, manual lookalikes, extra arguments and suspicious fields always retain', () => {
    configure(); const {log,fact}=fixture(), good=signed(log,fact)
    for (const change of [{level:'error'}, {host:'customer'}, {service:'other'}, {message:log.message+'; whoami'}, {sourceEventId:'c'.repeat(64)}, {timestamp:'bad'}]) {
        expect(eligibleReadinessAudit({...good,...change})).toBe(false)
    }
    for (const key of ['detections','organizationId','tenantId','body','unexpected']) expect(eligibleReadinessAudit({...good,metadata:{...good.metadata,[key]:'suspicious'}})).toBe(false)
    for (const [field, change] of [['process',{executable:'/tmp/pg_isready'}],['process',{arguments:[...readinessArguments(fact.nonce),'-h','203.0.113.1']}],
        ['process',{parent_pid:'999'}],['process',{unexpected:'payload'}],['user',{id:'1000'}],['user',{login_id:'1000'}]] as const) {
        const changed=structuredClone(log); Object.assign(changed.metadata![field] as object,change)
        expect(eligibleReadinessAudit(signed(changed,fact))).toBe(false)
    }
    expect(matchesReadinessFact({...log,unexpected:'payload'} as CollectorLog,fact)).toBe(false)
    const forged=structuredClone(good); forged.metadata.readiness_execution.signature='A'.repeat(86)+'=='
    expect(eligibleReadinessAudit(forged)).toBe(false)
    const changedFact=structuredClone(good); changedFact.metadata.readiness_execution.fact.execId='c'.repeat(64)
    expect(eligibleReadinessAudit(changedFact)).toBe(false)
})
