import run from '#db'
import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function deleteThought(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'content_admin')
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params
    if (!id) {
        return res.status(400).send({ error: 'Missing thought id.' })
    }

    try {
        const result = await run('DELETE FROM thoughts WHERE id = $1 RETURNING id', [id])
        if (!result.rows.length) {
            return res.status(404).send({ error: 'Thought not found.' })
        }

        return res.send({ deleted: true, id })
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
