import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { hostConsoleNames, inspectHost, normalizeHostPublicKey } from '#utils/hostSsh.ts'

export default async function getHostOverview(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'private, no-store')
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id || auth.impersonating) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }
    if (!(await hasRole(req, res, 'system_admin')).valid) {
        return res.status(403).send({ error: 'System administrator access is required.' })
    }
    try {
        const [hosts, usersResult] = await Promise.all([
            Promise.all(hostConsoleNames.map(inspectHost)),
            run(`
                SELECT
                    u.id,
                    COALESCE(NULLIF(u.name, ''), COALESCE(u.username, u.id)) AS name,
                    COALESCE(u.username, u.id) AS username,
                    c.id AS certificate_id,
                    c.public_key
                FROM users u
                JOIN user_certificates uc ON uc.user_id = u.id
                JOIN certificates c ON c.id = uc.certificate_id
                WHERE u.active IS TRUE
                  AND u.deletion_scheduled_at IS NULL
                ORDER BY name ASC, username ASC, c.id ASC
            `),
        ])
        const usersById = new Map<string, { id: string, name: string, username: string, keyCount: number }>()
        for (const row of usersResult.rows) {
            if (!normalizeHostPublicKey(row.public_key)) continue
            const userId = String(row.id)
            const user = usersById.get(userId) || { id: userId, name: String(row.name), username: String(row.username), keyCount: 0 }
            user.keyCount++
            usersById.set(userId, user)
        }
        const users = [...usersById.values()]
        return res.send({ hosts, users })
    } catch (error) {
        req.log.error({ err: error }, 'Unable to load host overview.')
        return res.status(500).send({ error: 'Unable to load hosts.' })
    }
}
