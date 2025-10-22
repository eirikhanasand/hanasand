import run from '#db'
import tokenWrapper from '#utils/tokenWrapper.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

type PostRoleBody = {
    id: string
    name: string
    description?: string
    created_by: string
}

/**
 * POST /role
 * Create a new role
 */
export default async function postRole(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const { valid: roleValid } = await tokenWrapper(req, res)
    if (!roleValid) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const { id, name, description, created_by } = req.body as PostRoleBody ?? {}

    if (!name || !created_by) {
        return res.status(400).send({ error: 'Missing required fields: name or created_by' })
    }

    try {
        const result = await run(
            `INSERT INTO roles (id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, name, description || null, created_by]
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
