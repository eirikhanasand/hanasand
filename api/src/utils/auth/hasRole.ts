import type { FastifyReply, FastifyRequest } from 'fastify'
import { loadSQL } from '#utils/loadSQL.ts'
import run from '#db'

type Valid = {
    valid: boolean
    error?: string
}

/**
 * Role wrapper helper function. Used to check whether a role has higher access
 * than the target role, before allowing API access, for example when updating 
 * or deleting roles.
 * 
 * @param req Fastify Request
 * @param res Fastify Response
 * 
 * @returns Object with a `valid` parameter, and optionally an `error` parameter
 * if an error occured while checking the roles.
 */
export default async function hasRole(req: FastifyRequest, res: FastifyReply, role: string): Promise<Valid> {
    const id = req.headers['id']
    if (!id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!role) {
        return {
            valid: false,
            error: 'No target role provided.'
        }
    }

    try {
        const roleQuery = await loadSQL('hasRole.sql')
        const { rows } = await run(roleQuery, [id!, role])

        if (!rows.length) {
            return { valid: false, error: 'Unauthorized.' }
        }

        return { valid: true }
    } catch (error) {
        res.log.error(error)
        return { valid: false, error: 'Internal server error' }
    }
}
