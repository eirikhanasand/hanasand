import run from '#db'
import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function putThought(req: FastifyRequest<{ Params: { id: string }, Body: { title: string } }>, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'content_admin')
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params
    const { title } = req.body

    try {
        const fields: string[] = []
        const values: any[] = []

        if (title) {
            fields.push(`title = $${fields.length + 1}`)
            values.push(title)
        }

        if (!fields.length) {
            return res.status(400).send({ error: 'No fields to update' })
        }

        const query = `UPDATE thoughts SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`
        const result = await run(query, values)

        return res.status(201).send({ result, message: `Updated thought ${id}` })
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(409).send({ error: 'Thought already exists' })
        }

        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
