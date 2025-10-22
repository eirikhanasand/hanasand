import run from '#db'
import tokenWrapper from '#utils/tokenWrapper.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

/**
 * PUT /role/:id
 * Update a role's name or description
 */
export default async function putRole(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const { valid: roleValid } = await tokenWrapper(req, res)
    if (!roleValid) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    const { name, description } = req.body as { name?: string; description?: string }

    if (!id) {
        return res.status(400).send({ error: 'Missing role id' })
    }

    try {
        const fields: string[] = []
        const values: any[] = []

        if (name) {
            fields.push(`name = $${fields.length + 1}`)
            values.push(name)
        }

        if (description !== undefined) {
            fields.push(`description = $${fields.length + 1}`)
            values.push(description)
        }

        if (!fields.length) {
            return res.status(400).send({ error: 'No fields to update' })
        }

        values.push(id)
        const query = `UPDATE roles SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`
        const result = await run(query, values)
        if (!result.rows.length) {
            return res.status(404).send({ error: 'Role not found' })
        }

        return res.send(result.rows[0])
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(409).send({ error: 'Role name already exists' })
        }

        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
