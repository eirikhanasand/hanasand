import { beforeEach, expect, mock, test } from 'bun:test'
let systemAdmin = false, member = true, audited: unknown[] = [], previewFailure: Error | null = null
const events = [
    { id: 'collected', organization_id: 'org-a', ingestion_id: 'logs', normalized: { message: 'private host command' }, event_timestamp: '2026-09-19T00:00:00Z', event_type: 'application', action: 'log', outcome: 'unknown' },
    { id: 'imported', organization_id: 'org-a', ingestion_id: 'event_import', normalized: { message: 'organization supplied event' }, event_timestamp: '2026-09-19T00:00:00Z', event_type: 'application', action: 'log', outcome: 'unknown', parser_version: 'mill.v1' },
]
const query = async (sql: string, p: any[] = []): Promise<any> => {
    if (sql.includes('JOIN organization_members')) return { rows: member && p[0] === 'org-a' ? [{ role: 'member' }] : [] }
    if (sql.includes('FROM rules')) return { rows: [] }
    if (sql.includes('FROM events')) {
        if (sql.includes('WHERE id = $1')) return { rows: events.filter(row => row.id === p[0] && row.organization_id === p[1]) }
        if (sql.includes('event_timestamp::text AS timestamp')) {
            if (previewFailure) throw previewFailure
            const visible = events.filter(row => row.organization_id === p[0] && (!sql.includes("ingestion_id <> 'logs'") || row.ingestion_id !== 'logs'))
            return { rows: visible.map(row => ({ ...row, timestamp: row.event_timestamp })) }
        }
        return { rows: events.filter(row => row.organization_id === p[0] && (!sql.includes("ingestion_id <> 'logs'") || row.ingestion_id !== 'logs')) }
    }
    throw new Error(sql)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'member' }) }))
mock.module('#utils/auth/hasRole.ts', () => ({ default: async (_req: any, _res: any, role: string) => { expect(role).toBe('system_admin'); return { valid: systemAdmin } } }))
mock.module('#utils/systemEvent.ts', () => ({ recordSystemEvent: async (_req: any, event: any) => { audited.push(event) } }))
const { postRulePreview, getEvents, postEventAction } = await import('../src/handlers/events.ts')
const request = (id = 'collected') => ({ query: { organizationId: 'org-a' }, params: { id }, headers: { id: 'member' }, body: { action: 'replay' } }) as any
const response = () => ({ statusCode: 200, headers: {} as Record<string, string>, status(code: number) { this.statusCode = code; return this }, header(name: string, value: string) { this.headers[name] = value; return this }, send(body: any) { return body } })
beforeEach(() => { systemAdmin = false; member = true; audited = []; previewFailure = null })
test('ordinary organization members can list imports but cannot read collected platform logs', async () => {
    const result = await getEvents(request(), response() as any)
    expect(result.events.map((row: any) => row.id)).toEqual(['imported'])
    expect(result.events[0].parser_version).toBe('event.v1')
    expect(JSON.stringify(result)).not.toContain('private host command')
    systemAdmin = true
    expect((await getEvents(request(), response() as any)).events).toHaveLength(2)
})
test('ordinary members cannot replay collected logs but retain imported-event replay', async () => {
    const denied = response()
    await postEventAction(request(), denied as any)
    expect(denied.statusCode).toBe(403)
    expect(audited).toHaveLength(0)
    expect((await postEventAction(request('imported'), response() as any)).replayed).toBe(true)
    expect(audited).toHaveLength(1)
    systemAdmin = true
    expect((await postEventAction(request(), response() as any)).replayed).toBe(true)
})
test('system administrators still require organization membership for the organization Event API', async () => {
    systemAdmin = true; member = false
    const denied = response()
    await getEvents(request(), denied as any)
    expect(denied.statusCode).toBe(403)
})


test('preview counts and samples preserve the same organization and collected-log permissions', async () => {
    const req = { ...request(), body: { from: null, until: '2026-09-20T00:00:00Z', action: 'keep', sample: true, conditions: [{ path: 'message', operator: 'contains', value: ' ' }] } }
    const result = await postRulePreview(req, response() as any)
    expect(result.count).toBe(1)
    expect(result.events.map((row: any) => row.id)).toEqual(['imported'])
    expect(JSON.stringify(result)).not.toContain('private host command')
    systemAdmin = true
    expect((await postRulePreview(req, response() as any)).count).toBe(2)
    member = false
    const denied = response()
    await postRulePreview(req, denied as any)
    expect(denied.statusCode).toBe(403)
})

test('preview database overloads return a retryable response instead of a generic server error', async () => {
    const req = { ...request(), body: { from: null, until: '2026-09-20T00:00:00Z', action: 'keep', conditions: [{ path: 'message', operator: 'contains', value: 'host' }] } }
    previewFailure = Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' })
    const timedOut = response()
    const timeoutBody = await postRulePreview(req, timedOut as any)
    expect(timedOut.statusCode).toBe(503)
    expect(timedOut.headers['Retry-After']).toBe('2')
    expect(timeoutBody.error).toContain('Narrow the time range')
    previewFailure = Object.assign(new Error('too many clients'), { code: '53300' })
    const overloaded = response()
    const busyBody = await postRulePreview(req, overloaded as any)
    expect(overloaded.statusCode).toBe(503)
    expect(overloaded.headers['Retry-After']).toBe('2')
    expect(busyBody.error).toContain('temporarily busy')
})
