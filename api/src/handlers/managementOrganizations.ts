import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { canEditHanasandInternalPages, canViewHanasandInternalPages, HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPagePolicy.ts'
import { roleCanEditOrganization } from '#utils/organizationRoles.ts'

export async function getManagementOrganizations(req: FastifyRequest<{ Querystring: { access?: string, internalPages?: string } }>, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    res.header('cache-control', 'no-store')
    if (!valid || !id) return res.status(401).send({ error: 'Unauthorized.' })
    const access = await run(`
        SELECT o.id AS organization_id, o.status AS organization_status,
               m.status AS membership_status, m.role
        FROM organization_members m
        JOIN organizations o ON o.id = m.organization_id AND o.status = 'active'
        JOIN users u ON u.id = m.user_id AND u.active = TRUE AND u.deletion_scheduled_at IS NULL
        WHERE m.user_id = $1 AND m.organization_id = $2
          AND m.status = 'active'
        LIMIT 1
    `, [id, HANASAND_ORGANIZATION_ID])
    if (req.query.internalPages === '1') {
        const member = access.rows[0]
        const membership = member && {
            organizationId: member.organization_id,
            organizationStatus: member.organization_status,
            membershipStatus: member.membership_status,
            role: member.role,
        }
        return res.send({
            allowed: Boolean(membership && canViewHanasandInternalPages(membership)),
            canEdit: Boolean(membership && canEditHanasandInternalPages(membership)),
        })
    }
    const canManageOrganizations = access.rows.some(member => roleCanEditOrganization(member.role))
    if (req.query.access === '1') return res.send({ allowed: canManageOrganizations })
    if (!canManageOrganizations) return res.status(403).send({ error: 'Hanasand organization administrator access required.' })
    const result = await run(`
        SELECT o.id, o.name, o.slug, o.status, o.created_at,
            GREATEST(o.updated_at,
                (SELECT MAX(e.created_at) FROM system_events e
                 WHERE e.organization_id = o.id AND e.outcome = 'success'),
                (SELECT MAX(k.last_used_at) FROM api_keys k WHERE k.organization_id = o.id)
            ) AS last_active_at,
            (SELECT COUNT(*)::int FROM organization_members m
             JOIN users u ON u.id = m.user_id AND u.active = TRUE AND u.deletion_scheduled_at IS NULL
             WHERE m.organization_id = o.id AND m.status = 'active') AS member_count
        FROM organizations o
        WHERE o.status <> 'deleted'
        ORDER BY lower(o.name), o.id
    `)
    return res.send({ organizations: result.rows })
}
