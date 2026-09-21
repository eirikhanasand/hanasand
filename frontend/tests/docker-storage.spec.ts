import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
let output: string
let bundle: string
const state = { cacheBytes: 295e9, reclaimableCacheBytes: 275e9, cacheBudgetBytes: 50e9, checkedAt: '2026-09-19T18:00:00Z',
    running: false, queued: false, stale: false, schedule: '03:00', timezone: 'Europe/Oslo',
    unusedImages: [{ id: 'old', names: ['app:old'], sizeBytes: 2e9, eligible: true, retainedReason: null },
        { id: 'rollback', names: ['app:previous'], sizeBytes: 1e9, eligible: false, retainedReason: 'Rollback image' }] }
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'docker-storage-test-'))
    execFileSync(process.env.BUN_BINARY || 'bun', ['build', 'tests/fixtures/docker-storage.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.route('http://docker-storage.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://docker-storage.test/', route => route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>' }))
})
test('shows measured sizes and posts cleanup without claiming immediate success', async ({ page }) => {
    await page.route('**/api/backend/system/storage', route => route.fulfill({ json: state }))
    let requests = 0
    await page.route('**/api/backend/system/storage/clear', route => {
        expect(route.request().method()).toBe('POST'); requests++
        return route.fulfill({ status: 202, json: { queued: true } })
    })
    await page.goto('http://docker-storage.test/')
    await expect(page.getByText('295 GB', { exact: true })).toBeVisible()
    await expect(page.getByText('03:00 · Europe/Oslo')).toBeVisible()
    await page.getByText('Unused images (2)').click()
    await expect(page.getByText('app:old', { exact: true })).toBeVisible()
    await expect(page.getByText('Rollback image', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Clear unused storage' }).click()
    await expect(page.getByRole('button', { name: 'Queued…' })).toBeDisabled()
    await expect(page.getByText('Not cleared yet')).toBeVisible()
    expect(requests).toBe(1)
})
test('failed cleanup preserves the last success and stale data prevents another request', async ({ page }) => {
    await page.route('**/api/backend/system/storage', route => route.fulfill({ json: { ...state, stale: true, lastSuccessAt: '2026-09-18T01:00:00Z', error: 'Docker is unavailable.' } }))
    await page.goto('http://docker-storage.test/')
    await expect(page.getByRole('alert')).toContainText('Docker is unavailable.')
    await expect(page.locator('time[datetime="2026-09-18T01:00:00Z"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clear unused storage' })).toBeDisabled()
})
test('API rejection is visible and does not claim cleanup was queued', async ({ page }) => {
    await page.route('**/api/backend/system/storage', route => route.fulfill({ json: state }))
    await page.route('**/api/backend/system/storage/clear', route => route.fulfill({ status: 403, json: { error: 'System administrator access is required.' } }))
    await page.goto('http://docker-storage.test/')
    await page.getByRole('button', { name: 'Clear unused storage' }).click()
    await expect(page.getByRole('alert')).toContainText('System administrator access is required.')
    await expect(page.getByText('Not cleared yet')).toBeVisible()
})

test('shows progress and fresh totals when cleanup completes', async ({ page }) => {
    let current = { ...state, phase: null as string | null }
    await page.route('**/api/backend/system/storage', route => route.fulfill({ json: current }))
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route('**/api/backend/system/storage/clear', async route => {
        await gate
        current = { ...current, running: true, phase: 'build_cache' }
        await route.fulfill({ status: 202, json: { queued: true } })
    })
    await page.goto('http://docker-storage.test/')
    await page.getByRole('button', { name: 'Clear unused storage' }).click()
    await expect(page.getByRole('button', { name: 'Starting cleanup…' })).toBeDisabled()
    release()
    await expect(page.getByRole('button', { name: 'Clearing build cache…' })).toBeDisabled()
    current = { ...current, phase: 'refresh' }
    await expect(page.getByRole('button', { name: 'Updating totals…' })).toBeDisabled()
    current = { ...current, running: false, phase: null, cacheBytes: 20e9, reclaimableCacheBytes: 0 }
    await expect(page.getByRole('button', { name: 'Clear unused storage' })).toBeEnabled()
    await expect(page.getByText('0 GB reclaimable', { exact: true })).toBeVisible()
})
