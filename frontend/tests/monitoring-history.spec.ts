import { expect, test } from '@playwright/test'

test('monitoring shows real totals, loads older checks and preserves them on refresh', async({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3204'
    test.skip(!['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Local check only')
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), url: origin },
    ])
    const runs = Array.from({ length: 125 }, (_, i) => ({ id: `run-${i}`, automationId: 'a', status: 'completed', warning: false, result: `Check ${i}`, startedAt: new Date(Date.UTC(2026, 0, 1, 12, 0, 0) - i * 60000).toISOString() }))
    const automation = { id: 'a', name: 'Git', prompt: 'Check Git availability', status: 'active', actionType: 'agent_prompt', targetUrl: 'https://git.hanasand.com', monitoringType: 'fetch', intervalMinutes: 1, lastStatus: 'completed', runCount: 125, uptime: 99.2, notificationDestinations: [], history: [
        { id: 'old', started_at: runs[1].startedAt, status: 'failed', warning: false },
        { id: 'new', started_at: runs[0].startedAt, status: 'completed', warning: false },
    ] }
    await page.route('**/api/backend/automations**', async route => {
        const url = new URL(route.request().url())
        if (url.pathname.endsWith('/automations')) return route.fulfill({ json: { automations: [automation] } })
        const offset = Number(url.searchParams.get('cursor') || 0)
        const filtered = url.searchParams.has('from') ? runs.slice(0, 2) : runs
        await route.fulfill({ json: { automation, runs: filtered.slice(offset, offset + 50), total: filtered.length, nextCursor: offset + 50 < filtered.length ? String(offset + 50) : null } })
    })
    await page.goto('/automation/monitoring')
    await expect(page.getByText('(50/125)')).toBeVisible()
    await expect(page.getByText('99.2%')).toBeVisible()
    await expect(page.locator('[title$=": failed"]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Load more checks' }).scrollIntoViewIfNeeded()
    await expect(page.getByText('(100/125)')).toBeVisible()
    await page.getByRole('button', { name: 'Load more checks' }).scrollIntoViewIfNeeded()
    await expect(page.getByText('(125/125)')).toBeVisible()
    await page.getByRole('button', { name: 'Refresh checks' }).click()
    await expect(page.getByText('(125/125)')).toBeVisible()
    await expect(page.getByText('Check 124', { exact: true })).toHaveCount(1)
    await page.getByRole('button', { name: 'Filter checks by time' }).click()
    await page.getByLabel('From', { exact: true }).fill('2026-01-01T11:59')
    await expect(page.getByText('(2/2)')).toBeVisible()
})
