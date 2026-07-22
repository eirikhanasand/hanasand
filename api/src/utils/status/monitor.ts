import run from '#db'
import crypto from 'crypto'

const apiBase = process.env.MONITOR_API_BASE || `http://127.0.0.1:${Number(process.env.PORT) || 8081}/api`
const publicApiBase = (process.env.MONITOR_PUBLIC_API_BASE || 'https://api.hanasand.com/api/v1').replace(/\/$/, '')
const webBase = (process.env.MONITOR_WEB_BASE || 'https://hanasand.com').replace(/\/$/, '')

async function record(service: string, checkName: string, status: 'up' | 'degraded' | 'down', latency: number, message = '') {
    await run(`
        INSERT INTO service_monitor_results (service, check_name, status, latency_ms, message)
        VALUES ($1, $2, $3, $4, $5)
    `, [service, checkName, status, latency, message])
}

async function check(service: string, checkName: string, fn: () => Promise<void | string>) {
    const started = performance.now()
    try {
        const message = await fn()
        await record(service, checkName, 'up', Math.round(performance.now() - started), message || '')
    } catch (error) {
        await record(service, checkName, 'down', Math.round(performance.now() - started), error instanceof Error ? error.message : String(error))
    }
}

async function fetchJson(path: string, options: RequestInit = {}, base = apiBase) {
    const response = await fetch(`${base}${path}`, {
        ...options,
        signal: options.signal || AbortSignal.timeout(15_000),
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
        },
    })

    const text = await response.text()
    let body: unknown
    try {
        body = text ? JSON.parse(text) : null
    } catch {
        body = text
    }
    return { response, body }
}

async function fetchPage(path: string, headers: Record<string, string> = {}) {
    const response = await fetch(`${webBase}${path}`, {
        headers,
        signal: AbortSignal.timeout(15_000),
    })
    return { response, body: await response.text() }
}

function object(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
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

    await Promise.all([
        check('core', 'API health', async () => {
            const { response, body } = await fetchJson('/openapi.json', {}, publicApiBase)
            const contract = object(body)
            if (response.status !== 200 || typeof contract?.openapi !== 'string' || !object(contract.paths)) {
                throw new Error(`Unexpected public API contract response ${response.status}`)
            }
            return 'The public API contract endpoint responded successfully.'
        }),
        check('website', 'Public website', async () => {
            const { response, body } = await fetchPage('/')
            if (response.status !== 200 || !body.toLowerCase().includes('hanasand')) throw new Error(`Unexpected website response ${response.status}`)
            return 'The public website rendered successfully.'
        }),
        check('threat-intelligence', 'Public search', async () => {
            const { response, body } = await fetchJson('/ti/search', {
                method: 'POST',
                body: JSON.stringify({ query: 'APT29' }),
            }, publicApiBase)
            const result = object(body)
            if (response.status !== 200 || result?.mode !== 'scraper' || !Array.isArray(result.sources) || !Array.isArray(result.recentActivity)) {
                throw new Error(`Threat intelligence search is unavailable (${response.status})`)
            }
            return 'A canonical threat-intelligence search completed successfully.'
        }),
        check('browser-sandbox', 'Browser workspace', async () => {
            const { response, body } = await fetchPage('/browser')
            if (response.status !== 200 || !body.includes('Browser')) throw new Error(`Unexpected browser workspace response ${response.status}`)
            return 'The browser investigation workspace rendered successfully.'
        }),
        check('dark-web-monitoring', 'Monitoring workspace', async () => {
            const { response, body } = await fetchPage('/dashboard/dwm', {
                Cookie: `id=${encodeURIComponent(runId)}; access_token=${encodeURIComponent(token)}`,
            })
            if (response.status !== 200 || !body.includes('Dark web monitoring')) throw new Error(`Unexpected monitoring workspace response ${response.status}`)
            return 'The authenticated dark-web monitoring workspace rendered successfully.'
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

    await run('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await run('DELETE FROM login_events WHERE user_id = $1', [runId]).catch(() => {})
    await run('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
}
