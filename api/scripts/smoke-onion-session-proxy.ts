import assert from 'node:assert/strict'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import WebSocket, { WebSocketServer } from 'ws'
import { chromium } from 'playwright'
import { handleOnionSessionSocket } from '../src/handlers/onionSession/ws.ts'

type BrokerPayload = {
    type?: string
    message?: string
    torProxyConfigured?: boolean
    target?: string
}

type SocksConnect = {
    host: string
    port: number
}

const targetHost = 'proxy-smoke.test'
const proxyTargetBody = '<!doctype html><title>Proxy smoke target</title><main>Loaded through ONION_SESSION_PROXY</main>'
const socksConnects: SocksConnect[] = []
const socksServer = net.createServer((socket) => {
    let buffer = Buffer.alloc(0)
    let greeted = false
    let connectedToTarget = false

    socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, typeof chunk === 'string' ? Buffer.from(chunk) : chunk])

        if (connectedToTarget) {
            if (!buffer.includes(Buffer.from('\r\n\r\n'))) return
            socket.write([
                'HTTP/1.1 200 OK',
                'content-type: text/html; charset=utf-8',
                'cache-control: no-store',
                `content-length: ${Buffer.byteLength(proxyTargetBody)}`,
                '',
                proxyTargetBody,
            ].join('\r\n'))
            socket.end()
            buffer = Buffer.alloc(0)
            return
        }

        if (!greeted) {
            if (buffer.length < 2) return
            const methodCount = buffer[1] || 0
            if (buffer.length < 2 + methodCount) return
            socket.write(Buffer.from([0x05, 0x00]))
            buffer = buffer.subarray(2 + methodCount)
            greeted = true
        }

        if (greeted && buffer.length >= 7) {
            const request = parseSocksConnect(buffer)
            if (!request) return
            socksConnects.push(request)
            buffer = Buffer.alloc(0)

            if (request.host === targetHost && request.port === 80) {
                connectedToTarget = true
                socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x7f, 0x00, 0x00, 0x01, 0x1f, 0x90]))
                return
            }

            socket.write(Buffer.from([0x05, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
            socket.end()
        }
    })
})

await listen(socksServer)
const socksPort = portFor(socksServer)

process.env.ONION_SESSION_PROXY = `socks5://127.0.0.1:${socksPort}`
delete process.env.TOR_SOCKS_PROXY
process.env.CHROMIUM_BIN ||= chromium.executablePath()

const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 })
await onceListening(wsServer)
const wsPort = portFor(wsServer)

wsServer.on('connection', (connection) => {
    handleOnionSessionSocket(connection, `proxy-smoke-${Date.now().toString(36)}`)
})

const client = new WebSocket(`ws://127.0.0.1:${wsPort}`)
const payloads: BrokerPayload[] = []
client.on('message', (message) => {
    try {
        payloads.push(JSON.parse(message.toString()) as BrokerPayload)
    } catch {
        payloads.push({ type: 'unparseable', message: message.toString() })
    }
})

await onceOpen(client)
client.send(JSON.stringify({
    type: 'start',
    target: `http://${targetHost}/`,
    durationMinutes: 1,
    width: 900,
    height: 540,
}))

await waitForPayload(payloads, (payload) => payload.type === 'status' && payload.torProxyConfigured === true)
await waitFor(() => socksConnects.some((connect) => connect.host === targetHost && connect.port === 80))
await waitForPayload(payloads, (payload) => payload.type === 'ready' && payload.torProxyConfigured === true)

client.send(JSON.stringify({ type: 'end' }))
await waitForPayload(payloads, (payload) => payload.type === 'ended').catch(() => undefined)
client.close()
wsServer.close()
socksServer.close()

const requested = socksConnects.map((connect) => `${connect.host}:${connect.port}`)
assert(requested.includes(`${targetHost}:80`), `expected Chromium to route target navigation through SOCKS proxy, got ${requested.join(', ')}`)

console.log(JSON.stringify({
    ok: true,
    proxy: process.env.ONION_SESSION_PROXY,
    socksConnects: requested,
    brokerStates: payloads.filter((payload) => payload.type === 'status' || payload.type === 'navigation_error').map((payload) => payload.message || payload.target || payload.type),
}, null, 2))

function parseSocksConnect(buffer: Buffer): SocksConnect | null {
    if (buffer[0] !== 0x05 || buffer[1] !== 0x01) return null
    const addressType = buffer[3]
    let offset = 4
    let host: string

    if (addressType === 0x01) {
        if (buffer.length < offset + 4 + 2) return null
        host = Array.from(buffer.subarray(offset, offset + 4)).join('.')
        offset += 4
    } else if (addressType === 0x03) {
        const length = buffer[offset]
        if (typeof length !== 'number' || buffer.length < offset + 1 + length + 2) return null
        host = buffer.subarray(offset + 1, offset + 1 + length).toString('utf8')
        offset += 1 + length
    } else if (addressType === 0x04) {
        if (buffer.length < offset + 16 + 2) return null
        host = buffer.subarray(offset, offset + 16).toString('hex')
        offset += 16
    } else {
        return null
    }

    const port = buffer.readUInt16BE(offset)
    return { host, port }
}

function listen(server: net.Server) {
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

function portFor(server: net.Server | WebSocketServer) {
    const address = server.address()
    assert(address && typeof address !== 'string')
    return (address as AddressInfo).port
}

function waitFor(predicate: () => boolean, timeoutMs = 20_000) {
    const started = Date.now()

    return new Promise<void>((resolve, reject) => {
        const timer = setInterval(() => {
            if (predicate()) {
                clearInterval(timer)
                resolve()
                return
            }

            if (Date.now() - started > timeoutMs) {
                clearInterval(timer)
                reject(new Error('Timed out waiting for SOCKS proxy connection'))
            }
        }, 50)
    })
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
                reject(new Error(`Timed out waiting for broker payload. Received: ${JSON.stringify(payloads.slice(-8))}`))
            }
        }, 50)
    })
}
