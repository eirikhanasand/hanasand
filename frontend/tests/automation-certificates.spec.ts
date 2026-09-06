import { expect, test } from '@playwright/test'

test('certificate states are explicit and neutral details open by click and keyboard', async ({ context, page, baseURL }) => {
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    for (const [name, value] of Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: encodeURIComponent(JSON.stringify(['system_admin'])) })) {
        await context.addCookies([{ name, value, url: baseURL! }])
    }
    const base = { ownerId: 'owner', prompt: 'Check connectivity', status: 'active', actionType: 'agent_prompt', monitoringType: 'tcp', scheduleKind: 'interval', intervalMinutes: 1, lastStatus: 'completed', consecutiveFailures: 0, notifyOn: 'never', history: [], uptime: 100, certificateSubject: null, certificateIssuer: null, certificateExpiresAt: null }
    const rows = [
        { ...base, id: 'web', name: 'Website TLS', caseNumbers: ['MON-12'], targetUrl: 'example.test:443', certificateStatus: 'valid' },
        { ...base, id: 'ssh', name: 'Git SSH', targetUrl: 'example.test:22', certificateStatus: 'not_applicable' },
        { ...base, id: 'pending', name: 'New HTTPS check', monitoringType: 'fetch', targetUrl: 'https://example.test', certificateStatus: null },
    ]
    await page.route('**/api/backend/automations**', async route => {
        const id = new URL(route.request().url()).pathname.split('/').at(-1)
        await route.fulfill({ json: id === 'automations' ? { automations: rows } : { automation: rows.find(row => row.id === id) || rows[0], runs: [], total: 0, nextCursor: null, issues: [{ id: '12', caseNumber: 'MON-12', kind: 'failure', summary: 'TLS certificate validation failed.', occurrences: 120, firstSeenAt: '2026-09-01T12:00:00Z', lastSeenAt: '2026-09-05T12:00:00Z', resolvedAt: null, notifications: [] }] } })
    })
    await page.goto('/dashboard/automation/health')
    const retry = page.getByRole('button', { name: 'Try again' })
    if (await retry.isVisible()) await retry.click()
    await expect(page.getByRole('button', { name: 'Certificate: Valid — Website TLS' }).first()).toBeVisible({ timeout: 25000 })
    const notNeeded = page.getByRole('button', { name: 'Certificate: N/A — Git SSH' })
    await expect(notNeeded).toHaveClass(/text-ui-muted/)
    await expect(notNeeded.locator('.lucide-info')).toBeVisible()
    await expect(notNeeded.locator('.lucide-shield-x')).toHaveCount(0)
    await notNeeded.click()
    await expect(page.getByText('This check tests SSH connectivity.', { exact: false })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('This check tests SSH connectivity.', { exact: false })).toBeHidden()
    await notNeeded.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('This check tests SSH connectivity.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true }).click()
    await expect(page.getByRole('button', { name: 'Certificate: Pending — New HTTPS check' })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Find a case or monitor' }).fill('MON-12')
    await expect(page.getByRole('button', { name: 'Git SSH', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Website TLS', exact: true }).click()
    await expect(page.getByText('MON-12', { exact: true })).toBeVisible()
    await page.getByText('MON-12', { exact: true }).click()
    await expect(page.getByText('TLS certificate validation failed.', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Health checks', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Collapse check details' }).click()
    await expect(page.locator('#health-check-details')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Expand check details' })).toHaveAttribute('aria-expanded', 'false')
    await page.getByRole('button', { name: 'Expand check details' }).click()
    await expect(page.locator('#health-check-details')).toBeVisible()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('json')
    await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('host')
    await page.getByLabel('JSON field', { exact: true }).fill('host.storage.*.usedPercent')
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    const saved = page.waitForRequest(request => request.method() === 'PUT' && request.url().includes('/automations/web'))
    await page.getByRole('button', { name: 'Save changes' }).click()
    expect((await saved).postDataJSON()).toMatchObject({ targetUrl: 'system:metrics', monitoringType: 'json', jsonRule: { path: 'host.storage.*.usedPercent', value: 80, operator: 'gt', aggregate: 'max' } })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
