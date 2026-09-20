import { timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import WebSocket from 'ws'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// Use the installed client: Bun's built-in ws shim mishandles some proxied upgrades.
const require = createRequire(import.meta.url)
const UpstreamSocket: typeof WebSocket = require(join(dirname(require.resolve('ws/package.json')), 'lib/websocket.js'))
import { recoveryRequestAllowed } from '../resilience.ts'

export function supportServiceConfigured() { return Boolean(process.env.SUPPORT_SERVICE_BASE && process.env.SUPPORT_SERVICE_KEY) }
export function shouldProxySupport(path: string) {
    return supportServiceConfigured() && process.env.SUPPORT_INTERNAL_SERVICE !== '1' && supportRequestPath(path.split('?')[0])
}
export function hasSupportServiceKey(req: FastifyRequest) {
    const expected = process.env.SUPPORT_SERVICE_KEY
    const received = req.headers['x-support-service-key']
    return Boolean(expected && typeof received === 'string' && expected.length >= 32 && Buffer.byteLength(received) === Buffer.byteLength(expected)
        && timingSafeEqual(Buffer.from(received), Buffer.from(expected)))
}
export function supportRequestPath(path: string) {
    return /^\/api\/support\/(chat|tickets(?:\/[^/]+\/(?:messages|status|feedback))?)$/.test(path)
}
export async function forwardSupportRequest(req: FastifyRequest, res: FastifyReply) {
    if (!shouldProxySupport(req.url)) return
    const headers = new Headers({ 'content-type': 'application/json', 'x-support-service-key': process.env.SUPPORT_SERVICE_KEY!, 'x-support-client-ip': req.ip })
    for (const key of ['authorization', 'id', 'user-agent', 'x-impersonation-token', 'x-support-session', 'x-api-key']) {
        const value = req.headers[key]
        if (typeof value === 'string') headers.set(key, value)
    }
    try {
        const response = await fetch(process.env.SUPPORT_SERVICE_BASE!.replace(/\/$/, '') + req.url, {
            method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
            redirect: 'error', signal: AbortSignal.timeout(60000),
        })
        for (const key of ['retry-after', 'x-access-token', 'x-access-token-expires-at', 'x-impersonating-id', 'x-impersonating-name', 'x-authenticated-id', 'x-impersonation-session-id']) {
            const value = response.headers.get(key)
            if (value) res.header(key, value)
        }
        res.header('Cache-Control', 'no-store').code(response.status).send(await response.json())
    } catch {
        res.code(503).send({ error: 'Support is temporarily unavailable. Please try again.' })
    }
    return true
}

export function forwardSupportSocket(socket: WebSocket) {
    if (!supportServiceConfigured() || process.env.SUPPORT_INTERNAL_SERVICE === '1') return false
    const upstream = new UpstreamSocket(process.env.SUPPORT_SERVICE_BASE!.replace(/^http/, 'ws').replace(/\/$/, '') + '/api/ws/support', {
        headers: { origin: 'https://hanasand.com', 'x-support-service-key': process.env.SUPPORT_SERVICE_KEY! }, handshakeTimeout: 5000,
    })
    const pending: Buffer[] = []
    let bytes = 0
    const allowed = () => recoveryRequestAllowed('GET', '/api/ws/support')
    const timer = setInterval(() => { if (!allowed()) socket.close(1013) }, 1000)
    const close = () => { clearInterval(timer); if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate(); else upstream.close() }
    socket.on('close', close)
    socket.on('error', close)
    upstream.on('error', () => socket.close(1011))
    upstream.on('close', () => socket.close(1013))
    upstream.on('open', () => { for (const data of pending) upstream.send(data); pending.length = 0 })
    socket.on('message', data => {
        const body = Buffer.from(data.toString())
        if (!allowed() || body.length > 4096 || upstream.bufferedAmount > 1024 * 1024) { socket.close(1013); return }
        if (upstream.readyState === WebSocket.OPEN) upstream.send(body)
        else if (upstream.readyState === WebSocket.CONNECTING && (bytes += body.length) <= 4096) pending.push(body)
        else socket.close(1008)
    })
    upstream.on('message', data => {
        if (!allowed() || socket.bufferedAmount > 1024 * 1024) socket.close(1013)
        else if (socket.readyState === WebSocket.OPEN) socket.send(data.toString())
    })
    return true
}
