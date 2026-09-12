import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'vm-refresh-'))
    execFileSync('bun', ['build', 'tests/fixtures/vm-refresh.tsx', '--target=browser', '--define', 'process.env.NODE_ENV="production"', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test('refresh updates every card and timestamp; failed refresh retains the snapshot and offers retry', async ({ page }) => {
    page.on('pageerror', error => { throw error })
    let fail = false
    let release: () => void = () => {}
    const pending = new Promise<void>(resolve => { release = resolve })
    const fresh = { name: 'cashflow', last_checked: '2026-09-13T12:00:00Z', limits_cpu: '4', limits_memory: '4GB', device_eth0_ipv4_address: '192.0.2.2', profiles: [], ephemeral: true, stateful: false }
    await page.route('**/api/**', route => route.fulfill({ json: [] }))
    await page.route('**/api/vm/details/cashflow?refresh=1', async route => {
        await pending
        await route.fulfill(fail ? { status: 503, json: { error: 'VM host unavailable. Please retry.' } } : { json: fresh })
    })
    await page.route('http://vm-refresh.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://vm-refresh.test/', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script>window.process={env:{}}</script><script src="/fixture.js"></script>' }))
    await page.goto('http://vm-refresh.test/')
    const button = page.getByRole('button', { name: 'Refresh VM details' })
    const previous = await button.innerText()
    await button.click()
    await expect(button).toBeDisabled()
    await expect(button).toContainText('Refreshing')
    release()
    await expect(button).toBeEnabled()
    await expect(button).not.toHaveText(previous)
    await expect(page.getByRole('heading', { name: '4GB', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: '192.0.2.2', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Yes', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No', exact: true })).toBeVisible()
    const checked = await button.innerText()
    fail = true
    await button.click()
    await expect(page.getByText('VM host unavailable. Please retry.')).toBeVisible()
    await expect(button).toHaveText(checked)
    await expect(page.getByRole('heading', { name: '4GB', exact: true })).toBeVisible()
    fail = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByText('VM host unavailable. Please retry.')).toHaveCount(0)
})
