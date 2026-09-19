import { test, expect } from '@playwright/test'
import { event, openLogs, result } from './fixtures/logs-browser'
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
    await page.clock.runFor(5000)
    await expect(rows).toHaveCount(35)
    expect(Math.abs((await reading.boundingBox())!.y - before)).toBeLessThan(2)
    await expect(reading.getByRole('button', { expanded: true })).toHaveAttribute('aria-expanded', 'true')
    await page.clock.runFor(5000)
    await expect(rows).toHaveCount(35)
    fail = true
    await page.clock.runFor(5000)
    await expect(rows).toHaveCount(35)
    await expect(page.getByRole('alert')).toContainText('Could not search logs.')
    fail = false
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    const pausedRequestCount = requests.length
    await page.clock.runFor(5000)
    expect(requests).toHaveLength(pausedRequestCount)
    await expect(rows).toHaveCount(35)
    await expect(reading.getByRole('button', { expanded: true })).toBeVisible()
    await page.getByRole('button', { name: 'Resume', exact: true }).click()
    await page.clock.runFor(300)
    await expect(page.getByRole('alert')).toHaveCount(0)
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
    await expect(row).toContainText('Mill checked 105 enabled rules.')
    await row.getByRole('button', { name: 'Copy event JSON' }).click()
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('copied-event')!))).toEqual(event().normalized)
    await expect(page).toHaveURL('http://logs.test/logs/realtime')
    await row.getByRole('button', { expanded: true }).click()
    await expect(row).not.toContainText('Full event and detection evidence')
})
