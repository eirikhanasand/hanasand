import { createHash } from 'node:crypto'
import { expect, test } from 'bun:test'
import { eligibleReadinessAudit, readinessAuditRule, type ReadinessExecutionProof } from '../src/utils/mill/analyzeReadinessAudit.ts'
import type { CollectorLog } from '../src/utils/mill/analyzeCollector.ts'

const now = Date.parse('2026-09-24T00:00:01.000Z')
const args = ['/usr/lib/postgresql/15/bin/pg_isready', '-U', 'hanasand', '-d', 'hanasand']
function fixture(): { log: CollectorLog, proof: ReadinessExecutionProof } {
    const time = now - 900
    const sourceEventId = createHash('sha256').update(`inspur:audit:msg=audit(${(time / 1000).toFixed(3)}:42)`).digest('hex')
    return { log: { service: 'audit', host: 'inspur', level: 'info', message: args.join(' '), timestamp: new Date(time).toISOString(), sourceEventId,
        metadata: { collector: 'auditd', event_type: 'process', action: 'exec', outcome: 'success', audit_id: '42',
            process: { executable: args[0], command_line: args.join(' '), arguments: [...args], pid: '12345', parent_pid: '12000' }, user: { id: '0', login_id: '4294967295' } } },
    proof: { host: 'inspur', containerName: 'hanasand_database', containerId: 'a'.repeat(64), bootId: '3e735e7b-4d7f-444d-9806-231fa26cfcec', execId: 'b'.repeat(64),
        hostPid: '12345', hostParentPid: '12000', auditEventId: sourceEventId, command: [...args], startedAt: time - 10, finishedAt: time + 100,
        previousStartedAt: time - 5010, completedInLastMinute: 12, exitCode: 0, stdout: '/var/run/postgresql:5432 - accepting connections\n', stderr: '' } }
}

test('disabled until trusted process-bound completion evidence exists', () => {
    const { log, proof } = fixture()
    expect(readinessAuditRule.enabled).toBe(false)
    expect(eligibleReadinessAudit(log, undefined, now)).toBe(false)
    log.metadata!.healthcheck_execution = proof
    expect(eligibleReadinessAudit(log, undefined, now)).toBe(false)
    expect(eligibleReadinessAudit(log, proof, now)).toBe(false)
    delete log.metadata!.healthcheck_execution
    expect(eligibleReadinessAudit(log, proof, now)).toBe(true)
    expect(eligibleReadinessAudit({ ...log, unexpected: 'payload' } as CollectorLog, proof, now)).toBe(false)
    expect(eligibleReadinessAudit(log, { ...proof, unexpected: 'payload' } as ReadinessExecutionProof, now)).toBe(false)
})

test('retains failures, mismatched processes, unusual cadence and malformed completion evidence', () => {
    const { log, proof } = fixture()
    const changes: Partial<ReadinessExecutionProof>[] = [
        { exitCode: 1 }, { stderr: 'warning' }, { stdout: proof.stdout + 'injected' }, { host: 'ovhcloud' },
        { containerName: 'attacker' }, { containerId: 'bad' }, { bootId: 'bad' }, { execId: 'bad' },
        { hostPid: '12346' }, { hostParentPid: '999' }, { auditEventId: 'c'.repeat(64) }, { command: [...args, '-h', '203.0.113.1'] },
        { startedAt: now }, { finishedAt: proof.startedAt - 1 }, { finishedAt: now + 1 },
        { startedAt: proof.startedAt - 2000 }, { previousStartedAt: proof.startedAt - 100 },
        { previousStartedAt: proof.startedAt - 60_000 }, { completedInLastMinute: 99 }, { completedInLastMinute: 0 },
        { startedAt: NaN }, { finishedAt: Infinity }, { completedInLastMinute: 1.5 },
    ]
    for (const change of changes) expect(eligibleReadinessAudit(log, { ...proof, ...change }, now)).toBe(false)
})

test('retains changed commands, suspicious metadata, identities and historic unproven events', () => {
    const { log, proof } = fixture()
    for (const changes of [{ level: 'error' }, { host: 'customer' }, { service: 'other' }, { timestamp: 'bad' },
        { sourceEventId: 'c'.repeat(64) }, { message: log.message + '; whoami' }]) expect(eligibleReadinessAudit({ ...log, ...changes }, proof, now)).toBe(false)
    for (const key of ['detections', 'organizationId', 'tenantId', 'body', 'unexpected']) {
        expect(eligibleReadinessAudit({ ...log, metadata: { ...log.metadata, [key]: 'suspicious' } }, proof, now)).toBe(false)
    }
    for (const [field, change] of [['process', { executable: '/tmp/pg_isready' }], ['process', { arguments: [...args, 'payload'] }],
        ['process', { unexpected: 'payload' }], ['user', { id: '1000' }], ['user', { login_id: '1000' }]] as const) {
        const changed = structuredClone(log)
        Object.assign(changed.metadata![field] as object, change)
        expect(eligibleReadinessAudit(changed, proof, now)).toBe(false)
    }
    expect(eligibleReadinessAudit(log, proof, now + 120_000)).toBe(false)
})
