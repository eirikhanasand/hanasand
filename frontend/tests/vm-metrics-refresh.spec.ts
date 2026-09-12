import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'vm-metrics-test-'))
    execFileSync('bun', ['build', 'tests/fixtures/vm-metrics.tsx', '--target=browser', '--define', 'process.env.NODE_ENV="production"', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await page.route('http://vm-metrics.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://vm-metrics.test/', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<div id="root"></div><script src="/fixture.js"></script>' }))
})
const sample = (name = 'first-vm', cpu = 12, created_at = new Date().toISOString()) => [{ name, cpu_usage_percent: cpu, cpu_cores: 1, power_state: 'on', created_at }]

test('polls fresh samples, retains the timestamp on failure, and stops on unmount', async ({ page }) => {
    let requests = 0
    const stamp = new Date().toISOString()
    await page.route('**/api/backend/vm/metrics/first-vm', route => {
        requests++
        return route.fulfill(requests === 2 ? { status: 503, json: {} } : { json: sample('first-vm', requests === 1 ? 12 : 24, stamp) })
    })
    await page.goto('http://vm-metrics.test/')
    await expect(page.getByText('12.0% across 1 cores')).toBeVisible()
    await expect(page.locator('time')).toHaveAttribute('datetime', stamp)
    await page.clock.runFor(10_100)
    await expect.poll(() => requests).toBe(2)
    await expect(page.getByText('12.0% across 1 cores')).toBeVisible()
    await expect(page.locator('time')).toHaveAttribute('datetime', stamp)
    await page.clock.runFor(2100)
    await expect(page.getByText('24.0% across 1 cores')).toBeVisible()
    await page.getByRole('button', { name: 'Unmount' }).click()
    const stopped = requests
    await page.clock.runFor(60_000)
    expect(requests).toBe(stopped)
})

test('permission denial clears metrics and stops polling', async ({ page }) => {
    let requests = 0
    await page.route('**/api/backend/vm/metrics/first-vm', route => {
        requests++
        return route.fulfill(requests === 1 ? { json: sample() } : { status: 403, json: {} })
    })
    await page.goto('http://vm-metrics.test/')
    await expect(page.locator('time')).toBeVisible()
    await page.clock.runFor(10_100)
    await expect(page.getByText('You do not have permission to view metrics.')).toBeVisible()
    await expect(page.locator('time')).toHaveCount(0)
    await page.clock.runFor(60_000)
    expect(requests).toBe(2)
})

test('switching VM cancels the old request', async ({ page }) => {
    let release: (() => void) | undefined
    await page.route('**/api/backend/vm/metrics/first-vm', async route => {
        await new Promise<void>(resolve => { release = resolve })
        await route.fulfill({ json: sample() }).catch(() => {})
    })
    await page.route('**/api/backend/vm/metrics/second-vm', route => route.fulfill({ json: sample('second-vm', 42) }))
    await page.goto('http://vm-metrics.test/')
    await expect.poll(() => Boolean(release)).toBe(true)
    await page.getByRole('button', { name: 'Switch VM' }).click()
    await expect(page.getByText('42.0% across 1 cores')).toBeVisible()
    release!()
    await expect(page.getByText('12.0% across 1 cores')).toHaveCount(0)
})
