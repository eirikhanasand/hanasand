import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

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
        const viewer = req.headers.authorization ? await tokenWrapper(req, res) : null
        if (res.sent) return
        const canViewEmail = Boolean(viewer?.valid && viewer.id && !viewer.impersonating && (await hasRole(req, res, 'user_admin')).valid)
        const userResult = await run('SELECT CASE WHEN $2::boolean THEN email ELSE NULL END AS email, id, COALESCE(username,id) AS username, name, avatar, active, deactivated_at, deactivated_by, deletion_requested_at, deletion_scheduled_at FROM users WHERE id = $1 OR lower(COALESCE(username,id)) = lower($1)', [id, canViewEmail])
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
