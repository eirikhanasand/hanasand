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
    if (!valid || !validRole) {
        return res.status(401).send({ status: false, error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string } ?? {}
    const { role_id  } = req.body as { role_id: string } ?? {}
    if (!id || !role_id) {
        return res.status(404).send({ status: false, error: 'Missing user id (id) or role id (role_id).' })
    }

    const { valid: hasPermission } = await hasPermissionToModifyRole(req, res)
    if (!hasPermission) {
        return res.status(401).send({ status: false, error: 'Unauthorized.' })
    }

    try {
        const query = await loadSQL('assignRole.sql')
        const assignedBy = req.headers.id
        if (!assignedBy || Array.isArray(assignedBy)) {
            return res.status(401).send({ status: false, error: 'Unauthorized.' })
        }

        const result = await run(query, [id, role_id, assignedBy])
        if (!result.rows.length) {
            return res.status(404).send({ status: false, error: 'No roles found.' })
        }

        return res.send({ status: true, data: result.rows[0] })
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
