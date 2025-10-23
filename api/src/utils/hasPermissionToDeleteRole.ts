import type { FastifyReply, FastifyRequest } from 'fastify'
import { loadSQL } from '#utils/loadSQL.ts'
import run from '#db'

type Valid = {
    valid: boolean
    error?: string
}

/**
 * Used to check whether a user has permission to delete a role, meaning their
 * highest role is of equal or higher priority than the target role.
 * 
 * @param req Fastify Request
 * @param res Fastify Response
 * 
 * @returns Object with a `valid` parameter, and optionally an `error` parameter
 * if an error occured while checking the roles.
 */
export default async function hasPermissionToDeleteRole(req: FastifyRequest, res: FastifyReply): Promise<Valid> {
    const id = req.headers['id']
    if (!id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const highestRoleQuery = await loadSQL('getHighestRoleForUser.sql')
        const highestRoleResult = await run(highestRoleQuery, [id])
        if (!highestRoleResult.rowCount) {
            return res.status(401).send({ error: 'Unauthorized.' })
        }
    
        const highestRole = highestRoleResult.rows[0].id
        const { target } = req.body as { target: string } ?? {}
        if (!target) {
            return res.status(401).send({ error: 'Missing target role.' })
        }
    
        const checkPermissionQuery = await loadSQL('compareRoles.sql')
        const hasPermissionToModifyRole = await run(checkPermissionQuery, [highestRole, target])
        if (!hasPermissionToModifyRole.rows.length) {
            return res.status(401).send({ error: 'Insufficient permissions.' })
        }

        return { valid: true }
    } catch (error) {
        res.log.error(error)
        return { valid: false, error: 'Internal server error' }
    }
}
