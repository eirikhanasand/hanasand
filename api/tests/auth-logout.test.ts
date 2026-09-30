import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
const queries: Array<{ sql: string, params?: unknown[] }> = []
let validSessionId: string | null = null

mock.module('#db', () => ({
    default: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params })
        return { rows: [{ token_id: 1 }], rowCount: 1 }
    },
    queryOnce: async () => ({ rows: [], rowCount: 0 }),
    closeDatabase: async () => {},
    withTransaction: async (work: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>, rowCount: number }>) => Promise<unknown>) => work(async (sql, params) => {
        queries.push({ sql, params })
        return { rows: [], rowCount: 0 }
    }),
}))
mock.module('#utils/auth/session.ts', () => ({
    issueToken: async () => null,
    listSessions: async () => [],
    revokeAllTokens: async () => 0,
    revokeToken: async () => false,
    validateSession: async ({ id }: { id?: string }) => id && id === validSessionId
        ? { user: { id } }
        : null,
}))
mock.module('../src/plugins/rateLimit.ts', () => ({ default: async () => {} }))

const { createAuthServer } = await import('../src/authServer.ts')
const app = createAuthServer()

beforeEach(() => {
    queries.length = 0
    validSessionId = 'caller'
})

test('logout rejects unauthenticated requests without touching tokens', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/logout/caller' })

    expect(response.statusCode).toBe(401)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(queries).toHaveLength(0)
})

test('logout rejects a caller token when the URL names another user', async () => {
    const response = await app.inject({
        method: 'GET',
        url: '/api/auth/logout/another-user',
        headers: { authorization: 'Bearer caller-session-token' },
    })

    expect(response.statusCode).toBe(401)
    expect(queries).toHaveLength(0)
})

test('logout revokes only the authenticated caller token', async () => {
    const response = await app.inject({
        method: 'GET',
        url: '/api/auth/logout/caller',
        headers: { authorization: 'Bearer caller-session-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ invalidatedTokens: 1 })
    expect(queries).toHaveLength(1)
    expect(queries[0].sql).toContain('WHERE id = $1')
    expect(queries[0].sql).toContain('AND token = $2')
    expect(queries[0].sql).toContain('revoked_at IS NULL')
    expect(queries[0].params).toEqual(['caller', 'caller-session-token'])
})

afterAll(async () => { await app.close() })
