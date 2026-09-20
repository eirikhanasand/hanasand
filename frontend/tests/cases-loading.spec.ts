import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'cases-loading-'))
    execFileSync('bun', ['build', 'tests/fixtures/cases-loading.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outdir', output])
    bundle = readFileSync(path.join(output, 'cases-loading.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => { throw error })
    await page.route('http://cases.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://cases.test/', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' }))
})
const monitor = { id: 'HA-1', title: 'Monitor case', status: 'open', source: 'monitoring' }
const intel = { id: 'case-1', title: 'Intelligence case', status: 'open' }

for (const delayed of ['monitoring', 'intelligence']) {
    test(`available cases appear before delayed ${delayed}; refreshing preserves rows`, async ({ page }) => {
        let release: () => void = () => {}
        const gate = new Promise<void>(resolve => { release = resolve })
        let refreshing = false
        let finishRefresh: () => void = () => {}
        const refreshGate = new Promise<void>(resolve => { finishRefresh = resolve })
        await page.route('**/api/cases?**', async route => {
            const params = new URL(route.request().url()).searchParams
            expect(params.get('organizationId')).toBe('org-a')
            const collection = params.get('collection')
            if (refreshing) await refreshGate
            else if (collection === delayed) await gate
            await route.fulfill({ json: { items: [collection === 'monitoring' ? monitor : intel] } })
        })
        await page.goto('http://cases.test/')
        const fastTitle = delayed === 'monitoring' ? intel.title : monitor.title
        await expect(page.getByRole('link', { name: fastTitle })).toBeVisible()
        await expect(page.getByRole('status')).toHaveText('Updating cases…')
        release()
        await expect(page.getByRole('link', { name: intel.title })).toBeVisible()
        await expect(page.getByRole('link', { name: monitor.title })).toBeVisible()
        await expect(page.getByRole('status')).toHaveCount(0)
        refreshing = true
        await page.getByRole('button', { name: 'Refresh cases' }).click()
        await expect(page.getByRole('status')).toHaveText('Updating cases…')
        await expect(page.getByRole('link', { name: fastTitle })).toBeVisible()
        finishRefresh()
        await expect(page.getByRole('status')).toHaveCount(0)
    })
}

test('pagination keeps monitoring rows, filters work, and organization switches discard old cases', async ({ page }) => {
    let monitoringRequests = 0
    await page.route('**/api/cases?**', async route => {
        const params = new URL(route.request().url()).searchParams
        const monitoring = params.get('collection') === 'monitoring'
        if (monitoring) monitoringRequests++
        if (params.get('organizationId') === 'org-b') return route.fulfill({ json: { items: [] } })
        await route.fulfill({ json: monitoring ? { items: [monitor] } : params.has('cursor')
            ? { items: [{ id: 'later', title: 'Older resolved case', status: 'resolved' }] }
            : { items: [intel], nextCursor: 'next' } })
    })
    await page.goto('http://cases.test/')
    await page.getByRole('button', { name: 'Load more cases' }).click()
    await expect(page.getByRole('button', { name: 'Load more cases' })).toHaveCount(0)
    expect(monitoringRequests).toBe(1)
    await expect(page.getByRole('link', { name: monitor.title })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Older resolved case' })).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('all')
    await expect(page.getByRole('link', { name: 'Older resolved case' })).toBeVisible()
    await page.getByRole('button', { name: 'Switch organization' }).click()
    await expect(page.getByText('No cases yet.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: monitor.title })).toHaveCount(0)
})

test('partial failures are explicit, retry recovers, and authorization denial clears rows', async ({ page }) => {
    let status = 503
    await page.route('**/api/cases?**', route => {
        const monitoring = new URL(route.request().url()).searchParams.get('collection') === 'monitoring'
        return route.fulfill({ status: monitoring ? status : 200, json: monitoring && status !== 200 ? { error: 'Monitoring unavailable' } : { items: [monitoring ? monitor : intel] } })
    })
    await page.goto('http://cases.test/')
    await expect(page.getByRole('link', { name: intel.title })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveText('Monitoring unavailable')
    status = 200
    await page.getByRole('button', { name: 'Refresh cases' }).click()
    await expect(page.getByRole('link', { name: monitor.title })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    status = 403
    await page.getByRole('button', { name: 'Refresh cases' }).click()
    await expect(page.getByRole('alert')).toContainText('Case access could not be verified')
    await expect(page.getByRole('link')).toHaveCount(0)
})
