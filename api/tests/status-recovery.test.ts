import { expect, mock, test } from 'bun:test'
const at = new Date(Date.now() - 20 * 60_000).toISOString()
const check = { service: 'core', check_name: 'API health', status: 'up', latency_ms: 1, message: 'OK', checked_at: at, uptime_30d: '100' }
const queries: string[] = []
let rebuilds = 0
mock.module('#db', () => ({
    default: async (sql: string) => {
        queries.push(sql)
        if (sql.startsWith('SELECT payload, updated_at')) return { rows: [{ updated_at: at, payload: { overall: 'up', monitoring: 'live', generated_at: at, checks: [check], history: [], incidents: [] } }] }
        return { rows: [check] }
    },
    withTransaction: async () => { rebuilds++ },
}))
const { default: getStatus } = await import('../src/handlers/status/get.ts')

test('restricted recovery serves saved timestamps without schema writes or history scans', async () => {
    const previous = process.env.RECOVERY_ESSENTIAL_ONLY
    process.env.RECOVERY_ESSENTIAL_ONLY = '1'
    try {
        let payload: any
        const reply: any = { header() { return this }, type() { return this }, send(value: string) { payload = JSON.parse(value); return this } }
        await getStatus({ query: { dashboard: 'true' } } as any, reply)
        expect(payload.history_available).toBe(true)
        expect(payload.history_generated_at).toBe(at)
        expect(queries.some(sql => /CREATE|INSERT|UPDATE|service_monitor_results/.test(sql))).toBe(false)
        expect(rebuilds).toBe(0)
    } finally {
        if (previous === undefined) delete process.env.RECOVERY_ESSENTIAL_ONLY
        else process.env.RECOVERY_ESSENTIAL_ONLY = previous
    }
})
