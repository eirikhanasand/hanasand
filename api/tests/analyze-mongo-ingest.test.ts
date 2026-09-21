import { expect, mock, test } from 'bun:test'
mock.module('#constants', () => ({ default: {} }))
mock.module('#db', () => ({ default: async () => { throw new Error('Unexpected database access') }, withTransaction: async (fn: Function) => fn() }))
const { default: recordLog } = await import('../src/utils/logs/recordLog.ts')
const { mongoDefinition, mongoRuleId } = await import('../src/utils/mill/analyzeMongo.ts')
const { normalizeBuiltinDefinition } = await import('../src/handlers/mill.ts')
const log = { service: 'mongodb', host: 'inspur/cashflow', level: 'info' as const, sourceEventId: 'mongo:test', message: JSON.stringify({ s: 'I', c: 'NETWORK', id: 22943, msg: 'Connection accepted', attr: { remote: '127.0.0.1:123' } }) }

test('ingestion drops with a receipt only when the platform rule is active', async () => {
    for (const active of [false, true]) {
        const statements: string[] = []
        const query: any = async (sql: string, params: unknown[]) => {
            statements.push(sql)
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
