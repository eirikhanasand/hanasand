import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
let output: string
let bundle: string
let css: string
const destination = { id: 'discord-1', name: 'Team Discord', kind: 'discord', endpointHint: 'discord.com/api/webhooks/…', status: 'active', lastTestStatus: null }
test.beforeAll(async () => {
    output = mkdtempSync(path.join(tmpdir(), 'delivery-test-'))
    execFileSync('bun', ['build', 'tests/fixtures/delivery-destinations.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
    const cssPath = path.resolve('src/app/globals.css')
    css = (await postcss([tailwind()]).process(readFileSync(cssPath, 'utf8'), { from: cssPath })).css
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.route('http://delivery.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://delivery.test/fixture.css', route => route.fulfill({ contentType: 'text/css', body: css }))
    await page.route('http://delivery.test/', route => route.fulfill({ contentType: 'text/html', body: '<html class="dark"><head><link rel="stylesheet" href="/fixture.css"></head><body><main class="p-4"><div id="root"></div></main><script src="/fixture.js"></script></body></html>' }))
})
test('adds persisted destinations, filters and sends a real example test', async ({ page }) => {
    const rows = [destination]
    const tests: unknown[] = []
    await page.route('**/api/organizations/org-test/webhooks**', async route => {
        const req = route.request()
        if (req.url().endsWith('/test')) {
            tests.push(req.postDataJSON())
            return route.fulfill({ json: { delivery: { status: 'delivered', responseStatus: 204 } } })
        }
        if (req.method() === 'POST') {
            expect(req.postDataJSON()).toEqual({ name: 'Operations', kind: 'discord', endpointUrl: 'https://discord.com/api/webhooks/123/test-token', status: 'active' })
            rows.push({ ...destination, id: 'discord-2', name: 'Operations' })
            return route.fulfill({ status: 201, json: { destination: rows[1] } })
        }
        return route.fulfill({ json: { destinations: rows, destinationAdminProof: { access: { canManage: true } } } })
    })
    await page.goto('http://delivery.test/')
    await expect(page.getByRole('heading', { name: 'Delivery', exact: true })).toBeVisible()
    await expect(page.getByText(/Watchlist to case|Public incident evidence|Route state|Live capture/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add destination', exact: true })).toBeEnabled()
    await page.screenshot({ path: '/tmp/hanasand-delivery-table.png' })
    await page.getByRole('button', { name: 'Add destination', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Operations')
    await page.getByLabel('Webhook URL').fill('https://discord.com/api/webhooks/123/test-token')
    await page.getByRole('button', { name: 'Save destination' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('rowheader', { name: 'Operations' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('rowheader', { name: 'Operations' })).toBeVisible()
    await page.getByLabel('Search destinations').fill('Operations')
    await expect(page.getByRole('rowheader', { name: 'Team Discord' })).toHaveCount(0)
    await page.getByLabel('Filter by type').selectOption('webhook')
    await expect(page.getByText('No destinations match these filters.')).toBeVisible()
    await page.getByLabel('Filter by type').selectOption('discord')
    await page.getByRole('button', { name: 'Test Operations', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Example message sent.')
    await page.getByRole('button', { name: 'Test Operations', exact: true }).click()
    await expect.poll(() => tests.length).toBe(2)
    expect(tests[0]).toEqual({ destinationId: 'discord-2', dryRun: false, live: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true)
})
test('read-only members cannot add or test destinations', async ({ page }) => {
    await page.route('**/api/organizations/org-test/webhooks', route => route.fulfill({ json: { destinations: [destination], destinationAdminProof: { access: { canManage: false } } } }))
    await page.goto('http://delivery.test/')
    await expect(page.getByRole('button', { name: 'Add destination', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Test Team Discord' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Edit Team Discord' })).toHaveCount(0)
})
test('load and delivery errors remain visible and never report a send', async ({ page }) => {
    let failedLoad = true
    await page.route('**/api/organizations/org-test/webhooks**', route => {
        if (route.request().method() === 'POST') return route.fulfill({ status: 502, json: { error: 'Receiver unavailable.' } })
        return failedLoad ? route.fulfill({ status: 503, json: { error: 'Destinations are temporarily unavailable.' } }) : route.fulfill({ json: { destinations: [destination], destinationAdminProof: { access: { canManage: true } } } })
    })
    await page.goto('http://delivery.test/')
    await expect(page.getByRole('alert')).toContainText('Destinations are temporarily unavailable.')
    await expect(page.getByText('No delivery destinations yet.')).toHaveCount(0)
    failedLoad = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await page.getByRole('button', { name: 'Test Team Discord' }).click()
    await expect(page.getByRole('alert')).toHaveText('Receiver unavailable.')
    await expect(page.getByText('Example message sent.')).toHaveCount(0)
})
test('rejects non-Discord URLs and returns focus after cancelling add', async ({ page }) => {
    await page.route('**/api/organizations/org-test/webhooks', route => route.fulfill({ json: { destinations: [], destinationAdminProof: { access: { canManage: true } } } }))
    await page.goto('http://delivery.test/')
    const add = page.getByRole('button', { name: 'Add destination', exact: true })
    await add.click()
    await page.getByLabel('Name', { exact: true }).fill('Invalid endpoint')
    await page.getByLabel('Webhook URL').fill('https://example.com/hook')
    await page.getByRole('button', { name: 'Save destination' }).click()
    await expect(page.getByRole('alert')).toHaveText('Enter a valid HTTPS Discord webhook URL.')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(add).toBeFocused()
})
