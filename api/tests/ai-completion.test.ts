import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let connected = true
let blocked = false
let request: any
mock.module('../src/utils/ws/handleGptMessage.ts', () => ({
    listGptClients: () => connected ? [{ name: 'test', model: { status: 'idle' } }] : [],
    requestGptCompletion: async (_type: string, input: any) => { request = input; return { content: '{"facts":[]}' } },
}))
mock.module('../src/utils/ai/actionPolicy.ts', () => ({
    evaluateAgentActionPolicy: async () => ({ status: blocked ? 'blocked' : 'allowed', reason: 'policy', safeAlternative: 'safe input' }),
    auditAgentAction: async () => {},
    redactAgentText: (text: string) => text,
}))
const { default: ai } = await import('../src/handlers/tools/ai.ts')
test('explicit completions use model output, retain policy checks and never substitute a scaffold when unavailable', async () => {
    const app = Fastify()
    app.post('/ai', ai)
    const payload = { action: 'complete', prompt: 'Extract JSON facts from this source: build a website with Dockerfile and dependencies.' }
    try {
        const result = (await app.inject({ method: 'POST', url: '/ai', payload })).json()
        expect(result.model).toBe('test')
        expect(result.message).toBe('{"facts":[]}')
        expect(request.messages[0].content).toContain('output format exactly')
        expect(request.messages[1].content).toBe(payload.prompt)
        for (const prompt of ['Explain this threat report about a Dockerfile and website.', 'Help me plan my day.', 'Build a small website.']) {
            const general = (await app.inject({ method: 'POST', url: '/ai', payload: { prompt } })).json()
            expect(general.model).toBe('test')
            expect(request.messages[0].content).toContain('general questions, threat intelligence, and coding')
            expect(request.messages[0].content).not.toContain('include complete runnable files')
        }
        expect((await app.inject({ method: 'POST', url: '/ai', payload: { action: 'scaffold', prompt: 'Build a website with a Dockerfile' } })).json().model).toBe('share-builder')
        connected = false
        expect((await app.inject({ method: 'POST', url: '/ai', payload })).json().status).toBe('connecting')
        expect((await app.inject({ method: 'POST', url: '/ai', payload: { prompt: payload.prompt } })).json().status).toBe('connecting')
        blocked = true
        expect((await app.inject({ method: 'POST', url: '/ai', payload })).statusCode).toBe(403)
    } finally { await app.close() }
})
