import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

/**
 * GET /thoughts
 * Fetch all thoughts
 */
export default async function getThoughts(_: FastifyRequest, res: FastifyReply) {
    try {
        const result = await run(`SELECT * FROM thoughts`)
        if (!result.rows.length) {
            return res.send([])
        }

        return res.send(result.rows)
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
