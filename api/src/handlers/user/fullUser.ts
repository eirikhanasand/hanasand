import type { FastifyReply, FastifyRequest } from 'fastify'
import { validateSession } from '#utils/auth/session.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import run from '#db'

/**
 * Fetches internal info for a user based on `id`
 *
 * Required parameter: `id`
 * Requires header: `Authorization: Bearer <token>`
 *
 * @param req Incoming Fastify Request
 * @param res Outgoing Fastify Response
 *
 * @returns Fastify Response
 */
export default async function authorizedUserHandler(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing id.' })
    }

    const authHeader = req.headers['authorization']
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send({ error: 'Missing or invalid Authorization header.' })
    }

    const token = authHeader.split(' ')[1]

    try {
        const impersonating = req.headers['x-impersonate-id']
        const session = impersonating
            ? null
            : await validateSession({ id, token })
        if (!session) {
            const auth = await tokenWrapper(req, res)
            if (!auth.valid || auth.id !== id) {
                return res.status(401).send({ error: 'Invalid token.' })
            }

            const userResult = await run(`
                SELECT id, name, avatar, active, deletion_scheduled_at
                FROM users
                WHERE id = $1
                  AND active IS TRUE
                  AND deletion_scheduled_at IS NULL
                LIMIT 1
            `, [id])
            if (!userResult.rows.length) {
                return res.status(404).send({ error: 'User not found.' })
            }
            const roleResult = await run(`
                SELECT r.id, r.name, r.description, r.priority
                FROM roles r
                JOIN user_roles ur ON ur.role_id = r.id
                WHERE ur.user_id = $1
                ORDER BY r.priority ASC, r.id ASC
            `, [id])
            return res.send({
                ...userResult.rows[0],
                roles: roleResult.rows,
            })
        }
        return res.send({
            ...session.user,
            roles: session.roles,
            token: session.refreshed.token,
            expires_at: session.refreshed.expires_at,
        })
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
