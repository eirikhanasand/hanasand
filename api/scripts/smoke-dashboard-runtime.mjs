import crypto from 'crypto'
import pg from 'pg'

const apiBase = process.env.API_BASE || 'http://127.0.0.1:8080/api'
const frontendBase = process.env.FRONTEND_BASE || 'http://frontend:3000'
const dbHost = process.env.DB_HOST || '127.0.0.1'
const dbPort = Number(process.env.DB_PORT || 5432)
const dbName = process.env.DB || 'hanasand'
const dbUser = process.env.DB_USER || 'hanasand'
const dbPassword = process.env.DB_PASSWORD

if (!dbPassword) {
    console.error('DB_PASSWORD is required.')
    process.exit(1)
}

const runId = `smoke_${Date.now()}`
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

function authHeaders(extra = {}) {
    return {
        Authorization: `Bearer ${token}`,
        id: runId,
        ...extra,
    }
}

async function apiRequest(path, init = {}) {
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
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM vm_shutdown WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM vm_metrics WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM vm_details WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM vms WHERE name = $1', [`vm-${runId}`]).catch(() => {})
}

async function main() {
    await cleanup()

    const registration = await apiRequest('/user', {
        method: 'POST',
        body: JSON.stringify({ id: runId, name: 'Codex Smoke', password }),
    })
    if (registration.response.status !== 201 || !registration.body?.token) {
        throw new Error(`Failed to create smoke user: ${registration.response.status}`)
    }

    await pool.query(`
        INSERT INTO user_roles (user_id, role_id, assigned_by)
        SELECT $1, role_id, 'administrator'
        FROM unnest($2::text[]) AS role_id
        ON CONFLICT DO NOTHING
    `, [runId, ['users', 'user_admin', 'system_admin', 'content_admin']])

    const login = await apiRequest(`/auth/login/${runId}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    })
    if (!login.body?.token) {
        throw new Error(`Failed to log in smoke user: ${login.response.status}`)
    }
    token = login.body.token

    const vmName = `vm-${runId}`
    const vmCreate = await apiRequest('/vm', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: vmName, owner: runId, created_by: runId, access_users: [runId] }),
    })
    if (vmCreate.response.status !== 201) {
        throw new Error(`Failed to create smoke VM: ${vmCreate.response.status}`)
    }

    const realtime = await apiRequest('/logs/realtime?limit=20', {
        headers: authHeaders(),
    })
    if (realtime.response.status !== 200) {
        throw new Error(`Realtime logs request failed: ${realtime.response.status}`)
    }

    const runtimeAvailable = Boolean(realtime.body?.runtime_available)
    const nativeAvailable = realtime.body?.native_available !== false
    const containerCount = Array.isArray(realtime.body?.containers) ? realtime.body.containers.length : 0

    const cookieHeader = [
        `access_token=${token}`,
        `id=${runId}`,
        'roles=[{"id":"system_admin"},{"id":"user_admin"},{"id":"content_admin"}]',
    ].join('; ')

    const pages = [
        '/dashboard/overview',
        '/dashboard/logs',
        '/dashboard/backup',
        '/dashboard/management',
        `/dashboard/management/${vmName}`,
        '/dashboard/system',
        `/dashboard/system/${vmName}`,
        '/status',
    ]

    const pageResults = []
    for (const path of pages) {
        const result = await pageRequest(path, cookieHeader)
        const expectedRedirect = path === '/dashboard/backup' ? '/dashboard/db' : null
        pageResults.push({
            path,
            status: result.response.status,
            redirected: result.response.status >= 300 && result.response.status < 400,
            location: result.response.headers.get('location'),
            looksLikeHtml: result.text.includes('<!DOCTYPE html>'),
            expectedRedirect,
        })
    }

    console.log(JSON.stringify({
        runtime_available: runtimeAvailable,
        native_available: nativeAvailable,
        container_count: containerCount,
        page_results: pageResults,
    }, null, 2))

    const failedPage = pageResults.find((page) => {
        if (page.expectedRedirect) {
            return page.status !== 307 || page.location !== page.expectedRedirect
        }

        return page.status !== 200 || !page.looksLikeHtml
    })
    if (!runtimeAvailable) {
        throw new Error('Runtime log source is unavailable.')
    }
    if (containerCount < 1) {
        throw new Error('No running containers were reported by /logs/realtime.')
    }
    if (failedPage) {
        throw new Error(`Page smoke failed for ${failedPage.path} with status ${failedPage.status}.`)
    }
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await cleanup()
        await pool.end()
    })
