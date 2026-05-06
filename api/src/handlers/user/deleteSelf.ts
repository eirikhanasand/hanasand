import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { revokeAllTokens } from '#utils/auth/session.ts'
import { createAccountRestoreToken } from '#utils/auth/accountDeletion.ts'

export default async function deleteSelf(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const id = req.headers['id']
    if (!id || Array.isArray(id)) {
        return res.status(400).send({ error: 'No user provided.' })
    }

    try {
        const restore = createAccountRestoreToken()
        const userResult = await run(`
            UPDATE users
            SET deletion_requested_at = NOW(),
                deletion_scheduled_at = NOW() + INTERVAL '30 days',
                deletion_restore_token_hash = $2
            WHERE id = $1
              AND COALESCE(reserved, FALSE) IS FALSE
            RETURNING id, name, avatar, active, deletion_requested_at, deletion_scheduled_at
        `, [id, restore.hash])

        if (!userResult.rows.length) {
            return res.status(404).send({ error: `There is no user with id ${id}` })
        }

        await revokeAllTokens({ userId: id, revokedBy: id })

        const user: User = userResult.rows[0]
        return res.send({
            message: 'Account scheduled for deletion.',
            pending_deletion: true,
            deletion_scheduled_at: userResult.rows[0].deletion_scheduled_at,
            restore_token: restore.token,
            user,
        })
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
