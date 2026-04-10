import pg from 'pg'
import crypto from 'crypto'

const apiBase = process.env.API_BASE || 'http://127.0.0.1:8080/api'
const dbHost = process.env.DB_HOST || '127.0.0.1'
const dbPort = Number(process.env.DB_PORT || 5432)
const dbName = process.env.DB || 'hanasand'
const dbUser = process.env.DB_USER || 'hanasand'
const dbPassword = process.env.DB_PASSWORD
const runId = `monitor_${Date.now()}`
const password = process.env.MONITOR_PASSWORD || `Mm22!!${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}Aa`
const { Pool } = pg

if (!dbPassword) {
    console.error('DB_PASSWORD is required.')
    process.exit(1)
}

const pool = new Pool({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
})

async function request(path, options = {}) {
    const started = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Number(process.env.MONITOR_TIMEOUT_MS || 5000))
    try {
        const response = await fetch(`${apiBase}${path}`, {
            ...options,
            headers: {
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers || {}),
            },
            signal: controller.signal,
        })
        const text = await response.text()
        let body = text
        try {
            body = text ? JSON.parse(text) : null
        } catch {
            body = text
        }
        return { response, body, latency: Math.round(performance.now() - started) }
    } finally {
        clearTimeout(timeout)
    }
}

async function record(service, checkName, status, latency, message = '') {
    await pool.query(`
        INSERT INTO service_monitor_results (service, check_name, status, latency_ms, message)
        VALUES ($1, $2, $3, $4, $5)
    `, [service, checkName, status, latency, message])
}

async function runCheck(service, checkName, fn) {
    const started = performance.now()
    try {
        const latency = await fn()
        await record(service, checkName, 'up', latency ?? Math.round(performance.now() - started))
    } catch (error) {
        await record(service, checkName, 'down', Math.round(performance.now() - started), error instanceof Error ? error.message : String(error))
    }
}

async function cleanup(token = '') {
    await fetch(`${apiBase}/user/self`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}`, id: runId } : {},
        body: JSON.stringify({ id: runId }),
    }).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM login_events WHERE user_id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
}

async function main() {
    let token = ''
    await cleanup()

    await runCheck('auth', 'User creation', async () => {
        const { response, body, latency } = await request('/user', {
            method: 'POST',
            body: JSON.stringify({ id: runId, name: 'Monitor User', password }),
        })
        if (response.status !== 201 || !body?.token) {
            throw new Error(`Unexpected signup response ${response.status}`)
        }
        token = body.token
        return latency
    })

    await runCheck('auth', 'Login', async () => {
        const { response, body, latency } = await request(`/auth/login/${runId}`, {
            method: 'POST',
            body: JSON.stringify({ password }),
        })
        if (response.status !== 200 || !body?.token) {
            throw new Error(`Unexpected login response ${response.status}`)
        }
        token = body.token
        return latency
    })

    await runCheck('auth', 'Delete account', async () => {
        const { response, latency } = await request('/user/self', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}`, id: runId },
            body: JSON.stringify({ id: runId }),
        })
        if (response.status !== 200) {
            throw new Error(`Unexpected delete response ${response.status}`)
        }
        return latency
    })

    const publicChecks = [
        ['core', 'API index', '/'],
        ['content', 'Articles', '/articles'],
        ['content', 'Thoughts', '/thoughts'],
        ['security', 'Password check', '/pwned', { method: 'POST', body: JSON.stringify({ password }) }],
    ]

    for (const [service, checkName, path, options] of publicChecks) {
        await runCheck(service, checkName, async () => {
            const { response, latency } = await request(path, options || {})
            if (response.status >= 500) {
                throw new Error(`Unexpected response ${response.status}`)
            }
            return latency
        })
    }

    await cleanup(token)
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await pool.end()
    })
