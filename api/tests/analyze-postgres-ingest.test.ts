import { expect, mock, test } from 'bun:test'
mock.module('#constants', () => ({ default: {} }))
mock.module('#db', () => ({ default: async () => { throw new Error('Unexpected database access') }, withTransaction: async (fn: Function) => fn() }))
const { analyzePostgresBatch } = await import('../src/utils/mill/analyzePostgresBatch.ts')
const { postgresReceipt, postgresRuleId, postgresDefinition } = await import('../src/utils/mill/analyzePostgres.ts')
const { normalizeBuiltinDefinition } = await import('../src/handlers/mill.ts')
import { fixture } from './analyze-postgres.test.ts'

function database(options: { enabled?: boolean, existing?: boolean, fail?: string, customKeep?: boolean } = {}) {
    const receipts = new Set<string>(), summaries: any[] = []
    let recent: any[] = [], dropped = 0
    const query: any = async (sql: string, params: any[] = []) => {
        if (options.fail && sql.includes(options.fail)) throw new Error('write failed')
        if (sql.includes("r.source='owned'")) return { rows: options.customKeep ? [{ source: 'owned', enabled: true,
            definition: { stage: 'analyze', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: 'hanasand_database' }] } }] : [] }
        if (sql.includes('FROM mill_rules')) return { rows: options.enabled === false ? [] : [{ organization_id: 'platform', version: '1' }] }
        if (sql.startsWith('SELECT key')) return { rows: params[2].filter((key: string) => receipts.has(key)).map((key: string) => ({ key })) }
        if (sql.startsWith('SELECT recent')) return { rows: [{ recent }] }
        if (sql.startsWith('UPDATE log_postgres_session_state SET recent')) recent = JSON.parse(params[1])
        if (sql.startsWith('SELECT source_event_id')) return { rows: options.existing ? [{ source_event_id: 'old' }] : [] }
        if (sql.startsWith('INSERT INTO service_logs')) summaries.push(JSON.parse(params[0]))
        if (sql.startsWith('INSERT INTO log_analyze_receipts')) {
            const added = params[0].filter((key: string) => !receipts.has(key)); added.forEach((key: string) => receipts.add(key))
            return { rows: added.map((key: string) => ({ key })), rowCount: added.length }
        }
        if (sql.includes('dropped_records=dropped_records')) dropped += params[1]
        return { rows: [], rowCount: 1 }
    }
    return { query, receipts, summaries, get dropped() { return dropped } }
}

test('transactional batch stores full evidence, records hits once and handles split retries', async () => {
    const db = database(), rows = fixture()
    expect(await analyzePostgresBatch(rows, db.query)).toEqual([])
    expect(db.summaries[0].lifecycle_records).toEqual(rows)
    expect(db.dropped).toBe(3)
    expect(await analyzePostgresBatch(rows, db.query)).toEqual([])
    expect(await analyzePostgresBatch(rows.slice(0, 1), db.query)).toEqual([])
    expect(db.summaries).toHaveLength(1)
    expect(db.dropped).toBe(3)
    const changed = { ...rows[0], message: rows[0].message + ' suspicious' }
    expect(await analyzePostgresBatch([changed], db.query)).toEqual([changed])
})

test('disabled, incomplete, previously retained and failed sessions are not removed', async () => {
    const rows = fixture()
    expect(await analyzePostgresBatch(rows, database({ enabled: false }).query)).toEqual(rows)
    expect(await analyzePostgresBatch(rows, database({ existing: true }).query)).toEqual(rows)
    expect(await analyzePostgresBatch(rows, database({ customKeep: true }).query)).toEqual(rows)
    expect(await analyzePostgresBatch(rows.slice(1), database().query)).toEqual(rows.slice(1))
})

test('retain the entire batch when the rolling session count is abnormal', async () => {
    const db = database()
    const rows = Array.from({ length: 16 }, (_, index) => fixture(Date.now() - 55000 + index * 3000)
        .map(row => ({ ...row, sourceEventId: postgresReceipt(row), message: row.message.replace('[123]', `[${1000 + index}]`) }))).flat()
    expect(await analyzePostgresBatch(rows, db.query)).toEqual(rows)
    expect(db.summaries).toHaveLength(0)
})

test('retain abnormal rate including concurrent-instance state from previous batches', async () => {
    const db = database(), rows = fixture(Date.now() - 1500)
    expect(await analyzePostgresBatch(rows, db.query)).toEqual([])
    const burst = fixture(Date.now() - 500).map(row => ({ ...row, sourceEventId: postgresReceipt(row), message: row.message.replace('[123]', '[456]') }))
    expect(await analyzePostgresBatch(burst, db.query)).toEqual(burst)
    expect(db.summaries).toHaveLength(1)
})

test('summary and receipt failure must abort collector transaction', async () => {
    for (const fail of ['INSERT INTO service_logs', 'INSERT INTO log_analyze_receipts', 'dropped_records=dropped_records']) {
        await expect(analyzePostgresBatch(fixture(), database({ fail }).query)).rejects.toThrow('write failed')
    }
})

test('safety checks cannot be edited away and Keep remains available', () => {
    expect(normalizeBuiltinDefinition(postgresRuleId, postgresDefinition).definition).toEqual(postgresDefinition)
    expect(normalizeBuiltinDefinition(postgresRuleId, { ...postgresDefinition, action: 'keep' }).definition?.action).toBe('keep')
    expect(normalizeBuiltinDefinition(postgresRuleId, { ...postgresDefinition, conditions: [{ path: 'host', operator: 'contains', value: '*' }] }).error).toBeTruthy()
})
