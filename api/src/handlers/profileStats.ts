import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { ARTICLES_DIR } from '#utils/git/git.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

const isNotFound = (error: unknown): boolean =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'

export async function getProfileStats(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) return res.status(401).send({ error: 'Unauthorized.' })
    if (auth.impersonating || auth.id !== req.params.id) return res.status(403).send({ error: 'Forbidden.' })

    try {
        const { valid: admin } = await hasHanasandInternalRouteAccess(req)
        const [activity, totals, memberships, articleOwnership] = await Promise.all([
            run(`
                SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*)::int AS logins
                FROM login_events
                WHERE user_id = $1 AND status = 'success'
                GROUP BY day
                ORDER BY day
            `, [auth.id]),
            run(`
                WITH memberships AS (
                    SELECT om.organization_id
                    FROM organization_members om
                    JOIN organizations o ON o.id = om.organization_id
                    WHERE om.user_id = $1 AND om.status = 'active' AND o.status = 'active'
                )
                SELECT
                    (SELECT COUNT(*)::int FROM memberships) AS organizations,
                    (SELECT COUNT(*)::int
                     FROM vms v LEFT JOIN vm_details d ON LOWER(d.name) = LOWER(v.name)
                     WHERE v.deleted_at IS NULL
                       AND ($2::boolean OR vm_user_has_access(v.name, $1))
                       AND LOWER(COALESCE(d.type, '')) = 'container') AS containers,
                    (SELECT COUNT(*)::int
                     FROM vms v LEFT JOIN vm_details d ON LOWER(d.name) = LOWER(v.name)
                     WHERE v.deleted_at IS NULL
                       AND ($2::boolean OR vm_user_has_access(v.name, $1))
                       AND LOWER(COALESCE(d.type, '')) = 'virtual-machine') AS vms,
                    (SELECT COUNT(*)::int
                     FROM share s
                     WHERE COALESCE(s.parent, '') = ''
                       AND ((s.organization_id IS NULL AND s.owner = $1)
                         OR s.organization_id IN (SELECT organization_id FROM memberships))) AS shares
            `, [auth.id, admin]),
            run(`
                SELECT om.organization_id
                FROM organization_members om
                JOIN organizations o ON o.id = om.organization_id
                WHERE om.user_id = $1 AND om.status = 'active' AND o.status = 'active'
            `, [auth.id]),
            run(`
                SELECT id, owner_id, organization_id
                FROM article_ownership
            `),
        ])
        const counts = totals.rows[0]
        if (!counts) return res.status(404).send({ error: 'Profile not found.' })

        const organizationIds = new Set<string>(memberships.rows.map(row => row.organization_id))
        const ownershipById = new Map<string, { owner_id: string | null, organization_id: string | null }>(
            articleOwnership.rows.map(row => [row.id, row])
        )
        const articleFiles = await readdir(ARTICLES_DIR).catch(error => {
            if (isNotFound(error)) return []
            throw error
        })
        let articles = 0
        for (const id of articleFiles) {
            const ownership = ownershipById.get(id)
            const inScope = !ownership
                || (ownership.organization_id
                    ? organizationIds.has(ownership.organization_id)
                    : ownership.owner_id === auth.id)
            if (!inScope) continue
            try {
                if ((await stat(join(ARTICLES_DIR, id))).isFile()) articles++
            } catch (error) {
                if (!isNotFound(error)) throw error
            }
        }

        return res.header('Cache-Control', 'private, no-store').send({
            loginDays: activity.rows.map(row => ({ day: row.day, logins: Number(row.logins) })),
            counts: {
                organizations: Number(counts.organizations || 0),
                containers: Number(counts.containers || 0),
                vms: Number(counts.vms || 0),
                shares: Number(counts.shares || 0),
                articles,
            },
        })
    } catch (error) {
        req.log.error({ err: error }, 'Unable to load profile statistics')
        return res.status(500).send({ error: 'Unable to load profile statistics.' })
    }
}
