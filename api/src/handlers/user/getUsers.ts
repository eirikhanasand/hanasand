import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/tokenWrapper.ts'
import { loadSQL } from '#utils/loadSQL.ts'

/**
 * Fetches all users and their highest role.
 * 
 * @param req Incoming Fastify Request
 * @param res Outgoing Fastify Response
 * 
 * @returns Fastify Response
 */
export default async function getUsers(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    try {
        console.log('Fetching users')
        const usersQuery = await loadSQL('getUsers.sql')
        const usersResult = await run(usersQuery)
        if (!usersResult.rows.length) {
            return res.status(404).send({ error: `There are no users.` })
        }

        return res.send(usersResult)
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
