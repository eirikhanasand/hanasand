import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { attempt, MIN_FREE, selectTable, THRESHOLD, timeoutMilliseconds, vacuumScript } from './database-shrink.ts'

const inventory = (extra = {}) => ({ database_bytes: THRESHOLD + 1, replica: false, busy: false,
    tables: [{ name: 'traffic_events', bytes: 100 }, { name: 'service_logs', bytes: 200 }], ...extra })

describe('bounded database shrink', () => {
    test('defers for replica, threshold, maintenance, disk headroom, cooldown, and table cooldown', () => {
        const now = 100000
        expect(selectTable(inventory({ database_bytes: THRESHOLD }), {}, now, MIN_FREE)).toEqual([null, 'below_threshold'])
        expect(selectTable(inventory({ replica: true }), {}, now, MIN_FREE)).toEqual([null, 'replica'])
        expect(selectTable(inventory({ busy: true }), {}, now, MIN_FREE)).toEqual([null, 'maintenance_busy'])
        expect(selectTable(inventory(), {}, now, MIN_FREE - 1)).toEqual([null, 'insufficient_headroom'])
        expect(selectTable(inventory(), { last_attempt: now - 1 }, now, MIN_FREE)).toEqual([null, 'cooldown'])
        expect(selectTable(inventory(), {}, now, MIN_FREE)).toEqual(['traffic_events', null])
        expect(selectTable(inventory(), { table_attempts: { traffic_events: now - 10 } }, now, MIN_FREE)).toEqual(['service_logs', null])
    })

    test('measures actual result, records cooldown, and dry-run does not mutate state', () => {
        const root = mkdtempSync(path.join(os.tmpdir(), 'db-shrink-'))
        try {
            const file = path.join(root, 'status.json')
            const outputs = [[inventory()], [inventory()], [{ database_bytes: 900, relation_bytes: 100 }, { database_bytes: 899, relation_bytes: 80 }]]
            const deps = { sql: (query: string) => outputs.shift()!, freeBytes: () => MIN_FREE, now: () => 100000 }
            expect(attempt(file, true, deps).status).toBe('eligible')
            expect(() => readFileSync(file)).toThrow()
            const result = attempt(file, false, deps)
            expect(result.status).toBe('reclaimed')
            expect(result.observed_relation_decrease_bytes).toBe(20)
            const saved = JSON.parse(readFileSync(file, 'utf8'))
            expect(saved.last_attempt).toBe(100000)
            expect(saved.table_attempts.traffic_events).toBe(100000)
        } finally { rmSync(root, { recursive: true, force: true }) }
    })

    test('failure records cooldown without claiming savings and SQL cannot select unregistered tables', () => {
        expect(timeoutMilliseconds(40)).toBe(40_000)
        const root = mkdtempSync(path.join(os.tmpdir(), 'db-shrink-'))
        try {
            const file = path.join(root, 'status.json')
            let calls = 0
            const failureDeps = { sql: (_query: string, _timeout?: number) => { if (calls++ === 0) return [inventory()]; throw new Error('psql failed') },
                freeBytes: () => MIN_FREE, now: () => 100000 }
            expect(() => attempt(file, false, failureDeps)).toThrow('psql failed')
            const state = JSON.parse(readFileSync(file, 'utf8'))
            expect(state.status).toBe('failed')
            expect(state.last_attempt).toBe(100000)
            expect(state.observed_relation_decrease_bytes).toBeUndefined()
        } finally { rmSync(root, { recursive: true, force: true }) }
        const sql = vacuumScript('traffic_events')
        expect(sql).toContain('TRUNCATE ON')
        expect(sql).toContain('pg_try_advisory_lock')
        expect(sql).toContain('event:live-service-logs')
        expect(sql).not.toContain('VACUUM FULL')
        expect(sql).not.toContain('DELETE FROM')
        expect(() => vacuumScript('users; DROP DATABASE hanasand')).toThrow('Only registered')
    })
})
