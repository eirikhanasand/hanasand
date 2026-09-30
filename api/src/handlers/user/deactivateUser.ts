import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { revokeAllTokens } from '#utils/auth/session.ts'

export default async function deactivateUser(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: actorId } = await tokenWrapper(req, res)
    if (!valid || !actorId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const canManageUsers = await hasHanasandInternalRouteAccess(req)
    if (!canManageUsers.valid) {
        return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required.' })
    }

    const { id } = req.params as { id: string }
    const { active } = req.body as { active?: boolean } ?? {}
    if (!id || typeof active !== 'boolean') {
        return res.status(400).send({ error: 'Missing user id or active boolean.' })
    }

    const result = await run(`
        UPDATE users
        SET active = $2,
            deactivated_at = CASE WHEN $2 IS TRUE THEN NULL ELSE NOW() END,
            deactivated_by = CASE WHEN $2 IS TRUE THEN NULL ELSE $3 END
        WHERE id = $1
        RETURNING id, name, avatar, active, deactivated_at, deactivated_by
    `, [id, active, actorId])

    if (!result.rowCount) {
        return res.status(404).send({ error: 'User not found.' })
    }

    if (!active) {
        await revokeAllTokens({ userId: id, revokedBy: actorId })
    }

    return res.send(result.rows[0])
}
