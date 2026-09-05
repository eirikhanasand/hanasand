import type { FastifyInstance } from 'fastify'
import loginHandler from './handlers/auth/login.ts'
import {
    deletePasskey,
    getPasskeys,
    getPasskeyAuthenticateOptions,
    getPasskeyRegisterOptions,
    patchPasskey,
    postPasskeyAuthenticateVerify,
    postPasskeyRegisterVerify,
} from './handlers/auth/passkeys.ts'
import { getSsoStart, postSsoCallback } from './handlers/auth/sso.ts'
import logoutHandler from './handlers/auth/logout.ts'
import tokenHandler from './handlers/auth/token.ts'
import { completePasswordReset, requestPasswordReset, verifyPasswordResetCode } from './handlers/auth/passwordReset.ts'
import { getSessions, revokeSession, revokeSessions } from './handlers/auth/sessions.ts'

// Shared by the API and the independently deployed authentication workers.
export default async function authRoutes(fastify: FastifyInstance) {
    // Auth handlers
    fastify.get('/auth/logout/:id', logoutHandler)
    fastify.get('/auth/token/:id', tokenHandler)
    fastify.get('/auth/sessions', getSessions)
    fastify.post('/auth/login/:id', loginHandler)
    fastify.get('/auth/passkeys', getPasskeys)
    fastify.patch('/auth/passkeys/:credentialId', patchPasskey)
    fastify.delete('/auth/passkeys/:credentialId', deletePasskey)
    fastify.get('/auth/passkeys/register/options', getPasskeyRegisterOptions)
    fastify.post('/auth/passkeys/register/verify', postPasskeyRegisterVerify)
    fastify.get('/auth/passkeys/authenticate/options', getPasskeyAuthenticateOptions)
    fastify.post('/auth/passkeys/authenticate/verify', postPasskeyAuthenticateVerify)
    fastify.get('/auth/sso/start', getSsoStart)
    fastify.post('/auth/sso/callback', postSsoCallback)
    fastify.post('/auth/password-reset/request', requestPasswordReset)
    fastify.post('/auth/password-reset/verify', verifyPasswordResetCode)
    fastify.post('/auth/password-reset/complete', completePasswordReset)
    fastify.post('/auth/sessions/revoke', revokeSessions)
    fastify.delete('/auth/sessions/:token_id', revokeSession)
}
