import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { chromium } from '@playwright/test'
const temporary = mkdtempSync(join(tmpdir(), 'recovery-ui-'))
const entry = join(temporary, 'preview.tsx')
writeFileSync(entry, `import React from ${JSON.stringify(resolve('node_modules/react'))}; import { createRoot } from ${JSON.stringify(resolve('node_modules/react-dom/client'))}; import SystemDashboard from ${JSON.stringify(resolve('src/app/dashboard/system/clientPage.tsx'))}; import Panel, { RecoveryBanner } from ${JSON.stringify(resolve('src/components/system/resilience.tsx'))}; createRoot(document.getElementById('app')).render(React.createElement(React.Fragment, null, React.createElement(RecoveryBanner), React.createElement(Panel), React.createElement(SystemDashboard, { id: 'fixture', token: 'fixture', systemTelemetry: null, dockerTelemetry: [], vms: [{ name: 'vm-' + 'c'.repeat(128), owner: 'owner-' + 'd'.repeat(128), status: 'running' }], vmMetrics: [] })));`)
const built = await Bun.build({ entrypoints: [entry], target: 'browser', plugins: [{ name: 'fixture-router', setup(build) { build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'router', namespace: 'fixture' })); build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useRouter = () => ({ push() {}, refresh() {} });', loader: 'js' })) } }], define: { 'process.env': '{"NODE_ENV":"production"}' } })
assert(built.success)
const css = (await postcss([tailwind()]).process(await Bun.file('src/app/globals.css').text(), { from: 'src/app/globals.css' })).css
let state = { mode: 'normal', readOnly: false, services: [] }
const server = Bun.serve({ port: 0, fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/api/resilience') return Response.json(state)
    if (path === '/app.js') return new Response(built.outputs[0], { headers: { 'content-type': 'text/javascript' } })
    return new Response(`<!doctype html><html class="light"><style>${css}</style><div class="grid w-full gap-4 p-2 sm:p-4 min-w-0 grid-cols-[minmax(0,1fr)] max-xl:[overflow-wrap:anywhere] max-xl:[&_*]:min-w-0" id="app"></div><script type="module" src="/app.js"></script></html>`, { headers: { 'content-type': 'text/html' } })
} })
const browser = await chromium.launch()
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.on('pageerror', error => console.error(error.message))
    await page.goto(server.url.href)
    await page.getByText('Preferred services are available.', { exact: true }).waitFor()
    state = { mode: 'read_only_recovery', readOnly: true, services: [{ id: 'api', name: 'API', activeInstance: 'ovh-api', activeSite: 'ovhcloud', activeEndpoint: 'ovhcloud:19080', status: 'failed_over', instances: [{ id: 'inspur-api-1', site: 'inspur', healthy: false }, { id: 'inspur-api-2', site: 'inspur', healthy: false }, { id: 'ovh-api', site: 'ovhcloud', healthy: true }] }] }
    await page.reload()
    await page.getByText('Database recovery is read-only. Changes are paused.', { exact: true }).waitFor()
    await page.getByRole('cell', { name: 'ovh-api', exact: true }).waitFor()
    assert((await page.locator('body').innerText()).includes('Changes and new processing are paused.'))
    state = { mode: 'unknown', readOnly: true, services: [] }
    await page.reload()
    await page.getByText('Status is reconnecting; availability has not been verified.', { exact: true }).waitFor()
    state = { mode: 'normal', readOnly: false, services: [] }
    await page.reload()
    await page.getByText('Preferred services are available.', { exact: true }).waitFor()
    assert.equal(await page.getByText('Database recovery is read-only. Changes are paused.', { exact: true }).count(), 0)
    const longId = 'instance-' + 'a'.repeat(128)
    state = { mode: 'normal', readOnly: false, updatedAt: '2026-09-17T00:03:50.118914+00:00', services: ['Frontend', 'API', 'Authentication', 'Threat intelligence queries', 'Database'].map((name, index) => ({ id: String(index), name, activeInstance: longId, activeEndpoint: 'https://' + 'b'.repeat(128) + '.example.test:8080', status: 'healthy', instances: [{ id: longId, site: 'inspur', healthy: true }, { id: 'ovh-alternate', site: 'ovhcloud', healthy: false }] })), sites: { inspur: { fresh: true }, ovhcloud: { fresh: true } }, database: { status: 'up', replica: true, replayAt: '2026-09-17T00:03:50.118914+00:00' }, backups: { status: 'backup_failed', verifiedAt: '2026-09-13T02:29:31.106847+00:00' }, dns: { [longId + '.example.test']: { activeSite: 'inspur' } }, notifications: [{ title: longId, status: 'pending' }] }
    await page.reload()
    await page.getByText('Preferred services are available.', { exact: true }).waitFor()
    for (const width of [320, 375, 390, 540, 640, 768, 820, 1024, 1279, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 })
        assert.equal(await page.locator('[data-resilience-cards]').isVisible(), width < 1280)
        assert.equal(await page.locator('[data-resilience-table]').isVisible(), width >= 1280)
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}px`)
        if (width < 1280) assert(await page.locator('[data-resilience-cards] article').evaluateAll(elements => elements.every(el => el.scrollWidth <= el.clientWidth)), `Card overflow at ${width}px`)
    }
    if (process.env.SYSTEM_LAYOUT_SCREENSHOT) {
        state.services = state.services.map(service => ({ ...service, activeInstance: 'inspur-' + service.id + '-1', activeEndpoint: 'inspur:8082', instances: [{ id: 'inspur-' + service.id + '-1', healthy: true }, { id: 'ovh-alternate', healthy: false }] }))
        await page.setViewportSize({ width: 390, height: 844 })
        await page.reload()
        await page.getByText('Preferred services are available.', { exact: true }).waitFor()
        await page.screenshot({ path: process.env.SYSTEM_LAYOUT_SCREENSHOT, fullPage: true })
    }
    console.log('Responsive layouts passed 320–1920px, including long IDs and endpoints.')
    console.log('Recovery UI passed normal, remote read-only, unavailable-status and failback states.')
} finally { await browser.close(); server.stop(true); rmSync(temporary, { recursive: true }) }
