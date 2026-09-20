import { beforeEach, expect, mock, test } from 'bun:test'
import type { FastifyReply } from 'fastify'

let valid = true
let administrator = true
let impersonating = false
let exists = true
const queries: string[] = []
mock.module('../src/utils/db.ts', () => ({
    default: async (sql: string) => {
        if (sql.includes('FROM roles r')) return { rows: administrator ? [{ id: 'system_admin' }] : [] }
        queries.push(sql)
        return { rows: exists ? [{ id: 38316, acknowledged_at: '2026-09-20T01:00:00Z', acknowledged_by: 'operator' }] : [] }
    },
    queryOnce: async () => ({ rows: [] }), closeDatabase: async () => {},
}))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid, id: 'operator', impersonating }) }))
const { setAuditAcknowledgment } = await import('../src/handlers/auditAcknowledgments.ts')
beforeEach(() => { valid = true; administrator = true; impersonating = false; exists = true; queries.length = 0 })
async function request(method = 'POST', id = '38316') {
    const reply = { statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this }, send(body: unknown) { this.body = body; return this } }
    await setAuditAcknowledgment({ method, params: { id } } as Parameters<typeof setAuditAcknowledgment>[0], reply as unknown as FastifyReply)
    return reply
}
test('only authenticated, non-impersonating administrators can change acknowledgments', async () => {
    valid = false
    expect((await request()).statusCode).toBe(401)
    valid = true; impersonating = true
    expect((await request('DELETE')).statusCode).toBe(401)
    impersonating = false; administrator = false
    expect((await request()).statusCode).toBe(403)
    expect(queries).toHaveLength(0)
})
test('rejects invalid and missing event IDs', async () => {
    for (const id of ['0', '-1', '1.5', 'invalid', '9007199254740992']) expect((await request('POST', id)).statusCode).toBe(400)
    expect(queries).toHaveLength(0)
    exists = false
    expect((await request()).statusCode).toBe(404)
    expect((await request('DELETE')).statusCode).toBe(404)
})
test('returns saved acknowledgment and supports undo without deleting audit events', async () => {
    const result = await request()
    expect(result.body.acknowledged_by).toBe('operator')
    expect(result.body.acknowledged_at).toBe('2026-09-20T01:00:00Z')
    expect((await request('DELETE')).body.acknowledged_at).toBeNull()
    expect(queries.join('\n')).not.toContain('DELETE FROM system_events')
})
