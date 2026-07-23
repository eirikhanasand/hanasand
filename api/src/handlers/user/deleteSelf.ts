import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { revokeAllTokens } from '#utils/auth/session.ts'
import { createAccountRestoreToken } from '#utils/auth/accountDeletion.ts'

type PendingDeletionUser = User & { deletion_scheduled_at: string }

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
        const outcome = await withTransaction(async query => {
            await query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [id])
            await query(`
                SELECT organization.id
                FROM organizations organization
                JOIN organization_members membership
                  ON membership.organization_id = organization.id
                 AND membership.user_id = $1
                 AND membership.role = 'owner'
                 AND membership.status = 'active'
                WHERE organization.status = 'active'
                ORDER BY organization.id
                FOR UPDATE OF organization
            `, [id])

            const blocker = await accountDeletionOrganizationBlocker(id, query)
            if (blocker) return { blocker, user: null }

            const userResult = await query(`
                UPDATE users
                SET deletion_requested_at = NOW(),
                    deletion_scheduled_at = NOW() + INTERVAL '30 days',
                    deletion_restore_token_hash = $2
                WHERE id = $1
                  AND COALESCE(reserved, FALSE) IS FALSE
                RETURNING id, name, avatar, active, deletion_requested_at, deletion_scheduled_at
            `, [id, restore.hash])
            const user = userResult.rows[0] as PendingDeletionUser | undefined
            if (!user) return { blocker: null, user: null }

            await revokeAllTokens({ userId: id, revokedBy: id }, query)
            return { blocker: null, user }
        })

        if (outcome.blocker) {
            return res.status(409).send({
                code: 'organization_ownership_transfer_required',
                error: `Transfer ownership or archive ${outcome.blocker.name} before deleting your account.`,
                organization_id: outcome.blocker.id,
                organization_name: outcome.blocker.name,
                active_api_key: outcome.blocker.activeApiKey,
            })
        }
        if (!outcome.user) {
            return res.status(404).send({ error: `There is no user with id ${id}` })
        }

        return res.send({
            message: 'Account scheduled for deletion.',
            pending_deletion: true,
            deletion_scheduled_at: outcome.user.deletion_scheduled_at,
            restore_token: restore.token,
            user: outcome.user,
        })
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}

export async function accountDeletionOrganizationBlocker(userId: string, query: typeof run = run) {
    const result = await query(`
        SELECT
            organization.id,
            organization.name,
            EXISTS (
                SELECT 1
                FROM api_keys
                WHERE organization_id = organization.id
                  AND enabled IS TRUE
                  AND (expires_at IS NULL OR expires_at > NOW())
            ) AS active_api_key
        FROM organizations organization
        JOIN organization_members membership
          ON membership.organization_id = organization.id
         AND membership.user_id = $1
         AND membership.role = 'owner'
         AND membership.status = 'active'
        WHERE organization.status = 'active'
          AND NOT EXISTS (
              SELECT 1
              FROM organization_members other_membership
              JOIN users other_owner
                ON other_owner.id = other_membership.user_id
               AND other_owner.active IS TRUE
               AND other_owner.deletion_scheduled_at IS NULL
              WHERE other_membership.organization_id = organization.id
                AND other_membership.user_id <> $1
                AND other_membership.role = 'owner'
                AND other_membership.status = 'active'
          )
        ORDER BY organization.created_at ASC, organization.id ASC
        LIMIT 1
    `, [userId])
    const row = result.rows[0] as { id?: unknown, name?: unknown, active_api_key?: unknown } | undefined
    if (!row || typeof row.id !== 'string' || typeof row.name !== 'string') return null
    return { id: row.id, name: row.name, activeApiKey: row.active_api_key === true }
}
