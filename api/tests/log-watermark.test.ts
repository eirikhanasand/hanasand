import { beforeEach, expect, mock, test } from 'bun:test'
let code: string | null = null, inTransaction = false, finished = false, statements: string[] = []
mock.module('#db', () => ({ withTransaction: async (work: any) => {
    inTransaction = true
    try {
        return await work(async (sql: string) => {
            expect(inTransaction).toBe(true)
            statements.push(sql)
            if (code) throw Object.assign(new Error('Database query failed'), { code })
            return { rows: [{ last_id: '9007199254740993' }] }
        })
    } finally { inTransaction = false; finished = true }
} }))
const { stableLogWatermark } = await import('../src/utils/mill/logWatermark.ts')
beforeEach(() => { code = null; inTransaction = false; finished = false; statements = [] })
test('reads an exact bigint watermark under one short transaction and releases before returning', async () => {
    expect(await stableLogWatermark('traffic_events')).toBe('9007199254740993')
    expect(statements).toEqual(['LOCK TABLE traffic_events IN SHARE MODE NOWAIT', 'SELECT COALESCE(MAX(id), 0)::text AS last_id FROM traffic_events'])
    expect(finished).toBe(true)
    expect(inTransaction).toBe(false)
})
test('busy writers are retried but unrelated database failures are surfaced', async () => {
    code = '55P03'
    expect(await stableLogWatermark('service_logs')).toBeNull()
    expect(statements).toHaveLength(1)
    code = '42P01'
    await expect(stableLogWatermark('service_logs')).rejects.toThrow('Database query failed')
})
