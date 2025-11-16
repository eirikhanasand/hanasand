import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { loadSQL } from '#utils/loadSQL.ts'

/**
 * GET /roles/users/highest
 * Get each user's highest-priority role
 */
export default async function getHighestRoleForEveryUser(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'user_admin')
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const query = await loadSQL('highestRoleForEveryUser.sql')
        const result = await run(query)
        return res.send(result.rows)
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
