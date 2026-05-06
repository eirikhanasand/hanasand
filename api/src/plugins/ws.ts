import fp from 'fastify-plugin'
import WebSocket from 'ws'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { registerClient } from '#utils/ws/registerClient.ts'
import { removeClient } from '#utils/ws/removeClient.ts'
import config from '#constants'
import followTest from '../handlers/test/follow.ts'
import { gpt, handleGptMessage, sendGptSnapshot, unregisterGptSocket } from '#utils/ws/handleGptMessage.ts'
import recordLog from '#utils/logs/recordLog.ts'

type PendingUpdates = {
    content: string
    timer: NodeJS.Timeout
}

const messageBuffer: Buffer[] = []

export const pwnedClients = new Map<string, Set<WebSocket>>()
export const testClients = new Map<string, Set<WebSocket>>()
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
})

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
