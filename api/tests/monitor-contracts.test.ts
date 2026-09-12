import { expect, mock, test } from 'bun:test'
import { normalizeEmail, usernameError } from '../src/utils/auth/accountIdentity.ts'

const results: Array<{ name: string, status: string }> = []
mock.module('../src/utils/db.ts', () => ({ default: async () => ({ rows: [{ configured_organizations: 1, runtime_organizations: 1 }] }) }))
mock.module('../src/utils/status/record.ts', () => ({ recordMonitorResult: async (_service: string, name: string, status: string) => { results.push({ name, status }) } }))
const { default: runMonitor } = await import('../src/utils/status/monitor.ts')

test('synthetic signup satisfies the identity contract and watchlist health tolerates a normal response', async () => {
    const originalFetch = globalThis.fetch, originalError = console.error
    let accountCreated = false
    globalThis.fetch = (async (input: string | URL | Request, options: RequestInit = {}) => {
        const path = new URL(String(input)).pathname
        if (path === '/api/user') {
            const body = JSON.parse(String(options.body))
            accountCreated = Boolean(normalizeEmail(body.email)) && !usernameError(body.id)
            return Response.json(accountCreated ? { token: 'fixture-token' } : {}, { status: accountCreated ? 201 : 400 })
        }
        if (path.includes('/auth/login/')) return Response.json({ token: 'fixture-token' }, { status: accountCreated ? 200 : 404 })
        if (path === '/api/user/self') return Response.json({}, { status: accountCreated ? 200 : 401 })
        if (path === '/v1/health') {
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(resolve, 400)
                options.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(options.signal?.reason) }, { once: true })
            })
            return Response.json({ ok: true, storage: { databaseAvailable: true, pendingWrites: 0 }, collection: {} })
        }
        return Response.json({ mode: 'scraper', sources: [], recentActivity: [] })
    }) as typeof fetch
    console.error = () => {}
    try {
        await runMonitor()
        for (const name of ['User creation', 'Login', 'Delete account', 'Watchlist processing']) expect(results.find(row => row.name === name)?.status).toBe('up')
    } finally { globalThis.fetch = originalFetch; console.error = originalError }
})
