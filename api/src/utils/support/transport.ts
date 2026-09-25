import type { FastifyReply, FastifyRequest } from 'fastify'
import WebSocket from 'ws'
import { supportServiceConfigured, shouldProxySupport } from './config.ts'
export { supportServiceConfigured, shouldProxySupport, supportRequestPath, hasSupportServiceKey } from './config.ts'
import { recoveryRequestAllowed } from '../recovery.ts'

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
    const upstream = new WebSocket(process.env.SUPPORT_SERVICE_BASE!.replace(/^http/, 'ws').replace(/\/$/, '') + '/api/ws/support', {
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
    upstream.on('open', () => { for (const data of pending) upstream.send(data.toString()); pending.length = 0 })
    socket.on('message', data => {
        const body = Buffer.from(data.toString())
        if (!allowed() || body.length > 4096 || upstream.bufferedAmount > 1024 * 1024) { socket.close(1013); return }
        if (upstream.readyState === WebSocket.OPEN) upstream.send(body.toString())
        else if (upstream.readyState === WebSocket.CONNECTING && (bytes += body.length) <= 4096) pending.push(body)
        else socket.close(1008)
    })
    upstream.on('message', data => {
        if (!allowed() || socket.bufferedAmount > 1024 * 1024) socket.close(1013)
        else if (socket.readyState === WebSocket.OPEN) socket.send(data.toString())
    })
    return true
}
