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
test.beforeAll(async () => {
    output = mkdtempSync(path.join(tmpdir(), 'host-case-test-'))
    execFileSync('bun', ['build', 'tests/fixtures/host-case.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outdir', output])
    bundle = readFileSync(path.join(output, 'host-case.js'), 'utf8')
    css = (await postcss([tailwind()]).process(readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') })).css
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await page.route('http://host-case.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://host-case.test/', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<html class="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>` }))
})
test('host readers can inspect cases while management controls stay unavailable', async ({ page }) => {
    let canManage = false
    await page.route('**/api/cases/HA-15?*', route => route.fulfill({ json: { case: {
        id: 'HA-15', title: 'HA-15 · Pengeflyt', summary: 'Certificate expired', status: 'resolved', severity: 'high',
        diskDiagnostics: { host: 'inspur', sampledAt: '2026-09-19T10:00:00Z', filesystems: [{ path: '/', usedPercent: 85, complete: false, directories: [{ path: '/var/lib/docker/volumes/example data', sizeBytes: 10737418240 }] }] },
        canManage, occurrences: 1, notificationsEnabled: true, notifications: [], comments: [], history: [], events: [],
    } } }))
    await page.route('**/api/backend/**', route => route.fulfill({ json: { items: [] } }))
    await page.goto('http://host-case.test/')
    await expect(page.getByRole('heading', { name: 'HA-15 · Pengeflyt' })).toBeVisible()
    await expect(page.getByText('/var/lib/docker/volumes/example data', { exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: '10 GiB' })).toBeVisible()
    await expect(page.getByText(/partial/i)).toBeVisible()
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

test('case history aligns event metadata and preserves change details in timeline columns', async ({ page }) => {
    const history = [
        { id: 'created', action: 'created', actor: 'Health monitoring', at: '2026-09-19T19:51:00Z', note: 'First recorded health-check failure or warning.' },
        { id: 'recovered', action: 'recovered', actor: 'Health monitoring', at: '2026-09-19T19:52:00Z', note: 'Temperature is normal: 40°C (alert above 50°C).' },
        { id: 'recurred', action: 'recurred', actor: 'Health monitoring', at: '2026-09-20T02:58:01Z', note: 'Temperature is high: 52°C (alert above 50°C).' },
        { id: 'status', action: 'status_changed', actor: 'Eirik', at: '2026-09-20T03:00:00Z', fromStatus: 'open', toStatus: 'in_progress', fromSeverity: 'high', toSeverity: 'critical', note: 'Investigating the sensor.\nChecking cooling.' },
        { id: 'notifications', action: 'notifications_changed', actor: 'Eirik', at: '2026-09-20T03:01:00Z', notificationsEnabled: false },
    ]
    await page.route('**/api/cases/HA-15?*', route => route.fulfill({ json: { case: {
        id: 'HA-15', title: 'HA-15 · Inspur temperature', summary: 'Temperature is high', status: 'open', severity: 'high',
        canManage: false, occurrences: 2, notificationsEnabled: false, notifications: [], comments: [], history, events: [],
    } } }))
    await page.route('**/api/backend/**', route => route.fulfill({ json: { items: [] } }))
    await page.goto('http://host-case.test/')
    const timeline = page.getByRole('table', { name: 'Case history' })
    await expect(timeline.getByRole('columnheader')).toHaveText(['Time', 'Event', 'Actor', 'Details'])
    await expect(timeline.getByRole('row')).toHaveCount(history.length + 1)
    for (const [index, event] of history.entries()) {
        const cells = timeline.locator('tbody tr').nth(index).getByRole('cell')
        await expect(cells).toHaveCount(4)
        await expect(cells.nth(0).locator('time')).toHaveAttribute('datetime', event.at)
        await expect(cells.nth(1)).toHaveText(event.action.replaceAll('_', ' '))
        await expect(cells.nth(2)).toHaveText(event.actor)
        if (event.note) await expect(cells.nth(3)).toContainText(event.note)
    }
    await expect(timeline).toContainText('open → in progress')
    await expect(timeline).toContainText('Severity: high → critical')
    await expect(timeline).toContainText('Notifications disabled')
    await timeline.screenshot({ path: '/tmp/case-history-desktop.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    const region = page.getByRole('region', { name: 'History timeline' })
    await region.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await region.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
    await region.focus()
    await page.keyboard.press('End')
    await page.screenshot({ path: '/tmp/case-history-mobile.png' })
})
