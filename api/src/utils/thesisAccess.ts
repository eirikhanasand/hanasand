import type { FastifyRequest } from 'fastify'
import { performance } from 'node:perf_hooks'
import { validateSession } from '#utils/auth/session.ts'

export async function thesisAccess(id: string, token: string) {
    const authorizationStarted = performance.now()
    const session = await validateSession({ id, token, organizationSlug: 'hanasand' })
    return {
        session,
        member: session?.organizationMember === true,
        authorizationMs: performance.now() - authorizationStarted,
    }
}

export async function thesisMember(id: string, token: string) {
    const access = await thesisAccess(id, token)
    return Boolean(access.session && access.member)
}

export function thesisCredentials(req: FastifyRequest) {
    const authorization = req.headers.authorization || ''
    const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(item => item.trim().split(/=(.*)/s, 2)).filter(item => item.length === 2))
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : cookies.access_token || ''
    const id = (typeof req.headers.id === 'string' ? req.headers.id : cookies.id) || ''
    return { id, token }
}
