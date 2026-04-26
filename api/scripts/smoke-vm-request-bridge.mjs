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

const runId = `vm_request_smoke_${Date.now()}`
const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const vmName = `vm-request-${Date.now()}`
const pool = new Pool({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
})

let token = ''

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

async function cleanup() {
    await pool.query('DELETE FROM vm_shutdown WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM vm_metrics WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM vm_details WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM vms WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
}

async function main() {
    await cleanup()

    const signup = await request('/user', {
        method: 'POST',
        body: JSON.stringify({ id: runId, name: 'VM Request Smoke', password }),
    })
    expect(signup.response.status === 201, 'Failed to create smoke user.', signup.body)

    const login = await request(`/auth/login/${runId}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    })
    expect(Boolean(login.body?.token), 'Failed to log in smoke user.', login.body)
    token = login.body.token

    await pool.query(`
        INSERT INTO vms (name, owner, created_by, access_users)
        VALUES ($1, $2, $2, $3::jsonb)
    `, [vmName, runId, JSON.stringify([runId])])

    await pool.query(`
        INSERT INTO vm_details (name, status, device_eth0_ipv4_address, last_checked)
        VALUES ($1, 'running', '10.55.0.8', NOW())
    `, [vmName])

    const target = await request(`/vm/${vmName}/agent-target`, {
        headers: authHeaders(),
    })
    expect(target.response.status === 200, 'Failed to fetch VM agent target.', target.body)
    expect(target.body?.endpoints?.request === `/api/vm/${encodeURIComponent(vmName)}/request`, 'Agent target is missing the request endpoint.', target.body)
    expect(target.body?.endpoints?.syncAuthorizedKeys === `/api/vm/${encodeURIComponent(vmName)}/agent-target/sync-access`, 'Agent target is missing the sync-access endpoint.', target.body)

    const guarded = await request(`/vm/${vmName}/request`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            method: 'POST',
            url: 'https://example.com/admin',
            headers: { 'content-type': 'application/json' },
            body: '{"hello":"world"}',
        }),
    })
    expect(guarded.response.status === 400, 'Disallowed VM request host should be rejected before proxying.', guarded.body)
    expect(Array.isArray(guarded.body?.allowedHosts), 'Guarded response should explain allowed hosts.', guarded.body)
    expect(guarded.body.allowedHosts.includes('127.0.0.1'), 'Guarded response should include loopback.', guarded.body)
    expect(guarded.body.allowedHosts.includes('10.55.0.8'), 'Guarded response should include the VM IPv4.', guarded.body)

    console.log(JSON.stringify({
        ok: true,
        vmName,
        requestEndpoint: target.body.endpoints.request,
        allowedHosts: guarded.body.allowedHosts,
        rejectedHost: 'example.com',
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
