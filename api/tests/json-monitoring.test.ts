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
