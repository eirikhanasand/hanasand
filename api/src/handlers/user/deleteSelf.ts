import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { revokeAllTokens } from '#utils/auth/session.ts'
import { createAccountRestoreToken } from '#utils/auth/accountDeletion.ts'
import { accountDeletionMail, deletionRequestLocation } from '#utils/auth/accountDeletionMail.ts'
import { sendSystemMail } from '#utils/mail/system.ts'
import { addressForUser } from '#utils/mail/helpers.ts'
import { recordSystemEvent, userHasAdministrativeRole } from '#utils/systemEvent.ts'

type PendingDeletionUser = User & { deletion_scheduled_at: string, deletion_requested_at: string }

export default async function deleteSelf(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || auth.impersonating || auth.authenticatedId !== auth.id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const id = auth.id
    if (!id || Array.isArray(id)) {
        return res.status(400).send({ error: 'No user provided.' })
    }

    try {
        const restore = createAccountRestoreToken()
        const emailRestore = createAccountRestoreToken()
        const location = await deletionRequestLocation(req.ip)
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
                    deletion_restore_token_hash = $2,
                    deletion_email_token_hash = $3
                WHERE id = $1
                  AND active IS TRUE
                  AND deletion_scheduled_at IS NULL
                  AND COALESCE(reserved, FALSE) IS FALSE
                RETURNING id, name, avatar, active, deletion_requested_at, deletion_scheduled_at
            `, [id, restore.hash, emailRestore.hash])
            const user = userResult.rows[0] as PendingDeletionUser | undefined
            if (!user) return { blocker: null, user: null }

            await revokeAllTokens({ userId: id, revokedBy: id }, query)
            const address = await query(`
                SELECT COALESCE(NULLIF(u.email, ''), NULLIF(ma.recovery_email, ''), NULLIF(ma.mail_address, '')) AS email
                FROM users u LEFT JOIN mail_accounts ma ON ma.user_id = u.id WHERE u.id = $1
            `, [id])
            try {
                await sendSystemMail({
                    to: address.rows[0]?.email || addressForUser(id),
                    ...accountDeletionMail({
                        id, deletionScheduledAt: user.deletion_scheduled_at,
                        requestedAt: user.deletion_requested_at, restoreToken: emailRestore.token,
                        ip: req.ip, userAgent: String(req.headers['user-agent'] || ''),
                        country: location.network?.country, city: location.network?.city,
                    }),
                })
            } catch {
                // Keep access and deletion state unchanged if the email cannot be sent.
                throw new DeletionEmailError()
            }
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

        const wasAdmin = await userHasAdministrativeRole(id)
        await recordSystemEvent(req, {
            actionType: 'user.account.deleted',
            actorId: id,
            source: 'auth',
            targetType: 'user',
            targetId: id,
            severity: wasAdmin ? 'critical' : 'warning',
            context: { deletionMode: 'scheduled', administrativeAccount: wasAdmin },
        })
        if (wasAdmin) {
            await recordSystemEvent(req, {
                actionType: 'admin.account.deleted',
                actorId: id,
                source: 'auth',
                targetType: 'user',
                targetId: id,
                severity: 'critical',
                context: { deletionMode: 'scheduled' },
            })
        }

        return res.send({
            message: 'Account scheduled for deletion.',
            pending_deletion: true,
            deletion_scheduled_at: outcome.user.deletion_scheduled_at,
            restore_token: restore.token,
            user: outcome.user,
        })
    } catch (error) {
        if (error instanceof DeletionEmailError) {
            req.log.error('Account deletion email could not be sent')
            return res.status(503).send({ error: 'We couldn’t send your confirmation email. Your account has not been scheduled for deletion. Please try again.' })
        }
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

class DeletionEmailError extends Error {}
