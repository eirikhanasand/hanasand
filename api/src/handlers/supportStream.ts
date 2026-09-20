import type { FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import { queryOnce } from '#db'
import { validateSession } from '#utils/auth/session.ts'
import { supportSessionHash } from '#utils/support/conversation.ts'
import { supportNotifications, type SupportChange } from '#utils/support/live.ts'
import { recoveryRequestAllowed } from '#utils/resilience.ts'

export function supportChangeAllowed(change: SupportChange, viewer: { visitor?: string; id?: string; support?: boolean }) {
    return Boolean(viewer.visitor && viewer.visitor === change.visitor || viewer.id && (change.user === viewer.id || viewer.support && change.channel === 'human'))
}

export default function registerSupportStream(fastify: FastifyInstance) {
    const notifications = supportNotifications(error => fastify.log.warn({ err: error }, 'Support live connection is reconnecting'))
    const sockets = new Set<WebSocket>()
    fastify.addHook('onClose', async () => { for (const socket of sockets) socket.close(1001); await notifications.close() })
    fastify.get('/api/ws/support', { websocket: true }, (socket, request) => {
        const origin = request.headers.origin
        if (origin !== 'https://hanasand.com' && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || ''))) { socket.close(1008); return }
        sockets.add(socket)
        let authenticating = false
        let authenticated = false
        let unsubscribe: (() => void) | undefined
        let heartbeat: ReturnType<typeof setInterval> | undefined
        let recheck: ReturnType<typeof setInterval> | undefined
        let alive = true
        const deadline = setTimeout(() => socket.close(1008), 10000)
        const cleanup = () => { clearTimeout(deadline); clearInterval(heartbeat); clearInterval(recheck); unsubscribe?.(); sockets.delete(socket) }
        socket.on('close', cleanup)
        socket.on('error', cleanup)
        socket.on('pong', () => { alive = true })
        const send = (value: unknown) => {
            if (!recoveryRequestAllowed('GET', '/api/ws/support') || socket.bufferedAmount > 1024 * 1024) socket.close(1013)
            else if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
        }
        socket.on('message', async raw => {
            if (authenticated || authenticating) return
            authenticating = true
            try {
                if (!recoveryRequestAllowed('GET', '/api/ws/support')) throw new Error('Support is not active on this site')
                if (Buffer.byteLength(raw.toString()) > 4096) throw new Error('Invalid authentication')
                const auth = JSON.parse(raw.toString())
                const viewer: { visitor?: string; id?: string; support?: boolean } = {}
                if (auth.type !== 'auth') throw new Error('Unauthorized')
                if (typeof auth.ticket === 'string' && /^[a-f0-9]{64}$/.test(auth.ticket)) {
                    const ticket = await queryOnce('DELETE FROM support_live_tickets WHERE token_hash=$1 AND expires_at>NOW() RETURNING visitor_token_hash', [supportSessionHash(auth.ticket)])
                    if (!ticket.rows[0]) throw new Error('Expired ticket')
                    viewer.visitor = ticket.rows[0].visitor_token_hash
                } else {
                    if (typeof auth.id !== 'string' || typeof auth.token !== 'string' || auth.id.length > 200 || auth.token.length > 512) throw new Error('Unauthorized')
                    const session = await validateSession(auth)
                    if (!session) throw new Error('Unauthorized')
                    viewer.id = session.user.id
                    viewer.support = session.roles.some(role => role.id === 'support')
                    let checking = false
                    recheck = setInterval(async () => {
                        if (checking) return
                        checking = true
                        try {
                            const current = await validateSession(auth)
                            if (!current) socket.close(1008)
                            else viewer.support = current.roles.some(role => role.id === 'support')
                        } catch { socket.close(1011) } finally { checking = false }
                    }, 30000)
                }
                if (socket.readyState !== WebSocket.OPEN) { cleanup(); return }
                authenticated = true
                clearTimeout(deadline)
                unsubscribe = notifications.subscribe(change => {
                    if (!change || supportChangeAllowed(change, viewer)) send({ type: 'changed', ...(change ? { id: change.id } : {}) })
                })
                send({ type: 'ready' })
                heartbeat = setInterval(() => {
                    if (!recoveryRequestAllowed('GET', '/api/ws/support')) socket.close(1013)
                    else if (!alive) socket.terminate()
                    else { alive = false; socket.ping() }
                }, 20000)
            } catch (error) { request.log.warn({ err: error }, 'Support socket authentication failed'); socket.close(1008); cleanup() }
        })
    })
}
