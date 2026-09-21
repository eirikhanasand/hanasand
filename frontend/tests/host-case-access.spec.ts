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

test('empty Development opens five commits, scrolls from its buffer and persists a selected link', async ({ page }) => {
    const repository = { id: '11111111-1111-4111-8111-111111111111', provider: 'forgejo', repository_url: 'https://git.example.com/team/app', can_manage: true }
    const commits = Array.from({ length: 205 }, (_, index) => ({ external_id: index.toString(16).padStart(40, '0'), title: `Change ${index}`, author: 'Engineer', updated_at: '2026-09-21T00:00:00Z' }))
    let linked: Record<string, unknown>[] = []
    const cursors: string[] = []
    await page.route('**/api/cases/HA-15?*', route => route.fulfill({ json: { case: { id: 'HA-15', title: 'Temperature', status: 'open', severity: 'high', occurrences: 2, comments: [], history: [], notifications: [] } } }))
    await page.route('**/api/backend/cases/**', async route => {
        const url = new URL(route.request().url())
        if (url.pathname.endsWith('/repositories')) return route.fulfill({ json: { items: [repository] } })
        if (url.pathname.endsWith('/development')) return route.fulfill({ json: { items: linked, hasMore: false } })
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON()
            expect(body.caseId).toBe('HA-15')
            expect(body.repositoryId).toBe(repository.id)
            const selected = commits.find(commit => commit.external_id === body.commit)!
            linked = [{ ...selected, repository_id: repository.id, provider: repository.provider, repository_url: repository.repository_url, kind: 'commit', state: 'committed', url: `${repository.repository_url}/commit/${selected.external_id}` }]
            return route.fulfill({ json: { ok: true } })
        }
        const cursor = url.searchParams.get('cursor') || ''
        cursors.push(cursor)
        const start = cursor ? commits.findIndex(commit => commit.external_id === cursor) + 1 : 0
        if (cursor) await new Promise(resolve => setTimeout(resolve, 150))
        return route.fulfill({ json: { items: commits.slice(start, start + 100), nextCursor: start + 100 < commits.length ? commits[start + 99].external_id : null } })
    })
    await page.goto('http://host-case.test/')
    const development = page.getByRole('region', { name: 'Development', exact: true })
    await expect(development.getByRole('button', { name: 'Refresh development links' })).toBeEnabled()
    await expect(development.getByRole('list')).toHaveCount(0)
    await expect(development.getByText('Repository connections (1)')).toBeHidden()
    await page.getByRole('button', { name: 'Link a commit', exact: true }).click()
    const list = page.getByRole('list', { name: 'Recent commits' })
    await expect(list.getByRole('listitem')).toHaveCount(5)
    const durations: number[] = []
    for (let step = 0; step < 16; step++) {
        durations.push(await list.evaluate(element => new Promise<number>(resolve => {
            element.addEventListener('scroll', () => {
                const start = performance.now()
                const observer = new MutationObserver(() => { observer.disconnect(); resolve(performance.now() - start) })
                observer.observe(element, { childList: true, subtree: true })
            }, { once: true, capture: true })
            element.scrollTop = element.scrollHeight
        })))
        await expect(list.getByRole('listitem')).toHaveCount(10 + step * 5)
    }
    console.log(`Buffered commit scroll maximum: ${Math.max(...durations).toFixed(3)} ms`)
    expect(Math.max(...durations)).toBeLessThan(20)
    await expect.poll(() => cursors.length).toBe(2)
    expect(cursors[1]).toBe(commits[99].external_id)
    for (let count = 90; count <= 205; count += 5) {
        await list.evaluate(element => { element.scrollTop = element.scrollHeight })
        await expect(list.getByRole('listitem')).toHaveCount(count)
    }
    expect(cursors[2]).toBe(commits[199].external_id)
    await expect(list.getByRole('button', { name: `Link commit ${commits[204].external_id.slice(0, 8)}: Change 204`, exact: true })).toBeVisible()
    await list.getByRole('button', { name: `Link commit ${commits[80].external_id.slice(0, 8)}: Change 80`, exact: true }).click()
    await expect(list).toBeHidden()
    await expect(development.getByRole('link', { name: /Change 80/ })).toBeVisible()
    await page.reload()
    await expect(development.getByRole('link', { name: /Change 80/ })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Link a commit', exact: true }).click()
    await expect(list.getByRole('listitem')).toHaveCount(5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await development.screenshot({ path: '/tmp/case-development-picker-mobile.png' })
})
