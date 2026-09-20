import { expect, test } from 'bun:test'
import { evaluateJsonRule, normalizeJsonRule } from '../src/utils/jsonMonitoring.ts'
import { monitoringIssueFingerprint } from '../src/utils/monitoringIssues.ts'
const rule = normalizeJsonRule({ path: 'host.storage.*.usedPercent', aggregate: 'max', operator: 'gt', value: 80 })
test('independent rules evaluate one payload and respect strict boundaries', () => {
    const payload = { host: { storage: [{ usedPercent: 47 }, { usedPercent: 80 }], cpuPercent: 81, temperatures: [{ margin: null }, { margin: -0.1 }] } }
    expect(evaluateJsonRule(payload, rule).exceeded).toBe(false)
    expect(evaluateJsonRule(payload, { ...rule, path: 'host.cpuPercent' }).exceeded).toBe(true)
    expect(evaluateJsonRule(payload, { ...rule, path: 'host.temperatures.*.margin', aggregate: 'min', operator: 'lt', value: 0 }).exceeded).toBe(true)
    expect(evaluateJsonRule({ ok: true }, { path: 'ok', aggregate: 'first', operator: 'ne', value: true }).exceeded).toBe(false)
})
test('missing readings and wrong types never pass as zero', () => {
    expect(() => evaluateJsonRule({}, rule)).toThrow('unavailable')
    expect(() => evaluateJsonRule({ host: { storage: [{ usedPercent: null }] } }, rule)).toThrow('unavailable')
    expect(() => evaluateJsonRule({ host: { storage: [{ usedPercent: '90%' }] } }, rule)).toThrow('not numeric')
    expect(() => normalizeJsonRule({ ...rule, path: '__proto__.polluted' })).toThrow()
    expect(() => normalizeJsonRule({ ...rule, value: 'eighty' })).toThrow()
})
test('changing threshold observations share one case; source failures remain separate', () => {
    const monitor = { target_url: 'system:metrics', monitoring_type: 'json' as const, json_rule: rule }
    const fingerprint = (message: string) => monitoringIssueFingerprint(monitor, 'failure', message)
    expect(fingerprint('JSON threshold exceeded: value = 93')).toBe(fingerprint('JSON threshold exceeded: value = 94'))
    expect(fingerprint('JSON source unavailable')).not.toBe(fingerprint('JSON threshold exceeded: value = 93'))
})

test('TI checks keep one identity through health and transport failures without combining different rules', () => {
    const monitor = { target_url: 'system:ti-enrichment', monitoring_type: 'json' as const,
        json_rule: normalizeJsonRule({ path: 'enrichment.critical', aggregate: 'first', operator: 'eq', value: true }) }
    const health = monitoringIssueFingerprint(monitor, 'failure', 'JSON threshold exceeded: enrichment.critical = true')
    for (const message of ['timeout exceeded when trying to connect Failed after 1 attempt.',
        'Unable to connect. Is the computer able to access the url? Failed after 1 attempt.',
        'connect ECONNREFUSED ti:8097', 'Enrichment has added no new facts in the past hour.']) {
        expect(monitoringIssueFingerprint(monitor, 'failure', message)).toBe(health)
    }
    expect(monitoringIssueFingerprint({ ...monitor, target_url: 'system:ti-collection' }, 'failure', 'Unavailable')).not.toBe(health)
    expect(monitoringIssueFingerprint({ ...monitor, json_rule: { ...monitor.json_rule, path: 'collection.critical' } }, 'failure', 'Unavailable')).not.toBe(health)
})

test('temperature threshold evaluates actual sensor values, including sensors without hardware limits', () => {
    const temperature = normalizeJsonRule({ path: 'host.temperatures.*.value', aggregate: 'max', operator: 'gt', value: 50 })
    expect(evaluateJsonRule({ host: { temperatures: [{ value: 30, margin: null }, { value: 50, margin: 34 }] } }, temperature)).toEqual({ exceeded: false, observed: 50 })
    expect(evaluateJsonRule({ host: { temperatures: [{ value: 50.1, margin: null }, { value: 30, margin: 54 }] } }, temperature)).toEqual({ exceeded: true, observed: 50.1 })
    expect(() => evaluateJsonRule({ host: { temperatures: [] } }, temperature)).toThrow('unavailable')
})

test('OVH and Inspur snapshots have independent readings and freshness', async () => {
    const { assertHostSnapshotFresh } = await import('../src/utils/jsonMonitoring.ts')
    const fresh = new Date().toISOString()
    const old = new Date(Date.now() - 120_000).toISOString()
    const payload = { host: { sampledAt: old, cpuPercent: 90 }, hosts: { ovhcloud: { sampledAt: fresh, cpuPercent: 5 } } }
    const remoteRule = { ...rule, path: 'hosts.ovhcloud.cpuPercent' }
    expect(evaluateJsonRule(payload, remoteRule)).toEqual({ exceeded: false, observed: 5 })
    expect(() => assertHostSnapshotFresh(payload, remoteRule.path)).not.toThrow()
    expect(() => assertHostSnapshotFresh(payload, 'host.cpuPercent')).toThrow('Inspur host telemetry is stale')
    expect(() => assertHostSnapshotFresh({ host: { sampledAt: fresh } }, remoteRule.path)).toThrow('OVH host telemetry is unavailable')
    expect(() => assertHostSnapshotFresh({ hosts: { ovhcloud: { sampledAt: old } } }, remoteRule.path)).toThrow('OVH host telemetry is stale')
})
