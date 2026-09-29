import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import { revokeAllTokens } from '#utils/auth/session.ts'
import { validatePassword } from '#utils/auth/password.ts'
import { addressForUser } from '#utils/mail/helpers.ts'
import { sendSystemMail } from '#utils/mail/system.ts'
import { syncMailPasswordForUser } from '#utils/mail/accounts.ts'
import { passwordChangedMail } from '#utils/auth/passwordChangedMail.ts'

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

type SecurityActionBody = {
    token?: string
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
    if (!user || !resetToken || !password) {
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

    const updated = await withTransaction(async query => {
        await query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId])
        const consumed = await query(`UPDATE password_reset_codes SET consumed_at = NOW()
            WHERE id = $1 AND reset_token_hash = $2 AND consumed_at IS NULL AND expires_at > NOW()
            RETURNING id`, [reset.id, tokenHash])
        if (!consumed.rows.length) return false
        await query('UPDATE users SET password = $2, password_reset_locked_at = NULL WHERE id = $1', [userId, hashedPassword])
        await query('UPDATE password_reset_codes SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL', [userId])
        await query('DELETE FROM attempts WHERE id = $1', [userId])
        await revokeAllTokens({ userId, revokedBy: 'password_reset' }, query)
        return true
    })
    if (!updated) return res.status(400).send({ error: 'The reset session is invalid or expired.' })
    await syncMailPasswordForUser(userId, reset.name || userId, password).catch(error => {
        req.log.error({ error, userId }, 'Failed to sync mail password after password reset')
    })
    try {
        const actions = await createSecurityActionTokens(userId, reset.id)
        await sendSystemMail({
            to: recoveryAddressForUser(user),
            ...passwordChangedMail({
                id: userId,
                changedAt: new Date(),
                ip: req.ip,
                userAgent: String(req.headers['user-agent'] || ''),
                ...actions,
            }),
        })
    } catch (error) {
        req.log.error({ error, userId }, 'Failed to send password reset security notification')
    }

    return res.send({ ok: true })
}

export async function lockAccountFromPasswordReset(req: FastifyRequest, res: FastifyReply) {
    const token = readSecurityActionToken(req.body)
    if (!token) return res.status(400).send({ error: 'This security link is invalid or expired.' })

    const locked = await withTransaction(async query => {
        const action = await query(`
            UPDATE password_reset_security_actions
            SET consumed_at = NOW()
            WHERE token_hash = $1
              AND action = 'lock_account'
              AND consumed_at IS NULL
              AND expires_at > NOW()
              AND EXISTS (SELECT 1 FROM users WHERE users.id = password_reset_security_actions.user_id AND users.active IS TRUE)
            RETURNING user_id
        `, [hashResetToken(token)])
        if (!action.rows.length) return false

        const userId = String(action.rows[0].user_id)
        const user = await query('SELECT id FROM users WHERE id = $1 AND active IS TRUE FOR UPDATE', [userId])
        if (!user.rows.length) return false

        const updated = await query('UPDATE users SET password_reset_locked_at = NOW() WHERE id = $1 AND active IS TRUE RETURNING id', [userId])
        if (!updated.rows.length) return false

        await revokeAllTokens({ userId, revokedBy: 'password_reset_security_lock' }, query)
        return true
    })
    if (!locked) return res.status(400).send({ error: 'This security link is invalid or expired.' })
    return res.send({ ok: true })
}

export async function startPasswordResetAgain(req: FastifyRequest, res: FastifyReply) {
    const token = readSecurityActionToken(req.body)
    if (!token) return res.status(400).send({ error: 'This reset link is invalid or expired.' })

    const resetToken = createOpaqueToken()
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000)
    const started = await withTransaction(async query => {
        const action = await query(`
            UPDATE password_reset_security_actions
            SET consumed_at = NOW()
            WHERE token_hash = $1
              AND action = 'reset_password'
              AND consumed_at IS NULL
              AND expires_at > NOW()
              AND EXISTS (SELECT 1 FROM users WHERE users.id = password_reset_security_actions.user_id AND users.active IS TRUE)
            RETURNING user_id
        `, [hashResetToken(token)])
        if (!action.rows.length) return null

        const userId = String(action.rows[0].user_id)
        const user = await query('SELECT id FROM users WHERE id = $1 AND active IS TRUE FOR UPDATE', [userId])
        if (!user.rows.length) return null

        const code = crypto.randomBytes(32).toString('hex')
        const codeHash = await bcrypt.hash(code, 10)
        await query(`
            UPDATE password_reset_codes
            SET consumed_at = NOW()
            WHERE user_id = $1 AND consumed_at IS NULL
        `, [userId])
        await query(`
            INSERT INTO password_reset_codes (user_id, code_hash, reset_token_hash, requested_ip, user_agent, verified_at, expires_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), $6)
        `, [userId, codeHash, hashResetToken(resetToken), req.ip, String(req.headers['user-agent'] || ''), expiresAt])
        return { userId }
    })
    if (!started) return res.status(400).send({ error: 'This reset link is invalid or expired.' })

    return res.send({ ok: true, id: started.userId, resetToken })
}

async function getActiveUser(id: string) {
    const result = await run(`
        SELECT u.id, u.name, u.active, COALESCE(u.email,ma.recovery_email) AS recovery_email, ma.mail_address
        FROM users u
        LEFT JOIN mail_accounts ma ON ma.user_id = u.id
        WHERE u.active IS TRUE
          AND (
              u.id = $1
              OR lower(COALESCE(u.username,u.id)) = lower($1)
              OR lower(u.email) = lower($1)
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

function readSecurityActionToken(body: unknown) {
    const token = (body as SecurityActionBody | null)?.token
    return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : ''
}

function createOpaqueToken() {
    return crypto.randomBytes(32).toString('base64url')
}

async function createSecurityActionTokens(userId: string, resetCodeId: string) {
    const lockToken = createOpaqueToken()
    const resetToken = createOpaqueToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await run(`
        UPDATE password_reset_security_actions
        SET consumed_at = NOW()
        WHERE user_id = $1 AND consumed_at IS NULL
    `, [userId])
    await run(`
        INSERT INTO password_reset_security_actions (user_id, reset_code_id, action, token_hash, expires_at)
        VALUES ($1, $2, 'lock_account', $3, $5), ($1, $2, 'reset_password', $4, $5)
    `, [userId, resetCodeId, hashResetToken(lockToken), hashResetToken(resetToken), expiresAt])

    return { lockToken, resetToken }
}
