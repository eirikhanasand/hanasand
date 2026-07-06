import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import WebSocket, { WebSocketServer } from 'ws'
import { chromium } from 'playwright'

type BrokerPayload = {
    type?: string
    state?: string
    text?: string
    image?: string
    ok?: boolean
    torProxyConfigured?: boolean
    networkSummary?: {
        downloads?: Array<{ sha256?: string; fileName?: string; bytes?: number; hashStatus?: string }>
    }
}

const downloadBody = 'sandbox-download-smoke\n'
const downloadHash = createHash('sha256').update(downloadBody).digest('hex')

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Onion broker smoke</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; color: #111827; }
    main { padding: 48px; }
    input { position: absolute; left: 96px; top: 32px; width: 360px; height: 40px; font-size: 20px; }
    button { position: absolute; left: 96px; top: 104px; width: 180px; height: 56px; font-size: 18px; }
    a { position: absolute; left: 312px; top: 104px; width: 180px; height: 56px; font-size: 18px; }
    #status { position: absolute; left: 96px; top: 190px; font-size: 18px; }
  </style>
</head>
<body>
  <main>
    <input id="target" autofocus value="">
    <button id="clicker">Click target</button>
    <a id="download" href="/download" download="sample.txt">Download sample</a>
    <div id="status">waiting</div>
  </main>
  <script>
    const input = document.getElementById('target')
    const status = document.getElementById('status')
    input.addEventListener('input', () => {
      status.textContent = 'typed:' + input.value
      console.log('input:' + input.value)
    })
    input.addEventListener('copy', (event) => {
      event.clipboardData.setData('text/plain', input.value)
      event.preventDefault()
      console.log('copy:' + input.value)
    })
    document.getElementById('clicker').addEventListener('click', () => {
      status.textContent = 'clicked'
      console.log('button-clicked')
    })
    window.addEventListener('wheel', (event) => {
      status.textContent = 'wheel:' + Math.round(event.deltaY)
      console.log('wheel:' + Math.round(event.deltaY))
    })
    input.focus()
  </script>
</body>
</html>`

delete process.env.ONION_SESSION_PROXY
delete process.env.TOR_SOCKS_PROXY
process.env.BROWSER_SANDBOX_ALLOW_LOCAL_TARGETS = '1'
process.env.BROWSER_SANDBOX_PREWARM = '0'
process.env.CHROMIUM_BIN ||= [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    chromium.executablePath(),
].find(path => existsSync(path))

const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')

const httpServer = http.createServer((request, response) => {
    if (request.url === '/download') {
        response.writeHead(200, {
            'content-type': 'text/plain; charset=utf-8',
            'content-disposition': 'attachment; filename="sample.txt"',
            'cache-control': 'no-store',
        })
        response.end(downloadBody)
        return
    }
    response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
    })
    response.end(html)
})

await listen(httpServer)
const httpPort = portFor(httpServer)
const target = `http://127.0.0.1:${httpPort}/`

const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 })
await onceListening(wsServer)
const wsPort = portFor(wsServer)

wsServer.on('connection', (connection) => {
    handleOnionSessionSocket(connection, `smoke-${Date.now().toString(36)}`)
})

const client = new WebSocket(`ws://127.0.0.1:${wsPort}`)
const payloads: BrokerPayload[] = []

client.on('message', (message) => {
    try {
        payloads.push(JSON.parse(message.toString()) as BrokerPayload)
    } catch {
        payloads.push({ type: 'unparseable', text: message.toString() })
    }
})

await onceOpen(client)
client.send(JSON.stringify({
    type: 'start',
    target,
    durationMinutes: 1,
    width: 900,
    height: 540,
}))

await waitForPayload(payloads, (payload) => payload.type === 'ready')
const firstFrame = await waitForPayload(payloads, (payload) => payload.type === 'frame' && Boolean(payload.image))
assert((firstFrame.image || '').length > 1000, 'expected a non-empty streamed JPEG frame')
assert.equal(payloads.find((payload) => payload.type === 'ready')?.torProxyConfigured, false)

client.send(JSON.stringify({ type: 'key', key: 'h' }))
client.send(JSON.stringify({ type: 'key', key: 'i' }))
await waitForPayload(payloads, (payload) => payload.type === 'console' && payload.text === 'input:hi')

client.send(JSON.stringify({ type: 'click', x: 186, y: 132, button: 0 }))
await waitForPayload(payloads, (payload) => payload.type === 'console' && payload.text === 'button-clicked')

client.send(JSON.stringify({ type: 'wheel', x: 420, y: 260, deltaY: 280 }))
await waitForPayload(payloads, (payload) => payload.type === 'console' && /^wheel:\d+/.test(payload.text || ''))

client.send(JSON.stringify({ type: 'clipboard', text: 'clipboard-smoke' }))
await waitForPayload(payloads, (payload) => payload.type === 'clipboard' && payload.ok === true)
client.send(JSON.stringify({ type: 'click', x: 180, y: 52, button: 0 }))
client.send(JSON.stringify({ type: 'key', key: 'v', ctrlKey: true }))
await waitForPayload(payloads, (payload) => payload.type === 'console' && payload.text === 'input:hiclipboard-smoke')
client.send(JSON.stringify({ type: 'click', x: 180, y: 52, button: 0 }))
client.send(JSON.stringify({ type: 'key', key: 'a', ctrlKey: true }))
client.send(JSON.stringify({ type: 'key', key: 'c', ctrlKey: true }))
client.send(JSON.stringify({ type: 'clipboard', direction: 'remote-to-browser' }))
await waitForPayload(payloads, (payload) => payload.type === 'clipboard' && payload.text === 'hiclipboard-smoke')

client.send(JSON.stringify({ type: 'click', x: 380, y: 132, button: 0 }))
await waitForPayload(payloads, (payload) => payload.type === 'status' && payload.state === 'download_blocked')
await waitForPayload(payloads, (payload) => payload.type === 'frame' && Boolean(payload.networkSummary?.downloads?.some(download => download.sha256 === downloadHash && download.fileName === 'sample.txt')))

client.send(JSON.stringify({ type: 'end' }))
await waitForPayload(payloads, (payload) => payload.type === 'ended')

client.close()
wsServer.close()
httpServer.close()

console.log(JSON.stringify({
    ok: true,
    target,
    receivedFrames: payloads.filter((payload) => payload.type === 'frame').length,
    receivedConsoleEvents: payloads.filter((payload) => payload.type === 'console').map((payload) => payload.text),
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
                reject(new Error(`Timed out waiting for broker payload. Received: ${JSON.stringify(payloads.slice(-8).map(summarizePayload))}`))
            }
        }, 50)
    })
}

function summarizePayload(payload: BrokerPayload) {
    if (payload.type !== 'frame') return payload
    return {
        type: payload.type,
        imageBytes: payload.image?.length || 0,
    }
}
