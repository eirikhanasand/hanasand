import { expect, mock, test } from 'bun:test'
const cache = new Map<string, { payload: unknown, error: string | null }>()
const query = async (sql: string, values: unknown[] = []) => {
    if (sql.startsWith('SELECT payload')) return { rows: cache.has(String(values[0])) ? [cache.get(String(values[0]))] : [] }
    if (sql.startsWith('INSERT INTO monitoring_json_snapshots')) cache.set(String(values[0]), { payload: JSON.parse(String(values[1])), error: values[2] as string | null })
    return { rows: [] }
}
mock.module('../src/utils/db.ts', () => ({ default: query, withTransaction: async (work: (q: typeof query) => Promise<unknown>) => work(query) }))
let requests = 0
mock.module('../src/utils/publicMonitoringRequest.ts', () => ({
    monitoringUrl: (value: URL) => value, monitoringLookup: () => {}, resolveMonitoringAddresses: async () => [],
    publicMonitoringRequest: async () => { requests++; return { status: requests === 1 ? 503 : 200, body: '{"ok":true}' } },
}))
const { sharedJsonSnapshot } = await import('../src/utils/jsonMonitoring.ts')
test('JSON retries bypass failed snapshots but still share each attempt across checks', async () => {
    const source = { owner_id: 'owner', target_url: 'http://example.test/health', user_agent: null, follow_redirects: true, timeout_seconds: 5 }
    const first = await Promise.allSettled(Array.from({ length: 5 }, () => sharedJsonSnapshot(source)))
    expect(first.every(result => result.status === 'rejected')).toBe(true)
    expect(requests).toBe(1)
    const retried = await Promise.all(Array.from({ length: 5 }, () => sharedJsonSnapshot(source, 1)))
    for (const result of retried) expect(result.payload).toEqual({ ok: true })
    expect(requests).toBe(2)
    await sharedJsonSnapshot(source, 1)
    expect(requests).toBe(2)
})
