import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const base = 'http://127.0.0.1:3018'
let mode = 'data'
const requests = []
const runs = Array.from({ length: 125 }, (_, index) => ({ id: `run-${index}`, automationId: 'monitor', status: 'completed', warning: false, result: `Check ${index}`, startedAt: new Date(Date.UTC(2026, 0, 1, 12) - index * 60000).toISOString() }))
const automation = { id: 'monitor', name: 'Server rendered monitor', prompt: 'Availability check', status: 'active', actionType: 'agent_prompt', targetUrl: 'https://example.com', monitoringType: 'fetch', intervalMinutes: 1, lastStatus: 'completed', runCount: 125, uptime: 99.2, timezone: 'UTC', notificationDestinations: [], history: [{ id: 'recent', started_at: runs[0].startedAt, status: 'completed', warning: false }] }
const api = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/automations')) return Response.json({})
    assert.equal(request.headers.get('id'), 'dashboard-render-proof-user')
    assert.equal(request.headers.get('authorization'), 'Bearer local-dashboard-render-proof-token')
    assert.equal(request.headers.get('x-impersonation-token'), 'test-impersonation')
    requests.push(url.pathname)
    if (mode === 'error') return Response.json({ error: 'Unavailable' }, { status: 503 })
    if (url.pathname.endsWith('/automations')) return Response.json({ automations: mode === 'empty' ? [] : [automation] })
    const offset = Number(url.searchParams.get('cursor') || 0)
    const filtered = url.searchParams.has('from') ? runs.slice(0, 2) : runs
    return Response.json({ automation, runs: filtered.slice(offset, offset + 50), total: filtered.length, nextCursor: offset + 50 < filtered.length ? String(offset + 50) : null })
} })
const dev = Bun.spawn(['bun', '--bun', 'next', 'dev', '--webpack', '-p', '3018'], { env: { ...process.env, FRONTEND_INTERNAL_API: `${api.url}api`, NEXT_DIST_DIR: '.next/automation-ssr' }, stdout: 'ignore', stderr: 'inherit' })
let browser
try {
    for (let attempt = 0; attempt < 120; attempt++) {
        if (dev.exitCode !== null) throw new Error('Test frontend failed to start')
        if (await fetch(base).then(() => true).catch(() => false)) break
        await Bun.sleep(500)
    }
    browser = await chromium.launch({ headless: true })
    async function context(javaScriptEnabled, compact = false) {
        const context = await browser.newContext({ javaScriptEnabled: true, timezoneId: 'America/Los_Angeles', extraHTTPHeaders: { 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' } })
        // Allow inline server-stream delivery, but block all application/hydration code.
        if (!javaScriptEnabled) await context.route('**/_next/static/**/*.js', route => route.abort())
        await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: '["system_admin"]', impersonation_token: 'test-impersonation', dashboard_view_mode: compact ? 'compact' : 'normal', dashboard_navigation: encodeURIComponent(JSON.stringify({ id: 'dashboard-render-proof-user', expanded: { Automation: true, Settings: true, Pinned: true }, pinned: ['/automation/health'] })) }).map(([name, value]) => ({ name, value, url: base })))
        return context
    }
    const noJS = await context(false)
    const page = await noJS.newPage()
    for (const route of ['/dashboard/automation', '/automation/monitoring', '/automation/health']) {
        await page.goto(base + route)
        await page.getByRole('heading', { name: 'Your automations' }).waitFor()
        assert(await page.getByRole('heading', { name: 'Your automations' }).isVisible(), 'Jobs must exist before hydration')
        assert(await page.getByText('Check 0', { exact: true }).isVisible(), 'Recent checks must exist before hydration')
        assert(await page.getByText('(50/125)').isVisible())
        assert.equal(await page.getByRole('button', { name: 'Automation', exact: true }).getAttribute('aria-expanded'), 'true')
        assert.equal(await page.getByRole('button', { name: 'Settings', exact: true }).getAttribute('aria-expanded'), 'true')
        assert.equal(await page.getByRole('button', { name: 'Pinned', exact: true }).getAttribute('aria-expanded'), 'true')
    }
    mode = 'empty'
    await page.reload()
    assert(await page.getByRole('heading', { name: 'Create automation', exact: true }).isVisible())
    mode = 'error'
    await page.reload()
    assert(await page.getByText('Unable to load automations. Please try again.', { exact: true }).isVisible())
    assert.equal(await page.getByRole('heading', { name: 'Create automation', exact: true }).count(), 0)
    mode = 'data'
    const compact = await context(false, true)
    const compactPage = await compact.newPage()
    await compactPage.goto(base + '/automation')
    assert.equal(await compactPage.getByRole('button', { name: 'Expand sidebar', exact: true }).count(), 2)
    const live = await context(true)
    const hydrated = await live.newPage()
    const errors = []
    hydrated.on('pageerror', error => errors.push(error.message))
    hydrated.on('console', message => { if (message.type() === 'error' && /hydration|didn't match/i.test(message.text())) errors.push(message.text()) })
    await hydrated.goto(base + '/automation')
    await hydrated.getByRole('button', { name: 'Filter checks by time' }).click()
    assert(await hydrated.getByText('(50/125)').isVisible())
    await hydrated.getByLabel('From', { exact: true }).fill('2026-01-01T03:59')
    await hydrated.getByText('(2/2)').waitFor()
    await hydrated.getByLabel('From', { exact: true }).fill('')
    await hydrated.getByText('(50/125)').waitFor()
    await hydrated.getByRole('button', { name: 'Load more checks' }).scrollIntoViewIfNeeded()
    await hydrated.getByText('(100/125)').waitFor()
    await hydrated.getByRole('button', { name: 'Load more checks' }).scrollIntoViewIfNeeded()
    await hydrated.getByText('(125/125)').waitFor()
    await hydrated.getByRole('button', { name: 'Refresh checks' }).click()
    assert(await hydrated.getByText('(125/125)').isVisible())
    const sidebar = hydrated.getByRole('complementary', { name: 'Dashboard sidebar' })
    await sidebar.getByRole('button', { name: 'Settings', exact: true }).click()
    const saved = await live.cookies()
    await noJS.addCookies(saved)
    await page.reload()
    assert.equal(await page.getByRole('button', { name: 'Settings', exact: true }).getAttribute('aria-expanded'), 'false')
    assert.deepEqual(errors, [])
    console.log('Automation SSR passed: jobs, history, empty/error states, all three routes, sidebar cookies, compact mode, hydration across timezones, filters, and pagination.')
} finally {
    await browser?.close()
    dev.kill()
    await dev.exited
    api.stop(true)
}
