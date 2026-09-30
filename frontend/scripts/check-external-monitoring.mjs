import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'

const port = 3027
const base = `http://127.0.0.1:${port}`
let automation = null
let keyCount = 0
const api = createServer(async (request, response) => {
    const { pathname } = new URL(request.url, 'http://127.0.0.1')
    const json = (body, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)) }
    if (pathname === '/api/automations' && request.method === 'POST') {
        const chunks = []
        for await (const chunk of request) chunks.push(chunk)
        const body = JSON.parse(Buffer.concat(chunks).toString())
        assert.equal(body.monitoringType, 'push')
        assert.equal(body.targetUrl, 'home-1/basement/moisture')
        assert.equal(body.intervalMinutes, 1)
        assert.equal(body.timeoutSeconds, 180)
        automation = { ...body, id: 'local-sensor', lastStatus: null, runCount: 0, history: [], consecutiveFailures: 0 }
        return json({ automation }, 201)
    }
    if (pathname.endsWith('/sender-key')) {
        keyCount++
        return json({ secret: `local-mock-key-${keyCount}`, endpoint: '/api/automations/local-sensor/events' }, 201)
    }
    if (pathname === '/api/automations') return json({ automations: automation ? [automation] : [] })
    if (pathname === '/api/automations/local-sensor') return json({ automation, runs: [], issues: [], total: 0, nextPage: null })
    return json({})
})
api.listen(0, '127.0.0.1')
await once(api, 'listening')
const apiUrl = `http://127.0.0.1:${api.address().port}/api`
const dev = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', String(port)], {
    env: { ...process.env, FRONTEND_INTERNAL_API: apiUrl, NEXT_PUBLIC_API: apiUrl, FRONTEND_AUTH_API: apiUrl,
        NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'inherit', windowsHide: true,
})
let browser
try {
    for (let attempt = 0; attempt < 120; attempt++) {
        if (dev.exitCode !== null) throw new Error('Local frontend failed to start.')
        if (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) }).then(() => true).catch(() => false)) break
        await delay(500)
    }
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : existsSync(edge) ? { executablePath: edge } : {}) })
    const context = await browser.newContext({ extraHTTPHeaders: { 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' } })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: '[]' })
        .map(([name, value]) => ({ name, value, url: base })))
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/automation/health`, { timeout: 120_000 })
    await page.getByRole('button', { name: 'Create health check', exact: true }).click()
    await page.getByRole('combobox', { name: /^Type\b/ }).selectOption('push')
    await page.getByLabel('Name', { exact: true }).fill('Basement moisture')
    await page.getByLabel(/^Source ID/).fill('home-1/basement/moisture')
    await page.getByRole('textbox', { name: /^Description\b/ }).fill('Check for moisture in the basement.')
    assert.equal(await page.getByLabel('User agent', { exact: true }).count(), 0)
    assert.equal(await page.getByLabel('Retries before failure', { exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Create automation', exact: true }).click()
    await page.getByText('Awaiting reading', { exact: true }).first().waitFor()
    const sender = page.getByRole('region', { name: 'External sender' })
    await sender.getByRole('button', { name: 'Create or replace sender key' }).click()
    await sender.getByLabel('Sender key', { exact: true }).waitFor()
    assert.equal(await sender.getByLabel('Sender key', { exact: true }).inputValue(), 'local-mock-key-1')
    assert.equal(await sender.getByLabel('Event API path', { exact: true }).inputValue(), '/api/automations/local-sensor/events')
    await sender.getByRole('button', { name: 'Create or replace sender key' }).click()
    await page.waitForFunction(() => Array.from(document.querySelectorAll('input')).some(input => input.value === 'local-mock-key-2'))
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    assert.equal(await page.getByLabel('Source ID', { exact: true }).getAttribute('readonly'), '')
    assert.equal(await page.getByRole('combobox', { name: /^Type\b/ }).isDisabled(), true)
    assert.deepEqual(errors, [])
    console.log('External monitoring UI passed: source setup, awaiting-reading state, sender key creation and replacement, and fixed source identity.')
} finally {
    if (browser) await browser.close()
    if (dev.exitCode === null) {
        dev.kill()
        await once(dev, 'exit')
    }
    api.close()
}
