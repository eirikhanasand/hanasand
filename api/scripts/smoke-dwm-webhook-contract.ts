import {
    buildDwmAlertDeliveryPayload,
    buildDwmAlertWebhookNotificationInput,
    buildDwmAlertWebhookDispatchPlan,
    buildDwmWebhookDeliveryPreview,
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryReadiness,
    buildDwmWebhookDeliveryRequestInput,
    buildDwmWebhookDestinationContracts,
    filterDwmWebhookDeliveryEvidenceForVisibility,
    normalizeDwmWebhookDestinationInput,
    planDwmWebhookDeliveryRetry,
    redactWebhookEndpoint,
    type DwmAlertWebhookTriggerOptions,
} from '#utils/dwm/webhooks.ts'

function expect(condition: unknown, message: string, details?: unknown): asserts condition {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) Object.assign(error, { details })
        throw error
    }
}

const secret = 'discord-secret-contract-test'
const endpoint = `https://discord.com/api/webhooks/987654321/${secret}`

const destination = normalizeDwmWebhookDestinationInput({
    orgId: 'org_contract',
    name: 'Customer Discord',
    endpointUrl: endpoint,
    events: ['dwm.alert.created', 'dwm.alert.replayed'],
}, 'owner_contract')

expect(destination.kind === 'discord', 'Discord endpoint should infer discord destination kind.', destination)
expect(destination.endpointHint === 'https://discord.com/api/webhooks/987654321/...', 'Endpoint hint should redact Discord secret.', destination)
expect(destination.endpointHash?.startsWith('endpoint_'), 'Endpoint hash should be generated.', destination)
expect(!JSON.stringify(destination).includes(secret), 'Destination normalization leaked endpoint secret.', destination)

try {
    normalizeDwmWebhookDestinationInput({ endpointUrl: 'http://hooks.example.com/dwm' }, 'owner_contract')
    throw new Error('Expected HTTP webhook URL to be rejected.')
} catch (error) {
    expect(error instanceof Error && error.message.includes('HTTPS'), 'Invalid URL error should explain HTTPS requirement.', error)
}

const payload = buildDwmAlertDeliveryPayload({
    destination: {
        id: 'destination_contract',
        kind: 'discord',
        name: 'Customer Discord',
        org_id: 'org_contract',
    },
    eventType: 'dwm.alert.replayed',
    deliveryId: 'delivery_contract',
    alert: {
        id: 'alert_contract',
        title: 'Critical Acme domain exposure',
        severity: 'critical',
        company: 'Acme Security',
        domain: 'acme-security.com',
        sourceFamily: 'ransomware_leak_site',
        claimSummary: 'A leak-site post references Acme Security domain assets.',
        recommendedAction: 'Validate source provenance and notify the customer owner.',
        matchedTerm: { value: 'acme-security.com', kind: 'domain' },
        evidence: [
            { label: 'Victim claim', detail: 'Public leak-site metadata matched the watched domain.' },
            { label: 'Telegram mention', detail: 'Public channel echoed the same domain.' },
        ],
        dedupeKey: 'dwm_dedupe_acme_contract',
        route: 'customer_discord',
        casePath: '/dashboard/dwm?alert=alert_contract',
        caseId: 'case_contract',
        provenance: { captureIds: ['capture_contract'], sourceIds: ['source_contract'], primaryCaptureId: 'capture_contract' },
        watchlist: {
            id: 'watchlist_contract',
            name: 'Acme watchlist',
            terms: ['acme-security.com'],
        },
    },
}) as Record<string, unknown>

const serialized = JSON.stringify(payload)
expect(Array.isArray(payload.embeds), 'Discord payload should include embeds.', payload)
expect(serialized.includes('Critical Acme domain exposure'), 'Payload should include alert title.', payload)
expect(serialized.includes('CRITICAL'), 'Payload should include severity.', payload)
expect(serialized.includes('Acme Security'), 'Payload should include company context.', payload)
expect(serialized.includes('acme-security.com'), 'Payload should include domain/matched term.', payload)
expect(serialized.includes('ransomware_leak_site'), 'Payload should include source family.', payload)
expect(serialized.includes('Evidence count'), 'Payload should include evidence count field.', payload)
expect(serialized.includes('Acme watchlist') && serialized.includes('acme-security.com'), 'Payload should include watchlist context.', payload)
expect(serialized.includes('customer_discord'), 'Payload should include route.', payload)
expect(serialized.includes('dwm_dedupe_acme_contract'), 'Payload should include alert dedupe key.', payload)
expect(serialized.includes('dwm.alert.replayed:org_contract:destination_contract:dwm_dedupe_acme_contract'), 'Payload should include destination idempotency key.', payload)
expect(serialized.includes('case_contract'), 'Payload should include case id.', payload)
expect(serialized.includes('/dashboard/dwm?alert=alert_contract'), 'Payload should include case path.', payload)
expect(serialized.includes('capture_contract') && serialized.includes('source_contract'), 'Payload should include provenance summary.', payload)
expect(!serialized.includes(secret), 'Payload should never include webhook secret.', payload)

expect(redactWebhookEndpoint(endpoint) === 'https://discord.com/api/webhooks/987654321/...', 'Redaction helper should hide Discord token.')

const dispatchPlan = buildDwmAlertWebhookDispatchPlan({
    ownerId: 'owner_contract',
    input: {
        organizationId: 'org_contract',
        alertId: 'alert_bridge_contract',
        eventType: 'dwm.alert.replayed',
        watchlistItemId: 'watchlist_bridge_contract',
        watchlistName: 'Bridge watchlist',
        dedupeKey: 'dwm_dedupe_bridge_contract',
        route: 'customer_discord',
        casePath: '/dashboard/dwm?alert=alert_bridge_contract',
        evidenceCount: 4,
        sourceFamily: 'telegram_public',
    },
    destinations: [
        {
            id: 'destination_active',
            org_id: 'org_contract',
            name: 'Active Discord',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        },
        {
            id: 'destination_paused',
            org_id: 'org_contract',
            name: 'Paused Discord',
            kind: 'discord',
            status: 'paused',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        },
        {
            id: 'destination_created_only',
            org_id: 'org_contract',
            name: 'Created only',
            kind: 'webhook',
            status: 'active',
            events: ['dwm.alert.created'],
        },
        {
            id: 'destination_foreign_org',
            org_id: 'org_foreign',
            name: 'Foreign org',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        },
    ],
})

expect(dispatchPlan.orgId === 'org_contract', 'Dispatch plan should resolve organizationId.', dispatchPlan)
expect(dispatchPlan.eventType === 'dwm.alert.replayed', 'Dispatch plan should resolve replay event type.', dispatchPlan)
expect(dispatchPlan.selectedDestinations.map(item => item.id).join(',') === 'destination_active', 'Dispatch should select only enabled matching org destinations.', dispatchPlan)
expect(dispatchPlan.skippedDestinations.some(item => item.id === 'destination_paused' && item.reason === 'disabled'), 'Dispatch should skip disabled destinations.', dispatchPlan)
expect(dispatchPlan.skippedDestinations.some(item => item.id === 'destination_created_only' && item.reason === 'event_not_subscribed'), 'Dispatch should skip destinations not subscribed to replay.', dispatchPlan)
expect(dispatchPlan.skippedDestinations.some(item => item.id === 'destination_foreign_org' && item.reason === 'org_mismatch'), 'Dispatch should skip foreign org destinations.', dispatchPlan)

const bridgePayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: dispatchPlan.selectedDestinations[0].id,
        kind: 'discord',
        name: dispatchPlan.selectedDestinations[0].name,
        org_id: dispatchPlan.orgId,
    },
    eventType: dispatchPlan.eventType,
    deliveryId: 'delivery_bridge_contract',
    alert: dispatchPlan.alert,
}) as Record<string, unknown>
const bridgeSerialized = JSON.stringify(bridgePayload)
expect(bridgeSerialized.includes('telegram_public'), 'Dispatch payload should propagate source family.', bridgePayload)
expect(bridgeSerialized.includes('Evidence count') && bridgeSerialized.includes('4'), 'Dispatch payload should propagate evidence count.', bridgePayload)
expect(bridgeSerialized.includes('watchlist_bridge_contract'), 'Dispatch payload should propagate watchlist context.', bridgePayload)
expect(bridgeSerialized.includes('dwm_dedupe_bridge_contract'), 'Dispatch payload should propagate dedupe key.', bridgePayload)
expect(bridgeSerialized.includes('/dashboard/dwm?alert=alert_bridge_contract'), 'Dispatch payload should propagate case path.', bridgePayload)

const replayWorkflowAlert = {
    id: 'alert_replay_contract',
    title: 'Replay Acme credential exposure',
    severity: 'high',
    company: 'Acme Security',
    domain: 'acme-security.com',
    sourceFamily: 'telegram_public',
    claimSummary: 'Replay should resend the customer notification without changing analyst workflow state.',
    matchedTerm: { value: 'acme-security.com', kind: 'domain' },
    evidenceCount: 3,
    evidence: [
        { label: 'Public channel match', detail: 'Public channel message matched acme-security.com.' },
        { label: 'Credential paste', detail: 'Paste metadata included an Acme user identity.' },
        { label: 'Case enrichment', detail: 'Source capture linked the domain to the same campaign.' },
    ],
    dedupeKey: 'dwm_dedupe_replay_contract',
    route: 'identity_response',
    casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
    reviewState: 'needs_review',
    deliveryState: 'ready_to_send',
    replayCount: 2,
    workflowContext: {
        caseIdCandidate: 'case_replay_contract',
        casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
        dedupeKey: 'dwm_dedupe_replay_contract',
        watchlistItemIds: ['watchlist_item_replay_contract'],
        evidenceCount: 3,
        recommendedRoute: 'identity_response',
    },
    webhookContext: {
        alertId: 'alert_replay_contract',
        organizationId: 'org_contract',
        watchlistItemIds: ['watchlist_item_replay_contract'],
        sourceFamily: 'telegram_public',
        evidenceCount: 3,
        dedupeKey: 'dwm_dedupe_replay_contract',
        recommendedRoute: 'identity_response',
        casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
    },
    watchlist: {
        id: 'watchlist_item_replay_contract',
        name: 'Replay contract watchlist',
        terms: ['acme-security.com'],
    },
}
const replayWorkflowBefore = JSON.stringify(replayWorkflowAlert)
const workflowReplayHandoff: {
    ownerId: string
    alert: Record<string, unknown>
    options: DwmAlertWebhookTriggerOptions
} = {
    ownerId: 'owner_contract',
    alert: replayWorkflowAlert,
    options: {
        eventType: 'dwm.alert.replayed',
        dryRun: true,
        live: false,
        destinationId: 'destination_replay_contract',
    },
}
const replayTriggerInput = buildDwmAlertWebhookNotificationInput(workflowReplayHandoff.alert, {
    eventType: 'dwm.alert.replayed',
    dryRun: true,
})
const targetedReplayTriggerInput = buildDwmAlertWebhookNotificationInput(workflowReplayHandoff.alert, workflowReplayHandoff.options)
const apiDeliveryRequestInput = buildDwmWebhookDeliveryRequestInput({
    alert: replayWorkflowAlert,
    eventType: 'dwm.alert.replayed',
    dryRun: true,
    live: false,
    destinationId: 'destination_replay_contract',
})
const replayPlan = buildDwmAlertWebhookDispatchPlan({
    ownerId: workflowReplayHandoff.ownerId,
    input: replayTriggerInput,
    destinations: [
        {
            id: 'destination_replay_contract',
            org_id: 'org_contract',
            name: 'Replay Discord',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        },
    ],
})
const replayPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: replayPlan.selectedDestinations[0].id,
        kind: 'discord',
        name: replayPlan.selectedDestinations[0].name,
        org_id: replayPlan.orgId,
    },
    eventType: replayPlan.eventType,
    deliveryId: 'delivery_replay_contract',
    alert: replayPlan.alert,
}) as Record<string, unknown>
const replayContext = replayPayload._hanasand as Record<string, unknown>
const replayAlertContext = replayContext.alert as Record<string, unknown>
const replayDeliveryContext = replayContext.delivery as Record<string, unknown>
const replayWatchlistContext = replayContext.watchlist as Record<string, unknown>
const replaySerialized = JSON.stringify(replayPayload)

expect(replayTriggerInput.organizationId === 'org_contract', 'Replay trigger input should map organization id from webhook context.', replayTriggerInput)
expect(replayTriggerInput.watchlistItemId === 'watchlist_item_replay_contract', 'Replay trigger input should map watchlist item id from workflow context.', replayTriggerInput)
expect(replayTriggerInput.sourceFamily === 'telegram_public', 'Replay trigger input should map source family.', replayTriggerInput)
expect(replayTriggerInput.casePath === replayWorkflowAlert.casePath, 'Replay trigger input should map case path.', replayTriggerInput)
expect(replayTriggerInput.dedupeKey === 'dwm_dedupe_replay_contract', 'Replay trigger input should map dedupe key.', replayTriggerInput)
expect(targetedReplayTriggerInput.destinationId === 'destination_replay_contract' && targetedReplayTriggerInput.dryRun === true && targetedReplayTriggerInput.live === false, 'Replay handoff should accept destination selection plus dry-run/live mode.', targetedReplayTriggerInput)
expect(apiDeliveryRequestInput.organizationId === 'org_contract' && apiDeliveryRequestInput.destinationId === 'destination_replay_contract', 'API delivery bridge should normalize persisted alert org and destination context.', apiDeliveryRequestInput)
expect(apiDeliveryRequestInput.casePath === replayWorkflowAlert.casePath && apiDeliveryRequestInput.sourceFamily === 'telegram_public', 'API delivery bridge should normalize case and source context.', apiDeliveryRequestInput)
expect(apiDeliveryRequestInput.dryRun === true && apiDeliveryRequestInput.live === false, 'API delivery bridge should preserve dry-run/live gate.', apiDeliveryRequestInput)
expect(replayPlan.selectedDestinations.length === 1, 'Replay dispatch should select the active org destination.', replayPlan)
expect(replayPlan.eventType === 'dwm.alert.replayed', 'Replay dispatch should preserve replay event type.', replayPlan)
expect(replayAlertContext.id === 'alert_replay_contract', 'Replay payload should link to the same alert id.', replayPayload)
expect(replayDeliveryContext.replay === true, 'Replay payload should mark delivery as replay.', replayPayload)
expect(replayDeliveryContext.dedupeKey === 'dwm_dedupe_replay_contract', 'Replay payload should link to the same alert dedupe key.', replayPayload)
expect(replayDeliveryContext.casePath === replayWorkflowAlert.casePath, 'Replay payload should link to the same case path.', replayPayload)
expect(replayAlertContext.deliveryState === 'ready_to_send', 'Replay payload should preserve alert delivery state.', replayPayload)
expect(replayWatchlistContext.id === 'watchlist_item_replay_contract', 'Replay payload should preserve watchlist context.', replayPayload)
expect(replaySerialized.includes('dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract'), 'Replay payload should use event-scoped idempotency for the same dedupe key.', replayPayload)
expect(replaySerialized.includes('Evidence summary') && replaySerialized.includes('Credential paste'), 'Replay payload should include multi-evidence summary fields.', replayPayload)
expect(JSON.stringify(replayWorkflowAlert) === replayWorkflowBefore, 'Replay dispatch/payload builders should not mutate alert workflow state.', replayWorkflowAlert)

const duplicateReplayPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: replayPlan.selectedDestinations[0].id,
        kind: 'discord',
        name: replayPlan.selectedDestinations[0].name,
        org_id: replayPlan.orgId,
    },
    eventType: replayPlan.eventType,
    deliveryId: 'delivery_replay_duplicate_contract',
    alert: replayPlan.alert,
}) as Record<string, unknown>
const duplicateReplayContext = duplicateReplayPayload._hanasand as Record<string, unknown>
expect(duplicateReplayContext.idempotencyKey === replayContext.idempotencyKey, 'Duplicate replay payloads should keep the same alert/dedupe idempotency key.', duplicateReplayPayload)

const evidenceAttempts = buildDwmWebhookDeliveryEvidence({
    deliveries: [
        {
            id: 'delivery_replay_contract',
            destinationId: 'destination_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            alertId: 'alert_replay_contract',
            eventType: 'dwm.alert.replayed',
            status: 'dry_run',
            dryRun: true,
            endpointHint: 'https://discord.com/api/webhooks/987654321/...',
            endpointHash: 'endpoint_replay_hash',
            payloadHash: 'payload_replay_hash',
            payload: replayPayload,
            responseStatus: null,
            responseBody: null,
            error: null,
            idempotencyKey: 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract',
            watchlistId: 'watchlist_item_replay_contract',
            watchlistName: 'Replay contract watchlist',
            route: 'identity_response',
            casePath: replayWorkflowAlert.casePath,
            attemptedAt: '2026-06-28T12:00:00.000Z',
            createdAt: '2026-06-28T12:00:00.000Z',
        },
        {
            id: 'delivery_live_failed_contract',
            destinationId: 'destination_live_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            alertId: 'alert_live_contract',
            eventType: 'dwm.alert.created',
            status: 'failed',
            dryRun: false,
            endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
            endpointHash: 'endpoint_live_hash',
            payloadHash: 'payload_live_hash',
            payload: {
                _hanasand: {
                    eventType: 'dwm.alert.created',
                    alert: {
                        id: 'alert_live_contract',
                        dedupeKey: 'dwm_dedupe_live_contract',
                        replayCount: 0,
                        casePath: '/v1/cases/case_live_contract?alertId=alert_live_contract&dedupeKey=dwm_dedupe_live_contract',
                    },
                    delivery: {
                        replay: false,
                        dedupeKey: 'dwm_dedupe_live_contract',
                        casePath: '/v1/cases/case_live_contract?alertId=alert_live_contract&dedupeKey=dwm_dedupe_live_contract',
                        route: 'customer_webhook',
                    },
                    watchlist: {
                        id: 'watchlist_item_live_contract',
                        name: 'Live watchlist',
                    },
                },
            },
            responseStatus: 502,
            responseBody: `failed forwarding to https://discord.com/api/webhooks/987654321/${secret}?token=${secret}`,
            error: `upstream token=${secret}`,
            idempotencyKey: 'dwm.alert.created:org_contract:destination_live_contract:dwm_dedupe_live_contract',
            watchlistId: 'watchlist_item_live_contract',
            watchlistName: 'Live watchlist',
            route: 'customer_webhook',
            casePath: '/v1/cases/case_live_contract?alertId=alert_live_contract&dedupeKey=dwm_dedupe_live_contract',
            attemptedAt: '2026-06-28T12:01:00.000Z',
            createdAt: '2026-06-28T12:01:00.000Z',
        },
        {
            id: 'delivery_foreign_contract',
            destinationId: 'destination_foreign_contract',
            ownerId: 'owner_contract',
            orgId: 'org_foreign',
            alertId: 'alert_foreign_contract',
            eventType: 'dwm.alert.created',
            status: 'dry_run',
            dryRun: true,
            endpointHint: 'https://hooks.example.com/foreign',
            endpointHash: 'endpoint_foreign_hash',
            payloadHash: 'payload_foreign_hash',
            payload: {
                _hanasand: {
                    alert: { id: 'alert_foreign_contract', dedupeKey: 'dwm_dedupe_foreign_contract' },
                    delivery: { dedupeKey: 'dwm_dedupe_foreign_contract', casePath: '/v1/cases/foreign' },
                },
            },
            responseStatus: null,
            responseBody: null,
            error: null,
            idempotencyKey: 'dwm.alert.created:org_foreign:destination_foreign_contract:dwm_dedupe_foreign_contract',
            watchlistId: 'watchlist_item_foreign_contract',
            watchlistName: 'Foreign watchlist',
            route: 'customer_webhook',
            casePath: '/v1/cases/foreign',
            attemptedAt: '2026-06-28T12:02:00.000Z',
            createdAt: '2026-06-28T12:02:00.000Z',
        },
        {
            id: 'delivery_live_skipped_contract',
            destinationId: 'destination_skipped_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            alertId: 'alert_skipped_contract',
            eventType: 'dwm.alert.created',
            status: 'skipped',
            dryRun: false,
            endpointHint: 'https://hooks.example.com/skipped',
            endpointHash: 'endpoint_skipped_hash',
            payloadHash: 'payload_skipped_hash',
            payload: {
                _hanasand: {
                    alert: { id: 'alert_skipped_contract', dedupeKey: 'dwm_dedupe_skipped_contract' },
                    delivery: { replay: false, dedupeKey: 'dwm_dedupe_skipped_contract', casePath: '/v1/cases/skipped' },
                },
            },
            responseStatus: null,
            responseBody: null,
            error: 'Live DWM webhook delivery is disabled. Set DWM_WEBHOOK_LIVE_DELIVERY=true and send live=true to enable external calls.',
            idempotencyKey: 'dwm.alert.created:org_contract:destination_skipped_contract:dwm_dedupe_skipped_contract',
            watchlistId: 'watchlist_item_skipped_contract',
            watchlistName: 'Skipped watchlist',
            route: 'customer_webhook',
            casePath: '/v1/cases/skipped',
            attemptedAt: '2026-06-28T12:03:00.000Z',
            createdAt: '2026-06-28T12:03:00.000Z',
        },
    ],
    auditEvents: [
        {
            id: 'audit_replay_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_replay_contract',
            action: 'delivery.replayed',
            metadata: { status: 'dry_run' },
            createdAt: '2026-06-28T12:00:01.000Z',
        },
        {
            id: 'audit_live_failed_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_live_contract',
            deliveryId: 'delivery_live_failed_contract',
            action: 'delivery.failed',
            metadata: { status: 'failed' },
            createdAt: '2026-06-28T12:01:01.000Z',
        },
    ],
})
const replayEvidence = evidenceAttempts.find(item => item.requestId === 'delivery_replay_contract')
const liveEvidence = evidenceAttempts.find(item => item.requestId === 'delivery_live_failed_contract')
const skippedLiveEvidence = evidenceAttempts.find(item => item.requestId === 'delivery_live_skipped_contract')
const evidenceRows = evidenceAttempts.map(item => ({
    id: item.deliveryId,
    destinationId: item.destinationId,
    ownerId: 'owner_contract',
    orgId: item.orgId,
    alertId: item.alertId,
    eventType: item.eventType,
    status: item.status,
    dryRun: item.dryRun,
    endpointHint: item.redactedDestination.endpointHint,
    endpointHash: item.redactedDestination.endpointHash,
    payloadHash: item.payloadHash,
    payload: {},
    responseStatus: item.response.httpStatus,
    responseBody: item.response.summary,
    error: item.error,
    idempotencyKey: item.idempotencyKey,
    watchlistId: item.watchlistId,
    watchlistName: item.watchlistName,
    route: item.route,
    casePath: item.casePath,
    attemptedAt: item.attemptedAt,
    createdAt: item.createdAt,
}))
const orgEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { orgId: 'org_contract' } })
const destinationEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { destinationId: 'destination_live_contract' } })
const casePathEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { casePath: replayWorkflowAlert.casePath } })
const dedupeEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { dedupeKey: 'dwm_dedupe_replay_contract' } })
const idempotencyEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { dedupeKey: replayEvidence?.idempotencyKey } })
const retryLedgerRows = [
    ...evidenceRows,
    {
        id: 'delivery_live_failed_retry_contract',
        destinationId: 'destination_live_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        alertId: 'alert_live_contract',
        eventType: 'dwm.alert.created' as const,
        status: 'failed' as const,
        dryRun: false,
        endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
        endpointHash: 'endpoint_live_hash',
        payloadHash: 'payload_live_retry_hash',
        payload: {},
        responseStatus: 503,
        responseBody: `retry failed with token=${secret}`,
        error: `upstream unavailable token=${secret}`,
        idempotencyKey: 'dwm.alert.created:org_contract:destination_live_contract:dwm_dedupe_live_contract',
        watchlistId: 'watchlist_item_live_contract',
        watchlistName: 'Live watchlist',
        route: 'customer_webhook',
        casePath: '/v1/cases/case_live_contract?alertId=alert_live_contract&dedupeKey=dwm_dedupe_live_contract',
        attemptedAt: '2026-06-28T12:06:00.000Z',
        createdAt: '2026-06-28T12:06:00.000Z',
    },
    {
        id: 'delivery_live_sent_contract',
        destinationId: 'destination_sent_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        alertId: 'alert_sent_contract',
        eventType: 'dwm.alert.created' as const,
        status: 'delivered' as const,
        dryRun: false,
        endpointHint: 'https://hooks.example.com/sent',
        endpointHash: 'endpoint_sent_hash',
        payloadHash: 'payload_sent_hash',
        payload: {},
        responseStatus: 204,
        responseBody: '',
        error: null,
        idempotencyKey: 'dwm.alert.created:org_contract:destination_sent_contract:dwm_dedupe_sent_contract',
        watchlistId: 'watchlist_item_sent_contract',
        watchlistName: 'Sent watchlist',
        route: 'customer_webhook',
        casePath: '/v1/cases/sent',
        attemptedAt: '2026-06-28T12:07:00.000Z',
        createdAt: '2026-06-28T12:07:00.000Z',
    },
]
const deliveryLedger = buildDwmWebhookDeliveryLedger({
    deliveries: retryLedgerRows,
    auditEvents: [
        {
            id: 'audit_live_retry_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_live_contract',
            deliveryId: 'delivery_live_failed_retry_contract',
            action: 'delivery.failed',
            metadata: { status: 'failed' },
            createdAt: '2026-06-28T12:06:01.000Z',
        },
    ],
    filters: { orgId: 'org_contract' },
})
const queuedLedger = deliveryLedger.find(item => item.deliveryId === 'delivery_replay_contract')
const retryLedger = deliveryLedger.find(item => item.deliveryId === 'delivery_live_failed_retry_contract')
const skippedLedger = deliveryLedger.find(item => item.deliveryId === 'delivery_live_skipped_contract')
const sentLedger = deliveryLedger.find(item => item.deliveryId === 'delivery_live_sent_contract')
const rateLimitRetry = planDwmWebhookDeliveryRetry({
    status: 'failed',
    dryRun: false,
    responseStatus: 429,
    error: 'rate limited',
    attemptedAt: '2026-06-28T12:10:00.000Z',
    attemptCount: 1,
})

expect(evidenceAttempts.length === 4, 'Delivery evidence should include all unfiltered attempts.', evidenceAttempts)
expect(replayEvidence?.auditEventId === 'audit_replay_contract', 'Replay evidence should link audit event id.', replayEvidence)
expect(replayEvidence?.replay === true && replayEvidence.dryRun === true && replayEvidence.live === false && replayEvidence.liveRequested === false, 'Replay evidence should distinguish dry-run replay.', replayEvidence)
expect(replayEvidence?.dedupeKey === 'dwm_dedupe_replay_contract', 'Replay evidence should expose dedupe key.', replayEvidence)
expect(replayEvidence?.casePath === replayWorkflowAlert.casePath, 'Replay evidence should expose case path.', replayEvidence)
expect(liveEvidence?.live === true && liveEvidence.liveRequested === true && liveEvidence.dryRun === false && liveEvidence.replay === false, 'Live evidence should distinguish live non-replay attempts.', liveEvidence)
expect(liveEvidence?.response.httpStatus === 502, 'Live evidence should expose HTTP status.', liveEvidence)
expect(skippedLiveEvidence?.liveRequested === true && skippedLiveEvidence.live === false && skippedLiveEvidence.status === 'skipped', 'Skipped evidence should show live was requested but not externally sent.', skippedLiveEvidence)
expect(!JSON.stringify(evidenceAttempts).includes(secret), 'Delivery evidence should redact endpoint, response, and error secrets.', evidenceAttempts)
expect(orgEvidence.length === 3 && orgEvidence.every(item => item.orgId === 'org_contract'), 'Delivery evidence org filter should exclude wrong-org attempts.', orgEvidence)
expect(destinationEvidence[0]?.requestId === 'delivery_live_failed_contract', 'Delivery evidence should filter by destination id.', destinationEvidence)
expect(casePathEvidence.length === 1 && casePathEvidence[0].requestId === 'delivery_replay_contract', 'Delivery evidence should filter by case path.', casePathEvidence)
expect(dedupeEvidence.length === 1 && dedupeEvidence[0].requestId === 'delivery_replay_contract', 'Delivery evidence should filter by dedupe key.', dedupeEvidence)
expect(idempotencyEvidence.length === 1 && idempotencyEvidence[0].requestId === 'delivery_replay_contract', 'Delivery evidence should filter by idempotency key.', idempotencyEvidence)
expect(buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { alertId: 'alert_replay_contract', casePath: replayWorkflowAlert.casePath, dedupeKey: 'dwm_dedupe_replay_contract' } }).length === 1, 'Delivery evidence should combine alert, case path, and dedupe filters.')
expect(queuedLedger?.status === 'queued' && queuedLedger.rawStatus === 'dry_run' && queuedLedger.retryable === false, 'Delivery ledger should map dry-run attempts to queued/no-retry state.', queuedLedger)
expect(sentLedger?.status === 'sent' && sentLedger.retryable === false && sentLedger.responseStatus === 204, 'Delivery ledger should map delivered attempts to sent state.', sentLedger)
expect(retryLedger?.status === 'failed' && retryLedger.retryable === true && retryLedger.attemptCount === 2, 'Delivery ledger should expose retryable failed attempts and attempt count.', retryLedger)
expect(retryLedger?.nextRetryAt === '2026-06-28T12:11:00.000Z' && retryLedger.errorClass === 'upstream_5xx', 'Retry planner should use backoff from the latest failed attempt.', retryLedger)
expect(skippedLedger?.status === 'skipped' && skippedLedger.retryable === false && skippedLedger.errorClass === 'live_delivery_disabled', 'Delivery ledger should keep live-disabled skipped attempts non-retryable.', skippedLedger)
expect(rateLimitRetry.retryable === true && rateLimitRetry.nextRetryAt === '2026-06-28T12:11:00.000Z' && rateLimitRetry.reason === 'rate_limited', 'Retry planner should retry rate-limited failed sends.', rateLimitRetry)
expect(!JSON.stringify(deliveryLedger).includes(secret), 'Delivery ledger should not expose endpoint, response, or error secrets.', deliveryLedger)

const visibilityAllowedMember = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const visibilityWrongOrg = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const visibilityRemoved = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: 'admin', status: 'removed', userActive: true, alertVisibilityPolicy: 'members' },
})
const visibilityDeactivated = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: 'owner', status: 'active', userActive: false, alertVisibilityPolicy: 'members' },
})
const visibilityAdminPolicyMember = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'admins' },
})
const visibilityAdminPolicyAdmin = filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence: orgEvidence,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'admins' },
})

expect(visibilityAllowedMember.decision.allowed === true && visibilityAllowedMember.deliveryEvidence.length === orgEvidence.length, 'Members policy should allow active members to read evidence.', visibilityAllowedMember)
expect(visibilityWrongOrg.decision.allowed === false && visibilityWrongOrg.decision.reason === 'not_member' && visibilityWrongOrg.deliveryEvidence.length === 0, 'Visibility should deny wrong-org/nonmember evidence reads.', visibilityWrongOrg)
expect(visibilityRemoved.decision.allowed === false && visibilityRemoved.decision.reason === 'member_removed' && visibilityRemoved.deliveryEvidence.length === 0, 'Visibility should deny removed members.', visibilityRemoved)
expect(visibilityDeactivated.decision.allowed === false && visibilityDeactivated.decision.reason === 'member_deactivated' && visibilityDeactivated.deliveryEvidence.length === 0, 'Visibility should deny deactivated members.', visibilityDeactivated)
expect(visibilityAdminPolicyMember.decision.allowed === false && visibilityAdminPolicyMember.decision.reason === 'role_not_allowed' && visibilityAdminPolicyMember.deliveryEvidence.length === 0, 'Admin-only policy should deny member evidence reads.', visibilityAdminPolicyMember)
expect(visibilityAdminPolicyAdmin.decision.allowed === true && visibilityAdminPolicyAdmin.deliveryEvidence.length === orgEvidence.length, 'Admin-only policy should allow admins.', visibilityAdminPolicyAdmin)

const destinationContracts = buildDwmWebhookDestinationContracts({
    destinations: [
        {
            id: 'destination_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Replay Discord',
            kind: 'discord',
            endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
            endpointHash: 'endpoint_replay_hash',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
            createdBy: 'owner_contract',
            lastTestedAt: '2026-06-28T12:04:00.000Z',
            lastTestStatus: 'dry_run',
            lastTestError: null,
            lastTestHttpStatus: null,
            lastDeliveryAt: '2026-06-28T12:00:00.000Z',
            createdAt: '2026-06-28T11:00:00.000Z',
            updatedAt: '2026-06-28T12:04:00.000Z',
        },
        {
            id: 'destination_disabled_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Disabled Discord',
            kind: 'discord',
            endpointHint: 'https://discord.com/api/webhooks/111111111/...',
            endpointHash: 'endpoint_disabled_hash',
            status: 'archived',
            events: ['dwm.alert.created'],
            createdBy: 'owner_contract',
            lastTestedAt: null,
            lastTestStatus: null,
            lastTestError: 'Disabled by owner',
            lastTestHttpStatus: null,
            lastDeliveryAt: null,
            createdAt: '2026-06-28T10:00:00.000Z',
            updatedAt: '2026-06-28T12:05:00.000Z',
        },
    ],
    deliveries: [
        ...evidenceRows,
        {
            id: 'delivery_test_contract',
            destinationId: 'destination_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            alertId: 'webhook_test',
            eventType: 'dwm.alert.test',
            status: 'dry_run',
            dryRun: true,
            endpointHint: 'https://discord.com/api/webhooks/987654321/...',
            endpointHash: 'endpoint_replay_hash',
            payloadHash: 'payload_test_hash',
            payload: replayPayload,
            responseStatus: null,
            responseBody: null,
            error: null,
            idempotencyKey: 'dwm.alert.test:org_contract:destination_replay_contract:webhook_test',
            watchlistId: 'test-watchlist',
            watchlistName: 'Webhook test watchlist',
            route: 'test_delivery',
            casePath: '/dashboard/dwm',
            attemptedAt: '2026-06-28T12:04:00.000Z',
            createdAt: '2026-06-28T12:04:00.000Z',
        },
    ],
    auditEvents: [
        {
            id: 'audit_destination_created_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: null,
            action: 'destination.created',
            metadata: {},
            createdAt: '2026-06-28T11:00:00.000Z',
        },
        {
            id: 'audit_delivery_test_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_test_contract',
            action: 'delivery.tested',
            metadata: {},
            createdAt: '2026-06-28T12:04:01.000Z',
        },
        {
            id: 'audit_replay_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_replay_contract',
            action: 'delivery.replayed',
            metadata: {},
            createdAt: '2026-06-28T12:00:01.000Z',
        },
    ],
})
const destinationContract = destinationContracts[0]
const disabledDestinationContract = destinationContracts[1]
const deliveryPreview = buildDwmWebhookDeliveryPreview({
    id: 'delivery_replay_contract',
    destinationId: 'destination_replay_contract',
    ownerId: 'owner_contract',
    orgId: 'org_contract',
    alertId: 'alert_replay_contract',
    eventType: 'dwm.alert.replayed',
    status: 'dry_run',
    dryRun: true,
    endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
    endpointHash: 'endpoint_replay_hash',
    payloadHash: 'payload_replay_hash',
    payload: replayPayload,
    responseStatus: null,
    responseBody: null,
    error: null,
    idempotencyKey: 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract',
    watchlistId: 'watchlist_item_replay_contract',
    watchlistName: 'Replay contract watchlist',
    route: 'identity_response',
    casePath: replayWorkflowAlert.casePath,
    attemptedAt: '2026-06-28T12:00:00.000Z',
    createdAt: '2026-06-28T12:00:00.000Z',
})
const readiness = buildDwmWebhookDeliveryReadiness({
    liveDeliveryEnabled: false,
    destinations: [
        {
            id: 'destination_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Replay Discord',
            kind: 'discord',
            endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
            endpointHash: 'endpoint_replay_hash',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
            createdBy: 'owner_contract',
            lastTestedAt: '2026-06-28T12:04:00.000Z',
            lastTestStatus: 'dry_run',
            lastTestError: null,
            lastTestHttpStatus: null,
            lastDeliveryAt: '2026-06-28T12:00:00.000Z',
            createdAt: '2026-06-28T11:00:00.000Z',
            updatedAt: '2026-06-28T12:04:00.000Z',
        },
        {
            id: 'destination_live_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Retry Discord',
            kind: 'discord',
            endpointHint: `https://discord.com/api/webhooks/222222222/${secret}`,
            endpointHash: 'endpoint_live_hash',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
            createdBy: 'owner_contract',
            lastTestedAt: '2026-06-28T12:04:00.000Z',
            lastTestStatus: 'dry_run',
            lastTestError: null,
            lastTestHttpStatus: null,
            lastDeliveryAt: null,
            createdAt: '2026-06-28T11:00:00.000Z',
            updatedAt: '2026-06-28T12:06:00.000Z',
        },
        {
            id: 'destination_disabled_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Disabled Discord',
            kind: 'discord',
            endpointHint: `https://discord.com/api/webhooks/333333333/${secret}`,
            endpointHash: 'endpoint_disabled_hash',
            status: 'archived',
            events: ['dwm.alert.created'],
            createdBy: 'owner_contract',
            lastTestedAt: null,
            lastTestStatus: null,
            lastTestError: 'Disabled by owner',
            lastTestHttpStatus: null,
            lastDeliveryAt: null,
            createdAt: '2026-06-28T10:00:00.000Z',
            updatedAt: '2026-06-28T12:05:00.000Z',
        },
    ],
    deliveries: [
        ...retryLedgerRows,
        {
            id: 'delivery_test_contract',
            destinationId: 'destination_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            alertId: 'webhook_test',
            eventType: 'dwm.alert.test',
            status: 'dry_run',
            dryRun: true,
            endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
            endpointHash: 'endpoint_replay_hash',
            payloadHash: 'payload_test_hash',
            payload: replayPayload,
            responseStatus: null,
            responseBody: null,
            error: null,
            idempotencyKey: 'dwm.alert.test:org_contract:destination_replay_contract:webhook_test',
            watchlistId: 'test-watchlist',
            watchlistName: 'Webhook test watchlist',
            route: 'test_delivery',
            casePath: '/dashboard/dwm',
            attemptedAt: '2026-06-28T12:04:00.000Z',
            createdAt: '2026-06-28T12:04:00.000Z',
        },
    ],
    auditEvents: [
        {
            id: 'audit_delivery_test_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_test_contract',
            action: 'delivery.tested',
            metadata: {},
            createdAt: '2026-06-28T12:04:01.000Z',
        },
        {
            id: 'audit_live_retry_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_live_contract',
            deliveryId: 'delivery_live_failed_retry_contract',
            action: 'delivery.failed',
            metadata: {},
            createdAt: '2026-06-28T12:06:01.000Z',
        },
    ],
})
const replayReadiness = readiness.destinations.find(item => item.destinationId === 'destination_replay_contract')
const retryReadiness = readiness.destinations.find(item => item.destinationId === 'destination_live_contract')
const disabledReadiness = readiness.destinations.find(item => item.destinationId === 'destination_disabled_contract')

expect(destinationContract.type === 'discord' && destinationContract.label === 'Replay Discord', 'Destination contract should expose type and label.', destinationContract)
expect(destinationContract.enabled === true && destinationContract.status === 'active', 'Destination contract should expose enabled status.', destinationContract)
expect(disabledDestinationContract.enabled === false && disabledDestinationContract.status === 'archived' && disabledDestinationContract.failureReason === 'Disabled by owner', 'Destination contract should expose disabled status and failure reason.', disabledDestinationContract)
expect(destinationContract.redactedUrl.includes('/api/webhooks/987654321/') && !JSON.stringify(destinationContract).includes(secret), 'Destination contract should only expose redacted destination refs.', destinationContract)
expect(destinationContract.lastTest.requestId === 'delivery_test_contract' && destinationContract.lastTest.auditEventId === 'audit_delivery_test_contract', 'Destination contract should expose last test request and audit ids.', destinationContract)
expect(destinationContract.lastDelivery.requestId === 'delivery_replay_contract' && destinationContract.lastDelivery.auditEventId === 'audit_replay_contract', 'Destination contract should expose last delivery request and audit ids.', destinationContract)
expect(destinationContract.auditEventIds.includes('audit_destination_created_contract'), 'Destination contract should expose destination audit event ids.', destinationContract)
expect(deliveryPreview.requestId === 'delivery_replay_contract' && deliveryPreview.discord.embeds.length === 1, 'Test preview should expose Discord-ready payload.', deliveryPreview)
expect(deliveryPreview.context.org.id === 'org_contract', 'Test preview should expose org context.', deliveryPreview)
expect(deliveryPreview.context.watchlist.id === 'watchlist_item_replay_contract', 'Test preview should expose watchlist context.', deliveryPreview)
expect(deliveryPreview.context.alert.severity === 'high' && deliveryPreview.context.alert.evidenceCount === 3, 'Test preview should expose alert severity and evidence count.', deliveryPreview)
expect(deliveryPreview.context.alert.casePath === replayWorkflowAlert.casePath && deliveryPreview.context.links.casePath === replayWorkflowAlert.casePath, 'Test preview should expose case/deep-link context.', deliveryPreview)
expect(!JSON.stringify(deliveryPreview).includes(secret), 'Test preview should not leak endpoint secrets.', deliveryPreview)
expect(readiness.destinationCount === 3 && readiness.activeDestinationCount === 2 && readiness.disabledDestinationCount === 1, 'Readiness should roll up multiple destinations.', readiness)
expect(readiness.blockers.includes('live_delivery_disabled') && readiness.retryScheduledCount === 1, 'Readiness should expose live-send blockers and retry schedule count.', readiness)
expect(replayReadiness?.lastTest.requestId === 'delivery_test_contract' && replayReadiness.recentAttempts.some(item => item.deliveryId === 'delivery_test_contract'), 'Readiness should include successful dry-run/test evidence.', replayReadiness)
expect(retryReadiness?.retryState.retryable === true && retryReadiness.retryState.errorClass === 'upstream_5xx' && retryReadiness.blockers.includes('retry_scheduled'), 'Readiness should expose failed retry state and failure class.', retryReadiness)
expect(disabledReadiness?.enabled === false && disabledReadiness.blockers.includes('destination_disabled') && disabledReadiness.readiness === 'disabled', 'Readiness should mark disabled destinations as blocked.', disabledReadiness)
expect(readiness.idempotencyCoverage.covered === true && retryReadiness?.idempotencyCoverage.duplicateKeyCount === 1, 'Readiness should expose idempotency coverage and duplicate attempt groups.', readiness)
expect(!JSON.stringify(readiness).includes(secret), 'Readiness should not leak endpoint, response, or error secrets.', readiness)

console.log(JSON.stringify({
    ok: true,
    checked: [
        'destination validation',
        'discord kind inference',
        'endpoint redaction/hash',
        'HTTPS-only customer endpoint validation',
        'Discord payload formatting',
        'destination selection',
        'disabled destination skip',
        'org/watchlist context propagation',
        'route/dedupe/case context',
        'alert replay trigger adapter',
        'workflow replay handoff type contract',
        'adapter destination dry-run/live selection',
        'API delivery bridge persisted-alert normalization',
        'replay alert/dedupe/case linkage',
        'idempotent duplicate replay key',
        'replay workflow immutability',
        'multi-evidence Discord summary',
        'delivery evidence shaping',
        'delivery ledger queued/sent/failed/skipped states',
        'delivery ledger retry backoff',
        'delivery ledger attempt counts',
        'destination readiness rollup',
        'destination readiness live blockers',
        'destination readiness retry/failure class',
        'destination readiness idempotency coverage',
        'delivery evidence secret redaction',
        'delivery ledger secret redaction',
        'destination readiness secret redaction',
        'delivery evidence wrong-org filtering',
        'delivery evidence case/dedupe/idempotency filters',
        'delivery evidence org visibility allowed/denied',
        'delivery evidence removed/deactivated denial',
        'delivery evidence admin-only policy',
        'destination contract create/list/update/disable/test fields',
        'destination contract audit ids',
        'dry-run Discord payload preview fields',
        'delivery evidence replay/live/dry-run distinction',
        'secret-free payload',
    ],
}, null, 2))
