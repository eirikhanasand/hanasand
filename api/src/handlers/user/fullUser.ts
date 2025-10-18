import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

/**
 * Fetches internal info for a user based on `id`
 * 
 * Required parameter: `id`
 * Requires header: `Authorization: Bearer <token>`
 * 
 * @param req Incoming Fastify Request
 * @param res Outgoing Fastify Response
 * 
 * @returns Fastify Response
 */
export default async function authorizedUserHandler(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }

    if (!id) {
        return res.status(400).send({ error: 'Missing id.' })
    }

    const authHeader = req.headers['authorization']
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send({ error: 'Missing or invalid Authorization header.' })
    }

    const token = authHeader.split(' ')[1]

    try {
        const tokenResult = await run(
            `SELECT token FROM tokens WHERE id = $1 AND token = $2`,
            [id, token]
        )

        if (!tokenResult.rows.length) {
            return res.status(401).send({ error: 'Invalid token.' })
        }

        const userResult = await run(
            `SELECT id, name, avatar FROM users WHERE id = $1`,
            [id]
        )

        if (!userResult.rows.length) {
            return res.status(404).send({ error: `There is no user with id ${id}` })
        }

        const user: User = userResult.rows[0]
        return res.send(user)
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
