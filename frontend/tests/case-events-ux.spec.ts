import { expect, test } from '@playwright/test'
test('technical diagnostics and three underlying events are accessible in case tabs', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3217'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([{ name: 'id', value: 'dashboard-render-proof-user', url: origin }, { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin }])
    const details = { endpoint: 'https://api.example.com/health', checkType: 'fetch', timeoutSeconds: 5, retryCount: 1, followRedirects: true }
    await page.route('**/api/cases/HA-1?**', route => route.fulfill({ json: { case: { id: 'HA-1', title: 'HA-1 · Timeout', status: 'open', severity: 'high', occurrences: 3, notificationsEnabled: true, notifications: [], comments: [], history: [], currentCheck: details, eventTotal: 3, events: [1,2,3].map(id => ({ id: `run-${id}`, startedAt: '2026-09-12T12:00:00Z', durationMs: 10000, outcome: 'failure', message: `ETIMEDOUT occurrence ${id}`, details: id === 3 ? null : details })) } } }))
    await page.route('**/api/backend/cases/**', route => route.fulfill({ json: { items: [] } }))
    await page.goto('/cases/HA-1')
    await expect(page.getByRole('tabpanel', { name: 'Details', exact: true }).getByText(details.endpoint)).toBeVisible()
    await page.getByRole('tab', { name: 'Events (3)' }).click()
    const panel = page.getByRole('tabpanel', { name: 'Events (3)' })
    await expect(panel.getByRole('listitem')).toHaveCount(3)
    await expect(panel.getByText('ETIMEDOUT occurrence 3')).toBeVisible()
    await expect(panel.getByText(/configuration was not captured/)).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await panel.scrollIntoViewIfNeeded()
    await panel.screenshot({ path: '/tmp/case-events-mobile.png' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('tab', { name: 'Events (3)' }).press('ArrowLeft')
    await expect(page.getByRole('tab', { name: 'Details', exact: true })).toHaveAttribute('aria-selected', 'true')
})
