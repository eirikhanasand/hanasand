import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS, PRODUCT_READINESS_PROOF_ROW_IDS, buildOrgOperatingContext, buildProductProgressExternalState, buildReadinessCases, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationState, type DwmWatchlistSummary } from '../src/app/dashboard/operatorConsoleModel'
import { buildProductNorthStarScoreboard } from '../src/utils/productProgress/northStar'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'

const here = new URL('.', import.meta.url)
const workbenchSource = readFileSync(new URL('../src/app/dashboard/ti/workbench/workbenchClient.tsx', here), 'utf8')
const dashboardModelSource = readFileSync(new URL('../src/app/dashboard/operatorConsoleModel.ts', here), 'utf8')
const dashboardPageSource = readFileSync(new URL('../src/app/dashboard/page.tsx', here), 'utf8')
const readinessPageSource = readFileSync(new URL('../src/app/readiness/page.tsx', here), 'utf8')
const productProgressRouteSource = readFileSync(new URL('../src/app/api/product-progress/route.ts', here), 'utf8')
const productReadinessRouteSource = readFileSync(new URL('../src/app/api/product-readiness/route.ts', here), 'utf8')
const organizationAlertReadinessRouteSource = readFileSync(new URL('../src/app/api/organizations/[id]/alert-readiness/route.ts', here), 'utf8')
const caseCustomerNotificationProxySource = readFileSync(new URL('../src/app/api/cases/[id]/customer-notification/route.ts', here), 'utf8')
const caseExportProxySource = readFileSync(new URL('../src/app/api/cases/[id]/export/route.ts', here), 'utf8')

const generatedAt = '2026-06-29T08:00:00.000Z'
const routes = {
    productProgress: '/api/product-progress',
    publicTiProvenance: '/api/public-ti/provenance/readiness',
    helpdeskAudit: '/api/admin/support/readiness',
    deployProbe: '/api/product-progress',
    sourceProxy: '/api/ti/scraper/control?q=LockBit',
    entitlement: '/api/dwm/entitlements/readiness',
    organizationReadiness: '/api/organizations/org_acme/alert-readiness',
    orgAlertExport: '/api/organizations/org_acme/alert-readiness',
    webhookHealth: '/api/dwm/webhooks',
    dashboardAlerts: '/api/dwm/alerts',
    dwmProduct: '/api/dwm/product?demo=false',
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
        sourceOperationsReadiness: {
            schemaVersion: 'dwm.source_operations_readiness.v1',
            nextOperatorActions: [{ action: 'inspect_source_family', reason: 'verify freshness before customer alerting' }],
        },
        sourceCustomerConfig: {
            schemaVersion: 'dwm.source_pack_customer_config.v1',
            sourceConfigs: [{ redactedIdentity: { rawStored: false } }],
            safeOutput: {
                rawTargetsExposed: false,
                privateTelegramContentExposed: false,
                liveNetworkScrapeStarted: false,
            },
        },
        sourceReadinessArtifact: {
            schemaVersion: 'dwm.source_readiness_artifact.v1',
            readinessLedgerRows: [{ state: 'ready', safeOutput: { liveNetworkScrapeStarted: false } }],
            actorCoverage: [{ watchlistTerm: 'LockBit', actorSections: { overview: { covered: true } } }],
            sharedWatchlistAlertability: {
                activeSourceFamilies: ['telegram', 'darkweb_onion'],
                matchableFields: ['actor', 'company', 'domain'],
                sourceTrust: { averageScore: 0.91 },
            },
            safeOutput: { liveNetworkScrapeStarted: false },
        },
        proxyVerification: {
            schemaVersion: 'dwm.source_pack_worker_proxy_verification.v1',
            state: 'ready',
            checks: [{ id: 'safe_output_no_live_network', status: 'pass' }],
        },
        sourceFamilyCounts: { telegram: 3, darkweb_onion: 2 },
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
assert.equal(partialPayload.dwmProduct?.status, 'unavailable')

for (const dependency of [
    partialPayload.publicTiProvenance,
    partialPayload.helpdeskAudit,
    partialPayload.deployProbe,
    partialPayload.entitlement,
    partialPayload.orgAlertExport,
    partialPayload.webhookHealth,
    partialPayload.dwmProduct,
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
assert.equal(partialPayload.orgAlertExport?.integrationProbeHint, 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.')
assert.equal(partialPayload.orgAlertExport?.backendProofContractVersion, 'organization.worker3_ui_readiness_proof.v1')
assert.equal(partialPayload.webhookHealth?.ownerLane, 'webhook')
assert.equal(partialPayload.webhookHealth?.unavailableReason, 'missing_webhook_lifecycle_health_api')
assert.equal(partialPayload.dashboardEvidence?.ownerLane, 'dashboard')
assert.equal(partialPayload.dashboardEvidence?.unavailableReason, 'missing_live_deploy_probe')
assert.equal(partialPayload.dwmProduct?.ownerLane, 'dwm')
assert.equal(partialPayload.dwmProduct?.unavailableReason, 'missing_dwm_product_snapshot')

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
assert.equal(partialExternal.sourceGrowth?.status, 'ready')
assert.equal(partialExternal.sourceGrowth?.sourceOperationsReady, true)
assert.equal(partialExternal.sourceGrowth?.sourceCustomerConfigReady, true)
assert.equal(partialExternal.sourceGrowth?.sourceReadinessArtifactReady, true)
assert.equal(partialExternal.sourceGrowth?.sourceProxyVerificationReady, true)
assert.equal(partialExternal.sourceGrowth?.backendProofContractVersion?.includes('dwm.source_readiness_artifact.v1'), true)
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
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'dwm_product_snapshot')?.href, '/dashboard/dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'org_alert_export')?.href, '/dashboard/dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.href, '/dashboard/automations?setup=dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'helpdesk_audit')?.href, '/dashboard/system/impersonation')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'deploy_probe')?.href, '/status')

const degradedReadinessCases = buildReadinessCases({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    renderedAlertCount: 1,
    externalReadiness: partialExternal,
})
const supportReadinessCase = degradedReadinessCases.find(item => item.id === 'support_admin_readiness')
assert.equal(supportReadinessCase?.kind, 'support_readiness')
assert.equal(supportReadinessCase?.queue, 'Support readiness')
assert.equal(supportReadinessCase?.relatedLinks.some(link => link.href === '/dashboard/system/impersonation'), true)
assert.equal(supportReadinessCase?.relatedLinks.some(link => link.href === '/api/backend/admin/support/access-recovery'), true)
assert.equal(supportReadinessCase?.relatedLinks.some(link => link.href === '/api/backend/admin/audit-events?limit=50'), true)
assert.ok(supportReadinessCase?.missingDependency, 'Support readiness case should expose unavailable proof as a blocker.')
assert.equal(supportReadinessCase?.actions?.[0]?.href, '/dashboard/system/impersonation')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'public_ti_provenance')?.href, '/ti')

const readyPayload = {
    ...partialPayload,
    publicTiProvenance: { ...partialPayload.publicTiProvenance!, status: 'ready' as const, blockers: [], sourceCount: 3, evidenceCount: 5 },
    entitlement: { ...partialPayload.entitlement!, status: 'ready' as const, blockers: [], allowed: true, policy: 'shared_watchlist', checkedRole: 'analyst', source: routes.entitlement, href: '/dashboard/dwm', unavailableReason: undefined },
    helpdeskAudit: { ...partialPayload.helpdeskAudit!, status: 'ready' as const, blockers: [], auditedActions: 2, openRecoveryRequests: 0 },
    orgAlertExport: { ...partialPayload.orgAlertExport!, status: 'ready' as const, blockers: [], activeTermCount: 1, canGenerateAlerts: true },
    webhookHealth: { ...partialPayload.webhookHealth!, status: 'ready' as const, blockers: [], destinationCount: 1, activeDestinationCount: 1, deliveryReadyCount: 1 },
    dwmProduct: { ...partialPayload.dwmProduct!, status: 'ready' as const, blockers: [], watchlistTermCount: 1, alertCount: 1, sourceFamilyCount: 2, latestAlertAt: generatedAt, source: routes.dwmProduct, unavailableReason: undefined },
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
        source: routes.organizationReadiness,
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
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: 'organization.worker3_ui_readiness_proof.v1',
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
    helpdeskAudit: {
        schemaVersion: 'support.audit.readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: '/api/backend/admin/support/access-recovery + /api/backend/admin/audit-events?limit=50',
        href: '/dashboard/system/impersonation',
        auditedActions: 2,
        openRecoveryRequests: 1,
        supportQueueDepth: 1,
        latestAuditEventAt: generatedAt,
        blockers: [],
        ownerLane: 'helpdesk',
        staleAfterSeconds: 3600,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: 'GET /api/backend/admin/support/access-recovery must return recovery queue state. GET /api/backend/admin/audit-events?limit=50 must return detail.exportProof.schemaVersion=support.audit.export_proof.v1. Replay query: ?limit=50. Worker proof route: /api/admin/audit-events.',
        backendProofContractVersion: 'support.audit.export_proof.v1',
    },
    dwmProduct: {
        schemaVersion: 'dwm.product_snapshot.readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: '/api/dwm/product?demo=false',
        href: '/dashboard/dwm',
        tenantId: 'org_acme',
        watchlistTermCount: 1,
        alertCount: 1,
        sourceFamilyCount: 2,
        actorOverviewCount: 1,
        latestAlertAt: generatedAt,
        blockers: [],
        ownerLane: 'dwm',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'dwm_product_snapshot',
        integrationProbeHint: 'GET /api/dwm/product?demo=false must return watchlist, source coverage, and alert proof from the TI backend.',
        backendProofContractVersion: 'dwm.product.v1',
    },
})
assert.equal(backedOrgWebhookPayload.orgAlertExport?.status, 'ready')
assert.equal(backedOrgWebhookPayload.orgAlertExport?.source, routes.organizationReadiness)
assert.equal(backedOrgWebhookPayload.orgAlertExport?.backendProofContractVersion, 'organization.worker3_ui_readiness_proof.v1')
assert.equal(backedOrgWebhookPayload.webhookHealth?.status, 'ready')
assert.equal(backedOrgWebhookPayload.webhookHealth?.source, '/api/organizations/org_acme/webhooks')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).orgAlertExport?.status, 'ready')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).webhookHealth?.status, 'ready')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).helpdeskAudit?.status, 'ready')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).dwmProduct?.status, 'ready')
assert.equal(buildProductProgressExternalState(backedOrgWebhookPayload, { checkedAt: generatedAt }).helpdeskAudit?.backendProofContractVersion, 'support.audit.export_proof.v1')

const organizationReadinessProof = {
    schemaVersion: 'organization.worker3_ui_readiness_proof.v1',
    organizationId: 'org_acme',
    tenantId: 'org_acme',
    actor: { role: 'admin', canExportActiveTerms: true },
    counts: {
        activeMemberCount: 4,
        activeAdminCount: 2,
        pendingInviteCount: 1,
        activeWatchlistTermCount: 7,
        pausedWatchlistCount: 1,
        archivedWatchlistCount: 0,
    },
    readiness: {
        organizationCanGenerateAlerts: true,
        actorCanExportActiveTerms: true,
        readyForWorker3Replay: true,
        readyForDashboard: true,
        cleanupRequired: false,
    },
    blockers: [],
} as const
const organizationProofBackedPayload = buildProductProgressPayload({
    generatedAt,
    checkedAt: generatedAt,
    query: 'watchlist terms',
    routes,
    sourceProxy,
    alerts: [{ id: 'alert_acme_1', updatedAt: generatedAt }],
    deliveries: [{ id: 'deliv_acme_1', alertId: 'alert_acme_1', status: 'delivered', attemptedAt: generatedAt }],
    entitlement: {
        schemaVersion: 'dwm.entitlement.readiness.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: routes.organizationReadiness,
        href: '/dashboard/dwm',
        organizationId: 'org_acme',
        policy: 'organization_readiness',
        allowed: true,
        checkedRole: organizationReadinessProof.actor.role,
        blockers: [],
        ownerLane: 'org',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'entitlement_readiness',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.actor.canExportActiveTerms and blockers.',
        backendProofContractVersion: organizationReadinessProof.schemaVersion,
    },
    orgAlertExport: {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: 'ready',
        checkedAt: generatedAt,
        source: routes.organizationReadiness,
        href: '/dashboard/dwm',
        organizationId: 'org_acme',
        activeTermCount: organizationReadinessProof.counts.activeWatchlistTermCount,
        pausedCount: organizationReadinessProof.counts.pausedWatchlistCount,
        archivedCount: organizationReadinessProof.counts.archivedWatchlistCount,
        canGenerateAlerts: true,
        exportedAt: generatedAt,
        blockers: [],
        ownerLane: 'org',
        staleAfterSeconds: 900,
        proofTimestamp: generatedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return readinessProof.readiness.organizationCanGenerateAlerts and active watchlist term counts.',
        backendProofContractVersion: organizationReadinessProof.schemaVersion,
    },
})
assert.equal(organizationProofBackedPayload.entitlement?.source, routes.organizationReadiness)
assert.equal(organizationProofBackedPayload.entitlement?.backendProofContractVersion, 'organization.worker3_ui_readiness_proof.v1')
assert.equal(organizationProofBackedPayload.entitlement?.policy, 'organization_readiness')
assert.equal(organizationProofBackedPayload.orgAlertExport?.source, routes.organizationReadiness)
assert.equal(organizationProofBackedPayload.orgAlertExport?.activeTermCount, 7)
assert.equal(organizationProofBackedPayload.orgAlertExport?.backendProofContractVersion, 'organization.worker3_ui_readiness_proof.v1')
assert.equal(buildProductProgressExternalState(organizationProofBackedPayload, { checkedAt: generatedAt }).entitlement?.status, 'ready')
assert.equal(buildProductProgressExternalState(organizationProofBackedPayload, { checkedAt: generatedAt }).orgAlertExport?.status, 'ready')
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
assert.equal(degradedContext.readiness.productReadiness.find(item => item.id === 'dwm_product_snapshot')?.status, 'unavailable')
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
    readyPayload.dwmProduct,
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
assert.equal(longLabelContext.readiness.productReadiness.find(item => item.id === 'dwm_product_snapshot')?.status, 'ready')
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
    'organizationReadinessProof',
    'entitlementReadinessFromOrganizationProof',
    'organization.worker3_ui_readiness_proof.v1',
    '/api/organizations/:id/alert-readiness',
    'readinessProof.readiness.organizationCanGenerateAlerts',
    'readinessProof?.readiness.actorCanExportActiveTerms',
    'readinessProof.actor.canExportActiveTerms',
    'webhookHealthReadiness',
    'helpdeskAuditReadiness',
    'supportAuditExportProof',
    'support.audit.export_proof.v1',
    'detail.exportProof.schemaVersion=support.audit.export_proof.v1',
    'Replay query:',
    'Worker proof route:',
    'dwmProductReadiness',
    '/api/dwm/watchlists',
    '/api/dwm/product?demo=false',
    '/api/organizations/:id/webhooks',
    '/api/backend/admin/support/access-recovery',
    '/api/backend/admin/audit-events?limit=50',
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

for (const orgReadinessRouteToken of [
    '/v1/organizations/${encodeURIComponent(id)}/alert-readiness',
    'proxyTiRequest',
    'force-dynamic',
]) {
    assert.ok(organizationAlertReadinessRouteSource.includes(orgReadinessRouteToken), `Organization alert-readiness proxy missing token: ${orgReadinessRouteToken}`)
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
assert.ok(workbenchSource.includes('open_alert_detail'), 'Operator action rail should expose backed DWM alert detail.')
assert.ok(workbenchSource.includes('/api/dwm/alerts/${encodeURIComponent(selected.id)}'), 'Alert detail action should open the selected alert endpoint.')
assert.ok(workbenchSource.includes('Fallback alerts cannot load /api/dwm/alerts/:id.'), 'Fallback alerts should block alert detail loading honestly.')
assert.ok(workbenchSource.includes('replay_alert'), 'Operator action rail should expose backed DWM alert replay.')
assert.ok(workbenchSource.includes('/api/dwm/alerts/${encodeURIComponent(selected.id)}/replay'), 'Replay action should call the selected alert replay endpoint.')
assert.ok(workbenchSource.includes('send_alert'), 'Operator action rail should expose backed webhook delivery send.')
assert.ok(workbenchSource.includes('/api/dwm/webhooks/deliver'), 'Send action should call the webhook delivery endpoint.')
assert.ok(workbenchSource.includes('request_source_coverage'), 'Operator action rail should expose source coverage requests.')
assert.ok(workbenchSource.includes('run_canary_collection'), 'Operator action rail should expose canary collection runs.')
assert.ok(workbenchSource.includes('insertedCaptureCount'), 'Canary collection action should report inserted capture count.')
assert.ok(workbenchSource.includes('failedTaskCount'), 'Canary collection action should report failed task count.')
assert.ok(workbenchSource.includes('telegramPublicCreated'), 'Source coverage action should report source request summary fields.')
assert.ok(workbenchSource.includes('support_readiness'), 'Operator action rail should recognize support readiness items.')
assert.ok(workbenchSource.includes('open_helpdesk_workbench'), 'Support readiness should deep-link to the helpdesk workbench.')
assert.ok(workbenchSource.includes('support_recovery_api'), 'Support readiness should expose the recovery queue API.')
assert.ok(workbenchSource.includes('admin_audit_api'), 'Support readiness should expose the admin audit API.')
assert.ok(workbenchSource.includes('handledActionIds'), 'Operator action rail should dedupe selected backed actions.')
assert.ok(workbenchSource.includes('selected.actions || []'), 'Operator action rail should expose backed actions attached to selected readiness items.')
assert.ok(workbenchSource.includes('actionReadiness'), 'Public TI handoff action rail should consume backed action readiness.')
assert.ok(workbenchSource.includes('handoffReadinessFor'), 'Public TI handoff actions should map readiness by action.')
assert.ok(workbenchSource.includes('readinessDisabledReason'), 'Public TI handoff actions should disable from action-readiness blockers.')
assert.ok(workbenchSource.includes('sourceRequestCount'), 'Public TI action readiness should expose source request counts.')
assert.ok(workbenchSource.includes('sourceOperationsActionMessage'), 'Source coverage actions should report source-operations proof returned by the backend.')
assert.ok(workbenchSource.includes('sourceOperationsQueue'), 'Source coverage actions should surface backed source-operations queue state.')
assert.ok(workbenchSource.includes('collectionTrigger'), 'Source coverage actions should surface backed collection trigger state.')
assert.ok(workbenchSource.includes('alertRebuild'), 'Source coverage actions should surface backed alert rebuild state.')
assert.ok(dashboardPageSource.includes('firstParam(params?.case)'), 'Dashboard proof links should select a requested case from /dashboard?case=<id>.')
assert.ok(dashboardPageSource.includes('initialSelectedId={initialSelectedId}'), 'Dashboard should pass the requested case id into the operator workbench.')
assert.ok(workbenchSource.includes('initialSelectedId'), 'Operator workbench should accept an initial selected item id from backed readiness links.')
assert.ok(workbenchSource.includes('readAlertDetailJson'), 'Operator workbench should parse selected live alert detail from the backed alert proxy.')
assert.ok(workbenchSource.includes('/api/dwm/alerts/${encodeURIComponent(itemId)}'), 'Selected live alerts should load /api/dwm/alerts/:id in the root console.')
assert.ok(workbenchSource.includes('Alert API evidence'), 'Selected alert inspection should expose backed alert evidence when case detail is unavailable.')
assert.ok(workbenchSource.includes('refreshAlertDetail'), 'Selected live alert detail should refresh from /api/dwm/alerts/:id after backed actions.')
assert.ok(workbenchSource.includes('refreshBackedSelection(item, payload'), 'Replay/send/update actions should refresh selected backed alert and case state from action responses.')
assert.ok(workbenchSource.includes('caseDetailHrefFromPayload'), 'Open-case responses should be converted into /api/cases/:id detail refreshes.')
assert.ok(workbenchSource.includes('payload?.case?.id'), 'Case detail refresh should depend on the backed case id returned by /api/cases.')
assert.ok(workbenchSource.includes('caseDetailHrefFromAlertDetail'), 'Selected alert detail should open linked /api/cases/:id detail when the alert API returns a case id.')
assert.ok(workbenchSource.includes('alert?.workflowContext?.caseIdCandidate'), 'Alert-derived case detail should consume the workflow case candidate returned by /api/dwm/alerts/:id.')
assert.ok(workbenchSource.includes('deliveryEvidenceFromPayload'), 'Webhook test/send responses should become inspectable delivery evidence in the selected workbench item.')
assert.ok(workbenchSource.includes('mergeDeliveryEvidence(actionDeliveries'), 'Action-returned delivery evidence should be shown in the backed inspection panel before case detail reloads.')
assert.ok(workbenchSource.includes('endpoint_hash_not_returned'), 'Delivery evidence from partial webhook responses should mark missing hashes honestly.')
assert.ok(workbenchSource.includes('scopedActionBody'), 'Workbench POST actions should carry selected org/tenant scope unless the backed action body already supplies it.')
assert.ok(workbenchSource.includes('webhookDeliveryResultMessage'), 'Webhook send/test actions should report backed delivery ids and statuses.')
assert.ok(workbenchSource.includes('alertWorkflowMutationBody'), 'Alert workflow mutations should send backend idempotency guards from /api/dwm/alerts/:id.')
assert.ok(workbenchSource.includes('expectedWorkflowEventCount'), 'Alert workflow mutations should include expectedWorkflowEventCount when alert detail returns it.')
assert.ok(workbenchSource.includes('expectedUpdatedAt'), 'Alert workflow mutations should include expectedUpdatedAt when alert detail returns it.')
assert.ok(workbenchSource.includes('AlertWorkflowReadiness'), 'Selected alert detail should expose workflow readiness and downstream handoff blockers.')
assert.ok(workbenchSource.includes('Workflow guard'), 'Selected alert inspection should label stale workflow and handoff blockers in operator language.')
assert.ok(workbenchSource.includes('downstreamHandoff'), 'Selected alert inspection should consume downstream handoff readiness from the backed alert API.')
assert.ok(workbenchSource.includes('recordCustomerNotification'), 'Selected backed cases should record customer notification receipts from the dashboard.')
assert.ok(workbenchSource.includes('caseCustomerNotificationHref'), 'Customer notification receipts should use the scoped /api/cases/:id/customer-notification proxy.')
assert.ok(workbenchSource.includes('Customer notification receipt requires decision rationale.'), 'Customer notification receipts should require analyst rationale before mutation.')
assert.ok(workbenchSource.includes('customerNotificationContext'), 'Case continuity should expose backed customer notification receipt state.')
assert.ok(caseCustomerNotificationProxySource.includes('/v1/cases/${encodeURIComponent(id)}/customer-notification'), 'Dashboard case notification proxy should forward to the TI case notification contract.')
assert.ok(workbenchSource.includes('caseExportHref'), 'Selected backed cases should expose the audit-safe case export route.')
assert.ok(workbenchSource.includes('Case export'), 'Selected backed case inspection should deep-link to the export payload.')
assert.ok(workbenchSource.includes('export_case_evidence'), 'Selected backed cases should expose evidence export in the operator action rail.')
assert.ok(caseExportProxySource.includes('/v1/cases/${encodeURIComponent(id)}/export'), 'Dashboard case export proxy should forward to the TI case export contract.')
assert.ok(dashboardModelSource.includes('/api/dwm/source-requests'), 'Source readiness case should call the source request endpoint.')
assert.ok(dashboardModelSource.includes('/api/dwm/canary/run'), 'Source readiness case should call the canary run endpoint.')
assert.ok(dashboardModelSource.includes('open_alert_generation_readiness'), 'Alert readiness case should expose the backed generation-readiness proof.')
assert.ok(dashboardModelSource.includes('/api/dwm/alerts/generation-readiness'), 'Alert readiness case should link to generation-readiness API.')
assert.ok(dashboardModelSource.includes('Inspect generation readiness before treating fallback rows as customer evidence.'), 'Fallback alert queue should name the exact generation-readiness blocker.')
assert.ok(productProgressRouteSource.includes('webhookProductProgressProof'), 'Product-progress route should consume webhook destination product-progress proof.')
assert.ok(productProgressRouteSource.includes('destinationAdminProof'), 'Product-progress route should read webhook destination admin proof.')
assert.ok(productProgressRouteSource.includes('dwm.webhook.destination_admin_product_progress.v1'), 'Webhook readiness should be backed by destination admin product-progress contract.')

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
    webhookProductProgressProof: 'adbe584b',
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
    'webhookProductProgressProof',
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
