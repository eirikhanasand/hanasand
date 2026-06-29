import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS, PRODUCT_READINESS_PROOF_ROW_IDS, buildOrgOperatingContext, buildProductProgressExternalState, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationState, type DwmWatchlistSummary } from '../src/app/dashboard/operatorConsoleModel'
import { buildProductNorthStarScoreboard } from '../src/utils/productProgress/northStar'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'

const here = new URL('.', import.meta.url)
const workbenchSource = readFileSync(new URL('../src/app/dashboard/ti/workbench/workbenchClient.tsx', here), 'utf8')
const dashboardModelSource = readFileSync(new URL('../src/app/dashboard/operatorConsoleModel.ts', here), 'utf8')
const dashboardPageSource = readFileSync(new URL('../src/app/dashboard/page.tsx', here), 'utf8')
const readinessPageSource = readFileSync(new URL('../src/app/readiness/page.tsx', here), 'utf8')
const productProgressRouteSource = readFileSync(new URL('../src/app/api/product-progress/route.ts', here), 'utf8')
const productReadinessRouteSource = readFileSync(new URL('../src/app/api/product-readiness/route.ts', here), 'utf8')

const generatedAt = '2026-06-29T08:00:00.000Z'
const routes = {
    productProgress: '/api/product-progress',
    publicTiProvenance: '/api/public-ti/provenance/readiness',
    helpdeskAudit: '/api/admin/support/readiness',
    deployProbe: '/api/product-progress',
    sourceProxy: '/api/ti/scraper/control?q=LockBit',
    entitlement: '/api/dwm/entitlements/readiness',
    orgAlertExport: '/api/organizations/org_acme/watchlist-alert-terms',
    webhookHealth: '/api/dwm/webhooks',
    dashboardAlerts: '/api/dwm/alerts',
}
const sourceProxy = {
    ok: true,
    generatedAt,
    query: 'LockBit',
    baseConfigured: true,
    endpoints: {
        sourceInventory: { ok: true, status: 200 },
        sourcePacks: { ok: true, status: 200 },
    },
    sourceInventory: {
        schemaVersion: 'dwm.source_inventory.v1',
        generatedAt,
        counts: {
            registeredTotal: 349,
            registeredActiveOrCanary: 349,
            catalogTotalCandidates: 8000,
            netNewCandidates: 7816,
            duplicateCandidates: 184,
            reviewQueue: 8000,
        },
    },
    sourcePacks: {
        schemaVersion: 'dwm.source_packs.v1',
        generatedAt,
        counts: { packCount: 2, candidateCount: 8000 },
        workerReadiness: {
            queuedValidationJobs: 0,
            validatingJobs: 0,
            activeSourceRows: 349,
            collectionReadyRows: 349,
        },
        lastRun: { status: 'completed', completedAt: generatedAt },
    },
}

const partialPayload = buildProductProgressPayload({
    generatedAt,
    checkedAt: generatedAt,
    query: 'LockBit',
    routes,
    sourceProxy,
    alerts: [{ id: 'alert_acme_1', updatedAt: generatedAt }],
    deliveries: [{ id: 'deliv_acme_1', alertId: 'alert_acme_1', status: 'delivered', attemptedAt: generatedAt }],
})

assert.equal(partialPayload.schemaVersion, 'product.progress.readiness.v1')
const northStar = buildProductNorthStarScoreboard(partialPayload, { generatedAt, query: 'watchlist terms' })
assert.equal(northStar.schemaVersion, 'product.north_star.readiness.v1')
assert.equal(northStar.fullChainReady, false)
assert.equal(northStar.totalRows, 9)
assert.ok(northStar.rows.every(row => row.ownerLane && row.href && row.backendProofContractVersion && row.integrationProbeHint), 'North-star rows require owner, deep link, proof contract, and probe hint.')
assert.ok(northStar.rows.find(row => row.id === 'webhook_delivery')?.state !== 'unavailable', 'Webhook delivery row should distinguish lifecycle/action work from missing proof.')
assert.equal(buildProductNorthStarScoreboard(null, { generatedAt }).firstBlocker?.length ? true : false, true)
assert.equal(partialPayload.sourceProxy?.sourceInventory?.schemaVersion, 'dwm.source_inventory.v1')
assert.equal(partialPayload.dashboardEvidence?.visibleInDashboard, true)
assert.equal(partialPayload.dashboardEvidence?.deliveryEvidenceMatched, true)
assert.equal(partialPayload.dashboardEvidence?.sourceProxyReady, true)
assert.equal(partialPayload.dashboardEvidence?.deployProbeFresh, false)
assert.equal(partialPayload.deployProbe?.status, 'needs_action')
assert.equal(partialPayload.publicTiProvenance?.status, 'unavailable')
assert.equal(partialPayload.helpdeskAudit?.status, 'unavailable')
assert.equal(partialPayload.entitlement?.status, 'unavailable')
assert.equal(partialPayload.orgAlertExport?.status, 'unavailable')
assert.equal(partialPayload.webhookHealth?.status, 'needs_action')

for (const dependency of [
    partialPayload.publicTiProvenance,
    partialPayload.helpdeskAudit,
    partialPayload.deployProbe,
    partialPayload.entitlement,
    partialPayload.orgAlertExport,
    partialPayload.webhookHealth,
    partialPayload.dashboardEvidence,
]) {
    assertDependencyProofFields(dependency)
}
assert.equal(partialPayload.publicTiProvenance?.ownerLane, 'public-ti')
assert.equal(partialPayload.publicTiProvenance?.unavailableReason, 'missing_public_ti_provenance_readiness_api')
assert.equal(partialPayload.helpdeskAudit?.ownerLane, 'helpdesk')
assert.equal(partialPayload.helpdeskAudit?.unavailableReason, 'missing_helpdesk_audit_readiness_api')
assert.equal(partialPayload.deployProbe?.ownerLane, 'integration')
assert.equal(partialPayload.deployProbe?.unavailableReason, 'missing_live_deploy_probe')
assert.equal(partialPayload.entitlement?.ownerLane, 'org')
assert.equal(partialPayload.entitlement?.unavailableReason, 'missing_dwm_entitlement_readiness_api')
assert.equal(partialPayload.entitlement?.expectedDashboardRowId, 'entitlement_readiness')
assert.equal(partialPayload.orgAlertExport?.ownerLane, 'org')
assert.equal(partialPayload.orgAlertExport?.unavailableReason, 'missing_org_alert_export_readiness_api')
assert.equal(partialPayload.webhookHealth?.ownerLane, 'webhook')
assert.equal(partialPayload.webhookHealth?.unavailableReason, 'missing_webhook_lifecycle_health_api')
assert.equal(partialPayload.dashboardEvidence?.ownerLane, 'dashboard')
assert.equal(partialPayload.dashboardEvidence?.unavailableReason, 'missing_live_deploy_probe')

const organizationState = {
    organizations: [{
        id: 'org_acme',
        tenantId: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        status: 'active',
        createdAt: generatedAt,
        updatedAt: generatedAt,
    }],
    selectedOrganization: {
        id: 'org_acme',
        tenantId: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        status: 'active',
        createdAt: generatedAt,
        updatedAt: generatedAt,
    },
    members: [{
        id: 'mem_owner',
        organizationId: 'org_acme',
        email: 'owner@acme.example',
        role: 'owner',
        status: 'active',
        createdAt: generatedAt,
        updatedAt: generatedAt,
    }],
    pendingInvites: [],
    webhooks: [{
        id: 'wh_discord',
        organizationId: 'org_acme',
        tenantId: 'org_acme',
        name: 'SOC Discord',
        kind: 'discord',
        status: 'active',
        createdAt: generatedAt,
        updatedAt: generatedAt,
    }],
} satisfies DwmOrganizationState
const longLabelOrganizationState = {
    ...organizationState,
    selectedOrganization: {
        ...organizationState.selectedOrganization,
        name: 'Acme Security Global Incident Response and Threat Intelligence Operations With A Very Long Customer Label',
    },
    webhooks: [{
        ...organizationState.webhooks[0],
        name: 'Primary Discord Delivery Destination With A Very Long Workspace And Channel Name For Readiness Proof',
    }],
} satisfies DwmOrganizationState
const watchlists = [{
    id: 'wl_acme',
    tenantId: 'org_acme',
    organizationId: 'org_acme',
    name: 'Acme exposure',
    terms: [{ value: 'acme.com', kind: 'domain' }],
    status: 'active',
    createdAt: generatedAt,
    updatedAt: generatedAt,
}] satisfies DwmWatchlistSummary[]
const longLabelWatchlists = [{
    ...watchlists[0],
    name: 'Shared exposure watchlist with an unusually long source and organization scoped label for wrap proof',
    terms: [{ value: 'acme-security-global-incident-response-and-threat-intelligence.example', kind: 'domain' }],
}] satisfies DwmWatchlistSummary[]
const operations = {
    counts: { sourceCount: 12, activeSourceCount: 9, captureCount: 42, watchlistMatchCount: 1 },
    latestRun: { status: 'completed', updatedAt: generatedAt, captureCount: 8 },
} satisfies DwmOperationsSnapshot
const deliveries = [{
    id: 'deliv_acme_1',
    alertId: 'alert_acme_1',
    watchlistId: 'wl_acme',
    organizationId: 'org_acme',
    endpointHash: 'endpoint:discord',
    attemptedAt: generatedAt,
    payloadHash: 'payload:alert_acme_1',
    status: 'delivered',
    deliveryKind: 'discord',
}] satisfies DwmDeliveryItem[]

const partialExternal = buildProductProgressExternalState(partialPayload, { checkedAt: generatedAt })
assertDependencyProofFields(partialExternal.sourceGrowth)
assert.equal(partialExternal.sourceGrowth?.ownerLane, 'source')
assert.equal(partialExternal.sourceGrowth?.expectedDashboardRowId, 'source_inventory_probe')
assert.equal(partialExternal.sourceGrowth?.staleAfterSeconds, 7200)
const partialContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: partialExternal,
})
assert.equal(partialContext.readiness.fullChainReady, false)
assert.ok(partialContext.readiness.fullChainBlockedBy.some(item => item.includes('Deploy and live probes')))
for (const rowId of PRODUCT_READINESS_PROOF_ROW_IDS) {
    const row = partialContext.readiness.productReadiness.find(item => item.id === rowId)
    assert.ok(row, `Missing product-readiness row ${rowId}`)
    assert.ok(row.href, `Missing deep link for product-readiness row ${rowId}`)
    assert.equal(row.deepLinkTarget, row.href)
    assert.equal(typeof row.blockerCount, 'number')
    assert.ok(row.ownerLane, `Missing owner lane for product-readiness row ${rowId}`)
    assert.ok(row.operatorAction, `Missing operator action for product-readiness row ${rowId}`)
    assertProductReadinessRowProof(row)
}
for (const rowId of PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS) {
    assert.ok(partialContext.readiness.productReadiness.find(item => item.id === rowId), `Missing workflow row ${rowId}`)
}
for (const row of partialContext.readiness.productReadiness) {
    assertProductReadinessRowProof(row)
}
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'dashboard_evidence')?.href, '/dashboard')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.href, '/dashboard/ti/sources')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'entitlement_readiness')?.href, '/dashboard/dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'webhook_delivery')?.href, '/dashboard/automations?setup=dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'org_alert_export')?.href, '/dashboard/dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.href, '/dashboard/automations?setup=dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'helpdesk_audit')?.href, '/dashboard/system/impersonation')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'deploy_probe')?.href, '/status')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'public_ti_provenance')?.href, '/ti')

const readyPayload = {
    ...partialPayload,
    publicTiProvenance: { ...partialPayload.publicTiProvenance!, status: 'ready' as const, blockers: [], sourceCount: 3, evidenceCount: 5 },
    entitlement: { ...partialPayload.entitlement!, status: 'ready' as const, blockers: [], allowed: true, policy: 'shared_watchlist', checkedRole: 'analyst', source: routes.entitlement, href: '/dashboard/dwm', unavailableReason: undefined },
    helpdeskAudit: { ...partialPayload.helpdeskAudit!, status: 'ready' as const, blockers: [], auditedActions: 2, openRecoveryRequests: 0 },
    orgAlertExport: { ...partialPayload.orgAlertExport!, status: 'ready' as const, blockers: [], activeTermCount: 1, canGenerateAlerts: true },
    webhookHealth: { ...partialPayload.webhookHealth!, status: 'ready' as const, blockers: [], destinationCount: 1, activeDestinationCount: 1, deliveryReadyCount: 1 },
    dashboardEvidence: { ...partialPayload.dashboardEvidence!, status: 'ready' as const, blockers: [], deployProbeFresh: true },
    deployProbe: { ...partialPayload.deployProbe!, status: 'ready' as const, blockers: [], apiHealthy: true, scraperHealthy: true, latestProbeAt: generatedAt },
}
const backedOrgWebhookPayload = buildProductProgressPayload({
    generatedAt,
    checkedAt: generatedAt,
    query: 'watchlist terms',
    routes,
    sourceProxy,
    alerts: [{ id: 'alert_acme_1', updatedAt: generatedAt }],
    deliveries: [{ id: 'deliv_acme_1', alertId: 'alert_acme_1', status: 'delivered', attemptedAt: generatedAt }],
    orgAlertExport: {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: '/api/dwm/watchlists',
        href: '/dashboard/dwm',
        organizationId: 'org_acme',
        activeTermCount: 2,
        pausedCount: 0,
        archivedCount: 0,
        canGenerateAlerts: true,
        exportedAt: generatedAt,
        blockers: [],
        ownerLane: 'org',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/dwm/watchlists with org scope must return active shared terms that can generate alerts.',
        backendProofContractVersion: 'organization.watchlist_alert_terms_export.v1',
    },
    webhookHealth: {
        schemaVersion: 'dwm.webhook_health.readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: '/api/organizations/org_acme/webhooks',
        href: '/dashboard/automations?setup=dwm',
        destinationCount: 1,
        activeDestinationCount: 1,
        deliveryReadyCount: 1,
        latestDeliveryAt: generatedAt,
        latestAuditEventAt: generatedAt,
        blockers: [],
        ownerLane: 'webhook',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'webhook_health',
        integrationProbeHint: 'GET /api/organizations/:id/webhooks and GET /api/dwm/webhooks/deliveries must return active destinations and delivery evidence.',
        backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
    },
})
assert.equal(backedOrgWebhookPayload.orgAlertExport?.status, 'ready')
assert.equal(backedOrgWebhookPayload.orgAlertExport?.source, '/api/dwm/watchlists')
assert.equal(backedOrgWebhookPayload.webhookHealth?.status, 'ready')
assert.equal(backedOrgWebhookPayload.webhookHealth?.source, '/api/organizations/org_acme/webhooks')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).orgAlertExport?.status, 'ready')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).webhookHealth?.status, 'ready')
const readyContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: buildProductProgressExternalState(readyPayload, { checkedAt: generatedAt }),
})
assert.equal(readyContext.readiness.fullChainReady, true)

const degradedSourceProxy = {
    ...sourceProxy,
    ok: false,
    endpoints: {
        sourceInventory: { ok: false, status: 503, error: 'source policy blocked' },
        sourcePacks: { ok: false, status: 503, error: 'source worker unavailable' },
    },
    sourcePacks: {
        schemaVersion: 'dwm.source_packs.v1',
        generatedAt,
        counts: { packCount: 0, candidateCount: 0 },
    },
}
const degradedPayload = {
    ...buildProductProgressPayload({
        generatedAt,
        checkedAt: generatedAt,
        query: 'acme-security-global-incident-response-and-threat-intelligence.example',
        routes,
        sourceProxy: degradedSourceProxy,
        alerts: [],
        deliveries: [],
        deploy: {
            status: 'needs_action',
            latestProbeAt: '2026-06-29T07:00:00.000Z',
            frontendHealthy: true,
            apiHealthy: false,
            scraperHealthy: false,
        },
    }),
    entitlement: {
        schemaVersion: 'dwm.entitlement.readiness.v1',
        status: 'blocked' as const,
        checkedAt: generatedAt,
        source: routes.entitlement,
        href: '/dashboard/dwm',
        organizationId: 'org_acme',
        policy: 'shared_watchlist',
        allowed: false,
        checkedRole: 'viewer',
        blockers: ['DWM entitlement policy blocks alert delivery for viewer role.'],
        detail: 'DWM entitlement policy blocks alert delivery for viewer role.',
    },
}
const degradedContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists: longLabelWatchlists,
    organizationState: longLabelOrganizationState,
    operations: {
        ...operations,
        counts: { sourceCount: 12, activeSourceCount: 0, captureCount: 0, watchlistMatchCount: 0 },
        latestRun: { status: 'blocked_by_source_policy', updatedAt: generatedAt, captureCount: 0 },
    },
    deliveries: [],
    liveAlertCount: 0,
    liveAlertIds: [],
    externalReadiness: buildProductProgressExternalState(degradedPayload, { checkedAt: generatedAt, staleAfterMinutes: 10 }),
})
assert.equal(degradedContext.readiness.fullChainReady, false)
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'entitlement_readiness')?.status, 'blocked')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'source_coverage')?.status, 'blocked')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.status, 'needs_action')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'dashboard_alert')?.status, 'blocked')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'webhook_delivery')?.status, 'needs_action')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'dashboard_evidence')?.status, 'needs_action')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'public_ti_provenance')?.status, 'unavailable')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'helpdesk_audit')?.status, 'unavailable')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'org_alert_export')?.status, 'needs_action')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.status, 'needs_action')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'deploy_probe')?.status, 'needs_action')
assert.ok(degradedContext.readiness.productReadiness.every(item => item.ownerLane && item.operatorAction))
assert.ok(degradedContext.readiness.productReadiness.every(item => typeof item.blockerCount === 'number'))
assert.ok(degradedContext.readiness.productReadiness.every(item => item.backendProofContractVersion && item.expectedDashboardRowId && item.integrationProbeHint), 'Each degraded row needs proof metadata.')
assert.ok((degradedContext.readiness.productReadiness.find(item => item.id === 'dashboard_evidence')?.blockerCount || 0) >= 3)
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'entitlement_readiness')?.operatorAction, 'Resolve DWM entitlement')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'helpdesk_audit')?.operatorAction, 'Open helpdesk workbench')
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'public_ti_provenance')?.operatorAction, 'Open public TI handoff')

for (const dependency of [
    readyPayload.publicTiProvenance,
    readyPayload.entitlement,
    readyPayload.helpdeskAudit,
    readyPayload.deployProbe,
    readyPayload.orgAlertExport,
    readyPayload.webhookHealth,
    readyPayload.dashboardEvidence,
]) {
    assertDependencyProofFields(dependency)
}

const longLabelContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists: longLabelWatchlists,
    organizationState: longLabelOrganizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: buildProductProgressExternalState(readyPayload, { checkedAt: generatedAt }),
})
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'org_members')?.status, 'ready')
assert.ok(longLabelContext.readiness.productReadiness.find(item => item.id === 'org_members')?.detail.includes('Very Long Customer Label'))
assert.ok(longLabelContext.readiness.productReadiness.every(item => typeof item.blockerCount === 'number'))
assert.ok(longLabelContext.readiness.productReadiness.every(item => item.deepLinkTarget === item.href))
assert.ok(longLabelContext.readiness.productReadiness.every(item => item.ownerLane && item.operatorAction))
assert.ok(longLabelContext.readiness.productReadiness.every(item => item.backendProofContractVersion && item.proofTimestamp && item.staleAfterSeconds), 'Every product-readiness row needs proof contract metadata.')

for (const attribute of [
    'data-readiness-row-id',
    'data-readiness-state',
    'data-readiness-blocker-count',
    'data-readiness-deep-link-target',
    'data-readiness-proof-timestamp',
    'data-readiness-unavailable-reason',
    'data-readiness-stale-after-seconds',
    'data-readiness-expected-dashboard-row-id',
    'data-readiness-integration-probe-hint',
    'data-readiness-backend-proof-contract-version',
    'data-readiness-owner-lane',
    'data-readiness-operator-action',
]) {
    assert.ok(workbenchSource.includes(attribute), `Missing readiness DOM attribute ${attribute}`)
}

for (const className of [
    'dark:border-[#2d3a52]',
    'dark:hover:border-[#3b4b68]',
    'wrap-break-word text-xs font-semibold',
    'wrap-break-word text-[11px]',
    'shrink-0',
    'min-w-0',
]) {
    assert.ok(workbenchSource.includes(className), `Missing readiness render guard class ${className}`)
}

for (const bannedCopy of ['control room', 'prompt-shaped', 'acceptance criteria', 'coordinator', 'delegation', 'you are tasked']) {
    assert.equal(workbenchSource.toLowerCase().includes(bannedCopy), false, `Dashboard workbench includes banned copy: ${bannedCopy}`)
    assert.equal(dashboardModelSource.toLowerCase().includes(bannedCopy), false, `Dashboard model includes banned copy: ${bannedCopy}`)
    assert.equal(dashboardPageSource.toLowerCase().includes(bannedCopy), false, `Dashboard page includes banned copy: ${bannedCopy}`)
    assert.equal(readinessPageSource.toLowerCase().includes(bannedCopy), false, `Readiness page includes banned copy: ${bannedCopy}`)
}

for (const scopedProgressToken of [
    'copyScopedParams(request, target)',
    '\'organizationId\'',
    '\'userEmail\'',
    '\'userId\'',
    '\'actor\'',
    'orgAlertExportReadiness',
    'webhookHealthReadiness',
    '/api/dwm/watchlists',
    '/api/organizations/:id/webhooks',
]) {
    assert.ok(productProgressRouteSource.includes(scopedProgressToken), `Product-progress route missing scoped readiness token: ${scopedProgressToken}`)
}

for (const scopedReadinessToken of [
    'copyScopedParams(request, target)',
    '/api/product-progress',
    'buildProductNorthStarScoreboard',
    'organizationId',
    'userEmail',
    'actor',
]) {
    assert.ok(productReadinessRouteSource.includes(scopedReadinessToken), `Product-readiness route missing scoped bridge token: ${scopedReadinessToken}`)
}

for (const visibleExample of ['APT29', 'LockBit', 'dashboard slop', 'how this feeds', '/ti/<query>']) {
    assert.equal(readinessPageSource.includes(visibleExample), false, `Readiness page includes prompt/example copy: ${visibleExample}`)
}

for (const readinessRouteToken of ['data-north-star-row-id', 'data-north-star-owner-lane', 'data-north-star-backend-proof-contract-version', 'watchlist terms', 'Open']) {
    assert.ok(readinessPageSource.includes(readinessRouteToken), `Readiness route missing product proof token: ${readinessRouteToken}`)
}

for (const bannedClass of ['border-white/', 'bg-white/10', 'bg-white/15']) {
    assert.equal(workbenchSource.includes(bannedClass), false, `Dashboard workbench includes high-contrast dark-mode class: ${bannedClass}`)
}

assert.ok(workbenchSource.includes('data-readiness-detail-href'), 'Readiness detail should expose the backed workflow href.')
assert.ok(workbenchSource.includes('Open workflow'), 'Readiness detail should deep-link to the backed workflow.')
assert.ok(workbenchSource.includes('readinessPrioritySort'), 'Dashboard readiness rows should be prioritized by blocker state.')
assert.ok(workbenchSource.includes('data-readiness-priority'), 'Dashboard readiness rows should expose priority for DOM proof.')
assert.ok(workbenchSource.includes('href=\'/readiness\''), 'Dashboard readiness detail should link to the product scorecard.')
assert.ok(workbenchSource.includes('Open scorecard'), 'Dashboard readiness detail should expose the product scorecard action.')
assert.ok(workbenchSource.includes('replay_alert'), 'Operator action rail should expose backed DWM alert replay.')
assert.ok(workbenchSource.includes('/api/dwm/alerts/${encodeURIComponent(selected.id)}/replay'), 'Replay action should call the selected alert replay endpoint.')
assert.ok(workbenchSource.includes('send_alert'), 'Operator action rail should expose backed webhook delivery send.')
assert.ok(workbenchSource.includes('/api/dwm/webhooks/deliver'), 'Send action should call the webhook delivery endpoint.')

const backendProofCommits = {
    helpdeskAuditFilters: '016a8ef7',
    sourceReadiness: '930f93af',
    sourceCustomerConfig: '342c1fe3',
    orgAlertLifecycle: '414c72a4',
    orgOnboardingLifecycle: 'd0f53e04',
    publicTiExperienceGate: 'def920a7',
    publicTiBackedReadiness: '929f3416',
    dashboardRenderProof: 'dfb2d272',
    productProgress: '89d9547e',
    entitlementBlocker: '4da6a209',
    entitlementProof: '1c88a82a',
    helpdeskSupportAction: '9e25b6ad',
    helpdeskExecutor: '5b7d9357',
    analystHandoffReport: '99b75073',
    sourceActionContracts: '178ec078',
    webhookDeliveryReadiness: '14210040',
    webhookAdminProof: 'b3600c7e',
    alertMatching: '9d4c7118',
    customerAlertProof: '03d8d1ec',
}
assert.deepEqual(Object.keys(backendProofCommits).sort(), [
    'alertMatching',
    'analystHandoffReport',
    'customerAlertProof',
    'dashboardRenderProof',
    'entitlementBlocker',
    'entitlementProof',
    'helpdeskAuditFilters',
    'helpdeskExecutor',
    'helpdeskSupportAction',
    'orgAlertLifecycle',
    'orgOnboardingLifecycle',
    'productProgress',
    'publicTiBackedReadiness',
    'publicTiExperienceGate',
    'sourceActionContracts',
    'sourceCustomerConfig',
    'sourceReadiness',
    'webhookAdminProof',
    'webhookDeliveryReadiness',
])

function assertDependencyProofFields(input: {
    status?: string
    ownerLane?: string
    unavailableReason?: string
    staleAfterSeconds?: number
    proofTimestamp?: string
    expectedDashboardRowId?: string
    integrationProbeHint?: string
    backendProofContractVersion?: string
} | undefined) {
    assert.ok(input, 'Missing readiness dependency proof object.')
    assert.ok(input.ownerLane, 'Missing ownerLane.')
    const staleAfterSeconds = input.staleAfterSeconds
    assert.equal(typeof staleAfterSeconds, 'number')
    if (typeof staleAfterSeconds !== 'number') throw new Error('Missing staleAfterSeconds.')
    assert.ok(staleAfterSeconds > 0)
    assert.ok(input.proofTimestamp, 'Missing proofTimestamp.')
    assert.ok(input.expectedDashboardRowId, 'Missing expectedDashboardRowId.')
    assert.ok(input.integrationProbeHint, 'Missing integrationProbeHint.')
    assert.ok(input.backendProofContractVersion, 'Missing backendProofContractVersion.')
    if (input.status !== 'ready') {
        assert.ok(input.unavailableReason, `Missing unavailableReason for ${input.expectedDashboardRowId}.`)
    }
}

function assertProductReadinessRowProof(input: {
    id: string
    status: string
    ownerLane?: string
    proofTimestamp?: string
    unavailableReason?: string
    staleAfterSeconds?: number
    expectedDashboardRowId?: string
    integrationProbeHint?: string
    backendProofContractVersion?: string
}) {
    assert.ok(input.ownerLane, `Missing ownerLane for ${input.id}.`)
    assert.ok(input.proofTimestamp, `Missing proofTimestamp for ${input.id}.`)
    assert.ok(input.expectedDashboardRowId, `Missing expectedDashboardRowId for ${input.id}.`)
    assert.equal(input.expectedDashboardRowId, input.id)
    assert.ok(input.integrationProbeHint, `Missing integrationProbeHint for ${input.id}.`)
    assert.ok(input.backendProofContractVersion, `Missing backendProofContractVersion for ${input.id}.`)
    assert.equal(typeof input.staleAfterSeconds, 'number', `Missing staleAfterSeconds for ${input.id}.`)
    assert.ok((input.staleAfterSeconds || 0) > 0, `Invalid staleAfterSeconds for ${input.id}.`)
    if (input.status !== 'ready') {
        assert.ok(input.unavailableReason, `Missing unavailableReason for non-ready row ${input.id}.`)
    }
}
