import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import indexHandler from './handlers/index.ts'
import loginHandler from './handlers/auth/login.ts'
import getUser from './handlers/user/get.ts'
import postUser from './handlers/user/post.ts'
import logoutHandler from './handlers/auth/logout.ts'
import postPwned from './handlers/pwned/post.ts'
import tokenHandler from './handlers/auth/token.ts'
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
import getUsers from './handlers/user/getUsers.ts'
import deleteArticle from './handlers/articles/delete.ts'
import getThought from './handlers/thoughts/get.ts'
import getThoughts from './handlers/thoughts/getThoughts.ts'
import postThought from './handlers/thoughts/post.ts'
import putThought from './handlers/thoughts/put.ts'
import deleteThought from './handlers/thoughts/delete.ts'
import getRandomThought from './handlers/thoughts/getRandomThought.ts'
import postThoughtByTitle from './handlers/thoughts/postThoughtByTitle.ts'
import assignRole from './handlers/roles/assignRole.ts'
import unassignRole from './handlers/roles/unassignRole.ts'
import putSelf from './handlers/user/putSelf.ts'
import getVisits from './handlers/test/getVisits.ts'
import getCertificate from './handlers/certificates/get.ts'
import postCertificate from './handlers/certificates/post.ts'
import putCertificate from './handlers/certificates/put.ts'
import deleteCertificate from './handlers/certificates/delete.ts'
import getUserCertificates from './handlers/certificates/getUserCertificates.ts'
import getVM from './handlers/vms/get.ts'
import postVM from './handlers/vms/post.ts'
import getAccessibleVMs from './handlers/vms/getAccessibleVMs.ts'
import deleteVM from './handlers/vms/delete.ts'
import getVMMetrics from './handlers/vms/metrics/get.ts'
import postVMMetrics from './handlers/vms/metrics/post.ts'
import putVMMetrics from './handlers/vms/metrics/put.ts'
import deleteVMMetrics from './handlers/vms/metrics/delete.ts'
import getVMNames from './handlers/vms/getNames.ts'
import postVMDetails from './handlers/vms/postVMDetails.ts'
import deleteVMs from './handlers/vms/deleteVMs.ts'
import shutdownVMs from './handlers/vms/shutdown.ts'
import getVMDetails from './handlers/vms/getVMDetails.ts'

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
    fastify.get('/users', getUsers)
    fastify.get('/user/:id', getUser)
    fastify.get('/user/full/:id', authorizedUserHandler)
    fastify.post('/user', postUser)
    fastify.put('/user', putUser)
    fastify.put('/user/self', putSelf)
    fastify.delete('/user/:id', deleteUser)
    fastify.delete('/user/self', deleteUser)

    // Roles handlers
    fastify.get('/role/:id', getRole)
    fastify.get('/roles', getRoles)
    fastify.get('/roles/user/:id', getRolesForUser)
    fastify.post('/role', postRole)
    fastify.post('/role/assign/:id', assignRole)
    fastify.post('/role/unassign/:id', unassignRole)
    fastify.put('/role/:id', putRole)
    fastify.delete('/role/:id', deleteRole)

    // Pwned handler
    fastify.post('/pwned', postPwned)

    // Article handlers
    fastify.get('/articles', getArticles)
    fastify.get('/article/:id', getArticle)
    fastify.post('/article', postArticle)
    fastify.put('/article/:id', putArticle)
    fastify.delete('/article/:id', deleteArticle)

    // Test handlers
    fastify.get('/test/:id', getTest)
    fastify.get('/test/visits/:id', getVisits)
    fastify.post('/test', postTest)

    // Restart handler
    fastify.get('/restart/:id', restartHandler)

    // Thought handlers
    fastify.get('/thoughts', getThoughts)
    fastify.get('/thought/:id', getThought)
    fastify.get('/thought/random', getRandomThought)
    fastify.post('/thoughts', postThought)
    fastify.post('/thought/title', postThoughtByTitle)
    fastify.put('/thought/:id', putThought)
    fastify.delete('/thought/:id', deleteThought)

    // certificates
    fastify.get('/certificates/:id', getCertificate)
    fastify.get('/certificates/user/:id', getUserCertificates)
    fastify.post('/certificates', postCertificate)
    fastify.put('/certificates/:id', putCertificate)
    fastify.delete('/certificates/:id', deleteCertificate)

    // vms
    fastify.get('/vm/:id', getVM)
    fastify.get('/vm/details/:name', getVMDetails)
    fastify.get('/vms', getVM)
    fastify.get('/vms/names', getVMNames)
    fastify.get('/vms/:user', getVM)
    fastify.get('/vms/access/:user', getAccessibleVMs)
    fastify.post('/vm', postVM)
    fastify.post('/vm/details', postVMDetails)
    fastify.post('/vms/shutdown', shutdownVMs)
    fastify.delete('/vm/:id', deleteVM)
    fastify.delete('/vms', deleteVMs)

    // vm metrics
    fastify.get('/vm/metrics/:id', getVMMetrics)
    fastify.post('/vm/metrics', postVMMetrics)
    fastify.put('/vm/metrics/:id', putVMMetrics)
    fastify.delete('/vm/metrics/:id', deleteVMMetrics)
}
