import crypto from 'crypto'
import fs from 'fs'
import pg from 'pg'

const insideDocker = fs.existsSync('/.dockerenv')
const apiBase = process.env.API_BASE || (insideDocker ? 'http://127.0.0.1:8081/api' : 'http://127.0.0.1:8080/api')
const frontendBase = process.env.FRONTEND_BASE || (insideDocker ? 'http://frontend:3000' : 'http://127.0.0.1:3000')
const dbHost = process.env.DB_HOST || (insideDocker ? 'hanasand_database' : '127.0.0.1')
const dbPort = Number(process.env.DB_PORT || (insideDocker ? 5432 : 8503))
const dbName = process.env.DB || 'hanasand'
const dbUser = process.env.DB_USER || 'hanasand'
const dbPassword = process.env.DB_PASSWORD

if (!dbPassword) {
    console.error('DB_PASSWORD is required.')
    process.exit(1)
}

const runId = `rate_limit_smoke_${Date.now()}`
const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const { Pool } = pg
const pool = new Pool({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
})

let token = ''
let issuedSecret = ''
const createdKeyIds = []

function expect(condition, message, details) {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) {
            error.details = details
        }
        throw error
    }
}

function authHeaders(extra = {}) {
    return {
        Authorization: `Bearer ${token}`,
        id: runId,
        ...extra,
    }
}

function apiKeyHeaders(extra = {}) {
    return {
        'x-api-key': issuedSecret,
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

async function pageRequest(path, cookieHeader) {
    const response = await fetch(`${frontendBase}${path}`, {
        headers: {
            Cookie: cookieHeader,
        },
        redirect: 'manual',
    })

    const text = await response.text()
    return { response, text }
}

async function cleanup() {
    for (const keyId of createdKeyIds) {
        await pool.query('DELETE FROM api_key_scopes WHERE api_key_id = $1', [keyId]).catch(() => {})
        await pool.query('DELETE FROM api_keys WHERE id = $1', [keyId]).catch(() => {})
    }
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
}

async function seedAdminUser() {
    const signup = await request('/user', {
        method: 'POST',
        body: JSON.stringify({ id: runId, name: 'Rate Limit Smoke', password }),
    })
    expect(signup.response.status === 201, 'Failed to create rate-limit smoke user.', signup.body)

    await pool.query(`
        INSERT INTO user_roles (user_id, role_id, assigned_by)
        SELECT $1, role_id, 'administrator'
        FROM unnest($2::text[]) AS role_id
        ON CONFLICT DO NOTHING
    `, [runId, ['users', 'administrator', 'system_admin']])

    const login = await request(`/auth/login/${runId}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    })
    expect(Boolean(login.body?.token), 'Failed to log in rate-limit smoke user.', login.body)
    token = login.body.token

    const cookieHeader = [
        `access_token=${token}`,
        `id=${runId}`,
    ].join('; ')
    const dashboard = await pageRequest('/dashboard/system/rate-limits', cookieHeader)
    expect(dashboard.response.status === 200, 'Rate-limit dashboard page did not render for authenticated admin.', {
        status: dashboard.response.status,
    })
    expect(dashboard.text.includes('Rate limits and API keys'), 'Rate-limit dashboard copy is missing from the rendered page.', dashboard.text.slice(0, 1200))
}

async function main() {
    await cleanup()
    await seedAdminUser()

    const settings = await request('/rate-limit/settings', {
        headers: authHeaders(),
    })
    expect(settings.response.status === 200, 'Failed to fetch rate-limit settings.', settings.body)
    expect(Array.isArray(settings.body?.routes) && settings.body.routes.some((route) => route.route === '/api/status'), 'Rate-limit route catalog is missing /api/status.', settings.body)
    expect(Array.isArray(settings.body?.tierPresets) && settings.body.tierPresets.some((preset) => preset.id === 'starter'), 'Rate-limit tier presets are missing from settings.', settings.body)

    const invalidSettings = await request('/rate-limit/settings', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
            enabled: true,
            defaults: settings.body.settings.defaults,
            overrides: [
                {
                    id: 'dup_override_one',
                    enabled: true,
                    scope: 'anonymous',
                    method: 'GET',
                    route: '/api/status',
                    windowMs: 60_000,
                    maxRequests: 10,
                },
                {
                    id: 'dup_override_two',
                    enabled: true,
                    scope: 'anonymous',
                    method: 'GET',
                    route: '/api/status',
                    windowMs: 60_000,
                    maxRequests: 15,
                },
            ],
        }),
    })
    expect(invalidSettings.response.status === 400, 'Duplicate rate-limit overrides should be rejected.', invalidSettings.body)

    const invalidKey = await request('/rate-limit/keys', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            ownerId: runId,
            name: 'Invalid duplicate scope key',
            tier: 'starter',
            description: 'Duplicate scope smoke test token',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            scopes: [
                {
                    id: 'dup_one',
                    enabled: true,
                    method: 'GET',
                    route: '/api/status',
                    limits: { perSecond: 2, perMinute: 5, perHour: 20, perDay: 100 },
                },
                {
                    id: 'dup_two',
                    enabled: true,
                    method: 'GET',
                    route: '/api/status',
                    limits: { perSecond: 2, perMinute: 5, perHour: 20, perDay: 100 },
                },
            ],
        }),
    })
    expect(invalidKey.response.status === 400, 'Duplicate API key scopes should be rejected.', invalidKey.body)

    const key = await request('/rate-limit/keys', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            ownerId: runId,
            name: 'Smoke status key',
            tier: 'starter',
            description: 'Scoped smoke test token',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            enabled: true,
            scopes: [{
                enabled: true,
                method: 'GET',
                route: '/api/status',
                limits: {
                    perSecond: 2,
                    perMinute: 5,
                    perHour: 20,
                    perDay: 100,
                },
            }],
        }),
    })
    expect(key.response.status === 201, 'Failed to create scoped API key.', key.body)
    expect(typeof key.body?.secret === 'string' && key.body.secret.startsWith('hsk_'), 'Issued API key secret was missing.', key.body)
    createdKeyIds.push(key.body.apiKey.id)
    issuedSecret = key.body.secret

    const sameScopeKey = await request('/rate-limit/keys', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            ownerId: runId,
            name: 'Second smoke status key',
            tier: 'starter',
            description: 'Independent key using the same route scope',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            enabled: true,
            scopes: [{
                enabled: true,
                method: 'GET',
                route: '/api/status',
                limits: { perSecond: 1, perMinute: 5, perHour: 20, perDay: 100 },
            }],
        }),
    })
    expect(sameScopeKey.response.status === 201, 'Two API keys should independently scope the same route.', sameScopeKey.body)
    createdKeyIds.push(sameScopeKey.body.apiKey.id)
    expect(key.body.apiKey.scopes[0].id !== sameScopeKey.body.apiKey.scopes[0].id, 'API key scope IDs must be globally unique.', {
        first: key.body.apiKey.scopes[0].id,
        second: sameScopeKey.body.apiKey.scopes[0].id,
    })

    const statusFirst = await request('/status', {
        headers: apiKeyHeaders(),
    })
    expect(statusFirst.response.status === 200, 'Scoped key should access /api/status.', statusFirst.body)
    expect(statusFirst.response.headers.get('x-api-key-rate-limit-second') === '2', 'Scoped key second-limit header mismatch.', Object.fromEntries(statusFirst.response.headers.entries()))

    const notes = await request('/notes', {
        headers: apiKeyHeaders(),
    })
    expect(notes.response.status === 403, 'Scoped key should be rejected from /api/notes.', notes.body)

    const burst = await Promise.all([
        request('/status', { headers: apiKeyHeaders() }),
        request('/status', { headers: apiKeyHeaders() }),
        request('/status', { headers: apiKeyHeaders() }),
    ])
    const burstStatuses = burst.map((entry) => entry.response.status)
    expect(burstStatuses.filter((status) => status === 429).length >= 1, 'Burst traffic should trigger at least one 429.', burst.map((entry) => ({ status: entry.response.status, body: entry.body })))

    console.log(JSON.stringify({
        insideDocker,
        routeCount: settings.body.routes.length,
        issuedKeyId: createdKeyIds[0],
        burstStatuses,
        rateLimitHeaders: {
            second: statusFirst.response.headers.get('x-api-key-rate-limit-second'),
            minute: statusFirst.response.headers.get('x-api-key-rate-limit-minute'),
            hour: statusFirst.response.headers.get('x-api-key-rate-limit-hour'),
            day: statusFirst.response.headers.get('x-api-key-rate-limit-day'),
        },
    }, null, 2))
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await cleanup()
        await pool.end()
    })
