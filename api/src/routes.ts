import indexHandler from './handlers/index.js'
import { loginHandler, loginCallbackHandler } from './handlers/auth/get.js'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

/**
 * Defines the routes available in the API.
 * 
 * @param fastify Fastify Instance
 * @param _ Fastify Plugin Options
 */
export default async function apiRoutes(fastify: FastifyInstance, _: FastifyPluginOptions) {
    // Index handler
    fastify.get('/', indexHandler)

    // Login handlers
    fastify.get('/oauth2/login', loginHandler)
    fastify.get('/oauth2/callback', loginCallbackHandler)
}
