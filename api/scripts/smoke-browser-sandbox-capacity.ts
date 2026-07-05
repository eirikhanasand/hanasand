import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import WebSocket, { WebSocketServer } from 'ws'
import { chromium } from 'playwright'
import { handleOnionSessionSocket } from '../src/handlers/onionSession/ws.ts'

type BrokerPayload = {
    type?: string
    state?: string
    sessionId?: string
    capacity?: {
        activeSessions?: number
        queuedSessions?: number
        maxSessions?: number
        queuePosition?: number
    }
}

process.env.BROWSER_SANDBOX_ALLOW_LOCAL_TARGETS = '1'
process.env.BROWSER_SANDBOX_MAX_SESSIONS = '10'
process.env.CHROMIUM_BIN ||= chromium.executablePath()

const pageServer = http.createServer((_request, response) => {
    response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
    })
    response.end('<!doctype html><title>Sandbox capacity fixture</title><main>ready</main>')
})

await listen(pageServer)
const target = `http://127.0.0.1:${portFor(pageServer)}/capacity`

const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 })
await onceListening(wsServer)

wsServer.on('connection', (connection, request) => {
    const id = new URL(request.url || '/session', 'ws://127.0.0.1').pathname.split('/').filter(Boolean).pop() || `capacity-${Date.now()}`
    handleOnionSessionSocket(connection, id, 'regular')
})

const clients = await Promise.all(Array.from({ length: 11 }, async (_item, index) => {
    const id = `capacity-${index}`
    const socket = new WebSocket(`ws://127.0.0.1:${portFor(wsServer)}/${id}`)
    const payloads: BrokerPayload[] = []
    socket.on('message', (message) => {
        try {
            payloads.push(JSON.parse(message.toString()) as BrokerPayload)
        } catch {
            payloads.push({ type: 'unparseable' })
        }
    })
    await onceOpen(socket)
    socket.send(JSON.stringify({
        type: 'start',
        sessionId: id,
        network: 'regular',
        target,
        durationMinutes: 1,
        width: 800,
        height: 520,
        profileTools: [],
    }))
    return { id, socket, payloads }
}))

await Promise.all(clients.slice(0, 10).map(client => waitForPayload(client.payloads, payload => payload.type === 'ready', 60_000)))
const queued = await waitForPayload(clients[10].payloads, payload => payload.type === 'status' && payload.state === 'capacity_busy')

assert.equal(queued.capacity?.maxSessions, 10, 'capacity status should advertise the configured ten-slot limit')
assert.equal(queued.capacity?.queuePosition, 1, 'the eleventh sandbox should queue behind the ten active runs')
assert.equal(queued.capacity?.activeSessions, 10, 'ten regular sandboxes should be active before queueing overflow')

clients[0].socket.send(JSON.stringify({ type: 'end' }))
await waitForPayload(clients[10].payloads, payload => payload.type === 'status' && payload.state === 'capacity_admitted', 30_000)
await waitForPayload(clients[10].payloads, payload => payload.type === 'ready', 60_000)

for (const client of clients) {
    if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify({ type: 'end' }))
        client.socket.close()
    }
}

wsServer.close()
pageServer.close()

console.log(JSON.stringify({
    ok: true,
    activeLimit: 10,
    admittedInitially: 10,
    queuedOverflow: clients[10].id,
    target,
}, null, 2))

function listen(server: http.Server) {
    return new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => resolve())
    })
}

function onceListening(server: WebSocketServer) {
    return new Promise<void>((resolve) => {
        if (server.address()) {
            resolve()
            return
        }
        server.once('listening', () => resolve())
    })
}

function onceOpen(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        socket.once('open', () => resolve())
        socket.once('error', reject)
    })
}

function portFor(server: http.Server | WebSocketServer) {
    const address = server.address()
    assert(address && typeof address !== 'string')
    return (address as AddressInfo).port
}

function waitForPayload(payloads: BrokerPayload[], predicate: (payload: BrokerPayload) => boolean, timeoutMs = 20_000) {
    const started = Date.now()

    return new Promise<BrokerPayload>((resolve, reject) => {
        const timer = setInterval(() => {
            const match = payloads.find(predicate)
            if (match) {
                clearInterval(timer)
                resolve(match)
                return
            }

            if (Date.now() - started > timeoutMs) {
                clearInterval(timer)
                reject(new Error(`Timed out waiting for browser sandbox capacity payload. Received: ${JSON.stringify(payloads.slice(-10))}`))
            }
        }, 50)
    })
}
