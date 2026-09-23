import { expect, test } from 'bun:test'
import { eligibleCustomDrop } from '../src/utils/mill/dropEligibility.ts'
const base = { severity: 'low', http: { status_code: 200 } }
test('known security and failure evidence wins over Low status at every nested level', () => {
    expect(eligibleCustomDrop(base)).toBe(true)
    const signals = [{ detections: [{ rule_id: 'attack' }] }, { signature_id: 42 }, { error: { message: 'failed' } }, { outcome: 'failure' },
        { success: false }, { ok: 0 }, { level: 50 }, { severity: 'high' }, { body: 'payload' }, { status_code: 500 },
        { inspection: { bodyEmpty: false, headersSafe: true, pathSafe: true } }, { inspection: {} }]
    for (const signal of signals) {
        expect(eligibleCustomDrop({ ...base, ...signal })).toBe(false)
        expect(eligibleCustomDrop({ ...base, metadata: { structured: signal } })).toBe(false)
    }
    expect(eligibleCustomDrop({ ...base, metadata: { error: null, errors: [], detections: [], failed: false, ok: 1 } })).toBe(true)
    expect(eligibleCustomDrop({ ...base, severity: 'unknown' })).toBe(false)
})
test('bounded traversal retains unexpectedly complex evidence', () => {
    const entries = Array.from({ length: 300 }, () => ({}))
    expect(eligibleCustomDrop({ severity: 'low', entries })).toBe(false)
})
