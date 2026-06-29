import type { FastifyReply, FastifyRequest } from 'fastify'
import crypto from 'crypto'
import { validateSession } from './session.ts'
import run from '#db'
import { recordAdminAuditEvent } from '#utils/adminAudit.ts'

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
    reason: string
    scope: string[]
    organization_id: string | null
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
            s.reason,
            u.name AS target_name,
            audit.context AS audit_context
        FROM impersonation_sessions s
        JOIN users u
          ON u.id = s.target_id
         AND u.active IS TRUE
         AND u.deletion_scheduled_at IS NULL
        LEFT JOIN LATERAL (
            SELECT context
            FROM admin_audit_events
            WHERE action_type = 'impersonation.start'
              AND entity_id = s.id::text
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        ) audit ON TRUE
        WHERE s.token_hash = $1
          AND s.actor_id = $2
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
        LIMIT 1
    `, [hashImpersonationToken(token), actorId])
    const row = result.rows[0] as (Record<string, any> & ImpersonationSession) | undefined
    if (!row) return null
    const context = row.audit_context as Record<string, unknown> | undefined
    return {
        id: row.id,
        actor_id: row.actor_id,
        target_id: row.target_id,
        target_name: row.target_name,
        reason: row.reason || '',
        scope: normalizeStoredImpersonationScope(context?.scope),
        organization_id: typeof context?.organizationId === 'string' ? context.organizationId : null,
    }
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
    await recordAdminAuditEvent(req, {
        actionType: 'impersonation.request',
        actorId,
        targetType: 'user',
        targetId,
        entityId: sessionId || targetId,
        severity: 'notice',
        outcome: 'success',
        context: { sessionId, method, path },
    })
}

function normalizeStoredImpersonationScope(value: unknown) {
    if (!Array.isArray(value)) return []
    return Array.from(new Set(value.map(item => typeof item === 'string' ? item.trim().toLowerCase() : '').filter(Boolean)))
}

function isImpersonationScopeAllowed(req: FastifyRequest, session: ImpersonationSession) {
    const method = (req.method || '').toUpperCase()
    const path = (req.url || '').split('?')[0] || ''
    if (path.startsWith('/api/impersonation') || path.startsWith('/impersonation')) return true
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') return false
    if (session.scope.includes('support_debug')) return true
    if (path.includes('/organization') || path.includes('/organizations') || path.includes('/org/')) {
        return session.scope.includes('read_org')
    }
    return session.scope.includes('read_profile') || session.scope.includes('read_org')
}

async function auditImpersonationScopeDenied(req: FastifyRequest, session: ImpersonationSession) {
    const method = req.method || ''
    const path = (req.url || '').split('?')[0] || ''
    await recordAdminAuditEvent(req, {
        actionType: 'impersonation.scope_denied',
        actorId: session.actor_id,
        targetType: 'user',
        targetId: session.target_id,
        organizationId: session.organization_id,
        entityId: session.id,
        severity: 'warning',
        outcome: 'denied',
        reason: session.reason,
        context: {
            schemaVersion: 'support.impersonation.scope_denied.v1',
            sessionId: session.id,
            method,
            path,
            scope: session.scope,
            organizationId: session.organization_id,
            blockerCode: 'impersonation_scope_denied',
            noSilentImpersonation: true,
        },
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
        let activeImpersonationSession: ImpersonationSession | null = null
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
            activeImpersonationSession = serverSession
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

        if (impersonating && activeImpersonationSession && !isImpersonationScopeAllowed(req, activeImpersonationSession)) {
            void auditImpersonationScopeDenied(req, activeImpersonationSession)
            return {
                valid: false,
                id: effectiveId,
                authenticatedId: session.user.id,
                impersonating: true,
                error: 'Impersonation scope does not allow this request.'
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
