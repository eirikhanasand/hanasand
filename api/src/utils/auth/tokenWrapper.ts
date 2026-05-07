import type { FastifyReply, FastifyRequest } from 'fastify'
import { validateSession } from './session.ts'
import run from '#db'

type Valid = {
    valid: boolean
    id?: string
    authenticatedId?: string
    impersonating?: boolean
    error?: string
}

type RoleRow = {
    id: string
    name?: string
}

type ImpersonationTarget = {
    id: string
    name: string
}

function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

function isAdminRole(role: RoleRow) {
    const id = role.id.toLowerCase()
    const name = (role.name || '').toLowerCase()
    return id === 'administrator'
        || id === 'system_admin'
        || id === 'user_admin'
        || id.includes('admin')
        || name.includes('admin')
}

async function getImpersonationTarget(id: string): Promise<ImpersonationTarget | null> {
    const result = await run(`
        SELECT id, name
        FROM users
        WHERE id = $1
          AND active IS TRUE
          AND deletion_scheduled_at IS NULL
        LIMIT 1
    `, [id])
    return result.rows[0] as ImpersonationTarget | undefined ?? null
}

async function auditImpersonationRequest(req: FastifyRequest, actorId: string, targetId: string) {
    const method = req.method || ''
    const path = (req.url || '').split('?')[0] || ''
    const userAgent = String(req.headers['user-agent'] || '')
    await run(`
        INSERT INTO impersonation_events (actor_id, target_id, method, path, ip, user_agent)
        SELECT $1, $2, $3, $4, $5, $6
        WHERE NOT EXISTS (
            SELECT 1
            FROM impersonation_events
            WHERE actor_id = $1
              AND target_id = $2
              AND method = $3
              AND path = $4
              AND created_at > NOW() - INTERVAL '5 minutes'
        )
    `, [actorId, targetId, method, path, req.ip, userAgent]).catch(error => {
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
    const impersonateId = headerValue(req.headers['x-impersonate-id'])
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
        let impersonating = false
        if (impersonateId && impersonateId !== session.user.id) {
            if (!session.roles.some(isAdminRole)) {
                return {
                    valid: false,
                    id: session.user.id,
                    authenticatedId: session.user.id,
                    error: 'Only admins can impersonate users.'
                }
            }

            target = await getImpersonationTarget(impersonateId)
            if (!target) {
                return {
                    valid: false,
                    id: session.user.id,
                    authenticatedId: session.user.id,
                    error: 'Impersonated user not found.'
                }
            }

            effectiveId = impersonateId
            impersonating = true
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
            void auditImpersonationRequest(req, session.user.id, effectiveId)
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
