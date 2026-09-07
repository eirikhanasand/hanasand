import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import run, { withTransaction } from '#db'
import { normalizeEmail, usernameError } from '#utils/auth/accountIdentity.ts'
import { validatePassword } from '#utils/auth/password.ts'
import login from '#utils/auth/login.ts'
import { loadSQL } from '#utils/loadSQL.ts'
import { ensureMailAccountForUser } from '#utils/mail/accounts.ts'
import { normalizeUsername } from '#utils/auth/reservedUsernames.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'

type GetUserBodyProps = {
    id: string
    name: string
    password: string
    avatar: string
    email: string
}

export default async function postUser(req: FastifyRequest, res: FastifyReply) {
    const { id, name, password, avatar, email: submittedEmail } = req.body as GetUserBodyProps ?? {}
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
        let assignedRoot = false
        const hashedPassword = await bcrypt.hash(password, 10)
        const response = await withTransaction(async query => {
            await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`email:${email}`])
            await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`username:${normalizedId}`])
            return query(
                `INSERT INTO users (id,name,password,avatar,username,email)
                VALUES ($1,$2,$3,$4,$1,$5)
                ON CONFLICT DO NOTHING`,
                [normalizedId, name.trim(), hashedPassword, avatar || '', email]
            )
        })

        if (!response.rowCount) {
            return res.status(400).send({ error: 'This username or email is already registered. Sign in to the existing account.' })
        }

        const userQuery = await loadSQL('assignUserRole.sql')
        await run(userQuery, [normalizedId])
        if (process.env.SKIP_MAIL_PROVISIONING !== '1') {
            await ensureMailAccountForUser(normalizedId, name, password).catch(error => {
                if (isMailAdminConfigError(error)) {
                    req.log.debug({ userId: normalizedId }, 'Mail provisioning skipped because mail administration is not configured')
                    return
                }

                req.log.warn({ error, userId: normalizedId }, 'Failed to provision mail account during signup')
            })
        }

        const rootResult = await run('SELECT * FROM root')
        if (rootResult.rows.length <= 1) {
            const rootQuery = await loadSQL('assignAdministratorRole.sql')
            await run(rootQuery, [normalizedId])
            assignedRoot = true
            await recordSystemEvent(req, {
                actionType: 'admin.account.created',
                actorId: null,
                source: 'auth',
                targetType: 'user',
                targetId: normalizedId,
                severity: 'warning',
                context: { creationPath: 'first_user_root_bootstrap' },
            })
        }

        const roleQuery = `
            SELECT r.id, r.name, r.description, r.priority
            FROM roles r
            JOIN user_roles ur ON ur.role_id = r.id
            WHERE ur.user_id = $1
            ORDER BY r.priority ASC, r.id ASC
        `
        const roleResponse = await run(roleQuery, [normalizedId])
        const roles = roleResponse.rows

        const session = await login({ id: normalizedId, ip, userAgent })
        if (!session) {
            const base = { ...user, message: 'User created', roles, error: 'Unable to login. Please try again later.' }
            const data = assignedRoot ? { ...base, assignedRoot } : base
            return res.status(206).send(data)
        }

        const base = { ...user, message: 'User created', roles, token: session.token, expires_at: session.expires_at }
        const data = assignedRoot ? { ...base, assignedRoot } : base
        return res.status(201).send(data)
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
