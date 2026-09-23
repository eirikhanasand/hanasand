import { expect, mock, test } from 'bun:test'
mock.module('#db', () => ({ default: async () => ({ rows: [] }) }))
const { scanRulePreview, validPreviewWindow } = await import('../src/utils/mill/rulePreview.ts')
const input = { from: '2026-09-01T00:00:00Z', until: '2026-09-02T00:00:00Z', action: 'drop' as const, conditions: [{ path: 'http.status_code', operator: 'equals' as const, value: '200' }] }
const row = (id: number, severity = 'low', status = 200) => ({ id: String(id), timestamp: '2026-09-01 12:00:00.123456+00', normalized: { severity, http: { status_code: status }, service: `service-${id % 7}`, message: 'x'.repeat(1000) } })
test('preview uses runtime selectors and excludes higher and unknown severities for Drop', async () => {
    const query = async (sql: string, params: unknown[]) => {
        expect(sql).toContain("organization_id=$1 AND ($2::boolean OR ingestion_id <> 'logs')")
        expect(sql).toContain('received_at <= $3::timestamptz')
        expect(params).toEqual(['org-a', false, input.until, input.from, null, ''])
        return { rows: [row(1), row(2, 'high'), row(3, 'unknown'), row(4, 'low', 404)] }
    }
    const page = await scanRulePreview('org-a', false, input, query as any)
    expect(page.count).toBe(1)
    expect(page.events.map(event => event.id)).toEqual(['1'])
    expect(page.events[0].normalized.message).toHaveLength(500)
    expect(page.cursor).toBeNull()
})
test('complete count is independent of bounded random sample; cursors preserve microseconds', async () => {
    const query = async () => ({ rows: Array.from({ length: 2000 }, (_, index) => row(index)) })
    const page = await scanRulePreview('org-a', true, { ...input, sample: true }, query as any)
    expect(page.count).toBe(2000)
    expect(page.events).toHaveLength(100)
    expect(page.events.map(event => event.rank)).toEqual(page.events.map(event => event.rank).sort((a, b) => a - b))
    expect(page.cursor).toEqual({ time: '2026-09-01 12:00:00.123456+00', id: '1999' })
    let params: unknown[] = []
    await scanRulePreview('org-a', true, { ...input, cursor: page.cursor }, (async (_sql: string, p: unknown[]) => { params = p; return { rows: [] } }) as any)
    expect(params.slice(-2)).toEqual([page.cursor?.time, '1999'])
})
test('preview preserves JavaScript regex and contains semantics and Store can match high events', async () => {
    const query = async () => ({ rows: [row(1, 'high'), row(2, 'medium', 404)] })
    for (const condition of [{ path: 'service', operator: 'contains' as const, value: 'SERVICE' }, { path: 'http.status_code', operator: 'regex' as const, value: '^(?=200)\\d{3}$' }]) {
        const page = await scanRulePreview('org-a', true, { ...input, action: 'keep', conditions: [condition] }, query as any)
        expect(page.count).toBe(condition.operator === 'contains' ? 2 : 1)
    }
})
test('invalid and forged preview windows are rejected', () => {
    expect(validPreviewWindow(input)).toBe(true)
    for (const change of [{ until: 'invalid' }, { until: '2099-01-01' }, { from: '2026-09-03' }, { cursor: { time: input.until, id: '' } }, { action: 'delete' }]) expect(validPreviewWindow({ ...input, ...change })).toBe(false)
})

test('pathological regex is terminated without blocking the API event loop', async () => {
    let responsive = false
    const timer = setTimeout(() => { responsive = true }, 25)
    await expect(scanRulePreview('org-a', true, { ...input, action: 'keep', conditions: [{ path: 'message', operator: 'regex', value: '^(a+)+$' }] }, (async () => ({ rows: Array.from({ length: 20 }, (_, index) => ({ ...row(index), normalized: { message: 'a'.repeat(100) + '!' } })) })) as any)).rejects.toThrow('takes too long')
    clearTimeout(timer)
    expect(responsive).toBe(true)
})


test('Drop preview excludes explicit suspicious evidence even on Low HTTP 200 events', async () => {
    const base = row(1)
    const suspicious = [
        { detections: [{ rule_id: 'attack' }] }, { signature: 'attack' }, { outcome: 'failure' },
        { metadata: { error: 'permission denied' } },
        { metadata: { structured: { access: { inspection: { bodyEmpty: true, headersSafe: false, pathSafe: true } } } } },
        { metadata: { request: { body: 'payload' } } },
    ].map((patch, index) => ({ ...row(index + 2), normalized: { ...base.normalized, ...patch } }))
    const query = async () => ({ rows: [base, ...suspicious] })
    const drop = await scanRulePreview('org-a', true, input, query as any)
    expect(drop.count).toBe(1)
    expect(drop.events.map(event => event.id)).toEqual(['1'])
    expect((await scanRulePreview('org-a', true, { ...input, action: 'keep' }, query as any)).count).toBe(7)
})
