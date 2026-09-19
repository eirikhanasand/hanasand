import type { FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'
import { validateSession } from '#utils/auth/session.ts'
import { listRuntimeContainersWithStats } from '#utils/docker/engine.ts'
import getStats from '#utils/refresh/queries/stats.ts'

export async function canViewSystem(id: string, token: string) {
    const session = await validateSession({ id, token })
    if (!session) return false
    const role = await run(await loadSQL('hasRole.sql'), [session.user.id, 'system_admin'])
    return role.rows[0]?.has_role === true
}

export default function registerSystemStream(fastify: FastifyInstance) {
    const viewers = new Set<WebSocket>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let sampling = false
    async function sample() {
        if (sampling || !viewers.size) return
        sampling = true
        try {
            const [system, containers] = await Promise.all([getStats(), listRuntimeContainersWithStats(true)])
            const message = JSON.stringify({ type: 'snapshot', system: system.data, docker: { containers, source: 'docker_engine', generated_at: new Date().toISOString() } })
            for (const socket of viewers) {
                if (socket.bufferedAmount > 1024 * 1024) socket.close(1013)
                else if (socket.readyState === WebSocket.OPEN) socket.send(message)
            }
        } catch {
            for (const socket of viewers) if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'error', message: 'System telemetry is reconnecting.' }))
        } finally {
            sampling = false
            if (viewers.size) timer = setTimeout(() => { void sample() }, 1000)
        }
    }
    fastify.addHook('onClose', async () => { clearTimeout(timer); for (const socket of viewers) socket.close(1001); viewers.clear() })
    fastify.get('/api/ws/system', { websocket: true }, (socket, request) => {
        let authenticating = false
        let credentials: { id: string; token: string } | undefined
        let checking = false
        let recheck: ReturnType<typeof setInterval> | undefined
        const deadline = setTimeout(() => socket.close(1008), 10000)
        const cleanup = () => { clearTimeout(deadline); clearInterval(recheck); viewers.delete(socket); if (!viewers.size) clearTimeout(timer) }
        socket.on('close', cleanup)
        socket.on('error', cleanup)
        const origin = request.headers.origin
        if (origin && origin !== 'https://hanasand.com' && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) { socket.close(1008); return }
        socket.on('message', async raw => {
            if (credentials || authenticating) return
            authenticating = true
            try {
                if (Buffer.byteLength(raw.toString()) > 4096) throw new Error('Invalid authentication')
                const auth = JSON.parse(raw.toString())
                if (auth.type !== 'auth' || typeof auth.id !== 'string' || typeof auth.token !== 'string' || auth.id.length > 200 || auth.token.length > 512 || !await canViewSystem(auth.id, auth.token)) throw new Error('Unauthorized')
                if (socket.readyState !== WebSocket.OPEN) return
                credentials = { id: auth.id, token: auth.token }
                clearTimeout(deadline)
                viewers.add(socket)
                clearTimeout(timer)
                void sample()
                recheck = setInterval(async () => {
                    if (checking || !credentials) return
                    checking = true
                    try { if (!await canViewSystem(credentials.id, credentials.token)) socket.close(1008) } catch { socket.close(1008) } finally { checking = false }
                }, 30000)
            } catch { socket.close(1008) }
        })
    })
}
