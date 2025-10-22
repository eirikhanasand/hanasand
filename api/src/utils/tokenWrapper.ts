import { FastifyReply, FastifyRequest } from 'fastify'
import config from '#constants'

const { SELF_URL } = config

type Valid = {
    valid: boolean
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

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            valid: false,
            error: 'Missing or invalid Authorization header.'
        }
    }

    if (!id) {
        return {
            valid: false,
            error: 'No id provided.'
        }
    }

    const token = authHeader.split(' ')[1]

    try {
        const response = await fetch(`${SELF_URL}/${id}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (!response.ok) {
            return {
                valid: false,
                error: 'Unauthorized'
            }
        }

        return { valid: true }
    } catch (err) {
        res.log.error(err)
        return res.status(500).send({
            valid: false,
            error: 'Internal server error'
        })
    }
}
