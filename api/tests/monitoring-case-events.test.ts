import { expect, mock, test } from 'bun:test'
let queries: Array<[string, unknown[]]> = []
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string, values: unknown[]) => {
    queries.push([sql, values])
    return { rows: sql.includes('count(*)') ? [{ total: 3 }] : [1,2,3].map(id => ({ id: `run-${id}`, status: 'failed', error: 'ETIMEDOUT token=secret', duration_ms: id * 100, check_details: { endpoint: 'https://old.example/' } })) }
} }))
const { loadMonitoringCaseEvents, monitoringCheckDetails } = await import('../src/utils/monitoringCaseEvents.ts')
test('returns each linked run with original diagnostics and bounded pagination', async () => {
    queries = []
    const result = await loadMonitoringCaseEvents('12', 2, '2026-09-12T12:00:00Z')
    expect(result.eventTotal).toBe(3)
    expect(result.events.map(e => e.id)).toEqual(['run-1','run-2','run-3'])
    expect(result.events[0]).toMatchObject({ outcome: 'failure', durationMs: 100, details: { endpoint: 'https://old.example/' }, message: 'ETIMEDOUT token=[redacted]' })
    expect(queries[0][1]).toEqual(['12',100,'2026-09-12T12:00:00Z'])
    expect(queries[0][0]).toContain('WHERE issue_id = $1')
    expect(queries[0][0]).toContain('LIMIT 50')
})
test('check snapshots exclude URL credentials and arbitrary query secrets', () => {
    const details = monitoringCheckDetails({ target_url: 'https://user:password@example.com/check?key=hidden#secret', monitoring_type: 'fetch', timeout_seconds: 5, retry_count: 2 } as any)
    expect(details.endpoint).not.toContain('hidden')
    expect(details.endpoint).not.toContain('password')
    expect(details.endpoint).not.toContain('secret')
    expect(details).toMatchObject({ checkType: 'fetch', timeoutSeconds: 5, retryCount: 2 })
})
