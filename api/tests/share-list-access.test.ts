import { test, expect, mock } from 'bun:test'
import Fastify from 'fastify'

const queries: Array<{ sql: string, params: unknown[] }> = []
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async ({ id, token }: { id: string, token: string }) => token === `token-${id}` ? { user: { id, roles: [] } } : null }))
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string, params: unknown[]) => { queries.push({ sql, params }); return { rows: [] } } }))
const { getUserShares } = await import('../src/handlers/share.ts')

test('members can list only their own shares; anonymous and cross-user requests are denied', async () => {
    const app = Fastify()
    app.get('/share/user/:id', getUserShares)
    try {
        for (const id of ['member-a', 'member-b']) {
            const headers = { id, authorization: `Bearer token-${id}` }
            expect((await app.inject({ url: `/share/user/${id}`, headers })).statusCode).toBe(200)
            expect(queries.at(-1)?.params).toEqual([id])
            expect(queries.at(-1)?.sql).toMatch(/WHERE owner = \$1 AND COALESCE\(parent/)
            const before = queries.length
            expect((await app.inject({ url: '/share/user/another-user', headers })).statusCode).toBe(401)
            expect((await app.inject({ url: '/share/user/another-organization', headers })).statusCode).toBe(401)
            expect(queries.length).toBe(before)
        }
        expect((await app.inject({ url: '/share/user/member-a' })).statusCode).toBe(401)
        expect((await app.inject({ url: '/share/user/member-a', headers: { id: 'member-a', authorization: 'Bearer invalid' } })).statusCode).toBe(401)
    } finally { await app.close() }
})
