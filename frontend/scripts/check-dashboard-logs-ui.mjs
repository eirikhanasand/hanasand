import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect } from '@playwright/test'

const expect = playwrightExpect.configure({ timeout: 30000 })
const outDir = process.argv.find(arg => arg.startsWith('--out-dir='))?.slice(10) || '/tmp/hanasand-logs-ui'
const base = 'http://127.0.0.1:3031'
const timestamp = new Date().toISOString()
const rows = [
    { id: 'proof-whoami', event_timestamp: timestamp, normalized: { timestamp, log_type: 'ProcessLogs', severity: 'high', level: 'info', service: 'audit', host: 'inspur', message: 'Process executed', process: { executable: '/usr/bin/whoami', command_line: 'whoami' }, rules_checked: 105, detections: [{ rule_id: 'recon.whoami', severity: 'high', summary: 'Identity reconnaissance' }] } },
    { id: 'proof-critical', event_timestamp: timestamp, normalized: { timestamp, log_type: 'ProcessLogs', severity: 'critical', level: 'info', service: 'audit', host: 'ovh', message: 'Synthetic detection evidence', process: { executable: '/usr/bin/curl', command_line: `curl https://example.invalid/BloodHound.zip?test=${'a'.repeat(180)}` }, rules_checked: 105, detections: [{ rule_id: 'tool.bloodhound', severity: 'critical', summary: 'BloodHound download' }] } },
]
const errors = { generated_at: timestamp, errors: [{ id: 'proof-error', created_at: timestamp, source: 'api', service: 'api', surface: 'api', method: 'GET', path: '/api/example', status_code: 500, error_code: 'EXAMPLE_FAILURE', message: 'Example request failed', request_id: 'proof-request', user_id: '', level: 'error' }], summary: { total: 1, last_hour: 1, server_errors: 1, client_errors: 0, status_counts: [], surface_counts: [{ surface: 'api', count: 1 }], code_counts: [{ error_code: 'EXAMPLE_FAILURE', count: 1 }], project_scans: 0, share_scans: 0 } }
// Real Next routes, styles and backend proxy; only the API is an isolated fixture.
const api = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url)
    if (url.pathname.includes('/auth/token/')) return Response.json({ roles: [{ id: 'system_admin' }, { id: 'admin' }] })
    if (url.pathname.includes('/user/')) return Response.json({ id: 'dashboard-render-proof-user', username: 'proof', name: 'Logs proof' })
    if (url.pathname === '/api/organizations') return Response.json({ organizations: [] })
    if (url.pathname === '/api/logs/services') return Response.json({ services: [{ service: 'audit', entries: 2, last_seen: timestamp }, { service: 'api', entries: 1, last_seen: timestamp }] })
    if (url.pathname === '/api/logs/errors') return Response.json(errors)
    if (url.pathname === '/api/logs/search') return Response.json({ rows, counts: [{ severity: 'low', count: 256 }, { severity: 'medium', count: 8 }, { severity: 'high', count: 1 }, { severity: 'critical', count: 1 }], services: [{ service: 'audit', count: 2 }, { service: 'api', count: 264 }], generated_at: new Date().toISOString(), processing: { updated_at: timestamp, catchup: { remaining: 3000, processed: 1000, total: 4000, rate: 50, estimated_seconds: 60, updated_at: new Date().toISOString() } }, limit: 200 })
    return Response.json({})
} })
const dev = Bun.spawn([process.execPath, '--bun', './node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', '3031'], {
    env: { ...process.env, FRONTEND_AUTH_API: `${api.url}api`, FRONTEND_INTERNAL_API: `${api.url}api`, TI_SCRAPER_API_BASE: String(api.url), NEXT_DIST_DIR: '.next-log-catchup-proof' },
    stdout: 'ignore', stderr: 'inherit',
})
const report = []
let browser
try {
    for (let attempt = 0; attempt < 120; attempt++) {
        if (dev.exitCode !== null) throw new Error('Logs proof frontend failed to start')
        if (await fetch(base).then(() => true).catch(() => false)) break
        await Bun.sleep(500)
    }
    await mkdir(outDir, { recursive: true })
    browser = await chromium.launch()
    for (const colorScheme of ['light', 'dark']) {
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            const context = await browser.newContext({ viewport, colorScheme, extraHTTPHeaders: { 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' }, permissions: ['clipboard-read', 'clipboard-write'] })
            await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: '["system_admin","admin"]', theme: colorScheme }).map(([name, value]) => ({ name, value, url: base })))
            const page = await context.newPage()
            const pageErrors = []
            page.on('pageerror', error => pageErrors.push(error.message))
            for (const [route, heading] of [['/logs', 'Logs'], ['/logs/realtime', 'Realtime'], ['/logs/search', 'Search logs'], ['/logs/errors', 'Errors']]) {
                const loaded = page.waitForResponse(response => response.url().includes(`/api/backend/logs/${route === '/logs/errors' ? 'errors' : 'search'}?`) && response.ok())
                await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' })
                await loaded
                await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
                if (route === '/logs') {
                    const progress = page.getByRole('region', { name: 'Historical log catch-up' })
                    await expect(progress).toContainText('3,000 logs remaining')
                    await expect(progress).toContainText('About 1 min remaining')
                    await expect(progress.getByRole('progressbar')).toHaveAttribute('aria-valuenow','25')

                    await expect(page.getByRole('region', { name: 'Events by severity' }).getByRole('link').first()).toContainText('256')
                    await page.getByText('Operational counters', { exact: true }).click()
                    await expect(page.getByText('Most active services in the selected time range')).toBeVisible()
                } else if (route === '/logs/errors') {
                    await page.getByRole('button', { name: 'EXAMPLE_FAILURE' }).click()
                    await expect(page.getByRole('button', { name: 'EXAMPLE_FAILURE' })).toHaveAttribute('aria-expanded', 'true')
                    await expect(page.getByText('Example request failed', { exact: false })).toBeVisible()
                    await page.getByRole('button', { name: 'Copy error JSON' }).click()
                    assert.equal(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).error_code, 'EXAMPLE_FAILURE')
                } else {
                    const event = page.locator('article').filter({ hasText: 'whoami' })
                    await event.getByRole('button', { expanded: false }).click()
                    await expect(event).toContainText('Mill checked 105 enabled rules.')
                    await event.getByRole('button', { name: 'Copy event JSON' }).click()
                    assert.equal(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).process.command_line, 'whoami')
                    if (route === '/logs/search') {
                        await page.getByRole('checkbox', { name: 'Advanced KQL' }).check()
                        await page.getByText('KQL syntax and tables', { exact: true }).click()
                    }
                }
                await expect(page.locator('[data-logs-dashboard]').getByRole('alert')).toHaveCount(0)
                const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth))
                assert(overflow <= 1, `${route} ${viewport.width} ${colorScheme} overflows by ${overflow}px`)
                const screenshot = `${outDir}/${route.replaceAll('/', '-').slice(1)}-${viewport.width}-${colorScheme}.png`
                await page.screenshot({ path: screenshot, fullPage: true })
                report.push({ route, viewport, colorScheme, screenshot, overflow })
            }
            assert.deepEqual(pageErrors, [], 'Logs routes must hydrate without browser errors')
            await context.close()
        }
    }
    await writeFile(`${outDir}/proof.json`, `${JSON.stringify({ passed: true, pages: report }, null, 2)}\n`)
    console.log(`Logs route proof passed: ${report.length} desktop/mobile light/dark views, inline details, clipboard, proxy, and no horizontal overflow. Screenshots: ${outDir}`)
} finally {
    await browser?.close()
    dev.kill()
    await dev.exited
    api.stop(true)
}
