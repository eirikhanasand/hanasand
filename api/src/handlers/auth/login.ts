import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import run from '#db'
import login from '#utils/auth/login.ts'

export default async function loginHandler(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string } ?? {}
    const { password } = req.body as { password: string } ?? {}
    if (!id || !password) {
        return res.status(400).send({ error: 'Missing username or password.' })
    }

    try {
        const ip = req.ip
        const userAgent = req.headers['user-agent'] || ''
        const query = 'SELECT id, name, password, avatar, active FROM users WHERE id = $1'
        const result = await run(query, [id])
        if (result.rows.length === 0) {
            await run('INSERT INTO login_events (user_id, ip, user_agent, status, reason) VALUES ($1, $2, $3, $4, $5)', [id, ip, String(userAgent), 'failed', 'unknown_user']).catch(() => {})
            return res.status(404).send({ error: 'Incorrect username or password.' })
        }

        const user = result.rows[0]
        if (user.active === false) {
            await run('INSERT INTO login_events (user_id, ip, user_agent, status, reason) VALUES ($1, $2, $3, $4, $5)', [id, ip, String(userAgent), 'failed', 'deactivated']).catch(() => {})
            return res.status(403).send({ error: 'This account is deactivated.' })
        }

        const attemptCheck = await run('SELECT attempts FROM attempts WHERE id = $1 AND ip = $2', [id, ip])
        if (attemptCheck.rows.length > 0 && attemptCheck.rows[0].attempts >= 3) {
            console.log('Too many failed attempts. Please try again later.')
            await run('INSERT INTO login_events (user_id, ip, user_agent, status, reason) VALUES ($1, $2, $3, $4, $5)', [id, ip, String(userAgent), 'failed', 'rate_limited']).catch(() => {})
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
            await run(attemptQuery, [id, ip])
            await run('INSERT INTO login_events (user_id, ip, user_agent, status, reason) VALUES ($1, $2, $3, $4, $5)', [id, ip, String(userAgent), 'failed', 'bad_password']).catch(() => {})
            console.log(`Invalid password for ${id}.`)
            return res.status(401).send({ error: 'Incorrect username or password.' })
        }

        await run('DELETE FROM attempts WHERE id = $1 AND ip = $2', [id, ip])
        const { password: _, ...userWithoutPassword } = user
        const roleQuery = `
            SELECT r.id, r.name, r.description, r.priority
            FROM roles r
            JOIN user_roles ur ON ur.role_id = r.id
            WHERE ur.user_id = $1
        `
        const roleResponse = await run(roleQuery, [id])
        const roles = roleResponse.rows
        const session = await login({ id, ip, userAgent: String(userAgent) })
        if (!session) {
            return res.status(503).send({ ...userWithoutPassword, error: 'Please try again later.' })
        }

        return res.send({ ...userWithoutPassword, roles, token: session.token, expires_at: session.expires_at })
    } catch (err: unknown) {
        const error = err as Error
        return res.status(500).send({ error: error.message })
    }
}
