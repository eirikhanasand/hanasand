import crypto from 'crypto'
import pg from 'pg'

const apiBase = process.env.API_BASE || 'http://127.0.0.1:8080/api'
const dbHost = process.env.DB_HOST || '127.0.0.1'
const dbPort = Number(process.env.DB_PORT || 5432)
const dbName = process.env.DB || 'hanasand'
const dbUser = process.env.DB_USER || 'hanasand'
const dbPassword = process.env.DB_PASSWORD
const { Pool } = pg

if (!dbPassword) {
    console.error('DB_PASSWORD is required.')
    process.exit(1)
}

const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10)
const adminId = `pw_${suffix}_a`
const targetId = `pw_${suffix}_t`
const inactiveTargetId = `pw_${suffix}_i`
const nonAdminId = `pw_${suffix}_u`
const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const pool = new Pool({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
})

function expect(condition, message, details) {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) error.details = details
        throw error
    }
}

function authHeaders(userId, token, extra = {}) {
    return {
        Authorization: `Bearer ${token}`,
        id: userId,
        ...extra,
    }
}

async function request(path, init = {}) {
    const response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers || {}),
        },
    })
    const text = await response.text()
    let body
    try {
        body = text ? JSON.parse(text) : null
    } catch {
        body = text
    }
    return { response, body }
}

async function signup(id, name = id) {
    const created = await request('/user', {
        method: 'POST',
        body: JSON.stringify({ id, name, password }),
    })
    expect(created.response.status === 201, `Failed to create user ${id}.`, created.body)
}

async function login(id) {
    const loggedIn = await request(`/auth/login/${id}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    })
    expect(Boolean(loggedIn.body?.token), `Failed to log in user ${id}.`, loggedIn.body)
    return loggedIn.body.token
}

async function grantAdmin() {
    await pool.query(`
        INSERT INTO roles (id, name, description, priority, created_by)
        VALUES ('administrator', 'Administrator', 'Full administrative access', 0, $1)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `, [adminId])
    await pool.query(`
        INSERT INTO user_roles (user_id, role_id, assigned_by)
        VALUES ($1, 'administrator', $1)
        ON CONFLICT (user_id, role_id) DO NOTHING
    `, [adminId])
}

async function cleanup() {
    const ids = [adminId, targetId, inactiveTargetId, nonAdminId]
    await pool.query('DELETE FROM impersonation_events WHERE actor_id = ANY($1::text[]) OR target_id = ANY($1::text[])', [ids]).catch(() => {})
    await pool.query('DELETE FROM impersonation_sessions WHERE actor_id = ANY($1::text[]) OR target_id = ANY($1::text[])', [ids]).catch(() => {})
    await pool.query('DELETE FROM user_roles WHERE user_id = ANY($1::text[])', [ids]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = ANY($1::text[])', [ids]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [ids]).catch(() => {})
}

async function main() {
    await cleanup()
    await signup(adminId, 'Impersonation Admin')
    await signup(targetId, 'Impersonation Target')
    await signup(inactiveTargetId, 'Inactive Impersonation Target')
    await signup(nonAdminId, 'Impersonation Non Admin')
    await grantAdmin()
    await pool.query('UPDATE users SET active = FALSE WHERE id = $1', [inactiveTargetId])

    const adminToken = await login(adminId)
    const nonAdminToken = await login(nonAdminId)

    const missingTarget = await request('/impersonation/start', {
        method: 'POST',
        headers: authHeaders(adminId, adminToken),
        body: JSON.stringify({ target_id: `missing_${suffix}` }),
    })
    expect(missingTarget.response.status === 404, 'Missing target should be rejected.', missingTarget.body)

    const inactiveTarget = await request('/impersonation/start', {
        method: 'POST',
        headers: authHeaders(adminId, adminToken),
        body: JSON.stringify({ target_id: inactiveTargetId }),
    })
    expect(inactiveTarget.response.status === 404, 'Inactive target should be rejected.', inactiveTarget.body)

    const selfTarget = await request('/impersonation/start', {
        method: 'POST',
        headers: authHeaders(adminId, adminToken),
        body: JSON.stringify({ target_id: adminId }),
    })
    expect(selfTarget.response.status === 400, 'Self impersonation should be rejected.', selfTarget.body)

    const nonAdminStart = await request('/impersonation/start', {
        method: 'POST',
        headers: authHeaders(nonAdminId, nonAdminToken),
        body: JSON.stringify({ target_id: targetId }),
    })
    expect(nonAdminStart.response.status === 403, 'Non-admin start should be rejected.', nonAdminStart.body)

    const legacyHeader = await request(`/user/full/${targetId}`, {
        headers: authHeaders(adminId, adminToken, { 'x-impersonate-id': targetId }),
    })
    expect(legacyHeader.response.status !== 200, 'Legacy target header should not impersonate.', legacyHeader.body)

    const started = await request('/impersonation/start', {
        method: 'POST',
        headers: authHeaders(adminId, adminToken),
        body: JSON.stringify({ target_id: targetId, reason: 'impersonation regression smoke' }),
    })
    expect(started.response.status === 200, 'Admin start should succeed.', started.body)
    expect(started.body?.token && started.body.token !== targetId, 'Start should return an opaque token.', started.body)
    expect(started.body?.session?.target?.id === targetId, 'Start should return the target.', started.body)

    const impersonationToken = started.body.token
    const sessionId = started.body.session.id
    const stored = await pool.query('SELECT token_hash, revoked_at FROM impersonation_sessions WHERE id = $1', [sessionId])
    expect(stored.rows.length === 1, 'Session should be stored.', stored.rows)
    expect(stored.rows[0].token_hash !== impersonationToken, 'Raw impersonation token must not be stored.', stored.rows[0])
    expect(stored.rows[0].token_hash === crypto.createHash('sha256').update(impersonationToken).digest('hex'), 'Stored token hash mismatch.', stored.rows[0])

    const viewed = await request(`/user/full/${targetId}`, {
        headers: authHeaders(adminId, adminToken, { 'x-impersonation-token': impersonationToken }),
    })
    expect(viewed.response.status === 200, 'Impersonated view should succeed.', viewed.body)
    expect(viewed.response.headers.get('x-impersonating-id') === targetId, 'Response should expose target header.', Object.fromEntries(viewed.response.headers.entries()))
    expect(viewed.response.headers.get('x-authenticated-id') === adminId, 'Response should expose actor header.', Object.fromEntries(viewed.response.headers.entries()))

    const blocked = await request('/auth/sessions/0', {
        method: 'DELETE',
        headers: authHeaders(adminId, adminToken, { 'x-impersonation-token': impersonationToken }),
        body: JSON.stringify({}),
    })
    expect(blocked.response.status === 403, 'Sensitive action should be blocked while impersonating.', blocked.body)
    expect(String(blocked.body?.error || '').includes('Return to own view'), 'Sensitive action should explain how to proceed.', blocked.body)

    const events = await request('/impersonation/events', {
        headers: authHeaders(adminId, adminToken),
    })
    expect(events.response.status === 200 && Array.isArray(events.body?.events), 'Admin should fetch audit events.', events.body)
    expect(events.body.events.some(event => event.session_id === sessionId && event.path === '/api/impersonation/start'), 'Start event should be audited.', events.body.events)
    expect(
        events.body.events.some(event => event.session_id === sessionId && ['/user/full/', '/api/user/full/'].some(prefix => event.path === `${prefix}${targetId}`)),
        'Impersonated route should be audited.',
        events.body.events
    )

    const filtered = await request(`/impersonation/events?q=${encodeURIComponent(targetId)}&actor=${encodeURIComponent(adminId)}&target=${encodeURIComponent(targetId)}&method=GET&path=${encodeURIComponent('/user/full')}&session=${encodeURIComponent(sessionId.slice(0, 8))}&limit=10`, {
        headers: authHeaders(adminId, adminToken),
    })
    expect(filtered.response.status === 200 && Array.isArray(filtered.body?.events), 'Filtered audit fetch should succeed.', filtered.body)
    expect(filtered.body.events.length >= 1 && filtered.body.events.length <= 10, 'Filtered audit fetch should respect filters and limit.', filtered.body.events)
    expect(filtered.body.events.every(event => event.actor_id === adminId && event.target_id === targetId && event.method === 'GET' && event.session_id === sessionId), 'Filtered audit events should match requested filters.', filtered.body.events)

    const stop = await request('/impersonation', {
        method: 'DELETE',
        headers: authHeaders(adminId, adminToken, { 'x-impersonation-token': impersonationToken }),
    })
    expect(stop.response.status === 200, 'Stop should succeed.', stop.body)

    const revoked = await pool.query('SELECT revoked_at, revoked_by FROM impersonation_sessions WHERE id = $1', [sessionId])
    expect(Boolean(revoked.rows[0]?.revoked_at), 'Stop should revoke the session.', revoked.rows[0])
    expect(revoked.rows[0]?.revoked_by === adminId, 'Stop should record revoker.', revoked.rows[0])

    const reused = await request(`/user/full/${targetId}`, {
        headers: authHeaders(adminId, adminToken, { 'x-impersonation-token': impersonationToken }),
    })
    expect(reused.response.status === 401, 'Revoked token should be rejected.', reused.body)
    expect(String(reused.body?.error || '').includes('expired'), 'Revoked token should explain expiration.', reused.body)

    console.log(JSON.stringify({
        ok: true,
        actor: adminId,
        target: targetId,
        checked: [
            'admin-only start',
            'missing/inactive/self targets',
            'legacy target header ignored',
            'opaque hashed session storage',
            'actor/target response headers',
            'sensitive action guardrail',
            'audit events',
            'audit filters',
            'stop and revoked-token rejection',
        ],
    }, null, 2))
}

main()
    .catch((error) => {
        console.error(error.details ?? error)
        process.exitCode = 1
    })
    .finally(async () => {
        await cleanup()
        await pool.end()
    })
