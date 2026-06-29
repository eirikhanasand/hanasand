import { PUBLIC_TI_HANDOFF_ACTIONS, PUBLIC_TI_HANDOFF_SCHEMA_VERSION, PUBLIC_TI_HANDOFF_SOURCE, validatePublicTiHandoffPayload, type PublicTiHandoffPayload } from '@/utils/ti/actorWorkbench'
import { applyScope, buildOrgOperatingContext, buildPublicTiHandoffCase, buildReadinessCases, resolveDashboardViewerIdentity, type DwmAlertAccessState, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationState, type DwmWatchlistSummary, type ProductReadinessExternalState } from './operatorConsoleModel'
import type { OperatorActionRailRow, WorkbenchAction, WorkbenchActionOutcome, WorkbenchCase, WorkbenchCaseMutationPayload, WorkbenchDeliveryEvidence, WorkbenchInvitePayload, WorkbenchKeyboardState, WorkbenchOrgContext, WorkbenchProductReadinessItem, WorkbenchPublicTiHandoff, WorkbenchReadinessEvidenceState, WorkbenchWatchlistUpsertPayload } from './ti/workbench/workbenchClient'

const organizationState = {
    organizations: [{
        id: 'org_acme',
        tenantId: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        status: 'active',
        alertVisibilityPolicy: 'admins',
        createdAt: '2026-06-28T10:00:00.000Z',
        updatedAt: '2026-06-28T10:05:00.000Z',
    }],
    selectedOrganization: {
        id: 'org_acme',
        tenantId: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        status: 'active',
        alertVisibilityPolicy: 'admins',
        createdAt: '2026-06-28T10:00:00.000Z',
        updatedAt: '2026-06-28T10:05:00.000Z',
    },
    members: [{
        id: 'mem_owner',
        organizationId: 'org_acme',
        email: 'owner@acme.example',
        role: 'owner',
        status: 'active',
        acceptedAt: '2026-06-28T10:01:00.000Z',
        createdAt: '2026-06-28T10:01:00.000Z',
        updatedAt: '2026-06-28T10:01:00.000Z',
    }, {
        id: 'mem_viewer',
        organizationId: 'org_acme',
        email: 'viewer@acme.example',
        role: 'viewer',
        status: 'active',
        acceptedAt: '2026-06-28T10:02:00.000Z',
        createdAt: '2026-06-28T10:02:00.000Z',
        updatedAt: '2026-06-28T10:02:00.000Z',
    }],
    pendingInvites: [{
        id: 'invite_analyst',
        organizationId: 'org_acme',
        email: 'analyst@acme.example',
        role: 'analyst',
        status: 'pending',
        invitedAt: '2026-06-28T10:03:00.000Z',
        expiresAt: '2026-07-12T10:03:00.000Z',
        updatedAt: '2026-06-28T10:03:00.000Z',
    }],
    webhooks: [{
        id: 'wh_discord_soc',
        organizationId: 'org_acme',
        tenantId: 'org_acme',
        name: 'SOC Discord',
        kind: 'discord',
        status: 'active',
        createdAt: '2026-06-28T10:06:00.000Z',
        updatedAt: '2026-06-28T10:07:00.000Z',
        lastTestedAt: '2026-06-28T10:08:00.000Z',
        lastTestStatus: 'delivered',
    }],
} satisfies DwmOrganizationState

const watchlists = [{
    id: 'wl_acme_exposure',
    tenantId: 'org_acme',
    organizationId: 'org_acme',
    name: 'Shared Acme exposure watchlist',
    terms: [{ value: 'acme.com', kind: 'domain' }],
    webhookDestinationId: 'wh_discord_soc',
    status: 'active',
    createdAt: '2026-06-28T10:09:00.000Z',
    updatedAt: '2026-06-28T10:10:00.000Z',
}] satisfies DwmWatchlistSummary[]

const operations = {
    counts: {
        sourceCount: 12,
        activeSourceCount: 9,
        captureCount: 42,
        watchlistMatchCount: 3,
    },
    latestRun: {
        status: 'completed',
        updatedAt: '2026-06-28T10:11:00.000Z',
        captureCount: 8,
    },
} satisfies DwmOperationsSnapshot

const deliveries = [{
    id: 'deliv_acme_1',
    alertId: 'alert_acme_1',
    watchlistId: 'wl_acme_exposure',
    organizationId: 'org_acme',
    webhookDestinationId: 'wh_discord_soc',
    endpointHash: 'endpoint:discord',
    attemptedAt: '2026-06-28T10:12:00.000Z',
    payloadHash: 'payload:alert_acme_1',
    status: 'delivered',
    deliveryKind: 'discord',
}] satisfies DwmDeliveryItem[]

const externalReadiness = {
    publicTiProvenance: {
        schemaVersion: 'ti.public_provenance.readiness.v1',
        status: 'ready',
        query: 'akira',
        artifactCount: 3,
        sourceCount: 4,
        evidenceCount: 6,
        dashboardHandoffCount: 1,
        latestArtifactAt: '2026-06-28T10:15:00.000Z',
        checkedAt: '2026-06-28T10:16:00.000Z',
        source: 'GET /api/public-ti/provenance/readiness',
        href: '/ti/akira',
    },
    helpdeskAudit: {
        schemaVersion: 'support.audit.readiness.v1',
        status: 'ready',
        auditedActions: 8,
        openRecoveryRequests: 0,
        impersonationSessions: 0,
        supportQueueDepth: 1,
        latestAuditEventAt: '2026-06-28T10:17:00.000Z',
        source: 'GET /api/admin/support/readiness',
    },
    deployProbe: {
        schemaVersion: 'product.deploy_probe.readiness.v1',
        status: 'ready',
        deployedCommit: 'a4ebed05',
        frontendHealthy: true,
        apiHealthy: true,
        scraperHealthy: true,
        latestProbeAt: '2026-06-28T10:18:00.000Z',
        dashboardAlertId: 'alert_acme_1',
        deliveryId: 'deliv_acme_1',
        ledgerPath: '/tmp/hanasand-integration-ledger.md',
        source: 'GET /api/product-progress',
    },
    sourceGrowth: {
        schemaVersion: 'dwm.source_inventory.v1',
        status: 'needs_action',
        proxyExposed: false,
        registeredTotal: 349,
        activeSourceCount: 349,
        catalogCandidates: 8000,
        netNewCandidates: 7816,
        duplicateCandidates: 184,
        reviewQueueCount: 8000,
        latestInventoryAt: '2026-06-28T10:19:00.000Z',
        checkedAt: '2026-06-28T10:19:00.000Z',
        source: 'Scraper network /v1/dwm/source-inventory; missing frontend proxy',
    },
} satisfies ProductReadinessExternalState
const operatorReachableExternalReadiness = {
    ...externalReadiness,
    sourceGrowth: {
        ...externalReadiness.sourceGrowth,
        status: 'ready',
        proxyExposed: true,
        source: 'GET /api/dwm/source-inventory',
        href: '/dashboard/ti/sources',
    },
} satisfies ProductReadinessExternalState

const cases = buildReadinessCases({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    operations,
    deliveries,
    organizationState,
    liveAlertCount: 1,
    renderedAlertCount: 1,
})
const liveProofOrganizationState = {
    organizations: [{
        id: 'hanasand-live-proof-20260628',
        tenantId: 'hanasand-live-proof-20260628',
        name: 'Hanasand live proof',
        slug: 'hanasand-live-proof-20260628',
        status: 'active',
        alertVisibilityPolicy: 'members',
        createdAt: '2026-06-28T12:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
    }],
    selectedOrganization: {
        id: 'hanasand-live-proof-20260628',
        tenantId: 'hanasand-live-proof-20260628',
        name: 'Hanasand live proof',
        slug: 'hanasand-live-proof-20260628',
        status: 'active',
        alertVisibilityPolicy: 'members',
        createdAt: '2026-06-28T12:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
    },
    members: [{
        id: 'mem_live_proof',
        organizationId: 'hanasand-live-proof-20260628',
        email: 'live-proof@hanasand.com',
        userId: 'user_live_proof',
        role: 'owner',
        status: 'active',
        acceptedAt: '2026-06-28T12:00:00.000Z',
        createdAt: '2026-06-28T12:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
    }],
    pendingInvites: [],
    webhooks: [],
} satisfies DwmOrganizationState
const liveProofIdentity = resolveDashboardViewerIdentity({
    userId: 'user_live_proof',
    userName: 'Live Proof',
    members: liveProofOrganizationState.members,
})
const liveProofAlertsUrl = new URL('https://ti-scraper.example/v1/dwm/alerts')
applyScope(liveProofAlertsUrl, { tenantId: 'hanasand-live-proof-20260628', organizationId: 'hanasand-live-proof-20260628' }, liveProofIdentity)
const deniedAlertAccess = {
    status: 'visibility_denied',
    code: 'organization_visibility_denied',
    message: 'DWM alert access requires an active organization member identity.',
    reason: 'not_member',
    attemptedIdentity: { source: 'anonymous' },
} satisfies DwmAlertAccessState
const deniedAlertReadinessCases = buildReadinessCases({
    backendConfigured: true,
    scope: { tenantId: 'hanasand-live-proof-20260628', organizationId: 'hanasand-live-proof-20260628' },
    watchlists: [],
    operations: null,
    deliveries: [],
    organizationState: liveProofOrganizationState,
    liveAlertCount: 0,
    renderedAlertCount: 1,
    alertAccessState: deniedAlertAccess,
})
const orgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness,
})
const sourceProofOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_acme_1'],
    externalReadiness: operatorReachableExternalReadiness,
})
const blockedDeliveryOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
    liveAlertIds: ['alert_without_delivery'],
    externalReadiness,
})
const blockedAlertOrgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 0,
    liveAlertIds: [],
})
const blockedOrgContext = buildOrgOperatingContext({
    backendConfigured: false,
    scope: { tenantId: 'default' },
    watchlists: [],
    organizationState: { organizations: [], members: [], pendingInvites: [], webhooks: [] },
})
const publicTiWatchlistPayload = {
    schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
    source: PUBLIC_TI_HANDOFF_SOURCE,
    action: PUBLIC_TI_HANDOFF_ACTIONS.watchlist,
    artifactId: 'infrastructure:portal-acme-com',
    query: 'akira',
    generatedAt: '2026-06-28T10:20:00.000Z',
    artifact: {
        id: 'infrastructure:portal-acme-com',
        kind: 'infrastructure',
        label: 'portal.acme.com',
        confidence: 86,
        freshness: '2026-06-28T10:19:00.000Z',
        evidence: ['portal.acme.com appeared in public TI actor context.'],
        provenance: ['public-ti:actor:akira'],
        watchlistTerms: [{ kind: 'domain', value: 'portal.acme.com', notes: 'akira: actor infrastructure artifact' }],
        enrichmentTasks: ['Attach source-level evidence for portal.acme.com before customer routing.'],
        readiness: { state: 'ready_for_org_handoff', label: 'Ready for org handoff', blockers: [] },
    },
    selectedPayload: {
        schemaVersion: 'ti.public_actor.watchlist_handoff.v1',
        query: 'akira',
        generatedAt: '2026-06-28T10:20:00.000Z',
        route: 'watchlist',
        method: 'POST',
        endpoint: '/api/organizations/:id/watchlists',
        backedRoute: '/dashboard/dwm',
        blocked: false,
        missing: [],
        body: { name: 'akira watchlist', terms: [{ kind: 'domain', value: 'portal.acme.com', notes: 'akira: actor infrastructure artifact' }] },
        provenance: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86 }],
    },
    actionPayloads: {
        watchlist: {
            schemaVersion: 'ti.public_actor.watchlist_handoff.v1',
            query: 'akira',
            generatedAt: '2026-06-28T10:20:00.000Z',
            route: 'watchlist',
            method: 'POST',
            endpoint: '/api/organizations/:id/watchlists',
            backedRoute: '/dashboard/dwm',
            blocked: false,
            missing: [],
            body: { name: 'akira watchlist', terms: [{ kind: 'domain', value: 'portal.acme.com', notes: 'akira: actor infrastructure artifact' }] },
            provenance: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86 }],
        },
        alertRebuild: {
            schemaVersion: 'ti.public_actor.alert_rebuild_handoff.v1',
            query: 'akira',
            generatedAt: '2026-06-28T10:20:00.000Z',
            route: 'alert_rebuild',
            method: 'POST',
            endpoint: '/v1/dwm/alerts/rebuild',
            backedRoute: '/dashboard/dwm',
            blocked: false,
            missing: [],
            body: { query: 'akira', watchTerms: [{ kind: 'domain', value: 'portal.acme.com', notes: 'akira: actor infrastructure artifact' }] },
            provenance: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86 }],
        },
        case: {
            schemaVersion: 'ti.public_actor.case_handoff.v1',
            query: 'akira',
            generatedAt: '2026-06-28T10:20:00.000Z',
            route: 'case',
            method: 'POST',
            endpoint: '/v1/cases',
            backedRoute: '/dashboard/ti/workbench',
            blocked: false,
            missing: [],
            body: { sourceType: 'ti_actor', sourceId: 'akira', title: 'akira actor/query review', priority: 'medium' },
            provenance: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86 }],
        },
        enrichment: {
            schemaVersion: 'ti.public_actor.enrichment_queue.v1',
            query: 'akira',
            generatedAt: '2026-06-28T10:20:00.000Z',
            route: 'enrichment_queue',
            backedRoute: '/dashboard/ti/enrichment',
            blocked: false,
            missing: [],
            body: { query: 'akira', tasks: [{ id: 'task_1', title: 'Attach source-level evidence', severity: 'high', detail: 'Attach source-level evidence for portal.acme.com.', dependency: 'sourceProvenance capture id or source URL' }] },
            provenance: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86 }],
        },
    },
    orgRequired: true,
    sourceRequired: false,
    stale: false,
    missing: [],
    blockers: [{ code: 'org_required', detail: 'Open this payload in an authenticated organization context before creating watchlists, rebuilding alerts, or creating cases.' }],
    sourceRequests: [{ sourceName: 'Public TI', provenance: 'public-ti:actor:akira', captureId: 'cap_public_ti_akira', confidence: 86, missing: [] }],
} satisfies PublicTiHandoffPayload
const stalePublicTiPayload = {
    ...publicTiWatchlistPayload,
    artifactId: 'tool:old-loader',
    generatedAt: '2026-06-28T10:21:00.000Z',
    stale: true,
    missing: ['fresh source after 2025-01-01'],
    artifact: {
        ...publicTiWatchlistPayload.artifact,
        id: 'tool:old-loader',
        kind: 'tool',
        label: 'Old Loader',
        freshness: '2025-01-01T00:00:00.000Z',
        readiness: { state: 'stale', label: 'Stale evidence', blockers: ['fresh source after 2025-01-01'] },
    },
    blockers: [{ code: 'stale_evidence', detail: 'Fresh source is required after 2025-01-01 before claiming alert-ready status.' }],
} satisfies PublicTiHandoffPayload
const publicTiDecode = validatePublicTiHandoffPayload(publicTiWatchlistPayload)
const malformedPublicTiDecode = validatePublicTiHandoffPayload({ schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION, source: PUBLIC_TI_HANDOFF_SOURCE, action: 'nope' })
const stalePublicTiDecode = validatePublicTiHandoffPayload(stalePublicTiPayload)
const publicTiCases = buildPublicTiHandoffCase({
    decode: publicTiDecode,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    organizationState,
    watchlists,
    operations,
    liveAlertCount: 1,
})
const malformedPublicTiCases = buildPublicTiHandoffCase({
    decode: malformedPublicTiDecode,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    organizationState,
    watchlists,
    operations,
    liveAlertCount: 1,
})
const orgRequiredPublicTiCases = buildPublicTiHandoffCase({
    decode: publicTiDecode,
    scope: { tenantId: 'default' },
    organizationState: { organizations: [], members: [], pendingInvites: [], webhooks: [] },
    watchlists: [],
    operations,
    liveAlertCount: 0,
})
const stalePublicTiCases = buildPublicTiHandoffCase({
    decode: stalePublicTiDecode,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    organizationState,
    watchlists,
    operations,
    liveAlertCount: 1,
})
const handoffActionRailStates = [
    { id: 'handoff_watchlist', label: 'Add org watchlist term', detail: 'domain:portal.acme.com', tone: 'ready', action: { id: 'public_ti_create_watchlist', label: 'Add term', method: 'POST', href: '/api/dwm/watchlists', body: { organizationId: 'org_acme' } } },
    { id: 'handoff_source', label: 'Request source pack', detail: 'Source pack mutation API is not loaded here; copy exact handoff or open source ops.', tone: 'blocked', href: '/dashboard/ti/sources', copyPayload: publicTiWatchlistPayload },
    { id: 'handoff_copy', label: 'Exact handoff', detail: 'create watchlist payload for portal.acme.com.', tone: 'ready', copyPayload: publicTiWatchlistPayload },
] satisfies OperatorActionRailRow[]

const _contract: WorkbenchCase[] = cases
const _requiresWorkflowPath: NonNullable<WorkbenchCase['workflowPath']> = cases[0]?.workflowPath || []
const _requiresBackedActions: NonNullable<WorkbenchCase['actions']> = cases.find(item => item.kind === 'webhook_readiness')?.actions || []
const selectedLiveAlert = {
    id: 'alert_acme_1',
    kind: 'dwm_alert',
    queue: 'Incident response',
    title: 'Acme Security',
    subtitle: 'acme.com matched backed DWM evidence.',
    severity: 'critical',
    status: 'needs_review',
    priority: 491,
    confidence: 91,
    owner: 'unassigned',
    createdAt: '2026-06-28T10:12:00.000Z',
    updatedAt: '2026-06-28T10:12:00.000Z',
    company: 'Acme Security',
    matchedTerm: 'acme.com',
    actor: 'Lumma C2',
    sourceLabel: '1 source',
    recommendedAction: 'Open the backed case, replay evidence, then send only after delivery evidence exists.',
    routeLabel: 'incident response',
    persistent: true,
    evidence: [{
        id: 'ev_acme_1',
        sourceName: 'Public Telegram',
        sourceFamily: 'telegram public',
        captureMode: 'public message',
        redactionState: 'redacted',
        contentHash: 'hash:acme',
        excerpt: 'acme.com appeared in a redacted public source.',
        observedAt: '2026-06-28T10:12:00.000Z',
        provenance: 'src_public · cap_acme_1 · public_message',
        confidence: 91,
    }],
    timeline: [{ id: 'alert_acme_1_seen', at: '2026-06-28T10:12:00.000Z', title: 'Alert created', body: 'acme.com matched 1 source.' }],
    nextTasks: ['Owner: analyst. Alert ID: alert_acme_1.', 'Case ID: case_acme_1. Update the backed case before closing.', 'Webhook destination IDs: wh_discord_soc.'],
    relatedLinks: [{ href: '/api/cases/case_acme_1?organizationId=org_acme', label: 'Case API' }],
    workflowPath: [{
        id: 'alert_path_case',
        label: 'Analyst case',
        status: 'ready',
        owner: 'analyst',
        source: 'POST /api/cases',
        detail: 'Case candidate case_acme_1.',
        entityId: 'case_acme_1',
        href: '/api/cases/case_acme_1?organizationId=org_acme',
    }],
    actions: [
        { id: 'open_case', label: 'Update case', method: 'POST', href: '/api/cases', body: { organizationId: 'org_acme', alertId: 'alert_acme_1', reopen: true } },
        { id: 'send_alert', label: 'Send alert', method: 'POST', href: '/api/dwm/webhooks/deliver', body: { organizationId: 'org_acme', alertId: 'alert_acme_1', limit: 1 } },
        { id: 'test_org_webhook', label: 'Test org webhook', method: 'POST', href: '/api/organizations/org_acme/webhooks/test', body: { webhookDestinationId: 'wh_discord_soc', dryRun: true } },
    ],
    caseDetailHref: '/api/cases/case_acme_1?organizationId=org_acme',
    deliveryEvidence: deliveries,
} satisfies WorkbenchCase

const liveCaseMutationPayloads = [
    { action: 'assign', actor: 'dashboard', assignedOwner: 'analyst-1', note: 'Assigned from the root operator console.' },
    { action: 'note', actor: 'dashboard', assignedOwner: 'analyst-1', note: 'Evidence reviewed from selected case detail.' },
    { action: 'escalate', actor: 'dashboard', assignedOwner: 'ir-lead', note: 'Customer-owned domain and delivery route confirmed.' },
    { action: 'suppress', actor: 'dashboard', assignedOwner: 'analyst-1', note: 'Suppressed as low-value or false positive after evidence review.' },
    { action: 'close', actor: 'dashboard', assignedOwner: 'analyst-1', note: 'Closed after backed evidence and delivery state were reviewed.' },
    { action: 'reopen', actor: 'dashboard', assignedOwner: 'analyst-1', note: 'Reopened because new evidence requires review.' },
] satisfies WorkbenchCaseMutationPayload[]
const memberPickerAssignment = { action: 'assign', actor: 'dashboard', assignedOwner: 'owner@acme.example', note: 'Assigned from org member picker.' } satisfies WorkbenchCaseMutationPayload
const invitePayload = { email: 'new-analyst@acme.example', role: 'analyst', invitedBy: 'dashboard' } satisfies WorkbenchInvitePayload
const watchlistAddPayload = {
    organizationId: 'org_acme',
    name: 'Acme Security shared exposure watchlist',
    terms: [{ value: 'portal.acme.com', kind: 'domain' }],
    status: 'active',
    webhookDestinationId: 'wh_discord_soc',
} satisfies WorkbenchWatchlistUpsertPayload
const watchlistPausePayload = {
    id: 'wl_acme_exposure',
    organizationId: 'org_acme',
    name: 'Shared Acme exposure watchlist',
    terms: [{ value: 'acme.com', kind: 'domain' }],
    status: 'paused',
    webhookDestinationId: 'wh_discord_soc',
} satisfies WorkbenchWatchlistUpsertPayload
const missingWatchlistPatchEndpoint = 'PATCH/DELETE /api/dwm/watchlists/:id is not available; use POST /api/dwm/watchlists upsert or pause the watchlist.'
const keyboardSelectionState = {
    selectedId: 'alert_acme_1',
    focusedRegion: 'queue',
    lastKey: 'ArrowDown',
} satisfies WorkbenchKeyboardState
const actionOutcome = {
    ok: true,
    text: 'Case case_acme_1 owner saved.',
    source: 'case_mutation',
} satisfies WorkbenchActionOutcome
const readinessEvidenceReady = {
    status: 'ready',
    webhookDestinationId: 'wh_discord_soc',
    deliveryId: 'deliv_acme_1',
    activeSourceCount: operations.counts.activeSourceCount,
    sourceCount: operations.counts.sourceCount,
} satisfies WorkbenchReadinessEvidenceState
const readinessEvidenceBlocked = {
    status: 'blocked',
    reason: 'No delivery rows are available from /api/dwm/webhooks/deliveries.',
    activeSourceCount: 0,
    sourceCount: 0,
} satisfies WorkbenchReadinessEvidenceState

function expectProductReadinessStatus(context: WorkbenchOrgContext, id: string, status: WorkbenchProductReadinessItem['status']) {
    const item = context.readiness.productReadiness.find(row => row.id === id)
    if (!item || item.status !== status) {
        throw new Error(`Expected ${id} to be ${status}, got ${item?.status || 'missing'}.`)
    }
    return item
}

const blockedFallbackAlert = {
    ...selectedLiveAlert,
    id: 'fallback_alert_acme',
    persistent: false,
    actions: [],
    caseDetailHref: undefined,
    deliveryEvidence: [],
    missingDependency: 'This is a fallback alert. It cannot PATCH /api/cases/:id until live DWM alerts return a backed case ID.',
} satisfies WorkbenchCase

const visibleCaseDetail = {
    generatedAt: '2026-06-28T10:13:00.000Z',
    access: {
        memberId: 'mem_owner',
        role: 'owner',
        readOnly: false,
        visibilityDecision: {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'admins',
            allowedRoles: ['owner', 'admin'],
        },
    },
    case: {
        id: 'case_acme_1',
        alertId: 'alert_acme_1',
        title: 'CRITICAL Acme Security',
        summary: 'acme.com matched backed DWM evidence.',
        status: 'open',
        assignedOwner: 'owner@acme.example',
        updatedAt: '2026-06-28T10:13:00.000Z',
        lastDecision: 'Confirmed customer-owned term; delivery route ready.',
        workflowEvents: [{
            id: 'evt_assign_1',
            at: '2026-06-28T10:13:00.000Z',
            actor: 'dashboard',
            action: 'assign',
            fromOwner: 'unassigned',
            toOwner: 'owner@acme.example',
            note: 'Assigned from org member picker.',
        }, {
            id: 'evt_note_1',
            at: '2026-06-28T10:14:00.000Z',
            actor: 'dashboard',
            action: 'note',
            note: 'Evidence reviewed from selected case detail.',
        }],
    },
    deliveryContext: {
        deliveryCount: 1,
        latestDelivery: deliveries[0],
        delivered: true,
        retryable: false,
        failed: [],
    },
    timeline: [{
        id: 'evt_assign_1',
        at: '2026-06-28T10:13:00.000Z',
        title: 'assign',
        detail: 'Assigned from org member picker. · Owner: owner@acme.example',
        eventType: 'case.assign',
        actor: 'dashboard',
        rationale: 'Assigned from org member picker.',
        fromOwner: 'unassigned',
        toOwner: 'owner@acme.example',
    }],
    nextAllowedActions: [
        { id: 'assign', label: 'Assign owner', method: 'PATCH', enabled: true },
        { id: 'close', label: 'Close', method: 'PATCH', requiresRationale: true, enabled: true },
        { id: 'deliver_webhook', label: 'Deliver webhook', method: 'POST', enabled: true },
    ],
}
const readOnlyCaseDetail = {
    generatedAt: '2026-06-28T10:14:00.000Z',
    access: {
        memberId: 'mem_viewer',
        role: 'viewer',
        readOnly: true,
        visibilityDecision: {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'members',
            allowedRoles: ['owner', 'admin', 'analyst', 'member', 'viewer'],
        },
    },
}

void _contract
void (liveProofIdentity.userEmail satisfies string | undefined)
void (liveProofAlertsUrl.searchParams.get('userEmail') satisfies string | null)
void (liveProofAlertsUrl.searchParams.get('organizationId') satisfies string | null)
void (deniedAlertReadinessCases.find(item => item.kind === 'alert_readiness')?.status satisfies string | undefined)
void (deniedAlertReadinessCases.find(item => item.kind === 'alert_readiness')?.missingDependency satisfies string | undefined)
void _requiresWorkflowPath
void _requiresBackedActions
void (orgContext satisfies WorkbenchOrgContext)
void (orgContext.createWatchlistAction satisfies WorkbenchAction | undefined)
void (orgContext.readiness.sourceCoverage?.activeSourceCount satisfies number | undefined)
void (orgContext.readiness.latestDelivery satisfies WorkbenchDeliveryEvidence | undefined)
void (orgContext.readiness.fullChainReady satisfies boolean)
void (orgContext.readiness.productReadiness[0]?.status satisfies string | undefined)
void expectProductReadinessStatus(sourceProofOrgContext, 'source_inventory_probe', 'ready')
void (sourceProofOrgContext.readiness.fullChainReady satisfies boolean)
void expectProductReadinessStatus(orgContext, 'public_ti_provenance', 'ready')
void expectProductReadinessStatus(orgContext, 'helpdesk_audit', 'ready')
void expectProductReadinessStatus(orgContext, 'deploy_probe', 'ready')
void (blockedDeliveryOrgContext.readiness.fullChainReady satisfies boolean)
void (blockedDeliveryOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void expectProductReadinessStatus(blockedDeliveryOrgContext, 'webhook_delivery', 'needs_action')
void (blockedAlertOrgContext.readiness.fullChainReady satisfies boolean)
void (blockedAlertOrgContext.readiness.fullChainBlockedBy[0] satisfies string | undefined)
void (blockedAlertOrgContext.readiness.productReadiness.find(item => item.id === 'dashboard_alert')?.status satisfies string | undefined)
void expectProductReadinessStatus(orgContext, 'source_inventory_probe', 'needs_action')
void (blockedOrgContext.readiness.blockedReasons satisfies string[])
void (publicTiDecode.ok satisfies boolean)
void (malformedPublicTiDecode.ok satisfies boolean)
void (publicTiCases[0]?.handoff satisfies WorkbenchPublicTiHandoff | undefined)
void (malformedPublicTiCases[0]?.status satisfies string | undefined)
void (orgRequiredPublicTiCases[0]?.status satisfies string | undefined)
void (stalePublicTiCases[0]?.handoff?.stale satisfies boolean | undefined)
void (handoffActionRailStates satisfies OperatorActionRailRow[])
void (selectedLiveAlert.actions satisfies WorkbenchAction[])
void (selectedLiveAlert.deliveryEvidence satisfies WorkbenchDeliveryEvidence[])
void (liveCaseMutationPayloads satisfies WorkbenchCaseMutationPayload[])
void (memberPickerAssignment satisfies WorkbenchCaseMutationPayload)
void (invitePayload satisfies WorkbenchInvitePayload)
void (watchlistAddPayload satisfies WorkbenchWatchlistUpsertPayload)
void (watchlistPausePayload satisfies WorkbenchWatchlistUpsertPayload)
void (missingWatchlistPatchEndpoint satisfies string)
void (keyboardSelectionState satisfies WorkbenchKeyboardState)
void (actionOutcome satisfies WorkbenchActionOutcome)
void (readinessEvidenceReady satisfies WorkbenchReadinessEvidenceState)
void (readinessEvidenceBlocked satisfies WorkbenchReadinessEvidenceState)
void (blockedFallbackAlert.missingDependency satisfies string)
void (visibleCaseDetail.case.workflowEvents[0]?.toOwner satisfies string | undefined)
void (visibleCaseDetail.nextAllowedActions[0]?.id satisfies string | undefined)
void (visibleCaseDetail.access.visibilityDecision.allowedRoles satisfies string[])
void (readOnlyCaseDetail.access.readOnly satisfies boolean)
