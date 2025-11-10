import type { FastifyReply, FastifyRequest } from 'fastify'
import config from '#constants'

const { self_url } = config

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
            error: 'Missing or invalid Authorization header.'
        }
    }

    if (!id) {
        return {
            valid: false,
            id,
            error: 'No id provided.'
        }
    }

    const token = authHeader.split(' ')[1]

    try {
        const response = await fetch(`${self_url}/${id}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (!response.ok) {
            return {
                valid: false,
                id,
                error: 'Unauthorized.'
            }
        }

        return { valid: true, id }
    } catch (error) {
        res.log.error(error)
        return res.status(500).send({
            valid: false,
            id,
            error: 'Internal server error'
        })
    }
}
