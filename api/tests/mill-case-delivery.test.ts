import { beforeEach, expect, mock, test } from 'bun:test'

const findings: any[] = [], events: any[] = []
let failFinding = false
beforeEach(() => { findings.length = 0; events.length = 0; failFinding = false })
mock.module('#utils/auth/apiKeys.ts', () => ({ validateApiKey: async () => ({ organizationId: 'org-a', apiKey: { scopes: [] } }), matchApiKeyScope: () => true }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'analyst' }) }))
mock.module('#db', () => ({ withTransaction: async () => { throw new Error('Ingestion must not edit rules') }, default: async (sql: string, p: any[] = []) => {
    if (sql.includes('FROM mill_rules')) return { rows: [] }
    if (sql.includes('INSERT INTO mill_events')) { expect(sql).toContain("'pending'"); events.push({ processing_status: 'pending', id: p[0], organization_id: p[2], source_vendor: p[3], source_product: p[4], event_timestamp: p[5], event_type: p[6], action: p[7], outcome: p[8], normalized: JSON.parse(p[15]) }); return { rows: [] } }
    if (sql.includes('INSERT INTO mill_findings')) {
        if (failFinding) throw new Error('Finding persistence unavailable')
        if (!findings.some(row => row.finding_key === p[2])) findings.push({ id: p[0], organization_id: p[1], finding_key: p[2], rule_id: p[3], severity: p[4], status: 'new', summary: p[5], evidence: JSON.parse(p[6]), event_ids: p[7], first_observed: new Date().toISOString(), last_observed: new Date().toISOString() })
        return { rows: [] }
    }
    if (sql.includes("UPDATE mill_events SET processing_status = 'processed'")) {
        const event = events.find(row => row.id === p[0] && row.organization_id === p[1])
        expect(event).toBeDefined()
        expect(findings.some(row => row.event_ids.includes(event.id))).toBe(true)
        event.processing_status = 'processed'
        return { rows: [] }
    }
    if (sql.includes('SET case_delivery_attempted_at')) return { rows: findings.filter(row => !row.case_id && row.rule_id !== 'scanner.hanasand_validation.v1') }
    if (sql.includes('FROM mill_events') && sql.includes('ANY')) {
        expect(p[0]).toBe('org-a')
        return { rows: events.filter(row => row.organization_id === p[0] && p[1].includes(row.id)) }
    }
    if (sql.includes('SET case_id')) { findings.find(row => row.id === p[0]).case_id = p[1]; return { rows: [] } }
    throw new Error(`Unexpected query: ${sql}`)
} }))

test('real detector queues a case, preserves logs and retries a failed delivery without acknowledging it', async () => {
    const { ingestMill } = await import('../src/handlers/mill.ts')
    const { deliverMillCases } = await import('../src/utils/millCases.ts')
    const response = { statusCode: 200, status(n: number) { this.statusCode = n; return this }, send(body: any) { return body } }
    const result = await ingestMill({ headers: { authorization: 'Bearer test-key' }, body: { source: { vendor: 'Example sensor', product: 'network' }, events: [{ timestamp: '2026-09-14T12:00:00Z', event_type: 'network', action: 'alert', signature: 'Suspicious connection', password: 'never-display-this', source_ip: '203.0.113.10' }] } } as any, response as any)
    expect(result.accepted_events).toBe(1)
    expect(findings).toHaveLength(1)
    expect(events[0].processing_status).toBe('processed')
    const previousBase = process.env.TI_SCRAPER_API_BASE
    const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
    process.env.TI_SCRAPER_API_BASE = 'http://case-test.invalid'
    process.env.TI_SCRAPER_SERVICE_TOKEN = 'test-service-token'
    const originalFetch = globalThis.fetch
    let calls = 0
    try {
        globalThis.fetch = mock(async (_url: any, init: any) => {
            calls++
            const body = JSON.parse(init.body)
            expect(body.organizationId).toBe('org-a')
            expect(body.events).toHaveLength(1)
            expect(body.events[0].message).toContain('Suspicious connection')
            expect(body.events[0].message).not.toContain('never-display-this')
            return calls === 1 ? new Response('{}', { status: 503 }) : Response.json({ case: { id: 'case-persisted' } })
        }) as any
        await expect(deliverMillCases()).rejects.toThrow('queued for retry')
        expect(findings[0].case_id).toBeUndefined()
        expect(await deliverMillCases()).toEqual({ delivered: 1 })
        expect(findings[0].case_id).toBe('case-persisted')
        expect(await deliverMillCases()).toEqual({ delivered: 0 })
        expect(calls).toBe(2)
    } finally { globalThis.fetch = originalFetch; if (previousBase === undefined) delete process.env.TI_SCRAPER_API_BASE; else process.env.TI_SCRAPER_API_BASE = previousBase; if (previousToken === undefined) delete process.env.TI_SCRAPER_SERVICE_TOKEN; else process.env.TI_SCRAPER_SERVICE_TOKEN = previousToken }
})

test('a finding persistence failure keeps the ingested event pending for worker retry', async () => {
    const { ingestMill } = await import('../src/handlers/mill.ts')
    failFinding = true
    const response = { status() { return this }, send(body: any) { return body } }
    await expect(ingestMill({ headers: { authorization: 'Bearer test-key' }, body: { events: [{ timestamp: '2026-09-19T12:00:00Z', event_type: 'network', action: 'alert', signature: 'Pending signature' }] } } as any, response as any)).rejects.toThrow('Finding persistence unavailable')
    expect(events).toHaveLength(1)
    expect(events[0].processing_status).toBe('pending')
    expect(findings).toHaveLength(0)
})
