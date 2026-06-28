import { buildReadinessCases, type DwmDeliveryItem, type DwmOperationsSnapshot, type DwmOrganizationState, type DwmWatchlistSummary } from './operatorConsoleModel'
import type { WorkbenchCase } from './ti/workbench/workbenchClient'

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

void _contract
void _requiresWorkflowPath
void _requiresBackedActions
