import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

/**
 * GET /thought/random
 * Fetches a random thought
 */
export default async function getRandomThought(_: FastifyRequest, res: FastifyReply) {
    try {
        const result = await run(`
            SELECT * FROM thoughts
            ORDER BY random()
            LIMIT 1
        `)

        if (!result.rows.length) {
            return res.status(404).send({ error: 'No thoughts found.' })
        }

        return res.send(result.rows[0])
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
