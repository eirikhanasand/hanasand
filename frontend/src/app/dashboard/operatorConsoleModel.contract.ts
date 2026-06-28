import { buildOrgOperatingContext, buildReadinessCases, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationState, type DwmWatchlistSummary } from './operatorConsoleModel'
import type { WorkbenchAction, WorkbenchActionOutcome, WorkbenchCase, WorkbenchCaseMutationPayload, WorkbenchDeliveryEvidence, WorkbenchInvitePayload, WorkbenchKeyboardState, WorkbenchOrgContext, WorkbenchReadinessEvidenceState, WorkbenchWatchlistUpsertPayload } from './ti/workbench/workbenchClient'

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
const orgContext = buildOrgOperatingContext({
    backendConfigured: true,
    scope: { tenantId: 'org_acme', organizationId: 'org_acme' },
    watchlists,
    organizationState,
    operations,
    deliveries,
    liveAlertCount: 1,
})
const blockedOrgContext = buildOrgOperatingContext({
    backendConfigured: false,
    scope: { tenantId: 'default' },
    watchlists: [],
    organizationState: { organizations: [], members: [], pendingInvites: [], webhooks: [] },
})

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
void _requiresWorkflowPath
void _requiresBackedActions
void (orgContext satisfies WorkbenchOrgContext)
void (orgContext.createWatchlistAction satisfies WorkbenchAction | undefined)
void (orgContext.readiness.sourceCoverage?.activeSourceCount satisfies number | undefined)
void (orgContext.readiness.latestDelivery satisfies WorkbenchDeliveryEvidence | undefined)
void (blockedOrgContext.readiness.blockedReasons satisfies string[])
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
