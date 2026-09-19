import { expect, test } from 'bun:test'
import { resilienceChecks, resilienceCheckMessage } from '../src/utils/resilienceMonitoring.ts'
import { monitoringIssueFingerprint } from '../src/utils/monitoringIssues.ts'
import { needsSystemAutomationAccess, automationReadScope } from '../src/utils/automationAccess.ts'

const now = Date.now()
const rule = { path: 'ovh_replica.failed', operator: 'eq' as const, value: true, aggregate: 'first' as const }
const state = { sampledAt: now / 1000, database: { slots: [{ slot: 'hanasand_ovh_standby', walStatus: 'lost', active: false, lagBytes: null }] },
    backupReceipt: { receivedAt: new Date(now - 37 * 3600_000).toISOString() }, backupJob: { status: 'failed' } }

test('replication and backup failures remain separate even when services respond', () => {
    const checks = resilienceChecks(state, now)
    expect(checks.ovh_replica).toEqual({ failed: true, message: 'WAL replication lost. Restore the replica from a backup.' })
    expect(checks.backup).toEqual({ failed: true, message: 'No backup taken in 36 hours.' })
    expect(resilienceCheckMessage(checks, rule, false)).toBe(checks.ovh_replica.message)
    expect(resilienceCheckMessage(checks, rule, true)).toBeNull()
})

test('missing or stale observations never report recovery', () => {
    expect(() => resilienceChecks({ ...state, sampledAt: (now - 61000) / 1000 }, now)).toThrow('Recovery monitoring is unavailable.')
    expect(resilienceChecks({ ...state, database: {} }, now).ovh_replica.failed).toBe(true)
    expect(resilienceChecks({ ...state, database: {}, backups: { restoreSlots: ['hanasand_ovh_standby'] } }, now).ovh_replica.message).toContain('WAL replication lost')
})

test('recovery requires an active caught-up slot and a successful recent backup', () => {
    const recovered = { ...state, database: { slots: [{ slot: 'hanasand_ovh_standby', walStatus: 'reserved', active: true, lagBytes: 0 }] },
        backupReceipt: { receivedAt: new Date(now).toISOString() }, backupJob: { status: 'verified' } }
    expect(resilienceChecks(recovered, now).ovh_replica.failed).toBe(false)
    expect(resilienceChecks(recovered, now).backup.failed).toBe(false)
    expect(resilienceChecks({ ...recovered, backupJob: { status: 'failed' } }, now).backup.failed).toBe(true)
})

test('changing failure detail keeps the same case and cooldown', () => {
    const monitor = { target_url: 'system:resilience', monitoring_type: 'json' as const, json_rule: rule }
    expect(monitoringIssueFingerprint(monitor, 'failure', 'OVH replica is not up to date.'))
        .toBe(monitoringIssueFingerprint(monitor, 'failure', 'WAL replication lost. Restore the replica from a backup.'))
    expect(monitoringIssueFingerprint(monitor, 'failure', 'unavailable')).not.toBe(monitoringIssueFingerprint({ ...monitor, json_rule: { ...rule, path: 'backup.failed' } }, 'failure', 'unavailable'))
})

test('recovery monitoring is restricted to administrators', () => {
    expect(needsSystemAutomationAccess({ actionType: 'agent_prompt', targetUrl: 'system:resilience', organizationId: null, modelName: null })).toBe(true)
    expect(automationReadScope('a', '$1', '$2')).toContain("a.target_url IS DISTINCT FROM 'system:resilience'")
})
