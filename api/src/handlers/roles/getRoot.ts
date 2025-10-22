import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

/**
 * GET /role/root
 * Checks if the initial user has been created. This is because the first user
 * must be an administrator, and the user has full privileges.
 */
export default async function getRoot(_: FastifyRequest, res: FastifyReply) {
    try {
        const result = await run(`SELECT * FROM root`)
        if (!result.rows.length) {
            return res.status(404).send({ error: 'No administrator found.' })
        }

        if (result.rows[0].created === true) {
            return res.status(500).send({ error: 'This is an initial endpoint to create the first root account. For this site, the root account already exists, and this endpoint can no longer be used.' })
        }

        return res.send({ message: 'No root user found.' })
    } catch (error) {
        console.error(error)
        return res.status(500).send({ error: 'Internal Server Error.' })
    }
}
