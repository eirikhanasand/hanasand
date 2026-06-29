import {
    buildDwmAlertDeliveryPayload,
    buildDwmAlertWebhookReadinessHandoff,
    buildDwmAlertWebhookNotificationInput,
    buildDwmAlertWebhookDispatchPlan,
    buildDwmOrgAlertWebhookDeliveryContract,
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookDestinationAdminProof,
    buildDwmWebhookDestinationCrudContract,
    buildDwmWebhookDestinationHealth,
    buildDwmWebhookDestinationLifecycle,
    buildDwmWebhookDeliveryPreview,
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryOperations,
    buildDwmWebhookDeliveryReadiness,
    buildDwmWebhookDeliveryRequestInput,
    buildDwmWebhookDeliveryRetryContract,
    buildDwmWebhookDeliveryRetryPersistence,
    buildDwmWebhookDestinationContracts,
    filterDwmWebhookDeliveryEvidenceForVisibility,
    filterDwmWebhookDestinationHealthForVisibility,
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
        alertUrl: 'https://app.hanasand.local/dashboard/dwm?alert=alert_contract',
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
expect(serialized.includes('Alert URL') && serialized.includes('https://app.hanasand.local/dashboard/dwm?alert=alert_contract'), 'Payload should include alert URL/deep link.', payload)
expect(serialized.includes('capture_contract') && serialized.includes('source_contract'), 'Payload should include provenance summary.', payload)
expect(!serialized.includes(secret), 'Payload should never include webhook secret.', payload)

expect(redactWebhookEndpoint(endpoint) === 'https://discord.com/api/webhooks/987654321/...', 'Redaction helper should hide Discord token.')

const longDiscordPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: 'destination_long_contract',
        kind: 'discord',
        name: 'Long Discord',
        org_id: 'org_contract',
    },
    eventType: 'dwm.alert.created',
    deliveryId: 'delivery_long_contract',
    alert: {
        id: 'alert_long_contract',
        title: `Critical ${'title '.repeat(80)}`,
        severity: 'critical',
        company: 'Acme Security',
        sourceFamily: 'telegram_public',
        claimSummary: 'summary '.repeat(900),
        recommendedAction: 'action '.repeat(400),
        matchedTerm: { value: 'acme-security.com', kind: 'domain' },
        evidence: [
            { label: 'Long evidence label '.repeat(25), detail: 'evidence detail '.repeat(120) },
            { label: 'Second evidence', detail: 'secondary detail '.repeat(120) },
            { label: 'Third evidence', detail: 'tertiary detail '.repeat(120) },
        ],
        dedupeKey: 'dwm_dedupe_long_contract',
        route: 'customer_discord',
        casePath: '/dashboard/dwm?alert=alert_long_contract',
        alertUrl: 'https://app.hanasand.local/dashboard/dwm?alert=alert_long_contract&case=case_long_contract',
        watchlist: {
            id: 'watchlist_long_contract',
            name: 'Long watchlist',
            terms: ['acme-security.com'],
        },
    },
}) as Record<string, unknown>
const longEmbed = (longDiscordPayload.embeds as Array<Record<string, unknown>>)[0]
const longFields = longEmbed.fields as Array<Record<string, unknown>>
const longContext = longDiscordPayload._hanasand as Record<string, unknown>
const longAlertContext = longContext.alert as Record<string, unknown>

expect(String(longDiscordPayload.content).length <= 2000, 'Discord content should respect the 2000 character limit.', longDiscordPayload)
expect(String(longEmbed.title).length <= 256, 'Discord embed title should respect the 256 character limit.', longEmbed)
expect(String(longEmbed.description).length <= 4096, 'Discord embed description should respect the 4096 character limit.', longEmbed)
expect(longFields.length <= 25, 'Discord embed fields should respect the 25 field limit.', longFields)
expect(longFields.every(field => String(field.name).length <= 256 && String(field.value).length <= 1024), 'Discord embed fields should respect name/value limits.', longFields)
expect(JSON.stringify(longDiscordPayload).includes('Alert URL') && longAlertContext.alertUrl === 'https://app.hanasand.local/dashboard/dwm?alert=alert_long_contract&case=case_long_contract', 'Long Discord payload should preserve alert deep link context.', longDiscordPayload)

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
    alertUrl: 'https://app.hanasand.local/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
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
        captureIds: ['capture_replay_contract'],
        primaryCaptureId: 'capture_replay_contract',
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
        provenance: {
            captureIds: ['capture_replay_contract'],
            sourceIds: ['source_replay_contract'],
            primaryCaptureId: 'capture_replay_contract',
        },
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
expect((replayTriggerInput.alert as Record<string, unknown>).alertUrl === replayWorkflowAlert.alertUrl, 'Replay trigger input should map alert URL/deep link.', replayTriggerInput)
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
expect(replayDeliveryContext.alertUrl === replayWorkflowAlert.alertUrl, 'Replay payload should link to the alert URL/deep link.', replayPayload)
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

const overlappingOrgDestinations = [
    {
        id: 'destination_overlap_org_a',
        ownerId: 'owner_contract',
        orgId: 'org_overlap_a',
        name: 'Org A Discord',
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/111111111/${secret}`,
        endpointHash: 'endpoint_overlap_a_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:00:00.000Z',
        lastTestStatus: 'dry_run' as const,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
    },
    {
        id: 'destination_overlap_org_b',
        ownerId: 'owner_contract',
        orgId: 'org_overlap_b',
        name: 'Org B Discord',
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/222222222/${secret}`,
        endpointHash: 'endpoint_overlap_b_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:00:00.000Z',
        lastTestStatus: 'dry_run' as const,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
    },
]
const overlappingOrgAlertA = {
    id: 'alert_overlap_a',
    organizationId: 'org_overlap_a',
    tenantId: 'tenant_overlap_a',
    title: 'Shared term mention for Org A',
    severity: 'high',
    company: 'Org A Customer',
    domain: 'shared-example.com',
    sourceFamily: 'telegram_public',
    claimSummary: 'A public post references the watched shared domain for Org A.',
    recommendedAction: 'Review the evidence and notify the customer owner.',
    matchedTerm: { value: 'shared-example.com', kind: 'domain' },
    evidence: [{ label: 'Telegram capture', detail: 'Shared domain was observed in Org A scoped evidence.' }],
    dedupeKey: 'dwm_overlap_org_a',
    recommendedRoute: 'customer_webhook',
    caseId: 'case_overlap_a',
    casePath: '/v1/cases/case_overlap_a?alertId=alert_overlap_a',
    alertUrl: 'https://app.hanasand.local/v1/cases/case_overlap_a?alertId=alert_overlap_a',
    webhookContext: {
        organizationId: 'org_overlap_a',
        watchlistItemIds: ['watchlist_overlap_a'],
        sourceFamily: 'telegram_public',
        evidenceCount: 1,
        dedupeKey: 'dwm_overlap_org_a',
        recommendedRoute: 'customer_webhook',
        casePath: '/v1/cases/case_overlap_a?alertId=alert_overlap_a',
        provenance: { captureIds: ['capture_overlap_a'], sourceIds: ['source_overlap_a'] },
    },
    watchlist: {
        id: 'watchlist_overlap_a',
        name: 'Org A shared-domain watchlist',
        terms: ['shared-example.com'],
    },
}
const overlappingOrgAlertB = {
    ...overlappingOrgAlertA,
    id: 'alert_overlap_b',
    organizationId: 'org_overlap_b',
    tenantId: 'tenant_overlap_b',
    title: 'Shared term mention for Org B',
    company: 'Org B Customer',
    evidence: [{ label: 'Forum capture', detail: 'Shared domain was observed in Org B scoped evidence.' }],
    dedupeKey: 'dwm_overlap_org_b',
    caseId: 'case_overlap_b',
    casePath: '/v1/cases/case_overlap_b?alertId=alert_overlap_b',
    alertUrl: 'https://app.hanasand.local/v1/cases/case_overlap_b?alertId=alert_overlap_b',
    webhookContext: {
        organizationId: 'org_overlap_b',
        watchlistItemIds: ['watchlist_overlap_b'],
        sourceFamily: 'telegram_public',
        evidenceCount: 1,
        dedupeKey: 'dwm_overlap_org_b',
        recommendedRoute: 'customer_webhook',
        casePath: '/v1/cases/case_overlap_b?alertId=alert_overlap_b',
        provenance: { captureIds: ['capture_overlap_b'], sourceIds: ['source_overlap_b'] },
    },
    watchlist: {
        id: 'watchlist_overlap_b',
        name: 'Org B shared-domain watchlist',
        terms: ['shared-example.com'],
    },
}
const overlappingOrgDeliveries = [
    {
        id: 'delivery_overlap_a_retry',
        destinationId: 'destination_overlap_org_a',
        ownerId: 'owner_contract',
        orgId: 'org_overlap_a',
        alertId: 'alert_overlap_a',
        eventType: 'dwm.alert.created' as const,
        status: 'failed' as const,
        dryRun: false,
        endpointHint: `https://discord.com/api/webhooks/111111111/${secret}`,
        endpointHash: 'endpoint_overlap_a_hash',
        payloadHash: 'payload_overlap_a_hash',
        payload: {},
        responseStatus: 503,
        responseBody: `retry token=${secret}`,
        error: `upstream token=${secret}`,
        idempotencyKey: 'dwm.alert.created:org_overlap_a:destination_overlap_org_a:dwm_overlap_org_a',
        watchlistId: 'watchlist_overlap_a',
        watchlistName: 'Org A shared-domain watchlist',
        route: 'customer_webhook',
        casePath: '/v1/cases/case_overlap_a?alertId=alert_overlap_a',
        attemptedAt: '2026-06-28T12:12:00.000Z',
        createdAt: '2026-06-28T12:12:00.000Z',
    },
    {
        id: 'delivery_overlap_b_replay',
        destinationId: 'destination_overlap_org_b',
        ownerId: 'owner_contract',
        orgId: 'org_overlap_b',
        alertId: 'alert_overlap_b',
        eventType: 'dwm.alert.replayed' as const,
        status: 'dry_run' as const,
        dryRun: true,
        endpointHint: `https://discord.com/api/webhooks/222222222/${secret}`,
        endpointHash: 'endpoint_overlap_b_hash',
        payloadHash: 'payload_overlap_b_hash',
        payload: {},
        responseStatus: null,
        responseBody: null,
        error: null,
        idempotencyKey: 'dwm.alert.replayed:org_overlap_b:destination_overlap_org_b:dwm_overlap_org_b',
        watchlistId: 'watchlist_overlap_b',
        watchlistName: 'Org B shared-domain watchlist',
        route: 'customer_webhook',
        casePath: '/v1/cases/case_overlap_b?alertId=alert_overlap_b',
        attemptedAt: '2026-06-28T12:13:00.000Z',
        createdAt: '2026-06-28T12:13:00.000Z',
    },
]
const overlappingOrgAudits = [
    {
        id: 'audit_overlap_a_retry',
        ownerId: 'owner_contract',
        actorId: 'owner_contract',
        orgId: 'org_overlap_a',
        destinationId: 'destination_overlap_org_a',
        deliveryId: 'delivery_overlap_a_retry',
        action: 'delivery.failed',
        metadata: { status: 'failed', token: secret },
        createdAt: '2026-06-28T12:12:01.000Z',
    },
    {
        id: 'audit_overlap_b_replay',
        ownerId: 'owner_contract',
        actorId: 'owner_contract',
        orgId: 'org_overlap_b',
        destinationId: 'destination_overlap_org_b',
        deliveryId: 'delivery_overlap_b_replay',
        action: 'delivery.replayed',
        metadata: { status: 'dry_run', token: secret },
        createdAt: '2026-06-28T12:13:01.000Z',
    },
]
const overlappingOrgAReadiness = buildDwmAlertWebhookReadinessHandoff({
    ownerId: 'owner_contract',
    input: buildDwmAlertWebhookNotificationInput(overlappingOrgAlertA, { eventType: 'dwm.alert.created', dryRun: true, live: false }),
    destinations: overlappingOrgDestinations,
    deliveries: overlappingOrgDeliveries,
    auditEvents: overlappingOrgAudits,
    liveDeliveryEnabled: false,
})
const overlappingOrgBReadiness = buildDwmAlertWebhookReadinessHandoff({
    ownerId: 'owner_contract',
    input: buildDwmAlertWebhookNotificationInput(overlappingOrgAlertB, { eventType: 'dwm.alert.replayed', dryRun: true, live: false }),
    destinations: overlappingOrgDestinations,
    deliveries: overlappingOrgDeliveries,
    auditEvents: overlappingOrgAudits,
    liveDeliveryEnabled: false,
})
const overlappingOrgAPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: 'destination_overlap_org_a',
        kind: 'discord',
        name: 'Org A Discord',
        org_id: 'org_overlap_a',
    },
    eventType: 'dwm.alert.created',
    deliveryId: 'delivery_overlap_a_payload',
    alert: buildDwmAlertWebhookNotificationInput(overlappingOrgAlertA).alert || {},
}) as Record<string, unknown>
const overlappingOrgBPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: 'destination_overlap_org_b',
        kind: 'discord',
        name: 'Org B Discord',
        org_id: 'org_overlap_b',
    },
    eventType: 'dwm.alert.replayed',
    deliveryId: 'delivery_overlap_b_payload',
    alert: buildDwmAlertWebhookNotificationInput(overlappingOrgAlertB).alert || {},
}) as Record<string, unknown>
expect(overlappingOrgAReadiness.schemaVersion === 'dwm.webhook.alert_readiness_handoff.v1' && overlappingOrgAReadiness.orgId === 'org_overlap_a', 'Alert readiness handoff should expose org A readiness.', overlappingOrgAReadiness)
expect(overlappingOrgAReadiness.destinationSelection.selectedDestinationIds.join(',') === 'destination_overlap_org_a', 'Alert readiness handoff should select only org A destination for overlapping term.', overlappingOrgAReadiness)
expect(overlappingOrgBReadiness.destinationSelection.selectedDestinationIds.join(',') === 'destination_overlap_org_b', 'Alert readiness handoff should select only org B destination for overlapping term.', overlappingOrgBReadiness)
expect(overlappingOrgAReadiness.deliveryRetryPersistence.deliveryKeys.every(item => item.orgId === 'org_overlap_a' && item.destinationId !== 'destination_overlap_org_b'), 'Alert readiness retry proof should not leak org B deliveries into org A.', overlappingOrgAReadiness.deliveryRetryPersistence)
expect(overlappingOrgBReadiness.deliveryRetryPersistence.deliveryKeys.every(item => item.orgId === 'org_overlap_b' && item.destinationId !== 'destination_overlap_org_a'), 'Alert readiness retry proof should not leak org A deliveries into org B.', overlappingOrgBReadiness.deliveryRetryPersistence)
expect(overlappingOrgAReadiness.deliveryRetryPersistence.counts.retryable === 1 && overlappingOrgAReadiness.blockers.some(item => item.code === 'retry_scheduled' && item.blocking === false), 'Alert readiness should expose retry/backoff without blocking dry-run customer proof.', overlappingOrgAReadiness)
expect(overlappingOrgBReadiness.deliveryRetryPersistence.counts.replay === 1 && overlappingOrgBReadiness.deliveryRetryPersistence.counts.duplicateDedupe === 0, 'Alert readiness should expose replay attempts without inventing duplicate replay state.', overlappingOrgBReadiness)
expect(JSON.stringify(overlappingOrgAPayload).includes('Org A Customer') && !JSON.stringify(overlappingOrgAPayload).includes('Org B Customer'), 'Org A Discord payload should not leak org B customer context.', overlappingOrgAPayload)
expect(JSON.stringify(overlappingOrgBPayload).includes('Org B Customer') && !JSON.stringify(overlappingOrgBPayload).includes('Org A Customer'), 'Org B Discord payload should not leak org A customer context.', overlappingOrgBPayload)
expect(!JSON.stringify([overlappingOrgAReadiness, overlappingOrgBReadiness, overlappingOrgAPayload, overlappingOrgBPayload]).includes(secret), 'Overlapping org readiness and payloads should redact webhook secrets.', { overlappingOrgAReadiness, overlappingOrgBReadiness })

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
    {
        id: 'delivery_live_terminal_contract',
        destinationId: 'destination_terminal_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        alertId: 'alert_terminal_contract',
        eventType: 'dwm.alert.created' as const,
        status: 'failed' as const,
        dryRun: false,
        endpointHint: `https://discord.com/api/webhooks/444444444/${secret}`,
        endpointHash: 'endpoint_terminal_hash',
        payloadHash: 'payload_terminal_hash',
        payload: {},
        responseStatus: 400,
        responseBody: `bad request token=${secret}`,
        error: `bad request token=${secret}`,
        idempotencyKey: 'dwm.alert.created:org_contract:destination_terminal_contract:dwm_dedupe_terminal_contract',
        watchlistId: 'watchlist_item_terminal_contract',
        watchlistName: 'Terminal watchlist',
        route: 'customer_webhook',
        casePath: '/v1/cases/terminal',
        attemptedAt: '2026-06-28T12:09:00.000Z',
        createdAt: '2026-06-28T12:09:00.000Z',
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
const auditDestinationRows = [
    {
        id: 'destination_replay_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Replay Discord',
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
        endpointHash: 'endpoint_replay_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:04:00.000Z',
        lastTestStatus: 'dry_run' as const,
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
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/222222222/${secret}`,
        endpointHash: 'endpoint_live_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:04:00.000Z',
        lastTestStatus: 'dry_run' as const,
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
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/333333333/${secret}`,
        endpointHash: 'endpoint_disabled_hash',
        status: 'archived' as const,
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
    {
        id: 'destination_skipped_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Live Disabled Discord',
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/444444444/${secret}`,
        endpointHash: 'endpoint_skipped_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:03:00.000Z',
        lastTestStatus: 'dry_run' as const,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T11:30:00.000Z',
        updatedAt: '2026-06-28T12:03:00.000Z',
    },
]
const auditDeliveryRows = [
    ...retryLedgerRows,
    {
        id: 'delivery_replay_duplicate_contract',
        destinationId: 'destination_replay_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        alertId: 'alert_replay_contract',
        eventType: 'dwm.alert.replayed' as const,
        status: 'dry_run' as const,
        dryRun: true,
        endpointHint: `https://discord.com/api/webhooks/987654321/${secret}`,
        endpointHash: 'endpoint_replay_hash',
        payloadHash: 'payload_replay_duplicate_hash',
        payload: duplicateReplayPayload,
        responseStatus: null,
        responseBody: null,
        error: null,
        idempotencyKey: 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract',
        watchlistId: 'watchlist_item_replay_contract',
        watchlistName: 'Replay contract watchlist',
        route: 'identity_response',
        casePath: replayWorkflowAlert.casePath,
        attemptedAt: '2026-06-28T12:08:00.000Z',
        createdAt: '2026-06-28T12:08:00.000Z',
    },
    {
        id: 'delivery_test_contract',
        destinationId: 'destination_replay_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        alertId: 'webhook_test',
        eventType: 'dwm.alert.test' as const,
        status: 'dry_run' as const,
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
    {
        id: 'delivery_live_test_contract',
        destinationId: 'destination_live_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        alertId: 'webhook_test',
        eventType: 'dwm.alert.test' as const,
        status: 'dry_run' as const,
        dryRun: true,
        endpointHint: `https://discord.com/api/webhooks/222222222/${secret}`,
        endpointHash: 'endpoint_live_hash',
        payloadHash: 'payload_live_test_hash',
        payload: replayPayload,
        responseStatus: null,
        responseBody: null,
        error: null,
        idempotencyKey: 'dwm.alert.test:org_contract:destination_live_contract:webhook_test',
        watchlistId: 'test-watchlist',
        watchlistName: 'Webhook test watchlist',
        route: 'test_delivery',
        casePath: '/dashboard/dwm',
        attemptedAt: '2026-06-28T12:04:00.000Z',
        createdAt: '2026-06-28T12:04:00.000Z',
    },
]
const auditEventContracts = buildDwmWebhookAuditEventContracts({
    destinations: auditDestinationRows,
    deliveries: auditDeliveryRows,
    auditEvents: [
        {
            id: 'audit_destination_created_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: null,
            action: 'destination.created',
            metadata: { endpointHint: endpoint, endpointUrl: endpoint, status: 'active' },
            createdAt: '2026-06-28T11:00:00.000Z',
        },
        {
            id: 'audit_destination_updated_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: null,
            action: 'destination.updated',
            metadata: { endpointHash: 'endpoint_replay_hash', token: secret, events: ['dwm.alert.created', 'dwm.alert.replayed'] },
            createdAt: '2026-06-28T11:30:00.000Z',
        },
        {
            id: 'audit_destination_archived_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_disabled_contract',
            deliveryId: null,
            action: 'destination.archived',
            metadata: { endpointHint: `https://discord.com/api/webhooks/333333333/${secret}` },
            createdAt: '2026-06-28T12:05:01.000Z',
        },
        {
            id: 'audit_delivery_test_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_test_contract',
            action: 'delivery.tested',
            metadata: { status: 'dry_run', endpointHint: endpoint, dryRun: true },
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
            metadata: { status: 'failed', endpointHint: `https://discord.com/api/webhooks/222222222/${secret}`, error: `token=${secret}` },
            createdAt: '2026-06-28T12:06:01.000Z',
        },
        {
            id: 'audit_live_terminal_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_terminal_contract',
            deliveryId: 'delivery_live_terminal_contract',
            action: 'delivery.failed',
            metadata: { status: 'failed', endpointHint: `https://discord.com/api/webhooks/444444444/${secret}`, error: `token=${secret}` },
            createdAt: '2026-06-28T12:09:01.000Z',
        },
    ],
})
const destinationHealth = buildDwmWebhookDestinationHealth({
    liveDeliveryEnabled: false,
    destinations: auditDestinationRows,
    deliveries: auditDeliveryRows,
    auditEvents: [
        {
            id: 'audit_destination_archived_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_disabled_contract',
            deliveryId: null,
            action: 'destination.archived',
            metadata: { endpointHint: `https://discord.com/api/webhooks/333333333/${secret}` },
            createdAt: '2026-06-28T12:05:01.000Z',
        },
        {
            id: 'audit_delivery_test_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_test_contract',
            action: 'delivery.tested',
            metadata: { status: 'dry_run', endpointHint: endpoint, dryRun: true },
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
            metadata: { status: 'failed', endpointHint: `https://discord.com/api/webhooks/222222222/${secret}`, error: `token=${secret}` },
            createdAt: '2026-06-28T12:06:01.000Z',
        },
    ],
})
const memberHealthVisibility = filterDwmWebhookDestinationHealthForVisibility({
    destinationHealth,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberHealthVisibility = filterDwmWebhookDestinationHealthForVisibility({
    destinationHealth,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const adminLifecycle = buildDwmWebhookDestinationLifecycle({
    liveDeliveryEnabled: false,
    destinations: auditDestinationRows,
    deliveries: auditDeliveryRows,
    auditEvents: [
        ...auditEventContracts.map(item => ({
            id: item.auditEventId,
            ownerId: 'owner_contract',
            actorId: item.actorId,
            orgId: item.orgId,
            destinationId: item.destinationId,
            deliveryId: item.deliveryId,
            action: item.action,
            metadata: item.metadata,
            createdAt: item.createdAt,
        })),
        {
            id: 'audit_replay_duplicate_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_replay_duplicate_contract',
            action: 'delivery.replayed',
            metadata: { status: 'dry_run' },
            createdAt: '2026-06-28T12:08:01.000Z',
        },
    ],
    viewerRole: 'admin',
    canManage: true,
})
const memberLifecycle = buildDwmWebhookDestinationLifecycle({
    liveDeliveryEnabled: false,
    destinations: auditDestinationRows,
    deliveries: auditDeliveryRows,
    auditEvents: [
        {
            id: 'audit_delivery_test_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_test_contract',
            action: 'delivery.tested',
            metadata: { status: 'dry_run', endpointHint: endpoint, dryRun: true },
            createdAt: '2026-06-28T12:04:01.000Z',
        },
    ],
    viewerRole: 'member',
    canManage: false,
})
const orgAlertDeliveryContract = buildDwmOrgAlertWebhookDeliveryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    viewerRole: 'admin',
    canManage: true,
    destinations: auditDestinationRows,
    deliveries: auditDeliveryRows,
    auditEvents: [
        ...auditEventContracts.map(item => ({
            id: item.auditEventId,
            ownerId: 'owner_contract',
            actorId: item.actorId,
            orgId: item.orgId,
            destinationId: item.destinationId,
            deliveryId: item.deliveryId,
            action: item.action,
            metadata: item.metadata,
            createdAt: item.createdAt,
        })),
        {
            id: 'audit_replay_duplicate_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_replay_contract',
            deliveryId: 'delivery_replay_duplicate_contract',
            action: 'delivery.replayed',
            metadata: { status: 'dry_run' },
            createdAt: '2026-06-28T12:08:01.000Z',
        },
    ],
    input: {
        alert: replayWorkflowAlert,
        eventType: 'dwm.alert.replayed',
        dryRun: true,
        live: false,
    },
})
const operationDestinations = [
    ...auditDestinationRows,
    {
        id: 'destination_sent_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Already Delivered Discord',
        kind: 'discord' as const,
        endpointHint: 'https://hooks.example.com/sent',
        endpointHash: 'endpoint_sent_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:04:00.000Z',
        lastTestStatus: 'dry_run' as const,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: '2026-06-28T12:07:00.000Z',
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T12:07:00.000Z',
    },
    {
        id: 'destination_missing_url_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Missing URL Discord',
        kind: 'discord' as const,
        endpointHint: '',
        endpointHash: '',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T12:09:00.000Z',
    },
    {
        id: 'destination_paused_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Paused Discord',
        kind: 'discord' as const,
        endpointHint: 'https://discord.com/api/webhooks/555555555/...',
        endpointHash: 'endpoint_paused_hash',
        status: 'paused' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:04:00.000Z',
        lastTestStatus: 'dry_run' as const,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T12:10:00.000Z',
    },
    {
        id: 'destination_terminal_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Terminal Failure Discord',
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/444444444/${secret}`,
        endpointHash: 'endpoint_terminal_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:04:00.000Z',
        lastTestStatus: 'dry_run' as const,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: '2026-06-28T12:09:00.000Z',
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T12:09:00.000Z',
    },
]
const operationAuditEvents = [
    ...auditEventContracts.map(item => ({
        id: item.auditEventId,
        ownerId: 'owner_contract',
        actorId: item.actorId,
        orgId: item.orgId,
        destinationId: item.destinationId,
        deliveryId: item.deliveryId,
        action: item.action,
        metadata: item.metadata,
        createdAt: item.createdAt,
    })),
    {
        id: 'audit_replay_duplicate_contract',
        ownerId: 'owner_contract',
        actorId: 'owner_contract',
        orgId: 'org_contract',
        destinationId: 'destination_replay_contract',
        deliveryId: 'delivery_replay_duplicate_contract',
        action: 'delivery.replayed',
        metadata: { status: 'dry_run' },
        createdAt: '2026-06-28T12:08:01.000Z',
    },
]
const deliveryOperations = buildDwmWebhookDeliveryOperations({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
})
const deliveryRetryPersistence = buildDwmWebhookDeliveryRetryPersistence({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
})
const foreignDeliveryRetryPersistence = buildDwmWebhookDeliveryRetryPersistence({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_foreign' },
})
const deliveryOperationDetail = buildDwmWebhookDeliveryOperations({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { requestId: 'delivery_replay_duplicate_contract' },
})
const deliveryOperationByCase = buildDwmWebhookDeliveryOperations({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { casePath: replayWorkflowAlert.casePath, dedupeKey: 'dwm_dedupe_replay_contract' },
})
const retryEligibleContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_live_contract',
        eventType: 'dwm.alert.created',
        alertId: 'alert_live_contract',
        dedupeKey: 'dwm_dedupe_live_contract',
        dryRun: true,
        live: false,
    },
})
const duplicateDeliveredRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_sent_contract',
        eventType: 'dwm.alert.created',
        alertId: 'alert_sent_contract',
        dedupeKey: 'dwm_dedupe_sent_contract',
        dryRun: true,
        live: false,
    },
})
const disabledRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_disabled_contract',
        eventType: 'dwm.alert.created',
        alertId: 'alert_disabled_contract',
        dedupeKey: 'dwm_dedupe_disabled_contract',
        dryRun: true,
        live: false,
    },
})
const missingUrlRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_missing_url_contract',
        eventType: 'dwm.alert.created',
        alertId: 'alert_missing_url_contract',
        dedupeKey: 'dwm_dedupe_missing_url_contract',
        dryRun: true,
        live: false,
    },
})
const liveDisabledRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_replay_contract',
        eventType: 'dwm.alert.replayed',
        alert: replayWorkflowAlert,
        dryRun: false,
        live: true,
    },
})
const missingAlertRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_replay_contract',
        eventType: 'dwm.alert.replayed',
        dryRun: true,
        live: false,
    },
})
const readOnlyRetryContract = buildDwmWebhookDeliveryRetryContract({
    ownerId: 'owner_contract',
    liveDeliveryEnabled: false,
    canManage: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        destinationId: 'destination_live_contract',
        eventType: 'dwm.alert.created',
        alertId: 'alert_live_contract',
        dedupeKey: 'dwm_dedupe_live_contract',
        dryRun: true,
        live: false,
    },
})
const destinationAdminProof = buildDwmWebhookDestinationAdminProof({
    liveDeliveryEnabled: false,
    viewerRole: 'admin',
    canManage: true,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const destinationAdminProofDetail = {
    ...destinationAdminProof,
    destinations: destinationAdminProof.destinations.filter(item => item.destinationId === 'destination_replay_contract'),
}
const memberDestinationAdminProof = buildDwmWebhookDestinationAdminProof({
    liveDeliveryEnabled: false,
    viewerRole: 'member',
    canManage: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDestinationAdminProof = buildDwmWebhookDestinationAdminProof({
    liveDeliveryEnabled: false,
    viewerRole: null,
    canManage: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const replayDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_replay_contract')
const retryDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_live_contract')
const disabledDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_disabled_contract')
const skippedDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_skipped_contract')
const sentDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_sent_contract')
const missingUrlDestinationProof = destinationAdminProof.destinations.find(item => item.destinationId === 'destination_missing_url_contract')
const memberReplayDestinationProof = memberDestinationAdminProof.destinations.find(item => item.destinationId === 'destination_replay_contract')
const crudCreateContract = buildDwmWebhookDestinationCrudContract({
    action: 'create',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destinations: operationDestinations,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        label: 'Customer Discord',
        type: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/999999999/new-token',
        channelName: '#alerts',
        requestId: 'req_crud_create_contract',
    },
})
const crudDuplicateContract = buildDwmWebhookDestinationCrudContract({
    action: 'create',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destinations: [
        ...operationDestinations,
        {
            id: 'destination_duplicate_endpoint_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Existing duplicate Discord',
            kind: 'discord' as const,
            endpointHint: crudCreateContract.desired.redactedEndpoint.endpointHint || 'https://discord.com/api/webhooks/999999999/...',
            endpointHash: crudCreateContract.desired.redactedEndpoint.endpointHash || 'endpoint_duplicate_hash',
            status: 'active' as const,
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
            createdBy: 'owner_contract',
            lastTestedAt: '2026-06-28T12:04:00.000Z',
            lastTestStatus: 'dry_run' as const,
            lastTestError: null,
            lastTestHttpStatus: null,
            lastDeliveryAt: null,
            createdAt: '2026-06-28T11:00:00.000Z',
            updatedAt: '2026-06-28T12:11:00.000Z',
        },
    ],
    input: {
        orgId: 'org_contract',
        name: 'Duplicate Discord',
        endpointUrl: 'https://discord.com/api/webhooks/999999999/new-token',
    },
})
const crudInvalidUrlContract = buildDwmWebhookDestinationCrudContract({
    action: 'create',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destinations: operationDestinations,
    input: {
        orgId: 'org_contract',
        endpointUrl: 'http://insecure.example/webhook',
    },
})
const crudUnsupportedTypeContract = buildDwmWebhookDestinationCrudContract({
    action: 'create',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destinations: operationDestinations,
    input: {
        orgId: 'org_contract',
        type: 'teams',
        endpointUrl: 'https://hooks.example.com/teams',
    },
})
const crudEntitlementDeniedContract = buildDwmWebhookDestinationCrudContract({
    action: 'create',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    entitlementAllowed: false,
    destinations: operationDestinations,
    input: {
        orgId: 'org_contract',
        endpointUrl: 'https://hooks.example.com/denied',
    },
})
const crudUpdateContract = buildDwmWebhookDestinationCrudContract({
    action: 'update',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_contract',
        label: 'Renamed Discord',
        url: 'https://discord.com/api/webhooks/987654321/rotated-token',
        channel: '#security',
    },
})
const crudDisableContract = buildDwmWebhookDestinationCrudContract({
    action: 'disable',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract' },
})
const crudEnableContract = buildDwmWebhookDestinationCrudContract({
    action: 'enable',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_paused_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract', status: 'active' },
})
const crudTestContract = buildDwmWebhookDestinationCrudContract({
    action: 'test',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract' },
})
const crudRoleDeniedContract = buildDwmWebhookDestinationCrudContract({
    action: 'update',
    ownerId: 'owner_contract',
    viewerRole: 'member',
    canManage: false,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract', label: 'Member rename denied' },
})
const crudIdempotencyContract = buildDwmWebhookDestinationCrudContract({
    action: 'test',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_sent_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: { orgId: 'org_contract' },
})
const replayReadiness = readiness.destinations.find(item => item.destinationId === 'destination_replay_contract')
const retryReadiness = readiness.destinations.find(item => item.destinationId === 'destination_live_contract')
const disabledReadiness = readiness.destinations.find(item => item.destinationId === 'destination_disabled_contract')
const replayHealth = destinationHealth.find(item => item.destinationId === 'destination_replay_contract')
const retryHealth = destinationHealth.find(item => item.destinationId === 'destination_live_contract')
const disabledHealth = destinationHealth.find(item => item.destinationId === 'destination_disabled_contract')
const skippedHealth = destinationHealth.find(item => item.destinationId === 'destination_skipped_contract')
const adminReplayLifecycle = adminLifecycle.find(item => item.destinationId === 'destination_replay_contract')
const adminRetryLifecycle = adminLifecycle.find(item => item.destinationId === 'destination_live_contract')
const adminDisabledLifecycle = adminLifecycle.find(item => item.destinationId === 'destination_disabled_contract')
const memberReplayLifecycle = memberLifecycle.find(item => item.destinationId === 'destination_replay_contract')
const orgAlertReplayHealth = orgAlertDeliveryContract.destinationHealth.find(item => item.destinationId === 'destination_replay_contract')
const orgAlertRetryLifecycle = orgAlertDeliveryContract.destinationLifecycle.find(item => item.destinationId === 'destination_live_contract')
const auditCreated = auditEventContracts.find(item => item.auditEventId === 'audit_destination_created_contract')
const auditUpdated = auditEventContracts.find(item => item.auditEventId === 'audit_destination_updated_contract')
const auditArchived = auditEventContracts.find(item => item.auditEventId === 'audit_destination_archived_contract')
const auditTested = auditEventContracts.find(item => item.auditEventId === 'audit_delivery_test_contract')
const auditFailed = auditEventContracts.find(item => item.auditEventId === 'audit_live_retry_contract')

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
expect(deliveryPreview.context.alert.alertUrl === replayWorkflowAlert.alertUrl && deliveryPreview.context.links.alertUrl === replayWorkflowAlert.alertUrl, 'Test preview should expose alert URL/deep-link context.', deliveryPreview)
expect(!JSON.stringify(deliveryPreview).includes(secret), 'Test preview should not leak endpoint secrets.', deliveryPreview)
expect(readiness.destinationCount === 3 && readiness.activeDestinationCount === 2 && readiness.disabledDestinationCount === 1, 'Readiness should roll up multiple destinations.', readiness)
expect(readiness.blockers.includes('live_delivery_disabled') && readiness.retryScheduledCount === 1, 'Readiness should expose live-send blockers and retry schedule count.', readiness)
expect(replayReadiness?.lastTest.requestId === 'delivery_test_contract' && replayReadiness.recentAttempts.some(item => item.deliveryId === 'delivery_test_contract'), 'Readiness should include successful dry-run/test evidence.', replayReadiness)
expect(retryReadiness?.retryState.retryable === true && retryReadiness.retryState.errorClass === 'upstream_5xx' && retryReadiness.blockers.includes('retry_scheduled'), 'Readiness should expose failed retry state and failure class.', retryReadiness)
expect(disabledReadiness?.enabled === false && disabledReadiness.blockers.includes('destination_disabled') && disabledReadiness.readiness === 'disabled', 'Readiness should mark disabled destinations as blocked.', disabledReadiness)
expect(readiness.idempotencyCoverage.covered === true && retryReadiness?.idempotencyCoverage.duplicateKeyCount === 1, 'Readiness should expose idempotency coverage and duplicate attempt groups.', readiness)
expect(!JSON.stringify(readiness).includes(secret), 'Readiness should not leak endpoint, response, or error secrets.', readiness)
expect(replayHealth?.enabled === true && replayHealth.owner.ownerId === 'owner_contract' && replayHealth.redactedEndpoint.endpointHash === 'endpoint_replay_hash', 'Destination health should expose org-scoped ownership and redacted endpoint refs.', replayHealth)
expect(replayHealth?.lastDryRun?.deliveryId === 'delivery_replay_duplicate_contract' && replayHealth.lastTest.auditEventId === 'audit_delivery_test_contract', 'Destination health should expose latest dry-run/test evidence.', replayHealth)
expect(replayHealth?.idempotencyCoverage.duplicateKeyCount === 1, 'Destination health should expose duplicate replay idempotency coverage.', replayHealth)
expect(retryHealth?.retry.retryable === true && retryHealth.retry.errorClass === 'upstream_5xx' && retryHealth.lastFailure?.auditEventId === 'audit_live_retry_contract', 'Destination health should expose failure retry/backoff state.', retryHealth)
expect(disabledHealth?.enabled === false && disabledHealth.health === 'disabled' && disabledHealth.auditEventIds.includes('audit_destination_archived_contract'), 'Destination health should expose disabled state and audit ids.', disabledHealth)
expect(skippedHealth?.lastLiveDisabled?.errorClass === 'live_delivery_disabled' && skippedHealth.lastLiveDisabled.retryable === false, 'Destination health should expose live-disabled skipped attempts without retrying.', skippedHealth)
expect(memberHealthVisibility.decision.allowed === true && memberHealthVisibility.destinationHealth.length === destinationHealth.length, 'Members policy should allow active members to inspect safe destination health.', memberHealthVisibility)
expect(nonmemberHealthVisibility.decision.allowed === false && nonmemberHealthVisibility.destinationHealth.length === 0, 'Destination health visibility should deny nonmembers without leaking metadata.', nonmemberHealthVisibility)
expect(!JSON.stringify(destinationHealth).includes(secret), 'Destination health should not leak endpoint, response, or audit secrets.', destinationHealth)
expect(adminReplayLifecycle?.view === 'admin' && adminReplayLifecycle.access.canUpdate === true && adminReplayLifecycle.access.canTest === true && adminReplayLifecycle.access.canDisable === true, 'Destination lifecycle should expose admin capabilities for owner/admin users.', adminReplayLifecycle)
expect(adminReplayLifecycle?.lifecycle.created?.actorId === 'owner_contract' && adminReplayLifecycle.auditEventContracts.length > 0, 'Admin lifecycle should expose audit actors and redacted audit event contracts.', adminReplayLifecycle)
expect(adminReplayLifecycle?.lifecycle.lastReplay?.deliveryId === 'delivery_replay_duplicate_contract' && adminReplayLifecycle.health.idempotencyCoverage.duplicateKeyCount === 1, 'Destination lifecycle should expose replay dedupe and latest replay request.', adminReplayLifecycle)
expect(adminRetryLifecycle?.retry.retryable === true && adminRetryLifecycle.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && adminRetryLifecycle.retry.lastErrorCategory === 'upstream_5xx', 'Destination lifecycle should expose retry/backoff visibility.', adminRetryLifecycle)
expect(adminRetryLifecycle?.retry.deliveryId === 'delivery_live_failed_retry_contract' && adminRetryLifecycle.retry.dedupeKey === 'dwm_dedupe_live_contract', 'Destination lifecycle retry state should include delivery/request and dedupe context.', adminRetryLifecycle)
expect(adminDisabledLifecycle?.enabled === false && adminDisabledLifecycle.access.canDisable === false && adminDisabledLifecycle.lifecycle.disabled?.auditEventId === 'audit_destination_archived_contract', 'Destination lifecycle should expose disabled state and disable audit event.', adminDisabledLifecycle)
expect(memberReplayLifecycle?.view === 'member' && memberReplayLifecycle.access.canUpdate === false && memberReplayLifecycle.access.canTest === false && memberReplayLifecycle.auditEventContracts.length === 0, 'Member lifecycle should expose safe read status without admin audit detail.', memberReplayLifecycle)
expect(!JSON.stringify(adminLifecycle).includes(secret) && !JSON.stringify(memberLifecycle).includes(secret), 'Destination lifecycle should not leak endpoint, response, or audit secrets.', { adminLifecycle, memberLifecycle })
expect(orgAlertDeliveryContract.schemaVersion === 'dwm.webhook.org_alert_delivery.v1' && orgAlertDeliveryContract.orgId === 'org_contract', 'Org alert delivery contract should normalize org alert context.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.eventType === 'dwm.alert.replayed' && orgAlertDeliveryContract.dryRun === true && orgAlertDeliveryContract.externalSendEnabled === false, 'Org alert delivery contract should preserve dry-run/no-network semantics.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.alert.id === 'alert_replay_contract' && orgAlertDeliveryContract.alert.casePath === replayWorkflowAlert.casePath && orgAlertDeliveryContract.alert.provenanceSummary.includes('captures'), 'Org alert delivery contract should expose alert case/provenance context.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.watchlist.id === 'watchlist_item_replay_contract' && orgAlertDeliveryContract.watchlist.terms.includes('acme-security.com'), 'Org alert delivery contract should expose watchlist identity.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.destinationSelection.selectedDestinations.some(item => item.id === 'destination_replay_contract' && item.idempotencyKey === 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract'), 'Org alert delivery contract should expose destination idempotency keys.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.destinationSelection.skippedDestinations.some(item => item.id === 'destination_disabled_contract' && item.reason === 'disabled'), 'Org alert delivery contract should expose disabled destination skips.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.alertDestinationReadiness.schemaVersion === 'dwm.webhook.alert_readiness_handoff.v1' && orgAlertDeliveryContract.alertDestinationReadiness.orgId === 'org_contract', 'Org alert delivery contract should include destination readiness handoff.', orgAlertDeliveryContract.alertDestinationReadiness)
expect(orgAlertReplayHealth?.lastDryRun?.deliveryId === 'delivery_replay_duplicate_contract' && orgAlertReplayHealth.idempotencyCoverage.duplicateKeyCount === 1, 'Org alert delivery contract should derive dry-run health mutation and replay dedupe.', orgAlertReplayHealth)
expect(orgAlertRetryLifecycle?.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && orgAlertRetryLifecycle.retry.lastErrorCategory === 'upstream_5xx', 'Org alert delivery contract should expose retry/backoff state.', orgAlertRetryLifecycle)
expect(orgAlertDeliveryContract.auditEventContracts.some(item => item.auditEventId === 'audit_replay_duplicate_contract') && orgAlertDeliveryContract.deliveryLedger.some(item => item.deliveryId === 'delivery_replay_duplicate_contract'), 'Org alert delivery contract should link audit ids and delivery ledger rows.', orgAlertDeliveryContract)
expect(!JSON.stringify(orgAlertDeliveryContract).includes(secret), 'Org alert delivery contract should not leak endpoint, response, or audit secrets.', orgAlertDeliveryContract)
expect(deliveryOperations.schemaVersion === 'dwm.webhook.delivery_operations.v1' && deliveryOperations.total === auditDeliveryRows.filter(item => item.orgId === 'org_contract').length, 'Delivery operations should list recent org deliveries.', deliveryOperations)
expect(deliveryOperations.counts.replay >= 2 && deliveryOperations.counts.retryable >= 1 && deliveryOperations.counts.failed >= 1, 'Delivery operations should roll up replay, retryable, and failed counts.', deliveryOperations)
expect(deliveryOperations.recentDeliveries.some(item => item.deliveryId === 'delivery_live_failed_retry_contract' && item.attempts.nextRetryAt === '2026-06-28T12:11:00.000Z' && item.attempts.lastErrorCategory === 'upstream_5xx'), 'Delivery operations should expose retry/backoff detail.', deliveryOperations)
expect(deliveryOperations.recentDeliveries.some(item => item.deliveryId === 'delivery_replay_duplicate_contract' && item.replay === true && item.auditEventId === 'audit_replay_duplicate_contract'), 'Delivery operations should link replay markers and audit ids.', deliveryOperations)
const persistedRetryKey = deliveryRetryPersistence.deliveryKeys.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_live_contract:dwm_dedupe_live_contract')
const persistedReplayKey = deliveryRetryPersistence.deliveryKeys.find(item => item.idempotencyKey === 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract')
const persistedTerminalKey = deliveryRetryPersistence.deliveryKeys.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_terminal_contract:dwm_dedupe_terminal_contract')
const persistedSentKey = deliveryRetryPersistence.deliveryKeys.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_sent_contract:dwm_dedupe_sent_contract')
expect(deliveryRetryPersistence.schemaVersion === 'dwm.webhook.delivery_retry_persistence.v1' && deliveryRetryPersistence.counts.retryable >= 1, 'Delivery retry persistence should expose grouped retry proof.', deliveryRetryPersistence)
expect(persistedRetryKey?.retry.retryable === true && persistedRetryKey.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && persistedRetryKey.retry.persistedAttemptCount === 2, 'Delivery retry persistence should keep retry/backoff attempts by idempotency key.', persistedRetryKey)
expect(persistedReplayKey?.replay === true && persistedReplayKey.dedupe.duplicate === true && persistedReplayKey.dedupe.duplicateAttemptCount === 2, 'Delivery retry persistence should expose duplicate replay/dedupe proof.', persistedReplayKey)
expect(persistedTerminalKey?.status === 'terminal_failure' && persistedTerminalKey.retry.terminalFailure === true && persistedTerminalKey.retry.lastErrorCategory === 'upstream_4xx', 'Delivery retry persistence should separate terminal failures from retryable failures.', persistedTerminalKey)
expect(persistedSentKey?.dedupe.alreadyDelivered === true && persistedSentKey.status === 'delivered', 'Delivery retry persistence should mark already delivered dedupe keys.', persistedSentKey)
expect(foreignDeliveryRetryPersistence.deliveryKeys.length === 1 && foreignDeliveryRetryPersistence.deliveryKeys.every(item => item.orgId === 'org_foreign'), 'Delivery retry persistence org filter should not leak other org attempts.', foreignDeliveryRetryPersistence)
expect(!JSON.stringify(deliveryRetryPersistence).includes(secret), 'Delivery retry persistence should redact endpoint, response, and error secrets.', deliveryRetryPersistence)
expect(deliveryOperationDetail.total === 1 && deliveryOperationDetail.recentDeliveries[0]?.deliveryId === 'delivery_replay_duplicate_contract', 'Delivery operations should retrieve a delivery by request id.', deliveryOperationDetail)
expect(deliveryOperationByCase.recentDeliveries.every(item => item.casePath === replayWorkflowAlert.casePath && item.dedupeKey === 'dwm_dedupe_replay_contract'), 'Delivery operations should filter by case path and dedupe key.', deliveryOperationByCase)
expect(retryEligibleContract.canRetry === true && retryEligibleContract.blockers.length === 0 && retryEligibleContract.deliveryOperations.total >= 1, 'Retry contract should allow eligible failed dry-run retry without network.', retryEligibleContract)
expect(duplicateDeliveredRetryContract.canRetry === false && duplicateDeliveredRetryContract.blockers.some(item => item.code === 'dedupe_already_delivered'), 'Retry contract should block already-delivered idempotency keys.', duplicateDeliveredRetryContract)
expect(disabledRetryContract.canRetry === false && disabledRetryContract.blockers.some(item => item.code === 'destination_disabled'), 'Retry contract should block disabled destinations.', disabledRetryContract)
expect(missingUrlRetryContract.canRetry === false && missingUrlRetryContract.blockers.some(item => item.code === 'missing_webhook_url'), 'Retry contract should block destinations missing webhook URL refs.', missingUrlRetryContract)
expect(liveDisabledRetryContract.externalSendEnabled === false && liveDisabledRetryContract.blockers.some(item => item.code === 'live_delivery_disabled'), 'Retry contract should preserve live-disabled no-network semantics.', liveDisabledRetryContract)
expect(missingAlertRetryContract.canRetry === false && missingAlertRetryContract.blockers.some(item => item.code === 'missing_alert_context'), 'Retry contract should require alert context.', missingAlertRetryContract)
expect(readOnlyRetryContract.canRetry === false && readOnlyRetryContract.access.canManage === false, 'Retry contract should require owner/admin management access.', readOnlyRetryContract)
expect(!JSON.stringify(deliveryOperations).includes(secret) && !JSON.stringify(retryEligibleContract).includes(secret), 'Delivery operations and retry contract should not leak endpoint secrets.', { deliveryOperations, retryEligibleContract })
expect(destinationAdminProof.schemaVersion === 'dwm.webhook.destination_admin_proof.v1' && destinationAdminProof.summary.destinationCount === operationDestinations.length, 'Destination admin proof should list destination health rows.', destinationAdminProof)
expect(destinationAdminProof.productProgress.schemaVersion === 'dwm.webhook.destination_admin_product_progress.v1' && destinationAdminProof.productProgress.href === '/dashboard/automations?setup=dwm', 'Destination admin proof should expose product-progress fields.', destinationAdminProof.productProgress)
expect(destinationAdminProof.productProgress.destinationCount === operationDestinations.length && destinationAdminProof.productProgress.activeDestinationCount >= 1 && destinationAdminProof.productProgress.deliveryReadyCount >= 1, 'Destination admin proof should expose destination readiness counts for probes.', destinationAdminProof.productProgress)
expect(replayDestinationProof?.redactedEndpoint.endpointHash === 'endpoint_replay_hash' && replayDestinationProof.deliveryOperations.latestOrgAlert?.requestId === 'delivery_replay_duplicate_contract', 'Destination admin proof should expose redacted endpoint and latest org alert context.', replayDestinationProof)
expect(replayDestinationProof?.replay.latestReplayRequestId === 'delivery_replay_duplicate_contract' && replayDestinationProof.dedupe.duplicateKeyCount === 1, 'Destination admin proof should expose replay and dedupe state.', replayDestinationProof)
expect(retryDestinationProof?.retry.retryable === true && retryDestinationProof.retry.lastErrorCategory === 'upstream_5xx' && retryDestinationProof.health.adminProofBlockers.some(item => item.code === 'destination_unhealthy' && item.retryable === true), 'Destination admin proof should expose retry eligibility and failure categories.', retryDestinationProof)
expect(disabledDestinationProof?.health.adminProofBlockers.some(item => item.code === 'destination_disabled') && disabledDestinationProof.health.adminProofBlockers.some(item => item.code === 'no_verified_dry_run'), 'Destination admin proof should expose disabled and no dry-run blockers.', disabledDestinationProof)
expect(missingUrlDestinationProof?.health.adminProofBlockers.some(item => item.code === 'no_live_endpoint') && missingUrlDestinationProof.health.adminProofBlockers.some(item => item.code === 'missing_org_alert_context') && missingUrlDestinationProof.health.adminProofBlockers.some(item => item.code === 'audit_missing'), 'Destination admin proof should expose missing endpoint, org-alert-context, and audit blockers.', missingUrlDestinationProof)
expect(sentDestinationProof?.dedupe.alreadyDelivered === true && sentDestinationProof.health.adminProofBlockers.some(item => item.code === 'dedupe_already_delivered'), 'Destination admin proof should expose dedupe already delivered blockers.', sentDestinationProof)
expect(skippedDestinationProof?.health.adminProofBlockers.some(item => item.code === 'retry_not_eligible'), 'Destination admin proof should expose retry-not-eligible blockers for nonretryable skipped attempts.', skippedDestinationProof)
expect(destinationAdminProof.blockers.some(item => item.code === 'audit_missing') && destinationAdminProof.blockers.some(item => item.code === 'retry_not_eligible'), 'Destination admin proof should roll up audit and retry blocker codes.', destinationAdminProof.blockers)
expect(destinationAdminProofDetail.destinations.length === 1 && destinationAdminProofDetail.destinations[0]?.destinationId === 'destination_replay_contract', 'Destination admin proof should support destination detail filtering for consumers.', destinationAdminProofDetail)
expect(memberDestinationAdminProof.access.memberSafe === true && memberReplayDestinationProof?.access.canManage === false && memberReplayDestinationProof.audit.auditEventContracts.length === 0, 'Destination admin proof should expose member-safe read views without admin audit contracts.', memberDestinationAdminProof)
expect(nonmemberDestinationAdminProof.visibility.allowed === false && nonmemberDestinationAdminProof.destinations.length === 0 && nonmemberDestinationAdminProof.blockers.some(item => item.code === 'permission_denied'), 'Destination admin proof should deny nonmembers without leaking destination metadata.', nonmemberDestinationAdminProof)
expect(orgAlertDeliveryContract.destinationAdminProof.schemaVersion === 'dwm.webhook.destination_admin_proof.v1' && orgAlertDeliveryContract.destinationAdminProof.destinations.length === auditDestinationRows.length, 'Org alert delivery contract should include destination admin proof.', orgAlertDeliveryContract.destinationAdminProof)
expect(!JSON.stringify(destinationAdminProof).includes(secret) && !JSON.stringify(memberDestinationAdminProof).includes(secret), 'Destination admin proof should not leak endpoint secrets.', { destinationAdminProof, memberDestinationAdminProof })
expect(crudCreateContract.schemaVersion === 'dwm.webhook.destination_crud.v1' && crudCreateContract.action === 'create' && crudCreateContract.canApply === true, 'Destination CRUD contract should allow valid create preflight.', crudCreateContract)
expect(crudCreateContract.desired.label === 'Customer Discord' && crudCreateContract.desired.channel === '#alerts' && crudCreateContract.desired.type === 'discord', 'Destination CRUD contract should normalize customer-facing label/type/channel aliases.', crudCreateContract)
expect(crudCreateContract.desired.redactedEndpoint.endpointHash?.startsWith('endpoint_') && !JSON.stringify(crudCreateContract).includes('new-token'), 'Destination CRUD contract should hash and redact create endpoints.', crudCreateContract)
expect(crudDuplicateContract.canApply === false && crudDuplicateContract.blockers.some(item => item.code === 'duplicate_destination' && item.blocking === true), 'Destination CRUD contract should block duplicate org endpoint creates.', crudDuplicateContract)
expect(crudInvalidUrlContract.canApply === false && crudInvalidUrlContract.blockers.some(item => item.code === 'invalid_url'), 'Destination CRUD contract should block invalid/insecure URLs.', crudInvalidUrlContract)
expect(crudUnsupportedTypeContract.canApply === false && crudUnsupportedTypeContract.blockers.some(item => item.code === 'unsupported_destination_type'), 'Destination CRUD contract should block unsupported destination types.', crudUnsupportedTypeContract)
expect(crudEntitlementDeniedContract.canApply === false && crudEntitlementDeniedContract.blockers.some(item => item.code === 'entitlement_plan_denied'), 'Destination CRUD contract should expose entitlement/plan denial blockers.', crudEntitlementDeniedContract)
expect(crudUpdateContract.canApply === true && crudUpdateContract.action === 'update' && crudUpdateContract.desired.label === 'Renamed Discord' && crudUpdateContract.desired.channel === '#security', 'Destination CRUD contract should allow admin update and endpoint rotation preflight.', crudUpdateContract)
expect(crudDisableContract.canApply === true && crudDisableContract.access.canDisable === true && crudDisableContract.audit.auditEventIds.includes('audit_delivery_test_contract'), 'Destination CRUD contract should expose disable capability and audit linkage.', crudDisableContract)
expect(crudEnableContract.canApply === true && crudEnableContract.action === 'enable' && crudEnableContract.access.canEnable === true, 'Destination CRUD contract should allow enable preflight for paused destinations.', crudEnableContract)
expect(crudTestContract.canApply === true && crudTestContract.access.canTest === true && crudTestContract.noNetwork === true, 'Destination CRUD contract should allow dry-run test preflight without network.', crudTestContract)
expect(crudRoleDeniedContract.canApply === false && crudRoleDeniedContract.blockers.some(item => item.code === 'permission_denied'), 'Destination CRUD contract should enforce owner/admin mutation gates.', crudRoleDeniedContract)
expect(crudIdempotencyContract.idempotency.alreadyDelivered === true && crudIdempotencyContract.blockers.some(item => item.code === 'idempotency_duplicate' && item.blocking === false), 'Destination CRUD contract should expose idempotency duplicates without leaking secrets.', crudIdempotencyContract)
expect(crudTestContract.health.productProgress.schemaVersion === 'dwm.webhook.destination_admin_product_progress.v1' && crudTestContract.health.productProgress.deliveryReadyCount >= 1, 'Destination CRUD contract should link product-progress/admin-proof health fields.', crudTestContract)
expect(!JSON.stringify([crudCreateContract, crudUpdateContract, crudIdempotencyContract]).includes(secret) && !JSON.stringify(crudUpdateContract).includes('rotated-token'), 'Destination CRUD contracts should not leak endpoint secrets.', { crudCreateContract, crudUpdateContract, crudIdempotencyContract })
expect(auditCreated?.category === 'destination' && auditCreated.outcome === 'created' && auditCreated.destination?.redactedEndpoint.endpointHash === 'endpoint_replay_hash', 'Audit contract should expose destination create events with redacted endpoint refs.', auditCreated)
expect(auditUpdated?.outcome === 'updated' && (auditUpdated.metadata as Record<string, unknown>).token === '[redacted]', 'Audit contract should expose destination update events without secrets.', auditUpdated)
expect(auditArchived?.outcome === 'disabled' && auditArchived.severity === 'warning' && auditArchived.destination?.enabled === false, 'Audit contract should expose destination disable/archive events.', auditArchived)
expect(auditTested?.category === 'delivery' && auditTested.outcome === 'tested' && auditTested.delivery?.dryRun === true && auditTested.requestId === 'delivery_test_contract', 'Audit contract should expose dry-run test delivery events.', auditTested)
expect(auditFailed?.outcome === 'failed' && auditFailed.severity === 'error' && auditFailed.retry?.retryable === true && auditFailed.retry.errorClass === 'upstream_5xx', 'Audit contract should expose failed delivery retry state.', auditFailed)
expect(!JSON.stringify(auditEventContracts).includes(secret), 'Audit event contracts should redact endpoint, token, and error secrets.', auditEventContracts)

console.log(JSON.stringify({
    ok: true,
    checked: [
        'destination validation',
        'discord kind inference',
        'endpoint redaction/hash',
        'HTTPS-only customer endpoint validation',
        'Discord payload formatting',
        'Discord payload alert URL/deep link',
        'Discord payload truncation limits',
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
        'destination health status summary',
        'destination health dry-run/test update',
        'destination health failure retry/backoff',
        'destination health live-disabled state',
        'destination health duplicate replay dedupe',
        'destination health org visibility allowed/denied',
        'destination health secret redaction',
        'destination lifecycle admin capabilities',
        'destination lifecycle member-safe view',
        'destination lifecycle replay dedupe',
        'destination lifecycle retry/backoff visibility',
        'destination lifecycle disabled state',
        'destination lifecycle secret redaction',
        'org alert delivery contract normalization',
        'org alert delivery watchlist/provenance context',
        'org alert delivery destination selection',
        'org alert delivery health/lifecycle linkage',
        'org alert delivery destination readiness handoff',
        'org alert delivery audit/ledger linkage',
        'org alert delivery secret redaction',
        'two-org overlapping watchlist destination isolation',
        'two-org overlapping watchlist delivery isolation',
        'two-org overlapping watchlist Discord payload isolation',
        'delivery operations list/detail filters',
        'delivery operations retry/backoff summary',
        'delivery operations replay/audit linkage',
        'delivery retry persistence grouped idempotency keys',
        'delivery retry persistence terminal failure state',
        'delivery retry persistence duplicate replay dedupe',
        'delivery retry persistence wrong-org filtering',
        'delivery retry persistence secret redaction',
        'delivery retry eligibility contract',
        'delivery retry typed blockers',
        'delivery retry role gate',
        'delivery operations secret redaction',
        'destination admin proof list/detail',
        'destination admin proof product-progress fields',
        'destination admin proof role gates',
        'destination admin proof retry/failure categories',
        'destination admin proof typed blockers',
        'destination admin proof audit-missing blocker',
        'destination admin proof retry-not-eligible blocker',
        'destination admin proof replay/dedupe state',
        'destination admin proof audit linkage',
        'destination admin proof secret redaction',
        'destination CRUD create/update aliases',
        'destination CRUD invalid URL blocker',
        'destination CRUD unsupported type blocker',
        'destination CRUD duplicate endpoint blocker',
        'destination CRUD entitlement blocker',
        'destination CRUD disable/enable/test preflight',
        'destination CRUD role denial',
        'destination CRUD idempotency/audit linkage',
        'destination CRUD product-progress linkage',
        'destination CRUD secret redaction',
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
        'structured audit contract create/update/disable/test/failure events',
        'structured audit contract retry state',
        'structured audit contract secret redaction',
        'dry-run Discord payload preview fields',
        'delivery evidence replay/live/dry-run distinction',
        'secret-free payload',
    ],
    worker3Probe: {
        route: 'GET /api/dwm/webhooks?orgId=<org_id>',
        followUpRoute: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&destinationId=<destination_id>',
        expectedFields: [
            'destinationAdminProof.schemaVersion',
            'destinationAdminProof.productProgress.status',
            'destinationAdminProof.productProgress.destinationCount',
            'destinationAdminProof.productProgress.activeDestinationCount',
            'destinationAdminProof.productProgress.deliveryReadyCount',
            'destinationAdminProof.productProgress.blockerCodes',
            'destinationAdminProof.destinations[].redactedEndpoint.endpointHash',
            'destinationAdminProof.destinations[].retry.lastErrorCategory',
            'destinationAdminProof.destinations[].replay.latestReplayRequestId',
            'destinationAdminProof.destinations[].dedupe.latestDedupeKey',
            'destinationAdminProof.destinations[].audit.latestAuditEventId',
            'destinationCrud.schemaVersion',
            'destinationCrud.action',
            'destinationCrud.canApply',
            'destinationCrud.blockers[].code',
            'destinationCrud.desired.redactedEndpoint.endpointHash',
            'destinationCrud.health.productProgress.status',
            'deliveryRetryPersistence.schemaVersion',
            'deliveryRetryPersistence.deliveryKeys[].retry.nextRetryAt',
            'deliveryRetryPersistence.deliveryKeys[].retry.terminalFailure',
            'deliveryRetryPersistence.deliveryKeys[].dedupe.duplicateAttemptCount',
            'orgAlertDelivery.alertDestinationReadiness.schemaVersion',
            'orgAlertDelivery.alertDestinationReadiness.destinationSelection.selectedDestinationIds',
            'orgAlertDelivery.alertDestinationReadiness.deliveryRetryPersistence.deliveryKeys[]',
        ],
        expectedNoSecretFields: ['endpointUrl', 'endpointSecret', 'endpoint_encrypted'],
        expectedNoNetwork: true,
    },
}, null, 2))
