import type { FastifyReply, FastifyRequest } from 'fastify'
import { loadSQL } from '#utils/loadSQL.ts'
import run from '#db'
import { serviceAccountEndpoints } from './serviceAccountScopes.ts'
import { matchApiKeyScope } from './apiKeys.ts'
import { canViewHanasandInternalRoute, hasHanasandInternalPageAccess } from './organizationPageAccess.ts'
import type { validateSession } from './session.ts'

type Valid = {
    valid: boolean
    error?: string
}

/**
 * Role wrapper helper function. Used to check whether a role has higher access
 * than the target role, before allowing API access, for example when updating
 * or deleting roles.
 *
 * @param req Fastify Request
 * @param res Fastify Response
 *
 * @returns Object with a `valid` parameter, and optionally an `error` parameter
 * if an error occured while checking the roles.
 */
export default async function hasRole(req: FastifyRequest, res: FastifyReply, role: string): Promise<Valid> {
    const service = (req as FastifyRequest & { apiKeyAuth?: { serviceAccount?: boolean, apiKey: { scopes: ApiKeyScopeRule[] } } }).apiKeyAuth
    if (service?.serviceAccount) {
        const route = req.routeOptions?.url || req.url.split('?')[0]
        return { valid: Boolean(matchApiKeyScope(service.apiKey.scopes, req.method, route)
            && serviceAccountEndpoints.some(endpoint => endpoint.method === req.method && endpoint.route === route && endpoint.role === role)) }
    }
    const apiKeyOwnerId = (req as FastifyRequest & {
        apiKeyAuth?: {
            ownerId: string
        }
    }).apiKeyAuth?.ownerId
    const id = apiKeyOwnerId || req.headers['id']
    if (!id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!role) {
        return {
            valid: false,
            error: 'No target role provided.'
        }
    }

    try {
        // The boundary has already read current roles for this request. Never
        // reuse the actor's roles for a different impersonated user or API key.
        const session = (req as FastifyRequest & { rateLimitSession?: Awaited<ReturnType<typeof validateSession>> }).rateLimitSession
        let hasRole = false
        if (!apiKeyOwnerId && session?.user.id === id) {
            hasRole = session.roles.some(entry => entry.id === role)
        } else {
            const roleQuery = await loadSQL('hasRole.sql')
            const { rows } = await run(roleQuery, [id!, role])
            hasRole = rows[0]?.has_role === true
        }

        if (hasRole) return { valid: true }

        const route = req.routeOptions?.url || req.url.split('?')[0]
        if (role === 'system_admin' && !apiKeyOwnerId && canViewHanasandInternalRoute(req.method, route)
            && await hasHanasandInternalPageAccess(String(id))) {
            return { valid: true }
        }

        return { valid: false, error: 'Unauthorized.' }
    } catch (error) {
        res.log.error(error)
        return { valid: false, error: 'Internal server error' }
    }
}
