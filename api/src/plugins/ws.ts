import fp from 'fastify-plugin'
import WebSocket from 'ws'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { registerClient } from '#utils/ws/registerClient.ts'
import { removeClient } from '#utils/ws/removeClient.ts'
import config from '#constants'

type PendingUpdates = { 
    content: string
    timer: NodeJS.Timeout
}

const messageBuffer: Buffer[] = []

export const pwnedClients = new Map<string, Set<WebSocket>>()
export const testClients = new Map<string, Set<WebSocket>>()
export const pendingUpdates = new Map<string, PendingUpdates>()

export default fp(async function wsPlugin(fastify: FastifyInstance) {
    fastify.register(async function (fastify) {
        fastify.get('/api/pwned/ws/:id', { websocket: true }, (connection, req: FastifyRequest) => {
            const id = (req.params as { id: string}).id
            
            registerClient(id, connection, pwnedClients)
            
            const internalWs = new WebSocket(`${config.pwned_ws}${id}`)

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
                    console.log(`Error occured while closing connection for id ${id}: ${error}`)
                }
            })
        })

        fastify.get('/api/test/ws/:id', { websocket: true }, (connection, req: FastifyRequest) => {
            const id = (req.params as { id: string}).id
            registerClient(id, connection, testClients)

            connection.on('close', () => {
                removeClient(id, connection, testClients)
            })
        })
    })
})
