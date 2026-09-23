import { expect, test } from 'bun:test'
import { eligibleCustomDrop } from '../src/utils/mill/dropEligibility.ts'
import { eventProtectionDefinition, matchesEventProtection, normalizeEventProtection } from '../src/utils/mill/eventProtection.ts'
const allowed = (event: Record<string, unknown>) => eligibleCustomDrop(event) && !matchesEventProtection(event, eventProtectionDefinition.protection)
const base = { severity: 'low', http: { status_code: 200 } }
test('known security and failure evidence wins over Low status at every nested level', () => {
    expect(allowed(base)).toBe(true)
    const signals = [{ detections: [{ rule_id: 'attack' }] }, { signature_id: 42 }, { error: { message: 'failed' } }, { outcome: 'failure' },
        { success: false }, { ok: 0 }, { level: 50 }, { severity: 'high' }, { body: 'payload' }, { status_code: 500 },
        { inspection: { bodyEmpty: false, headersSafe: true, pathSafe: true } }, { inspection: {} }]
    for (const signal of signals) {
        expect(allowed({ ...base, ...signal })).toBe(false)
        expect(allowed({ ...base, metadata: { structured: signal } })).toBe(false)
    }
    expect(allowed({ ...base, metadata: { error: null, errors: [], detections: [], failed: false, ok: 1 } })).toBe(true)
    expect(allowed({ ...base, severity: 'unknown' })).toBe(false)
})
test('bounded traversal retains unexpectedly complex evidence', () => {
    const entries = Array.from({ length: 300 }, () => ({}))
    expect(allowed({ severity: 'low', entries })).toBe(false)
})

test('persisted protection criteria are editable and validated', () => {
    const policy = structuredClone(eventProtectionDefinition.protection)
    policy.checks = policy.checks.filter(check => !check.keys.includes('error'))
    expect(matchesEventProtection({ severity: 'low', error: 'failure' }, policy)).toBe(false)
    expect(matchesEventProtection({ severity: 'low', error: 'failure' }, eventProtectionDefinition.protection)).toBe(true)
    expect(normalizeEventProtection(policy).protection).toEqual(policy)
    for (const value of [null, { checks: [{}] }, { checks: [{ keys: ['level'], operator: 'numberAtLeast', value: '40' }] }, { checks: [{ keys: ['error'], operator: 'unknown' }] }]) expect(normalizeEventProtection(value).error).toBeTruthy()
    expect(eligibleCustomDrop({ severity: 'low', error: 'failure' })).toBe(true)
    expect(eligibleCustomDrop({ severity: 'high' })).toBe(false)
})
