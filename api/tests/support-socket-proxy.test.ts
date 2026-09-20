import { expect, test } from 'bun:test'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import WebSocket from 'ws'
import { once } from 'node:events'
import { forwardSupportSocket } from '../src/utils/support/transport.ts'

test('support socket proxy forwards private authentication and buffered text messages', async () => {
    const original = { ...process.env }
    const upstream = Fastify({ forceCloseConnections: true })
    const edge = Fastify({ forceCloseConnections: true })
    let client: WebSocket | undefined
    try {
        process.env.SUPPORT_SERVICE_KEY = 'private-test-key'.repeat(4)
        delete process.env.SUPPORT_INTERNAL_SERVICE
        delete process.env.RESILIENCE_STATE_FILE
        delete process.env.RESILIENCE_ESSENTIAL_ONLY
        await upstream.register(websocket)
        upstream.addHook('onRequest', (req, res, done) => {
            if (req.headers['x-support-service-key'] !== process.env.SUPPORT_SERVICE_KEY) { res.code(403).send(); return }
            setTimeout(done, 30)
        })
        upstream.get('/api/ws/support', { websocket: true }, socket => {
            socket.on('message', raw => { const body = JSON.parse(raw.toString()); socket.send(JSON.stringify({ type: body.type === 'auth' ? 'ready' : 'changed', id: body.id })) })
        })
        process.env.SUPPORT_SERVICE_BASE = await upstream.listen({ port: 0, host: '127.0.0.1' })
        await edge.register(websocket)
        edge.get('/api/ws/support', { websocket: true }, socket => { expect(forwardSupportSocket(socket)).toBe(true) })
        const address = await edge.listen({ port: 0, host: '127.0.0.1' })
        client = new WebSocket(address.replace('http:', 'ws:') + '/api/ws/support')
        await once(client, 'open')
        const ready = once(client, 'message')
        client.send(JSON.stringify({ type: 'auth', ticket: 'one-use-ticket' }))
        expect(JSON.parse((await ready)[0].toString()).type).toBe('ready')
        const change = once(client, 'message')
        client.send(JSON.stringify({ type: 'test-change', id: 'conversation' }))
        expect(JSON.parse((await change)[0].toString())).toEqual({ type: 'changed', id: 'conversation' })
    } finally {
        client?.terminate()
        for (const socket of edge.websocketServer?.clients || []) socket.terminate()
        for (const socket of upstream.websocketServer?.clients || []) socket.terminate()
        await edge.close(); await upstream.close()
        for (const key of ['SUPPORT_SERVICE_KEY', 'SUPPORT_SERVICE_BASE', 'SUPPORT_INTERNAL_SERVICE', 'RESILIENCE_STATE_FILE', 'RESILIENCE_ESSENTIAL_ONLY']) {
            if (original[key] === undefined) delete process.env[key]
            else process.env[key] = original[key]
        }
    }
})
