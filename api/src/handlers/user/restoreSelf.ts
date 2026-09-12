import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import { createAccountRestoreToken, hashAccountRestoreToken } from '#utils/auth/accountDeletion.ts'
import login from '#utils/auth/login.ts'

export default async function restoreSelf(req: FastifyRequest, res: FastifyReply) {
    const { id, restoreToken } = req.body as { id?: string, restoreToken?: string } ?? {}
    const userId = String(id || '').trim()
    const token = String(restoreToken || '').trim()
    if (!userId || !token) {
        return res.status(400).send({ error: 'Missing restore details.' })
    }

    const reset = createAccountRestoreToken()
    const result = await withTransaction(async query => {
        const restored = await query(`
        UPDATE users
        SET deletion_requested_at = NULL,
            deletion_scheduled_at = NULL,
            deletion_restore_token_hash = NULL,
            deletion_email_token_hash = NULL,
            active = TRUE,
            deactivated_at = NULL,
            deactivated_by = NULL
        WHERE id = $1
          AND deletion_scheduled_at > NOW()
          AND active IS TRUE
          AND (deletion_restore_token_hash = $2 OR deletion_email_token_hash = $2)
        RETURNING id, name, avatar, active
    `, [userId, hashAccountRestoreToken(token)])
        if (restored.rows.length) {
            await query('UPDATE password_reset_codes SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL', [userId])
            await query(`INSERT INTO password_reset_codes
                (user_id, code_hash, reset_token_hash, verified_at, requested_ip, user_agent, expires_at)
                VALUES ($1, $2, $3, NOW(), $4, $5, NOW() + INTERVAL '15 minutes')`,
            [userId, 'account-restoration', reset.hash, req.ip, String(req.headers['user-agent'] || '')])
        }
        return restored
    })

    if (!result.rows.length) {
        return res.status(400).send({ error: 'This account can no longer be restored from this link.' })
    }

    const session = await login({ id: userId, ip: req.ip, userAgent: String(req.headers['user-agent'] || '') })
    const roleResponse = await run(`
        SELECT r.id, r.name, r.description, r.priority
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = $1
        ORDER BY r.priority ASC, r.id ASC
    `, [userId])

    return res.send({
        ...result.rows[0],
        message: 'Account restored.',
        resetToken: reset.token,
        roles: roleResponse.rows,
        token: session?.token,
        expires_at: session?.expires_at,
    })
}
