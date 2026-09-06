import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
const temporary = mkdtempSync(join(tmpdir(), 'recovery-ui-'))
const entry = join(temporary, 'preview.tsx')
writeFileSync(entry, `import React from ${JSON.stringify(resolve('node_modules/react'))}; import { createRoot } from ${JSON.stringify(resolve('node_modules/react-dom/client'))}; import Panel, { RecoveryBanner } from ${JSON.stringify(resolve('src/components/system/resilience.tsx'))}; createRoot(document.getElementById('app')).render(React.createElement(React.Fragment, null, React.createElement(RecoveryBanner), React.createElement(Panel)));`)
const built = await Bun.build({ entrypoints: [entry], target: 'browser', define: { 'process.env.NODE_ENV': '"production"' } })
assert(built.success)
let state = { mode: 'normal', readOnly: false, services: [] }
const server = Bun.serve({ port: 0, fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/api/resilience') return Response.json(state)
    if (path === '/app.js') return new Response(built.outputs[0], { headers: { 'content-type': 'text/javascript' } })
    return new Response('<!doctype html><div id="app"></div><script type="module" src="/app.js"></script>', { headers: { 'content-type': 'text/html' } })
} })
const browser = await chromium.launch()
try {
    const page = await browser.newPage()
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
    console.log('Recovery UI passed normal, remote read-only, unavailable-status and failback states.')
} finally { await browser.close(); server.stop(true); rmSync(temporary, { recursive: true }) }
