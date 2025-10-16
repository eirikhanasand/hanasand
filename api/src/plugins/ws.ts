import fp from 'fastify-plugin'
import WebSocket from 'ws'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { registerClient } from '#utils/ws/registerClient.ts'
import { removeClient } from '#utils/ws/removeClient.ts'
import config from '#constants'

export default fp(async function wsSharePlugin(fastify: FastifyInstance) {
    fastify.register(async function (fastify) {
        fastify.get('/api/bloom/ws/:id', { websocket: true }, (connection, req: FastifyRequest) => {
            const id = (req.params as { id: string}).id
            
            registerClient(id, connection)
            
            const internalWs = new WebSocket(`${config.bloom_ws}${id}`)

            internalWs.on('message', (msg) => {
                connection.send(msg)
            })

            connection.on('message', (msg) => {
                internalWs.send(msg)
            })

            connection.on('close', () => {
                removeClient(id, connection)
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

    })
})
