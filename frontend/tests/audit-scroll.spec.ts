import { test, expect } from '@playwright/test'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'audit-scroll-test-'))
    execFileSync(process.env.BUN_BIN || 'bun', ['build', 'tests/fixtures/audit-scroll.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test('scroll appends 50, preserves filters and rows on failure, retries and stops at the total', async ({ page }) => {
    let calls = 0
    await page.route('http://audit.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://audit.test/', route => route.fulfill({ contentType: 'text/html', body: '<style>[data-testid="audit-scroll"]{height:300px;overflow:auto}td{height:35px}</style><div id="root"></div><script type="module" src="/fixture.js"></script>' }))
    await page.route('**/system/events?*', async route => {
        calls++
        const q = new URL(route.request().url()).searchParams
        expect(q.get('limit')).toBe('50')
        expect(q.get('service')).toBe('test')
        expect(q.has('page')).toBe(false)
        if (calls === 2) return route.fulfill({ status: 503 })
        const first = q.get('cursor') === 'first'
        await route.fulfill({ json: { events: Array.from({ length: first ? 50 : 25 }, (_, i) => ({ id: (first ? 75 : 25)-i, created_at: '2026-09-13T00:00:00Z', actor_id: 'operator', service: 'test', event_type: 'read', outcome: 'success' })), pagination: { total: 125, nextCursor: first ? 'second' : null } } })
    })
    await page.goto('http://audit.test/')
    await expect(page.getByText('50/125', { exact: true })).toBeVisible()
    const scroll = page.getByTestId('audit-scroll')
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight })
    await expect(page.getByText('100/125', { exact: true })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(100)
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight })
    await expect(page.getByRole('button', { name: 'Could not load more events. Retry' })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(100)
    await page.getByRole('button', { name: 'Could not load more events. Retry' }).click()
    await expect(page.getByText('125/125', { exact: true })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(125)
    await scroll.evaluate(el => { el.scrollTop = el.scrollHeight })
    await expect(page.getByText('All events displayed')).toBeVisible()
    expect(calls).toBe(3)
})
