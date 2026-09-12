import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'host-case-test-'))
    execFileSync('bun', ['build', 'tests/fixtures/host-case.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await page.route('http://host-case.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://host-case.test/', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' }))
})
test('host readers can inspect cases while management controls stay unavailable', async ({ page }) => {
    let canManage = false
    await page.route('**/api/cases/HA-15?*', route => route.fulfill({ json: { case: {
        id: 'HA-15', title: 'HA-15 · Pengeflyt', summary: 'Certificate expired', status: 'resolved', severity: 'high',
        canManage, occurrences: 1, notificationsEnabled: true, notifications: [], comments: [], history: [], events: [],
    } } }))
    await page.route('**/api/backend/**', route => route.fulfill({ json: { items: [] } }))
    await page.goto('http://host-case.test/')
    await expect(page.getByRole('heading', { name: 'HA-15 · Pengeflyt' })).toBeVisible()
    await expect(page.getByLabel('Severity')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Reopen case' })).toBeDisabled()
    await page.getByText('Notification settings (0)', { exact: true }).click()
    await expect(page.getByLabel('Enable notifications for this case')).toBeDisabled()
    await expect(page.getByLabel('Add a comment')).toBeDisabled()
    canManage = true
    await page.reload()
    await expect(page.getByLabel('Severity')).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Reopen case' })).toBeEnabled()
})
