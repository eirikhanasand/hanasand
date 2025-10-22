import { FastifyReply, FastifyRequest } from 'fastify'
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
export default async function roleWrapper(req: FastifyRequest, res: FastifyReply): Promise<Valid> {
    const { target } = (req.body as { target: string }) ?? {}
    const id = req.headers['id']

    if (!target) {
        return {
            valid: false,
            error: 'No target role provided.'
        }
    }

    try {
        const roleQuery = await loadSQL('compareRoles.sql')
        const { rows } = await run(roleQuery, [id!, target])
        const { max_user_priority, target_priority } = rows[0] || {}

        if (target_priority >= max_user_priority) {
            return { valid: false, error: 'Unauthorized.' }
        }

        return { valid: true }
    } catch (err) {
        res.log.error(err)
        return { valid: false, error: 'Internal server error' }
    }
}
