import { recoveryReadOnly } from '../resilience.ts'
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
    database_read_only?: boolean
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
    const account = await run('SELECT account_type FROM users WHERE id = $1', [id])
    if (account.rows[0]?.account_type === 'service') return null
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

    await run('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id])

    return {
        token,
        expires_at: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
    }
}

export async function validateSession({ id, token }: { id?: string, token: string }) {
    const tokenResult = await run(`
        SELECT t.token_id, t.id, t.token, t.ip, t.user_agent, t.created_at, t.timestamp,
            pg_is_in_recovery() AS database_read_only,
            json_build_object('id', u.id, 'name', u.name, 'avatar', u.avatar,
                'active', u.active, 'deletion_scheduled_at', u.deletion_scheduled_at) AS session_user,
            COALESCE((SELECT json_agg(role ORDER BY role.priority, role.id) FROM (
                SELECT r.id, r.name, r.description, r.priority
                FROM roles r JOIN user_roles ur ON ur.role_id = r.id
                WHERE ur.user_id = t.id
            ) role), '[]'::json) AS session_roles
        FROM tokens t JOIN users u ON u.id = t.id
        WHERE ($1::text IS NULL OR t.id = $1)
          AND t.token = $2 AND t.revoked_at IS NULL
          AND u.active IS TRUE AND u.deletion_scheduled_at IS NULL AND u.account_type = 'user'
        LIMIT 1
    `, [id ?? null, token])

    const row = tokenResult.rows[0] as (SessionRow & { session_user: SessionUser, session_roles: SessionRole[] }) | undefined
    if (!row || !isSessionFresh(row)) return null

    const { session_user: user, session_roles: roles, ...session } = row
    const userId = session.id
    const ttlHours = sessionTTLHours(session.user_agent)

    const readOnly = recoveryReadOnly() || session.database_read_only === true
    if (!readOnly) await run(`
        UPDATE tokens
        SET timestamp = NOW()
        WHERE id = $1
          AND token = $2
    `, [userId, token])

    return {
        user,
        roles,
        session,
        refreshed: {
            token,
            expires_at: new Date((readOnly ? new Date(session.timestamp).getTime() : Date.now()) + ttlHours * 60 * 60 * 1000).toISOString(),
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

export async function revokeAllTokens({ userId, revokedBy, exceptToken }: { userId: string, revokedBy: string, exceptToken?: string }, query: typeof run = run) {
    const result = await query(`
        UPDATE tokens
        SET revoked_at = NOW(),
            revoked_by = $2
        WHERE id = $1
          AND revoked_at IS NULL
          AND ($3::text IS NULL OR token <> $3)
    `, [userId, revokedBy, exceptToken ?? null])

    return result.rowCount ?? 0
}

export async function listSessions(userId: string, currentToken?: string) {
    const result = await run(`
        SELECT
            token_id,
            id,
            ip,
            user_agent,
            created_at,
            timestamp AS last_seen_at,
            revoked_at,
            token = $2 AS current
        FROM tokens
        WHERE id = $1
          AND revoked_at IS NULL
          AND timestamp >= NOW() - CASE
              WHEN user_agent LIKE 'Hanasand Desktop/%' THEN INTERVAL '30 days'
              ELSE INTERVAL '24 hours'
          END
        ORDER BY timestamp DESC
    `, [userId, currentToken ?? null])

    return result.rows
}
