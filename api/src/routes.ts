import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import indexHandler from './handlers/index.ts'
import loginHandler from './handlers/auth/login.ts'
import getUser from './handlers/user/get.ts'
import postUser from './handlers/user/post.ts'
import logoutHandler from './handlers/auth/logout.ts'
import postPwned from './handlers/pwned/post.ts'
import tokenHandler from './handlers/user/token.ts'
import getRole from './handlers/roles/get.ts'
import postRole from './handlers/roles/post.ts'
import putRole from './handlers/roles/put.ts'
import deleteRole from './handlers/roles/delete.ts'
import getArticles, { getArticle } from './handlers/articles/get.ts'
import postArticle from './handlers/articles/post.ts'
import putArticle from './handlers/articles/put.ts'
import getTest from './handlers/test/get.ts'
import postTest from './handlers/test/post.ts'
import restartHandler from './handlers/restart/getRestart.ts'
import getRoles from './handlers/roles/getRoles.ts'
import getRolesForUser from './handlers/roles/getRolesForUser.ts'
import putUser from './handlers/user/putUser.ts'
import deleteUser from './handlers/user/deleteUser.ts'
import authorizedUserHandler from './handlers/user/fullUser.ts'
import getRoot from './handlers/roles/getRoot.ts'

/**
 * Defines the routes available in the API.
 * 
 * @param fastify Fastify Instance
 * @param _ Fastify Plugin Options
 */
export default async function apiRoutes(fastify: FastifyInstance, _: FastifyPluginOptions) {
    // Index handler
    fastify.get('/', indexHandler)

    // Auth handlers
    fastify.get('/auth/logout/:id', logoutHandler)
    fastify.post('/auth/login/:id', loginHandler)
    fastify.get('/auth/token/:id', tokenHandler)

    // User handlers
    fastify.get('/user/:id', getUser)
    fastify.get('/user/full/:id', authorizedUserHandler)
    fastify.get('/user/root', getRoot)
    fastify.post('/user', postUser)
    fastify.put('/user', putUser)
    fastify.delete('/user', deleteUser)

    // Roles handlers
    fastify.get('/role/:id', getRole)
    fastify.get('/roles', getRoles)
    fastify.get('/roles/user/:id', getRolesForUser)
    fastify.post('/role', postRole)
    fastify.put('/role/:id', putRole)
    fastify.delete('/role/:id', deleteRole)

    // Pwned handler
    fastify.post('/pwned', postPwned)

    // Article handlers
    fastify.get('/articles', getArticles)
    fastify.get('/article/:id', getArticle)
    fastify.post('/article', postArticle)
    fastify.put('/article/:id', putArticle)

    // Test handlers
    fastify.get('/test/:id', getTest)
    fastify.post('/test', postTest)

    // Restart handler
    fastify.get('/restart/:id', restartHandler)
}
