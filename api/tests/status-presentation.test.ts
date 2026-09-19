import { expect, test } from 'bun:test'
import { compactStatus, searchHealth } from '../src/utils/status/presentation.ts'

test('dashboard bounds incident payload without losing any day link or detailed source evidence', () => {
    const incidents = Array.from({ length: 15000 }, (_, index) => ({ id: String(index), started_at: '2026-09-19', updates: [{ evidence: 'original'.repeat(100) }] }))
    const source = { history: [{ incident_ids: ['9999', '9998'], samples: 1440, healthy_samples: 1439, failed_samples: 1 }], incidents }
    const result = compactStatus(source)
    expect(result.incidents).toHaveLength(26)
    expect(result.history[0].incident_ids).toEqual(['9999'])
    expect(result.history[0].healthy_samples).toBe(1439)
    expect(result.incidents.find(row => row.id === '9999')).toBeDefined()
    expect(JSON.stringify(result).length).toBeLessThan(5000)
    expect(source.incidents[9999].updates[0].evidence).toContain('original')
})

test('search health agrees with latest evidence and cannot report a stale check healthy', () => {
    const now = Date.now()
    const check = { service: 'threat-intelligence', check_name: 'Public search', status: 'up', checked_at: new Date(now).toISOString(), latency_ms: 20, message: 'Search succeeded.' }
    expect(searchHealth({ checks: [check] }, now).ok).toBe(true)
    for (const status of ['down', 'degraded', 'unknown']) expect(searchHealth({ checks: [{ ...check, status }] }, now).ok).toBe(false)
    expect(searchHealth({ checks: [check] }, now + 300001)).toMatchObject({ ok: false, status: 'unknown', lastResult: 'up', checkedAt: check.checked_at })
    expect(searchHealth({ checks: [] }, now).ok).toBe(false)
})
