import type { FastifyReply, FastifyRequest } from 'fastify'
import { validateSession } from './session.ts'

type Valid = {
    valid: boolean
    id?: string
    error?: string
}

/**
 * Token wrapper helper function. Used to check whether a `token` is valid
 * before allowing API access, for example when updating and deleting packages
 * from the `allow` or `block` lists.
 *
 * @param req Fastify Request
 * @param res Fastify Response
 *
 * @returns Object with a `valid` parameter, and optionally an `error` parameter
 * if an error occured while verifying the token.
 */
export default async function tokenWrapper(req: FastifyRequest, res: FastifyReply): Promise<Valid> {
    const authHeader = req.headers['authorization']
    const id = req.headers['id']

    if (Array.isArray(id)) {
        return {
            valid: false,
            id: id[0],
            error: 'Unauthorized.'
        }
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            valid: false,
            id,
            error: 'Unauthorized.'
        }
    }

    const token = authHeader.split(' ')[1]

    try {
        const session = await validateSession({ id, token })
        if (!session) {
            return {
                valid: false,
                id,
                error: 'Unauthorized.'
            }
        }

        req.headers.id = session.user.id
        res.header('x-access-token', session.refreshed.token)
        res.header('x-access-token-expires-at', session.refreshed.expires_at)
        return { valid: true, id: session.user.id }
    } catch (error) {
        res.log.error(error)
        res.status(500).send({
            valid: false,
            id,
            error: 'Internal server error'
        })

        return {
            valid: false,
            id,
            error: 'Internal server error'
        }
    }
}
