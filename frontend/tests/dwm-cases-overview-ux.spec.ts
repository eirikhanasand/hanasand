import { expect, test, type BrowserContext } from '@playwright/test'

async function authenticate(context: BrowserContext, baseURL: string | undefined) {
    const origin = baseURL || 'http://127.0.0.1:3000'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
    ])
}

test('shared cases preserves scope and has a product-independent empty state', async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL)
    let casesRequest: URL | undefined
    const dwmRequests: string[] = []
    page.on('request', request => { if (request.url().includes('/api/dwm/')) dwmRequests.push(request.url()) })
    await page.route('**/api/cases?**', async route => {
        casesRequest = new URL(route.request().url())
        await route.fulfill({ json: { items: [] } })
    })
    await page.goto('/dwm/cases?organizationId=org_acme')
    await expect(page).toHaveURL(/\/cases\?organizationId=org_acme$/)
    await expect(page.getByRole('heading', { name: 'Cases', exact: true })).toBeVisible()
    await expect(page.getByText('No cases yet.', { exact: true })).toBeVisible()
    expect(casesRequest?.searchParams.get('organizationId')).toBe('org_acme')
    expect(dwmRequests).toEqual([])
})

test('monitoring and unrelated cases share the list, links, search and pagination', async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL)
    const monitor = { id: 'MON-3', title: 'MON-3 · Inference health', summary: 'FETCH check failed: HTTP 503.', source: 'monitoring', status: 'open', severity: 'high', occurrences: 53, automationId: 'inference', notifications: [], createdAt: '2026-09-07T09:00:00Z', updatedAt: '2026-09-07T09:20:00Z' }
    await page.route('**/api/cases?**', async route => {
        const later = new URL(route.request().url()).searchParams.has('cursor')
        await route.fulfill({ json: { items: later ? [{ id: 'manual-2', title: 'Unrelated service review', status: 'closed' }] : [monitor, { id: 'case-1', title: 'Credential exposure', actor: 'Lumma', company: 'acme.com', status: 'open', organizationId: 'org_acme' }], nextCursor: later ? null : 'next', warnings: ['One source is temporarily unavailable.'] } })
    })
    await page.route('**/api/cases/MON-3?**', route => route.fulfill({ json: { case: monitor } }))
    await page.goto('/cases')
    await expect(page.getByRole('link', { name: 'Credential exposure', exact: true })).toHaveAttribute('href', '/cases/case-1?organizationId=org_acme')
    await expect(page.getByText('Lumma', { exact: true })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'temporarily unavailable' })).toContainText('temporarily unavailable')
    await page.getByRole('button', { name: 'Load more cases' }).click()
    await expect(page.getByRole('link', { name: 'Unrelated service review' })).toBeVisible()
    await page.getByLabel('Search cases', { exact: true }).fill('MON-3')
    await expect(page.getByRole('link', { name: 'Credential exposure' })).toHaveCount(0)
    await page.getByRole('link', { name: 'MON-3 · Inference health' }).click()
    await expect(page).toHaveURL(/\/cases\/MON-3$/)
    await expect(page.getByRole('heading', { name: 'MON-3 · Inference health' })).toBeVisible()
    await expect(page.getByText('FETCH check failed: HTTP 503.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View health check' })).toHaveAttribute('href', '/automation/health?monitor=inference')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'MON-3 · Inference health' })).toBeVisible()
    await page.screenshot({ path: '/tmp/shared-case-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('a MON reference in Recent checks opens the shared case', async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL)
    await context.addCookies([{ name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), url: baseURL! }])
    const automation = { id: 'inference', name: 'Inference health', ownerId: 'owner', status: 'active', actionType: 'agent_prompt', monitoringType: 'fetch', scheduleKind: 'interval', intervalMinutes: 1, targetUrl: 'https://example.test/health', history: [], caseNumbers: ['MON-3'], uptime: 0 }
    await page.route('**/api/backend/automations**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/automations') ? { automations: [automation] } : { automation, runs: [{ id: 'run-1', caseNumber: 'MON-3', status: 'failed', startedAt: '2026-09-07T09:20:00Z', error: 'HTTP 503' }], issues: [], total: 1, nextCursor: null } }))
    await page.route('**/api/cases/MON-3?**', route => route.fulfill({ json: { case: { id: 'MON-3', title: 'MON-3 · Inference health', summary: 'HTTP 503', status: 'open', occurrences: 1, automationId: 'inference', notifications: [] } } }))
    await page.goto('/automation/health')
    const retry = page.getByRole('button', { name: 'Try again' })
    if (await retry.isVisible()) await retry.click()
    const reference = page.getByRole('link', { name: 'MON-3', exact: true })
    await expect(reference).toBeVisible({ timeout: 25000 })
    await expect(reference).toHaveAttribute('href', '/cases/MON-3')
    await reference.click()
    await expect(page.getByRole('heading', { name: 'MON-3 · Inference health' })).toBeVisible()
})
