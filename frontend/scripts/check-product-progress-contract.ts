import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS, PRODUCT_READINESS_PROOF_ROW_IDS, buildOrgOperatingContext, buildProductProgressExternalState, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationState, type DwmWatchlistSummary } from '../src/app/dashboard/operatorConsoleModel'
import { buildProductProgressPayload } from '../src/utils/productProgress/readiness'

const here = new URL('.', import.meta.url)
const workbenchSource = readFileSync(new URL('../src/app/dashboard/ti/workbench/workbenchClient.tsx', here), 'utf8')
const dashboardModelSource = readFileSync(new URL('../src/app/dashboard/operatorConsoleModel.ts', here), 'utf8')
const dashboardPageSource = readFileSync(new URL('../src/app/dashboard/page.tsx', here), 'utf8')

const generatedAt = '2026-06-29T08:00:00.000Z'
const routes = {
    productProgress: '/api/product-progress',
    publicTiProvenance: '/api/public-ti/provenance/readiness',
    helpdeskAudit: '/api/admin/support/readiness',
    deployProbe: '/api/product-progress',
    sourceProxy: '/api/ti/scraper/control?q=LockBit',
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
assert.equal(partialPayload.sourceProxy?.sourceInventory?.schemaVersion, 'dwm.source_inventory.v1')
assert.equal(partialPayload.dashboardEvidence?.visibleInDashboard, true)
assert.equal(partialPayload.dashboardEvidence?.deliveryEvidenceMatched, true)
assert.equal(partialPayload.dashboardEvidence?.sourceProxyReady, true)
assert.equal(partialPayload.dashboardEvidence?.deployProbeFresh, false)
assert.equal(partialPayload.deployProbe?.status, 'needs_action')
assert.equal(partialPayload.publicTiProvenance?.status, 'unavailable')
assert.equal(partialPayload.helpdeskAudit?.status, 'unavailable')
assert.equal(partialPayload.orgAlertExport?.status, 'unavailable')
assert.equal(partialPayload.webhookHealth?.status, 'needs_action')

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
    assert.equal(row.unavailableReason, row.status === 'unavailable' ? row.source : undefined)
}
for (const rowId of PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS) {
    assert.ok(partialContext.readiness.productReadiness.find(item => item.id === rowId), `Missing workflow row ${rowId}`)
}
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'dashboard_evidence')?.href, '/dashboard')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'source_inventory_probe')?.href, '/dashboard/ti/sources')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'webhook_delivery')?.href, '/dashboard/automations?setup=dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'org_alert_export')?.href, '/dashboard/dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'webhook_health')?.href, '/dashboard/automations?setup=dwm')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'helpdesk_audit')?.href, '/dashboard/system/impersonation')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'deploy_probe')?.href, '/status')
assert.equal(partialContext.readiness.productReadiness.find(item => item.id === 'public_ti_provenance')?.href, '/ti')

const readyPayload = {
    ...partialPayload,
    publicTiProvenance: { ...partialPayload.publicTiProvenance!, status: 'ready' as const, blockers: [], sourceCount: 3, evidenceCount: 5 },
    helpdeskAudit: { ...partialPayload.helpdeskAudit!, status: 'ready' as const, blockers: [], auditedActions: 2, openRecoveryRequests: 0 },
    orgAlertExport: { ...partialPayload.orgAlertExport!, status: 'ready' as const, blockers: [], activeTermCount: 1, canGenerateAlerts: true },
    webhookHealth: { ...partialPayload.webhookHealth!, status: 'ready' as const, blockers: [], destinationCount: 1, activeDestinationCount: 1, deliveryReadyCount: 1 },
    dashboardEvidence: { ...partialPayload.dashboardEvidence!, status: 'ready' as const, blockers: [], deployProbeFresh: true },
    deployProbe: { ...partialPayload.deployProbe!, status: 'ready' as const, blockers: [], apiHealthy: true, scraperHealthy: true, latestProbeAt: generatedAt },
}
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

for (const attribute of [
    'data-readiness-row-id',
    'data-readiness-state',
    'data-readiness-blocker-count',
    'data-readiness-deep-link-target',
    'data-readiness-proof-timestamp',
    'data-readiness-unavailable-reason',
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
}

assert.ok(workbenchSource.includes('return item.href ? <Link key={item.id} href={item.href}>'), 'Readiness rows should deep-link through the backed href.')
