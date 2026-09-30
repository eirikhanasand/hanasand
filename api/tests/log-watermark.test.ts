import { beforeEach, expect, mock, test } from 'bun:test'
let code: string | null = null, inTransaction = false, finished = false, statements: string[] = [], parameters: unknown[][] = []
mock.module('#db', () => ({ withTransaction: async (work: any) => {
    inTransaction = true
    try {
        return await work(async (sql: string, values: unknown[] = []) => {
            expect(inTransaction).toBe(true)
            statements.push(sql)
            parameters.push(values)
            if (code && sql.startsWith('SELECT pg_advisory_xact_lock')) throw Object.assign(new Error('Database query failed'), { code })
            return { rows: [{ last_id: '9007199254740993' }] }
        })
    } finally { inTransaction = false; finished = true }
} }))
const { stableLogWatermark } = await import('../src/utils/events/logWatermark.ts')
beforeEach(() => { code = null; inTransaction = false; finished = false; statements = []; parameters = [] })
test('reads an exact bigint watermark behind the matching transaction advisory barrier', async () => {
    expect(await stableLogWatermark('traffic_events')).toBe('9007199254740993')
    expect(statements).toEqual(['SET LOCAL lock_timeout = \'100ms\'', 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', 'SELECT COALESCE(MAX(id), 0)::text AS last_id FROM traffic_events'])
    expect(parameters[1]).toEqual(['logs:watermark:traffic_events'])
    expect(finished).toBe(true)
    expect(inTransaction).toBe(false)
})
test('busy writers are retried but unrelated database failures are surfaced', async () => {
    code = '55P03'
    expect(await stableLogWatermark('service_logs')).toBeNull()
    expect(statements).toHaveLength(2)
    code = '42P01'
    await expect(stableLogWatermark('service_logs')).rejects.toThrow('Database query failed')
})
