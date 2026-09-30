import { test, expect } from '@playwright/test'
import { event, openLogs, result } from './fixtures/logs-browser'

test('realtime continues polling while search filters and retries are used', async ({ page }) => {
    await page.clock.install()
    const requests: URL[] = []
    let fail = false
    await page.route('**/api/backend/logs/search?*', route => {
        const url = new URL(route.request().url())
        requests.push(url)
        return fail ? route.fulfill({ status: 503 }) : route.fulfill({ json: result([{ ...event(url.searchParams.get('search') || 'initial'), normalized: { ...event().normalized, message: url.searchParams.get('search') || 'initial', process: undefined } }]) })
    })
    await openLogs(page)
    await page.clock.runFor(300)
    await expect(page.locator('article')).toContainText('initial')
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0)
    const initialCount = requests.length
    await page.clock.runFor(10000)
    await expect.poll(() => requests.length).toBe(initialCount + 1)

    await page.getByRole('button', { name: 'Filter logs', exact: true }).click()
    const search = page.getByRole('searchbox', { name: 'Search logs' })
    await search.fill('xmrig')
    await page.clock.runFor(300)
    await expect(search).toBeFocused()
    await expect(page.locator('article')).toContainText('xmrig')
    expect(requests.at(-1)!.searchParams.get('severity')).toBe('high,critical')
    const filteredCount = requests.length
    await page.clock.runFor(10000)
    await expect.poll(() => requests.length).toBe(filteredCount + 1)

    fail = true
    await search.fill('bloodhound')
    await page.clock.runFor(300)
    await expect(page.getByRole('alert')).toContainText('Could not search logs.')
    fail = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await page.clock.runFor(300)
    await expect(page.locator('article')).toContainText('bloodhound')
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Refresh events' })).toContainText('10s')
    const beforePoll = requests.length
    await page.clock.runFor(10000)
    await expect.poll(() => requests.length).toBe(beforePoll + 1)
    await search.fill('filter-keeps-polling')
    await page.clock.runFor(300)
    await expect(page.locator('article')).toContainText('filter-keeps-polling')
})

test('realtime polling continues during event text selection', async ({ page }) => {
    await page.clock.install()
    let requests = 0
    await page.route('**/api/backend/logs/search?*', route => { requests++; return route.fulfill({ json: result() }) })
    await openLogs(page)
    await page.clock.runFor(300)
    const row = page.locator('article')
    await row.dispatchEvent('pointerdown')
    const beforePoll = requests
    await page.clock.runFor(10000)
    await expect.poll(() => requests).toBe(beforePoll + 1)
    await expect(page.getByRole('button', { name: 'Refresh events' })).toContainText('10s')
})

test('an automatic response already in flight updates the feed', async ({ page }) => {
    await page.clock.install()
    let requests = 0
    let release: (() => void) | undefined
    await page.route('**/api/backend/logs/search?*', async route => {
        const id = `poll-${++requests}`
        if (requests > 1) await new Promise<void>(resolve => { release = resolve })
        await route.fulfill({ json: result([{ ...event(id), normalized: { ...event().normalized, message: id, process: undefined } }]) })
    })
    await openLogs(page)
    await page.clock.runFor(300)
    await expect(page.locator('article')).toContainText('poll-1')
    await page.clock.runFor(10000)
    await expect.poll(() => Boolean(release)).toBe(true)
    release!()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0)
    await expect(page.locator('article')).toHaveCount(2)
    await expect(page.locator('article').filter({ hasText: 'poll-2' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Refresh events' })).toContainText('10s')
})

test('retains logs and reading position across overlapping polls and failures', async ({ page }) => {
    await page.clock.install()
    let fail = false
    let incoming: Array<Record<string, unknown>> = Array.from({ length: 30 }, (_, i) => ({ id: `old-${i}`, event_timestamp: '2026-09-19T12:00:00Z', normalized: { service: 'test', host: 'inspur', severity: 'high', level: 'info', log_type: 'ProcessLogs', message: `Original log ${i}`, metadata: { detail: 'Retained context' } } }))
    const requests: URL[] = []
    await page.route('**/api/backend/logs/search?*', route => {
        requests.push(new URL(route.request().url()))
        return fail ? route.fulfill({ status: 503 }) : route.fulfill({ json: result(incoming) })
    })
    await openLogs(page)
    const feed = page.locator('[aria-label="Log events"]')
    const rows = feed.locator('article')
    await page.clock.runFor(300)
    await expect(rows).toHaveCount(30)
    expect(requests[0].searchParams.get('severity')).toBe('high,critical')
    const reading = rows.filter({ hasText: 'Original log 10' })
    await reading.getByRole('button', { expanded: false }).click()
    await expect(reading.getByText('Retained context', { exact: false })).toBeVisible()
    const before = (await reading.boundingBox())!.y
    incoming = Array.from({ length: 5 }, (_, i) => ({ id: `new-${i}`, event_timestamp: '2026-09-19T12:01:00Z', normalized: { service: 'test', host: 'inspur', severity: 'high', level: 'info', log_type: 'ProcessLogs', message: `New log ${i}` } }))
    await page.clock.runFor(10000)
    await expect(rows).toHaveCount(35)
    expect(Math.abs((await reading.boundingBox())!.y - before)).toBeLessThan(2)
    await expect(reading.getByRole('button', { expanded: true })).toHaveAttribute('aria-expanded', 'true')
    await page.clock.runFor(10000)
    await expect(rows).toHaveCount(35)
    fail = true
    await page.clock.runFor(10000)
    await expect(rows).toHaveCount(35)
    await expect(page.getByRole('alert')).toContainText('Could not search logs.')
    fail = false
    const retryCount = requests.length
    await page.clock.runFor(10000)
    await expect.poll(() => requests.length).toBe(retryCount + 1)
    await expect(rows).toHaveCount(35)
    await expect(reading.getByRole('button', { expanded: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0)
})

test('realtime loads 100 events initially and prefetches 50 more near the end', async ({ page }) => {
    const requests: URL[] = []
    await page.route('**/api/backend/logs/search?*', route => {
        const url = new URL(route.request().url())
        requests.push(url)
        const cursor = url.searchParams.get('cursor')
        const rows = cursor === 'second-page'
            ? Array.from({ length: 50 }, (_, index) => event(`event-${100 + index}`))
            : cursor === 'third-page'
                ? Array.from({ length: 50 }, (_, index) => event(`event-${150 + index}`))
                : cursor === 'fourth-page'
                    ? Array.from({ length: 25 }, (_, index) => event(`event-${200 + index}`))
                    : Array.from({ length: 100 }, (_, index) => event(`event-${index}`))
        const nextCursor = cursor === null ? 'second-page'
            : cursor === 'second-page' ? 'third-page'
                : cursor === 'third-page' ? 'fourth-page' : null
        const response = { ...result(rows), limit: cursor ? 50 : 100, next_cursor: nextCursor, ...(cursor ? {} : { total_events: 225 }) }
        return route.fulfill({ json: response })
    })
    await openLogs(page)
    await expect(page.locator('article')).toHaveCount(100)
    expect(requests).toHaveLength(1)
    expect(requests[0].searchParams.get('hql')).toBe('Logs | take 100')
    expect(requests[0].searchParams.get('hours')).toBe('24')
    expect(requests[0].searchParams.get('paginate')).toBe('1')
    await expect(page.getByText('100/225')).toBeVisible()

    const viewport = page.locator('[data-logs-scroll]')
    await viewport.evaluate(element => {
        element.scrollTop = element.scrollHeight - element.clientHeight - 800
        element.dispatchEvent(new Event('scroll'))
    })
    await expect.poll(() => requests.length).toBe(2)
    expect(requests[1].searchParams.get('cursor')).toBe('second-page')
    await expect(page.locator('article')).toHaveCount(150)
    await expect(page.getByText('150/225')).toBeVisible()

    await viewport.evaluate(element => {
        element.scrollTop = element.scrollHeight
        element.dispatchEvent(new Event('scroll'))
    })
    await expect.poll(() => requests.length).toBe(3)
    expect(requests[2].searchParams.get('cursor')).toBe('third-page')
    await expect(page.locator('article')).toHaveCount(200)
    await expect(page.getByText('200/225')).toBeVisible()

    await viewport.evaluate(element => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll')) })
    await expect.poll(() => requests.length).toBe(4)
    expect(requests[3].searchParams.get('cursor')).toBe('fourth-page')
    await expect(page.locator('article')).toHaveCount(225)
    await expect(page.getByText('225/225')).toBeVisible()
    await viewport.evaluate(element => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll')) })
    await page.waitForTimeout(100)
    expect(requests).toHaveLength(4)
})

test('event text remains selectable and copies full evidence without navigating', async ({ page }) => {
    await page.route('**/api/backend/logs/search?*', route => route.fulfill({ json: result() }))
    await openLogs(page)
    const row = page.locator('article').filter({ hasText: 'whoami' })
    await expect(row).toContainText('Original level: info')
    await expect(row).toContainText('high')
    const text = row.locator('pre').first()
    expect(await text.evaluate(element => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const selection = window.getSelection()!
        selection.removeAllRanges()
        selection.addRange(range)
        return { selected: selection.toString(), userSelect: getComputedStyle(element).userSelect, insideButton: !!element.closest('button') }
    })).toEqual({ selected: 'whoami', userSelect: 'text', insideButton: false })
    await row.getByRole('button', { expanded: false }).click()
    await expect(row).toContainText('Event checked 105 enabled rules.')
    await row.getByRole('button', { name: 'Copy event JSON' }).click()
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('copied-event')!))).toEqual(event().normalized)
    await expect(page).toHaveURL('http://logs.test/logs/realtime')
    await row.getByRole('button', { expanded: true }).click()
    await expect(row).not.toContainText('Full event and detection evidence')
})
