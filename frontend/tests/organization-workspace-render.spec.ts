import { expect, test } from '@playwright/test'

test('organization workspace renders backed team, watchlist, destination, and settings controls', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await page.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
        { name: 'roles', value: JSON.stringify([{ id: 'admin' }]), url: origin },
        { name: 'id', value: 'dashboard-render-proof-user', domain: 'localhost', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: 'localhost', path: '/' },
        { name: 'roles', value: JSON.stringify([{ id: 'admin' }]), domain: 'localhost', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: '127.0.0.1', path: '/' },
        { name: 'roles', value: JSON.stringify([{ id: 'admin' }]), domain: '127.0.0.1', path: '/' },
    ])
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin })

    await page.route('**/api/organizations', async route => {
        await route.fulfill({
            json: {
                organizations: [{
                    id: 'org_enterprise',
                    name: 'Acme Threat Operations',
                    slug: 'acme-threat-ops',
                    tenantId: 'tenant_acme',
                    role: 'admin',
                    status: 'active',
                    memberCount: 3,
                    pendingInviteCount: 1,
                }],
            },
        })
    })
    await page.route('**/api/organizations/org_enterprise/settings', async route => {
        await route.fulfill({
            json: {
                settings: {
                    name: 'Acme Threat Operations',
                    slug: 'acme-threat-ops',
                    defaultWebhookPolicy: 'active_destinations',
                    alertVisibilityPolicy: 'members',
                    lifecycleStatus: 'active',
                    retentionDays: 365,
                },
            },
        })
    })
    await page.route('**/api/organizations/org_enterprise/members', async route => {
        await route.fulfill({
            json: {
                members: [
                    { userId: 'owner-1', name: 'Avery Owner', role: 'owner', status: 'active', joinedAt: '2026-07-01T10:00:00.000Z' },
                    { userId: 'analyst-1', name: 'Blair Analyst', role: 'member', status: 'active', joinedAt: '2026-07-02T10:00:00.000Z' },
                ],
            },
        })
    })
    await page.route('**/api/organizations/org_enterprise/invites', async route => {
        await route.fulfill({
            json: {
                invites: [{
                    id: 'invite-1',
                    email: 'casey@example.com',
                    role: 'member',
                    status: 'pending',
                    acceptancePath: '/organizations/invites/invite-1',
                    createdAt: '2026-07-03T10:00:00.000Z',
                    expiresAt: '2026-07-10T10:00:00.000Z',
                }],
            },
        })
    })
    await page.route('**/api/organizations/org_enterprise/watchlists', async route => {
        await route.fulfill({
            json: {
                watchlistItems: [{
                    id: 'watch_acme_domain',
                    organizationId: 'org_enterprise',
                    tenantId: 'tenant_acme',
                    kind: 'domain',
                    value: 'acme.com',
                    notes: 'Primary customer domain',
                    status: 'active',
                    createdBy: 'owner-1',
                    updatedBy: 'analyst-1',
                    alertGenerationRef: 'org_enterprise:watch_acme_domain',
                    webhookDestinationId: 'dest_discord_soc',
                    webhookUrlConfigured: true,
                    webhookEndpointHash: 'wh_abc123',
                    webhookEndpointHint: 'discord.com/api/webhooks/.../ops',
                    updatedAt: '2026-07-04T08:30:00.000Z',
                }],
            },
        })
    })
    await page.route('**/api/organizations/org_enterprise/watchlists/alert-terms', async route => {
        await route.fulfill({
            json: {
                activeTerms: [{
                    organizationId: 'org_enterprise',
                    tenantId: 'tenant_acme',
                    watchlistItemId: 'watch_acme_domain',
                    kind: 'domain',
                    term: 'acme.com',
                    status: 'active',
                    alertGenerationRef: 'org_enterprise:watch_acme_domain',
                    matchReason: 'domain watchlist match',
                }],
            },
        })
    })
    await page.route('**/api/organizations/org_enterprise/alert-case-visibility', async route => {
        await route.fulfill({ json: { visibility: { alertReadAllowed: true, caseAssignmentAllowed: true, caseRoute: '/api/cases?organizationId=org_enterprise' } } })
    })
    await page.route('**/api/organizations/org_enterprise/webhooks', async route => {
        await route.fulfill({
            json: {
                destinations: [{
                    id: 'dest_discord_soc',
                    name: 'Discord SOC',
                    status: 'active',
                    kind: 'discord',
                    endpointHash: 'wh_abc123',
                    endpointHint: 'discord.com/api/webhooks/.../ops',
                    deliveryReady: true,
                }],
            },
        })
    })
    await page.route('**/api/dwm/alerts?organizationId=org_enterprise', async route => {
        await route.fulfill({ json: { alerts: [{ id: 'alert_acme_1', title: 'Credential exposure for acme.com', severity: 'high', status: 'open', watchlistItemId: 'watch_acme_domain', updatedAt: '2026-07-04T08:45:00.000Z' }] } })
    })
    await page.route('**/api/cases?organizationId=org_enterprise', async route => {
        await route.fulfill({ json: { cases: [{ id: 'case_acme_1', title: 'Acme exposure response', status: 'triage', assignedOwner: 'analyst-1', updatedAt: '2026-07-04T08:50:00.000Z' }] } })
    })
    await page.route('**/api/dwm/webhooks/deliveries?organizationId=org_enterprise', async route => {
        await route.fulfill({
            json: {
                deliveries: [{
                    id: 'delivery_acme_1',
                    organizationId: 'org_enterprise',
                    tenantId: 'tenant_acme',
                    alertId: 'alert_acme_1',
                    caseId: 'case_acme_1',
                    watchlistId: 'watch_acme_domain',
                    watchlistItemId: 'watch_acme_domain',
                    webhookDestinationId: 'dest_discord_soc',
                    endpointHash: 'wh_abc123',
                    endpointHint: 'discord.com/api/webhooks/.../ops',
                    deliveryKind: 'discord',
                    status: 'delivered',
                    dryRun: true,
                    attemptedAt: '2026-07-04T09:00:00.000Z',
                    requestId: 'req_acme_1',
                    responseSummary: 'Dry-run delivery accepted.',
                }],
            },
        })
    })

    await page.goto('/organizations?focus=destinations', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Organization settings' })).toBeVisible()
    await expect(page.getByText('Acme Threat Operations')).toBeVisible()
    await expect(page.getByText('Workspace launch path')).toBeVisible()
    await expect(page.getByText('casey@example.com')).toBeVisible()
    await expect(page.getByText('acme.com').first()).toBeVisible()
    await expect(page.locator('#delivery-history').getByText('Dry-run delivery accepted.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Case case_acme_1' })).toBeVisible()

    const members = page.locator('[data-org-members-disclosure]')
    await members.getByRole('heading', { name: 'Members' }).click()
    await expect(members.getByText('Blair Analyst')).toBeVisible()

    const destinations = page.locator('[data-org-destinations-disclosure]')
    await destinations.getByRole('heading', { name: 'Saved destinations' }).click()
    await expect(destinations.getByText('Discord SOC')).toBeVisible()

    await page.getByRole('button', { name: 'Copy Alert terms route' }).click()
    await expect(page.getByText('Route copied.')).toBeVisible()

    await page.getByText('Advanced organization settings').click()
    await page.getByLabel('Slug').fill('Bad Slug')
    await expect(page.getByText('Use lowercase letters, numbers, and hyphens for slug.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save settings' })).toBeDisabled()
})
