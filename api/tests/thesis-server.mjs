import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
assert.equal(process.env.THESIS_TEST_DATABASE, '1')
assert.equal(process.env.DB_HOST, 'thesis-test-db')
const identity = (id, token) => id === 'eirikhanasand' && token === 'synthetic-owner'
mock.module('../src/utils/auth/session.ts', () => ({
    validateSession: async({ id, token }) => identity(id, token) ? { user: { id, name: 'Eirik Hanasand' } } : null,
}))
const { getThesis, putThesis, getThesisHistory } = await import('../src/handlers/thesis.ts')
const { subscribeThesis } = await import('../src/utils/thesis.ts')
const { queryOnce } = await import('../src/utils/db.ts')
const { default: ensureSchema } = await import('../src/utils/db/thesisSchema.ts')
await ensureSchema()
await queryOnce('TRUNCATE thesis, thesis_history')
await ensureSchema()
const app = Fastify()
await app.register(websocket)
app.get('/api/auth/token/:id', async(req, res) => identity(req.params.id, (req.headers.authorization || '').slice(7))
    ? { name: 'Eirik Hanasand', roles: [{ id: 'administrator' }] } : res.status(401).send({}))
app.get('/api/thesis', getThesis)
app.put('/api/thesis', { bodyLimit: 4100000 }, putThesis)
app.get('/api/thesis/history', getThesisHistory)
app.get('/api/thesis/history/:revision', getThesisHistory)
app.get('/api/ws/thesis', { websocket: true }, subscribeThesis)
await app.listen({ host: '0.0.0.0', port: 3202 })
