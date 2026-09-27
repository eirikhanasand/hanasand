import { describe, expect, test } from 'bun:test'
import { cpuPercent, limitedSensor, number, updateStatus } from './host-metrics.ts'

describe('host metrics helpers', () => {
    test('loads valid apt status and returns unknown for invalid or missing files', () => {
        expect(updateStatus('unused', () => '{"status":"pending","run_id":"test"}').run_id).toBe('test')
        for (const value of ['[]', 'invalid json']) expect(updateStatus('unused', () => value).status).toBe('unknown')
        expect(updateStatus('unused', () => { throw new Error('missing') }).status).toBe('unknown')
    })

    test('rounds alert limits down and reports the margin', () => {
        for (const [limit, expected] of [[83, 74], [94, 84], [300, 270], [250.5, 225]]) {
            expect(limitedSensor('GPU', expected + 0.1, limit, 'C').alertLimit).toBe(expected)
            expect(limitedSensor('GPU', expected + 0.1, limit, 'C').margin).toBeLessThan(0)
            expect(limitedSensor('GPU', expected, limit, 'C').margin).toBe(0)
        }
    })

    test('does not invent missing measurements or limits', () => {
        expect(limitedSensor('sensor', 45, null, 'C').margin).toBeNull()
        expect(number('N/A')).toBeNull()
        expect(number(null)).toBeNull()
    })

    test('calculates CPU utilization from interval deltas', () => {
        expect(cpuPercent([100, 20], [200, 40])).toBe(80)
        expect(cpuPercent([100, 20], [100, 20])).toBeNull()
    })
})
