import { test, expect } from '@playwright/test'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'realtime-logs-test-'))
    execFileSync('bun', ['build', 'tests/fixtures/realtime-logs.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test('retains logs and reading position across overlapping polls and failures', async ({ page }) => {
    await page.clock.install()
    let fail = false
    let incoming: Array<Record<string, unknown>> = []
    await page.route('http://logs.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://logs.test/', route => route.fulfill({ contentType: 'text/html', body: '<style>[data-logs-scroll]{height:300px;overflow:auto}[data-logs-row]{min-height:90px}</style><div id="root"></div><script type="module" src="/fixture.js"></script>' }))
    await page.route('**/logs/realtime?*', route => fail ? route.fulfill({ status: 503 }) : route.fulfill({ json: { logs: incoming, containers: [], runtime_available: true, generated_at: '2026-09-14T12:01:00Z' } }))
    await page.goto('http://logs.test/')
    const feed = page.locator('[data-logs-feed="Realtime"]')
    const rows = feed.locator('[data-logs-row]')
    const scroll = feed.locator('[data-logs-scroll]')
    await expect(rows).toHaveCount(30)
    const reading = rows.filter({ hasText: 'Original log 10' })
    await reading.getByRole('button').click()
    await expect(reading.getByText('Retained context', { exact: false })).toBeVisible()
    const before = (await reading.boundingBox())!.y
    incoming = Array.from({ length: 5 }, (_, i) => ({ id: `new-${i}`, service: 'test', source: 'runtime', level: 'info', message: `New log ${i}`, created_at: '2026-09-14T12:01:00Z' }))
    await page.clock.runFor(4000)
    await expect(rows).toHaveCount(35)
    expect(Math.abs((await reading.boundingBox())!.y - before)).toBeLessThan(2)
    await expect(reading.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    await page.clock.runFor(4000)
    await expect(rows).toHaveCount(35)
    fail = true
    await page.clock.runFor(4000)
    await expect(rows).toHaveCount(35)
    fail = false
    incoming = [{ ...incoming[0], message: 'Distinct message sharing an ID' }]
    await scroll.evaluate(node => { node.scrollTop = 0 })
    await page.clock.runFor(4000)
    await expect(rows).toHaveCount(36)
    await expect(rows.first()).toContainText('Distinct message sharing an ID')
    expect(await scroll.evaluate(node => node.scrollTop)).toBe(0)
    await page.getByRole('tab', { name: 'Live Feed' }).click()
    await expect(page.locator('[data-logs-feed="Realtime"] [data-logs-row]')).toHaveCount(36)
})
