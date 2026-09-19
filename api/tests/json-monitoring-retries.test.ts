import { beforeEach, expect, mock, test } from 'bun:test'
import type { AutomationRow } from '../src/utils/automations.ts'
const cache = new Map<string, { payload: unknown, error: string | null }>()
const query = async (sql: string, values: unknown[] = []) => {
    if (sql.startsWith('SELECT payload')) return { rows: cache.has(String(values[0])) ? [cache.get(String(values[0]))] : [] }
    if (sql.startsWith('INSERT INTO monitoring_json_snapshots')) cache.set(String(values[0]), { payload: JSON.parse(String(values[1])), error: values[2] as string | null })
    return { rows: [] }
}
mock.module('../src/utils/db.ts', () => ({ default: query, withTransaction: async (work: (q: typeof query) => Promise<unknown>) => work(query) }))
let requests = 0, responseStatus = 200, responseBody = '{"ok":true}', unreachable = true
mock.module('../src/utils/publicMonitoringRequest.ts', () => ({
    monitoringUrl: (value: URL) => value, monitoringLookup: () => {}, resolveMonitoringAddresses: async () => [],
    publicMonitoringRequest: async () => {
        requests++
        if (unreachable && requests === 1) throw new Error('Connection refused')
        return { status: responseStatus, body: responseBody }
    },
}))
const { sharedJsonSnapshot } = await import('../src/utils/jsonMonitoring.ts')
const { runMonitoringCheck } = await import('../src/utils/automations.ts')
beforeEach(() => { cache.clear(); requests = 0; responseStatus = 200; responseBody = '{"ok":true}'; unreachable = true })
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

for (const kind of ['http', 'invalid-json']) {
    test(`${kind} response remains terminal when loaded from the snapshot cache`, async () => {
        unreachable = false
        if (kind === 'http') responseStatus = 503
        else responseBody = 'invalid json'
        const source = { owner_id: 'owner', target_url: 'http://example.test/health', user_agent: null, follow_redirects: true, timeout_seconds: 5 }
        const { MonitoringResponseError } = await import('../src/utils/monitoringResponseError.ts')
        for (let i = 0; i < 2; i++) {
            await expect(runMonitoringCheck({ ...source, monitoring_type: 'json', retry_count: 4,
                json_rule: { path: 'ok', operator: 'eq', value: false, aggregate: 'first' },
            } as AutomationRow)).rejects.toBeInstanceOf(MonitoringResponseError)
        }
        expect(requests).toBe(1)
    })
}
