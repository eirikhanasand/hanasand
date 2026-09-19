import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export function requestedContentOrganization(req: FastifyRequest): string | null {
    const query = req.query as { organizationId?: unknown } | undefined
    const value = req.headers['x-organization-id'] ?? query?.organizationId
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function contentOrganizationAccess(organizationId: string, userId: string, editing = false) {
    const result = await run('SELECT content_organization_access($1, $2, $3) AS allowed', [organizationId, userId, editing])
    return result.rows[0]?.allowed === true
}

export async function requireContentOrganization(req: FastifyRequest, res: FastifyReply, organizationId: string | null, editing = false) {
    if (!organizationId) return true
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id || !await contentOrganizationAccess(organizationId, id, editing)) {
        if (!res.sent) res.status(403).send({ error: 'You do not have access to this organization’s content.' })
        return false
    }
    return true
}

export async function articleOwnership(id: string) {
    const result = await run('SELECT owner_id, organization_id FROM article_ownership WHERE id = $1', [id])
    return result.rows[0] as { owner_id: string | null, organization_id: string | null } | undefined
}

export async function requireEditorialWrite(req: FastifyRequest, res: FastifyReply, organizationId: string | null) {
    if (organizationId) return requireContentOrganization(req, res, organizationId, true)
    const { valid } = await tokenWrapper(req, res)
    if (valid && (await hasRole(req, res, 'content_admin')).valid) return true
    if (!res.sent) res.status(401).send({ error: 'Unauthorized.' })
    return false
}
