import type { FastifyReply, FastifyRequest } from 'fastify'
import { validateSession } from '#utils/auth/session.ts'

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
        const session = await validateSession({ id, token })
        if (!session) {
            return res.status(401).send({ error: 'Invalid token.' })
        }
        return res.send({
            ...session.user,
            roles: session.roles,
            token: session.refreshed.token,
            expires_at: session.refreshed.expires_at,
        })
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
