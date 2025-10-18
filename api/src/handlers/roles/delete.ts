import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'

/**
 * DELETE /role/:id
 * Delete a role by ID
 */
export default async function deleteRole(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing role id' })
    }

    try {
        const result = await run(`DELETE FROM roles WHERE id = $1 RETURNING *`, [id])
        if (!result.rows.length) {
            return res.status(404).send({ error: 'Role not found' })
        }

        return res.send({ message: 'Role deleted successfully', role: result.rows[0] })
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
