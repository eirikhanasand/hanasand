import { expect, test } from 'bun:test'
import { hostCheckMessage } from '../src/utils/hostCheckMessage.ts'
import { monitoringIssueFingerprint } from '../src/utils/monitoringIssues.ts'
import type { JsonRule } from '../src/utils/jsonMonitoring.ts'

for (const [path, name] of [['memoryPercent', 'RAM'], ['cpuPercent', 'CPU'], ['gpus.*.usedPercent', 'GPU'], ['storage.*.usedPercent', 'Storage']]) {
    test(`${name} describes normal and high usage`, () => {
        const rule: JsonRule = { path: `host.${path}`, operator: 'gt', aggregate: 'max', value: 80 }
        expect(hostCheckMessage(rule, 8.01, false)).toBe(`${name} usage is normal: 8.01% used (alert at 80%).`)
        expect(hostCheckMessage(rule, 81, true)).toBe(`${name} usage is high: 81% used (alert at 80%).`)
        expect(hostCheckMessage(rule, 80.01, true)).toContain('80.01%')
        expect(hostCheckMessage(rule, 80, false)).toContain('normal')
        expect(hostCheckMessage(rule, 8, true, true)).toBeNull()
        expect(hostCheckMessage({ ...rule, operator: 'lt' }, 8, true)).toBeNull()
        const monitor = { target_url: 'system:metrics', monitoring_type: 'json' as const, json_rule: rule }
        const fingerprint = (message: string) => monitoringIssueFingerprint(monitor, 'failure', message)
        expect(fingerprint(hostCheckMessage(rule, 81, true)!)).toBe(fingerprint(hostCheckMessage(rule, 93, true)!))
        expect(fingerprint(hostCheckMessage(rule, 81, true)!)).toBe(fingerprint('JSON threshold exceeded: old format'))
        expect(fingerprint('Host telemetry is stale.')).not.toBe(fingerprint(hostCheckMessage(rule, 81, true)!))
    })
}
for (const [path, name, unit] of [['temperatures', 'Temperature', '°C'], ['power', 'Power usage', ' W']]) {
    test(`${name} describes distance from the sensor alert limit`, () => {
        const rule: JsonRule = { path: `host.${path}.*.margin`, operator: 'lt', aggregate: 'min', value: 0 }
        expect(hostCheckMessage(rule, 12, false)).toBe(`${name} is normal: 12${unit} below the alert limit.`)
        expect(hostCheckMessage(rule, -2.5, true)).toBe(`${name} is high: 2.5${unit} above the alert limit.`)
        expect(hostCheckMessage(rule, -0.001, true)).toContain(`0.001${unit} above`)
        expect(hostCheckMessage(rule, 0, false)).toBe(`${name} is normal: at the alert limit.`)
        expect(hostCheckMessage(rule, null, false)).toBeNull()
        expect(hostCheckMessage({ ...rule, value: 5 }, 12, false)).toBeNull()
    })
}
