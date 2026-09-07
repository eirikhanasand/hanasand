import { expect, test } from '@playwright/test'

test('health columns toggle both directions, preserve alphabetical ties and work on mobile', async ({ context, page, baseURL }) => {
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: encodeURIComponent(JSON.stringify(['system_admin'])) }).map(([name, value]) => ({ name, value, url: baseURL! })))
    const base = { ownerId: 'owner', prompt: 'Check availability', status: 'active', actionType: 'agent_prompt', monitoringType: 'fetch', targetUrl: 'https://example.test', scheduleKind: 'interval', intervalMinutes: 1, lastStatus: 'completed', consecutiveFailures: 0, notifyOn: 'never', history: [{ id: 'run', status: 'completed', warning: false, started_at: '2026-09-07T10:00:00Z' }], uptime: 100, certificateStatus: 'invalid' }
    const rows = [{ ...base, id: 'zulu', name: 'Zulu', lastStatus: 'failed', certificateStatus: 'valid', uptime: 90, history: [{ ...base.history[0], status: 'failed' }] }, { ...base, id: 'beta', name: 'Beta' }, { ...base, id: 'alpha', name: 'Alpha' }]
    await page.route('**/api/backend/automations**', route => {
        const id = new URL(route.request().url()).pathname.split('/').at(-1)
        return route.fulfill({ json: id === 'automations' ? { automations: rows } : { automation: rows.find(row => row.id === id) || rows[0], runs: [], issues: [], total: 0, nextCursor: null } })
    })
    await page.goto('/dashboard/automation/health')
    const retry = page.getByRole('button', { name: 'Try again' })
    if (await retry.isVisible()) await retry.click()
    const names = page.locator('[data-health-check] > span:first-of-type')
    await expect(names).toHaveText(['Alpha', 'Beta', 'Zulu'])
    await expect(page.locator('[data-health-check="zulu"]')).toContainText('Unhealthy')
    await expect(page.locator('[data-health-check]')).not.toContainText(['Monitoring', 'Monitoring', 'Monitoring'])
    await page.getByRole('button', { name: 'Sort by Name', exact: true }).click()
    await expect(names).toHaveText(['Zulu', 'Beta', 'Alpha'])
    await page.getByRole('button', { name: 'Sort by Name', exact: true }).click()
    await expect(names).toHaveText(['Alpha', 'Beta', 'Zulu'])
    for (const label of ['Status', 'Cert', 'History']) {
        const button = page.getByRole('button', { name: `Sort by ${label}`, exact: true })
        await button.click()
        await expect(names).toHaveText(['Alpha', 'Beta', 'Zulu'])
        await button.click()
        await expect(names).toHaveText(['Zulu', 'Alpha', 'Beta'])
    }
    await page.getByRole('button', { name: 'Sort by Uptime', exact: true }).click()
    await expect(names).toHaveText(['Zulu', 'Alpha', 'Beta'])
    await page.keyboard.press('Enter')
    await expect(names).toHaveText(['Alpha', 'Beta', 'Zulu'])
    await page.getByRole('button', { name: 'Sort by Tags', exact: true }).click()
    await expect(names).toHaveText(['Alpha', 'Beta', 'Zulu'])
    await page.getByRole('button', { name: 'Sort by Tags', exact: true }).click()
    await expect(names).toHaveText(['Alpha', 'Beta', 'Zulu'])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Sort by Status', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Sorted by status' })).toHaveText('Sorted by status, ascending.')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
