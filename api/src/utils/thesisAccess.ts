import type { FastifyRequest } from 'fastify'
import { performance } from 'node:perf_hooks'
import run from '#db'
import { validateSession } from '#utils/auth/session.ts'

export async function thesisAccess(id: string, token: string) {
    const sessionStarted = performance.now()
    const session = await validateSession({ id, token })
    const sessionMs = performance.now() - sessionStarted
    if (!session) return { session: null, member: false, sessionMs, membershipMs: 0 }

    const membershipStarted = performance.now()
    const result = await run(`
        SELECT EXISTS (
            SELECT 1 FROM organization_members m
            JOIN organizations o ON o.id = m.organization_id
            WHERE m.user_id = $1 AND m.status = 'active'
              AND o.slug = 'hanasand' AND o.status = 'active'
        ) AS is_member
    `, [session.user.id])
    return {
        session,
        member: result.rows[0]?.is_member === true,
        sessionMs,
        membershipMs: performance.now() - membershipStarted,
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
