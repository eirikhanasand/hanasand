import type { FastifyReply, FastifyRequest } from 'fastify'
import crypto from 'crypto'
import { validateSession } from './session.ts'
import run from '#db'

type Valid = {
    valid: boolean
    id?: string
    authenticatedId?: string
    impersonating?: boolean
    error?: string
}

type ImpersonationTarget = {
    id: string
    name: string
}

type ImpersonationSession = {
    id: string
    actor_id: string
    target_id: string
    target_name: string
}

function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

function hashImpersonationToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

async function getImpersonationSession(token: string, actorId: string): Promise<ImpersonationSession | null> {
    const result = await run(`
        SELECT
            s.id,
            s.actor_id,
            s.target_id,
            u.name AS target_name
        FROM impersonation_sessions s
        JOIN users u
          ON u.id = s.target_id
         AND u.active IS TRUE
         AND u.deletion_scheduled_at IS NULL
        WHERE s.token_hash = $1
          AND s.actor_id = $2
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
        LIMIT 1
    `, [hashImpersonationToken(token), actorId])
    return result.rows[0] as ImpersonationSession | undefined ?? null
}

function isSensitiveImpersonatedRequest(req: FastifyRequest) {
    const method = (req.method || '').toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return false
    }

    const path = (req.url || '').split('?')[0] || ''
    if (path.startsWith('/api/impersonation') || path.startsWith('/impersonation')) {
        return false
    }

    return [
        '/api/auth/sessions',
        '/api/user/self',
        '/api/user/restore',
        '/api/user/',
        '/api/role',
        '/api/roles',
        '/api/rate-limit',
        '/api/system/cron',
        '/api/certificates',
        '/auth/sessions',
        '/user/self',
        '/user/restore',
        '/user/',
        '/role',
        '/roles',
        '/rate-limit',
        '/system/cron',
        '/certificates',
    ].some(prefix => path.startsWith(prefix))
}

async function auditImpersonationRequest(req: FastifyRequest, actorId: string, targetId: string, sessionId?: string) {
    const method = req.method || ''
    const path = (req.url || '').split('?')[0] || ''
    const userAgent = String(req.headers['user-agent'] || '')
    await run(`
        INSERT INTO impersonation_events (session_id, actor_id, target_id, method, path, ip, user_agent)
        SELECT $1, $2, $3, $4, $5, $6, $7
        WHERE NOT EXISTS (
            SELECT 1
            FROM impersonation_events
            WHERE actor_id = $2
              AND target_id = $3
              AND method = $4
              AND path = $5
              AND created_at > NOW() - INTERVAL '5 minutes'
        )
    `, [sessionId || null, actorId, targetId, method, path, req.ip, userAgent]).catch(error => {
        req.log.warn({ error, actorId, targetId, method, path }, 'Failed to audit impersonation request')
    })
}

/**
 * Token wrapper helper function. Used to check whether a `token` is valid
 * before allowing API access, for example when updating and deleting packages
 * from the `allow` or `block` lists.
 *
 * @param req Fastify Request
 * @param res Fastify Response
 *
 * @returns Object with a `valid` parameter, and optionally an `error` parameter
 * if an error occured while verifying the token.
 */
export default async function tokenWrapper(req: FastifyRequest, res: FastifyReply): Promise<Valid> {
    const authHeader = req.headers['authorization']
    const id = headerValue(req.headers['id'])
    const impersonationToken = headerValue(req.headers['x-impersonation-token'])
    const cachedSession = (req as FastifyRequest & {
        rateLimitSession?: Awaited<ReturnType<typeof validateSession>>
        apiKeyAuth?: {
            ownerId: string
        }
    }).rateLimitSession
    const apiKeyAuth = (req as FastifyRequest & {
        apiKeyAuth?: {
            ownerId: string
        }
    }).apiKeyAuth

    if (apiKeyAuth?.ownerId) {
        req.headers.id = apiKeyAuth.ownerId
        return {
            valid: true,
            id: apiKeyAuth.ownerId,
        }
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            valid: false,
            id,
            error: 'Unauthorized.'
        }
    }

    const token = authHeader.split(' ')[1]

    try {
        const session = cachedSession && cachedSession.user.id === id
            ? cachedSession
            : await validateSession({ id, token })
        if (!session) {
            return {
                valid: false,
                id,
                error: 'Unauthorized.'
            }
        }

        let effectiveId = session.user.id
        let target: ImpersonationTarget | null = null
        let impersonationSessionId: string | undefined
        let impersonating = false
        if (impersonationToken) {
            const serverSession = await getImpersonationSession(impersonationToken, session.user.id)
            if (!serverSession) {
                return {
                    valid: false,
                    id: session.user.id,
                    authenticatedId: session.user.id,
                    error: 'Impersonation session expired.'
                }
            }
            effectiveId = serverSession.target_id
            target = { id: serverSession.target_id, name: serverSession.target_name }
            impersonationSessionId = serverSession.id
            impersonating = true
        }

        if (impersonating && isSensitiveImpersonatedRequest(req)) {
            return {
                valid: false,
                id: effectiveId,
                authenticatedId: session.user.id,
                impersonating: true,
                error: 'Return to own view before changing account, security, or system settings.'
            }
        }

        req.headers.id = effectiveId
        if (impersonating) {
            req.headers['x-authenticated-id'] = session.user.id
        }
        res.header('x-access-token', session.refreshed.token)
        res.header('x-access-token-expires-at', session.refreshed.expires_at)
        if (impersonating) {
            res.header('x-impersonating-id', effectiveId)
            if (target?.name) {
                res.header('x-impersonating-name', target.name)
            }
            res.header('x-authenticated-id', session.user.id)
            if (impersonationSessionId) {
                res.header('x-impersonation-session-id', impersonationSessionId)
            }
            void auditImpersonationRequest(req, session.user.id, effectiveId, impersonationSessionId)
        }
        return { valid: true, id: effectiveId, authenticatedId: session.user.id, impersonating }
    } catch (error) {
        res.log.error(error)
        res.status(500).send({
            valid: false,
            id,
            error: 'Internal server error'
        })

        return {
            valid: false,
            id,
            error: 'Internal server error'
        }
    }
}
