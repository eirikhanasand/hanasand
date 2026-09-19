import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'host-updates-'))
    execFileSync('bun', ['build', 'tests/fixtures/host-updates.tsx', '--target=browser', '--define', 'process.env.NODE_ENV="production"', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))

test('host switch and refresh isolate data; scheduled waits are informational and failures stay visible', async ({ page }) => {
    page.on('pageerror', error => { throw error })
    const requests: string[] = []
    let failOvh = false
    let security = false
    await page.route('https://updates.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('https://updates.test/', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>' }))
    await page.route('**/api/backend/system/updates?**', route => {
        const host = new URL(route.request().url()).searchParams.get('host')!
        requests.push(host)
        if (host === 'ovhcloud' && failOvh) return route.fulfill({ status: 503, json: { error: 'OVH unavailable' } })
        return route.fulfill({ json: { status: { status: 'pending', checked_at: new Date().toISOString(), pending_updates: [{ package: `${host}-package`, version: '1', first_seen: Date.now() / 1000 - 6 * 3600, security }], policy: { non_security_delay_hours: 72 } }, history: [{ run_id: host, status: 'pending', occurred_at: new Date().toISOString(), packages: [`${host}-history`], error: null }] } })
    })
    await page.goto('https://updates.test/')
    await expect(page.getByText('inspur-package', { exact: true })).toBeVisible()
    await expect(page.getByText('6/72 hours · Scheduled wait')).toBeVisible()
    await expect(page.getByText('6/72 hours · Scheduled wait').locator('xpath=ancestor::td')).toHaveClass(/text-ui-muted/)
    await expect(page.locator('.text-ui-warning, .text-ui-danger')).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Host' }).selectOption('ovhcloud')
    await expect(page.getByText('ovhcloud-package', { exact: true })).toBeVisible()
    await expect(page.getByText('Installed: ovhcloud-history')).toBeVisible()
    await expect(page.getByText('inspur-package', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeEnabled()
    expect(requests).toEqual(['inspur', 'ovhcloud', 'ovhcloud'])
    failOvh = true
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(page.getByText('OVH unavailable')).toBeVisible()
    await expect(page.getByText('ovhcloud-package', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Pending packages' })).toHaveCount(0)
    security = true
    await page.getByRole('combobox', { name: 'Host' }).selectOption('inspur')
    await expect(page.getByText('Ready', { exact: true })).toBeVisible()
    await expect(page.getByText('Security Updates', { exact: true }).locator('xpath=../..')).toHaveClass(/text-ui-danger/)
})

test('a slow previous host cannot overwrite the selected host', async ({ page }) => {
    let release: () => void = () => {}
    const wait = new Promise<void>(resolve => { release = resolve })
    await page.route('https://updates.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('https://updates.test/', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>' }))
    await page.route('**/api/backend/system/updates?**', async route => {
        const host = new URL(route.request().url()).searchParams.get('host')!
        if (host === 'inspur') await wait
        await route.fulfill({ json: { status: { status: 'ok', last_updated_packages: [host] }, history: [] } }).catch(() => {})
    })
    await page.goto('https://updates.test/')
    await page.getByRole('combobox', { name: 'Host' }).selectOption('ovhcloud')
    await expect(page.getByText('ovhcloud', { exact: true })).toBeVisible()
    release()
    await expect(page.getByText('inspur', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: 'Host' })).toHaveValue('ovhcloud')
})

test('empty updates use the compact controls and omit the empty package panel', async ({ page }) => {
    await page.route('https://updates.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('https://updates.test/', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>' }))
    await page.route('**/api/backend/system/updates?**', route => route.fulfill({ json: { status: { status: 'ok', checked_at: new Date(Date.now() - 5 * 3600000).toISOString(), pending_updates: [] }, history: [] } }))
    await page.goto('https://updates.test/')
    const controls = page.getByRole('combobox', { name: 'Host' }).locator('..')
    await expect(controls.getByText('Healthy', { exact: true })).toBeVisible()
    await expect(controls.getByText('Security Updates', { exact: true })).toBeVisible()
    await expect(controls.getByText('Nothing pending', { exact: true })).toBeVisible()
    await expect(controls.getByText(/Checked 5h/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pending packages' })).toHaveCount(0)
})
