import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: any) => ({ valid: Boolean(req.headers.id) }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async (req: any) => ({ valid: req.headers.id === 'admin' }) }))
const { default: handler } = await import('../src/handlers/metrics/systemSnapshot.ts')
const app = Fastify()
app.get('/system/snapshot', handler)

test('snapshot rejects anonymous and non-admin requests before returning shared data', async () => {
    app.systemSnapshot = Buffer.from(JSON.stringify({ generated_at: new Date().toISOString(), vms: [{ name: 'private' }] }))
    expect((await app.inject('/system/snapshot')).statusCode).toBe(401)
    expect((await app.inject({ url: '/system/snapshot', headers: { id: 'member' } })).statusCode).toBe(403)
    const response = await app.inject({ url: '/system/snapshot', headers: { id: 'admin' } })
    expect(response.json().vms).toEqual([{ name: 'private' }])
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.headers['server-timing']).toContain('system_snapshot;dur=')
})

test('missing or stale snapshots fail clearly instead of returning false empty inventories', async () => {
    app.systemSnapshot = undefined
    expect((await app.inject({ url: '/system/snapshot', headers: { id: 'admin' } })).statusCode).toBe(503)
    app.systemSnapshot = Buffer.from(JSON.stringify({ generated_at: new Date(Date.now() - 31000).toISOString() }))
    expect((await app.inject({ url: '/system/snapshot', headers: { id: 'admin' } })).statusCode).toBe(503)
})
