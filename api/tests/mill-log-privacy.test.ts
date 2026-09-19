import { beforeEach, expect, mock, test } from 'bun:test'
let systemAdmin = false, member = true, audited: unknown[] = []
const events = [
    { id: 'collected', organization_id: 'org-a', ingestion_id: 'logs', normalized: { message: 'private host command' }, event_timestamp: '2026-09-19T00:00:00Z', event_type: 'application', action: 'log', outcome: 'unknown' },
    { id: 'imported', organization_id: 'org-a', ingestion_id: 'mill_import', normalized: { message: 'organization supplied event' }, event_timestamp: '2026-09-19T00:00:00Z', event_type: 'application', action: 'log', outcome: 'unknown' },
]
const query = async (sql: string, p: any[] = []): Promise<any> => {
    if (sql.includes('JOIN organization_members')) return { rows: member && p[0] === 'org-a' ? [{ role: 'member' }] : [] }
    if (sql.includes('FROM mill_rules')) return { rows: [] }
    if (sql.includes('FROM mill_events')) {
        if (sql.includes('WHERE id = $1')) return { rows: events.filter(row => row.id === p[0] && row.organization_id === p[1]) }
        expect(sql).toContain("($3::boolean OR ingestion_id <> 'logs')")
        return { rows: events.filter(row => row.organization_id === p[0] && (p[2] || row.ingestion_id !== 'logs')) }
    }
    throw new Error(sql)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'member' }) }))
mock.module('#utils/auth/hasRole.ts', () => ({ default: async (_req: any, _res: any, role: string) => { expect(role).toBe('system_admin'); return { valid: systemAdmin } } }))
mock.module('#utils/systemEvent.ts', () => ({ recordSystemEvent: async (_req: any, event: any) => { audited.push(event) } }))
const { getMillEvents, postMillEventAction } = await import('../src/handlers/mill.ts')
const request = (id = 'collected') => ({ query: { organizationId: 'org-a' }, params: { id }, headers: { id: 'member' }, body: { action: 'replay' } }) as any
const response = () => ({ statusCode: 200, status(code: number) { this.statusCode = code; return this }, send(body: any) { return body } })
beforeEach(() => { systemAdmin = false; member = true; audited = [] })
test('ordinary organization members can list imports but cannot read collected platform logs', async () => {
    const result = await getMillEvents(request(), response() as any)
    expect(result.events.map((row: any) => row.id)).toEqual(['imported'])
    expect(JSON.stringify(result)).not.toContain('private host command')
    systemAdmin = true
    expect((await getMillEvents(request(), response() as any)).events).toHaveLength(2)
})
test('ordinary members cannot replay collected logs but retain imported-event replay', async () => {
    const denied = response()
    await postMillEventAction(request(), denied as any)
    expect(denied.statusCode).toBe(403)
    expect(audited).toHaveLength(0)
    expect((await postMillEventAction(request('imported'), response() as any)).replayed).toBe(true)
    expect(audited).toHaveLength(1)
    systemAdmin = true
    expect((await postMillEventAction(request(), response() as any)).replayed).toBe(true)
})
test('system administrators still require organization membership for the organization Mill API', async () => {
    systemAdmin = true; member = false
    const denied = response()
    await getMillEvents(request(), denied as any)
    expect(denied.statusCode).toBe(403)
})
