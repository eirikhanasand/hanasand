import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function postThought(req: FastifyRequest<{ Body: { title: string, id: string } }>, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'content_admin')
    if (!valid || !validRole) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const { title, id } = req.body ?? {}
    if (!title || !id) {
        return res.status(400).send({ error: 'Missing thought title or creator.' })
    }

    try {
        const result = await run(
            `INSERT INTO thoughts (title, created_by) VALUES ($1, $2) RETURNING *`,
            [title, id]
        )

        return res.status(201).send(result.rows[0])
    } catch (error: any) {
        if (error.code === '23505') {
            return res.status(409).send({ error: 'Thought already exists' })
        }

        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
