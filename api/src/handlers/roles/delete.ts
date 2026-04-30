import run from '#db'
import hasPermissionToModifyRole from '#utils/auth/hasPermissionToModifyRole.ts'
import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

/**
 * DELETE /role/:id
 * Deletes a role by ID
 */
export default async function deleteRole(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'user_admin')
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing role id.' })
    }

    const { valid: hasPermission } = await hasPermissionToModifyRole(req, res)
    if (!hasPermission) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const result = await run('DELETE FROM roles WHERE id = $1 RETURNING *', [id])
        if (!result.rows.length) {
            return res.status(404).send({ error: 'Role not found.' })
        }

        return res.send({ message: 'Role deleted successfully.', role: result.rows[0] })
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
