import { expect, mock, test } from 'bun:test'

const results: Array<{ name: string, status: string }> = []
mock.module('../src/utils/db.ts', () => ({ default: async () => ({ rows: [{ configured_organizations: 1, runtime_organizations: 1 }] }) }))
mock.module('../src/utils/status/record.ts', () => ({ recordMonitorResult: async (_service: string, name: string, status: string) => { results.push({ name, status }) } }))
const { default: runMonitor } = await import('../src/utils/status/monitor.ts')

test('synthetic monitor checks the public articles page and accepts normal watchlist health', async () => {
    const originalFetch = globalThis.fetch, originalError = console.error
    const previousKey = process.env.MONITOR_SERVICE_ACCOUNT_KEY
    process.env.MONITOR_SERVICE_ACCOUNT_KEY = 'hsk_fixture'
    let accountMutations = 0
    let articlesPageCheck = false
    globalThis.fetch = (async (input: string | URL | Request, options: RequestInit = {}) => {
        const url = new URL(String(input))
        const path = url.pathname
        if (path === '/api/service-accounts/self') {
            expect(new Headers(options.headers).get('X-API-Key')).toBe('hsk_fixture')
            return Response.json({ id: 'svc_fixture' })
        }
        if (path === '/articles') {
            articlesPageCheck = true
            return new Response('<h1>Articles</h1><a href="/articles/example">Example</a>', { status: 200, headers: { 'Content-Type': 'text/html' } })
        }
        if (path === '/api/user' || path === '/api/user/self' || path.includes('/auth/login/')) accountMutations++
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
        for (const name of ['Service account authentication', 'Watchlist processing']) expect(results.find(row => row.name === name)?.status).toBe('up')
        expect(articlesPageCheck).toBe(true)
        expect(results.find(row => row.name === 'Articles')?.status).toBe('up')
        expect(accountMutations).toBe(0)
    } finally {
        if (previousKey === undefined) delete process.env.MONITOR_SERVICE_ACCOUNT_KEY
        else process.env.MONITOR_SERVICE_ACCOUNT_KEY = previousKey
        globalThis.fetch = originalFetch
        console.error = originalError
    }
})
