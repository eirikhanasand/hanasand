import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

/**
 * GET /roles/user/:id
 * Fetches all roles for the given user
 */
export default async function getRolesForUser(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing user id.' })
    }

    try {
        const result = await run(`SELECT * FROM user_roles WHERE user_id = $1`, [id])
        if (!result.rows.length) {
            return res.status(404).send({ error: 'No roles found.' })
        }

        return res.send(result.rows)
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
