import { expect, test } from 'bun:test'
import { completedTelemetryCycles, completedSshWindows, routineEvidence, routineReceipt, telemetryRuleId, sshWindowRuleId, telemetryDefinition, sshWindowDefinition, validateRoutineGroupParameters, type RoutineLog } from '../src/utils/mill/analyzeRoutineGroups.ts'

export function telemetryFixture(now = Date.now()): RoutineLog[] {
    return ['Starting hanasand-host-metrics.service - Collect Hanasand host telemetry...', 'hanasand-host-metrics.service: Deactivated successfully.', 'Finished hanasand-host-metrics.service - Collect Hanasand host telemetry.'].map((message, i) => ({
        host: 'inspur', service: 'systemd', level: 'info', message, timestamp: new Date(now - 2000 + i * 100).toISOString(), sourceEventId: String(i + 1).repeat(64),
        metadata: { collector: 'journal', pid: '1', unit: 'init.scope', user: { id: '0' } },
    }))
}
export function sshFixture(now = Date.now()): RoutineLog[] {
    return [`Accepted publickey for monitor from 192.0.2.10 port 41000 ssh2: ED25519 SHA256:${'a'.repeat(43)}`, 'debug2: channel 0: rcvd adjust 32768', 'debug2: channel 0: window 16384 sent adjust 32768', 'Disconnected from user monitor 192.0.2.10 port 41000'].map((message, i) => ({
        host: 'inspur', service: 'sshd', level: i === 1 || i === 2 ? 'debug' : 'info', message, timestamp: new Date(now - 2000 + i * 100).toISOString(), sourceEventId: String(i + 1).repeat(64),
        metadata: { collector: 'journal', pid: '12456', unit: 'ssh.service', user: { id: '0' } },
    }))
}
test('complete telemetry cycle retains every original and exact timing in one evidence record', () => {
    const logs = telemetryFixture(), groups = completedTelemetryCycles(logs)
    expect(groups).toHaveLength(1)
    expect(groups[0].ruleId).toBe(telemetryRuleId)
    expect(routineEvidence(groups[0]).original_records).toEqual(logs)
    expect(routineEvidence(groups[0]).duration_ms).toBe(200)
    expect(completedTelemetryCycles(logs.slice(1))).toEqual([])
    expect(completedTelemetryCycles(logs.slice(0, 2))).toEqual([])
})
test('SSH only consolidates exact windows with preserved authentication and disconnection', () => {
    const logs = sshFixture(), groups = completedSshWindows(logs)
    expect(groups).toHaveLength(1)
    expect(groups[0].logs).toEqual(logs.slice(1, -1))
    expect(routineEvidence(groups[0]).original_records).toEqual(logs.slice(1, -1))
    expect(groups[0].context).toEqual(logs)
    expect(completedSshWindows(logs.slice(1))).toEqual([])
    expect(completedSshWindows(logs.slice(0, -1))).toEqual([])
})
test('unknown or suspicious SSH activity invalidates the entire session', () => {
    for (const message of ['debug3: send packet: type 50', 'debug2: channel 0: rcvd adjust 32768 [preauth]', 'debug2: channel 0: rcvd adjust 32768\nFailed password', 'Starting session: command for monitor', 'Failed password for root from 192.0.2.10', 'error: channel open failed', 'debug2: channel 0: rcvd adjust 9999999999999999999']) {
        const logs = sshFixture(); logs[1].message = message
        expect(completedSshWindows(logs)).toEqual([])
    }
    for (const mutate of [
        (r: RoutineLog[]) => { r[1].metadata!.detections = [{ rule_id: 'suspicious' }] },
        (r: RoutineLog[]) => { r[1].metadata!.tenantId = 'other' },
        (r: RoutineLog[]) => { r[1].metadata!.pid = '999' },
        (r: RoutineLog[]) => { r[1].level = 'warn' },
        (r: RoutineLog[]) => { r[1].metadata!.unit = 'evil.service' },
        (r: RoutineLog[]) => { r[1].sourceEventId = r[2].sourceEventId },
        (r: RoutineLog[]) => { r[3].message = r[3].message.replace('192.0.2.10', '192.0.2.11') },
        (r: RoutineLog[]) => { r[0].timestamp = new Date(Date.now() - 120000).toISOString() },
    ]) { const logs = sshFixture(); mutate(logs); expect(completedSshWindows(logs)).toEqual([]) }
})
test('telemetry failures, untrusted context, slow or unmatched cycles remain visible', () => {
    for (const mutate of [
        (r: RoutineLog[]) => { r[1].message += ' error injected' },
        (r: RoutineLog[]) => { r[1].metadata!.extra = 'payload' },
        (r: RoutineLog[]) => { r[1].metadata!.user = { id: '1000' } },
        (r: RoutineLog[]) => { r[1].metadata!.pid = '123' },
        (r: RoutineLog[]) => { r[1].level = 'error' },
        (r: RoutineLog[]) => { r[0].timestamp = new Date(Date.now() - 15000).toISOString() },
        (r: RoutineLog[]) => { r[2].sourceEventId = r[1].sourceEventId },
        (r: RoutineLog[]) => { r.push({ ...r[2], message: 'hanasand-host-metrics.service: Failed with result exit-code.' }) },
    ]) { const logs = telemetryFixture(); mutate(logs); expect(completedTelemetryCycles(logs)).toEqual([]) }
})
test('receipts bind full evidence, not only source identity', () => {
    const log = telemetryFixture()[0]
    expect(routineReceipt(telemetryRuleId, log)).toBe(routineReceipt(telemetryRuleId, { ...log, metadata: Object.fromEntries(Object.entries(log.metadata!).reverse()) }))
    expect(routineReceipt(telemetryRuleId, log)).not.toBe(routineReceipt(telemetryRuleId, { ...log, message: log.message + ' injected' }))
})
test('saved timing controls cannot exceed safe validation bounds', () => {
    expect(validateRoutineGroupParameters(telemetryRuleId, telemetryDefinition.parameters)).toBeNull()
    expect(validateRoutineGroupParameters(sshWindowRuleId, sshWindowDefinition.parameters)).toBeNull()
    for (const parameters of [{ maxDurationMs: 5001 }, { minimumGapMs: 899 }, { maxAgeMs: 60001 }, { maxPerMinute: 66 }, { maxPerMinute: '1' }, { ignoreFailures: true }]) {
        expect(validateRoutineGroupParameters(telemetryRuleId, parameters)).toBeTruthy()
    }
})
