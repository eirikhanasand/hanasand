import { describe, expect, test } from 'bun:test'
import { engineFor, growth } from './database-metrics.ts'

describe('database storage metrics', () => {
    test('waits for enough history before estimating growth', () => {
        const result = growth([], 1000, 100, 1)
        expect(result.daily).toBeNull()
        expect(result.days).toBeNull()
    })

    test('measures growth and avoids claiming a full date when storage grows', () => {
        const history = [{ at: 0, available: 1000, device: 1 }]
        const shrinking = growth(history, 86400, 500, 1)
        expect([shrinking.daily, shrinking.days]).toEqual([500, 1])

        const growing = growth(history, 86400, 1500, 1)
        expect(growing.daily).toBe(-500)
        expect(growing.days).toBeNull()
    })

    test('ignores stale, unrelated, and future disk samples', () => {
        for (const old of [
            { at: 0, available: 100, device: 1 },
            { at: 90000, available: 100, device: 2 },
            { at: 999999, available: 100, device: 1 },
        ]) {
            expect(growth([old], 100000, 90, 1).daily).toBeNull()
        }
    })

    test('detects a PostgreSQL container by its command when its image is unavailable', () => {
        const item = { Config: { Image: '29342cb52157' }, Path: 'docker-entrypoint.sh', Args: ['postgres', '-p', '18502'] }
        expect(engineFor(item)).toBe('PostgreSQL')
        item.Args = ['sleep', 'infinity']
        expect(engineFor(item)).toBeNull()
    })
})
