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
        return route.fulfill({ json: { status: { status: 'pending', checked_at: new Date().toISOString(), pending_updates: [{ package: `${host}-package`, version: '1', first_seen: Date.now() / 1000 - 6 * 3600, security }], policy: { non_security_delay_hours: 72 } }, history: [{ run_id: host, status: 'pending', occurred_at: new Date().toISOString(), packages: [`${host}-history v3.1`], error: null }] } })
    })
    await page.goto('https://updates.test/')
    await expect(page.getByText('inspur-package', { exact: true })).toBeVisible()
    await expect(page.getByText('Updates', { exact: true }).locator('xpath=../..')).toHaveText('Updates1 pending')
    await expect(page.getByText('State', { exact: true })).toHaveCount(0)
    await expect(page.getByText('6/72 hours')).toBeVisible()
    await expect(page.getByText('6/72 hours').locator('xpath=ancestor::td')).toHaveClass(/text-ui-muted/)
    await expect(page.locator('.text-ui-warning, .text-ui-danger')).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Host' }).selectOption('ovhcloud')
    await expect(page.getByText('ovhcloud-package', { exact: true })).toBeVisible()
    await expect(page.getByText('ovhcloud-history v3.1')).toBeVisible()
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
    await expect(page.getByText('Updates', { exact: true }).locator('xpath=../..')).toHaveClass(/text-ui-success/)
    await expect(page.getByText('Security Updates', { exact: true })).toBeVisible()
    await expect(page.getByText('Nothing pending', { exact: true })).toBeVisible()
    await expect(page.getByText(/Checked 5h/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pending packages' })).toHaveCount(0)
})

test('merged update summary keeps failed and unreported host states visible', async ({ page }) => {
    let status = 'failed'
    await page.route('https://updates.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('https://updates.test/', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>' }))
    await page.route('**/api/backend/system/updates?**', route => route.fulfill({ json: { status: { status, pending_updates: [] }, history: [] } }))
    await page.goto('https://updates.test/')
    const summary = page.getByText('Updates', { exact: true }).locator('xpath=../..')
    await expect(summary).toHaveText('UpdatesUpdate failed')
    await expect(summary).toHaveClass(/text-ui-danger/)
    await expect(page.getByText('Nothing pending', { exact: true })).toHaveCount(0)
    status = 'unknown'
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(summary).toHaveText('UpdatesWaiting for host check-in')
    await expect(page.getByText('Nothing pending', { exact: true })).toHaveCount(0)
})

test('daily history shows package versions without hiding installation details behind errors', async ({ page }) => {
    await page.route('https://updates.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('https://updates.test/', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>' }))
    await page.route('**/api/backend/system/updates?**', route => route.fulfill({ json: { status: { status: 'ok' }, history: [
        { run_id: '2026-09-17', occurred_at: '2026-09-17', status: 'failed', packages: ['libsqlite3-0 v3.45.1', 'libaom3 v3.8.2'], error: 'A security update failed' },
    ] } }))
    await page.goto('https://updates.test/')
    await expect(page.getByText('libsqlite3-0 v3.45.1, libaom3 v3.8.2', { exact: true })).toBeVisible()
    await expect(page.getByText('A security update failed', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update status details' })).toHaveCount(1)
    await expect(page.getByText(/^Installed:/)).toHaveCount(0)
})


test('Today shows the packages installed so far or an empty-day message', async ({ page }) => {
    let installed = false
    let fail = false
    await page.route('https://updates.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('https://updates.test/', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>' }))
    await page.route('**/api/backend/system/updates?**', route => fail ? route.fulfill({ status: 503, json: { error: 'Host unavailable' } }) : route.fulfill({ json: { status: { status: 'ok' }, history: [
        { run_id: '2026-09-20', occurred_at: '2026-09-20', is_today: true, status: installed ? 'ok' : 'unknown', packages: installed ? ['libsqlite3-0 v3.45.1', 'libaom3 v3.8.2'] : [], error: null },
        { run_id: '2026-09-19', occurred_at: '2026-09-19', is_today: false, status: 'ok', packages: [], error: null },
    ] } }))
    await page.goto('https://updates.test/')
    await expect(page.getByText('Today', { exact: true })).toBeVisible()
    await expect(page.getByText('Nothing installed yet', { exact: true })).toBeVisible()
    await expect(page.getByText('No packages installed.', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Not reported', { exact: true })).toBeVisible()
    installed = true
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(page.getByText('Today', { exact: true })).toHaveCount(1)
    await expect(page.getByText('libsqlite3-0 v3.45.1, libaom3 v3.8.2', { exact: true })).toBeVisible()
    await expect(page.getByText('Nothing installed yet', { exact: true })).toHaveCount(0)
    fail = true
    await page.getByRole('button', { name: 'Refresh' }).click()
    await expect(page.getByText('Host unavailable', { exact: true })).toBeVisible()
    await expect(page.getByText('Nothing installed yet', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Today', { exact: true })).toHaveCount(0)
})
