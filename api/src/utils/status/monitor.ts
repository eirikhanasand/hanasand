import run from '#db'
import crypto from 'crypto'

const apiBase = process.env.MONITOR_API_BASE || `http://127.0.0.1:${Number(process.env.PORT) || 8081}/api`

async function record(service: string, checkName: string, status: 'up' | 'degraded' | 'down', latency: number, message = '') {
    await run(`
        INSERT INTO service_monitor_results (service, check_name, status, latency_ms, message)
        VALUES ($1, $2, $3, $4, $5)
    `, [service, checkName, status, latency, message])
}

async function check(service: string, checkName: string, fn: () => Promise<void>) {
    const started = performance.now()
    try {
        await fn()
        await record(service, checkName, 'up', Math.round(performance.now() - started))
    } catch (error) {
        await record(service, checkName, 'down', Math.round(performance.now() - started), error instanceof Error ? error.message : String(error))
    }
}

async function fetchJson(path: string, options: RequestInit = {}) {
    const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
        },
    })

    const text = await response.text()
    let body: unknown = text
    try {
        body = text ? JSON.parse(text) : null
    } catch {
        body = text
    }
    return { response, body }
}

function hasToken(body: unknown): body is { token: string } {
    return Boolean(body && typeof body === 'object' && 'token' in body && typeof (body as { token?: unknown }).token === 'string')
}

export default async function runSyntheticMonitor() {
    const runId = `monitor_${Date.now()}`
    const password = `Mm22!!${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}Aa`
    let token = ''

    await check('auth', 'User creation', async () => {
        const { response, body } = await fetchJson('/user', {
            method: 'POST',
            body: JSON.stringify({ id: runId, name: 'Monitor User', password }),
        })
        if (response.status !== 201 || !hasToken(body)) {
            throw new Error(`Unexpected signup response ${response.status}`)
        }
        token = body.token
    })

    await check('auth', 'Login', async () => {
        const { response, body } = await fetchJson(`/auth/login/${runId}`, {
            method: 'POST',
            body: JSON.stringify({ password }),
        })
        if (response.status !== 200 || !hasToken(body)) {
            throw new Error(`Unexpected login response ${response.status}`)
        }
        token = body.token
    })

    await check('auth', 'Delete account', async () => {
        const { response } = await fetchJson('/user/self', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}`, id: runId },
            body: JSON.stringify({ id: runId }),
        })
        if (response.status !== 200) {
            throw new Error(`Unexpected delete response ${response.status}`)
        }
    })

    await Promise.all([
        check('core', 'API index', async () => {
            const { response } = await fetchJson('/')
            if (response.status >= 500) throw new Error(`Unexpected index response ${response.status}`)
        }),
        check('content', 'Articles', async () => {
            const { response } = await fetchJson('/articles')
            if (response.status >= 500) throw new Error(`Unexpected articles response ${response.status}`)
        }),
        check('content', 'Thoughts', async () => {
            const { response } = await fetchJson('/thoughts')
            if (response.status >= 500) throw new Error(`Unexpected thoughts response ${response.status}`)
        }),
        check('security', 'Password check', async () => {
            const { response } = await fetchJson('/pwned', {
                method: 'POST',
                body: JSON.stringify({ password }),
            })
            if (response.status >= 500) throw new Error(`Unexpected pwned response ${response.status}`)
        }),
    ])

    await run('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await run('DELETE FROM login_events WHERE user_id = $1', [runId]).catch(() => {})
    await run('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
}
