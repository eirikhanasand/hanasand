import run from '#db'
import { canAccessHanasandInternalPageRoute, canEditHanasandInternalPages, canViewHanasandInternalPages, canViewHanasandInternalRoute, HANASAND_ORGANIZATION_ID } from './organizationPagePolicy.ts'
import { matchApiKeyScope } from './apiKeys.ts'
import { serviceAccountEndpoints } from './serviceAccountScopes.ts'
import type { FastifyRequest } from 'fastify'

export { canAccessHanasandInternalPageRoute, canEditHanasandInternalPages, canViewHanasandInternalPages, canViewHanasandInternalRoute, HANASAND_ORGANIZATION_ID }

export async function hasHanasandInternalRouteAccess(req: FastifyRequest): Promise<{ valid: boolean, error?: string }> {
    const route = req.routeOptions?.url || req.url.split('?')[0]
    const apiKeyAuth = (req as FastifyRequest & { apiKeyAuth?: { ownerId?: string, serviceAccount?: boolean, apiKey: { scopes: ApiKeyScopeRule[] } } }).apiKeyAuth
    if (apiKeyAuth?.serviceAccount) {
        return { valid: Boolean(matchApiKeyScope(apiKeyAuth.apiKey.scopes, req.method, route)
            && serviceAccountEndpoints.some(endpoint => endpoint.method === req.method && endpoint.route === route)) }
    }
    if (!canViewHanasandInternalRoute(req.method, route)) return { valid: false }
    const id = apiKeyAuth?.ownerId || req.headers.id
    if (typeof id !== 'string') return { valid: false }
    const membership = await getHanasandInternalMembership(id)
    return { valid: Boolean(membership && canAccessHanasandInternalPageRoute(req.method, membership)) }
}

export default hasHanasandInternalRouteAccess

export async function hasHanasandInternalPageAccess(userId: string) {
    const membership = await getHanasandInternalMembership(userId)
    return Boolean(membership && canEditHanasandInternalPages(membership))
}

export async function hasHanasandInternalPageReadAccess(userId: string) {
    return Boolean(await getHanasandInternalMembership(userId))
}

async function getHanasandInternalMembership(userId: string) {
    const result = await run(`
        SELECT organization.id AS organization_id,
               organization.status AS organization_status,
               member.status AS membership_status,
               member.role
        FROM organization_members member
        JOIN organizations organization ON organization.id = member.organization_id
        JOIN users ON users.id = member.user_id
        WHERE member.user_id = $1
          AND organization.id = $2
          AND users.active IS TRUE
          AND users.deletion_scheduled_at IS NULL
        LIMIT 1
    `, [userId, HANASAND_ORGANIZATION_ID])

    const membership = result.rows.map(row => ({
        organizationId: row.organization_id,
        organizationStatus: row.organization_status,
        membershipStatus: row.membership_status,
        role: row.role,
    })).find(canViewHanasandInternalPages)
    return membership || null
}
