import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import { consumeSignupCode, ensureSignupVerification, requestSignupCode, signupBinding } from '#utils/auth/signupVerification.ts'
import run, { withTransaction } from '#db'
import { normalizeEmail, usernameError } from '#utils/auth/accountIdentity.ts'
import { validatePassword } from '#utils/auth/password.ts'
import login from '#utils/auth/login.ts'
import { ensureMailAccountForUser } from '#utils/mail/accounts.ts'
import { normalizeUsername } from '#utils/auth/reservedUsernames.ts'

type GetUserBodyProps = {
    id: string
    name: string
    password: string
    avatar: string
    email: string
    challengeId?: string
    code?: string
}

export default async function postUser(req: FastifyRequest, res: FastifyReply) {
    const { id, name, password, avatar, email: submittedEmail, challengeId, code } = req.body as GetUserBodyProps ?? {}
    const normalizedId = normalizeUsername(id || '')
    const email = normalizeEmail(submittedEmail)
    const user = { id: normalizedId, name }
    const ip = req.ip
    const userAgent = String(req.headers['user-agent'] || '')

    if (!id || typeof name !== 'string' || !name.trim() || name.length > 100 || !password || !email) {
        return res.status(400).send({ error: 'Name, username, valid email, and password are required.' })
    }

    const reservedReason = usernameError(normalizedId)
    if (reservedReason) {
        return res.status(400).send({ error: reservedReason })
    }

    const validation = await validatePassword(password)
    if (!validation.valid) {
        return res.status(400).send({ error: validation.error })
    }

    try {
        const binding = signupBinding([normalizedId, name.trim(), email, password, avatar || ''])
        await ensureSignupVerification()
        if (!challengeId) {
            const existing = await run('SELECT id FROM users WHERE id = $1 OR email = $2 LIMIT 1', [normalizedId, email])
            if (existing.rows.length) return res.status(409).send({ error: 'This username or email is already registered. Sign in to the existing account.' })
            const { status, ...response } = await requestSignupCode(email, ip, binding)
            return res.status(status).send(response)
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        const response = await withTransaction(async query => {
            if (!await consumeSignupCode(query, String(challengeId), String(code || ''), binding)) return null
            await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`email:${email}`])
            await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`username:${normalizedId}`])
            return query(
                `INSERT INTO users (id,name,password,avatar,username,email,email_verified_at)
                VALUES ($1,$2,$3,$4,$1,$5,NOW())
                ON CONFLICT DO NOTHING`,
                [normalizedId, name.trim(), hashedPassword, avatar || '', email]
            )
        })

        if (!response) return res.status(400).send({ error: 'The code is incorrect or expired. Try again or request a new code.' })

        if (!response.rowCount) {
            return res.status(400).send({ error: 'This username or email is already registered. Sign in to the existing account.' })
        }

        if (process.env.SKIP_MAIL_PROVISIONING !== '1') {
            await ensureMailAccountForUser(normalizedId, name, password).catch(error => {
                if (isMailAdminConfigError(error)) {
                    req.log.debug({ userId: normalizedId }, 'Mail provisioning skipped because mail administration is not configured')
                    return
                }

                req.log.warn({ error, userId: normalizedId }, 'Failed to provision mail account during signup')
            })
        }

        const session = await login({ id: normalizedId, ip, userAgent })
        if (!session) {
            return res.status(206).send({ ...user, message: 'User created', error: 'Unable to login. Please try again later.' })
        }

        return res.status(201).send({ ...user, message: 'User created', token: session.token, expires_at: session.expires_at })
    } catch (err) {
        const error = err as unknown as Error & { code: string }
        if (error.code === '23505') {
            return res.status(409).send({ error: 'User ID already exists' })
        }

        return res.status(500).send({ error: error.message })
    }
}

function isMailAdminConfigError(error: unknown) {
    return error instanceof Error && error.message.includes('MAIL_ADMIN_PASSWORD is required')
}
