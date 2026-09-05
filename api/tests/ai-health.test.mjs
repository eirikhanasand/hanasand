import { mock, test, expect } from 'bun:test'
import Fastify from 'fastify'
let clients = []
let calls = 0
let fail = false
mock.module('../src/utils/ws/handleGptMessage.ts', () => ({
    listGptClients: () => clients,
    requestGptCompletion: async () => { calls++; if (fail) throw Error('offline'); return { content: 'OK' } },
}))
const { getModelHealth, getInferenceHealth } = await import('../src/handlers/ai/health.ts')
test('AI health distinguishes connections from working inference and bounds probe traffic', async () => {
    const app = Fastify()
    app.get('/models', getModelHealth)
    app.get('/inference', getInferenceHealth)
    expect((await app.inject('/models')).statusCode).toBe(503)
    expect((await app.inject('/inference')).statusCode).toBe(503)
    clients = [{ name: 'test', lastSeen: new Date().toISOString(), model: { status: 'idle' } }]
    expect((await app.inject('/models')).json().connectedModels).toBe(1)
    const responses = await Promise.all([app.inject('/inference'), app.inject('/inference')])
    expect(responses.every(response => response.statusCode === 200)).toBe(true)
    expect(calls).toBe(1)
    const now = Date.now
    try {
        Date.now = () => now() + 31000
        fail = true
        expect((await app.inject('/inference')).statusCode).toBe(503)
        expect((await app.inject('/models')).statusCode).toBe(200)
        clients = []
        expect((await app.inject('/inference')).json().connectedModels).toBe(0)
    } finally { Date.now = now; await app.close() }
})
