import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

/**
 * POST /thought/title
 * Get thought by title
 */
export default async function postThoughtByTitle(req: FastifyRequest, res: FastifyReply) {
    const { title } = req.body as { title: string } ?? {}
    if (!title) {
        return res.status(400).send({ error: 'Missing title.' })
    }

    try {
        const result = await run(`SELECT * FROM thoughts WHERE title = $1`, [title])
        if (!result.rows.length) {
            return res.status(404).send({ error: 'No thoughts found.' })
        }

        return res.send(result.rows)
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
