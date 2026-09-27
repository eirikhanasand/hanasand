import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

export async function getProfileStats(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) return res.status(401).send({ error: 'Unauthorized.' })
    if (auth.impersonating || auth.id !== req.params.id) return res.status(403).send({ error: 'Forbidden.' })

    try {
        const [activity, totals] = await Promise.all([
            run(`
                SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*)::int AS logins
                FROM login_events
                WHERE user_id = $1 AND status = 'success' AND created_at >= NOW() - INTERVAL '365 days'
                GROUP BY day
                ORDER BY day
            `, [auth.id]),
            run(`
                SELECT
                    (SELECT COUNT(*)::int
                     FROM organization_members om
                     JOIN organizations o ON o.id = om.organization_id
                     WHERE om.user_id = $1 AND om.status = 'active' AND o.status = 'active') AS organizations,
                    (SELECT COUNT(*)::int
                     FROM vms v
                     LEFT JOIN vm_details d ON LOWER(d.name) = LOWER(v.name)
                     WHERE v.owner = $1 AND v.deleted_at IS NULL
                       AND COALESCE(NULLIF(LOWER(d.config_image_type), ''), 'container') = 'container') AS containers,
                    (SELECT COUNT(*)::int
                     FROM vms v
                     LEFT JOIN vm_details d ON LOWER(d.name) = LOWER(v.name)
                     WHERE v.owner = $1 AND v.deleted_at IS NULL
                       AND COALESCE(LOWER(d.config_image_type), '') IN ('virtual-machine', 'vm')) AS vms,
                    (SELECT COUNT(*)::int
                     FROM share
                     WHERE owner = $1 AND organization_id IS NULL AND COALESCE(parent, '') = '') AS shares,
                    (SELECT COUNT(*)::int FROM article_ownership WHERE owner_id = $1) AS articles
                FROM users
                WHERE id = $1
            `, [auth.id]),
        ])
        const counts = totals.rows[0]
        if (!counts) return res.status(404).send({ error: 'Profile not found.' })

        return res.header('Cache-Control', 'private, no-store').send({
            loginDays: activity.rows.map(row => ({ day: row.day, logins: Number(row.logins) })),
            counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value || 0)])),
        })
    } catch (error) {
        req.log.error({ err: error }, 'Unable to load profile statistics')
        return res.status(500).send({ error: 'Unable to load profile statistics.' })
    }
}
