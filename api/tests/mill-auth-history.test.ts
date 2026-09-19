import { beforeEach, expect, mock, test } from 'bun:test'
let findings: any[] = [], previous: any[] = []
const query = async (sql: string, p: any[] = []) => {
    if (sql.includes('FROM mill_events')) return { rows: previous }
    if (sql.includes('INSERT INTO mill_findings')) { findings.push({ id: p[3] }); return { rows: [] } }
    throw new Error(sql)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
const { createMillFindings, MILL_RULES, normalizeMillEvent, millDefaultDefinition } = await import('../src/handlers/mill.ts')
const rules = MILL_RULES.filter(rule => ['auth.new_country.v1', 'auth.new_device.v1'].includes(rule.id)).map(rule => ({ ...rule, source: 'hanasand' as const, definition: millDefaultDefinition(rule.id) }))
beforeEach(() => { findings = []; previous = [ { id: 'recent', outcome: 'success', source_country: 'US', normalized: { device: { id: 'two' } } }, { id: 'older', outcome: 'success', source_country: 'NO', normalized: { device: { id: 'one' } } } ] })
const event = (country: string, device: string) => normalizeMillEvent({ timestamp: '2026-09-19T00:00:00Z', event_type: 'authentication', action: 'login', outcome: 'success', user: { id: 'alice' }, source: { country }, device: { id: device } }, {})
test('returning to a known country and device does not create new-value findings', async () => {
    await createMillFindings('org-a', 'current', event('NO', 'one'), rules)
    expect(findings).toHaveLength(0)
})
test('unseen country and device produce both findings when known history exists', async () => {
    await createMillFindings('org-a', 'current', event('GB', 'three'), rules)
    expect(findings.map(row => row.id)).toEqual(['auth.new_country.v1', 'auth.new_device.v1'])
})
