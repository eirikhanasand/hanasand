import { expect, mock, test } from 'bun:test'

const statements: string[] = []
const query = async (sql: string) => {
    statements.push(sql)
    if (sql.includes('to_regclass')) return { rows: [{ present: true }] }
    if (sql.includes('FROM log_counts_state')) return { rows: [{ ready: true, version: '2' }] }
    return { rows: [] }
}
mock.module('#db', () => ({
    default: query,
    withTransaction: async (work: typeof query) => work(query),
}))

const { default: ensureLogCountsSchema } = await import('../src/utils/db/logCountsSchema.ts')

test('skips the dimensions lock when log counts schema is current', async () => {
    await ensureLogCountsSchema()

    expect(statements.some(sql => sql.includes('LOCK TABLE log_dimensions'))).toBe(false)
    expect(statements.some(sql => sql.includes('ANALYZE log_counts'))).toBe(false)
})
