import { expect, test } from '@playwright/test'

test('status feed failures preserve verified evidence without claiming a service outage', async ({ page }) => {
    test.skip(process.env.STATUS_FEED_TEST !== '1', 'Enable explicit browser fault injection.')
    const names = [['Core platform', 'API Health'], ['Website', 'Public Website'], ['Threat intelligence', 'Public Search'], ['Threat intelligence', 'Processing Backlog'], ['Threat intelligence', 'Source Collection'], ['Browser sandbox', 'Browser Workspace'], ['Dark web monitoring', 'Monitoring Workspace'], ['Dark web monitoring', 'Latest Activity']]
    const at = new Date().toISOString()
    const healthy = { overall: 'up', monitoring: 'live', generated_at: at, last_verified_at: at, checks: names.map(([service, check_name]) => ({ service, check_name, status: 'up', checked_at: at, latency_ms: 12, uptime_30d: '99.9' })), history: [], incidents: [] }
    let response = healthy
    let code = 200
    await page.route('**/api/status', route => route.fulfill({ status: code, json: response }))
    await page.goto('/status')
    await expect(page.getByRole('heading', { name: 'Everything operational' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('hanasand-verified-status'))).not.toBeNull()
    const verified = page.locator('time[datetime="' + at + '"]')
    await expect(verified).toBeVisible()
    code = 503
    await expect(page.getByText('Showing last verified results', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Everything operational', exact: true })).toBeVisible({ timeout: 10000 })
    await expect(verified).toBeVisible()
    code = 200
    response = { ...healthy, overall: 'down', monitoring: 'unavailable', generated_at: '', checks: [] }
    await page.waitForTimeout(3500)
    await expect(page.getByRole('heading', { name: 'Everything operational', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Public Search', exact: true })).toBeVisible()
    await expect(page.getByText('Data interval', { exact: true })).toHaveCount(0)
    await expect(page.getByText('How to read this page', { exact: true })).toHaveCount(0)
    await expect(verified).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Everything operational', exact: true })).toBeVisible()
    await expect(verified).toBeVisible()
    response = { ...healthy, overall: 'down', checks: healthy.checks.map((check, index) => ({ ...check, status: index === 0 ? 'down' : 'up' })) }
    await expect(page.getByRole('heading', { name: 'Service interruption', exact: true })).toBeVisible({ timeout: 10000 })
    response = healthy
    await expect(page.getByRole('heading', { name: 'Everything operational' })).toBeVisible({ timeout: 10000 })
    for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await expect(page.getByText(/Data refreshed/)).toHaveCount(0)
    await page.screenshot({ path: '/tmp/status-verified-desktop.png' })
})
