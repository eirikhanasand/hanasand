import { afterEach, expect, test } from 'bun:test'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import WebSocket from 'ws'
import getAiModels, { readModelState } from '../src/handlers/ai/getModels.ts'
import { proxyModelSocket } from '../src/utils/ws/proxyModelSocket.ts'

const original = process.env.AI_HEALTH_WORKER_BASE
afterEach(() => {
    if (original === undefined) delete process.env.AI_HEALTH_WORKER_BASE
    else process.env.AI_HEALTH_WORKER_BASE = original
})

test('model discovery reads the worker registry and rejects broken or looping upstreams', async () => {
    let valid = true
    const worker = Bun.serve({ port: 0, fetch(request) {
        expect(new URL(request.url).pathname).toBe('/api/ai/models')
        expect(request.headers.get('x-ai-models-forwarded')).toBe('1')
        return Response.json(valid ? { connected: [{ name: 'inspur', lanes: [{ id: 'gpu-1' }] }], runtimeState: { status: 'ready' } } : {})
    } })
    process.env.AI_HEALTH_WORKER_BASE = worker.url.toString()
    const replica = Fastify()
    replica.get('/models', getAiModels)
    try {
        const response = await replica.inject('/models')
        expect(response.statusCode).toBe(200)
        expect(response.json().connected[0].name).toBe('inspur')
        expect(response.headers['cache-control']).toContain('no-store')
        expect((await readModelState()).connected).toHaveLength(1)
        expect((await replica.inject({ url: '/models', headers: { 'x-ai-models-forwarded': '1' } })).statusCode).toBe(503)
        valid = false
        expect((await replica.inject('/models')).statusCode).toBe(503)
        worker.stop(true)
        expect((await replica.inject('/models')).statusCode).toBe(503)
        delete process.env.AI_HEALTH_WORKER_BASE
        expect((await readModelState()).connected).toEqual([])
    } finally { worker.stop(true); await replica.close() }
})

test('model socket relays initial snapshots and prompt replies and closes on worker loss', async () => {
    let upstream: WebSocket | undefined
    const worker = Fastify()
    await worker.register(websocket)
    worker.get('/api/client/ws/gpt', { websocket: true }, (socket, req) => {
        expect(req.headers['x-ai-models-forwarded']).toBe('1')
        upstream = socket
        socket.send(JSON.stringify({ type: 'snapshot', clients: [{ name: 'inspur' }] }))
        socket.on('message', raw => {
            const prompt = JSON.parse(raw.toString())
            socket.send(JSON.stringify({ type: 'prompt_complete', conversationId: prompt.conversationId, content: 'OK' }))
        })
    })
    await worker.listen({ port: 0, host: '127.0.0.1' })
    process.env.AI_HEALTH_WORKER_BASE = `http://127.0.0.1:${(worker.server.address() as { port: number }).port}`
    const replica = Fastify()
    await replica.register(websocket)
    replica.get('/api/client/ws/gpt', { websocket: true }, socket => { proxyModelSocket(socket, 'gpt') })
    await replica.listen({ port: 0, host: '127.0.0.1' })
    const client = new WebSocket(`ws://127.0.0.1:${(replica.server.address() as { port: number }).port}/api/client/ws/gpt`)
    const events: string[] = []
    try {
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Socket relay timed out')), 3000)
            client.on('open', () => client.send(JSON.stringify({ type: 'prompt_request', conversationId: 'test', messages: [] })))
            client.on('message', raw => {
                const event = JSON.parse(raw.toString())
                events.push(event.type)
                if (event.type === 'snapshot') expect(event.clients[0].name).toBe('inspur')
                if (event.type === 'prompt_complete') { expect(event.content).toBe('OK'); upstream!.close() }
            })
            client.on('close', () => { clearTimeout(timeout); resolve() })
            client.on('error', reject)
        })
        expect(events).toEqual(['snapshot', 'prompt_complete'])
    } finally { client.terminate(); upstream?.terminate(); replica.server.closeAllConnections(); await replica.close(); worker.server.closeAllConnections(); await worker.close() }
})
