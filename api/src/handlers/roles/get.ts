import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

/**
 * GET /role/:id
 * Fetch a role by ID
 */
export default async function getRoles(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing role id' })
    }

    try {
        const result = await run(`SELECT * FROM roles WHERE id = $1`, [id])
        if (!result.rows.length) {
            return res.status(404).send({ error: 'Role not found' })
        }

        return res.send(result.rows[0])
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
