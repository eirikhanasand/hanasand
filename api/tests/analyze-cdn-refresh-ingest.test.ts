import { expect, mock, test } from 'bun:test'
mock.module('#constants', () => ({ default: {} }))
mock.module('#db', () => ({ default: async () => { throw new Error('unexpected database access') }, withTransaction: async (fn: Function) => fn() }))
const { analyzeCdnRefresh } = await import('../src/utils/mill/analyzeCdnRefreshLog.ts')
const { cdnRefreshRuleId, cdnRefreshDefinition } = await import('../src/utils/mill/analyzeCdnRefresh.ts')
const { fixture } = await import('./analyze-cdn-refresh.test.ts')
test('only enabled Drop rules admit receipts; suspicious or incomplete events never reach the database', async () => {
    for (const enabled of [false, true]) {
        const statements: string[] = []
        const query: any = async (sql: string, params: unknown[]) => {
            statements.push(sql)
            if (sql.includes('WHERE organization_id = $1') || sql.includes("r.source='owned'")) return { rows: [] }
            if (sql.includes('FROM mill_rules')) {
                expect(sql).toContain("r.enabled AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'")
                expect(params[1]).toBe(cdnRefreshRuleId)
                return { rows: enabled ? [{ organization_id: 'platform', version: '1', definition: cdnRefreshDefinition }] : [] }
            }
            return { rows: [], rowCount: 1 }
        }
        expect(await analyzeCdnRefresh(fixture(), query)).toBe(enabled)
        expect(statements.some(sql => sql.includes('INSERT INTO log_analyze_receipts'))).toBe(enabled)
    }
    let called = false
    const query: any = async () => { called = true; throw new Error('must not query') }
    expect(await analyzeCdnRefresh({ ...fixture(), message: 'unexpected suspicious text' }, query)).toBe(false)
    expect(called).toBe(false)
})
test('receipt failure prevents acknowledgement; replay uses stable idempotent receipt', async () => {
    const params: unknown[][] = []
    const query: any = async (sql: string, values: unknown[]) => {
        if (sql.includes('WHERE organization_id = $1') || sql.includes("r.source='owned'")) return { rows: [] }
        if (sql.includes('FROM mill_rules')) return { rows: [{ organization_id: 'platform', version: '1', definition: cdnRefreshDefinition }] }
        expect(sql).toContain('ON CONFLICT DO NOTHING')
        params.push(values)
        return { rows: [], rowCount: params.length === 1 ? 1 : 0 }
    }
    expect(await analyzeCdnRefresh(fixture(), query)).toBe(true)
    expect(await analyzeCdnRefresh(fixture(), query)).toBe(true)
    expect(params[0]).toEqual(params[1])
    const failing: any = async (sql: string) => {
        if (sql.includes('WHERE organization_id = $1') || sql.includes("r.source='owned'")) return { rows: [] }
        if (sql.includes('FROM mill_rules')) return { rows: [{ organization_id: 'platform', version: '1', definition: cdnRefreshDefinition }] }
        throw new Error('receipt failed')
    }
    await expect(analyzeCdnRefresh(fixture(), failing)).rejects.toThrow('receipt failed')
})
