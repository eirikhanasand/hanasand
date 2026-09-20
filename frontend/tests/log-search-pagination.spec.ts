import { expect, test } from '@playwright/test'
import { event, openLogs, result } from './fixtures/logs-browser'

test('all pages stay accessible and progress polls do not discard the pages being read', async ({ page }) => {
    await page.clock.install()
    let fail = false
    await page.route('**/api/backend/logs/search?*', route => {
        const params = new URL(route.request().url()).searchParams
        if (params.get('cursor') && fail) return route.fulfill({ status: 503, json: { error: 'Please retry.' } })
        const rows = params.get('cursor') ? [event('second')] : [event('first')]
        return route.fulfill({ json: { ...result(rows), next_cursor: params.get('cursor') ? null : 'next-page', generated_at: new Date().toISOString() } })
    })
    await openLogs(page, '/logs/search?search=docker+logs')
    await page.clock.runFor(300)
    const more = page.getByRole('button', { name: 'Load more results' })
    await expect(more).toBeVisible()
    fail = true
    await more.click()
    await expect(page.getByRole('alert')).toContainText('Please retry.')
    await expect(page.locator('article')).toHaveCount(1)
    fail = false
    await more.click()
    await expect(page.locator('article')).toHaveCount(2)
    await expect(more).toHaveCount(0)
    await page.clock.runFor(10_000)
    await expect(page.locator('article')).toHaveCount(2)
    await page.getByRole('button', { name: 'Refresh results' }).click()
    await page.clock.runFor(300)
    await expect(page.locator('article')).toHaveCount(1)
    await expect(more).toBeVisible()
})
