import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { loadSQL } from '#utils/loadSQL.ts'

/**
 * Fetches all users and their highest role.
 *
 * @param req Incoming Fastify Request
 * @param res Outgoing Fastify Response
 *
 * @returns Fastify Response
 */
export default async function getUsers(req: FastifyRequest, res: FastifyReply) {
    const { valid, impersonating } = await tokenWrapper(req, res)
    if (res.sent) return
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    res.header('Cache-Control', 'private, no-store')
    try {
        const canViewEmail = !impersonating && (await hasRole(req, res, 'user_admin')).valid
        const usersQuery = await loadSQL('getUsers.sql')
        const usersResult = await run(usersQuery, [canViewEmail])
        if (!usersResult.rows.length) {
            return res.status(404).send({ error: 'There are no users.' })
        }

        return res.send(usersResult.rows)
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
