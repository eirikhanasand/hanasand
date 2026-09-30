import type { FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import run from '#db'
import { validateSession } from '#utils/auth/session.ts'
import { loadSQL } from '#utils/loadSQL.ts'
import { recoveryReadOnly } from '#utils/recovery.ts'
import { hostConsoleNames, startHostConsole, type HostConsoleName } from '#utils/hostSsh.ts'

async function canOpenHostConsole(id: string, token: string) {
    const session = await validateSession({ id, token })
    if (!session) return false
    const role = await run(await loadSQL('hasRole.sql'), [session.user.id, 'system_admin'])
    return role.rows[0]?.has_role === true
}

export default function registerHostConsole(fastify: FastifyInstance) {
    fastify.get<{ Params: { name: string } }>('/api/ws/host/:name/console', { websocket: true }, (socket, request) => {
        const name = request.params.name as HostConsoleName
        if (!hostConsoleNames.includes(name)) { socket.close(1008); return }
        let terminal: Awaited<ReturnType<typeof startHostConsole>> | undefined
        let authenticated = false
        let starting = false
        let checking = false
        let credentials: { id: string, token: string } | undefined
        let recheck: ReturnType<typeof setInterval> | undefined
        let heartbeat: ReturnType<typeof setInterval> | undefined
        const send = (value: object) => {
            if (socket.bufferedAmount > 1024 * 1024) { socket.close(1013); terminal?.close(); return }
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
        }
        const close = (code = 1008) => {
            if (socket.readyState === WebSocket.OPEN) socket.close(code)
            terminal?.close()
        }
        const fail = (message: string) => { send({ type: 'error', message }); close() }
        const deadline = setTimeout(() => fail('Sign in with system administrator access to open this console.'), 10000)
        const origin = request.headers.origin
        if (origin && origin !== 'https://hanasand.com' && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127.0.0.1)(:\d+)?$/.test(origin))) {
            clearTimeout(deadline)
            socket.close(1008)
            return
        }
        socket.on('close', () => { clearTimeout(deadline); clearInterval(recheck); clearInterval(heartbeat); terminal?.close() })
        socket.on('error', () => terminal?.close())
        socket.on('message', async raw => {
            try {
                if (Buffer.byteLength(raw.toString()) > 32768) return fail('Console input is too large.')
                const message = JSON.parse(raw.toString())
                if (!authenticated) {
                    if (starting || message.type !== 'auth' || typeof message.id !== 'string' || typeof message.token !== 'string' || message.id.length > 200 || message.token.length > 512) return fail('Sign in with system administrator access to open this console.')
                    starting = true
                    credentials = { id: message.id, token: message.token }
                    if (recoveryReadOnly()) return fail('Console access is paused during recovery.')
                    if (!await canOpenHostConsole(credentials.id, credentials.token)) return fail('System administrator access is required.')
                    if (socket.readyState !== WebSocket.OPEN) return
                    clearTimeout(deadline)
                    authenticated = true
                    terminal = await startHostConsole(name, send, () => close(1012))
                    request.log.info({ host: name, userId: credentials.id }, 'Host console opened')
                    heartbeat = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.ping() }, 10000)
                    recheck = setInterval(async () => {
                        if (checking || !credentials) return
                        checking = true
                        try {
                            if (recoveryReadOnly() || !await canOpenHostConsole(credentials.id, credentials.token)) fail('Your console access has ended. Sign in again.')
                        } catch { fail('Unable to verify console access.') } finally { checking = false }
                    }, 30000)
                    return
                }
                if (message.type === 'input' && typeof message.data === 'string') terminal?.write(message.data)
                else if (message.type === 'resize' && Number.isInteger(message.cols) && Number.isInteger(message.rows)) { /* OpenSSH keeps the initial host terminal size. */ }
                else fail('Invalid console input.')
            } catch (error) {
                request.log.error({ err: error, host: name }, 'Host console failed')
                fail('Unable to open the console. Check that the host is reachable.')
            }
        })
    })
}
