import { randomUUID } from 'crypto'
import run from '#db'

const SESSION_TTL_HOURS = 24
const DESKTOP_SESSION_TTL_HOURS = 24 * 30

type SessionRow = {
    token_id: number
    id: string
    token: string
    ip: string
    user_agent: string
    created_at: string
    timestamp: string
}

type SessionUser = {
    id: string
    name: string
    avatar: string
    active: boolean
    deletion_scheduled_at?: string | null
}

type SessionRole = {
    id: string
    name: string
    description: string
    priority: number
}

function sessionTTLHours(userAgent = '') {
    return userAgent.startsWith('Hanasand Desktop/')
        ? DESKTOP_SESSION_TTL_HOURS
        : SESSION_TTL_HOURS
}

function isSessionFresh(session: SessionRow) {
    const lastSeen = new Date(session.timestamp).getTime()
    if (!Number.isFinite(lastSeen)) {
        return false
    }

    const ttlMs = sessionTTLHours(session.user_agent) * 60 * 60 * 1000
    return Date.now() - lastSeen <= ttlMs
}

export async function issueToken({ id, ip, userAgent = '' }: { id: string, ip: string, userAgent?: string }) {
    const token = `${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}`
    const ttlHours = sessionTTLHours(userAgent)

    const loginResult = await run(
        'INSERT INTO tokens (id, token, ip, user_agent) VALUES ($1, $2, $3, $4) RETURNING token_id, token, timestamp;',
        [id, token, ip, userAgent]
    )

    if (!loginResult.rowCount) {
        return null
    }

    await run(`
        INSERT INTO login_events (user_id, token_id, ip, user_agent, status)
        VALUES ($1, $2, $3, $4, 'success')
    `, [id, loginResult.rows[0].token_id, ip, userAgent])

    return {
        token,
        expires_at: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
    }
}

export async function validateSession({ id, token }: { id?: string, token: string }) {
    const tokenResult = await run(`
        SELECT token_id, id, token, ip, user_agent, created_at, timestamp
        FROM tokens
        WHERE ($1::text IS NULL OR id = $1)
          AND token = $2
          AND revoked_at IS NULL
        LIMIT 1
    `, [id ?? null, token])

    if (!tokenResult.rows.length) {
        return null
    }

    const session = tokenResult.rows[0] as SessionRow
    if (!isSessionFresh(session)) {
        return null
    }

    const userId = session.id
    const ttlHours = sessionTTLHours(session.user_agent)

    const userResult = await run(`
        SELECT id, name, avatar, active, deletion_scheduled_at
        FROM users
        WHERE id = $1
          AND active IS TRUE
          AND deletion_scheduled_at IS NULL
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
            expires_at: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
        }
    }
}

export async function revokeToken({ tokenId, userId, revokedBy }: { tokenId: number, userId: string, revokedBy: string }) {
    const result = await run(`
        UPDATE tokens
        SET revoked_at = NOW(),
            revoked_by = $3
        WHERE token_id = $1
          AND id = $2
          AND revoked_at IS NULL
        RETURNING token_id
    `, [tokenId, userId, revokedBy])

    return (result.rowCount ?? 0) > 0
}

export async function revokeAllTokens({ userId, revokedBy, exceptToken }: { userId: string, revokedBy: string, exceptToken?: string }) {
    const result = await run(`
        UPDATE tokens
        SET revoked_at = NOW(),
            revoked_by = $2
        WHERE id = $1
          AND revoked_at IS NULL
          AND ($3::text IS NULL OR token <> $3)
    `, [userId, revokedBy, exceptToken ?? null])

    return result.rowCount ?? 0
}

export async function listSessions(userId: string) {
    const result = await run(`
        SELECT
            token_id,
            id,
            ip,
            user_agent,
            created_at,
            timestamp AS last_seen_at,
            revoked_at
        FROM tokens
        WHERE id = $1
        ORDER BY revoked_at NULLS FIRST, timestamp DESC
    `, [userId])

    return result.rows
}
