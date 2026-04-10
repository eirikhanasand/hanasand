import { randomUUID } from 'crypto'
import run from '#db'

const SESSION_TTL_HOURS = 24

type SessionRow = {
    id: string
    token: string
    ip: string
    timestamp: string
}

type SessionUser = {
    id: string
    name: string
    avatar: string
}

type SessionRole = {
    id: string
    name: string
    description: string
    priority: number
}

export async function issueToken({ id, ip }: { id: string, ip: string }) {
    const token = `${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}`

    await run(`
        DELETE FROM tokens
        WHERE id = $1
          AND ip = $2
    `, [id, ip])

    const loginResult = await run(
        'INSERT INTO tokens (id, token, ip) VALUES ($1, $2, $3) RETURNING token, timestamp;',
        [id, token, ip]
    )

    if (!loginResult.rowCount) {
        return null
    }

    return {
        token,
        expires_at: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    }
}

export async function validateSession({ id, token }: { id?: string, token: string }) {
    const tokenResult = await run(`
        SELECT id, token, ip, timestamp
        FROM tokens
        WHERE ($1::text IS NULL OR id = $1)
          AND token = $2
          AND timestamp >= NOW() - INTERVAL '${SESSION_TTL_HOURS} hours'
        LIMIT 1
    `, [id ?? null, token])

    if (!tokenResult.rows.length) {
        return null
    }

    const session = tokenResult.rows[0] as SessionRow
    const userId = session.id

    const userResult = await run(`
        SELECT id, name, avatar
        FROM users
        WHERE id = $1
        LIMIT 1
    `, [userId])

    if (!userResult.rows.length) {
        return null
    }

    const roleResult = await run(`
        SELECT r.id, r.name, r.description, r.priority
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = $1
        ORDER BY r.priority ASC, r.id ASC
    `, [userId])

    await run(`
        UPDATE tokens
        SET timestamp = NOW()
        WHERE id = $1
          AND token = $2
    `, [userId, token])

    return {
        user: userResult.rows[0] as SessionUser,
        roles: roleResult.rows as SessionRole[],
        session,
        refreshed: {
            token,
            expires_at: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString(),
        }
    }
}
