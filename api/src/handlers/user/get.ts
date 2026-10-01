import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'

/**
 * Fetches the `name` and `avatar` for a user based on `id`.
 *
 * Required parameter: `id`
 *
 * @param req Incoming Fastify Request
 * @param res Outgoing Fastify Response
 *
 * @returns Fastify Response
 */
export default async function userHandler(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing id.' })
    }

    res.header('Cache-Control', 'private, no-store')
    try {
        const viewer = await tokenWrapper(req, res)
        if (res.sent) return
        if (!viewer.valid || !viewer.id) {
            return res.status(401).send({ error: 'Unauthorized.' })
        }

        const canViewEmail = !viewer.impersonating && (await hasHanasandInternalRouteAccess(req)).valid
        const userResult = await run(`
            SELECT
                CASE WHEN $2::boolean THEN profile_user.email ELSE NULL END AS email,
                profile_user.id,
                COALESCE(profile_user.username, profile_user.id) AS username,
                profile_user.name,
                profile_user.avatar,
                profile_user.active,
                profile_user.deactivated_at,
                profile_user.deactivated_by,
                profile_user.deletion_requested_at,
                profile_user.deletion_scheduled_at
            FROM users profile_user
            WHERE (profile_user.id = $1 OR lower(COALESCE(profile_user.username, profile_user.id)) = lower($1))
              AND (
                  profile_user.id = $3
                  OR EXISTS (
                      SELECT 1
                      FROM organization_members viewer_membership
                      JOIN organizations shared_organization
                        ON shared_organization.id = viewer_membership.organization_id
                       AND shared_organization.status = 'active'
                      JOIN organization_members profile_membership
                        ON profile_membership.organization_id = viewer_membership.organization_id
                       AND profile_membership.user_id = profile_user.id
                       AND profile_membership.status = 'active'
                      JOIN users viewer_user
                        ON viewer_user.id = viewer_membership.user_id
                       AND viewer_user.active IS TRUE
                       AND viewer_user.deletion_scheduled_at IS NULL
                      WHERE viewer_membership.user_id = $3
                        AND viewer_membership.status = 'active'
                  )
              )
            LIMIT 1
        `, [id, canViewEmail, viewer.id])
        if (!userResult.rows.length) {
            return res.status(404).send({ error: `There is no user with id ${id}` })
        }

        const user: User = userResult.rows[0]
        return res.send(user)
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
