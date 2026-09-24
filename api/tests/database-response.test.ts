import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
mock.module('#db', () => ({ default: async () => ({ rows: [] }), queryOnce: async () => ({ rows: [] }) }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async (_req: unknown, reply: any) => { reply.code(401).send({ error: 'Authentication required.' }); return { valid: false } } }))
mock.module('#utils/auth/hasRole.ts', () => ({ default: async () => { throw new Error('Role check must not run') } }))
const { requireDatabaseAccess } = await import('../src/handlers/database/query.ts')
test('database authorization does not send again after authentication rejects a request', async () => {
    const app = Fastify()
    let sends = 0
    app.addHook('onSend', async (_req, _reply, payload) => { sends++; return payload })
    app.get('/', async (req, reply) => { if (!await requireDatabaseAccess(req, reply)) return reply; reply.send({ ok: true }) })
    const response = await app.inject('/')
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Authentication required.' })
    expect(sends).toBe(1)
    await app.close()
})
