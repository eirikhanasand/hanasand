import { strict as assert } from 'node:assert'
import test from 'node:test'
import { dwmAlertToWorkbenchCase } from '../src/app/dashboard/ti/workbench/dwmAlertAdapter'
import type { DwmAlert } from '../src/utils/dwm/product'

const alert = {
    id: 'dwm_alert_org_acme_lumma',
    eventType: 'darkweb.monitoring.match',
    tenantId: 'tenant_acme',
    organizationId: 'org_acme',
    severity: 'critical',
    confidence: 92,
    matchedTerm: { value: 'acme.com', kind: 'domain' },
    company: 'Acme Payments',
    actor: 'Lumma C2',
    artifactType: 'credential_exposure',
    sourceFamily: 'telegram_public',
    sourceCount: 2,
    firstSeenAt: '2026-06-29T10:00:00.000Z',
    lastSeenAt: '2026-06-29T10:08:00.000Z',
    updatedAt: '2026-06-29T10:09:00.000Z',
    claimSummary: 'A watched Acme domain appeared in public broker-room metadata and an actor mirror.',
    reviewState: 'needs_review',
    workflowStatus: 'investigating',
    assignedOwner: 'analyst@acme.example',
    recommendedAction: 'Validate identity exposure and route to incident response.',
    recommendedRoute: 'incident_response',
    caseId: 'case_acme_lumma',
    casePath: '/v1/cases/case_acme_lumma?alertId=dwm_alert_org_acme_lumma',
    watchlistIds: ['watch_acme_domains'],
    watchlistItemIds: ['watch_item_acme_domain'],
    evidence: [
        {
            id: 'ev_tg_acme',
            sourceName: 'Public Telegram broker-room coverage',
            sourceFamily: 'telegram_public',
            captureMode: 'public_message',
            redactionState: 'redacted',
            contentHash: 'hash_tg_acme',
            excerpt: 'acme.com appeared in a redacted public broker-room listing.',
            observedAt: '2026-06-29T10:01:00.000Z',
            provenance: {
                captureId: 'cap_tg_acme',
                sourceId: 'src_tg_broker_room',
                captureMode: 'public_message',
                metadataOnly: false,
            },
        },
        {
            id: 'ev_onion_acme',
            sourceName: 'Actor-page metadata mirror',
            sourceFamily: 'darkweb_metadata',
            captureMode: 'metadata_only',
            redactionState: 'metadata_only',
            contentHash: 'hash_onion_acme',
            excerpt: 'Actor mirror metadata names Acme Payments as a claimed target.',
            observedAt: '2026-06-29T10:03:00.000Z',
            provenance: {
                captureId: 'cap_onion_acme',
                sourceId: 'src_onion_actor',
                captureMode: 'metadata_only',
                metadataOnly: true,
            },
        },
    ],
    webhookDelivery: {
        recommendedRoute: 'incident_response',
        payloadHash: 'payload_hash_acme',
        dedupeKey: 'dwm_dedupe_acme_lumma',
    },
    workflowContext: {
        organizationId: 'org_acme',
        caseIdCandidate: 'case_acme_lumma',
        casePath: '/v1/cases/case_acme_lumma?alertId=dwm_alert_org_acme_lumma',
        watchlistIds: ['watch_acme_domains'],
        watchlistItemIds: ['watch_item_acme_domain'],
        captureIds: ['cap_tg_acme', 'cap_onion_acme'],
        sourceIds: ['src_tg_broker_room', 'src_onion_actor'],
        webhookDestinationIds: ['webhook_acme_security'],
        evidenceCount: 2,
        duplicateEvidenceSuppression: { suppressedCount: 1, suppressedCaptureIds: ['cap_tg_acme_duplicate'] },
    },
    sourceProvenanceSummary: {
        sourceFamily: 'telegram_public',
        sourceFamilies: ['telegram_public', 'darkweb_metadata'],
        captureIds: ['cap_tg_acme', 'cap_onion_acme'],
        sourceIds: ['src_tg_broker_room', 'src_onion_actor'],
        contentHashes: ['hash_tg_acme', 'hash_onion_acme'],
        provenanceGaps: [],
        generationEvidenceWindow: {
            captureIds: ['cap_tg_acme', 'cap_onion_acme'],
            sourceFamilies: ['telegram_public', 'darkweb_metadata'],
            firstSeenAt: '2026-06-29T10:01:00.000Z',
            lastSeenAt: '2026-06-29T10:03:00.000Z',
        },
    },
    orgWatchlistScope: {
        organizationId: 'org_acme',
        watchlistIds: ['watch_acme_domains'],
        watchlistItemIds: ['watch_item_acme_domain'],
        alertGenerationRefs: [{ key: 'org_acme:watch_item_acme_domain:acme.com' }],
    },
    customerReadiness: {
        ready: true,
        state: 'ready',
        alertReadiness: {
            selectedCaptureIds: ['cap_tg_acme', 'cap_onion_acme'],
            watchlistIds: ['watch_acme_domains'],
            watchlistItemIds: ['watch_item_acme_domain'],
            recommendedRoute: 'incident_response',
            blockerCodes: [],
        },
        caseHandoff: {
            ready: true,
            caseId: 'case_acme_lumma',
            casePath: '/v1/cases/case_acme_lumma?alertId=dwm_alert_org_acme_lumma',
        },
        deliveryReadiness: {
            ready: true,
            selectedWebhookDestinationId: 'webhook_acme_security',
            webhookDestinationIds: ['webhook_acme_security'],
            blockerCodes: [],
        },
        webhookReplayReadiness: {
            ready: true,
            blockerCodes: [],
            deliveryHistoryRefs: ['delivery_acme_security'],
        },
        workflowReadiness: {
            ready: true,
            status: 'investigating',
            assignedOwner: 'analyst@acme.example',
            eventCount: 2,
        },
        blockerCodes: [],
    },
    workflowEvents: [
        {
            id: 'event_assign',
            at: '2026-06-29T10:05:00.000Z',
            eventType: 'workflow.transition',
            toWorkflowStatus: 'investigating',
            toOwner: 'analyst@acme.example',
            note: 'Assigned after duplicate evidence was suppressed.',
        },
    ],
    deliveries: [{
        id: 'delivery_acme_security',
        alertId: 'dwm_alert_org_acme_lumma',
        status: 'dry_run',
        deliveryKind: 'webhook',
        attemptedAt: '2026-06-29T10:06:00.000Z',
        webhookDestinationId: 'webhook_acme_security',
        endpointHash: 'endpoint_hash_acme',
        payloadHash: 'payload_hash_acme',
        httpStatus: 202,
    }],
} as DwmAlert & Record<string, unknown>

test('maps persisted org DWM alerts into backed analyst workbench rows', () => {
    const row = dwmAlertToWorkbenchCase(alert)

    assert.equal(row.kind, 'dwm_alert')
    assert.equal(row.persistent, true)
    assert.equal(row.status, 'investigating')
    assert.equal(row.owner, 'analyst@acme.example')
    assert.equal(row.caseDetailHref, '/dashboard/dwm/cases/case_acme_lumma?organizationId=org_acme&tenantId=tenant_acme&alertId=dwm_alert_org_acme_lumma&route=ti_workbench')
    assert.equal(row.evidence.length, 2)
    assert.equal(row.evidence.some(item => item.provenance?.includes('cap_tg_acme')), true)
    assert.equal(row.evidence.some(item => item.provenance?.includes('cap_onion_acme')), true)
    assert.equal(row.workflowPath?.some(step => step.id === 'watchlist_scope' && step.status === 'ready' && step.href?.includes('organizationId=org_acme')), true)
    assert.equal(row.workflowPath?.some(step => step.id === 'delivery' && step.status === 'ready' && step.entityId === 'webhook_acme_security'), true)
    assert.equal(row.actions?.some(action => action.id === 'replay_alert' && action.href.endsWith('/replay') && !action.disabledReason), true)
    assert.equal(row.actions?.some(action => action.id === 'send_alert' && action.body?.webhookDestinationId === 'webhook_acme_security'), true)
    assert.equal(row.deliveryEvidence?.some(delivery => delivery.id === 'delivery_acme_security' && delivery.webhookDestinationId === 'webhook_acme_security'), true)
    assert.equal(row.timeline.some(item => item.body.includes('cap_tg_acme') || item.body.includes('watch_acme_domains')), true)
})
