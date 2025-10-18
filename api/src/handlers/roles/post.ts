import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'

/**
 * POST /role
 * Create a new role
 */
export default async function postRole(req: FastifyRequest, res: FastifyReply) {
    const { name, description, created_by } = req.body as {
        name: string
        description?: string
        created_by: string
    } ?? {}

    if (!name || !created_by) {
        return res.status(400).send({ error: 'Missing required fields: name or created_by' })
    }

    try {
        const result = await run(
            `INSERT INTO roles (name, description, created_by) VALUES ($1, $2, $3) RETURNING *`,
            [name, description || null, created_by]
        )

        return res.status(201).send(result.rows[0])
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(409).send({ error: 'Role already exists' })
        }

        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
