import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { loadSQL } from '#utils/loadSQL.ts'
import hasRole from '#utils/auth/hasRole.ts'
import run from '#db'

/**
 * POST /role/unassign
 * Unassigns a role from a user
 */
export default async function unassignRole(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'user_admin')
    if (!valid || !validRole) {
        return res.status(401).send({ status: false, error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string } ?? {}
    const { role_id  } = req.body as { role_id: string } ?? {}
    if (!id || !role_id) {
        return res.status(400).send({ status: false, error: 'Missing user id (id) or role id (role_id).' })
    }

    try {
        const query = await loadSQL('unassignRole.sql')
        const result = await run(query, [id, role_id])
        if (!result.rows.length) {
            return res.status(404).send({ status: false, error: 'No roles found.' })
        }

        return res.send({ status: true, data: result.rows[0] })
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
