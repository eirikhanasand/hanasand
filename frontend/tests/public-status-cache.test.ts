import { expect, mock, test } from 'bun:test'

let now = Date.now()
const required = [['core', 'API health'], ['website', 'Public website'], ['threat-intelligence', 'Public search'], ['threat-intelligence', 'Processing backlog'], ['threat-intelligence', 'Source collection'], ['browser-sandbox', 'Browser workspace'], ['dark-web-monitoring', 'Monitoring workspace'], ['dark-web-monitoring', 'Latest activity']]
let release: (() => void) | undefined
let delayed = false
mock.module('../src/utils/status/getStatus', () => ({ default: async () => {
    if (delayed) await new Promise<void>(resolve => { release = resolve })
    return { overall: 'up', monitoring: 'live', generated_at: new Date(now).toISOString(), history_available: true, history_generated_at: new Date(now).toISOString(), history: [], incidents: [],
        checks: required.map(([service, check_name]) => ({ service, check_name, status: 'up', checked_at: new Date(now).toISOString(), message: 'OK', latency_ms: 1, uptime_30d: '100' })) }
} }))
const { default: getPublicStatus } = await import('../src/utils/status/getPublicStatus')

test('fresh cache remains immediate but an idle cache waits for fresh evidence', async () => {
    const realNow = Date.now
    Date.now = () => now
    try {
        await getPublicStatus({ dashboard: true })
        now += 4000
        delayed = true
        const fresh = await getPublicStatus({ dashboard: true })
        expect(Date.parse(fresh.last_verified_at!)).toBe(now - 4000)
        release!()
        await Bun.sleep(1)
        now += 16 * 60_000
        let completed = false
        const expired = getPublicStatus({ dashboard: true }).then(value => { completed = true; return value })
        await Bun.sleep(1)
        expect(completed).toBe(false)
        release!()
        const result = await expired
        expect(result.last_verified_at).toBe(new Date(now).toISOString())
        expect(result.history_generated_at).toBe(new Date(now).toISOString())
    } finally { Date.now = realNow }
})
