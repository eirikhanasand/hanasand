import type { FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import run from '#db'
import { validateSession } from '#utils/auth/session.ts'
import { loadSQL } from '#utils/loadSQL.ts'
import { recoveryReadOnly } from '#utils/resilience.ts'
import { openLxdConsole } from '#utils/vms/lxdConsole.ts'

export async function consoleAccess(name: string, id: string, token: string) {
    const session = await validateSession({ id, token })
    if (!session) return false
    const role = await run(await loadSQL('hasRole.sql'), [session.user.id, 'system_admin'])
    const result = await run('SELECT owner, created_by, access_users FROM vms WHERE name = $1', [name])
    const vm = result.rows[0]
    return Boolean(vm && (role.rows[0]?.has_role === true || vm.owner === id || vm.created_by === id || Array.isArray(vm.access_users) && vm.access_users.includes(id)))
}

export default function registerVmConsole(fastify: FastifyInstance) {
    fastify.get<{ Params: { name: string } }>('/api/ws/vm/:name/console', { websocket: true }, (socket, request) => {
        let terminal: Awaited<ReturnType<typeof openLxdConsole>> | undefined
        let authenticated = false
        let starting = false
        let checking = false
        let credentials: { id: string; token: string } | undefined
        let recheck: ReturnType<typeof setInterval> | undefined
        let heartbeat: ReturnType<typeof setInterval> | undefined
        const send = (value: object) => {
            if (socket.bufferedAmount > 1024 * 1024) { socket.close(1013); terminal?.close(); return }
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
        }
        const fail = (message: string) => { send({ type: 'error', message }); socket.close(1008); terminal?.close() }
        const deadline = setTimeout(() => fail('Sign in to open this console.'), 10000)
        const origin = request.headers.origin
        if (origin && origin !== 'https://hanasand.com' && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
            clearTimeout(deadline)
            socket.close(1008)
            return
        }
        socket.on('close', () => { clearTimeout(deadline); clearInterval(recheck); clearInterval(heartbeat); terminal?.close() })
        socket.on('error', () => { terminal?.close() })
        socket.on('message', async raw => {
            try {
                if (Buffer.byteLength(raw.toString()) > 32768) return fail('Console input is too large.')
                const message = JSON.parse(raw.toString())
                if (!authenticated) {
                    if (starting || message.type !== 'auth' || typeof message.id !== 'string' || typeof message.token !== 'string' || message.id.length > 200 || message.token.length > 512) return fail('Sign in to open this console.')
                    starting = true
                    credentials = { id: message.id, token: message.token }
                    if (recoveryReadOnly()) return fail('Console access is paused during recovery.')
                    if (!await consoleAccess(request.params.name, credentials.id, credentials.token)) return fail('You do not have access to this VM.')
                    if (socket.readyState !== WebSocket.OPEN) return
                    clearTimeout(deadline)
                    const openingDeadline = setTimeout(() => fail('The VM host is unavailable. Try again later.'), 30000)
                    try {
                        terminal = await openLxdConsole(request.params.name, credentials.id, data => send({ type: 'output', data }), () => { send({ type: 'closed' }); socket.close() })
                    } finally { clearTimeout(openingDeadline) }
                    if (socket.readyState !== WebSocket.OPEN) { terminal.close(); return }
                    request.log.info({ vmName: request.params.name, userId: credentials.id }, 'VM console opened')
                    authenticated = true
                    send({ type: 'ready', username: terminal.username })
                    // Keep idle terminals alive through the public proxy's 15-second timeout.
                    heartbeat = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.ping() }, 10000)
                    recheck = setInterval(async () => {
                        if (checking || !credentials) return
                        checking = true
                        try {
                            if (recoveryReadOnly() || !await consoleAccess(request.params.name, credentials.id, credentials.token)) fail('Your console access has ended. Sign in again or check your VM access.')
                        } catch { fail('Unable to verify console access.') } finally { checking = false }
                    }, 30000)
                    return
                }
                if (message.type === 'input' && typeof message.data === 'string') terminal?.write(message.data)
                else if (message.type === 'resize' && Number.isInteger(message.cols) && Number.isInteger(message.rows)) terminal?.resize(Math.max(20, Math.min(500, message.cols)), Math.max(8, Math.min(200, message.rows)))
                else fail('Invalid console input.')
            } catch (error) {
                request.log.error({ err: error, vmName: request.params.name }, 'VM console failed')
                fail('Unable to open the console. Check that the VM and its host are running.')
            }
        })
    })
}
