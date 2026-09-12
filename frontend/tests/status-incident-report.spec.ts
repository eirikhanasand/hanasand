import { expect, test } from '@playwright/test'

test('incident report separates evidence and shows newest updates in bounded pages', async ({ page }) => {
    const started = '2026-07-24T22:14:01.048Z'
    const id = 'fixture-incident-report'
    const at = new Date().toISOString()
    const names = [['core', 'API health'], ['website', 'Public website'], ['threat-intelligence', 'Public search'], ['threat-intelligence', 'Processing backlog'], ['threat-intelligence', 'Source collection'], ['browser-sandbox', 'Browser workspace'], ['dark-web-monitoring', 'Monitoring workspace'], ['dark-web-monitoring', 'Latest activity']]
    const updates = Array.from({ length: 1001 }, (_, index) => ({ at: new Date(Date.parse(started) + index * 60000).toISOString(), status: index === 1000 ? 'resolved' : 'monitoring', message: `Update ${index}`, evidence: `Recorded evidence ${index}` }))
    const payload = { overall: 'up', monitoring: 'live', generated_at: at, checks: names.map(([service, check_name]) => ({ service, check_name, status: 'up', checked_at: at, latency_ms: 10, uptime_30d: '99.9' })), history: [], incidents: [{ id, service: 'dark-web-monitoring', check_name: 'Latest activity', title: 'Latest activity interruption', impact: 'Outage', status: 'resolved', started_at: started, resolved_at: updates.at(-1)!.at, summary: 'Recent monitoring activity was delayed.', cause: 'No confirmed root cause was recorded.', updates }] }
    await page.route('**/api/status?incident=*', route => route.fulfill({ json: payload }))
    await page.goto(`/status/incidents/${id}`)
    const report = page.getByRole('article')
    await expect(report.getByRole('heading', { name: 'Impact', exact: true })).toBeVisible()
    await expect(report.getByText('No confirmed root cause was recorded.', { exact: true })).toBeVisible()
    await expect(report.locator('li')).toHaveCount(25)
    await expect(report.locator('li').first()).toContainText('Update 1000')
    await expect(report.locator('li').first()).toContainText('Recorded evidence 1000')
    await report.getByRole('button', { name: /Show older updates/ }).click()
    await expect(report.locator('li')).toHaveCount(50)
    await expect(report.locator('li').last()).toContainText('Update 951')
    for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await report.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded()
        await expect(report.getByRole('heading', { level: 1 })).toBeInViewport()
        await page.screenshot({ path: `/tmp/incident-report-${width}.png`, fullPage: false })
    }
})
