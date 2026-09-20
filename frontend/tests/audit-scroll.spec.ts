import { test, expect, type Page } from '@playwright/test'
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
        expect(q.get('format')).toBe('timeline')
        expect(q.get('service')).toBe('test')
        expect(q.has('page')).toBe(false)
        if (calls === 2) return route.fulfill({ status: 503 })
        const first = q.get('cursor') === 'first'
        await route.fulfill({ json: { events: Array.from({ length: first ? 50 : 25 }, (_, i) => ({ id: (first ? 75 : 25)-i, created_at: '2026-09-13T00:00:00Z', actor_id: 'operator', service: 'test', event_type: 'read', outcome: 'success' })), pagination: { total: null, nextCursor: first ? 'second' : null } } })
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

async function openAudit(page: Page) {
    await page.route('http://audit.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://audit.test/', route => route.fulfill({ contentType: 'text/html', body: '<style>.hidden{display:none}[data-testid="audit-scroll"]{height:300px;overflow:auto}td{height:35px}dialog{position:fixed;inset:0;margin:0;padding:0;border:0;width:100vw;height:100dvh;max-width:none;max-height:none}dialog>section{height:100%;display:flex;flex-direction:column}dialog [data-testid="audit-scroll"]{flex:1;min-height:0}</style><div id="root"></div><script type="module" src="/fixture.js"></script>' }))
    await page.goto('http://audit.test/')
}

test('fullscreen preserves scroll and filter drafts; Cmd J searches all events and restores with Minimize or Escape', async ({ page }) => {
    const requests: URLSearchParams[] = []
    await page.route('**/system/events?*', route => {
        const query = new URL(route.request().url()).searchParams
        requests.push(query)
        if (query.has('hql')) {
            if (query.get('hql')!.includes('invalid')) return route.fulfill({ status: 400, json: { error: 'Unsupported operator invalid.' } })
            const summary = query.get('hql')!.includes('summarize')
            return route.fulfill({ json: { events: [], pagination: { total: 12, nextCursor: null }, queryResult: { columns: summary ? ['Service', 'Count'] : ['Action', 'Description'], rows: summary ? [['test', 12]] : [['restart', 'matched query']], limit: 100, summarized: summary } } })
        }
        return route.fulfill({ json: { events: [{ id: 1, created_at: '2026-09-14T00:00:00Z', actor_id: 'operator', service: 'test', event_type: 'older.match', outcome: 'success', reason: 'Found outside the initial batch' }], pagination: { total: 1, nextCursor: null } } })
    })
    await openAudit(page)
    const scroll = page.getByTestId('audit-scroll')
    await scroll.evaluate(el => { el.scrollTop = 200 })
    await page.getByRole('textbox', { name: 'Service', exact: true }).fill('unsaved service')
    await page.getByRole('button', { name: 'Fullscreen timeline' }).click()
    const dialog = page.getByRole('dialog', { name: 'Fullscreen audit timeline' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filter', exact: true })).toBeHidden()
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(200)
    await expect(dialog).toHaveJSProperty('clientWidth', 1280)
    await page.getByRole('button', { name: 'Minimize timeline' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('textbox', { name: 'Service', exact: true })).toHaveValue('unsaved service')
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(200)
    await page.getByRole('button', { name: 'Fullscreen timeline' }).click()
    await page.keyboard.press('Meta+j')
    const search = page.getByRole('searchbox', { name: 'Search audit events' })
    await expect(search).toBeFocused()
    await search.fill('older match')
    await search.press('Enter')
    await expect(dialog).toContainText('Found outside the initial batch')
    expect(requests.at(-1)!.get('q')).toBe('older match')
    expect(requests.at(-1)!.get('service')).toBe('test')
    expect(requests.at(-1)!.has('cursor')).toBe(false)
    await expect(page).toHaveURL(/q=older\+match/)
    await page.getByRole('combobox', { name: 'Search mode' }).selectOption('hql')
    const hql = page.getByRole('searchbox', { name: 'HQL query' })
    await hql.fill('AuditEvents | project Action, Description')
    await hql.press('Enter')
    await expect(page.getByRole('columnheader')).toHaveText(['Action', 'Description'])
    await expect(dialog).toContainText('matched query')
    expect(requests.at(-1)!.has('q')).toBe(false)
    await hql.fill('AuditEvents | invalid')
    await hql.press('Enter')
    await expect(page.getByRole('alert')).toContainText('Unsupported operator invalid.')
    await expect(dialog).toContainText('matched query')
    await hql.fill('AuditEvents | summarize count() by Service')
    await hql.press('Enter')
    await expect(page.getByRole('columnheader')).toHaveText(['Service', 'Count'])
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: 'Fullscreen timeline' })).toBeFocused()
    await page.getByRole('button', { name: 'Clear search', exact: true }).click()
    await expect(page).not.toHaveURL(/hql=/)
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible()
})
