import { expect, test, type BrowserContext } from '@playwright/test'

async function authenticate(context: BrowserContext, baseURL: string | undefined) {
    const origin = baseURL || 'http://127.0.0.1:3000'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: 'cases-overview-user', url: origin },
        { name: 'access_token', value: 'cases-overview-token', url: origin },
    ])
}

test('Cases keeps the empty state modest and workflow-free', async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL)
    let casesRequest: URL | undefined
    await page.route(url => new URL(url).pathname === '/api/cases', async route => {
        casesRequest = new URL(route.request().url())
        await route.fulfill({ json: { items: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/dwm/alerts', async route => {
        await route.fulfill({ json: { alerts: [] } })
    })

    await page.goto('/dashboard/dwm/cases?organizationId=org_acme', { waitUntil: 'domcontentloaded' })

    const overview = page.locator('[data-dwm-cases-overview="true"]')
    await expect(overview.getByRole('heading', { name: 'Cases' })).toBeVisible()
    await expect(overview.locator('[data-dwm-cases-empty="true"]')).toHaveText('No cases.')
    await expect(overview.getByText('Recent attacks', { exact: true })).toHaveCount(0)
    await expect(overview.getByText('Watchlists', { exact: true })).toHaveCount(0)
    await expect(overview.getByText('Sources', { exact: true })).toHaveCount(0)
    await expect(overview.getByText('Delivery', { exact: true })).toHaveCount(0)
    await expect(overview.locator('[data-dwm-workflow-snapshot="true"]')).toHaveCount(0)
    await expect(overview.locator('.overflow-hidden')).toHaveCount(0)
    expect(casesRequest?.searchParams.get('tenantId')).toBe('org_acme')
    expect(casesRequest?.searchParams.get('organizationId')).toBe('org_acme')
})

test('Cases renders persisted incidents with their available context', async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL)
    await page.route(url => new URL(url).pathname === '/api/cases', async route => {
        await route.fulfill({
            json: {
                items: [{
                    id: 'case_acme_lumma',
                    caseId: 'case_acme_lumma',
                    tenantId: 'org_acme',
                    organizationId: 'org_acme',
                    alertId: 'alert_acme_lumma',
                    title: 'Critical credential exposure',
                    status: 'open',
                    priority: 'critical',
                    updatedAt: '2026-07-04T10:30:00.000Z',
                }],
            },
        })
    })
    await page.route(url => new URL(url).pathname === '/api/dwm/alerts', async route => {
        await route.fulfill({
            json: {
                alerts: [{
                    id: 'alert_acme_lumma',
                    actor: 'Lumma',
                    company: 'acme.com',
                    severity: 'critical',
                    firstSeenAt: '2026-07-04T09:20:00.000Z',
                    reviewState: 'reviewing',
                }],
            },
        })
    })

    await page.goto('/dashboard/dwm/cases?organizationId=org_acme', { waitUntil: 'domcontentloaded' })

    const overview = page.locator('[data-dwm-cases-overview="true"]')
    await expect(overview.locator('[data-dwm-case-row="true"]')).toHaveCount(1)
    await expect(overview.getByRole('link', { name: 'Critical credential exposure' })).toBeVisible()
    await expect(overview.getByText('Lumma', { exact: true })).toBeVisible()
    await expect(overview.getByText('Unavailable', { exact: true })).toBeVisible()
    await expect(overview.getByText('acme.com', { exact: true })).toBeVisible()
    await expect(overview.getByText('critical', { exact: true })).toBeVisible()
    await expect(overview.getByText('open', { exact: true })).toBeVisible()
    await expect(overview.getByText('2026-07-04 09:20 UTC', { exact: true })).toBeVisible()
    await expect(overview.getByText('2026-07-04 10:30 UTC', { exact: true })).toBeVisible()
    await expect(overview.getByText('reviewing', { exact: true })).toBeVisible()
    await expect(overview.getByText('Recent attacks', { exact: true })).toHaveCount(0)
    await expect(overview.locator('[data-dwm-workflow-snapshot="true"]')).toHaveCount(0)
})
