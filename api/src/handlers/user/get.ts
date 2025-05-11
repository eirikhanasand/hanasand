import { FastifyReply, FastifyRequest } from 'fastify'
import run from '../../db.js'

/**
 * Fetches the `name` and `avatar` for a user based on `id`.
 * 
 * Required parameter: `id`
 * 
 * @param req Incoming Fastify Request
 * @param res Outgoing Fastify Response
 * 
 * @returns Fastify Response
 */
export default async function userHandler(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing id.' })
    }

    try {
        console.log(`Fetching user ${id}`)
        const userResult = await run(`SELECT id, name, avatar FROM users WHERE id = $1`, [id])
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
