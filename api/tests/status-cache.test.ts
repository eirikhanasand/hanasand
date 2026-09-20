import { expect, mock, test } from 'bun:test'

let now = Date.now()
let failHistory = false
let releaseHistory: (() => void) | undefined
let delayHistory = true
let reads = 0
const check = () => ({ service: 'core', check_name: 'API health', status: 'up', latency_ms: 1, message: 'OK', checked_at: new Date(now).toISOString(), uptime_30d: '100' })
const saved = () => ({ overall: 'up', monitoring: 'live', generated_at: new Date(now).toISOString(), checks: [check()], history: [], incidents: [] })
mock.module('#db', () => ({
    default: async (sql: string) => {
        if (sql.startsWith('CREATE TABLE')) return { rows: [] }
        if (sql.startsWith('SELECT payload, updated_at')) {
            reads++
            if (delayHistory) await new Promise<void>(resolve => { releaseHistory = resolve })
            if (failHistory) throw new Error('temporary read failure')
            return { rows: [{ payload: saved(), updated_at: new Date(now).toISOString() }] }
        }
        return { rows: [check()] }
    },
    withTransaction: async () => { throw new Error('Fresh saved history must not be rebuilt') },
}))
const { default: getStatus } = await import('../src/handlers/status/get.ts')
async function request() {
    let payload: any
    const reply: any = { header() { return this }, type() { return this }, send(value: any) { payload = typeof value === 'string' ? JSON.parse(value) : value; return this } }
    await getStatus({ query: { dashboard: 'true' } } as any, reply)
    return payload
}

test('cold and idle replicas await saved history, preserve evidence on failure, and retry promptly', async () => {
    const realNow = Date.now
    Date.now = () => now
    const originalError = console.error
    console.error = () => {}
    try {
        let completed = false
        const cold = request().then(value => { completed = true; return value })
        await Bun.sleep(5)
        expect(completed).toBe(false)
        releaseHistory!()
        expect(await cold).toMatchObject({ history_available: true, history_generated_at: new Date(now).toISOString() })
        delayHistory = false
        now += 6 * 60_000
        failHistory = true
        const failed = await request()
        expect(failed.history_available).toBe(true)
        expect(failed.checks[0].checked_at).toBe(new Date(now).toISOString())
        expect(Date.parse(failed.history_generated_at)).toBeLessThan(now)
        failHistory = false
        now += 16_000
        expect(await request()).toMatchObject({ history_generated_at: new Date(now).toISOString() })
        expect(reads).toBe(3)
    } finally {
        Date.now = realNow
        console.error = originalError
    }
})
