import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { revokeAllTokens } from '#utils/auth/session.ts'
import { validatePassword } from '#utils/auth/password.ts'
import { addressForUser } from '#utils/mail/helpers.ts'
import { sendSystemMail } from '#utils/mail/system.ts'
import { syncMailPasswordForUser } from '#utils/mail/accounts.ts'

const RESET_TTL_MINUTES = 15
const MAX_CODE_ATTEMPTS = 5

type RequestBody = {
    id?: string
}

type VerifyBody = {
    id?: string
    code?: string
}

type CompleteBody = {
    id?: string
    resetToken?: string
    password?: string
}

type ResetRow = {
    id: string
    user_id: string
    code_hash: string
    reset_token_hash: string | null
    attempts: number
    expires_at: string
}

type UserRow = {
    id: string
    name: string
    active: boolean
    recovery_email: string | null
    mail_address: string | null
}

export async function requestPasswordReset(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.body as RequestBody ?? {}
    const identifier = normalizeUserId(id)
    if (!identifier) {
        return res.status(400).send({ error: 'Enter your username.' })
    }

    const user = await getActiveUser(identifier)
    if (!user) {
        return res.send({ ok: true })
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
    const codeHash = await bcrypt.hash(code, 10)
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000)

    await run(`
        UPDATE password_reset_codes
        SET consumed_at = NOW()
        WHERE user_id = $1
          AND consumed_at IS NULL
    `, [user.id])

    await run(`
        INSERT INTO password_reset_codes (user_id, code_hash, requested_ip, user_agent, expires_at)
        VALUES ($1, $2, $3, $4, $5)
    `, [user.id, codeHash, req.ip, String(req.headers['user-agent'] || ''), expiresAt])

    try {
        await sendSystemMail({
            to: recoveryAddressForUser(user),
            subject: 'Hanasand password reset code',
            textBody: `Your Hanasand password reset code is ${code}.\n\nIt expires in ${RESET_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
            htmlBody: `<p>Your Hanasand password reset code is <strong>${code}</strong>.</p><p>It expires in ${RESET_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.</p>`,
        })
    } catch (error) {
        req.log.error(error)
        await run(`
            UPDATE password_reset_codes
            SET consumed_at = NOW()
            WHERE user_id = $1
              AND consumed_at IS NULL
        `, [user.id]).catch(() => {})
        return res.status(500).send({ error: 'Unable to send reset email.' })
    }

    return res.send({ ok: true })
}

export async function verifyPasswordResetCode(req: FastifyRequest, res: FastifyReply) {
    const { id, code } = req.body as VerifyBody ?? {}
    const user = await getActiveUser(normalizeUserId(id))
    const userId = user?.id || ''
    const resetCode = String(code || '').trim()
    if (!userId || !/^\d{6}$/.test(resetCode)) {
        return res.status(400).send({ error: 'Enter the 6 digit code.' })
    }

    const reset = await getPendingReset(userId)
    if (!reset) {
        return res.status(400).send({ error: 'The reset code is invalid or expired.' })
    }

    if (reset.attempts >= MAX_CODE_ATTEMPTS) {
        await consumeReset(reset.id)
        return res.status(400).send({ error: 'The reset code is invalid or expired.' })
    }

    const valid = await bcrypt.compare(resetCode, reset.code_hash)
    if (!valid) {
        await run('UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = $1', [reset.id])
        return res.status(400).send({ error: 'The reset code is invalid or expired.' })
    }

    const resetToken = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
    await run(`
        UPDATE password_reset_codes
        SET reset_token_hash = $2,
            verified_at = NOW()
        WHERE id = $1
    `, [reset.id, hashResetToken(resetToken)])

    return res.send({
        ok: true,
        resetToken,
        expiresAt: reset.expires_at,
    })
}

export async function completePasswordReset(req: FastifyRequest, res: FastifyReply) {
    const { id, resetToken, password } = req.body as CompleteBody ?? {}
    const user = await getActiveUser(normalizeUserId(id))
    const userId = user?.id || ''
    const tokenHash = hashResetToken(String(resetToken || ''))
    if (!userId || !resetToken || !password) {
        return res.status(400).send({ error: 'Missing reset token or password.' })
    }

    const resetResult = await run(`
        SELECT prc.id, prc.user_id, prc.reset_token_hash, prc.expires_at, u.name
        FROM password_reset_codes prc
        JOIN users u ON u.id = prc.user_id
        WHERE prc.user_id = $1
          AND prc.reset_token_hash = $2
          AND prc.consumed_at IS NULL
          AND prc.expires_at > NOW()
          AND u.active IS TRUE
        ORDER BY prc.verified_at DESC NULLS LAST, prc.created_at DESC
        LIMIT 1
    `, [userId, tokenHash])

    if (!resetResult.rows.length) {
        return res.status(400).send({ error: 'The reset session is invalid or expired.' })
    }

    const validation = await validatePassword(password)
    if (!validation.valid) {
        return res.status(400).send({ error: validation.error })
    }

    const reset = resetResult.rows[0] as ResetRow & { name: string }
    const hashedPassword = await bcrypt.hash(password, 10)

    await run('UPDATE users SET password = $2 WHERE id = $1', [userId, hashedPassword])
    await syncMailPasswordForUser(userId, reset.name || userId, password).catch(error => {
        req.log.error({ error, userId }, 'Failed to sync mail password after password reset')
    })
    await run('UPDATE password_reset_codes SET consumed_at = NOW() WHERE id = $1', [reset.id])
    await run('DELETE FROM attempts WHERE id = $1', [userId])
    await revokeAllTokens({ userId, revokedBy: 'password_reset' })

    return res.send({ ok: true })
}

async function getActiveUser(id: string) {
    const result = await run(`
        SELECT u.id, u.name, u.active, ma.recovery_email, ma.mail_address
        FROM users u
        LEFT JOIN mail_accounts ma ON ma.user_id = u.id
        WHERE u.active IS TRUE
          AND (
              u.id = $1
              OR lower(ma.mail_address) = lower($1)
              OR lower(ma.recovery_email) = lower($1)
          )
        LIMIT 1
    `, [id])
    return (result.rows[0] as UserRow | undefined) || null
}

function recoveryAddressForUser(user: UserRow) {
    return user.recovery_email || user.mail_address || addressForUser(user.id)
}

async function getPendingReset(userId: string) {
    const result = await run(`
        SELECT id, user_id, code_hash, reset_token_hash, attempts, expires_at
        FROM password_reset_codes
        WHERE user_id = $1
          AND consumed_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
    `, [userId])

    return (result.rows[0] as ResetRow | undefined) || null
}

async function consumeReset(id: string) {
    await run('UPDATE password_reset_codes SET consumed_at = NOW() WHERE id = $1', [id])
}

function normalizeUserId(value?: string) {
    return String(value || '').trim()
}

function hashResetToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}
