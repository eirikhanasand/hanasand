import { beforeEach, expect, mock, test } from 'bun:test'
let reads = 0, writes: unknown[][] = [], failed = false
let rules: any[] = []
const query = async (sql: string, params: any[] = []): Promise<any> => {
    if (sql.includes('FROM mill_rules r')) {
        reads++
        if (failed) throw new Error('Rule lookup unavailable')
        return { rows: rules.filter(rule => rule.organizationId === (params[0] || 'platform')) }
    }
    if (sql.includes('INSERT INTO service_logs')) { writes.push(params); return { rows: [] } }
    throw new Error('Unexpected query')
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('../src/utils/mill/analyzeLog.ts', () => ({ analyzeMongoPing: async () => false, analyzeAccess: async () => false }))
const { default: recordLog, recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
const { customRetentionAction } = await import('../src/utils/mill/customRetention.ts')
const { eventProtectionDefinition } = await import('../src/utils/mill/eventProtection.ts')
const drop = { source: 'owned', enabled: true, organizationId: 'org-a', definition: { stage: 'analyze', action: 'drop', conditions: [{ path: 'event_type', operator: 'equals', value: 'application' }] } }
const entry = { service: 'example', level: 'info' as const, message: 'heartbeat', metadata: { organizationId: 'org-a' } }
beforeEach(() => { reads = 0; writes = []; failed = false; rules = [structuredClone(drop)] })
test('new matching service logs never reach storage; unmatched tenants and disabled rules retain logs', async () => {
    await recordLog(entry)
    expect(writes).toHaveLength(0)
    await recordLog({ ...entry, metadata: { organizationId: 'org-b' } })
    expect(writes).toHaveLength(1)
    rules[0].enabled = false
    await recordLog(entry)
    expect(writes).toHaveLength(2)
})
test('Store exceptions take precedence and a batch reads rules only once per tenant', async () => {
    rules.push({ ...drop, definition: { ...drop.definition, action: 'keep' } })
    await recordLogBatch([entry, entry, { ...entry, metadata: { organizationId: 'org-b' } }], query)
    expect(reads).toBe(2)
    expect(JSON.parse(writes[0][0] as string)).toHaveLength(3)
})
test('missing, malformed or non-analysis rules cannot drop events', () => {
    const event = { event_type: 'application' }
    for (const definition of [{ ...drop.definition, conditions: [] }, { ...drop.definition, stage: 'match' }, { ...drop.definition, action: 'invalid' }]) expect(customRetentionAction(event, [{ ...drop, definition }])).toBeUndefined()
    expect(customRetentionAction({ event_type: 'authentication' }, [drop])).toBeUndefined()
})
test('a failed lookup fails ingestion without acknowledging a lost log', async () => {
    failed = true
    await expect(recordLog(entry)).rejects.toThrow('Rule lookup unavailable')
    expect(writes).toHaveLength(0)
})

test('only explicitly Low events can be dropped, including older broad rules', () => {
    for (const severity of ['medium', 'high', 'critical', 'unknown', undefined, null]) expect(customRetentionAction({ event_type: 'application', severity }, [drop])).toBeUndefined()
    expect(customRetentionAction({ event_type: 'application', severity: 'low' }, [drop])).toBe('drop')
})

test('persisted protection Store rules can be disabled or edited and win over Drop rules', () => {
    const event = { event_type: 'application', severity: 'low', error: 'failure' }
    const protection = { source: 'hanasand', enabled: true, definition: structuredClone(eventProtectionDefinition) }
    expect(customRetentionAction(event, [drop, protection])).toBeUndefined()
    expect(customRetentionAction(event, [drop, { ...protection, enabled: false }])).toBe('drop')
    protection.definition.protection.checks = []
    expect(customRetentionAction(event, [drop, protection])).toBe('drop')
    protection.definition.protection = { checks: [{}] } as any
    expect(customRetentionAction(event, [drop, protection])).toBe('keep')
})

test('persisted scope preserves lossless compaction while all-scope Store takes priority', () => {
    const event = { event_type: 'application', severity: 'low', http: {}, body: 'canonical body retained' }
    const protection = { source: 'hanasand', enabled: true, definition: structuredClone(eventProtectionDefinition) }
    expect(customRetentionAction(event, [drop, protection])).toBeUndefined()
    const all = { ...protection, definition: { ...protection.definition, protection: { ...protection.definition.protection, appliesTo: 'all' as const } } }
    expect(customRetentionAction(event, [drop, all])).toBe('keep')
})
