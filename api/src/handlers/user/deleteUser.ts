import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { revokeAllTokens } from '#utils/auth/session.ts'
import { recordAdminAuditEvent, userHasAdministrativeRole } from '#utils/adminAudit.ts'

export default async function deleteUser(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: actorId } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'user_admin')
    if (!valid || !validRole || !actorId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing id.' })
    }

    try {
        const wasAdmin = await userHasAdministrativeRole(id)
        const userResult = await run(`
            UPDATE users
            SET deletion_requested_at = NOW(),
                deletion_scheduled_at = NOW() + INTERVAL '30 days',
                deletion_restore_token_hash = NULL
            WHERE id = $1
              AND COALESCE(reserved, FALSE) IS FALSE
            RETURNING id, name, avatar, active, deletion_requested_at, deletion_scheduled_at
        `, [id])
        if (!userResult.rows.length) {
            return res.status(404).send({ error: `There is no user with id ${id}` })
        }

        await revokeAllTokens({ userId: id, revokedBy: actorId })
        await recordAdminAuditEvent(req, {
            actionType: 'user.account.deleted',
            actorId,
            source: 'admin',
            targetType: 'user',
            targetId: id,
            severity: wasAdmin ? 'critical' : 'warning',
            context: { deletionMode: 'scheduled', administrativeAccount: wasAdmin },
        })
        if (wasAdmin) {
            await recordAdminAuditEvent(req, {
                actionType: 'admin.account.deleted',
                actorId,
                source: 'admin',
                targetType: 'user',
                targetId: id,
                severity: 'critical',
                context: { deletionMode: 'scheduled' },
            })
        }
        const user: User = userResult.rows[0]
        return res.send({ message: 'User scheduled for deletion.', pending_deletion: true, user })
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
