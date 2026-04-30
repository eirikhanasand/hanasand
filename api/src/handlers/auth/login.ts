import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import run from '#db'
import login from '#utils/auth/login.ts'

export default async function loginHandler(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string } ?? {}
    const { password } = req.body as { password: string } ?? {}
    const identifier = String(id || '').trim()
    const ip = req.ip
    const userAgent = String(req.headers['user-agent'] || '')
    if (!identifier || !password) {
        return res.status(400).send({ error: 'Missing username or password.' })
    }

    try {
        const query = `
            SELECT u.id, u.name, u.password, u.avatar, u.active
            FROM users u
            LEFT JOIN mail_accounts ma ON ma.user_id = u.id
            WHERE u.id = $1
               OR lower(ma.mail_address) = lower($1)
            LIMIT 1
        `
        const result = await run(query, [identifier])
        if (result.rows.length === 0) {
            await recordLoginEvent(identifier, ip, userAgent, 'unknown_user')
            return res.status(404).send({ error: 'Incorrect username or password.' })
        }

        const user = result.rows[0]
        const userId = user.id
        if (user.active === false) {
            await recordLoginEvent(userId, ip, userAgent, 'deactivated')
            return res.status(403).send({ error: 'This account is deactivated.' })
        }

        const attemptCheck = await run('SELECT attempts FROM attempts WHERE id = $1', [userId])
        if (attemptCheck.rows.length > 0 && attemptCheck.rows[0].attempts >= 3) {
            req.log.warn({ userId, ip, userAgent }, 'Login rate limited')
            await recordLoginEvent(userId, ip, userAgent, 'rate_limited')
            return res.status(429).send({ error: 'Please try again later.' })
        }

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
            const attemptQuery = `
            INSERT INTO attempts (id, attempts, ip)
            VALUES ($1, 1, $2)
            ON CONFLICT (id)
            DO UPDATE SET
                attempts = attempts.attempts + 1,
                ip = EXCLUDED.ip,
                timestamp = NOW();
            `
            await run(attemptQuery, [userId, ip])
            await recordLoginEvent(userId, ip, userAgent, 'bad_password')
            req.log.info({ userId, ip, userAgent }, 'Invalid login password')
            return res.status(401).send({ error: 'Incorrect username or password.' })
        }

        await run('DELETE FROM attempts WHERE id = $1', [userId])
        const { password: ignoredPassword, ...userWithoutPassword } = user
        void ignoredPassword
        const roleQuery = `
            SELECT r.id, r.name, r.description, r.priority
            FROM roles r
            JOIN user_roles ur ON ur.role_id = r.id
            WHERE ur.user_id = $1
        `
        const roleResponse = await run(roleQuery, [userId])
        const roles = roleResponse.rows
        const session = await login({ id: userId, ip, userAgent })
        if (!session) {
            req.log.error({ userId, ip, userAgent }, 'Login session issuance failed')
            await recordLoginEvent(userId, ip, userAgent, 'session_issue_failed')
            return res.status(503).send({ ...userWithoutPassword, error: 'Please try again later.' })
        }

        return res.send({ ...userWithoutPassword, roles, token: session.token, expires_at: session.expires_at })
    } catch (err: unknown) {
        const error = err as Error
        req.log.error({ err: error, identifier, ip, userAgent }, 'Login failed unexpectedly')
        await recordLoginEvent(identifier, ip, userAgent, 'unexpected_error')
        return res.status(500).send({ error: 'Unable to login. Please try again later.' })
    }
}

async function recordLoginEvent(userId: string, ip: string, userAgent: string, reason: string) {
    await run(
        'INSERT INTO login_events (user_id, ip, user_agent, status, reason) VALUES ($1, $2, $3, $4, $5)',
        [userId, ip, userAgent, 'failed', reason],
    ).catch(() => {})
}
