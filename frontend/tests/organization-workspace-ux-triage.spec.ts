import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('organization workspace keeps launch workflow primary and admin controls disclosed', async () => {
    const page = await readFile(path.join(root, 'src/app/organizations/organizationWorkspaceClient.tsx'), 'utf8')

    expect(page).toContain('data-org-setup-progress')
    expect(page).toContain('data-org-watchlist-starter')
    expect(page).toContain('data-org-watchlist-suggestion=\'true\'')
    expect(page).toContain('starterWatchlistSuggestions(selectedOrganization, bundle.watchlists)')
    expect(page).toContain('setDraft({ kind: suggestion.kind, value: suggestion.value, notes: suggestion.notes })')
    expect(page).toContain('firstDomainCandidate')
    expect(page).toContain('data-org-health-strip')
    expect(page).toContain('Workspace health')
    expect(page).toContain('data-org-create-compact')
    expect(page).toContain('data-org-create-primary')
    expect(page).toContain('data-org-create-first-watchlist')
    expect(page).toContain('Organization and first shared term created.')
    expect(page).toContain('/api/organizations/${encodeURIComponent(organizationId)}/watchlists')
    expect(page).toContain('Initial shared watchlist term added from organization setup.')
    expect(page).toContain('{organizations.length === 0 && createOrganizationPanel}')
    expect(page).toContain('{organizations.length > 0 && createOrganizationPanel}')
    expect(page.indexOf('<h2 className=\'px-2 py-2 text-sm font-semibold text-ui-text dark:text-ui-text\'>Workspaces</h2>')).toBeLessThan(page.indexOf('{organizations.length > 0 && createOrganizationPanel}'))
    expect(page).toContain('Notification setup')
    expect(page).toContain('Shared watchlists')
    expect(page).toContain('Test destination')
    expect(page).toContain('data-org-empty-focused-create')
    expect(page).toContain('Set up customer monitoring')
    expect(page).toContain('Create an organization, seed the first watchlist term')
    expect(page).not.toContain('Create org first')
    expect(page).not.toContain('Waiting for org')
    expect(page).not.toContain('No events')
    expect(page).not.toContain('border-dashed border-ui-border bg-ui-panel p-4 shadow-sm')
    expect(page).toContain('data-org-watchlist-filter-strip')
    expect(page).toContain('data-org-watchlist-filter-count')
    expect(page).toContain('data-org-watchlist-filter-empty')
    expect(page).toContain('const [watchlistQuery, setWatchlistQuery] = useState(\'\')')
    expect(page).toContain('const [watchlistStatusFilter, setWatchlistStatusFilter] = useState(\'all\')')
    expect(page).toContain('const visibleWatchlists = watchlists.filter')
    expect(page).toContain('const filtersActive = Boolean(watchlistQuery.trim()) || watchlistStatusFilter !== \'all\'')
    expect(page).toContain('watchlistSearchText(item, organization).includes(normalizedWatchlistQuery)')
    expect(page).toContain('options={[\'all\', \'active\', \'paused\', \'archived\']}')
    expect(page).toContain('No watchlist terms match this view.')
    expect(page).toContain('function watchlistSearchText')
    expect(page).toContain('item.alertGenerationRef')
    expect(page).toContain('item.webhookEndpointHash')
    expect(page).toContain('data-org-delivery-payload-preview')
    expect(page).toContain('payloadPreviewForDelivery(delivery)')
    expect(page).toContain('payloadPreviewFromRecord(delivery.sanitizedPayloadPreview)')
    expect(page).toContain('/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists')
    expect(page).toContain('/api/dwm/webhooks/deliver')

    expect(page).toContain('data-org-settings-disclosure')
    expect(page).toContain('Advanced organization settings')
    expect(page).toContain('data-org-members-disclosure')
    expect(page).toContain('data-org-member-mobile-list=\'true\'')
    expect(page).toContain('data-org-member-mobile-row=\'true\'')
    expect(page).toContain('data-org-member-desktop-table=\'true\'')
    expect(page).toContain('data-org-destinations-disclosure')
    expect(page).toContain('Saved destinations')

    expect(page.indexOf('<WatchlistPanel')).toBeLessThan(page.indexOf('<SettingsPanel'))
    expect(page.indexOf('data-org-settings-disclosure')).toBeLessThan(page.indexOf('Save settings'))
    expect(page.indexOf('data-org-members-disclosure')).toBeLessThan(page.indexOf('Remove member'))
    expect(page.indexOf('data-org-destinations-disclosure')).toBeLessThan(page.indexOf('Remove destination'))

    expect(page).toContain('onRoleChange={(member, role) => void changeMemberRole(member, role)}')
    expect(page).toContain('onTest={destination => void testSavedDestination(destination)}')
    expect(page).toContain('onDelete={destination => void deleteSavedDestination(destination)}')
    expect(page).toContain('admin controls enabled')
    expect(page).toContain('read-only access')
    expect(page).toContain('return <span className={classes} aria-disabled=\'true\'>{icon}{label}</span>')
    expect(page).toContain('? <span key={row.id} className={rowClass} aria-disabled=\'true\'>{content}</span>')
    expect(page).toContain('role={tone === \'error\' ? \'alert\' : \'status\'}')
    expect(page).toContain('role={message.ok ? \'status\' : \'alert\'}')
    expect(page).toContain('role=\'status\' aria-live=\'polite\'')
    expect(page).toContain('aria-pressed={confirming}')
    expect(page).toContain('data-org-confirm-action={confirming ? \'confirming\' : \'idle\'}')
    expect(page).toContain('if (event.key === \'Escape\')')
    expect(page).toContain('aria-pressed={selected}')
    expect(page).toContain('role=\'button\'')
    expect(page).toContain('tabIndex={0}')
    expect(page).toContain('event.preventDefault()')
    expect(page).toContain('onSelectSubject({ type: \'watchlist\', id: item.id })')
    expect(page).toContain('function stopRowSelectionKeys')
    expect(page).toContain('onKeyDown={stopRowSelectionKeys}')
    expect(page).toContain('event.stopPropagation()')
    expect(page).toContain('onSelectSubject={selectActivitySubject}')
    expect(page).toContain('replaceOrganizationWorkspaceSelectionUrl')
    expect(page).toContain('requestedInviteId')
    expect(page).toContain('requestedMemberId')
    expect(page).toContain('data-org-invite-conflicts=\'true\'')
    expect(page).toContain('inviteEmailConflicts(parsedEmails, invites, members)')
    expect(page).toContain('inviteEmailConflicts(emails, bundle.invites, bundle.members)')
    expect(page).toContain('member.userId.toLowerCase()')
    expect(page).toContain('member.email && member.email !== member.userId ? member.email : member.userId')
    expect(page).toContain('member.name || member.email || member.userId')
    expect(page).toContain('activeMemberEmailIds')
    expect(page).toContain('Already in this workspace:')
    expect(page).toContain('input.focus === \'invites\'')
    expect(page).toContain('input.focus === \'members\'')
    expect(page).toContain('data-org-activity-row=\'true\'')
    expect(page).toContain('activitySubjectFromItem(item, organization.id)')
    expect(page).toContain('onClick={() => itemSubject && onSelectSubject(itemSubject)}')
    expect(page).toContain('data-org-activity-context-action=\'true\'')
    expect(page).toContain('selectedSubjectActions(selectedSubject, organization)')
    expect(page).toContain('Audit trail')
    expect(page).toContain('Delivery activity')
    expect(page).toContain('href: \'#delivery-history\'')
    expect(page).toContain('/dashboard/ti/workbench?organizationId=${organizationId}&watchlistId=${watchlistId}')
    expect(page).toContain('/dashboard/dwm/cases/${caseId}?organizationId=${organizationId}')
    expect(page).not.toContain('Org API')
    expect(page).not.toContain('Invite API')
    expect(page).not.toContain('Member API')
    expect(page).not.toContain('Cases API')
    expect(page).toContain('Open delivery log')
    expect(page).toContain('data-org-delivery-payload-preview=\'true\'')
    expect(page).toContain('function DeliveryPayloadPreview')
    expect(page).toContain('payloadPreviewForDelivery')
    expect(page).toContain('payloadPreviewFromPayload')
    expect(page).toContain('webhookDestinationId: row.webhookDestinationId || row.destinationId')
    expect(page).toContain('organizationId: row.organizationId || row.orgId')
    expect(page).toContain('httpStatus: row.httpStatus ?? row.responseStatus')
    expect(page).not.toContain('Open API')
    expect(page).not.toContain('/api/organizations/${organizationId}/watchlists/alert-terms?watchlistId=${watchlistId}')
    expect(page).not.toContain('/api/dwm/webhooks/deliveries?organizationId=${organizationId}&destinationId=${destinationId}')

    expect(page).toContain('bg-ui-text px-4 text-sm font-semibold text-ui-canvas')
    expect(page).not.toContain('dark:text-white')
    expect(page).not.toContain('text-white transition')
})

test('organization workspace renders searchable shared watchlists', async ({ context, page, baseURL }, testInfo) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
        { name: 'id', value: 'dashboard-render-proof-user', domain: 'localhost', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: 'localhost', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: '127.0.0.1', path: '/' },
    ])

    await page.route('**/api/organizations', async route => {
        await route.fulfill({ json: { organizations: [fixtureOrganization] } })
    })
    await page.route('**/api/organizations/org_acme/settings', async route => {
        await route.fulfill({ json: { settings: { name: 'Acme Security', slug: 'acme-security', defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 365 } } })
    })
    await page.route('**/api/organizations/org_acme/members', async route => {
        await route.fulfill({ json: { members: fixtureMembers } })
    })
    await page.route('**/api/organizations/org_acme/invites', async route => {
        await route.fulfill({ json: { invites: fixtureInvites } })
    })
    await page.route('**/api/organizations/org_acme/watchlists', async route => {
        await route.fulfill({ json: { watchlistItems: fixtureWatchlists } })
    })
    await page.route('**/api/organizations/org_acme/watchlists/alert-terms', async route => {
        await route.fulfill({ json: { activeTerms: fixtureWatchlists.filter(item => item.status === 'active').map(item => ({ watchlistItemId: item.id, term: item.value, value: item.value, status: item.status, alertGenerationRef: item.alertGenerationRef })) } })
    })
    await page.route('**/api/organizations/org_acme/alert-case-visibility', async route => {
        await route.fulfill({ json: { visibility: { alertReadAllowed: true, caseAssignmentAllowed: true, caseRoute: '/api/cases' } } })
    })
    await page.route('**/api/organizations/org_acme/webhooks', async route => {
        await route.fulfill({ json: { destinations: fixtureDestinations } })
    })
    await page.route('**/api/dwm/alerts?organizationId=org_acme', async route => {
        await route.fulfill({ json: { alerts: fixtureAlerts } })
    })
    await page.route('**/api/cases?organizationId=org_acme', async route => {
        await route.fulfill({ json: { cases: fixtureCases } })
    })
    await page.route('**/api/dwm/webhooks/deliveries?organizationId=org_acme', async route => {
        await route.fulfill({ json: { deliveries: fixtureDeliveries } })
    })

    await page.goto('/organizations?organizationId=org_acme&focus=watchlists', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Organization settings', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Acme Security owner/ })).toBeVisible()
    await expect(page.locator('[data-org-watchlist-filter-strip="true"]')).toBeVisible()
    await expect(page.locator('[data-org-watchlist-filter-count="true"]')).toContainText('3/3 shown')
    const acmeRow = page.locator('#watchlists').getByRole('button', { name: /domain active acme\.com/ })
    const oktaRow = page.locator('#watchlists').getByRole('button', { name: /vendor paused Okta/ })
    const retiredVendorRow = page.locator('#watchlists').getByRole('button', { name: /vendor archived RetiredVendor/ })
    await expect(acmeRow).toBeVisible()
    await expect(oktaRow).toBeVisible()

    await page.getByLabel('Search terms').fill('okta')
    await expect(page.locator('[data-org-watchlist-filter-count="true"]')).toContainText('1/3 shown')
    await expect(oktaRow).toBeVisible()
    await expect(acmeRow).toBeHidden()

    await page.getByRole('button', { name: 'Clear' }).click()
    await page.locator('[data-org-watchlist-filter-strip="true"]').getByLabel('Status').selectOption('archived')
    await expect(page.locator('[data-org-watchlist-filter-count="true"]')).toContainText('1/3 shown')
    await expect(retiredVendorRow).toBeVisible()
    await expect(oktaRow).toBeHidden()

    await testInfo.attach('organizations-watchlist-filter-desktop', {
        body: await page.screenshot({ path: '/tmp/organizations-watchlist-filter-desktop.png', fullPage: true }),
        contentType: 'image/png',
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('[data-org-watchlist-filter-strip="true"]')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await testInfo.attach('organizations-watchlist-filter-mobile', {
        body: await page.screenshot({ path: '/tmp/organizations-watchlist-filter-mobile.png', fullPage: true }),
        contentType: 'image/png',
    })
})

const fixtureOrganization = {
    id: 'org_acme',
    slug: 'acme-security',
    name: 'Acme Security',
    tenantId: 'tenant_acme',
    role: 'owner',
    status: 'active',
    memberCount: 2,
}

const fixtureMembers = [
    { userId: 'owner_acme', email: 'owner@acme.test', name: 'Acme Owner', role: 'owner', status: 'active', joinedAt: '2026-07-01T10:00:00.000Z' },
    { userId: 'analyst_acme', email: 'analyst@acme.test', name: 'Acme Analyst', role: 'member', status: 'active', joinedAt: '2026-07-02T10:00:00.000Z' },
]

const fixtureInvites = [
    { id: 'invite_acme_admin', email: 'admin@acme.test', role: 'admin', status: 'pending', createdAt: '2026-07-03T10:00:00.000Z', expiresAt: '2026-07-10T10:00:00.000Z', acceptancePath: '/organizations/invites/invite_acme_admin' },
]

const fixtureWatchlists = [
    { id: 'watch_acme_domain', organizationId: 'org_acme', tenantId: 'tenant_acme', kind: 'domain', value: 'acme.com', status: 'active', notes: 'Customer-owned domain', createdBy: 'owner_acme', updatedBy: 'owner_acme', alertGenerationRef: 'org_acme:watch_acme_domain', webhookEndpointHint: 'discord...acme', webhookEndpointHash: 'wh_hash_acme', webhookUrlConfigured: true },
    { id: 'watch_acme_vendor', organizationId: 'org_acme', tenantId: 'tenant_acme', kind: 'vendor', value: 'Okta', status: 'paused', notes: 'Identity provider', createdBy: 'analyst_acme', updatedBy: 'analyst_acme', alertGenerationRef: 'org_acme:watch_acme_vendor' },
    { id: 'watch_acme_retired', organizationId: 'org_acme', tenantId: 'tenant_acme', kind: 'vendor', value: 'RetiredVendor', status: 'archived', notes: 'Retired supplier', createdBy: 'owner_acme', updatedBy: 'owner_acme', alertGenerationRef: 'org_acme:watch_acme_retired' },
]

const fixtureDestinations = [
    { id: 'dest_acme_discord', name: 'SOC Discord', kind: 'discord', status: 'active', endpointHint: 'discord...acme', endpointHash: 'wh_hash_acme', deliveryReady: true, createdAt: '2026-07-03T12:00:00.000Z', updatedAt: '2026-07-03T12:10:00.000Z' },
]

const fixtureAlerts = [
    { id: 'dwm_alert_acme', title: 'Acme credential exposure', severity: 'high', status: 'reviewing', watchlistItemId: 'watch_acme_domain', updatedAt: '2026-07-04T09:00:00.000Z' },
]

const fixtureCases = [
    { id: 'case_acme_1', title: 'Credential exposure review', status: 'open', assignedOwner: 'analyst_acme', updatedAt: '2026-07-04T09:30:00.000Z' },
]

const fixtureDeliveries = [
    { id: 'delivery_acme_1', alertId: 'dwm_alert_acme', organizationId: 'org_acme', tenantId: 'tenant_acme', watchlistId: 'watch_acme_domain', webhookDestinationId: 'dest_acme_discord', endpointHint: 'discord...acme', endpointHash: 'wh_hash_acme', requestId: 'req_acme_1', auditEventId: 'audit_acme_1', dedupeKey: 'dedupe_acme_1', attemptedAt: '2026-07-04T09:35:00.000Z', dryRun: true, payloadHash: 'payload_hash_acme', status: 'dry_run', httpStatus: 204, attemptCount: 1, deliveryKind: 'discord' },
]
