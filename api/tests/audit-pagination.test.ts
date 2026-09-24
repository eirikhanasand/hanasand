import { beforeEach, expect, mock, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'

let administrator = true
let eventRows: Record<string, unknown>[] = []
const queries: Array<{ sql: string, values: unknown[] }> = []
async function run(sql: string, values: unknown[] = []) {
    if (sql.includes('FROM roles r')) return { rows: administrator ? [{ id: 'system_admin' }] : [] }
    queries.push({ sql, values })
    return { rows: sql.includes('AS total') ? [{ total: 125 }] : sql.includes('GROUP BY 1') ? [{ value: 'test', count: 12 }] : sql.includes('AS "Action"') ? [{ Action: 'restart', Description: 'matched' }] : eventRows }
}
mock.module('../src/utils/db.ts', () => ({ default: run, queryOnce: run, closeDatabase: async () => {} }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'test-admin' }) }))
const { getSystemEvents } = await import('../src/handlers/adminSupport.ts')
beforeEach(() => { administrator = true; eventRows = []; queries.length = 0 })
async function request(query: Record<string, string>) {
    const result = { statusCode: 200, body: undefined as any, header() { return this }, status(code: number) { this.statusCode = code; return this }, send(body: unknown) { this.body = body; return this } }
    await getSystemEvents({ query } as FastifyRequest, result as unknown as FastifyReply)
    return result
}
test('audit query validator accepts page and applies an offset after stable ordering', async () => {
    const response = await request({ page: '2', limit: '50', actor: 'operator' })
    expect(response.statusCode).toBe(200)
    expect(response.body.pagination.page).toBe(2)
    expect(queries[1].sql).toContain('ORDER BY e.created_at DESC, e.id DESC')
    expect(queries[1].sql).toContain('OFFSET')
    expect(queries[1].values.at(-1)).toBe(50)
    expect(queries[1].values).toContain('%operator%')
})
test('invalid pages and unsupported filters are rejected', async () => {
    expect((await request({ page: '0' })).statusCode).toBe(400)
    expect((await request({ page: '2', unsupported: 'value' })).statusCode).toBe(400)
    expect(queries).toHaveLength(0)
})
test('numbered audit pages remain administrator-only', async () => {
    administrator = false
    expect((await request({ page: '2' })).statusCode).toBe(403)
    expect(queries).toHaveLength(0)
})

test('cursor batches count all filtered events before applying the cursor', async () => {
    const cursor = encodeURIComponent(JSON.stringify({ createdAt: '2026-09-14T00:00:00Z', id: 75 }))
    const response = await request({ limit: '50', service: 'test', cursor })
    expect(response.body.pagination.total).toBe(125)
    expect(queries[0].sql).toContain('COUNT(*)')
    expect(queries[0].values).toEqual(['%test%'])
    expect(queries[0].sql).not.toContain('(e.created_at, e.id) <')
    expect(queries[1].sql).toContain('(e.created_at, e.id) <')
    expect(queries[1].values).toContain(75)
})

test('HQL shares KQL operators and binds values before existing audit filters', async () => {
    const response = await request({ hql: 'AuditEvents | where Result == "failed" and Description contains "x\' OR 1=1 --" | order by TimeGenerated asc | project Action, Description | take 25', service: 'test', q: 'needle' })
    expect(response.statusCode).toBe(200)
    expect(response.body.queryResult).toEqual({ columns: ['Action', 'Description'], rows: [['restart', 'matched']], limit: 25, summarized: false })
    expect(response.body.pagination).toEqual({ total: 125, nextCursor: null })
    expect(queries[0].values).toEqual(['failed', 'x\' OR 1=1 --', '%needle%', '%test%'])
    expect(queries[1].sql).toContain('ORDER BY e.created_at ASC, e.id DESC')
    expect(queries[1].sql).not.toContain('OR 1=1')
    expect(queries[1].sql).not.toContain('normalized')
    expect(queries[1].values.at(-1)).toBe(25)
})

test('HQL summarizes filtered matches and rejects unsupported syntax without querying data', async () => {
    const response = await request({ hql: 'AuditEvents | where TimeGenerated > ago(24h) | summarize count() by Service | take 10' })
    expect(response.body.queryResult).toEqual({ columns: ['Service', 'Count'], rows: [['test', 12]], limit: 10, summarized: true })
    expect(queries[1].sql).toContain('GROUP BY 1 ORDER BY count DESC')
    queries.length = 0
    for (const hql of ['AuditEvents | union Logs', 'AuditEvents | where constructor == 1', 'AuditEvents | take 10 | where Result == "failed"', 'AuditEvents | take 501']) {
        expect((await request({ hql })).statusCode).toBe(400)
    }
    expect((await request({ hql: 'AuditEvents', cursor: 'bad' })).statusCode).toBe(400)
    expect(queries).toHaveLength(0)
    administrator = false
    expect((await request({ hql: 'AuditEvents' })).statusCode).toBe(403)
})


test('timeline pages return only display rows; cursor batches skip counts and support reports', async () => {
    eventRows = [3, 2, 1].map(id => ({ id, created_at: '2026-09-20T00:00:00.000Z', event_type: 'read', reason: 'Displayed description' }))
    const first = await request({ format: 'timeline', limit: '2', outcome: 'failed' })
    expect(first.body.events).toEqual(eventRows.slice(0, 2))
    expect(first.body.detail).toBeUndefined()
    expect(first.body.pagination.total).toBe(125)
    expect(JSON.parse(decodeURIComponent(first.body.pagination.nextCursor))).toEqual({ createdAt: '2026-09-20T00:00:00.000Z', id: 2 })
    expect(queries[1].sql).not.toContain('e.context')
    expect(queries[1].sql).not.toContain('e.user_agent')
    queries.length = 0
    eventRows = [eventRows[2]]
    const next = await request({ format: 'timeline', limit: '2', outcome: 'failed', cursor: first.body.pagination.nextCursor })
    expect(queries).toHaveLength(1)
    expect(queries[0].sql).not.toContain('COUNT(*)')
    expect(queries[0].sql).toContain('(e.created_at, e.id) <')
    expect(queries[0].values).toEqual(['failed', '2026-09-20T00:00:00.000Z', 2, 3, 0])
    expect(next.body.events).toEqual(eventRows)
    expect(next.body.pagination).toEqual({ total: null, nextCursor: null })
})

test('timeline format retains validation and administrator authorization', async () => {
    expect((await request({ format: 'unknown' })).statusCode).toBe(400)
    expect((await request({ format: 'timeline', cursor: 'invalid' })).statusCode).toBe(400)
    administrator = false
    expect((await request({ format: 'timeline' })).statusCode).toBe(403)
    expect(queries).toHaveLength(0)
})

test('helpdesk loads one bounded batch with acknowledgment and identity data, without support reports or a total count', async () => {
    eventRows = [{ id: 38316, created_at: '2026-09-13T00:00:00Z', event_type: 'admin.account.deleted', context: { targetId: 'deleted-user' }, acknowledged_at: '2026-09-20T00:00:00Z' }]
    const result = await request({ format: 'helpdesk', limit: '200' })
    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual({ events: eventRows })
    expect(queries).toHaveLength(1)
    expect(queries[0].sql).not.toContain('COUNT(*)')
    expect(queries[0].sql).toContain('acknowledgement.acknowledged_at')
    expect(queries[0].sql).toContain('jsonb_strip_nulls')
    expect(queries[0].sql).not.toContain('e.user_agent')
    expect(queries[0].values).toEqual([201, 0])
    queries.length = 0
    expect((await request({ format: 'helpdesk', hql: 'AuditEvents' })).statusCode).toBe(400)
    administrator = false
    expect((await request({ format: 'helpdesk' })).statusCode).toBe(403)
    expect(queries).toHaveLength(0)
})
