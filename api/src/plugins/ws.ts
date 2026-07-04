import fp from 'fastify-plugin'
import WebSocket from 'ws'
import type { RawData } from 'ws'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { registerClient } from '#utils/ws/registerClient.ts'
import { removeClient } from '#utils/ws/removeClient.ts'
import { handleMessage } from '#utils/ws/handleMessage.ts'
import config from '#constants'
import followTest from '../handlers/test/follow.ts'
import { gpt, handleGptMessage, sendGptSnapshot, unregisterGptSocket } from '#utils/ws/handleGptMessage.ts'
import recordLog from '#utils/logs/recordLog.ts'
import { handleOnionSessionSocket } from '../handlers/onionSession/ws.ts'

type PendingUpdates = {
    content: string
    timer: NodeJS.Timeout
}

const messageBuffer: Buffer[] = []

export const pwnedClients = new Map<string, Set<WebSocket>>()
export const testClients = new Map<string, Set<WebSocket>>()
export const shareClients = new Map<string, Set<WebSocket>>()
export const pendingUpdates = new Map<string, PendingUpdates>()

export default fp(async function wsPlugin(fastify: FastifyInstance) {
    // pwned
    fastify.get('/api/ws/pwned/:id', { websocket: true }, (connection, req: FastifyRequest) => {
        const id = (req.params as { id: string}).id

        registerClient(id, connection, pwnedClients)

        const internalWs = new WebSocket(`${config.pwned_ws}/${id}`)

        internalWs.on('message', (msg) => {
            connection.send(msg)
        })

        internalWs.on('open', () => {
            messageBuffer.forEach((msg) => internalWs.send(msg))
            messageBuffer.length = 0
        })

        connection.on('message', (msg: Buffer) => {
            if (internalWs.readyState === WebSocket.OPEN) {
                internalWs.send(msg)
            } else {
                messageBuffer.push(msg)
            }
        })

        connection.on('close', () => {
            removeClient(id, connection, pwnedClients)
            internalWs.close()
        })

        internalWs.on('close', () => {
            try {
                connection.close()
            } catch (error) {
                void recordWebsocketFailure('pwned', id, error)
            }
        })

        internalWs.on('error', (error) => {
            void recordWebsocketFailure('pwned-internal', id, error)
        })

        connection.on('error', (error) => {
            void recordWebsocketFailure('pwned-client', id, error)
        })
    })

    // test
    fastify.get('/api/ws/test/:id', { websocket: true }, (connection, req: FastifyRequest) => {
        const id = (req.params as { id: string}).id
        registerClient(id, connection, testClients)

        followTest(id)

        connection.on('message', (msg) => {
            try {
                const parsed = JSON.parse(msg.toString()) as { type?: string }
                if (parsed.type === 'rerun') {
                    followTest(id, true)
                }
            } catch (error) {
                void recordWebsocketFailure('test-message', id, error)
            }
        })

        connection.on('error', (error) => {
            void recordWebsocketFailure('test-client', id, error)
        })

        connection.on('close', () => {
            removeClient(id, connection, testClients)
        })
    })

    // share editor collaboration
    fastify.get<{ Params: { id: string } }>('/api/ws/share/:id', { websocket: true }, (connection, req) => {
        const id = req.params.id

        registerClient(id, connection, shareClients)

        connection.on('message', (message) => {
            void handleMessage(id, connection, message, shareClients)
        })

        connection.on('error', (error) => {
            void recordWebsocketFailure('share-client', id, error)
        })

        connection.on('close', () => {
            removeClient(id, connection, shareClients)
        })
    })

    // share terminal
    fastify.get<{
        Params: { alias: string, user: string, session: string }
    }>('/api/ws/share/:alias/shell/:user/:session', { websocket: true }, (connection, req) => {
        const { alias, user, session } = req.params
        const terminal = createShareTerminal(alias)

        sendTerminalUpdate(connection, `Connected to ${terminal.label}\r\n${terminal.prompt}`)
        connection.send(JSON.stringify({
            type: 'terminal_credentials',
            credentials: {
                username: user || 'browser',
                password: '',
                sshCommand: `browser terminal ${terminal.label}`,
                domain: 'hanasand.local',
            },
        }))

        connection.on('message', (message) => {
            void handleShareTerminalMessage(connection, terminal, message).catch((error) => {
                sendTerminalUpdate(connection, `\r\n${error instanceof Error ? error.message : String(error)}\r\n${terminal.prompt}`)
                void recordWebsocketFailure('share-terminal-message', `${alias}:${session}`, error)
            })
        })

        connection.on('error', (error) => {
            void recordWebsocketFailure('share-terminal-client', `${alias}:${session}`, error)
        })
    })

    // gpt
    fastify.get<{ Params: { id: string } }>('/api/client/ws/:id', { websocket: true }, (connection: WebSocket, req: FastifyRequest<{ Params: { id: string } }>) => {
        const id = (req.params as { id: string}).id

        registerClient(id, connection, gpt)
        sendGptSnapshot(id, connection)
        connection.on('message', (message) => {
            handleGptMessage(id, connection, message)
        })

        connection.on('close', () => {
            unregisterGptSocket(id, connection)
            removeClient(id, connection, gpt)
        })

        connection.on('error', (error) => {
            void recordWebsocketFailure('gpt-client', id, error)
        })
    })

    // remote onion browser session
    fastify.get<{ Params: { id: string } }>('/api/ws/onion-session/:id', { websocket: true }, (connection: WebSocket, req: FastifyRequest<{ Params: { id: string } }>) => {
        handleOnionSessionSocket(connection, req.params.id)
    })

    // regular-web sandbox browser session
    fastify.get<{ Params: { id: string } }>('/api/ws/browser-sandbox/:id', { websocket: true }, (connection: WebSocket, req: FastifyRequest<{ Params: { id: string } }>) => {
        handleOnionSessionSocket(connection, req.params.id, 'regular')
    })
})

type ShareTerminal = {
    label: string
    root: string
    prompt: string
}

function createShareTerminal(alias: string): ShareTerminal {
    const safeAlias = alias.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'share'
    const root = path.resolve(process.env.SHARE_TERMINAL_ROOT || process.cwd())

    fs.mkdirSync(root, { recursive: true })

    return {
        label: safeAlias,
        root,
        prompt: `${safeAlias}:~$ `,
    }
}

async function handleShareTerminalMessage(connection: WebSocket, terminal: ShareTerminal, message: RawData) {
    const parsed = parseTerminalMessage(message)

    if (!parsed || parsed.type === 'resize') {
        return
    }

    if (parsed.type !== 'terminalInput') {
        return
    }

    const content = parsed.content.replace(/\r/g, '\n')
    const commands = content.split('\n').map(command => command.trim()).filter(Boolean)

    for (const command of commands) {
        const output = await runShareTerminalCommand(terminal, command)
        sendTerminalUpdate(connection, `${command}\r\n${output}${terminal.prompt}`)
    }
}

function parseTerminalMessage(message: RawData) {
    try {
        const parsed = JSON.parse(message.toString()) as { type?: string, content?: string }

        if (typeof parsed.type !== 'string') {
            return null
        }

        return {
            type: parsed.type,
            content: typeof parsed.content === 'string' ? parsed.content : '',
        }
    } catch {
        return {
            type: 'terminalInput',
            content: message.toString(),
        }
    }
}

async function runShareTerminalCommand(terminal: ShareTerminal, command: string) {
    const [program, ...args] = command.split(/\s+/)

    switch (program) {
        case 'pwd':
            return `${terminal.root}\r\n`
        case 'ls':
            return `${await listShareTerminalDirectory(terminal.root, args)}\r\n`
        case 'clear':
            return '\u001Bc'
        case 'help':
            return 'Available commands: pwd, ls, clear, help\r\n'
        default:
            return `${program}: command is not available in this browser terminal\r\n`
    }
}

async function listShareTerminalDirectory(root: string, args: string[]) {
    const visibleArgs = args.filter(arg => !arg.startsWith('-'))
    const target = visibleArgs[0] ? path.resolve(root, visibleArgs[0]) : root

    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        return 'Cannot list paths outside this workspace.'
    }

    try {
        const entries = await fs.promises.readdir(target, { withFileTypes: true })
        return entries
            .map(entry => `${entry.name}${entry.isDirectory() ? '/' : ''}`)
            .sort((a, b) => a.localeCompare(b))
            .join('  ') || '.'
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
}

function sendTerminalUpdate(connection: WebSocket, content: string) {
    if (connection.readyState !== WebSocket.OPEN) {
        return
    }

    connection.send(JSON.stringify({
        type: 'update',
        content,
        participants: 1,
    }))
}

async function recordWebsocketFailure(kind: string, id: string, error: unknown) {
    await recordLog({
        level: 'warn',
        message: `Websocket ${kind} failure for ${id}: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
            category: 'websocket_failure',
            kind,
            id,
        },
    }).catch(() => {})
}
