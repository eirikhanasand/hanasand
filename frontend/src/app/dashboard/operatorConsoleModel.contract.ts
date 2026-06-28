import { buildReadinessCases, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationState, type DwmWatchlistSummary } from './operatorConsoleModel'
import type { WorkbenchAction, WorkbenchCase, WorkbenchDeliveryEvidence } from './ti/workbench/workbenchClient'

const organizationState = {
    organizations: [{
        id: 'org_acme',
        tenantId: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        status: 'active',
        createdAt: '2026-06-28T10:00:00.000Z',
        updatedAt: '2026-06-28T10:05:00.000Z',
    }],
    selectedOrganization: {
        id: 'org_acme',
        tenantId: 'org_acme',
        name: 'Acme Security',
        slug: 'acme-security',
        status: 'active',
        createdAt: '2026-06-28T10:00:00.000Z',
        updatedAt: '2026-06-28T10:05:00.000Z',
    },
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

void _contract
void _requiresWorkflowPath
void _requiresBackedActions
void (selectedLiveAlert.actions satisfies WorkbenchAction[])
void (selectedLiveAlert.deliveryEvidence satisfies WorkbenchDeliveryEvidence[])
