import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

// Use the established organization's immutable ID, never a user-editable name.
const hanasandOrganizationId = '3e735e7b-4d7f-444d-9806-231fa26cfcec'

export async function getManagementOrganizations(req: FastifyRequest<{ Querystring: { access?: string } }>, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    res.header('cache-control', 'no-store')
    if (!valid || !id) return res.status(401).send({ error: 'Unauthorized.' })
    const access = await run(`
        SELECT 1 FROM organization_members m
        JOIN organizations o ON o.id = m.organization_id AND o.status = 'active'
        JOIN users u ON u.id = m.user_id AND u.active = TRUE AND u.deletion_scheduled_at IS NULL
        WHERE m.user_id = $1 AND m.organization_id = $2
          AND m.status = 'active' AND m.role IN ('owner', 'admin')
        LIMIT 1
    `, [id, hanasandOrganizationId])
    if (!access.rows.length) return res.status(403).send({ error: 'Hanasand organization administrator access required.' })
    if (req.query.access === '1') return res.send({ allowed: true })
    const result = await run(`
        SELECT o.id, o.name, o.slug, o.status, o.created_at,
            (SELECT COUNT(*)::int FROM organization_members m
             JOIN users u ON u.id = m.user_id AND u.active = TRUE AND u.deletion_scheduled_at IS NULL
             WHERE m.organization_id = o.id AND m.status = 'active') AS member_count
        FROM organizations o
        ORDER BY lower(o.name), o.id
    `)
    return res.send({ organizations: result.rows })
}
