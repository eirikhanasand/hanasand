import { beforeEach, expect, mock, test } from 'bun:test'
let ready = false, locked = false, fail = false, complete = false
let queries: string[], cursor: string, lastError: string | null
const query = async (sql: string, params: any[] = []): Promise<any> => {
    queries.push(sql)
    if (sql.startsWith('SELECT last_event_id')) return { rows: locked ? [] : [{ ready, last_event_id: cursor, last_error: lastError }] }
    if (sql.includes('FROM mill_events WHERE id >')) return { rows: complete ? [] : [{ id: 'b', ingestion_id: 'logs', processing_status: 'processed' }] }
    if (sql.startsWith('INSERT INTO mill_log_dimensions') && fail) throw new Error('Projection write failed')
    if (sql.startsWith('UPDATE mill_log_dimensions_state SET last_event_id')) { cursor = params[0]; ready = params[1] }
    return { rows: [] }
}
mock.module('#db', () => ({ withTransaction: async (work: any) => work(query) }))
const { backfillLogDimensions, dimensionLogWhere, foldLogCounts } = await import('../src/utils/logs/dimensions.ts')
beforeEach(() => { ready = locked = fail = complete = false; queries = []; cursor = ''; lastError = null })
test('projection backfill is bounded, source-locked, and ready only after the final batch', async () => {
    expect(await backfillLogDimensions(1)).toEqual({ processed: 1, ready: false })
    expect(cursor).toBe('b')
    expect(queries.some(sql => sql.includes('LIMIT $2 FOR SHARE'))).toBe(true)
    expect(queries.some(sql => sql.includes('event_timestamp::text AS event_timestamp'))).toBe(true)
    complete = true
    expect(await backfillLogDimensions(1)).toEqual({ processed: 0, ready: true })
    expect(queries).toContain('ANALYZE mill_log_dimensions')
})
test('failed projection persistence leaves the checkpoint unchanged for retry', async () => {
    fail = true
    await expect(backfillLogDimensions(1)).rejects.toThrow('Projection write failed')
    expect(cursor).toBe('')
    expect(ready).toBe(false)
    expect(queries).toContain('UPDATE mill_log_dimensions_state SET last_error = $1 WHERE id = TRUE')
    fail = false
    await backfillLogDimensions(1)
    expect(cursor).toBe('b')
})
test('another backfill owner and completed initialization both avoid duplicate work', async () => {
    locked = true
    expect(await backfillLogDimensions()).toEqual({ processed: 0, ready: false })
    expect(queries).toHaveLength(1)
    locked = false; ready = true; queries = []
    expect(await backfillLogDimensions()).toEqual({ processed: 0, ready: true })
    expect(queries).toHaveLength(1)
})
test('only exact supported dimensions use the compact predicate', () => {
    const active = 'EXISTS (SELECT 1 FROM organizations o WHERE o.id = mill_events.organization_id AND o.status = \'active\')'
    expect(dimensionLogWhere(['ingestion_id = \'logs\'', 'processing_status = \'processed\'', 'normalized->>\'log_type\' = $1', 'normalized->>\'severity\' IN (\'high\', \'critical\')', 'normalized->>\'service\' = $2', active]))
        .toEqual(['log_type = $1', 'severity IN (\'high\', \'critical\')', 'service = $2', active])
    for (const predicate of ['normalized->>\'message\' = $1', 'strpos(lower(normalized::text), $1) > 0', 'user_id = $1', 'normalized->\'detections\' IS NOT NULL']) expect(dimensionLogWhere([predicate])).toBeNull()
})
test('one grouped scan yields exact severity totals, nullable dimensions and top services', () => {
    const result = foldLogCounts([{ severity: 'high', service: 'one', count: 3 }, { severity: 'low', service: 'one', count: 4 },
        { severity: 'high', service: 'two', count: 2 }, { severity: null, service: null, count: 1 }])
    expect(result.counts).toEqual([{ severity: 'high', count: 5 }, { severity: 'low', count: 4 }, { severity: null, count: 1 }])
    expect(result.services).toEqual([{ service: 'one', count: 7 }, { service: 'two', count: 2 }, { service: null, count: 1 }])
    expect(foldLogCounts(Array.from({ length: 12 }, (_, index) => ({ severity: 'low', service: String(index), count: index + 1 }))).services).toHaveLength(10)
})

test('every KQL field is either represented exactly or falls back to source events', async () => {
    const { compileLogQuery } = await import('../src/utils/logs/kql.ts')
    const supported = ['TimeGenerated', 'Severity', 'Service', 'LogType']
    for (const name of Object.keys(compileLogQuery('Logs').fields)) {
        const query = compileLogQuery(`Logs | where ${name} == ${name === 'TimeGenerated' ? 'ago(1h)' : '"fixture"'}`)
        expect(dimensionLogWhere(query.where) !== null).toBe(supported.includes(name))
    }
})

test('a successful ready check clears a stale connection failure without rebuilding counters', async () => {
    ready = true; lastError = 'timeout exceeded when trying to connect'
    expect(await backfillLogDimensions()).toEqual({ processed: 0, ready: true })
    expect(queries).toHaveLength(2)
    expect(queries[1]).toBe('UPDATE mill_log_dimensions_state SET last_error = NULL WHERE id = TRUE')
})
