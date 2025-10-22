import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

export default async function logoutHandler(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }

    if (!id) {
        return res.status(400).send({ error: 'Missing userId' })
    }

    try {
        const query = `
            DELETE FROM tokens
            WHERE id = $1
            RETURNING token;
        `

        const result = await run(query, [id])

        if (result.rowCount === 0) {
            return res.status(200).send({ message: 'No active tokens found for user.' })
        }

        return res.status(200).send({
            message: 'User logged out successfully.',
            invalidatedTokens: result.rowCount,
        })
    } catch (error) {
        console.error(`Logout error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal server error' })
    }
}
