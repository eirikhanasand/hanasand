import { expect, mock, test } from 'bun:test'
mock.module('#constants', () => ({ default: {} }))
mock.module('#db', () => ({ default: async () => { throw new Error('Unexpected database access') }, withTransaction: async (fn: Function) => fn() }))
const { default: recordLog } = await import('../src/utils/logs/recordLog.ts')
const { mongoDefinition, mongoRuleId, mongoReconDefinition } = await import('../src/utils/mill/analyzeMongo.ts')
const { normalizeBuiltinDefinition, collectMillEventFindings, normalizeMillEvent } = await import('../src/handlers/mill.ts')
const log = { service: 'mongodb', host: 'inspur/cashflow', level: 'info' as const, sourceEventId: 'mongo:test', message: JSON.stringify({ t: { $date: '2026-09-21T14:00:00Z' }, s: 'I', c: 'COMMAND', id: 51803, ctx: 'conn123', msg: 'Slow query', attr: { type: 'command', command: { ping: 1, $db: 'admin' }, remote: '127.0.0.1:123', durationMillis: 0, reslen: 17 } }) }


test('ingestion drops with a receipt only when the platform rule is active', async () => {
    for (const active of [false, true]) {
        const statements: string[] = []
        const query: any = async (sql: string, params: unknown[]) => {
            statements.push(sql)
            if (sql.includes("r.source='owned'")) {
                expect(params[0]).toBeNull()
                return { rows: [] }
            }
            if (sql.includes('FROM mill_rules')) {
                expect(params[1]).toBe(mongoRuleId)
                expect(sql).toContain("r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'")
                return { rows: active ? [{ organization_id: 'platform', version: '1' }] : [] }
            }
            return { rows: [], rowCount: 1 }
        }
        await recordLog(log, query)
        expect(statements.some(sql => sql.includes('INSERT INTO service_logs'))).toBe(!active)
        expect(statements.some(sql => sql.includes('INSERT INTO log_analyze_receipts'))).toBe(active)
        expect(statements.some(sql => sql.includes('INSERT INTO log_mongo_ping_counts'))).toBe(active)
    }
})
test('receipt failures propagate so the collector cannot acknowledge a lost event', async () => {
    const query: any = async (sql: string) => {
        if (sql.includes('FROM mill_rules')) return { rows: [{ organization_id: 'platform', version: '1' }] }
        throw new Error('receipt unavailable')
    }
    await expect(recordLog(log, query)).rejects.toThrow('receipt unavailable')
})
test('rule supports Keep without editable safety selectors', () => {
    expect(normalizeBuiltinDefinition(mongoRuleId, mongoDefinition).definition).toEqual(mongoDefinition)
    expect(normalizeBuiltinDefinition(mongoRuleId, { ...mongoDefinition, action: 'keep' }).definition?.action).toBe('keep')
    expect(normalizeBuiltinDefinition(mongoRuleId, { ...mongoDefinition, conditions: [{ path: 'host', operator: 'contains', value: '*' }] }).error).toBeTruthy()
})

test('retained enumeration reaches the real detection engine, unlike a ping', async () => {
    const { normalizeLogEvent } = await import('../src/utils/mill/logEvent.ts')
    const rule: any = { id: 'database.mongodb_enumeration.v1', version: '1', name: 'MongoDB enumeration', severity: 'high', family: 'Database', explanation: 'Enumeration', evidence: [], enabled: true, source: 'owned', definition: mongoReconDefinition }
    for (const name of ['ping', 'listDatabases', 'listCollections', 'find']) {
        const raw = JSON.parse(log.message)
        raw.attr.command = { [name]: 1, $db: 'admin' }
        const event = normalizeMillEvent(normalizeLogEvent({ ...log, message: JSON.stringify(raw), id: 1, created_at: raw.t.$date }), {})
        const result = collectMillEventFindings('platform', 'event', event, [rule])
        expect(result.findings.length).toBe(['listDatabases', 'listCollections'].includes(name) ? 1 : 0)
    }
})
test('replayed ping receipts do not inflate retained metadata counts', async () => {
    const statements: string[] = []
    const query: any = async (sql: string) => {
        statements.push(sql)
        return sql.includes('FROM mill_rules') ? { rows: [{ organization_id: 'platform', version: '1' }] } : { rows: [], rowCount: 0 }
    }
    await recordLog(log, query)
    expect(statements.some(sql => sql.includes('INSERT INTO log_mongo_ping_counts'))).toBe(false)
    expect(statements.some(sql => sql.includes('INSERT INTO service_logs'))).toBe(false)
})
