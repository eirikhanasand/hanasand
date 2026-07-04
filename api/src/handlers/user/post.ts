import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import run from '#db'
import checkPwned from '#utils/pwned/checkPwned.ts'
import login from '#utils/auth/login.ts'
import { loadSQL } from '#utils/loadSQL.ts'
import { ensureMailAccountForUser } from '#utils/mail/accounts.ts'
import { getReservedUsernameReason, normalizeUsername } from '#utils/auth/reservedUsernames.ts'

type GetUserBodyProps = {
    id: string
    name: string
    password: string
    avatar: string
}

export default async function postUser(req: FastifyRequest, res: FastifyReply) {
    const { id, name, password, avatar } = req.body as GetUserBodyProps ?? {}
    const normalizedId = normalizeUsername(id || '')
    const user = { id: normalizedId, name }
    const ip = req.ip
    const userAgent = String(req.headers['user-agent'] || '')

    if (!id || !name || !password) {
        return res.status(400).send({ error: 'Missing fields' })
    }

    const reservedReason = getReservedUsernameReason(normalizedId)
    if (reservedReason) {
        return res.status(400).send({ error: reservedReason })
    }

    let numbers = 0
    let specialCharacters = 0
    let lowerCaseCharacters = 0
    let upperCaseCharacters = 0
    for (const char of password) {
        if (!isNaN(Number(char))) {
            numbers++
        }

        if (/[^a-zA-Z0-9]/.test(char)) {
            specialCharacters++
        }

        if (/[a-z]/.test(char)) {
            lowerCaseCharacters++
        }

        if (/[A-Z]/.test(char)) {
            upperCaseCharacters++
        }
    }

    if (password.length < 16 || numbers < 2 || specialCharacters < 2 || lowerCaseCharacters < 2 || upperCaseCharacters < 2) {
        return res.status(400).send({ error: 'The password does not meet the requirements.' })
    }

    const pwned = await checkPwned(password)
    if (!pwned.ok) {
        return res.status(400).send({ error: `This password is weak, and has been pwned ${pwned.count} ${pwned.count === 1 ? 'time' : 'times'}.` })
    }

    try {
        let assignedRoot = false
        const hashedPassword = await bcrypt.hash(password, 10)
        const response = await run(
            `INSERT INTO users (id, name, password, avatar) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO NOTHING`,
            [normalizedId, name, hashedPassword, avatar || '']
        )

        if (!response.rowCount) {
            return res.status(400).send({ error: 'The username is taken.' })
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
