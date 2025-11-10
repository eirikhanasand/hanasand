import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { loadSQL } from '#utils/loadSQL.ts'
import hasRole from '#utils/auth/hasRole.ts'
import hasPermissionToModifyRole from '#utils/auth/hasPermissionToModifyRole.ts'

/**
 * POST /role/assign
 * Assigns a role to a user
 */
export default async function assignRole(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'user_admin')
    const { valid: hasPermission } = await hasPermissionToModifyRole(req, res)
    if (!valid || !validRole || !hasPermission) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string } ?? {}
    const { role_id  } = req.body as { role_id: string } ?? {}
    if (!id || !role_id) {
        return res.status(404).send({ error: 'Missing user id (id) or role id (role_id).' })
    }

    try {
        const query = await loadSQL('assignRole.sql')
        const result = await run(query, [id, role_id])
        if (!result.rows.length) {
            return res.status(404).send({ error: 'No roles found.' })
        }

        return res.send(result.rows)
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
