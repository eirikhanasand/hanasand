import { expect, test } from '@playwright/test'

test('notifications start collapsed, count only deliveries and show message content inline', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3217'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([{ name: 'id', value: 'dashboard-render-proof-user', url: origin }, { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin }])
    await page.route('**/api/cases/HA-1?**', route => route.fulfill({ json: { case: { id: 'HA-1', title: 'HA-1 · Health', status: 'open', severity: 'high', occurrences: 2, notificationsEnabled: true, comments: [], history: [], notifications: [
        { messageId: '1234', deliveredAt: '2026-09-12T12:00:00Z', message: { content: '@everyone [HA-1](https://hanasand.com/cases/HA-1)', embeds: [{ title: 'Health check failed', description: 'The API returned HTTP 503.', fields: [{ name: 'Severity', value: 'high' }, { name: 'First seen', value: '<t:1789214400:f>' }] }] } },
        { messageId: '1235', deliveredAt: '2026-09-12T13:00:00Z' },
        { error: 'Discord temporarily unavailable.' },
    ] } } }))
    await page.route('**/api/backend/cases/**', route => route.fulfill({ json: { items: [] } }))
    await page.goto('/cases/HA-1')
    const heading = page.getByText('Notification settings (2)', { exact: true })
    await expect(heading).toBeVisible()
    await expect(page.getByLabel('Enable notifications for this case')).not.toBeVisible()
    await heading.click()
    await expect(page.getByLabel('Enable notifications for this case')).toBeChecked()
    await expect(page.getByText('The API returned HTTP 503.', { exact: true })).toBeVisible()
    await expect(page.getByText('Message ID: 1234', { exact: true })).toBeVisible()
    await expect(page.getByText('Original message content is unavailable.', { exact: true })).toBeVisible()
    await expect(page.getByText('Discord temporarily unavailable.', { exact: true })).toBeVisible()
    await expect(page.getByText('<t:1789214400:f>', { exact: true })).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '/tmp/case-notifications-mobile.png', fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await heading.click()
    await expect(page.getByText('The API returned HTTP 503.', { exact: true })).not.toBeVisible()
    await expect(heading).toBeVisible()
})
