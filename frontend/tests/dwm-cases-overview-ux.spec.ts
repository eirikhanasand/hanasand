import type { MonitoringCase } from '../src/app/dashboard/cases/monitoring-case-detail'
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
    const monitor = { id: 'HA-3', title: 'HA-3 · Inference health', summary: 'FETCH check failed: HTTP 503.', source: 'monitoring', status: 'open', severity: 'high', occurrences: 53, automationId: 'inference', notifications: [], createdAt: '2026-09-07T09:00:00Z', updatedAt: '2026-09-07T09:20:00Z' }
    await page.route('**/api/cases?**', async route => {
        const later = new URL(route.request().url()).searchParams.has('cursor')
        await route.fulfill({ json: { items: later ? [{ id: 'manual-2', title: 'Unrelated service review', status: 'closed' }] : [monitor, { id: 'case-1', title: 'Credential exposure', actor: 'Lumma', company: 'acme.com', status: 'open', organizationId: 'org_acme' }], nextCursor: later ? null : 'next', warnings: ['One source is temporarily unavailable.'] } })
    })
    await page.route('**/api/cases/HA-3?**', route => route.fulfill({ json: { case: monitor } }))
    await page.goto('/cases')
    await expect(page.getByRole('link', { name: 'Credential exposure', exact: true })).toHaveAttribute('href', '/cases/case-1?organizationId=org_acme')
    await expect(page.getByText('Lumma', { exact: true })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'temporarily unavailable' })).toContainText('temporarily unavailable')
    await page.getByRole('button', { name: 'Load more cases' }).click()
    await expect(page.getByRole('link', { name: 'Unrelated service review' })).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('all')
    await expect(page.getByRole('link', { name: 'Unrelated service review' })).toBeVisible()
    await page.getByLabel('Search cases', { exact: true }).fill('HA-3')
    await expect(page.getByRole('link', { name: 'Credential exposure' })).toHaveCount(0)
    await page.getByRole('link', { name: 'HA-3 · Inference health' }).click()
    await expect(page).toHaveURL(/\/cases\/HA-3$/)
    await expect(page.getByRole('heading', { name: 'HA-3 · Inference health' })).toBeVisible()
    await expect(page.getByText('FETCH check failed: HTTP 503.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View health check' })).toHaveAttribute('href', '/automation/health?monitor=inference')
    await page.goto('/cases/MON-3')
    await expect(page).toHaveURL(/\/cases\/HA-3$/)
    await expect(page.getByRole('heading', { name: 'HA-3 · Inference health' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'HA-3 · Inference health' })).toBeVisible()
    await page.screenshot({ path: '/tmp/shared-case-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('a MON reference in Recent checks opens the shared case', async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL)
    await context.addCookies([{ name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), url: baseURL! }])
    const automation = { id: 'inference', name: 'Inference health', ownerId: 'owner', status: 'active', actionType: 'agent_prompt', monitoringType: 'fetch', scheduleKind: 'interval', intervalMinutes: 1, targetUrl: 'https://example.test/health', history: [], caseNumbers: ['HA-3'], uptime: 0 }
    await page.route('**/api/backend/automations**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/automations') ? { automations: [automation] } : { automation, runs: [{ id: 'run-1', caseNumber: 'HA-3', status: 'failed', startedAt: '2026-09-07T09:20:00Z', error: 'HTTP 503' }], issues: [], total: 1, nextCursor: null } }))
    await page.route('**/api/cases/HA-3?**', route => route.fulfill({ json: { case: { id: 'HA-3', title: 'HA-3 · Inference health', summary: 'HTTP 503', status: 'open', occurrences: 1, automationId: 'inference', notifications: [] } } }))
    await page.goto('/automation/health')
    const retry = page.getByRole('button', { name: 'Try again' })
    if (await retry.isVisible()) await retry.click()
    const reference = page.getByRole('link', { name: 'HA-3', exact: true })
    await expect(reference).toBeVisible({ timeout: 25000 })
    await expect(reference).toHaveAttribute('href', '/cases/HA-3')
    await reference.click()
    await expect(page.getByRole('heading', { name: 'HA-3 · Inference health' })).toBeVisible()
})

test('case filters hide resolved cases by default and reveal AI resolutions needing human review', async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL)
    const items = [
        { id: 'HA-1', title: 'Active high monitor', status: 'open', severity: 'high', source: 'monitoring', assignedOwner: 'alice' },
        { id: 'HA-2', title: 'AI resolved monitor', status: 'resolved', severity: 'low', source: 'monitoring', assignedOwner: 'bob', resolution: { id: 'r1', type: 'ai', actor: 'agent', at: '2026-09-12T10:00:00Z' } },
        { id: 'HA-3', title: 'Confirmed AI monitor', status: 'closed', severity: 'critical', source: 'monitoring', resolution: { id: 'r2', type: 'ai', confirmedAt: '2026-09-12T11:00:00Z' } },
    ]
    await page.route('**/api/cases?**', route => route.fulfill({ json: { items } }))
    await page.goto('/cases')
    await expect(page.getByRole('link', { name: 'Active high monitor' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'AI resolved monitor', exact: true })).toHaveCount(0)
    await page.getByLabel('Resolved by', { exact: true }).selectOption('ai')
    await page.getByLabel('Human review', { exact: true }).selectOption('pending')
    await expect(page.getByRole('link', { name: 'AI resolved monitor', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Confirmed AI monitor', exact: true })).toHaveCount(0)
    await page.getByLabel('Severity', { exact: true }).selectOption('critical')
    await expect(page.getByText('No cases match the current filters.')).toBeVisible()
    await page.getByRole('button', { name: 'Reset filters' }).click()
    await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('active')
    await expect(page.getByRole('button', { name: 'Refresh cases', exact: true })).toBeVisible()
    await page.screenshot({ path: '/tmp/case-filters-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('resolution requires a comment, records AI provenance and confirms the exact resolution', async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL)
    const item: MonitoringCase = { id: 'HA-1', title: 'Resolution test', summary: 'Service check failed', status: 'in_progress', severity: 'high', occurrences: 1, automationId: 'health', notificationsEnabled: true, notifications: [], comments: [], history: [{ id: 'progress', at: '2026-09-12T09:00:00Z', actor: 'alice', action: 'status_changed', fromStatus: 'open', toStatus: 'in_progress' }] }
    const patches: Array<Record<string, unknown>> = []
    await page.route('**/api/cases/HA-1?**', async route => {
        if (route.request().method() === 'PATCH') {
            const body = route.request().postDataJSON()
            patches.push(body)
            if (body.status === 'resolved') { item.status = 'resolved'; item.resolution = { id: 'resolution-1', type: body.resolutionMethod, actor: 'alice', note: body.comment, at: '2026-09-12T10:00:00Z' } }
            if (body.confirmResolutionId) item.resolution = { ...item.resolution!, confirmedBy: 'bob', confirmedAt: '2026-09-12T11:00:00Z' }
            return route.fulfill({ json: { ok: true } })
        }
        return route.fulfill({ json: { case: item } })
    })
    await page.goto('/cases/HA-1')
    await expect(page.getByRole('heading', { name: 'Case history' })).toBeVisible()
    await expect(page.getByText(/status changed · alice/)).toBeVisible()
    await page.getByRole('button', { name: 'Resolve case', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Resolve with comment' })).toBeDisabled()
    await page.getByLabel('Resolution comment (required)', { exact: true }).fill('AI fixed the dependency; the check now passes.')
    await page.getByLabel('Resolved by AI — requires human confirmation').check()
    await page.getByRole('button', { name: 'Resolve with comment' }).click()
    await expect(page.getByRole('button', { name: 'Confirm resolution', exact: true })).toBeVisible()
    expect(patches[0]).toEqual({ status: 'resolved', comment: 'AI fixed the dependency; the check now passes.', resolutionMethod: 'ai' })
    await page.reload()
    await page.getByRole('button', { name: 'Confirm resolution', exact: true }).click()
    expect(patches.at(-1)).toEqual({ confirmResolutionId: 'resolution-1' })
    await expect(page.getByText(/Confirmed by bob/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm resolution', exact: true })).toHaveCount(0)
    await page.screenshot({ path: '/tmp/case-history-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
