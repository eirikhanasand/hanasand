import { beforeEach, expect, mock, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'

let administrator = true
const queries: Array<{ sql: string, values: unknown[] }> = []
async function run(sql: string, values: unknown[] = []) {
    if (sql.includes('FROM roles r')) return { rows: administrator ? [{ id: 'system_admin' }] : [] }
    queries.push({ sql, values })
    return { rows: [] }
}
mock.module('../src/utils/db.ts', () => ({ default: run, queryOnce: run, closeDatabase: async () => {} }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'test-admin' }) }))
const { getSystemEvents } = await import('../src/handlers/adminSupport.ts')
beforeEach(() => { administrator = true; queries.length = 0 })
async function request(query: Record<string, string>) {
    const result = { statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this }, send(body: unknown) { this.body = body; return this } }
    await getSystemEvents({ query } as FastifyRequest, result as unknown as FastifyReply)
    return result
}
test('audit query validator accepts page and applies an offset after stable ordering', async () => {
    const response = await request({ page: '2', limit: '50', actor: 'operator' })
    expect(response.statusCode).toBe(200)
    expect(response.body.pagination.page).toBe(2)
    expect(queries[0].sql).toContain('ORDER BY e.created_at DESC, e.id DESC')
    expect(queries[0].sql).toContain('OFFSET')
    expect(queries[0].values.at(-1)).toBe(50)
    expect(queries[0].values).toContain('%operator%')
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
