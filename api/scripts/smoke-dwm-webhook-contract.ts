import {
    buildDwmAlertDeliveryPayload,
    buildDwmAlertWebhookReadinessHandoff,
    buildDwmAlertWebhookNotificationInput,
    buildDwmAlertWebhookDispatchPlan,
    buildDwmAlertWebhookMissingDeliveryIntent,
    buildDwmAlertWebhookSkippedDeliveryIntents,
    buildDwmOrgAlertWebhookDeliveryContract,
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookDeliveryActionPlan,
    buildDwmWebhookDeliveryAuditTrail,
    buildDwmWebhookCustomerSetupProof,
    buildDwmWebhookDashboardReadinessAdapter,
    buildDwmWebhookDestinationAdminProof,
    buildDwmWebhookDestinationDeliveryMatrix,
    buildDwmWebhookDestinationCrudContract,
    buildDwmWebhookDestinationHealth,
    buildDwmWebhookDestinationTestContract,
    buildDwmWebhookDestinationLifecycle,
    buildDwmWebhookDestinationLookupContract,
    buildDwmWebhookDeliveryPreview,
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryHistory,
    buildDwmWebhookDeliveryHistoryConsumerProof,
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryOperations,
    buildDwmWebhookDeliveryPersistenceProof,
    buildDwmWebhookDeliveryAttemptContract,
    buildDwmWebhookDeliveryAttemptPersistenceProof,
    buildDwmWebhookDeliveryAttemptPersistenceReadModel,
    buildDwmWebhookDeliveryReceipts,
    buildDwmWebhookDeliveryReplayGuard,
    buildDwmWebhookDeliveryReplayApiContract,
    buildDwmWebhookDeliveryTimeline,
    buildDwmWebhookDeliveryReadiness,
    buildDwmWebhookDeliveryReadinessConsumerProof,
    buildDwmWebhookDeliveryRequestInput,
    buildDwmWebhookDeliveryRetryContract,
    buildDwmWebhookDeliveryRetryPersistence,
    buildDwmWebhookDeliveryRetryQueue,
    buildDwmWebhookDeliveryRetryRequestContract,
    buildDwmWebhookDeliveryRetryWorkOrders,
    buildDwmWebhookDestinationContracts,
    filterDwmWebhookDeliveryEvidenceForVisibility,
    filterDwmWebhookDestinationHealthForVisibility,
    normalizeDwmWebhookDestinationInput,
    planDwmWebhookDeliveryRetry,
    redactWebhookEndpoint,
    sanitizeDwmWebhookDeliveryDiagnostic,
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
const sanitizedDiagnostic = sanitizeDwmWebhookDeliveryDiagnostic(`Discord rejected ${endpoint}?token=${secret} token=${secret}`)
expect(Boolean(sanitizedDiagnostic) && sanitizedDiagnostic.includes('/api/webhooks/987654321/...') && sanitizedDiagnostic.includes('token=[redacted]') && !sanitizedDiagnostic.includes(secret), 'Persisted delivery diagnostics should redact webhook URLs and token fragments.', sanitizedDiagnostic)

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
        tenantId: 'tenant_contract',
        confidenceScore: 0.91,
        confidenceReason: 'Domain and company matched across two independent captures.',
        deliveryState: 'retry_scheduled',
        createdAt: '2026-06-28T09:15:00.000Z',
        matchedTerm: { value: 'acme-security.com', kind: 'domain' },
        evidence: [
            { label: 'Victim claim', detail: 'Public leak-site metadata matched the watched domain.', capturedAt: '2026-06-28T08:58:00.000Z' },
            { label: 'Telegram mention', detail: 'Public channel echoed the same domain.', capturedAt: '2026-06-28T09:02:00.000Z' },
        ],
        dedupeKey: 'dwm_dedupe_acme_contract',
        route: 'customer_discord',
        casePath: '/dashboard/dwm?alert=alert_contract',
        alertUrl: 'https://app.hanasand.local/dashboard/dwm?alert=alert_contract',
        caseId: 'case_contract',
        caseActionId: 'case_action_contract',
        caseActionPath: '/dashboard/dwm/cases/case_contract/actions/case_action_contract',
        provenance: { captureIds: ['capture_contract'], sourceIds: ['source_contract'], primaryCaptureId: 'capture_contract' },
        watchlist: {
            id: 'watchlist_contract',
            name: 'Acme watchlist',
            terms: ['acme-security.com'],
        },
    },
}) as Record<string, unknown>

const serialized = JSON.stringify(payload)
const payloadContext = payload._hanasand as Record<string, unknown>
const payloadTemplate = payloadContext.discordTemplate as Record<string, unknown>
const payloadEmbed = (payload.embeds as Array<Record<string, unknown>>)[0]
const payloadFields = payloadEmbed.fields as Array<Record<string, unknown>>
expect(Array.isArray(payload.embeds), 'Discord payload should include embeds.', payload)
expect(serialized.includes('Critical Acme domain exposure'), 'Payload should include alert title.', payload)
expect(serialized.includes('CRITICAL'), 'Payload should include severity.', payload)
expect(payloadContext.occurredAt === '2026-06-28T09:15:00.000Z' && payloadEmbed.timestamp === '2026-06-28T09:15:00.000Z', 'Payload should preserve real alert event timestamp.', payload)
expect(payloadFields.some(field => field.name === 'Observed at' && field.value === '2026-06-28T09:15:00.000Z'), 'Discord payload should include an operator-readable observed timestamp field.', payloadFields)
expect(payloadFields.some(field => field.name === 'Delivery state' && field.value === 'retry_scheduled'), 'Discord payload should expose the next delivery state.', payloadFields)
expect(payloadFields.some(field => field.name === 'Match reason' && String(field.value).includes('domain match: acme-security.com') && String(field.value).includes('two independent captures')), 'Discord payload should explain why the alert matched.', payloadFields)
expect(payloadFields.some(field => field.name === 'Evidence timestamp' && field.value === '2026-06-28T08:58:00.000Z'), 'Discord payload should include the evidence capture timestamp.', payloadFields)
expect(serialized.includes('Acme Security'), 'Payload should include company context.', payload)
expect(serialized.includes('acme-security.com'), 'Payload should include domain/matched term.', payload)
expect(serialized.includes('ransomware_leak_site'), 'Payload should include source family.', payload)
expect(serialized.includes('Confidence') && serialized.includes('91%') && serialized.includes('two independent captures'), 'Payload should include confidence context.', payload)
expect(serialized.includes('Evidence count'), 'Payload should include evidence count field.', payload)
expect(serialized.includes('Acme watchlist') && serialized.includes('acme-security.com'), 'Payload should include watchlist context.', payload)
expect(serialized.includes('customer_discord'), 'Payload should include route.', payload)
expect(serialized.includes('dwm_dedupe_acme_contract'), 'Payload should include alert dedupe key.', payload)
expect(serialized.includes('dwm.alert.replayed:org_contract:destination_contract:dwm_dedupe_acme_contract'), 'Payload should include destination idempotency key.', payload)
expect(serialized.includes('case_contract'), 'Payload should include case id.', payload)
expect(serialized.includes('/dashboard/dwm?alert=alert_contract'), 'Payload should include case path.', payload)
expect(payloadFields.some(field => field.name === 'Case action' && field.value === '/dashboard/dwm/cases/case_contract/actions/case_action_contract'), 'Payload should include case action replay path.', payloadFields)
expect(serialized.includes('Alert URL') && serialized.includes('https://app.hanasand.local/dashboard/dwm?alert=alert_contract'), 'Payload should include alert URL/deep link.', payload)
expect(serialized.includes('Analyst link') && ((payloadContext.delivery as Record<string, unknown>).analystLink === 'https://app.hanasand.local/dashboard/dwm?alert=alert_contract'), 'Payload should include a single analyst action/deep link.', payload)
expect(serialized.includes('capture_contract') && serialized.includes('source_contract'), 'Payload should include provenance summary.', payload)
expect(serialized.includes('Workflow') && serialized.includes('replayed') && serialized.includes('tenant_contract'), 'Payload should include workflow and tenant routing context.', payload)
expect(payloadTemplate.schemaVersion === 'dwm.webhook.discord_payload_template.v1' && payloadTemplate.templateId === 'dwm.discord.alert_replay.v1' && payloadTemplate.ready === true, 'Discord payload should include a ready replay template contract.', payloadTemplate)
expect(Array.isArray(payloadTemplate.requiredFields) && payloadTemplate.requiredFields.includes('Watchlist') && payloadTemplate.requiredFields.includes('Dedupe key') && payloadTemplate.requiredFields.includes('Delivery state') && payloadTemplate.requiredFields.includes('Match reason') && payloadTemplate.requiredFields.includes('Evidence timestamp'), 'Discord template should declare customer-useful required fields.', payloadTemplate)
expect((payloadTemplate.redaction as Record<string, unknown>)?.webhookSecretExposed === false && payloadTemplate.noNetworkDefault === true, 'Discord template should prove no-network redaction defaults.', payloadTemplate)
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
const longTemplate = longContext.discordTemplate as Record<string, unknown>

expect(String(longDiscordPayload.content).length <= 2000, 'Discord content should respect the 2000 character limit.', longDiscordPayload)
expect(String(longEmbed.title).length <= 256, 'Discord embed title should respect the 256 character limit.', longEmbed)
expect(String(longEmbed.description).length <= 4096, 'Discord embed description should respect the 4096 character limit.', longEmbed)
expect(longFields.length <= 25, 'Discord embed fields should respect the 25 field limit.', longFields)
expect(longFields.every(field => String(field.name).length <= 256 && String(field.value).length <= 1024), 'Discord embed fields should respect name/value limits.', longFields)
expect(JSON.stringify(longDiscordPayload).includes('Alert URL') && longAlertContext.alertUrl === 'https://app.hanasand.local/dashboard/dwm?alert=alert_long_contract&case=case_long_contract', 'Long Discord payload should preserve alert deep link context.', longDiscordPayload)
expect((longTemplate.limits as Record<string, unknown>)?.fields === 25 && longTemplate.templateId === 'dwm.discord.alert_created.v1', 'Discord template should expose enforced Discord limits for created alerts.', longTemplate)

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
const skippedDeliveryIntents = buildDwmAlertWebhookSkippedDeliveryIntents(dispatchPlan)
expect(skippedDeliveryIntents.map(item => item.destinationId).sort().join(',') === 'destination_created_only,destination_paused', 'Dispatch should create persistable skipped delivery intents only for same-org destinations.', skippedDeliveryIntents)
expect(skippedDeliveryIntents.every(item => item.persistable === true && item.idempotencyKey.includes(`:${item.orgId}:${item.destinationId}:`)), 'Skipped delivery intents should carry durable idempotency keys.', skippedDeliveryIntents)
expect(skippedDeliveryIntents.some(item => item.reason === 'disabled' && item.error.includes('disabled')), 'Skipped delivery intents should explain disabled destinations.', skippedDeliveryIntents)
expect(!JSON.stringify(skippedDeliveryIntents).includes('destination_foreign_org'), 'Skipped delivery intents must not persist foreign-org destination leakage.', skippedDeliveryIntents)
const missingDestinationPlan = buildDwmAlertWebhookDispatchPlan({
    ownerId: 'owner_contract',
    input: {
        organizationId: 'org_contract',
        alertId: 'alert_missing_destination_contract',
        eventType: 'dwm.alert.created',
        watchlistItemId: 'watchlist_missing_destination_contract',
        dedupeKey: 'dwm_dedupe_missing_destination_contract',
        route: 'customer_discord',
        casePath: '/dashboard/dwm?alert=alert_missing_destination_contract',
        evidenceCount: 1,
        sourceFamily: 'telegram_public',
    },
    destinations: [],
})
const missingDestinationIntent = buildDwmAlertWebhookMissingDeliveryIntent(missingDestinationPlan)
const requestedMissingDestinationIntent = buildDwmAlertWebhookMissingDeliveryIntent(missingDestinationPlan, 'destination_requested_missing')
const missingDestinationReadiness = buildDwmAlertWebhookReadinessHandoff({
    ownerId: 'owner_contract',
    input: {
        organizationId: 'org_contract',
        alertId: 'alert_missing_destination_contract',
        eventType: 'dwm.alert.created',
        watchlistItemId: 'watchlist_missing_destination_contract',
        dedupeKey: 'dwm_dedupe_missing_destination_contract',
        route: 'customer_discord',
        casePath: '/dashboard/dwm?alert=alert_missing_destination_contract',
        evidenceCount: 1,
        sourceFamily: 'telegram_public',
        alert: {
            id: 'alert_missing_destination_contract',
            title: 'Missing destination alert-created event',
            severity: 'medium',
            sourceFamily: 'telegram_public',
            evidence: [{ label: 'Capture', detail: 'Alert-created fixture proof.' }],
            provenance: { captureIds: ['capture_missing_destination'], sourceIds: ['source_missing_destination'] },
            watchlist: { id: 'watchlist_missing_destination_contract', terms: ['missing.example'] },
        },
    },
    destinations: [],
    deliveries: [],
    auditEvents: [],
    liveDeliveryEnabled: false,
})
expect(missingDestinationIntent?.reason === 'missing_destination' && missingDestinationIntent.error.includes('no enabled webhook destination'), 'Missing destination dispatch should create a durable skipped delivery intent.', missingDestinationIntent)
expect(requestedMissingDestinationIntent?.reason === 'requested_destination_not_found' && requestedMissingDestinationIntent.requestedDestinationId === 'destination_requested_missing', 'Requested missing destination should create a specific skipped delivery intent.', requestedMissingDestinationIntent)
expect(missingDestinationIntent?.idempotencyKey === 'dwm.alert.created:org_contract:missing_destination:dwm_dedupe_missing_destination_contract', 'Missing destination intent should use a stable org alert idempotency key.', missingDestinationIntent)
expect(missingDestinationIntent?.persistable === true && !JSON.stringify([missingDestinationIntent, requestedMissingDestinationIntent]).includes(secret), 'Missing destination intents should be persistable and secret-free.', { missingDestinationIntent, requestedMissingDestinationIntent })
expect(missingDestinationReadiness.alertEventConsumer.ready === false && missingDestinationReadiness.alertEventConsumer.state === 'missing_destination' && missingDestinationReadiness.alertEventConsumer.payloadPreview === null, 'Alert event consumer should expose missing-destination readiness without fabricating a send preview.', missingDestinationReadiness.alertEventConsumer)
expect(missingDestinationReadiness.alertEventConsumer.blockerCodes.includes('no_enabled_destination') && missingDestinationReadiness.alertEventConsumer.requiredFields.orgId === true, 'Alert event consumer should keep typed blockers and required fields for missing destinations.', missingDestinationReadiness.alertEventConsumer)
expect(missingDestinationReadiness.alertEventConsumer.payloadValidation.valid === false && missingDestinationReadiness.alertEventConsumer.payloadValidation.missingDiscordFields.length > 0, 'Alert event consumer should mark payload validation invalid when no destination preview exists.', missingDestinationReadiness.alertEventConsumer.payloadValidation)
expect(missingDestinationReadiness.alertEventConsumer.auditReadiness.auditMissing === true && missingDestinationReadiness.alertEventConsumer.auditReadiness.linkedAuditEventIds.length === 0, 'Alert event consumer should expose missing audit linkage when no destination attempt exists.', missingDestinationReadiness.alertEventConsumer.auditReadiness)

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
        { label: 'Public channel match', detail: 'Public channel message matched acme-security.com.', capturedAt: '2026-06-28T10:40:00.000Z' },
        { label: 'Credential paste', detail: 'Paste metadata included an Acme user identity.', capturedAt: '2026-06-28T10:42:00.000Z' },
        { label: 'Case enrichment', detail: 'Source capture linked the domain to the same campaign.', capturedAt: '2026-06-28T10:44:00.000Z' },
    ],
    dedupeKey: 'dwm_dedupe_replay_contract',
    route: 'identity_response',
    casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
    alertUrl: 'https://app.hanasand.local/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
    reviewState: 'needs_review',
    deliveryState: 'ready_to_send',
    replayCount: 2,
    replayedAt: '2026-06-28T10:45:00.000Z',
    confidenceScore: 87,
    confidenceReason: 'Replay confidence comes from matched public source and case enrichment.',
    caseActionId: 'case_action_replay_contract',
    caseActionPath: '/v1/cases/case_replay_contract/actions/case_action_replay_contract/replay',
    workflowContext: {
        caseIdCandidate: 'case_replay_contract',
        casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
        caseActionId: 'case_action_replay_contract',
        caseActionPath: '/v1/cases/case_replay_contract/actions/case_action_replay_contract/replay',
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
        caseActionId: 'case_action_replay_contract',
        caseActionPath: '/v1/cases/case_replay_contract/actions/case_action_replay_contract/replay',
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
const replayAttemptDelivery = {
    id: 'prior_attempt_contract',
    ownerId: 'owner_contract',
    orgId: 'org_contract',
    destinationId: 'destination_replay_contract',
    alertId: 'alert_replay_contract',
    eventType: 'dwm.alert.replayed' as const,
    status: 'dry_run' as const,
    dryRun: true,
    endpointHint: 'https://discord.com/api/webhooks/1234567890/...',
    endpointHash: 'endpoint_replay_contract',
    payloadHash: 'payload_replay_contract',
    payload: {
        content: 'DWM alert replay',
        embeds: [{
            title: 'Acme credential dump detected',
            fields: [
                { name: 'Watchlist', value: 'Replay contract watchlist', inline: true },
                { name: 'Alert URL', value: '/dashboard/dwm/alerts/alert_replay_contract', inline: false },
            ],
        }],
        _hanasand: {
            org: { id: 'org_contract', name: 'Acme Security' },
            destination: { id: 'destination_replay_contract' },
            alert: { id: 'alert_replay_contract', title: 'Acme credential dump detected' },
            watchlist: { id: 'watchlist_item_replay_contract', name: 'Replay contract watchlist' },
            delivery: { id: 'prior_attempt_contract', dedupeKey: 'dwm_dedupe_replay_contract', replay: true },
            source: { family: 'telegram_public' },
        },
    },
    responseStatus: null,
    responseBody: null,
    error: null,
    errorClass: null,
    attemptCount: 1,
    nextRetryAt: null,
    idempotencyKey: 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract',
    watchlistId: 'watchlist_item_replay_contract',
    watchlistName: 'Replay contract watchlist',
    route: 'review',
    casePath: '/dashboard/dwm/cases/case_replay_contract',
    attemptedAt: '2026-06-28T12:00:00.000Z',
    createdAt: '2026-06-28T12:00:00.000Z',
}
const deliveryAttemptContract = buildDwmWebhookDeliveryAttemptContract({
    ownerId: 'owner_contract',
    input: apiDeliveryRequestInput,
    destinations: [{
        id: 'destination_replay_contract',
        orgId: 'org_contract',
        ownerId: 'owner_contract',
        name: 'Replay Discord',
        kind: 'discord',
        endpointHint: 'https://discord.com/api/webhooks/1234567890/...',
        endpointHash: 'endpoint_replay_contract',
        status: 'active',
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T12:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
    }],
    deliveries: [replayAttemptDelivery],
})
const deliveryAttemptPersistence = buildDwmWebhookDeliveryAttemptPersistenceProof({
    ownerId: 'owner_contract',
    input: apiDeliveryRequestInput,
    destinations: [{
        id: 'destination_replay_contract',
        orgId: 'org_contract',
        ownerId: 'owner_contract',
        name: 'Replay Discord',
        kind: 'discord',
        endpointHint: 'https://discord.com/api/webhooks/1234567890/...',
        endpointHash: 'endpoint_replay_contract',
        status: 'active',
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T12:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
    }],
    deliveries: [replayAttemptDelivery],
    auditEvents: [{
        id: 'audit_attempt_contract',
        ownerId: 'owner_contract',
        actorId: 'owner_contract',
        orgId: 'org_contract',
        destinationId: 'destination_replay_contract',
        deliveryId: 'prior_attempt_contract',
        action: 'delivery.replayed',
        metadata: { status: 'dry_run' },
        createdAt: '2026-06-28T12:00:01.000Z',
    }],
})
const missingFieldAttemptContract = buildDwmWebhookDeliveryAttemptContract({
    ownerId: 'owner_contract',
    input: {
        orgId: '',
        eventType: 'dwm.alert.created',
        alert: {
            id: '',
            title: '',
            severity: '',
            sourceFamily: '',
            evidence: [],
            provenance: {},
            watchlist: {},
            dedupeKey: '',
            casePath: '',
        },
        dryRun: true,
    },
    destinations: [],
})
const wrongOrgAttemptContract = buildDwmWebhookDeliveryAttemptContract({
    ownerId: 'owner_contract',
    input: apiDeliveryRequestInput,
    destinations: [{
        id: 'destination_wrong_org_contract',
        org_id: 'org_wrong',
        name: 'Wrong org Discord',
        kind: 'discord',
        status: 'active',
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
    }],
})
const unsupportedDestinationAttemptContract = buildDwmWebhookDeliveryAttemptContract({
    ownerId: 'owner_contract',
    input: apiDeliveryRequestInput,
    destinations: [{
        id: 'destination_unsupported_contract',
        org_id: 'org_contract',
        name: 'Email destination',
        kind: 'email',
        status: 'active',
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
    } as never],
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
expect(deliveryAttemptContract.schemaVersion === 'dwm.webhook.delivery_attempt_contract.v1' && deliveryAttemptContract.ok === true && deliveryAttemptContract.noNetwork === true, 'Delivery attempt contract should accept typed alert payloads without network.', deliveryAttemptContract)
expect(deliveryAttemptContract.requiredFields.orgId === true && deliveryAttemptContract.requiredFields.watchlistId === true && deliveryAttemptContract.requiredFields.provenance === true, 'Delivery attempt contract should prove required org/watchlist/provenance fields.', deliveryAttemptContract.requiredFields)
expect(deliveryAttemptContract.payloadContract.schemaVersion === 'dwm.webhook.delivery_payload_contract.v1' && deliveryAttemptContract.payloadContract.required.every(item => item.present), 'Delivery attempt contract should expose a typed payload field contract.', deliveryAttemptContract.payloadContract)
expect(deliveryAttemptContract.payloadContract.required.some(item => item.key === 'dedupeKey' && item.paths.includes('alert.dedupeKey')) && deliveryAttemptContract.payloadContract.optional.some(item => item.key === 'replayState' && item.present) && deliveryAttemptContract.payloadContract.optional.some(item => item.key === 'caseAction' && item.present), 'Delivery attempt payload contract should document dedupe, replay, and case action fields.', deliveryAttemptContract.payloadContract)
expect(deliveryAttemptContract.destinationSelection.selectedDestinationIds.join(',') === 'destination_replay_contract' && deliveryAttemptContract.attempts.length === 1, 'Delivery attempt contract should resolve the org-scoped destination.', deliveryAttemptContract)
expect(deliveryAttemptContract.attempts[0]?.status === 'dry_run' && deliveryAttemptContract.attempts[0]?.replay === true && deliveryAttemptContract.attempts[0]?.retry.attemptCount === 2, 'Delivery attempt contract should produce a persisted dry-run replay attempt with retry count.', deliveryAttemptContract.attempts[0])
expect(deliveryAttemptContract.attempts[0]?.sanitizedPayloadPreview?.discord.fieldNames.includes('Delivery state') && deliveryAttemptContract.attempts[0]?.sanitizedPayloadPreview?.discord.fieldNames.includes('Match reason') && deliveryAttemptContract.attempts[0]?.sanitizedPayloadPreview?.discord.fieldNames.includes('Evidence timestamp') && deliveryAttemptContract.attempts[0]?.sanitizedPayloadPreview?.discord.fieldNames.includes('Case action') && deliveryAttemptContract.attempts[0]?.sanitizedPayloadPreview?.context.watchlistId === 'watchlist_item_replay_contract' && deliveryAttemptContract.attempts[0]?.sanitizedPayloadPreview?.context.deliveryState === 'ready_to_send' && deliveryAttemptContract.attempts[0]?.sanitizedPayloadPreview?.context.evidenceTimestamp === '2026-06-28T10:40:00.000Z' && deliveryAttemptContract.attempts[0]?.sanitizedPayloadPreview?.context.caseActionId === 'case_action_replay_contract' && Boolean(deliveryAttemptContract.attempts[0]?.sanitizedPayloadPreview?.context.matchReason), 'Delivery attempt contract should include Discord-ready payload preview context, match reason, case action, evidence timestamp, and delivery state.', deliveryAttemptContract.attempts[0]?.sanitizedPayloadPreview)
expect(deliveryAttemptContract.attempts[0]?.audit.expectedAction === 'delivery.tested' && deliveryAttemptContract.attempts[0]?.redactedDestination.endpointExposed === false, 'Delivery attempt contract should expose audit proof and redacted destination metadata.', deliveryAttemptContract.attempts[0])
expect(deliveryAttemptContract.attempts[0]?.redactedDestination.endpointHash === 'endpoint_replay_contract' && deliveryAttemptContract.attempts[0]?.redactedDestination.endpointHint === 'https://discord.com/api/webhooks/1234567890/...', 'Delivery attempt contract should expose safe endpoint refs before persistence.', deliveryAttemptContract.attempts[0]?.redactedDestination)
expect(deliveryAttemptPersistence.schemaVersion === 'dwm.webhook.delivery_attempt_persistence.v1' && deliveryAttemptPersistence.ok === true && deliveryAttemptPersistence.totals.persistedAttempts === 1, 'Delivery attempt persistence should match typed contract attempts to persisted rows.', deliveryAttemptPersistence)
expect(deliveryAttemptPersistence.rows[0]?.persistedDeliveryId === 'prior_attempt_contract' && deliveryAttemptPersistence.rows[0]?.audit.auditEventId === 'audit_attempt_contract', 'Delivery attempt persistence should expose delivery and audit ids.', deliveryAttemptPersistence.rows[0])
expect(deliveryAttemptPersistence.rows[0]?.sanitizedPayloadPreview?.discord.fieldNames.includes('Alert URL') && deliveryAttemptPersistence.rows[0]?.replay === true, 'Delivery attempt persistence should preserve Discord preview and replay context.', deliveryAttemptPersistence.rows[0])
expect(deliveryAttemptPersistence.rows[0]?.redactedDestination.endpointExposed === false && deliveryAttemptPersistence.rows[0]?.redactedDestination.endpointHash === 'endpoint_replay_contract', 'Delivery attempt persistence should expose only redacted destination metadata.', deliveryAttemptPersistence.rows[0]?.redactedDestination)
expect(missingFieldAttemptContract.ok === false && missingFieldAttemptContract.blockers.some(item => item.code === 'missing_alert_title') && missingFieldAttemptContract.blockers.some(item => item.code === 'missing_destination'), 'Delivery attempt contract should block missing required payload fields.', missingFieldAttemptContract)
expect(missingFieldAttemptContract.payloadContract.missingRequired.includes('orgId') && missingFieldAttemptContract.payloadContract.missingRequired.includes('title') && missingFieldAttemptContract.payloadContract.missingRequired.includes('dedupeKey'), 'Delivery attempt payload contract should list missing required typed fields.', missingFieldAttemptContract.payloadContract)
expect(wrongOrgAttemptContract.ok === false && wrongOrgAttemptContract.destinationSelection.skippedDestinations.some(item => item.reason === 'org_mismatch') && wrongOrgAttemptContract.attempts.every(item => item.orgId === 'org_contract' && item.destinationId !== 'destination_wrong_org_contract'), 'Delivery attempt contract should not persist wrong-org destination attempts.', wrongOrgAttemptContract)
expect(unsupportedDestinationAttemptContract.ok === false && unsupportedDestinationAttemptContract.blockers.some(item => item.code === 'unsupported_destination_type') && unsupportedDestinationAttemptContract.attempts[0]?.redactedDestination.endpointExposed === false, 'Delivery attempt contract should block unsupported destination types with redacted metadata.', unsupportedDestinationAttemptContract)
expect(!JSON.stringify([deliveryAttemptContract, deliveryAttemptPersistence, missingFieldAttemptContract, wrongOrgAttemptContract, unsupportedDestinationAttemptContract]).includes(secret), 'Delivery attempt contract should not leak endpoint secrets.', { deliveryAttemptContract, deliveryAttemptPersistence, missingFieldAttemptContract, wrongOrgAttemptContract, unsupportedDestinationAttemptContract })
expect(replayPlan.selectedDestinations.length === 1, 'Replay dispatch should select the active org destination.', replayPlan)
expect(replayPlan.eventType === 'dwm.alert.replayed', 'Replay dispatch should preserve replay event type.', replayPlan)
expect(replayAlertContext.id === 'alert_replay_contract', 'Replay payload should link to the same alert id.', replayPayload)
expect(replayDeliveryContext.replay === true, 'Replay payload should mark delivery as replay.', replayPayload)
expect(replayDeliveryContext.dedupeKey === 'dwm_dedupe_replay_contract', 'Replay payload should link to the same alert dedupe key.', replayPayload)
expect(replayDeliveryContext.casePath === replayWorkflowAlert.casePath, 'Replay payload should link to the same case path.', replayPayload)
expect(replayDeliveryContext.alertUrl === replayWorkflowAlert.alertUrl, 'Replay payload should link to the alert URL/deep link.', replayPayload)
expect(replayContext.occurredAt === '2026-06-28T10:45:00.000Z' && replaySerialized.includes('Observed at'), 'Replay payload should preserve replay event timestamp.', replayPayload)
expect(replayAlertContext.deliveryState === 'ready_to_send', 'Replay payload should preserve alert delivery state.', replayPayload)
expect((replayAlertContext.confidence as Record<string, unknown>).label === '87%' && replaySerialized.includes('Replay confidence comes from matched public source'), 'Replay payload should preserve confidence context.', replayPayload)
expect((replayDeliveryContext.workflowState as Record<string, unknown>).delivery === 'ready_to_send' && replayDeliveryContext.replayCount === 2 && replaySerialized.includes('Workflow'), 'Replay payload should expose workflow and replay markers.', replayPayload)
expect(replayWatchlistContext.id === 'watchlist_item_replay_contract', 'Replay payload should preserve watchlist context.', replayPayload)
expect(replaySerialized.includes('dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract'), 'Replay payload should use event-scoped idempotency for the same dedupe key.', replayPayload)
expect(replaySerialized.includes('Evidence summary') && replaySerialized.includes('Credential paste'), 'Replay payload should include multi-evidence summary fields.', replayPayload)

const updatedTriggerInput = buildDwmAlertWebhookNotificationInput(replayWorkflowAlert, {
    eventType: 'dwm.alert.updated',
    dryRun: true,
    live: false,
})
const updatedPlan = buildDwmAlertWebhookDispatchPlan({
    ownerId: workflowReplayHandoff.ownerId,
    input: updatedTriggerInput,
    destinations: [
        {
            id: 'destination_update_contract',
            org_id: 'org_contract',
            name: 'Alert update Discord',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.updated'],
        },
        {
            id: 'destination_created_contract',
            org_id: 'org_contract',
            name: 'Created only Discord',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.created'],
        },
    ],
})
const updatedPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: updatedPlan.selectedDestinations[0].id,
        kind: 'discord',
        name: updatedPlan.selectedDestinations[0].name,
        org_id: updatedPlan.orgId,
    },
    eventType: updatedPlan.eventType,
    deliveryId: 'delivery_update_contract',
    alert: updatedPlan.alert,
}) as Record<string, unknown>
const updatedSerialized = JSON.stringify(updatedPayload)
const updatedContext = updatedPayload._hanasand as Record<string, unknown>
const updatedDeliveryContext = updatedContext.delivery as Record<string, unknown>
const updatedTemplate = updatedContext.discordTemplate as Record<string, unknown>
expect(updatedTriggerInput.eventType === 'dwm.alert.updated' && updatedTriggerInput.dryRun === true && updatedTriggerInput.live === false, 'Alert-updated trigger input should preserve dry-run/no-network delivery mode.', updatedTriggerInput)
expect(updatedPlan.eventType === 'dwm.alert.updated' && updatedPlan.selectedDestinations.map(item => item.id).join(',') === 'destination_update_contract', 'Alert-updated dispatch should select only destinations subscribed to update events.', updatedPlan)
expect(updatedPlan.skippedDestinations.some(item => item.id === 'destination_created_contract' && item.reason === 'event_not_subscribed'), 'Alert-updated dispatch should skip destinations that only subscribe to created alerts.', updatedPlan)
expect(updatedDeliveryContext.replay === false && updatedSerialized.includes('dwm.alert.updated:org_contract:destination_update_contract:dwm_dedupe_replay_contract'), 'Alert-updated Discord payload should use update-scoped idempotency without marking replay.', updatedPayload)
expect(updatedSerialized.includes('Workflow') && updatedSerialized.includes('updated') && !updatedSerialized.includes(secret), 'Alert-updated Discord payload should expose workflow context without leaking secrets.', updatedPayload)
expect(updatedTemplate.templateId === 'dwm.discord.alert_update.v1' && updatedTemplate.ready === true && (updatedTemplate.workflow as Record<string, unknown>).update === true, 'Alert-updated Discord payload should expose an update template contract.', updatedTemplate)
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
const overlappingOrgAAlertEventConsumer = overlappingOrgAReadiness.alertEventConsumer
const overlappingOrgBAlertEventConsumer = overlappingOrgBReadiness.alertEventConsumer
expect(overlappingOrgAReadiness.schemaVersion === 'dwm.webhook.alert_readiness_handoff.v1' && overlappingOrgAReadiness.orgId === 'org_overlap_a', 'Alert readiness handoff should expose org A readiness.', overlappingOrgAReadiness)
expect(overlappingOrgAReadiness.destinationSelection.selectedDestinationIds.join(',') === 'destination_overlap_org_a', 'Alert readiness handoff should select only org A destination for overlapping term.', overlappingOrgAReadiness)
expect(overlappingOrgBReadiness.destinationSelection.selectedDestinationIds.join(',') === 'destination_overlap_org_b', 'Alert readiness handoff should select only org B destination for overlapping term.', overlappingOrgBReadiness)
expect(overlappingOrgAReadiness.deliveryRetryPersistence.deliveryKeys.every(item => item.orgId === 'org_overlap_a' && item.destinationId !== 'destination_overlap_org_b'), 'Alert readiness retry proof should not leak org B deliveries into org A.', overlappingOrgAReadiness.deliveryRetryPersistence)
expect(overlappingOrgBReadiness.deliveryRetryPersistence.deliveryKeys.every(item => item.orgId === 'org_overlap_b' && item.destinationId !== 'destination_overlap_org_a'), 'Alert readiness retry proof should not leak org A deliveries into org B.', overlappingOrgBReadiness.deliveryRetryPersistence)
expect(overlappingOrgAReadiness.deliveryRetryPersistence.counts.retryable === 1 && overlappingOrgAReadiness.blockers.some(item => item.code === 'retry_scheduled' && item.blocking === false), 'Alert readiness should expose retry/backoff without blocking dry-run customer proof.', overlappingOrgAReadiness)
expect(overlappingOrgBReadiness.deliveryRetryPersistence.counts.replay === 1 && overlappingOrgBReadiness.deliveryRetryPersistence.counts.duplicateDedupe === 0, 'Alert readiness should expose replay attempts without inventing duplicate replay state.', overlappingOrgBReadiness)
expect(overlappingOrgAAlertEventConsumer.schemaVersion === 'dwm.webhook.alert_event_consumer.v1' && overlappingOrgAAlertEventConsumer.ready === true && overlappingOrgAAlertEventConsumer.noNetwork === true, 'Alert event consumer should prove alert-created webhook readiness without network delivery.', overlappingOrgAAlertEventConsumer)
expect(overlappingOrgAAlertEventConsumer.requiredFields.orgId === true && overlappingOrgAAlertEventConsumer.requiredFields.destinationId === true && overlappingOrgAAlertEventConsumer.requiredFields.provenance === true, 'Alert event consumer should expose required alert/org/watchlist/provenance fields.', overlappingOrgAAlertEventConsumer.requiredFields)
expect(overlappingOrgAAlertEventConsumer.persistenceTargets.deliveryAttempt === true && overlappingOrgAAlertEventConsumer.persistenceTargets.retryPersistence === true && overlappingOrgAAlertEventConsumer.persistenceTargets.idempotencyKey === 'dwm.alert.created:org_overlap_a:destination_overlap_org_a:dwm_overlap_org_a', 'Alert event consumer should expose delivery persistence and idempotency targets.', overlappingOrgAAlertEventConsumer.persistenceTargets)
expect(overlappingOrgAAlertEventConsumer.auditReadiness.expectedNextAction === 'delivery.created' && overlappingOrgAAlertEventConsumer.auditReadiness.failureAuditLinked === true && overlappingOrgAAlertEventConsumer.auditReadiness.linkedAuditEventIds.includes('audit_overlap_a_retry'), 'Alert event consumer should expose linked delivery audit readiness for failed created events.', overlappingOrgAAlertEventConsumer.auditReadiness)
expect(overlappingOrgAAlertEventConsumer.auditReadiness.redaction.webhookSecretExposed === false && !JSON.stringify(overlappingOrgAAlertEventConsumer.auditReadiness).includes(secret), 'Alert event consumer audit readiness should redact webhook secrets.', overlappingOrgAAlertEventConsumer.auditReadiness)
expect(overlappingOrgAAlertEventConsumer.payloadPreview?.discord.fieldNames.some(name => name.toLowerCase() === 'source family') && overlappingOrgAAlertEventConsumer.payloadPreview.context.watchlistId === 'watchlist_overlap_a', 'Alert event consumer should expose Discord-ready payload preview context.', overlappingOrgAAlertEventConsumer.payloadPreview)
expect(overlappingOrgAAlertEventConsumer.payloadPreview?.context.discordTemplate?.templateId === 'dwm.discord.alert_created.v1' && overlappingOrgAAlertEventConsumer.payloadPreview.context.discordTemplate.ready === true && overlappingOrgAAlertEventConsumer.payloadPreview.context.discordTemplate.noNetworkDefault === true, 'Alert event consumer should pass through the Discord payload template contract.', overlappingOrgAAlertEventConsumer.payloadPreview?.context.discordTemplate)
expect(overlappingOrgAAlertEventConsumer.payloadPreview?.redaction.webhookSecretExposed === false && overlappingOrgAAlertEventConsumer.payloadPreview.redaction.endpointExposed === false, 'Alert event consumer payload preview should redact destination secrets.', overlappingOrgAAlertEventConsumer.payloadPreview)
expect(overlappingOrgAAlertEventConsumer.payloadValidation.valid === true && overlappingOrgAAlertEventConsumer.payloadValidation.requiredDiscordFields.includes('Dedupe key') && overlappingOrgAAlertEventConsumer.payloadValidation.missingDiscordFields.length === 0, 'Alert event consumer should validate required Discord payload fields.', overlappingOrgAAlertEventConsumer.payloadValidation)
expect(Object.values(overlappingOrgAAlertEventConsumer.payloadValidation.limits).every(Boolean) && overlappingOrgAAlertEventConsumer.payloadValidation.redaction.mentionsDisabled === true && overlappingOrgAAlertEventConsumer.payloadValidation.redaction.noWebhookUrl === true, 'Alert event consumer payload validation should enforce Discord limits and redaction.', overlappingOrgAAlertEventConsumer.payloadValidation)
expect(overlappingOrgBAlertEventConsumer.payloadPreview?.context.replay === true && overlappingOrgBAlertEventConsumer.persistenceTargets.idempotencyKey === 'dwm.alert.replayed:org_overlap_b:destination_overlap_org_b:dwm_overlap_org_b', 'Alert event consumer should preserve replay event idempotency.', overlappingOrgBAlertEventConsumer)
expect(overlappingOrgBAlertEventConsumer.payloadValidation.valid === true && overlappingOrgBAlertEventConsumer.payloadValidation.context.provenance === true, 'Alert event consumer replay payload should keep validation and provenance proof.', overlappingOrgBAlertEventConsumer.payloadValidation)
expect(overlappingOrgBAlertEventConsumer.auditReadiness.expectedNextAction === 'delivery.replayed' && overlappingOrgBAlertEventConsumer.auditReadiness.linkedActions.includes('delivery.replayed'), 'Alert event consumer should expose replay audit linkage.', overlappingOrgBAlertEventConsumer.auditReadiness)
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
    payload: item.deliveryId === 'delivery_replay_contract' ? replayPayload : {},
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
const caseActionEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { caseActionId: replayWorkflowAlert.caseActionId } })
const caseActionPathEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { caseActionPath: replayWorkflowAlert.caseActionPath } })
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
        errorClass: 'upstream_5xx',
        attemptCount: 2,
        nextRetryAt: '2026-06-28T12:11:00.000Z',
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
const advancedDeliveryFilterAuditEvents = [
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
    {
        id: 'audit_live_sent_contract',
        ownerId: 'owner_contract',
        actorId: 'support_contract',
        orgId: 'org_contract',
        destinationId: 'destination_sent_contract',
        deliveryId: 'delivery_live_sent_contract',
        action: 'delivery.delivered',
        metadata: { status: 'delivered' },
        createdAt: '2026-06-28T12:07:01.000Z',
    },
]
const actionFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', action: 'delivery.failed' } })
const statusFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', status: 'sent' } })
const retryStateFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', retryState: 'retry_scheduled' } })
const actorFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', actorId: 'support_contract' } })
const timeFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', timeFrom: '2026-06-28T12:06:30.000Z', timeTo: '2026-06-28T12:07:30.000Z' } })
const idempotencyKeyFilteredEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: retryLedgerRows, auditEvents: advancedDeliveryFilterAuditEvents, filters: { orgId: 'org_contract', idempotencyKey: 'dwm.alert.created:org_contract:destination_sent_contract:dwm_dedupe_sent_contract' } })
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
expect(caseActionEvidence.length === 1 && caseActionEvidence[0].caseActionId === 'case_action_replay_contract', 'Delivery evidence should filter by case action id.', caseActionEvidence)
expect(caseActionPathEvidence.length === 1 && caseActionPathEvidence[0].caseActionPath === replayWorkflowAlert.caseActionPath, 'Delivery evidence should filter by case action path.', caseActionPathEvidence)
expect(dedupeEvidence.length === 1 && dedupeEvidence[0].requestId === 'delivery_replay_contract', 'Delivery evidence should filter by dedupe key.', dedupeEvidence)
expect(idempotencyEvidence.length === 1 && idempotencyEvidence[0].requestId === 'delivery_replay_contract', 'Delivery evidence should filter by idempotency key.', idempotencyEvidence)
expect(buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { alertId: 'alert_replay_contract', casePath: replayWorkflowAlert.casePath, dedupeKey: 'dwm_dedupe_replay_contract' } }).length === 1, 'Delivery evidence should combine alert, case path, and dedupe filters.')
expect(actionFilteredEvidence.length === 1 && actionFilteredEvidence[0].requestId === 'delivery_live_failed_retry_contract' && actionFilteredEvidence[0].auditAction === 'delivery.failed', 'Delivery evidence should filter by audit action.', actionFilteredEvidence)
expect(statusFilteredEvidence.length === 1 && statusFilteredEvidence[0].requestId === 'delivery_live_sent_contract', 'Delivery evidence should filter by raw or derived delivery status.', statusFilteredEvidence)
expect(retryStateFilteredEvidence.length === 1 && retryStateFilteredEvidence[0].retryState === 'retry_scheduled', 'Delivery evidence should filter by retry/backoff state.', retryStateFilteredEvidence)
expect(actorFilteredEvidence.length === 1 && actorFilteredEvidence[0].actorId === 'support_contract', 'Delivery evidence should filter by audit actor without exposing secrets.', actorFilteredEvidence)
expect(timeFilteredEvidence.length === 1 && timeFilteredEvidence[0].requestId === 'delivery_live_sent_contract', 'Delivery evidence should filter by attempted time window.', timeFilteredEvidence)
expect(idempotencyKeyFilteredEvidence.length === 1 && idempotencyKeyFilteredEvidence[0].idempotencyKey.endsWith(':dwm_dedupe_sent_contract'), 'Delivery evidence should filter by explicit idempotency key.', idempotencyKeyFilteredEvidence)
expect(queuedLedger?.status === 'queued' && queuedLedger.rawStatus === 'dry_run' && queuedLedger.retryable === false, 'Delivery ledger should map dry-run attempts to queued/no-retry state.', queuedLedger)
expect(sentLedger?.status === 'sent' && sentLedger.retryable === false && sentLedger.responseStatus === 204, 'Delivery ledger should map delivered attempts to sent state.', sentLedger)
expect(retryLedger?.status === 'failed' && retryLedger.retryable === true && retryLedger.attemptCount === 2, 'Delivery ledger should expose retryable failed attempts and attempt count.', retryLedger)
expect(retryLedger?.nextRetryAt === '2026-06-28T12:11:00.000Z' && retryLedger.errorClass === 'upstream_5xx', 'Retry planner should use backoff from the latest failed attempt.', retryLedger)
expect(retryLedger?.retryState === 'retry_scheduled' && retryLedger.actorId === 'owner_contract', 'Delivery ledger should carry retry-state and audit actor filters.', retryLedger)
expect(retryLedger?.attemptCount === 2 && retryLedger.retryReason === 'upstream_retryable', 'Delivery ledger should preserve persisted retry metadata while keeping retry reason derivable.', retryLedger)
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
    updatedAt: '2026-06-28T12:00:05.000Z',
})
const retryDeliveryPreview = buildDwmWebhookDeliveryPreview({
    id: 'delivery_retry_preview_contract',
    destinationId: 'destination_live_contract',
    ownerId: 'owner_contract',
    orgId: 'org_contract',
    alertId: 'alert_retry_preview_contract',
    eventType: 'dwm.alert.created',
    status: 'failed',
    dryRun: false,
    endpointHint: `https://discord.com/api/webhooks/222222222/${secret}`,
    endpointHash: 'endpoint_live_hash',
    payloadHash: 'payload_retry_preview_hash',
    payload: replayPayload,
    responseStatus: 503,
    responseBody: `retry failed with token=${secret}`,
    error: `upstream unavailable token=${secret}`,
    errorClass: 'upstream_5xx',
    attemptCount: 2,
    nextRetryAt: '2026-06-28T12:11:00.000Z',
    idempotencyKey: 'dwm.alert.created:org_contract:destination_live_contract:dwm_dedupe_retry_preview_contract',
    watchlistId: 'watchlist_item_replay_contract',
    watchlistName: 'Replay contract watchlist',
    route: 'identity_response',
    casePath: replayWorkflowAlert.casePath,
    attemptedAt: '2026-06-28T12:06:00.000Z',
    createdAt: '2026-06-28T12:06:00.000Z',
    updatedAt: '2026-06-28T12:06:05.000Z',
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
        updatedAt: '2026-06-28T12:08:05.000Z',
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
        id: 'delivery_missing_destination_contract',
        destinationId: null,
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        alertId: 'alert_missing_destination_contract',
        eventType: 'dwm.alert.created' as const,
        status: 'skipped' as const,
        dryRun: true,
        endpointHint: 'no_webhook_destination',
        endpointHash: 'no_webhook_destination',
        payloadHash: 'payload_missing_destination_hash',
        payload: replayPayload,
        responseStatus: null,
        responseBody: null,
        error: 'Delivery selection skipped because no enabled webhook destination is configured for this organization.',
        errorClass: 'skipped',
        attemptCount: 1,
        nextRetryAt: null,
        idempotencyKey: 'dwm.alert.created:org_contract:missing_destination:dwm_dedupe_missing_destination_contract',
        watchlistId: 'watchlist_missing_destination_contract',
        watchlistName: 'Missing destination watchlist',
        route: 'customer_discord',
        casePath: '/dashboard/dwm?alert=alert_missing_destination_contract',
        attemptedAt: '2026-06-28T12:13:00.000Z',
        createdAt: '2026-06-28T12:13:00.000Z',
        updatedAt: '2026-06-28T12:13:00.000Z',
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
            action: 'delivery.retry_scheduled',
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
        {
            id: 'audit_missing_destination_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: null,
            deliveryId: 'delivery_missing_destination_contract',
            action: 'delivery.skipped',
            metadata: {
                status: 'skipped',
                reason: 'missing_destination',
                endpointHint: 'no_webhook_destination',
                payloadHash: 'payload_missing_destination_hash',
            },
            createdAt: '2026-06-28T12:13:01.000Z',
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
            action: 'delivery.retry_scheduled',
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
const lifecycleStateDestinations = [
    ...auditDestinationRows,
    {
        id: 'destination_secret_rotated_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Rotated Secret Discord',
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/888888888/${secret}`,
        endpointHash: 'endpoint_secret_rotated_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:04:00.000Z',
        lastTestStatus: 'dry_run' as const,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T12:15:00.000Z',
    },
    {
        id: 'destination_test_required_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Needs Test Discord',
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/999999999/${secret}`,
        endpointHash: 'endpoint_test_required_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T11:00:00.000Z',
    },
    {
        id: 'destination_revoked_owner_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Revoked Owner Discord',
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/101010101/${secret}`,
        endpointHash: 'endpoint_revoked_owner_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'removed_member_contract',
        lastTestedAt: '2026-06-28T12:04:00.000Z',
        lastTestStatus: 'dry_run' as const,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T11:00:00.000Z',
    },
    {
        id: 'destination_failed_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Failed Lifecycle Discord',
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/121212121/${secret}`,
        endpointHash: 'endpoint_failed_lifecycle_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:14:00.000Z',
        lastTestStatus: 'failed' as const,
        lastTestError: `test failed token=${secret}`,
        lastTestHttpStatus: 400,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T12:14:00.000Z',
    },
]
const lifecycleStateAuditEvents = [
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
        id: 'audit_secret_rotated_contract',
        ownerId: 'owner_contract',
        actorId: 'owner_contract',
        orgId: 'org_contract',
        destinationId: 'destination_secret_rotated_contract',
        deliveryId: null,
        action: 'destination.updated',
        metadata: { endpointHash: 'endpoint_secret_rotated_hash', endpointHint: `https://discord.com/api/webhooks/888888888/${secret}` },
        createdAt: '2026-06-28T12:15:00.000Z',
    },
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
const adminLifecycle = buildDwmWebhookDestinationLifecycle({
    liveDeliveryEnabled: false,
    destinations: lifecycleStateDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: lifecycleStateAuditEvents,
    viewerRole: 'admin',
    canManage: true,
})
const memberLifecycle = buildDwmWebhookDestinationLifecycle({
    liveDeliveryEnabled: false,
    destinations: lifecycleStateDestinations,
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
    {
        id: 'destination_test_failed_contract',
        ownerId: 'owner_contract',
        orgId: 'org_contract',
        name: 'Failed Test Discord',
        kind: 'discord' as const,
        endpointHint: `https://discord.com/api/webhooks/666666666/${secret}`,
        endpointHash: 'endpoint_test_failed_hash',
        status: 'active' as const,
        events: ['dwm.alert.created', 'dwm.alert.replayed'],
        createdBy: 'owner_contract',
        lastTestedAt: '2026-06-28T12:14:00.000Z',
        lastTestStatus: 'failed' as const,
        lastTestError: `test failed token=${secret}`,
        lastTestHttpStatus: 400,
        lastDeliveryAt: null,
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T12:14:00.000Z',
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
const deliveryHistory = buildDwmWebhookDeliveryHistory({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
})
const deliveryHistoryConsumer = buildDwmWebhookDeliveryHistoryConsumerProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract', destinationId: 'destination_replay_contract' },
})
const deliveryPersistenceProof = buildDwmWebhookDeliveryPersistenceProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
})
const deliveryAttemptPersistenceRead = buildDwmWebhookDeliveryAttemptPersistenceReadModel({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract', destinationId: 'destination_replay_contract' },
})
const emptyDeliveryPersistenceProof = buildDwmWebhookDeliveryPersistenceProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract', alertId: 'alert_no_delivery_contract' },
})
const deliveryReceipts = buildDwmWebhookDeliveryReceipts({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryReceipts = buildDwmWebhookDeliveryReceipts({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryTimeline = buildDwmWebhookDeliveryTimeline({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const foreignDeliveryTimeline = buildDwmWebhookDeliveryTimeline({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_foreign' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryTimeline = buildDwmWebhookDeliveryTimeline({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryActionPlan = buildDwmWebhookDeliveryActionPlan({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryActionPlan = buildDwmWebhookDeliveryActionPlan({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryReplayGuard = buildDwmWebhookDeliveryReplayGuard({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryReplayApi = buildDwmWebhookDeliveryReplayApiContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract', destinationId: 'destination_replay_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryReplayGuard = buildDwmWebhookDeliveryReplayGuard({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryReplayApi = buildDwmWebhookDeliveryReplayApiContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract', destinationId: 'destination_replay_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const duplicateReplayGuardHistory = buildDwmWebhookDeliveryHistory({
    liveDeliveryEnabled: true,
    destinations: [
        {
            id: 'destination_duplicate_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            name: 'Duplicate Guard Discord',
            kind: 'discord' as const,
            endpointHint: `https://discord.com/api/webhooks/777777777/${secret}`,
            endpointHash: 'endpoint_duplicate_replay_hash',
            status: 'active' as const,
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
            createdBy: 'owner_contract',
            lastTestedAt: '2026-06-28T12:04:00.000Z',
            lastTestStatus: 'dry_run' as const,
            lastTestError: null,
            lastTestHttpStatus: null,
            lastDeliveryAt: '2026-06-28T12:20:00.000Z',
            createdAt: '2026-06-28T11:00:00.000Z',
            updatedAt: '2026-06-28T12:21:00.000Z',
        },
    ],
    deliveries: [
        {
            id: 'delivery_duplicate_replay_delivered_contract',
            destinationId: 'destination_duplicate_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            alertId: 'alert_duplicate_replay_contract',
            eventType: 'dwm.alert.replayed' as const,
            status: 'delivered' as const,
            dryRun: false,
            endpointHint: `https://discord.com/api/webhooks/777777777/${secret}`,
            endpointHash: 'endpoint_duplicate_replay_hash',
            payloadHash: 'payload_duplicate_replay_delivered_hash',
            payload: replayPayload,
            responseStatus: 204,
            responseBody: '',
            error: null,
            idempotencyKey: 'dwm.alert.replayed:org_contract:destination_duplicate_replay_contract:dwm_dedupe_duplicate_replay_contract',
            watchlistId: 'watchlist_item_replay_contract',
            watchlistName: 'Replay contract watchlist',
            route: 'identity_response',
            casePath: replayWorkflowAlert.casePath,
            attemptedAt: '2026-06-28T12:20:00.000Z',
            createdAt: '2026-06-28T12:20:00.000Z',
        },
        {
            id: 'delivery_duplicate_replay_skipped_contract',
            destinationId: 'destination_duplicate_replay_contract',
            ownerId: 'owner_contract',
            orgId: 'org_contract',
            alertId: 'alert_duplicate_replay_contract',
            eventType: 'dwm.alert.replayed' as const,
            status: 'skipped' as const,
            dryRun: false,
            endpointHint: `https://discord.com/api/webhooks/777777777/${secret}`,
            endpointHash: 'endpoint_duplicate_replay_hash',
            payloadHash: 'payload_duplicate_replay_skipped_hash',
            payload: replayPayload,
            responseStatus: null,
            responseBody: null,
            error: 'Delivery skipped because this destination already has a delivered attempt for the same idempotency key.',
            idempotencyKey: 'dwm.alert.replayed:org_contract:destination_duplicate_replay_contract:dwm_dedupe_duplicate_replay_contract',
            watchlistId: 'watchlist_item_replay_contract',
            watchlistName: 'Replay contract watchlist',
            route: 'identity_response',
            casePath: replayWorkflowAlert.casePath,
            attemptedAt: '2026-06-28T12:21:00.000Z',
            createdAt: '2026-06-28T12:21:00.000Z',
        },
    ],
    auditEvents: [
        {
            id: 'audit_duplicate_replay_delivered_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_duplicate_replay_contract',
            deliveryId: 'delivery_duplicate_replay_delivered_contract',
            action: 'delivery.replayed',
            metadata: { status: 'delivered', endpointHint: `https://discord.com/api/webhooks/777777777/${secret}` },
            createdAt: '2026-06-28T12:20:01.000Z',
        },
        {
            id: 'audit_duplicate_replay_skipped_contract',
            ownerId: 'owner_contract',
            actorId: 'owner_contract',
            orgId: 'org_contract',
            destinationId: 'destination_duplicate_replay_contract',
            deliveryId: 'delivery_duplicate_replay_skipped_contract',
            action: 'delivery.skipped',
            metadata: { status: 'skipped', reason: 'duplicate_delivered_idempotency_key', endpointHint: `https://discord.com/api/webhooks/777777777/${secret}` },
            createdAt: '2026-06-28T12:21:01.000Z',
        },
    ],
    filters: { orgId: 'org_contract', dedupeKey: 'dwm.alert.replayed:org_contract:destination_duplicate_replay_contract:dwm_dedupe_duplicate_replay_contract' },
})
const deliveryRetryPersistence = buildDwmWebhookDeliveryRetryPersistence({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
})
const deliveryRetryQueue = buildDwmWebhookDeliveryRetryQueue({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryRetryRequest = buildDwmWebhookDeliveryRetryRequestContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryRetryWorkOrders = buildDwmWebhookDeliveryRetryWorkOrders({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryAuditTrail = buildDwmWebhookDeliveryAuditTrail({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const replayDestinationTest = buildDwmWebhookDestinationTestContract({
    liveDeliveryEnabled: false,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
})
const persistedOnlyDestinationTest = buildDwmWebhookDestinationTestContract({
    liveDeliveryEnabled: false,
    destination: operationDestinations.find(item => item.id === 'destination_sent_contract') || null,
    deliveries: [],
    auditEvents: [],
    viewerRole: 'admin',
    canManage: true,
})
const disabledDestinationTest = buildDwmWebhookDestinationTestContract({
    liveDeliveryEnabled: false,
    destination: operationDestinations.find(item => item.id === 'destination_disabled_contract') || null,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
})
const failedDestinationTest = buildDwmWebhookDestinationTestContract({
    liveDeliveryEnabled: false,
    destination: operationDestinations.find(item => item.id === 'destination_test_failed_contract') || null,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
})
const memberDeliveryRetryQueue = buildDwmWebhookDeliveryRetryQueue({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'member',
    canManage: false,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const memberDeliveryRetryRequest = buildDwmWebhookDeliveryRetryRequestContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'member',
    canManage: false,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const memberDeliveryRetryWorkOrders = buildDwmWebhookDeliveryRetryWorkOrders({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'member',
    canManage: false,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const memberDeliveryAuditTrail = buildDwmWebhookDeliveryAuditTrail({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'member',
    canManage: false,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const memberReplayDestinationTest = buildDwmWebhookDestinationTestContract({
    liveDeliveryEnabled: false,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'member',
    canManage: false,
})
const nonmemberDeliveryRetryQueue = buildDwmWebhookDeliveryRetryQueue({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryRetryRequest = buildDwmWebhookDeliveryRetryRequestContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryRetryWorkOrders = buildDwmWebhookDeliveryRetryWorkOrders({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryAuditTrail = buildDwmWebhookDeliveryAuditTrail({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
})
const deliveryReadinessConsumer = buildDwmWebhookDeliveryReadinessConsumerProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDeliveryReadinessConsumer = buildDwmWebhookDeliveryReadinessConsumerProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_contract' },
    viewerRole: null,
    canManage: false,
    visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
})
const foreignDeliveryReadinessConsumer = buildDwmWebhookDeliveryReadinessConsumerProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    filters: { orgId: 'org_foreign' },
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const destinationDeliveryMatrix = buildDwmWebhookDestinationDeliveryMatrix({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const destinationLookup = buildDwmWebhookDestinationLookupContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const memberDestinationDeliveryMatrix = buildDwmWebhookDestinationDeliveryMatrix({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'member',
    canManage: false,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const memberDestinationLookup = buildDwmWebhookDestinationLookupContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'member',
    canManage: false,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDestinationDeliveryMatrix = buildDwmWebhookDestinationDeliveryMatrix({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: null,
    canManage: false,
    visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberDestinationLookup = buildDwmWebhookDestinationLookupContract({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: null,
    canManage: false,
    visibility: { role: undefined, status: undefined, userActive: true, alertVisibilityPolicy: 'members' },
})
const dashboardReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const dashboardLifecycleReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: lifecycleStateDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: lifecycleStateAuditEvents,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const memberDashboardLifecycleReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: lifecycleStateDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: lifecycleStateAuditEvents,
    visibility: { role: 'member', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const customerSetup = buildDwmWebhookCustomerSetupProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: 'admin',
    canManage: true,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
})
const nonmemberCustomerSetup = buildDwmWebhookCustomerSetupProof({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    viewerRole: null,
    canManage: false,
    visibility: { role: null, status: null, userActive: true, alertVisibilityPolicy: 'members' },
})
const policyBlockedDashboardReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'member', status: 'removed', userActive: true, alertVisibilityPolicy: 'members' },
})
const archivedOrgDashboardReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
    orgStatus: 'archived',
})
const retiredWatchlistDashboardReadiness = buildDwmWebhookDashboardReadinessAdapter({
    liveDeliveryEnabled: false,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    visibility: { role: 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'members' },
    watchlistStatus: 'retired',
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
const crudOrgScopeMismatchContract = buildDwmWebhookDestinationCrudContract({
    action: 'update',
    ownerId: 'owner_contract',
    viewerRole: 'admin',
    canManage: true,
    destination: operationDestinations.find(item => item.id === 'destination_replay_contract') || null,
    destinations: operationDestinations,
    deliveries: auditDeliveryRows,
    auditEvents: operationAuditEvents,
    input: {
        orgId: 'org_other_contract',
        label: 'Moved Discord',
        url: 'https://discord.com/api/webhooks/987654321/move-token',
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
const crudDeleteContract = buildDwmWebhookDestinationCrudContract({
    action: 'delete',
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
const adminSecretRotatedLifecycle = adminLifecycle.find(item => item.destinationId === 'destination_secret_rotated_contract')
const adminTestRequiredLifecycle = adminLifecycle.find(item => item.destinationId === 'destination_test_required_contract')
const adminRevokedOwnerLifecycle = adminLifecycle.find(item => item.destinationId === 'destination_revoked_owner_contract')
const adminFailedLifecycle = adminLifecycle.find(item => item.destinationId === 'destination_failed_contract')
const memberReplayLifecycle = memberLifecycle.find(item => item.destinationId === 'destination_replay_contract')
const memberRevokedOwnerLifecycle = memberLifecycle.find(item => item.destinationId === 'destination_revoked_owner_contract')
const orgAlertReplayHealth = orgAlertDeliveryContract.destinationHealth.find(item => item.destinationId === 'destination_replay_contract')
const orgAlertRetryLifecycle = orgAlertDeliveryContract.destinationLifecycle.find(item => item.destinationId === 'destination_live_contract')
const orgAlertDeliveryProof = orgAlertDeliveryContract.alertDeliveryProof
const orgAlertDeliveryReadinessConsumer = orgAlertDeliveryContract.deliveryReadinessConsumer
const orgAlertDeliveryReadinessReplay = orgAlertDeliveryReadinessConsumer.rows.find(item => item.destinationId === 'destination_replay_contract')
const orgAlertOrganizationConsumerReceipt = orgAlertDeliveryContract.organizationConsumerReceipt
const orgAlertOrganizationDestinationReceipt = orgAlertOrganizationConsumerReceipt.destinationReceipts.find(item => item.destinationId === 'destination_replay_contract')
const auditCreated = auditEventContracts.find(item => item.auditEventId === 'audit_destination_created_contract')
const auditUpdated = auditEventContracts.find(item => item.auditEventId === 'audit_destination_updated_contract')
const auditArchived = auditEventContracts.find(item => item.auditEventId === 'audit_destination_archived_contract')
const auditTested = auditEventContracts.find(item => item.auditEventId === 'audit_delivery_test_contract')
const auditFailed = auditEventContracts.find(item => item.auditEventId === 'audit_live_retry_contract')

expect(destinationContract.type === 'discord' && destinationContract.label === 'Replay Discord', 'Destination contract should expose type and label.', destinationContract)
expect(destinationContract.enabled === true && destinationContract.status === 'active', 'Destination contract should expose enabled status.', destinationContract)
expect(destinationContract.display.label === 'Replay Discord' && destinationContract.display.channelLabel === 'Replay Discord' && destinationContract.display.enabled === true, 'Destination contract should expose persisted display/channel label and enabled state.', destinationContract.display)
expect(disabledDestinationContract.enabled === false && disabledDestinationContract.status === 'archived' && disabledDestinationContract.failureReason === 'Disabled by owner', 'Destination contract should expose disabled status and failure reason.', disabledDestinationContract)
expect(destinationContract.redactedUrl.includes('/api/webhooks/987654321/') && !JSON.stringify(destinationContract).includes(secret), 'Destination contract should only expose redacted destination refs.', destinationContract)
expect(destinationContract.lastTest.requestId === 'delivery_test_contract' && destinationContract.lastTest.auditEventId === 'audit_delivery_test_contract', 'Destination contract should expose last test request and audit ids.', destinationContract)
expect(destinationContract.lastDelivery.requestId === 'delivery_replay_contract' && destinationContract.lastDelivery.auditEventId === 'audit_replay_contract', 'Destination contract should expose last delivery request and audit ids.', destinationContract)
expect(destinationContract.auditEventIds.includes('audit_destination_created_contract'), 'Destination contract should expose destination audit event ids.', destinationContract)
expect(destinationContract.createdBy === 'owner_contract' && destinationContract.createdAt === '2026-06-28T11:00:00.000Z' && destinationContract.updatedAt === '2026-06-28T12:04:00.000Z', 'Destination contract should expose created/updated metadata.', destinationContract)
expect(deliveryPreview.requestId === 'delivery_replay_contract' && deliveryPreview.discord.embeds.length === 1, 'Test preview should expose Discord-ready payload.', deliveryPreview)
expect(deliveryPreview.context.org.id === 'org_contract', 'Test preview should expose org context.', deliveryPreview)
expect(deliveryPreview.context.watchlist.id === 'watchlist_item_replay_contract', 'Test preview should expose watchlist context.', deliveryPreview)
expect(deliveryPreview.context.alert.severity === 'high' && deliveryPreview.context.alert.evidenceCount === 3, 'Test preview should expose alert severity and evidence count.', deliveryPreview)
expect(deliveryPreview.context.alert.casePath === replayWorkflowAlert.casePath && deliveryPreview.context.links.casePath === replayWorkflowAlert.casePath, 'Test preview should expose case/deep-link context.', deliveryPreview)
expect(deliveryPreview.context.alert.alertUrl === replayWorkflowAlert.alertUrl && deliveryPreview.context.links.alertUrl === replayWorkflowAlert.alertUrl, 'Test preview should expose alert URL/deep-link context.', deliveryPreview)
expect(deliveryPreview.timestamps.updatedAt === '2026-06-28T12:00:05.000Z' && deliveryPreview.timestamps.createdAt === '2026-06-28T12:00:00.000Z', 'Test preview should expose persisted delivery created/updated timestamps.', deliveryPreview.timestamps)
expect(deliveryPreview.retry.retryable === false && deliveryPreview.retry.attemptCount === 1 && deliveryPreview.audit.expectedAction === 'delivery.replayed', 'Test preview should expose retry/audit proof for dry-run delivery attempts.', deliveryPreview)
expect(retryDeliveryPreview.retry.retryable === true && retryDeliveryPreview.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && retryDeliveryPreview.retry.errorClass === 'upstream_5xx' && retryDeliveryPreview.response.summary && !retryDeliveryPreview.response.summary.includes(secret), 'Failed delivery preview should expose persisted retry metadata with redacted response.', retryDeliveryPreview)
expect(deliveryPreview.sanitizedPayloadPreview.schemaVersion === 'dwm.webhook.sanitized_payload_preview.v1' && deliveryPreview.sanitizedPayloadPreview.payloadHash === 'payload_replay_hash', 'Test preview should expose a stable sanitized payload proof with payload hash.', deliveryPreview.sanitizedPayloadPreview)
expect(deliveryPreview.sanitizedPayloadPreview.fieldNames.includes('Alert URL') && deliveryPreview.sanitizedPayloadPreview.context.watchlistId === 'watchlist_item_replay_contract', 'Sanitized payload preview should expose Discord field names and watchlist context without parsing raw payload.', deliveryPreview.sanitizedPayloadPreview)
expect(deliveryPreview.sanitizedPayloadPreview.fieldNames.includes('Match reason') && Boolean(deliveryPreview.sanitizedPayloadPreview.context.matchReason), 'Sanitized payload preview should expose the redacted alert match reason.', deliveryPreview.sanitizedPayloadPreview)
expect(deliveryPreview.sanitizedPayloadPreview.fieldNames.includes('Evidence timestamp') && deliveryPreview.sanitizedPayloadPreview.context.evidenceTimestamp === '2026-06-28T10:40:00.000Z', 'Sanitized payload preview should expose the evidence capture timestamp.', deliveryPreview.sanitizedPayloadPreview)
expect(deliveryPreview.sanitizedPayloadPreview.fieldNames.includes('Case action') && deliveryPreview.sanitizedPayloadPreview.context.caseActionPath === replayWorkflowAlert.caseActionPath, 'Sanitized payload preview should expose case action replay context.', deliveryPreview.sanitizedPayloadPreview)
expect(deliveryPreview.sanitizedPayloadPreview.fieldNames.includes('Analyst link'), 'Sanitized payload preview should expose the analyst action link field.', deliveryPreview.sanitizedPayloadPreview)
expect(deliveryPreview.sanitizedPayloadPreview.fieldNames.includes('Observed at') && deliveryPreview.sanitizedPayloadPreview.context.eventTimestamp === '2026-06-28T10:45:00.000Z', 'Sanitized payload preview should expose alert event timestamp context.', deliveryPreview.sanitizedPayloadPreview)
expect(deliveryPreview.sanitizedPayloadPreview.context.casePath === replayWorkflowAlert.casePath && deliveryPreview.sanitizedPayloadPreview.links.includes(replayWorkflowAlert.alertUrl) && deliveryPreview.sanitizedPayloadPreview.links.includes(replayWorkflowAlert.caseActionPath), 'Sanitized payload preview should expose case, alert, and case-action links.', deliveryPreview.sanitizedPayloadPreview)
expect(deliveryPreview.sanitizedPayloadPreview.discordTemplate?.templateId === 'dwm.discord.alert_replay.v1' && deliveryPreview.sanitizedPayloadPreview.discordTemplate.ready === true && deliveryPreview.sanitizedPayloadPreview.discordTemplate.redaction.webhookSecretExposed === false, 'Sanitized payload preview should expose redacted Discord template proof for delivery history consumers.', deliveryPreview.sanitizedPayloadPreview.discordTemplate)
expect(deliveryPreview.sanitizedPayloadPreview.redaction.safeForCustomerDisplay === true && deliveryPreview.sanitizedPayloadPreview.redaction.endpointExposed === false, 'Sanitized payload preview should prove customer-safe redaction.', deliveryPreview.sanitizedPayloadPreview)
expect(deliveryPreview.operationLinks.deliveryDetail === 'GET /api/dwm/webhook-deliveries?orgId=org_contract&deliveryId=delivery_replay_contract' && deliveryPreview.operationLinks.destinationTest === 'POST /api/dwm/webhook-destinations/destination_replay_contract/test', 'Test preview should expose stable delivery detail and destination test operation links.', deliveryPreview.operationLinks)
expect(deliveryPreview.operationLinks.destinationDelete === 'DELETE /api/dwm/webhook-destinations/destination_replay_contract' && deliveryPreview.operationLinks.destinationArchive === deliveryPreview.operationLinks.destinationDelete, 'Test preview should expose destination archive/delete remediation links.', deliveryPreview.operationLinks)
expect(deliveryPreview.operationLinks.dedupeHistory?.includes('dwm_dedupe_replay_contract') && deliveryPreview.operationLinks.casePath === replayWorkflowAlert.casePath, 'Test preview should expose dedupe history and case action links.', deliveryPreview.operationLinks)
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
expect(adminReplayLifecycle?.lifecycleState.primary === 'active' && adminReplayLifecycle.lifecycleState.active === true && adminReplayLifecycle.lifecycleState.secretState === 'redacted', 'Destination lifecycle state should mark verified active destinations with redacted secret refs.', adminReplayLifecycle?.lifecycleState)
expect(adminDisabledLifecycle?.lifecycleState.primary === 'disabled' && adminDisabledLifecycle.lifecycleState.disabled === true && adminDisabledLifecycle.lifecycleState.requiredActions.enableDestination?.body.status === 'active', 'Destination lifecycle state should expose disabled remediation without secrets.', adminDisabledLifecycle?.lifecycleState)
expect(adminFailedLifecycle?.lifecycleState.primary === 'failed' && adminFailedLifecycle.lifecycleState.failed === true && adminFailedLifecycle.lifecycleState.requiredActions.dryRunTest?.body.dryRun === true, 'Destination lifecycle state should expose failed test remediation.', adminFailedLifecycle?.lifecycleState)
expect(adminSecretRotatedLifecycle?.lifecycleState.primary === 'secret_rotated' && adminSecretRotatedLifecycle.lifecycleState.secretRotated === true && adminSecretRotatedLifecycle.lifecycleState.testRequired === true && adminSecretRotatedLifecycle.lifecycleState.rotation.endpointExposed === false, 'Destination lifecycle state should require dry-run proof after secret rotation.', adminSecretRotatedLifecycle?.lifecycleState)
expect(adminTestRequiredLifecycle?.lifecycleState.primary === 'test_required' && adminTestRequiredLifecycle.lifecycleState.testRequired === true && adminTestRequiredLifecycle.lifecycleState.requiredActions.dryRunTest?.noNetworkDefault === true, 'Destination lifecycle state should expose test-required destinations with no-network test action.', adminTestRequiredLifecycle?.lifecycleState)
expect(adminRevokedOwnerLifecycle?.lifecycleState.primary === 'revoked_owner' && adminRevokedOwnerLifecycle.lifecycleState.revokedOwner === true && adminRevokedOwnerLifecycle.lifecycleState.owner.createdBy === 'removed_member_contract', 'Destination lifecycle state should expose revoked-owner state to admins.', adminRevokedOwnerLifecycle?.lifecycleState)
expect(adminDisabledLifecycle?.lifecycleReadinessReceipt.schemaVersion === 'dwm.webhook.destination_lifecycle_readiness_receipt.v1' && adminDisabledLifecycle.lifecycleReadinessReceipt.nextAction === 'enable_destination' && adminDisabledLifecycle.lifecycleReadinessReceipt.routes.enable.includes('destination_disabled_contract'), 'Destination lifecycle receipt should expose disabled destination remediation routes.', adminDisabledLifecycle?.lifecycleReadinessReceipt)
expect(adminFailedLifecycle?.lifecycleReadinessReceipt.nextAction === 'dry_run_test' && adminFailedLifecycle.lifecycleReadinessReceipt.status.lifecycle === 'failed' && adminFailedLifecycle.lifecycleReadinessReceipt.blockers.some(item => item.code === 'failed'), 'Destination lifecycle receipt should expose failed test remediation and blockers.', adminFailedLifecycle?.lifecycleReadinessReceipt)
expect(adminSecretRotatedLifecycle?.lifecycleReadinessReceipt.actionBodyPreview.dryRunTest?.dryRun === true && adminSecretRotatedLifecycle.lifecycleReadinessReceipt.redactedDestination.endpointExposed === false, 'Destination lifecycle receipt should expose secret-rotated dry-run action without endpoint secrets.', adminSecretRotatedLifecycle?.lifecycleReadinessReceipt)
expect(memberReplayLifecycle?.view === 'member' && memberReplayLifecycle.access.canUpdate === false && memberReplayLifecycle.access.canTest === false && memberReplayLifecycle.auditEventContracts.length === 0, 'Member lifecycle should expose safe read status without admin audit detail.', memberReplayLifecycle)
expect(memberRevokedOwnerLifecycle?.lifecycleState.owner.createdBy === null && memberRevokedOwnerLifecycle.lifecycleState.redaction.actorExposed === false, 'Member lifecycle state should hide revoked-owner actor identifiers.', memberRevokedOwnerLifecycle?.lifecycleState)
expect(memberRevokedOwnerLifecycle?.lifecycleReadinessReceipt.audit.actorExposed === false && memberRevokedOwnerLifecycle.lifecycleReadinessReceipt.audit.auditEventIds.length === 0, 'Member lifecycle receipt should keep actor/audit identifiers member-safe.', memberRevokedOwnerLifecycle?.lifecycleReadinessReceipt)
expect(!JSON.stringify(adminLifecycle).includes(secret) && !JSON.stringify(memberLifecycle).includes(secret), 'Destination lifecycle should not leak endpoint, response, or audit secrets.', { adminLifecycle, memberLifecycle })
expect(orgAlertDeliveryContract.schemaVersion === 'dwm.webhook.org_alert_delivery.v1' && orgAlertDeliveryContract.orgId === 'org_contract', 'Org alert delivery contract should normalize org alert context.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.eventType === 'dwm.alert.replayed' && orgAlertDeliveryContract.dryRun === true && orgAlertDeliveryContract.externalSendEnabled === false, 'Org alert delivery contract should preserve dry-run/no-network semantics.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.alert.id === 'alert_replay_contract' && orgAlertDeliveryContract.alert.casePath === replayWorkflowAlert.casePath && orgAlertDeliveryContract.alert.provenanceSummary.includes('captures'), 'Org alert delivery contract should expose alert case/provenance context.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.watchlist.id === 'watchlist_item_replay_contract' && orgAlertDeliveryContract.watchlist.terms.includes('acme-security.com'), 'Org alert delivery contract should expose watchlist identity.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.destinationSelection.selectedDestinations.some(item => item.id === 'destination_replay_contract' && item.idempotencyKey === 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract'), 'Org alert delivery contract should expose destination idempotency keys.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.destinationSelection.skippedDestinations.some(item => item.id === 'destination_disabled_contract' && item.reason === 'disabled'), 'Org alert delivery contract should expose disabled destination skips.', orgAlertDeliveryContract)
expect(orgAlertDeliveryContract.alertDestinationReadiness.schemaVersion === 'dwm.webhook.alert_readiness_handoff.v1' && orgAlertDeliveryContract.alertDestinationReadiness.orgId === 'org_contract', 'Org alert delivery contract should include destination readiness handoff.', orgAlertDeliveryContract.alertDestinationReadiness)
expect(orgAlertDeliveryContract.deliveryOutcome.schemaVersion === 'dwm.webhook.org_alert_delivery_outcome.v1' && orgAlertDeliveryContract.deliveryOutcome.counts.recorded >= 1, 'Org alert delivery contract should include persisted delivery outcome proof.', orgAlertDeliveryContract.deliveryOutcome)
const orgAlertReplayOutcome = orgAlertDeliveryContract.deliveryOutcome.selectedDestinations.find(item => item.destinationId === 'destination_replay_contract')
const orgAlertDisabledOutcome = orgAlertDeliveryContract.deliveryOutcome.skippedDestinations.find(item => item.destinationId === 'destination_disabled_contract')
expect(orgAlertReplayOutcome?.recorded === true && orgAlertReplayOutcome.latestAttempt?.deliveryId === 'delivery_replay_duplicate_contract' && orgAlertReplayOutcome.latestAttempt.auditEventId === 'audit_replay_duplicate_contract', 'Org alert delivery outcome should link selected destination to ledger and audit ids.', orgAlertReplayOutcome)
expect(orgAlertReplayOutcome?.preview?.discord.fieldNames.includes('Workflow') && orgAlertReplayOutcome.preview.discord.fieldNames.includes('Confidence') && orgAlertReplayOutcome.preview.context.alert.casePath === replayWorkflowAlert.casePath, 'Org alert delivery outcome should carry Discord preview and case context.', orgAlertReplayOutcome)
expect(orgAlertReplayOutcome?.operationLinks?.deliveryDetail.includes('delivery_replay_duplicate_contract') && orgAlertReplayOutcome.operationLinks.destinationTest === 'POST /api/dwm/webhook-destinations/destination_replay_contract/test', 'Org alert delivery outcome should carry stable customer operation links for delivery proof.', orgAlertReplayOutcome)
expect(orgAlertDisabledOutcome?.reason === 'disabled' && orgAlertDisabledOutcome.blockers.some(item => item.code === 'disabled' && item.blocking === true), 'Org alert delivery outcome should expose disabled destination skips as blockers.', orgAlertDisabledOutcome)
expect(orgAlertDeliveryContract.deliveryOutcome.noNetwork === true && orgAlertDeliveryContract.deliveryOutcome.externalSendEnabled === false, 'Org alert delivery outcome should preserve no-network dry-run semantics.', orgAlertDeliveryContract.deliveryOutcome)
expect(orgAlertDeliveryReadinessConsumer.schemaVersion === 'dwm.webhook.delivery_readiness_consumer.v1' && orgAlertDeliveryReadinessConsumer.noNetwork === true && orgAlertDeliveryReadinessConsumer.filters.alertId === 'alert_replay_contract', 'Org alert delivery contract should expose alert-scoped delivery readiness consumer fields.', orgAlertDeliveryReadinessConsumer)
expect(orgAlertDeliveryReadinessReplay?.readiness.idempotentReplay === true && orgAlertDeliveryReadinessReplay.readiness.redactedDryRun === true && orgAlertDeliveryReadinessReplay.audit.linked === true, 'Org alert delivery readiness consumer should prove replay, dry-run redaction, and audit linkage.', orgAlertDeliveryReadinessReplay)
expect(orgAlertDeliveryReadinessReplay?.context.casePath === replayWorkflowAlert.casePath && orgAlertDeliveryReadinessReplay.context.sourceFamily === 'telegram_public' && orgAlertDeliveryReadinessReplay.operationLinks.deliveryDetail.includes('delivery_replay_duplicate_contract'), 'Org alert delivery readiness consumer should preserve case/source/deep-link context.', orgAlertDeliveryReadinessReplay)
expect(orgAlertDeliveryReadinessConsumer.redaction.webhookSecretExposed === false && !JSON.stringify(orgAlertDeliveryReadinessConsumer).includes(secret), 'Org alert delivery readiness consumer should redact webhook secrets.', orgAlertDeliveryReadinessConsumer)
expect(orgAlertOrganizationConsumerReceipt.schemaVersion === 'dwm.webhook.organization_delivery_consumer_receipt.v1' && orgAlertOrganizationConsumerReceipt.consumesSchemaVersion === 'organization.webhook_destination_delivery_consumer.v1', 'Org alert delivery contract should expose the organization delivery consumer bridge.', orgAlertOrganizationConsumerReceipt)
expect(orgAlertOrganizationConsumerReceipt.organizationId === 'org_contract' && orgAlertOrganizationConsumerReceipt.destinationScope.crossOrgDestinationAllowed === false && orgAlertOrganizationConsumerReceipt.destinationScope.nonmemberDestinationEnumeration === false, 'Organization consumer receipt should preserve org-scoped destination isolation.', orgAlertOrganizationConsumerReceipt.destinationScope)
expect(orgAlertOrganizationConsumerReceipt.noNetwork === true && orgAlertOrganizationConsumerReceipt.externalSendEnabled === false && orgAlertOrganizationConsumerReceipt.dryRunReady === true, 'Organization consumer receipt should preserve no-network dry-run readiness.', orgAlertOrganizationConsumerReceipt)
expect(orgAlertOrganizationConsumerReceipt.watchlistMatches.some(item => item.watchlistId === 'watchlist_item_replay_contract' && item.watchedEntity.value === 'acme-security.com' && item.destinationReadiness.dryRunReady === true), 'Organization consumer receipt should carry watchlist match and delivery readiness context.', orgAlertOrganizationConsumerReceipt.watchlistMatches)
expect(orgAlertOrganizationDestinationReceipt?.idempotencyKey === 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract' && orgAlertOrganizationDestinationReceipt.deliveryId === 'delivery_replay_duplicate_contract' && orgAlertOrganizationDestinationReceipt.auditEventId === 'audit_replay_duplicate_contract', 'Organization consumer receipt should link destination receipt to idempotency, delivery, and audit proof.', orgAlertOrganizationDestinationReceipt)
expect(orgAlertOrganizationDestinationReceipt?.readiness.idempotentReplay === true && orgAlertOrganizationDestinationReceipt.readiness.redactedDryRun === true && orgAlertOrganizationDestinationReceipt.redactedDestination.endpointExposed === false, 'Organization consumer destination receipt should prove replay safety and endpoint redaction.', orgAlertOrganizationDestinationReceipt)
expect(orgAlertOrganizationConsumerReceipt.skippedDestinations.some(item => item.destinationId === 'destination_disabled_contract' && item.code === 'destination_disabled') && orgAlertOrganizationConsumerReceipt.blockerCodes.includes('destination_disabled'), 'Organization consumer receipt should expose typed skipped-destination blockers.', orgAlertOrganizationConsumerReceipt)
expect(orgAlertOrganizationConsumerReceipt.alertContext.casePath === replayWorkflowAlert.casePath && orgAlertOrganizationConsumerReceipt.alertContext.sourceFamily === 'telegram_public' && orgAlertOrganizationConsumerReceipt.readiness.idempotentReplayCount >= 1, 'Organization consumer receipt should expose alert/case/source readiness fields for downstream consumers.', orgAlertOrganizationConsumerReceipt)
expect(!JSON.stringify(orgAlertOrganizationConsumerReceipt).includes(secret), 'Organization consumer receipt should not leak endpoint or webhook secrets.', orgAlertOrganizationConsumerReceipt)
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
const queuedRetryEntry = deliveryRetryQueue.entries.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_live_contract:dwm_dedupe_live_contract')
const queuedDeliveredEntry = deliveryRetryQueue.entries.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_sent_contract:dwm_dedupe_sent_contract')
const queuedTerminalEntry = deliveryRetryQueue.entries.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_terminal_contract:dwm_dedupe_terminal_contract')
const retryRequestEntry = deliveryRetryRequest.entries.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_live_contract:dwm_dedupe_live_contract')
const deliveredRetryRequestEntry = deliveryRetryRequest.entries.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_sent_contract:dwm_dedupe_sent_contract')
const retryWorkOrder = deliveryRetryWorkOrders.workOrders.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_live_contract:dwm_dedupe_live_contract')
const deliveredRetryWorkOrder = deliveryRetryWorkOrders.workOrders.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_sent_contract:dwm_dedupe_sent_contract')
const terminalRetryWorkOrder = deliveryRetryWorkOrders.workOrders.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_terminal_contract:dwm_dedupe_terminal_contract')
const readinessRetryable = deliveryReadinessConsumer.rows.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_live_contract:dwm_dedupe_live_contract')
const readinessTerminal = deliveryReadinessConsumer.rows.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_terminal_contract:dwm_dedupe_terminal_contract')
const readinessDelivered = deliveryReadinessConsumer.rows.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_sent_contract:dwm_dedupe_sent_contract')
const readinessReplay = deliveryReadinessConsumer.rows.find(item => item.idempotencyKey === 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract')
const readinessDryRun = deliveryReadinessConsumer.rows.find(item => item.rawStatus === 'dry_run' && item.destinationId === 'destination_replay_contract')
const auditTrailRetry = deliveryAuditTrail.entries.find(item => item.auditEventId === 'audit_live_retry_contract')
const auditTrailReplay = deliveryAuditTrail.entries.find(item => item.auditEventId === 'audit_replay_duplicate_contract')
const auditTrailDestination = deliveryAuditTrail.entries.find(item => item.auditEventId === 'audit_destination_updated_contract')
const memberAuditTrailRetry = memberDeliveryAuditTrail.entries.find(item => item.auditEventId === 'audit_live_retry_contract')
const matrixReplayDestination = destinationDeliveryMatrix.destinations.find(item => item.destinationId === 'destination_replay_contract')
const matrixRetryDestination = destinationDeliveryMatrix.destinations.find(item => item.destinationId === 'destination_live_contract')
const matrixDisabledDestination = destinationDeliveryMatrix.destinations.find(item => item.destinationId === 'destination_disabled_contract')
const lookupReplayDestination = destinationLookup.destinations.find(item => item.destinationId === 'destination_replay_contract')
const lookupRetryDestination = destinationLookup.destinations.find(item => item.destinationId === 'destination_live_contract')
const lookupDisabledDestination = destinationLookup.destinations.find(item => item.destinationId === 'destination_disabled_contract')
expect(deliveryRetryPersistence.schemaVersion === 'dwm.webhook.delivery_retry_persistence.v1' && deliveryRetryPersistence.counts.retryable >= 1, 'Delivery retry persistence should expose grouped retry proof.', deliveryRetryPersistence)
expect(persistedRetryKey?.retry.retryable === true && persistedRetryKey.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && persistedRetryKey.retry.persistedAttemptCount === 2, 'Delivery retry persistence should keep retry/backoff attempts by idempotency key.', persistedRetryKey)
expect(persistedRetryKey?.retry.backoffPersisted === true && persistedRetryKey.retry.nextAuditAction === 'delivery.retry_scheduled' && persistedRetryKey.persistence.retryBackoffPersisted === true, 'Delivery retry persistence should expose persisted backoff and next audit action for retryable failures.', persistedRetryKey)
expect(persistedRetryKey?.persistence.persistedDeliveryIds.includes('delivery_live_failed_retry_contract') && persistedRetryKey.persistence.blockerCodes.includes('live_delivery_disabled') && persistedRetryKey.persistence.redaction.webhookSecretExposed === false, 'Delivery retry persistence should expose secret-safe persisted delivery ids and blockers.', persistedRetryKey?.persistence)
expect(persistedReplayKey?.replay === true && persistedReplayKey.dedupe.duplicate === true && persistedReplayKey.dedupe.duplicateAttemptCount === 2, 'Delivery retry persistence should expose duplicate replay/dedupe proof.', persistedReplayKey)
expect(persistedTerminalKey?.status === 'terminal_failure' && persistedTerminalKey.retry.terminalFailure === true && persistedTerminalKey.retry.lastErrorCategory === 'upstream_4xx', 'Delivery retry persistence should separate terminal failures from retryable failures.', persistedTerminalKey)
expect(persistedTerminalKey?.retry.nextAuditAction === 'delivery.retry_terminal_failure' && persistedTerminalKey.persistence.blockerCodes.includes('terminal_failure'), 'Delivery retry persistence should expose terminal failure audit action and blocker state.', persistedTerminalKey)
expect(persistedSentKey?.dedupe.alreadyDelivered === true && persistedSentKey.status === 'delivered', 'Delivery retry persistence should mark already delivered dedupe keys.', persistedSentKey)
expect(persistedSentKey?.retry.nextAuditAction === 'delivery.retry_skipped_duplicate' && persistedSentKey.persistence.blockerCodes.includes('dedupe_already_delivered'), 'Delivery retry persistence should preserve duplicate live-send protection for delivered keys.', persistedSentKey)
expect(foreignDeliveryRetryPersistence.deliveryKeys.length === 1 && foreignDeliveryRetryPersistence.deliveryKeys.every(item => item.orgId === 'org_foreign'), 'Delivery retry persistence org filter should not leak other org attempts.', foreignDeliveryRetryPersistence)
expect(!JSON.stringify(deliveryRetryPersistence).includes(secret), 'Delivery retry persistence should redact endpoint, response, and error secrets.', deliveryRetryPersistence)
expect(deliveryRetryQueue.schemaVersion === 'dwm.webhook.delivery_retry_queue.v1' && deliveryRetryQueue.noNetwork === true && deliveryRetryQueue.counts.retryable >= 1, 'Delivery retry queue should expose no-network retryable delivery proof.', deliveryRetryQueue)
expect(queuedRetryEntry?.retry.dryRunReady === true && queuedRetryEntry.retry.liveReady === false && queuedRetryEntry.retry.mode === 'dry_run', 'Delivery retry queue should allow dry-run retry proof while live delivery is disabled.', queuedRetryEntry)
expect(queuedRetryEntry?.blockers.some(item => item.code === 'live_delivery_disabled' && item.blocking === false) && queuedRetryEntry.audit.auditEventIds.includes('audit_live_retry_contract'), 'Delivery retry queue should expose live-disabled blocker and audit linkage.', queuedRetryEntry)
expect(queuedDeliveredEntry?.blockers.some(item => item.code === 'dedupe_already_delivered') && queuedDeliveredEntry.dedupe.alreadyDelivered === true, 'Delivery retry queue should block already-delivered idempotency keys.', queuedDeliveredEntry)
expect(queuedTerminalEntry?.blockers.some(item => item.code === 'terminal_failure') && queuedTerminalEntry.retry.terminalFailure === true, 'Delivery retry queue should expose terminal failure blockers.', queuedTerminalEntry)
expect(memberDeliveryRetryQueue.entries.some(item => item.blockers.some(blocker => blocker.code === 'permission_denied')) && memberDeliveryRetryQueue.access.memberSafe === true, 'Delivery retry queue should keep members read-only without retry permission.', memberDeliveryRetryQueue)
expect(nonmemberDeliveryRetryQueue.entries.length === 0 && nonmemberDeliveryRetryQueue.blockers.some(item => item.code === 'permission_denied'), 'Delivery retry queue should deny nonmembers without destination leakage.', nonmemberDeliveryRetryQueue)
expect(!JSON.stringify(deliveryRetryQueue).includes(secret), 'Delivery retry queue should redact endpoint, response, and error secrets.', deliveryRetryQueue)
expect(deliveryRetryRequest.schemaVersion === 'dwm.webhook.delivery_retry_request.v1' && deliveryRetryRequest.noNetwork === true && deliveryRetryRequest.counts.dryRunReady >= 1, 'Delivery retry request contract should expose no-network retry actions.', deliveryRetryRequest)
expect(retryRequestEntry?.dryRunRequest.canSend === true && retryRequestEntry.dryRunRequest.body.dryRun === true && retryRequestEntry.dryRunRequest.body.live === false, 'Delivery retry request should build a dry-run delivery body for retryable failures.', retryRequestEntry)
expect(retryRequestEntry?.dryRunRequest.body.destinationId === 'destination_live_contract' && retryRequestEntry.dryRunRequest.body.dedupeKey === 'dwm_dedupe_live_contract' && retryRequestEntry.dryRunRequest.body.casePath === '/v1/cases/case_live_contract?alertId=alert_live_contract&dedupeKey=dwm_dedupe_live_contract', 'Delivery retry request should preserve org alert routing context.', retryRequestEntry)
expect(retryRequestEntry?.liveRequest.canSend === false && retryRequestEntry.liveRequest.blockers.some(item => item.code === 'live_delivery_disabled') && retryRequestEntry.externalSendEnabled === false, 'Delivery retry request should keep live retry blocked unless live delivery is explicitly enabled.', retryRequestEntry)
expect(deliveredRetryRequestEntry?.dryRunRequest.canSend === false && deliveredRetryRequestEntry.blockers.some(item => item.code === 'dedupe_already_delivered'), 'Delivery retry request should block already delivered idempotency keys.', deliveredRetryRequestEntry)
expect(memberDeliveryRetryRequest.entries.some(item => item.dryRunRequest.canSend === false && item.blockers.some(blocker => blocker.code === 'permission_denied')) && memberDeliveryRetryRequest.access.memberSafe === true, 'Delivery retry request should expose read-only member proof without retry permission.', memberDeliveryRetryRequest)
expect(nonmemberDeliveryRetryRequest.entries.length === 0 && nonmemberDeliveryRetryRequest.blockers.some(item => item.code === 'permission_denied'), 'Delivery retry request should deny nonmembers without leaking retry actions.', nonmemberDeliveryRetryRequest)
expect(!JSON.stringify(deliveryRetryRequest).includes(secret), 'Delivery retry request should redact endpoint, response, and error secrets.', deliveryRetryRequest)
expect(deliveryRetryWorkOrders.schemaVersion === 'dwm.webhook.delivery_retry_work_orders.v1' && deliveryRetryWorkOrders.noNetwork === true && deliveryRetryWorkOrders.counts.dryRunReady >= 1, 'Delivery retry work orders should expose no-network retry operations.', deliveryRetryWorkOrders)
expect(retryWorkOrder?.state === 'dry_run_ready' && retryWorkOrder.eligibility.nextRetryAt === '2026-06-28T12:11:00.000Z' && retryWorkOrder.audit.nextAction === 'delivery.retry_requested', 'Delivery retry work orders should mark retryable failures as dry-run ready with audit action hints.', retryWorkOrder)
expect(retryWorkOrder?.request.dryRunBody.destinationId === 'destination_live_contract' && retryWorkOrder.request.dryRunBody.dedupeKey === 'dwm_dedupe_live_contract' && retryWorkOrder.worker3Proof.expectedDryRunStatus === 'dry_run', 'Delivery retry work orders should carry safe retry request proof for Worker 3.', retryWorkOrder)
expect(deliveredRetryWorkOrder?.state === 'already_delivered' && deliveredRetryWorkOrder.audit.nextAction === 'delivery.retry_skipped_duplicate', 'Delivery retry work orders should preserve duplicate live-send protection.', deliveredRetryWorkOrder)
expect(terminalRetryWorkOrder?.state === 'terminal_failure' && terminalRetryWorkOrder.eligibility.terminalFailure === true && terminalRetryWorkOrder.audit.nextAction === 'delivery.retry_terminal_failure', 'Delivery retry work orders should separate terminal failures from retryable failures.', terminalRetryWorkOrder)
expect(memberDeliveryRetryWorkOrders.workOrders.some(item => item.state === 'permission_denied') && memberDeliveryRetryWorkOrders.access.memberSafe === true, 'Delivery retry work orders should keep members read-only without retry actions.', memberDeliveryRetryWorkOrders)
expect(nonmemberDeliveryRetryWorkOrders.workOrders.length === 0 && nonmemberDeliveryRetryWorkOrders.blockers.some(item => item.code === 'permission_denied'), 'Delivery retry work orders should deny nonmembers without leaking work orders.', nonmemberDeliveryRetryWorkOrders)
expect(!JSON.stringify(deliveryRetryWorkOrders).includes(secret), 'Delivery retry work orders should redact endpoint, response, and error secrets.', deliveryRetryWorkOrders)
expect(deliveryReadinessConsumer.schemaVersion === 'dwm.webhook.delivery_readiness_consumer.v1' && deliveryReadinessConsumer.noNetwork === true && deliveryReadinessConsumer.counts.total === auditDeliveryRows.filter(item => item.orgId === 'org_contract').length, 'Delivery readiness consumer should expose org-scoped no-network readiness rows.', deliveryReadinessConsumer)
expect(deliveryReadinessConsumer.routeContract.detail.requiredQuery.join(',') === 'orgId,deliveryId' && deliveryReadinessConsumer.routeContract.retryDryRun.noNetworkDefault === true && deliveryReadinessConsumer.access.canRetry === true, 'Delivery readiness consumer should expose stable delivery detail and dry-run retry contracts.', deliveryReadinessConsumer.routeContract)
expect(readinessRetryable?.readiness.retryableFailure === true && readinessRetryable.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && readinessRetryable.readiness.retryEligible === true, 'Delivery readiness consumer should expose retryable failure/backoff state.', readinessRetryable)
expect(readinessTerminal?.readiness.nonRetryableFailure === true && readinessTerminal.blockers.some(item => item.code === 'terminal_failure'), 'Delivery readiness consumer should expose non-retryable terminal failure state.', readinessTerminal)
expect(readinessDelivered?.readiness.success === true && readinessDelivered.idempotency.alreadyDelivered === true, 'Delivery readiness consumer should expose delivered success and idempotency guard.', readinessDelivered)
expect(readinessReplay?.readiness.idempotentReplay === true && readinessReplay.replayHistory.duplicateReplay === true && readinessReplay.audit.linked === true, 'Delivery readiness consumer should expose idempotent replay history and audit linkage.', readinessReplay)
expect(readinessReplay?.operationLinks.deliveryDetail === 'GET /api/dwm/webhook-deliveries?orgId=org_contract&deliveryId=delivery_replay_duplicate_contract' && readinessReplay.operationLinks.retryDryRun === 'POST /api/dwm/webhook-deliveries', 'Delivery readiness consumer should expose support-safe delivery and retry operation links.', readinessReplay?.operationLinks)
expect(readinessDryRun?.readiness.redactedDryRun === true && readinessDryRun.redaction.webhookSecretExposed === false && readinessDryRun.destination.endpointExposed === false, 'Delivery readiness consumer should expose redacted dry-run proof without endpoint leakage.', readinessDryRun)
expect(nonmemberDeliveryReadinessConsumer.rows.length === 0 && nonmemberDeliveryReadinessConsumer.counts.crossOrgDenied === 1 && nonmemberDeliveryReadinessConsumer.blockers.some(item => item.code === 'permission_denied'), 'Delivery readiness consumer should deny nonmembers without leaking delivery rows.', nonmemberDeliveryReadinessConsumer)
expect(foreignDeliveryReadinessConsumer.rows.length === 1 && foreignDeliveryReadinessConsumer.rows.every(item => item.orgId === 'org_foreign'), 'Delivery readiness consumer org filters should not leak other tenant rows.', foreignDeliveryReadinessConsumer)
expect(!JSON.stringify(deliveryReadinessConsumer).includes(secret) && !JSON.stringify(nonmemberDeliveryReadinessConsumer).includes(secret), 'Delivery readiness consumer should redact endpoint, response, and payload secrets.', { deliveryReadinessConsumer, nonmemberDeliveryReadinessConsumer })
expect(deliveryAuditTrail.schemaVersion === 'dwm.webhook.audit_trail.v1' && deliveryAuditTrail.counts.delivery >= 1 && deliveryAuditTrail.counts.destination >= 1, 'Delivery audit trail should summarize destination and delivery events.', deliveryAuditTrail)
expect(auditTrailRetry?.retry?.nextRetryAt === '2026-06-28T12:11:00.000Z' && auditTrailRetry.retry.canRetry === true && auditTrailRetry.routes.retry === 'POST /api/dwm/webhook-deliveries', 'Delivery audit trail should link failed deliveries to retry/backoff proof.', auditTrailRetry)
expect(auditTrailRetry?.actionRequest?.action === 'retry_delivery' && auditTrailRetry.actionRequest.canSend === true && auditTrailRetry.actionRequest.body?.destinationId === 'destination_live_contract' && auditTrailRetry.actionRequest.expectedAuditAction === 'delivery.retry_requested', 'Delivery audit trail should expose a no-network retry request for retryable failures.', auditTrailRetry?.actionRequest)
expect(auditTrailReplay?.delivery?.replay === true && auditTrailReplay.delivery.casePath === replayWorkflowAlert.casePath && auditTrailReplay.delivery.dedupeKey === 'dwm_dedupe_replay_contract', 'Delivery audit trail should preserve replay, case, and dedupe context.', auditTrailReplay)
expect(auditTrailDestination?.category === 'destination' && auditTrailDestination.destination?.redactedEndpoint.endpointHash === 'endpoint_replay_hash' && auditTrailDestination.metadata !== null, 'Delivery audit trail should include admin-visible destination audit context.', auditTrailDestination)
expect(auditTrailDestination?.actionRequest?.action === 'test_destination' && auditTrailDestination.actionRequest.route === 'POST /api/dwm/webhook-destinations/destination_replay_contract/test' && auditTrailDestination.actionRequest.expectedAuditAction === 'delivery.tested', 'Delivery audit trail should expose a no-network destination test request for destination audit events.', auditTrailDestination?.actionRequest)
expect(memberDeliveryAuditTrail.access.memberSafe === true && memberDeliveryAuditTrail.entries.some(item => item.actorId === null && item.metadata === null && item.memberSafe === true), 'Delivery audit trail should expose member-safe rows without actor or metadata detail.', memberDeliveryAuditTrail)
expect(memberAuditTrailRetry?.actionRequest?.canSend === false && memberAuditTrailRetry.actionRequest.body === null, 'Member-safe delivery audit trail should not expose runnable retry request bodies.', memberAuditTrailRetry?.actionRequest)
expect(nonmemberDeliveryAuditTrail.entries.length === 0 && nonmemberDeliveryAuditTrail.blockers.some(item => item.code === 'permission_denied'), 'Delivery audit trail should deny nonmembers without leaking audit rows.', nonmemberDeliveryAuditTrail)
expect(!JSON.stringify(deliveryAuditTrail).includes(secret) && !JSON.stringify(memberDeliveryAuditTrail).includes(secret), 'Delivery audit trail should redact endpoint, metadata, and delivery secrets.', { deliveryAuditTrail, memberDeliveryAuditTrail })
expect(replayDestinationTest.schemaVersion === 'dwm.webhook.destination_test.v1' && replayDestinationTest.status === 'verified' && replayDestinationTest.latestTest?.dryRun === true, 'Destination test contract should expose verified dry-run test proof.', replayDestinationTest)
expect(replayDestinationTest.preview?.discord.fieldNames.includes('Workflow') && replayDestinationTest.preview.discord.fieldNames.includes('Confidence') && replayDestinationTest.audit.latestAuditEventId === 'audit_delivery_test_contract', 'Destination test contract should include Discord preview fields and audit linkage.', replayDestinationTest)
expect(replayDestinationTest.blockers.some(item => item.code === 'live_delivery_disabled' && item.blocking === false) && replayDestinationTest.noNetwork === true && replayDestinationTest.externalSendEnabled === false, 'Destination test contract should keep live sends disabled by default.', replayDestinationTest)
expect(replayDestinationTest.dryRunPayloadPreview?.schemaVersion === 'dwm.webhook.destination_test_payload_preview.v1' && replayDestinationTest.dryRunPayloadPreview.noNetwork === true && replayDestinationTest.dryRunPayloadPreview.discord.fieldNames.includes('Watchlist'), 'Destination test contract should expose the no-network Discord payload preview for setup screens.', replayDestinationTest.dryRunPayloadPreview)
expect(replayDestinationTest.dryRunPayloadPreview?.context.orgId === 'org_contract' && replayDestinationTest.dryRunPayloadPreview.context.sourceFamily === 'dark_web' && replayDestinationTest.dryRunPayloadPreview.context.analystLink === '/dashboard/dwm' && Boolean(replayDestinationTest.dryRunPayloadPreview.context.matchReason) && Boolean(replayDestinationTest.dryRunPayloadPreview.context.evidenceTimestamp) && replayDestinationTest.dryRunPayloadPreview.context.caseActionPath === null, 'Destination test payload preview should carry org/source/action-link, match-reason, evidence timestamp, and null test case-action context.', replayDestinationTest.dryRunPayloadPreview)
expect(replayDestinationTest.dryRunPayloadPreview?.context.discordTemplate?.templateId === 'dwm.discord.destination_test.v1' && replayDestinationTest.dryRunPayloadPreview.context.discordTemplate.noNetworkDefault === true, 'Destination test payload preview should expose the Discord test template summary.', replayDestinationTest.dryRunPayloadPreview?.context.discordTemplate)
expect(replayDestinationTest.dryRunPayloadPreview?.redaction.safeForCustomerDisplay === true && replayDestinationTest.dryRunPayloadPreview.redaction.endpointExposed === false, 'Destination test payload preview should prove redaction and avoid endpoint leakage.', replayDestinationTest.dryRunPayloadPreview)
expect(replayDestinationTest.dryRunTestRequest.canSend === true && replayDestinationTest.dryRunTestRequest.route === 'POST /api/dwm/webhook-destinations/destination_replay_contract/test' && replayDestinationTest.dryRunTestRequest.body?.idempotencyKey === 'dwm.alert.test:org_contract:destination_replay_contract:webhook_test', 'Destination test contract should expose the exact no-network dry-run test request.', replayDestinationTest.dryRunTestRequest)
expect(replayDestinationTest.dryRunTestRequest.expected.auditAction === 'delivery.tested' && replayDestinationTest.dryRunTestRequest.expected.persistedAttempt === true && replayDestinationTest.dryRunTestRequest.payloadPreview?.redaction.endpointExposed === false, 'Destination dry-run test request should prove persisted delivery/audit outcome without exposing endpoint secrets.', replayDestinationTest.dryRunTestRequest)
expect(replayDestinationTest.dryRunTestReceipt.schemaVersion === 'dwm.webhook.destination_test_receipt.v1' && replayDestinationTest.dryRunTestReceipt.expected.auditAction === 'delivery.tested' && replayDestinationTest.dryRunTestReceipt.payloadHash?.startsWith('payload_'), 'Destination test receipt should expose expected persisted dry-run delivery proof.', replayDestinationTest.dryRunTestReceipt)
expect(replayDestinationTest.dryRunTestReceipt.redactedDestination.endpointExposed === false && replayDestinationTest.dryRunTestReceipt.redactedDestination.endpointHash === 'endpoint_replay_hash' && replayDestinationTest.dryRunTestReceipt.payloadPreview?.discord.fieldNames.includes('Watchlist'), 'Destination test receipt should carry redacted destination metadata and Discord preview.', replayDestinationTest.dryRunTestReceipt)
expect(disabledDestinationTest.dryRunTestRequest.canSend === false && disabledDestinationTest.dryRunTestRequest.blockers.some(item => item.code === 'destination_disabled'), 'Destination dry-run test request should block disabled destinations.', disabledDestinationTest.dryRunTestRequest)
expect(disabledDestinationTest.dryRunTestReceipt.blockers.some(item => item.code === 'destination_disabled') && disabledDestinationTest.dryRunTestReceipt.redactedDestination.endpointExposed === false, 'Destination test receipt should carry disabled destination blockers without exposing secrets.', disabledDestinationTest.dryRunTestReceipt)
expect(disabledDestinationTest.status === 'disabled' && disabledDestinationTest.blockers.some(item => item.code === 'destination_disabled'), 'Destination test contract should block disabled destinations.', disabledDestinationTest)
expect(failedDestinationTest.status === 'test_failed' && failedDestinationTest.blockers.some(item => item.code === 'test_failed'), 'Destination test contract should expose failed test state.', failedDestinationTest)
expect(memberReplayDestinationTest.access.memberSafe === true && memberReplayDestinationTest.access.canTest === false && memberReplayDestinationTest.audit.auditEventContracts.length === 0, 'Destination test contract should keep member views read-only and audit-safe.', memberReplayDestinationTest)
expect(!JSON.stringify([replayDestinationTest, memberReplayDestinationTest, disabledDestinationTest, failedDestinationTest]).includes(secret), 'Destination test contract should redact endpoint and delivery secrets.', { replayDestinationTest, memberReplayDestinationTest, disabledDestinationTest, failedDestinationTest })
expect(destinationDeliveryMatrix.schemaVersion === 'dwm.webhook.destination_delivery_matrix.v1' && destinationDeliveryMatrix.summary.destinationCount === operationDestinations.length, 'Destination delivery matrix should summarize org destinations.', destinationDeliveryMatrix)
expect(matrixReplayDestination?.eventCoverage.replayed === true && matrixReplayDestination.deliveryProof.lastReplayed?.requestId === 'delivery_replay_duplicate_contract', 'Destination delivery matrix should expose replay delivery proof by destination.', matrixReplayDestination)
expect(matrixReplayDestination?.routes.test === 'POST /api/dwm/webhook-destinations/destination_replay_contract/test' && matrixReplayDestination.routes.delete === 'DELETE /api/dwm/webhook-destinations/destination_replay_contract' && matrixReplayDestination.audit.auditEventContracts.length > 0, 'Destination delivery matrix should expose route hints and admin audit contracts.', matrixReplayDestination)
expect(matrixRetryDestination?.retry.ready === true && matrixRetryDestination.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && matrixRetryDestination.blockers.some(item => item.code === 'retry_scheduled' && item.blocking === false), 'Destination delivery matrix should expose retry-ready destination state.', matrixRetryDestination)
expect(matrixDisabledDestination?.enabled === false && matrixDisabledDestination.blockers.some(item => item.code === 'destination_disabled'), 'Destination delivery matrix should expose disabled destination blockers.', matrixDisabledDestination)
expect(memberDestinationDeliveryMatrix.access.memberSafe === true && memberDestinationDeliveryMatrix.destinations.some(item => item.audit.auditEventContracts.length === 0), 'Destination delivery matrix should keep member views audit-safe.', memberDestinationDeliveryMatrix)
expect(nonmemberDestinationDeliveryMatrix.destinations.length === 0 && nonmemberDestinationDeliveryMatrix.blockers.some(item => item.code === 'permission_denied'), 'Destination delivery matrix should deny nonmembers without leaking destination metadata.', nonmemberDestinationDeliveryMatrix)
expect(!JSON.stringify(destinationDeliveryMatrix).includes(secret), 'Destination delivery matrix should redact endpoint, response, and audit secrets.', destinationDeliveryMatrix)
expect(destinationLookup.schemaVersion === 'dwm.webhook.destination_lookup.v1' && destinationLookup.routeContract.list.requiredQuery.includes('orgId') && destinationLookup.routeContract.test.noNetworkDefault === true, 'Destination lookup should expose stable org-scoped route contracts.', destinationLookup.routeContract)
expect(lookupReplayDestination?.redactedDestination.endpointExposed === false && lookupReplayDestination.redactedDestination.endpointHash === 'endpoint_replay_hash' && lookupReplayDestination.routes.destinationDetail.includes('destination_replay_contract'), 'Destination lookup should expose redacted destination metadata and detail routes.', lookupReplayDestination)
expect(lookupReplayDestination?.delivery.lastReplayId === 'delivery_replay_duplicate_contract' && lookupReplayDestination.audit.latestAuditEventId === 'audit_replay_duplicate_contract', 'Destination lookup should expose replay delivery and audit linkage.', lookupReplayDestination)
expect(lookupRetryDestination?.retry.ready === true && lookupRetryDestination.retry.nextRetryAt === '2026-06-28T12:11:00.000Z', 'Destination lookup should expose retry/backoff state.', lookupRetryDestination)
expect(lookupDisabledDestination?.enabled === false && lookupDisabledDestination.blockers.some(item => item.code === 'destination_disabled'), 'Destination lookup should expose disabled destination blockers.', lookupDisabledDestination)
expect(memberDestinationLookup.access.memberSafe === true && memberDestinationLookup.destinations.every(item => item.audit.contracts.length === 0), 'Destination lookup should keep member rows audit-safe.', memberDestinationLookup)
expect(nonmemberDestinationLookup.destinations.length === 0 && nonmemberDestinationLookup.blockers.some(item => item.code === 'permission_denied'), 'Destination lookup should deny nonmembers without destination leakage.', nonmemberDestinationLookup)
expect(!JSON.stringify(destinationLookup).includes(secret), 'Destination lookup should redact endpoint, response, and audit secrets.', destinationLookup)
const dashboardVerified = dashboardReadiness.destinations.find(item => item.destinationId === 'destination_replay_contract')
const dashboardDisabled = dashboardReadiness.destinations.find(item => item.destinationId === 'destination_disabled_contract')
const dashboardSecretMissing = dashboardReadiness.destinations.find(item => item.destinationId === 'destination_missing_url_contract')
const dashboardRetry = dashboardReadiness.destinations.find(item => item.destinationId === 'destination_live_contract')
const dashboardTerminal = dashboardReadiness.destinations.find(item => item.destinationId === 'destination_terminal_contract')
const dashboardTestFailed = dashboardReadiness.destinations.find(item => item.destinationId === 'destination_test_failed_contract')
const dashboardLifecycleActive = dashboardLifecycleReadiness.destinations.find(item => item.destinationId === 'destination_replay_contract')
const dashboardLifecycleDisabled = dashboardLifecycleReadiness.destinations.find(item => item.destinationId === 'destination_disabled_contract')
const dashboardLifecycleFailed = dashboardLifecycleReadiness.destinations.find(item => item.destinationId === 'destination_failed_contract')
const dashboardLifecycleSecretRotated = dashboardLifecycleReadiness.destinations.find(item => item.destinationId === 'destination_secret_rotated_contract')
const dashboardLifecycleTestRequired = dashboardLifecycleReadiness.destinations.find(item => item.destinationId === 'destination_test_required_contract')
const dashboardLifecycleRevokedOwner = dashboardLifecycleReadiness.destinations.find(item => item.destinationId === 'destination_revoked_owner_contract')
const memberDashboardLifecycleRevokedOwner = memberDashboardLifecycleReadiness.destinations.find(item => item.destinationId === 'destination_revoked_owner_contract')
const dashboardLifecycleDryRunAction = dashboardLifecycleReadiness.summary.lifecycleActions.find(item => item.action === 'dry_run_test')
const dashboardLifecycleEnableAction = dashboardLifecycleReadiness.summary.lifecycleActions.find(item => item.action === 'enable_destination')
const dashboardLifecycleOwnerAction = dashboardLifecycleReadiness.summary.lifecycleActions.find(item => item.action === 'review_revoked_owner')
const customerSetupDryRunStep = customerSetup.setupSteps.find(item => item.id === 'dry_run_test')
const customerSetupDeliveryStep = customerSetup.setupSteps.find(item => item.id === 'deliver_org_alert')
const deliveryHistoryReplay = deliveryHistory.entries.find(item => item.deliveryId === 'delivery_replay_duplicate_contract')
const deliveryHistoryRetry = deliveryHistory.entries.find(item => item.deliveryId === 'delivery_live_failed_retry_contract')
const deliveryHistoryTerminal = deliveryHistory.entries.find(item => item.deliveryId === 'delivery_live_terminal_contract')
const deliveryHistoryMissingDestination = deliveryHistory.entries.find(item => item.deliveryId === 'delivery_missing_destination_contract')
const deliveryHistoryConsumerReplay = deliveryHistoryConsumer.rows.find(item => item.deliveryId === 'delivery_replay_duplicate_contract')
const deliveryPersistenceReplay = deliveryPersistenceProof.rows.find(item => item.deliveryId === 'delivery_replay_duplicate_contract')
const deliveryPersistenceRetry = deliveryPersistenceProof.rows.find(item => item.deliveryId === 'delivery_live_failed_retry_contract')
const deliveryAttemptPersistenceReadReplay = deliveryAttemptPersistenceRead.rows.find(item => item.deliveryId === 'delivery_replay_duplicate_contract')
const deliveryReceiptReplay = deliveryReceipts.receipts.find(item => item.deliveryId === 'delivery_replay_duplicate_contract')
const deliveryReceiptRetry = deliveryReceipts.receipts.find(item => item.deliveryId === 'delivery_live_failed_retry_contract')
const deliveryReceiptTerminal = deliveryReceipts.receipts.find(item => item.deliveryId === 'delivery_live_terminal_contract')
const deliveryReceiptMissingDestination = deliveryReceipts.receipts.find(item => item.deliveryId === 'delivery_missing_destination_contract')
const deliveryTimelineReplay = deliveryTimeline.timelines.find(item => item.alertId === 'alert_replay_contract')
const deliveryTimelineRetry = deliveryTimeline.timelines.find(item => item.dedupeKey === 'dwm_dedupe_live_contract')
const deliveryTimelineMissingDestination = deliveryTimeline.timelines.find(item => item.alertId === 'alert_missing_destination_contract')
const deliveryTimelineTerminal = deliveryTimeline.timelines.find(item => item.dedupeKey === 'dwm_dedupe_terminal_contract')
const deliveryActionRetry = deliveryActionPlan.actions.find(item => item.dedupeKey === 'dwm_dedupe_live_contract')
const deliveryActionMissingDestination = deliveryActionPlan.actions.find(item => item.deliveryId === 'delivery_missing_destination_contract')
const deliveryActionTerminal = deliveryActionPlan.actions.find(item => item.dedupeKey === 'dwm_dedupe_terminal_contract')
const deliveryActionDelivered = deliveryActionPlan.actions.find(item => item.dedupeKey === 'dwm_dedupe_sent_contract')
const replayGuardReplay = deliveryReplayGuard.entries.find(item => item.idempotencyKey === 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract')
const replayGuardDelivered = deliveryReplayGuard.entries.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_sent_contract:dwm_dedupe_sent_contract')
const replayGuardTerminal = deliveryReplayGuard.entries.find(item => item.idempotencyKey === 'dwm.alert.created:org_contract:destination_terminal_contract:dwm_dedupe_terminal_contract')
const deliveryReplayApiReplay = deliveryReplayApi.requests.find(item => item.deliveryId === 'delivery_replay_duplicate_contract')
const duplicateReplayGuardDelivered = duplicateReplayGuardHistory.entries.find(item => item.deliveryId === 'delivery_duplicate_replay_delivered_contract')
const duplicateReplayGuardSkipped = duplicateReplayGuardHistory.entries.find(item => item.deliveryId === 'delivery_duplicate_replay_skipped_contract')
expect(deliveryHistory.schemaVersion === 'dwm.webhook.delivery_history.v1' && deliveryHistory.total === deliveryOperations.total, 'Delivery history should mirror customer-visible delivery operations.', deliveryHistory)
expect(deliveryHistoryReplay?.discordPreview?.embedCount === 1 && deliveryHistoryReplay.discordPreview.fieldNames.includes('Alert URL'), 'Delivery history should expose safe Discord preview fields.', deliveryHistoryReplay)
expect(deliveryHistoryReplay?.alert.casePath === replayWorkflowAlert.casePath && deliveryHistoryReplay.alert.caseActionId === replayWorkflowAlert.caseActionId && deliveryHistoryReplay.watchlist.id === 'watchlist_item_replay_contract', 'Delivery history should preserve alert/case action/watchlist context.', deliveryHistoryReplay)
expect(deliveryHistoryReplay?.deliveryProof.auditEventId === 'audit_replay_duplicate_contract' && deliveryHistoryReplay.dedupe.duplicateAttemptCount === 2, 'Delivery history should link replay audit and duplicate replay proof.', deliveryHistoryReplay)
expect(deliveryHistoryReplay?.deliveryProof.updatedAt === '2026-06-28T12:08:05.000Z', 'Delivery history should expose persisted delivery updated timestamp.', deliveryHistoryReplay?.deliveryProof)
expect(deliveryHistoryReplay?.sanitizedPayloadPreview?.discordTemplate?.templateId === 'dwm.discord.alert_replay.v1' && deliveryHistoryReplay.sanitizedPayloadPreview.discordTemplate.requiredFields.includes('Dedupe key'), 'Delivery history should expose Discord template proof in sanitized previews.', deliveryHistoryReplay?.sanitizedPayloadPreview?.discordTemplate)
expect(deliveryHistoryRetry?.retry.retryable === true && deliveryHistoryRetry.retry.nextRetryAt === '2026-06-28T12:11:00.000Z', 'Delivery history should expose retry/backoff state.', deliveryHistoryRetry)
expect(deliveryHistoryTerminal?.retry.terminalFailure === true && deliveryHistoryTerminal.retry.lastErrorCategory === 'upstream_4xx', 'Delivery history should expose terminal failure state.', deliveryHistoryTerminal)
expect(deliveryHistoryMissingDestination?.destination.availability.state === 'missing_destination' && deliveryHistoryMissingDestination.destination.availability.setupRoute === 'POST /api/dwm/webhooks', 'Delivery history should expose setup guidance for missing webhook destination attempts.', deliveryHistoryMissingDestination)
expect(deliveryHistoryMissingDestination?.sanitizedPayloadPreview?.context.watchlistId === 'watchlist_item_replay_contract' && deliveryHistoryMissingDestination.deliveryProof.auditEventId === 'audit_missing_destination_contract', 'Missing destination history should preserve sanitized Discord preview and audit proof.', deliveryHistoryMissingDestination)
expect(!JSON.stringify(deliveryHistory).includes(secret), 'Delivery history should not leak endpoint, response, or payload secrets.', deliveryHistory)
expect(deliveryHistoryConsumer.schemaVersion === 'dwm.webhook.delivery_history_consumer.v1' && deliveryHistoryConsumer.counts.total >= 1 && deliveryHistoryConsumer.routes.detail.includes('delivery_id'), 'Delivery history consumer proof should expose stable list/detail routes.', deliveryHistoryConsumer)
expect(deliveryHistoryConsumer.routeContract.detail.requiredQuery.join(',') === 'orgId,deliveryId' && deliveryHistoryConsumer.routeContract.retryDryRun.noNetworkDefault === true, 'Delivery history consumer proof should define list/detail/retry route contracts.', deliveryHistoryConsumer.routeContract)
expect(deliveryHistoryConsumerReplay?.redactedDestination.endpointExposed === false && deliveryHistoryConsumerReplay.redactedDestination.endpointHash === 'endpoint_replay_hash', 'Delivery history consumer proof should expose redacted destination metadata.', deliveryHistoryConsumerReplay?.redactedDestination)
expect(deliveryHistoryConsumerReplay?.alert.caseActionPath === replayWorkflowAlert.caseActionPath, 'Delivery history consumer proof should expose case action replay path.', deliveryHistoryConsumerReplay?.alert)
expect(deliveryHistoryConsumerReplay?.discord.fieldNames.includes('Alert URL') && deliveryHistoryConsumerReplay.discord.safeForCustomerDisplay === true, 'Delivery history consumer proof should expose Discord-safe preview fields.', deliveryHistoryConsumerReplay?.discord)
expect(deliveryHistoryConsumerReplay?.discord.template?.templateId === 'dwm.discord.alert_replay.v1' && deliveryHistoryConsumerReplay.discord.template.redaction.webhookSecretExposed === false, 'Delivery history consumer proof should expose redacted Discord template summaries.', deliveryHistoryConsumerReplay?.discord.template)
expect(deliveryHistoryConsumerReplay?.audit.auditEventId === 'audit_replay_duplicate_contract' && deliveryHistoryConsumerReplay.idempotency.duplicateAttemptCount === 2 && deliveryHistoryConsumerReplay.replayHistory.duplicateReplay === true, 'Delivery history consumer proof should expose audit and replay idempotency proof.', deliveryHistoryConsumerReplay)
expect(deliveryHistoryConsumerReplay?.routes.deliveryDetail?.includes('delivery_replay_duplicate_contract') && deliveryHistoryConsumerReplay.routes.destinationTest === 'POST /api/dwm/webhook-destinations/destination_replay_contract/test', 'Delivery history consumer proof should expose customer operation routes.', deliveryHistoryConsumerReplay?.routes)
expect(deliveryHistoryConsumer.routeContract.list.optionalQuery.includes('action') && deliveryHistoryConsumer.routeContract.list.optionalQuery.includes('timeFrom') && deliveryHistoryConsumer.routeContract.list.optionalQuery.includes('retryState') && deliveryHistoryConsumer.routeContract.list.optionalQuery.includes('actorId') && deliveryHistoryConsumer.routeContract.list.optionalQuery.includes('idempotencyKey'), 'Delivery history consumer proof should advertise operational filters.', deliveryHistoryConsumer.routeContract.list.optionalQuery)
expect(!JSON.stringify(deliveryHistoryConsumer).includes(secret), 'Delivery history consumer proof should redact endpoint, response, and payload secrets.', deliveryHistoryConsumer)
expect(deliveryPersistenceProof.schemaVersion === 'dwm.webhook.delivery_persistence_proof.v1' && deliveryPersistenceProof.ok === true && deliveryPersistenceProof.totals.rows === deliveryHistory.total, 'Delivery persistence proof should summarize persisted delivery history rows.', deliveryPersistenceProof)
expect(deliveryPersistenceReplay?.sanitizedPayloadPreview?.context.casePath === replayWorkflowAlert.casePath && deliveryPersistenceReplay.audit.auditEventId === 'audit_replay_duplicate_contract', 'Delivery persistence proof should preserve replay case context and audit linkage.', deliveryPersistenceReplay)
expect(deliveryPersistenceRetry?.retry.retryable === true && deliveryPersistenceRetry.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && deliveryPersistenceRetry.retry.lastErrorCategory === 'upstream_5xx', 'Delivery persistence proof should preserve retry/backoff metadata.', deliveryPersistenceRetry)
expect(deliveryPersistenceProof.totals.retryScheduled >= 1 && deliveryPersistenceProof.audit.auditEventIds.includes('audit_replay_duplicate_contract'), 'Delivery persistence proof should roll up retry and audit ids.', deliveryPersistenceProof)
expect(deliveryPersistenceReplay?.actionRequests.deliveryHistory.query.alertId === 'alert_replay_contract' && deliveryPersistenceReplay.actionRequests.deliveryHistory.query.dedupeKey === 'dwm_dedupe_replay_contract', 'Delivery persistence proof should expose alert-scoped history query hints.', deliveryPersistenceReplay?.actionRequests.deliveryHistory)
expect(deliveryPersistenceReplay?.actionRequests.dryRunReplay.canSend === true && deliveryPersistenceReplay.actionRequests.dryRunReplay.body?.dryRun === true && deliveryPersistenceReplay.actionRequests.dryRunReplay.body.destinationId === 'destination_replay_contract', 'Delivery persistence proof should expose a no-network dry-run replay request.', deliveryPersistenceReplay?.actionRequests.dryRunReplay)
expect(deliveryPersistenceReplay?.watchlistId === 'watchlist_item_replay_contract' && deliveryPersistenceReplay.actionRequests.dryRunReplay.body?.watchlistName === 'Replay contract watchlist', 'Delivery persistence proof should preserve watchlist refs in replay bodies.', deliveryPersistenceReplay)
expect(deliveryPersistenceReplay?.actionRequests.dryRunReplay.body?.caseActionId === replayWorkflowAlert.caseActionId && deliveryPersistenceReplay.actionRequests.deliveryHistory.query.caseActionPath === replayWorkflowAlert.caseActionPath, 'Delivery persistence proof should preserve case-action replay context in requests and history queries.', deliveryPersistenceReplay?.actionRequests)
expect(deliveryPersistenceReplay?.actionRequests.liveReplay.canSend === false && deliveryPersistenceReplay.actionRequests.liveReplay.blockers.some(item => item.code === 'live_delivery_disabled'), 'Delivery persistence proof should keep live replay blocked unless explicitly enabled.', deliveryPersistenceReplay?.actionRequests.liveReplay)
expect(deliveryPersistenceRetry?.actionRequests.dryRunReplay.body?.casePath === '/v1/cases/case_live_contract?alertId=alert_live_contract&dedupeKey=dwm_dedupe_live_contract' && deliveryPersistenceRetry.actionRequests.dryRunReplay.expectedAuditAction === 'delivery.replayed', 'Delivery persistence replay request should preserve retry row case path and audit action.', deliveryPersistenceRetry?.actionRequests.dryRunReplay)
expect(emptyDeliveryPersistenceProof.ok === false && emptyDeliveryPersistenceProof.blockers.some(item => item.code === 'missing_delivery_attempt'), 'Delivery persistence proof should block clearly when no attempts match filters.', emptyDeliveryPersistenceProof)
expect(!JSON.stringify(deliveryPersistenceProof).includes(secret), 'Delivery persistence proof should redact endpoint, response, and payload secrets.', deliveryPersistenceProof)
expect(deliveryAttemptPersistenceRead.schemaVersion === 'dwm.webhook.delivery_attempt_persistence_read.v1' && deliveryAttemptPersistenceRead.total >= 1 && deliveryAttemptPersistenceRead.counts.auditLinked >= 1, 'Delivery attempt persistence read model should summarize persisted attempts for history consumers.', deliveryAttemptPersistenceRead)
expect(deliveryAttemptPersistenceReadReplay?.sanitizedPayloadPreview?.discord.fieldNames.includes('Alert URL') && deliveryAttemptPersistenceReadReplay.audit.auditEventId === 'audit_replay_duplicate_contract', 'Delivery attempt persistence read model should expose Discord preview and audit linkage.', deliveryAttemptPersistenceReadReplay)
expect(deliveryAttemptPersistenceReadReplay?.actionRequests.dryRunReplay.body?.dryRun === true && deliveryAttemptPersistenceReadReplay.actionRequests.liveReplay.blockers.some(item => item.code === 'live_delivery_disabled'), 'Delivery attempt persistence read model should expose dry-run replay and live-disabled blockers.', deliveryAttemptPersistenceReadReplay?.actionRequests)
expect(deliveryAttemptPersistenceReadReplay?.actionRequests.deliveryHistory.query.watchlistId === 'watchlist_item_replay_contract' && deliveryAttemptPersistenceReadReplay.actionRequests.deliveryHistory.query.caseActionPath === replayWorkflowAlert.caseActionPath, 'Delivery attempt persistence read model should expose watchlist and case-action history filters.', deliveryAttemptPersistenceReadReplay?.actionRequests.deliveryHistory)
expect(deliveryAttemptPersistenceReadReplay?.redactedDestination.endpointExposed === false && deliveryAttemptPersistenceReadReplay.redactedDestination.label === 'Replay Discord', 'Delivery attempt persistence read model should expose redacted destination labels only.', deliveryAttemptPersistenceReadReplay?.redactedDestination)
expect(deliveryAttemptPersistenceReadReplay?.idempotency.duplicate === true && deliveryAttemptPersistenceReadReplay.idempotency.duplicateAttemptCount === 2 && deliveryAttemptPersistenceReadReplay.replayHistory.duplicateReplay === true, 'Delivery attempt persistence read model should expose duplicate replay idempotency history.', deliveryAttemptPersistenceReadReplay)
expect(!JSON.stringify(deliveryAttemptPersistenceRead).includes(secret), 'Delivery attempt persistence read model should not leak endpoint or payload secrets.', deliveryAttemptPersistenceRead)
expect(duplicateReplayGuardHistory.total === 2 && duplicateReplayGuardSkipped?.status === 'skipped', 'Delivery history should expose duplicate replay live-send guard skipped attempts.', duplicateReplayGuardHistory)
expect(duplicateReplayGuardSkipped?.deliveryProof.auditEventId === 'audit_duplicate_replay_skipped_contract' && duplicateReplayGuardSkipped.dedupe.alreadyDelivered === true, 'Duplicate replay guard should link skipped audit and prior delivered idempotency proof.', duplicateReplayGuardSkipped)
expect(duplicateReplayGuardDelivered?.status === 'sent' && duplicateReplayGuardDelivered.dedupe.alreadyDelivered === true, 'Duplicate replay guard should preserve the prior delivered attempt.', duplicateReplayGuardDelivered)
expect(!JSON.stringify(duplicateReplayGuardHistory).includes(secret), 'Duplicate replay guard history should redact endpoint secrets.', duplicateReplayGuardHistory)
expect(deliveryReceipts.schemaVersion === 'dwm.webhook.delivery_receipts.v1' && deliveryReceipts.counts.total === deliveryHistory.total, 'Delivery receipts should provide a stable proof contract for delivery attempts.', deliveryReceipts)
expect(deliveryReceiptReplay?.proof.auditEventId === 'audit_replay_duplicate_contract' && deliveryReceiptReplay.proof.noNetwork === true, 'Delivery receipts should link replay delivery proof and preserve no-network dry-run status.', deliveryReceiptReplay)
expect(deliveryReceiptReplay?.discordPreview?.fieldNames.includes('Workflow') && deliveryReceiptReplay.discordPreview.fieldNames.includes('Alert URL') && deliveryReceiptReplay.casePath === replayWorkflowAlert.casePath, 'Delivery receipts should carry Discord preview and case/deep-link context.', deliveryReceiptReplay)
expect(deliveryReceiptReplay?.sanitizedPayloadPreview?.schemaVersion === 'dwm.webhook.sanitized_payload_preview.v1' && deliveryReceiptReplay.sanitizedPayloadPreview.context.alertId === 'alert_replay_contract', 'Delivery receipts should carry the sanitized payload preview proof for customer-safe history.', deliveryReceiptReplay)
expect(deliveryReceiptReplay?.sanitizedPayloadPreview?.discordTemplate?.templateId === 'dwm.discord.alert_replay.v1' && deliveryReceiptReplay.sanitizedPayloadPreview.discordTemplate.redaction.endpointExposed === false, 'Delivery receipts should carry redacted Discord template proof for replay inspection.', deliveryReceiptReplay?.sanitizedPayloadPreview?.discordTemplate)
expect(deliveryReceiptReplay?.proof.updatedAt === '2026-06-28T12:08:05.000Z', 'Delivery receipts should expose persisted delivery updated timestamp.', deliveryReceiptReplay?.proof)
expect(deliveryReceiptReplay?.operationLinks?.deliveryDetail.includes('delivery_replay_duplicate_contract') && deliveryReceiptReplay.operationLinks.destinationTest === 'POST /api/dwm/webhook-destinations/destination_replay_contract/test', 'Delivery receipts should expose stable operation links for customer support and retry proof.', deliveryReceiptReplay)
expect(deliveryReceiptReplay?.operationLinks?.destinationArchive === 'DELETE /api/dwm/webhook-destinations/destination_replay_contract', 'Delivery receipts should expose destination archive/delete remediation links.', deliveryReceiptReplay?.operationLinks)
expect(deliveryReceiptRetry?.retry.retryable === true && deliveryReceiptRetry.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && deliveryReceiptRetry.blockers.some(item => item.code === 'retry_scheduled'), 'Delivery receipts should expose retry/backoff blockers and next retry.', deliveryReceiptRetry)
expect(deliveryReceiptRetry?.transitionReceipt.schemaVersion === 'dwm.webhook.delivery_transition_receipt.v1' && deliveryReceiptRetry.transitionReceipt.state.next === 'dry_run_retry_ready', 'Delivery transition receipts should expose retry/backoff state transitions.', deliveryReceiptRetry?.transitionReceipt)
expect(deliveryReceiptRetry?.transitionReceipt.requests.dryRunRetry.canSend === true && deliveryReceiptRetry.transitionReceipt.requests.dryRunRetry.body?.casePath === '/v1/cases/case_live_contract?alertId=alert_live_contract&dedupeKey=dwm_dedupe_live_contract', 'Delivery transition receipts should build no-network dry-run retry bodies with case context.', deliveryReceiptRetry?.transitionReceipt.requests.dryRunRetry)
expect(deliveryReceiptRetry?.transitionReceipt.requests.liveRetry.canSend === false && deliveryReceiptRetry.transitionReceipt.requests.liveRetry.blockers.some(item => item.code === 'live_delivery_disabled'), 'Delivery transition receipts should block live retry when live sends are not configured.', deliveryReceiptRetry?.transitionReceipt.requests.liveRetry)
expect(deliveryReceiptRetry?.transitionReceipt.redactedTarget.endpointExposed === false && deliveryReceiptRetry.transitionReceipt.audit.auditEventIds.includes('audit_live_retry_contract'), 'Delivery transition receipts should carry redacted destination and audit ids.', deliveryReceiptRetry?.transitionReceipt)
expect(Boolean(deliveryReceiptRetry?.transitionReceipt.watchlist.term) && Boolean(deliveryReceiptRetry?.transitionReceipt.workflow.routeUrl), 'Delivery transition receipts should carry watchlist and route URL context.', deliveryReceiptRetry?.transitionReceipt)
expect(deliveryReceiptReplay?.transitionReceipt.provenance.captureIds.includes('capture_replay_contract') && deliveryReceiptReplay.transitionReceipt.provenance.sourceIds.includes('source_replay_contract'), 'Delivery transition receipts should carry alert provenance ids.', deliveryReceiptReplay?.transitionReceipt.provenance)
expect(deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.schemaVersion === 'dwm.webhook.case_action_dry_run_receipt.v1' && deliveryReceiptRetry.transitionReceipt.caseActionDryRunReceipt.ready === true && deliveryReceiptRetry.transitionReceipt.caseActionDryRunReceipt.actionRequest.body?.casePath === '/v1/cases/case_live_contract?alertId=alert_live_contract&dedupeKey=dwm_dedupe_live_contract', 'Delivery transition receipts should expose case action dry-run retry receipts.', deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt)
expect(deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.workflow.replay === true && deliveryReceiptReplay.transitionReceipt.caseActionDryRunReceipt.payloadPreview?.context.casePath === replayWorkflowAlert.casePath && deliveryReceiptReplay.transitionReceipt.caseActionDryRunReceipt.audit.auditEventId === 'audit_replay_duplicate_contract', 'Case action dry-run receipts should preserve replay, case, and audit context.', deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt)
expect(deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.consumesSchemaVersion === 'dwm.case_action_replay_export.v1' && deliveryReceiptReplay.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.route.includes('/v1/cases/case_replay_contract/action-replay-export'), 'Case action dry-run receipts should expose case replay export consumer routes.', deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer)
expect(deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.webhookContext.dedupeKey === 'dwm_dedupe_replay_contract' && deliveryReceiptReplay.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.webhookContext.auditEventId === 'audit_replay_duplicate_contract', 'Case replay export consumers should carry webhook dedupe and audit context.', deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer)
expect(deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.deliveryState.retryable === true && deliveryReceiptRetry.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.deliveryState.nextRetryAt === '2026-06-28T12:11:00.000Z', 'Case replay export consumers should carry retry/backoff state.', deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer)
expect(deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.consumesSchemaVersion === 'dwm.alert_source_handoff_readiness.v1' && deliveryReceiptReplay.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.ready === true, 'Case action dry-run receipts should expose alert source handoff readiness consumers.', deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer)
expect(deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.alert.provenanceCaptureIds.includes('capture_replay_contract') && deliveryReceiptReplay.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.alert.provenanceSourceIds.includes('source_replay_contract'), 'Source handoff consumers should carry alert provenance ids.', deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer)
expect(deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.webhookConsumer.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && deliveryReceiptRetry.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.webhookConsumer.deliveryDedupeKey === 'dwm_dedupe_live_contract', 'Source handoff consumers should expose retry/backoff and dedupe state.', deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer)
expect(deliveryReceiptMissingDestination?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.state === 'delivery_handoff_gap' && deliveryReceiptMissingDestination.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.webhookConsumer.blockerCodes.includes('destination_unavailable'), 'Source handoff consumers should expose missing destination delivery blockers.', deliveryReceiptMissingDestination?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer)
expect(deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.supportRecoveryBridge.schemaVersion === 'organization.member_recovery_support_history_bridge.v1' && deliveryReceiptRetry.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.supportRecoveryBridge.noSilentMembershipMutation === true, 'Source handoff consumers should carry org recovery support-history bridge fields.', deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.supportRecoveryBridge)
expect(deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.schemaVersion === 'organization.webhook_destination_readiness_bridge.v1' && deliveryReceiptReplay.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.selectedDestination?.id === 'destination_replay_contract', 'Source handoff consumers should expose org destination readiness bridge selection.', deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge)
expect(deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.selectedDestination?.endpointExposed === false && deliveryReceiptReplay.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.expectedDeliveryFields.includes('payload.alert.organizationId'), 'Org destination readiness bridge should keep destination redacted and expose delivery fields.', deliveryReceiptReplay?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge)
expect(deliveryReceiptMissingDestination?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.ready === false && deliveryReceiptMissingDestination.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.blockerCodes.includes('destination_unavailable'), 'Org destination readiness bridge should expose missing destination blockers.', deliveryReceiptMissingDestination?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge)
expect(deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && deliveryReceiptRetry.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.idempotency.dedupeKey === 'dwm_dedupe_live_contract', 'Org destination readiness bridge should preserve retry and idempotency state.', deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge)
expect(deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.redaction.webhookSecretExposed === false, 'Source handoff consumers should keep webhook secrets redacted.', deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer)
expect(deliveryReceiptTerminal?.transitionReceipt.caseActionDryRunReceipt.ready === false && deliveryReceiptTerminal.transitionReceipt.caseActionDryRunReceipt.denial.blockingCodes.includes('terminal_failure'), 'Case action dry-run receipts should block terminal failures.', deliveryReceiptTerminal?.transitionReceipt.caseActionDryRunReceipt)
expect(deliveryReceiptMissingDestination?.transitionReceipt.caseActionDryRunReceipt.ready === false && deliveryReceiptMissingDestination.transitionReceipt.caseActionDryRunReceipt.denial.blockingCodes.includes('destination_unavailable'), 'Case action dry-run receipts should block missing destinations.', deliveryReceiptMissingDestination?.transitionReceipt.caseActionDryRunReceipt)
expect(deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.destination.endpointExposed === false && deliveryReceiptRetry.transitionReceipt.caseActionDryRunReceipt.payloadPreview?.redaction.endpointExposed === false, 'Case action dry-run receipts should keep endpoint and payload previews redacted.', deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt)
expect(deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.redaction.webhookSecretExposed === false, 'Case replay export consumers should keep webhook secrets redacted.', deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer)
expect(!JSON.stringify(deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt).includes(secret), 'Case action dry-run receipts should not leak endpoint secrets.', deliveryReceiptRetry?.transitionReceipt.caseActionDryRunReceipt)
expect(deliveryReceiptTerminal?.retry.terminalFailure === true && deliveryReceiptTerminal.blockers.some(item => item.code === 'terminal_failure'), 'Delivery receipts should expose terminal failure blockers.', deliveryReceiptTerminal)
expect(deliveryReceiptTerminal?.transitionReceipt.state.next === 'terminal_failure' && deliveryReceiptTerminal.transitionReceipt.requests.dryRunRetry.canSend === false, 'Delivery transition receipts should block terminal failure retries.', deliveryReceiptTerminal?.transitionReceipt)
expect(deliveryReceiptMissingDestination?.destination.availability.code === 'destination_unavailable' && deliveryReceiptMissingDestination.blockers.some(item => item.code === 'destination_unavailable'), 'Delivery receipts should expose typed blockers for missing destination outcomes.', deliveryReceiptMissingDestination)
expect(deliveryReceiptMissingDestination?.transitionReceipt.state.next === 'destination_unavailable' && deliveryReceiptMissingDestination.transitionReceipt.denial.blockingCodes.includes('destination_unavailable'), 'Delivery transition receipts should expose missing destination denial state.', deliveryReceiptMissingDestination?.transitionReceipt)
expect(deliveryReceiptMissingDestination?.operationLinks.destinationTest === null && deliveryReceiptMissingDestination.operationLinks.destinationArchive === null && deliveryReceiptMissingDestination.operationLinks.deliveryHistory.includes('alert_missing_destination_contract'), 'Missing destination receipts should avoid fake destination remediation links and keep alert-scoped history links.', deliveryReceiptMissingDestination)
expect(deliveryReceipts.counts.auditLinked >= 1 && deliveryReceipts.access.canRetry === true && deliveryReceipts.noNetwork === true, 'Delivery receipts should expose audit/read access and no-network semantics.', deliveryReceipts)
expect(nonmemberDeliveryReceipts.receipts.length === 0 && nonmemberDeliveryReceipts.blockers.some(item => item.code === 'permission_denied'), 'Delivery receipts should deny nonmembers without leaking transition receipts.', nonmemberDeliveryReceipts)
expect(deliveryReceipts.historyReplayFilters.schemaVersion === 'dwm.webhook.delivery_receipt_history_filters.v1' && deliveryReceipts.historyReplayFilters.routeContract.replayHistory.requiredQuery.includes('dedupeKey'), 'Delivery receipt filters should expose replay/history route contracts.', deliveryReceipts.historyReplayFilters)
expect(deliveryReceipts.historyReplayFilters.routeContract.list.optionalQuery.includes('action') && deliveryReceipts.historyReplayFilters.routeContract.list.optionalQuery.includes('timeTo') && deliveryReceipts.historyReplayFilters.routeContract.list.optionalQuery.includes('retryState') && deliveryReceipts.historyReplayFilters.routeContract.list.optionalQuery.includes('actorId') && deliveryReceipts.historyReplayFilters.routeContract.list.optionalQuery.includes('idempotencyKey') && deliveryReceipts.historyReplayFilters.routeContract.list.optionalQuery.includes('caseActionId') && deliveryReceipts.historyReplayFilters.routeContract.list.optionalQuery.includes('caseActionPath'), 'Delivery receipt filters should advertise action/status/time/retry/actor/case-action query keys.', deliveryReceipts.historyReplayFilters.routeContract.list.optionalQuery)
expect(deliveryReceipts.historyReplayFilters.rows.some(item => item.deliveryId === 'delivery_replay_duplicate_contract' && item.queryKeys.byDedupe?.dedupeKey === 'dwm_dedupe_replay_contract'), 'Delivery receipt filters should expose replay/dedupe query keys.', deliveryReceipts.historyReplayFilters.rows)
expect(deliveryReceipts.historyReplayFilters.rows.some(item => item.casePath === replayWorkflowAlert.casePath && item.queryKeys.byCase?.casePath === replayWorkflowAlert.casePath), 'Delivery receipt filters should expose case-path query keys.', deliveryReceipts.historyReplayFilters.rows)
expect(deliveryReceipts.historyReplayFilters.rows.some(item => item.caseActionId === replayWorkflowAlert.caseActionId && item.queryKeys.byCaseAction?.caseActionPath === replayWorkflowAlert.caseActionPath), 'Delivery receipt filters should expose case-action replay query keys.', deliveryReceipts.historyReplayFilters.rows)
expect(deliveryReceipts.historyReplayFilters.queryPresets.latestCaseActionReplay?.caseActionId === replayWorkflowAlert.caseActionId, 'Delivery receipt filters should expose latest case-action replay preset.', deliveryReceipts.historyReplayFilters.queryPresets)
expect(deliveryReceipts.historyReplayFilters.queryPresets.missingDestination?.alertId === 'alert_missing_destination_contract' && deliveryReceipts.historyReplayFilters.counts.missingDestination >= 1, 'Delivery receipt filters should expose missing-destination history presets.', deliveryReceipts.historyReplayFilters)
expect(deliveryReceipts.historyReplayFilters.queryPresets.retryable?.dedupeKey === 'dwm_dedupe_live_contract' && deliveryReceipts.historyReplayFilters.counts.retryable >= 1, 'Delivery receipt filters should expose retry/backoff history presets.', deliveryReceipts.historyReplayFilters)
expect(deliveryReceipts.historyReplayFilters.rows.some(item => item.redactedTarget.endpointExposed === false && item.auditEventIds.length > 0 && item.idempotency.key), 'Delivery receipt filters should carry redacted target, audit, and idempotency proof.', deliveryReceipts.historyReplayFilters.rows)
expect(nonmemberDeliveryReceipts.historyReplayFilters.rows.length === 0 && nonmemberDeliveryReceipts.historyReplayFilters.blockers.some(item => item.code === 'permission_denied'), 'Delivery receipt filters should deny nonmembers without history leakage.', nonmemberDeliveryReceipts.historyReplayFilters)
expect(!JSON.stringify(deliveryReceipts.historyReplayFilters).includes(secret), 'Delivery receipt filters should redact endpoint and payload secrets.', deliveryReceipts.historyReplayFilters)
expect(!JSON.stringify(deliveryReceipts).includes(secret), 'Delivery receipts should redact endpoint, response, and payload secrets.', deliveryReceipts)
expect(deliveryTimeline.schemaVersion === 'dwm.webhook.delivery_timeline.v1' && deliveryTimeline.counts.receipts === deliveryReceipts.counts.total, 'Delivery timeline should group delivery receipts for customer history.', deliveryTimeline)
expect(deliveryTimelineReplay?.latestReceipt.discordPreview?.fieldNames.includes('Alert URL') && deliveryTimelineReplay.auditEventIds.includes('audit_replay_duplicate_contract'), 'Delivery timeline should preserve Discord preview and audit proof for replayed alerts.', deliveryTimelineReplay)
expect(deliveryTimelineReplay?.watchlist.id === 'watchlist_item_replay_contract' && deliveryTimelineReplay.casePath === replayWorkflowAlert.casePath, 'Delivery timeline should keep watchlist and case context.', deliveryTimelineReplay)
expect(deliveryTimelineReplay?.latestReceipt.proof.updatedAt === '2026-06-28T12:08:05.000Z', 'Delivery timeline should carry latest receipt updated timestamp.', deliveryTimelineReplay?.latestReceipt)
expect(deliveryTimelineReplay?.operationLinks?.deliveryHistory.includes('destination_replay_contract') && deliveryTimelineReplay.operationLinks.destinationTest === 'POST /api/dwm/webhook-destinations/destination_replay_contract/test', 'Delivery timeline should expose stable operation links without requiring consumers to inspect receipt internals.', deliveryTimelineReplay)
expect(deliveryTimelineRetry?.status === 'retry_scheduled' && deliveryTimelineRetry.retry.nextRetryAt === '2026-06-28T12:11:00.000Z' && deliveryTimelineRetry.blockers.some(item => item.code === 'retry_scheduled'), 'Delivery timeline should expose retry/backoff state by alert.', deliveryTimelineRetry)
expect(deliveryTimelineTerminal?.status === 'terminal_failure' && deliveryTimelineTerminal.retry.terminalFailure === true, 'Delivery timeline should expose terminal failure state by alert.', deliveryTimelineTerminal)
expect(deliveryTimelineMissingDestination?.status === 'skipped' && deliveryTimelineMissingDestination.blockingCodes.includes('destination_unavailable'), 'Delivery timeline should roll up missing destination outcomes as blocked skipped attempts.', deliveryTimelineMissingDestination)
expect(foreignDeliveryTimeline.timelines.length === 1 && foreignDeliveryTimeline.timelines.every(item => item.orgId === 'org_foreign'), 'Delivery timeline org filter should not leak another org delivery history.', foreignDeliveryTimeline)
expect(nonmemberDeliveryTimeline.timelines.length === 0 && nonmemberDeliveryTimeline.blockers.some(item => item.code === 'permission_denied'), 'Delivery timeline should deny nonmembers without delivery history leakage.', nonmemberDeliveryTimeline)
expect(orgAlertDeliveryContract.deliveryTimeline.schemaVersion === 'dwm.webhook.delivery_timeline.v1' && orgAlertDeliveryContract.deliveryTimeline.timelines.some(item => item.alertId === 'alert_replay_contract'), 'Org alert delivery contract should include alert-scoped delivery timeline.', orgAlertDeliveryContract.deliveryTimeline)
expect(!JSON.stringify(deliveryTimeline).includes(secret), 'Delivery timeline should redact endpoint, response, and payload secrets.', deliveryTimeline)
expect(deliveryActionPlan.schemaVersion === 'dwm.webhook.delivery_action_plan.v1' && deliveryActionPlan.noNetwork === true, 'Delivery action plan should expose safe next steps without network sends.', deliveryActionPlan)
expect(deliveryActionRetry?.action === 'retry_dry_run' && deliveryActionRetry.requests.dryRunRetry?.canSend === true && deliveryActionRetry.requests.dryRunRetry.body.dedupeKey === 'dwm_dedupe_live_contract', 'Delivery action plan should build dry-run retry actions for retryable failures.', deliveryActionRetry)
expect(deliveryActionRetry?.requests.liveRetry?.canSend === false && deliveryActionRetry.requests.liveRetry.blockers.some(item => item.code === 'live_delivery_disabled'), 'Delivery action plan should block live retry unless live delivery is configured.', deliveryActionRetry)
expect(deliveryActionRetry?.requests.testDestination?.route === 'POST /api/dwm/webhook-destinations/destination_live_contract/test' && deliveryActionRetry.requests.testDestination.noNetwork === true && deliveryActionRetry.requests.testDestination.body.eventType === 'dwm.alert.test', 'Delivery action plan should include a no-network destination test request for retry validation.', deliveryActionRetry?.requests.testDestination)
expect(deliveryActionRetry?.requests.testDestination?.payloadPreview?.schemaVersion === 'dwm.webhook.destination_test_payload_preview.v1' && deliveryActionRetry.requests.testDestination.payloadPreview.discord.fieldNames.includes('Watchlist') && deliveryActionRetry.requests.testDestination.payloadPreview.redaction.safeForCustomerDisplay === true, 'Delivery action plan destination test request should expose a no-network Discord payload preview for customer validation.', deliveryActionRetry?.requests.testDestination?.payloadPreview)
expect(deliveryActionRetry?.operationLinks?.retryDryRun === 'POST /api/dwm/webhook-deliveries' && deliveryActionRetry.operationLinks.deliveryDetail.includes('delivery_live_failed_retry_contract'), 'Delivery action plan should expose operation links for dry-run retry and delivery detail.', deliveryActionRetry)
expect(deliveryActionRetry?.remediation?.schemaVersion === 'dwm.webhook.delivery_remediation.v1' && deliveryActionRetry.remediation.code === 'retry_dry_run' && deliveryActionRetry.remediation.readiness.dryRunReplayReady === true && deliveryActionRetry.remediation.redaction.webhookSecretExposed === false, 'Delivery action plan should expose typed retry remediation guidance without secrets.', deliveryActionRetry?.remediation)
expect(deliveryActionTerminal?.action === 'rotate_or_disable_destination' && deliveryActionTerminal.audit.nextAction === 'destination.update_requested', 'Delivery action plan should guide terminal failures to destination remediation.', deliveryActionTerminal)
expect(deliveryActionTerminal?.remediation?.code === 'rotate_or_disable_destination' && deliveryActionTerminal.remediation.priority === 'high' && deliveryActionTerminal.remediation.readiness.terminalFailure === true, 'Delivery action plan should expose terminal-failure remediation state.', deliveryActionTerminal?.remediation)
expect(deliveryActionTerminal?.requests.testDestination?.body.destinationId === 'destination_terminal_contract' && deliveryActionTerminal.requests.testDestination.body.alertId === 'alert_terminal_contract' && deliveryActionTerminal.requests.testDestination.body.dedupeKey === 'dwm_dedupe_terminal_contract' && Boolean(deliveryActionTerminal.requests.testDestination.body.casePath), 'Delivery action plan should preserve terminal-failure alert, dedupe, and case context in destination test requests.', deliveryActionTerminal?.requests.testDestination)
expect(deliveryActionTerminal?.requests.testDestination?.payloadPreview?.redaction.endpointExposed === false && deliveryActionTerminal.requests.testDestination.payloadPreview.discord.fieldNames.some(name => name.toLowerCase() === 'source family'), 'Delivery action plan terminal remediation test request should keep endpoint secrets hidden while showing Discord source context.', deliveryActionTerminal?.requests.testDestination?.payloadPreview)
expect(deliveryActionDelivered?.action === 'monitor' && deliveryActionDelivered.status === 'delivered', 'Delivery action plan should mark delivered attempts as monitor-only.', deliveryActionDelivered)
expect(deliveryActionDelivered?.remediation?.code === 'monitor_delivery' && deliveryActionDelivered.remediation.status === 'resolved', 'Delivery action plan should expose resolved delivery monitoring guidance.', deliveryActionDelivered?.remediation)
expect(deliveryActionMissingDestination?.action === 'configure_destination' && deliveryActionMissingDestination.blockers.some(item => item.code === 'destination_unavailable'), 'Delivery action plan should route missing destination outcomes to destination setup.', deliveryActionMissingDestination)
expect(deliveryActionMissingDestination?.remediation?.code === 'configure_destination' && deliveryActionMissingDestination.remediation.readiness.destinationUnavailable === true && deliveryActionMissingDestination.remediation.routeHints.destinationTest === null, 'Delivery action plan should expose missing-destination remediation without fake test routes.', deliveryActionMissingDestination?.remediation)
expect(nonmemberDeliveryActionPlan.actions.length === 0 && nonmemberDeliveryActionPlan.blockers.some(item => item.code === 'permission_denied'), 'Delivery action plan should deny nonmembers without leaking actions.', nonmemberDeliveryActionPlan)
expect(orgAlertDeliveryContract.deliveryActionPlan.schemaVersion === 'dwm.webhook.delivery_action_plan.v1' && orgAlertDeliveryContract.deliveryActionPlan.actions.some(item => item.alertId === 'alert_replay_contract'), 'Org alert delivery contract should include alert-scoped delivery action plan.', orgAlertDeliveryContract.deliveryActionPlan)
expect(!JSON.stringify(deliveryActionPlan).includes(secret), 'Delivery action plan should redact endpoint, response, and payload secrets.', deliveryActionPlan)
expect(deliveryReplayGuard.schemaVersion === 'dwm.webhook.delivery_replay_guard.v1' && deliveryReplayGuard.noNetwork === true, 'Delivery replay guard should expose no-network replay safety proof.', deliveryReplayGuard)
expect(replayGuardReplay?.guard.dryRunAllowed === true && replayGuardReplay.guard.liveAllowed === false && replayGuardReplay.blockers.some(item => item.code === 'live_delivery_disabled'), 'Delivery replay guard should allow dry-run replay while live delivery is disabled.', replayGuardReplay)
expect(replayGuardDelivered?.guard.duplicateLiveBlocked === true && replayGuardDelivered.blockers.some(item => item.code === 'dedupe_already_delivered'), 'Delivery replay guard should block duplicate live sends for already delivered keys.', replayGuardDelivered)
expect(replayGuardTerminal?.retry.terminalFailure === true && replayGuardTerminal.blockers.some(item => item.code === 'terminal_failure'), 'Delivery replay guard should surface terminal failure blockers before replay.', replayGuardTerminal)
expect(replayGuardReplay?.latestReceipt?.discordPreview?.fieldNames.includes('Alert URL') && replayGuardReplay.audit.auditEventIds.includes('audit_replay_duplicate_contract'), 'Delivery replay guard should keep latest Discord proof and audit linkage.', replayGuardReplay)
expect(replayGuardReplay?.latestReceipt?.proof.updatedAt === '2026-06-28T12:08:05.000Z', 'Delivery replay guard should preserve latest receipt updated timestamp.', replayGuardReplay?.latestReceipt)
expect(nonmemberDeliveryReplayGuard.entries.length === 0 && nonmemberDeliveryReplayGuard.blockers.some(item => item.code === 'permission_denied'), 'Delivery replay guard should deny nonmembers without leaking replay keys.', nonmemberDeliveryReplayGuard)
expect(orgAlertDeliveryContract.deliveryReplayGuard.schemaVersion === 'dwm.webhook.delivery_replay_guard.v1' && orgAlertDeliveryContract.deliveryReplayGuard.entries.some(item => item.alertId === 'alert_replay_contract'), 'Org alert delivery contract should include alert-scoped replay guard.', orgAlertDeliveryContract.deliveryReplayGuard)
expect(!JSON.stringify(deliveryReplayGuard).includes(secret), 'Delivery replay guard should redact endpoint, response, and payload secrets.', deliveryReplayGuard)
expect(deliveryReplayApi.schemaVersion === 'dwm.webhook.delivery_replay_api.v1' && deliveryReplayApi.noNetwork === true && deliveryReplayApi.counts.dryRunReady >= 1, 'Delivery replay API should expose no-network replay requests for delivery history.', deliveryReplayApi)
expect(deliveryReplayApiReplay?.dryRunReplay.canSend === true && deliveryReplayApiReplay.dryRunReplay.body?.destinationId === 'destination_replay_contract' && deliveryReplayApiReplay.dryRunReplay.body?.dedupeKey === 'dwm_dedupe_replay_contract', 'Delivery replay API should build an exact dry-run replay body.', deliveryReplayApiReplay?.dryRunReplay)
expect(deliveryReplayApiReplay?.watchlistId === 'watchlist_item_replay_contract' && deliveryReplayApiReplay.dryRunReplay.body?.watchlistName === 'Replay contract watchlist', 'Delivery replay API should preserve watchlist context for replay-from-history.', deliveryReplayApiReplay)
expect(deliveryReplayApiReplay?.caseActionId === replayWorkflowAlert.caseActionId && deliveryReplayApiReplay.dryRunReplay.body?.caseActionPath === replayWorkflowAlert.caseActionPath, 'Delivery replay API should preserve case-action context for replay-from-history.', deliveryReplayApiReplay)
expect(deliveryReplayApiReplay?.liveReplay.canSend === false && deliveryReplayApiReplay.liveReplay.blockers.some(item => item.code === 'live_delivery_disabled'), 'Delivery replay API should block live replay while live delivery is disabled.', deliveryReplayApiReplay?.liveReplay)
expect(deliveryReplayApiReplay?.latestAttempt.auditEventId === 'audit_replay_duplicate_contract' && deliveryReplayApiReplay.redactedDestination.endpointExposed === false, 'Delivery replay API should expose audit proof and redacted destination metadata.', deliveryReplayApiReplay)
expect(deliveryReplayApiReplay?.idempotency.duplicateAttemptCount === 2 && deliveryReplayApiReplay.replayHistory.replayAttemptCount === 2, 'Delivery replay API should expose duplicate idempotency and replay attempt history.', deliveryReplayApiReplay)
expect(nonmemberDeliveryReplayApi.requests.every(item => item.dryRunReplay.canSend === false) && nonmemberDeliveryReplayApi.blockers.some(item => item.code === 'permission_denied'), 'Delivery replay API should deny nonmembers without sending replay requests.', nonmemberDeliveryReplayApi)
expect(!JSON.stringify(deliveryReplayApi).includes(secret), 'Delivery replay API should redact endpoint, response, and payload secrets.', deliveryReplayApi)
expect(orgAlertDeliveryContract.customerSetup.schemaVersion === 'dwm.webhook.customer_setup.v1' && orgAlertDeliveryContract.customerSetup.routes.deliver === 'POST /api/dwm/webhook-deliveries', 'Org alert delivery contract should include customer setup proof for delivery routes.', orgAlertDeliveryContract.customerSetup)
expect(orgAlertDeliveryProof.schemaVersion === 'dwm.webhook.alert_delivery_proof.v1' && orgAlertDeliveryProof.alertId === 'alert_replay_contract' && orgAlertDeliveryProof.eventType === 'dwm.alert.replayed', 'Alert delivery proof should normalize replay alert context.', orgAlertDeliveryProof)
expect(orgAlertDeliveryProof.noNetwork === true && orgAlertDeliveryProof.externalSendEnabled === false && orgAlertDeliveryProof.status === 'blocked', 'Alert delivery proof should preserve dry-run/no-network state and blockers.', orgAlertDeliveryProof)
expect(orgAlertDeliveryProof.alertScopedStatus === 'blocked' && orgAlertDeliveryProof.delivery.recordedDeliveryStatus === 'recorded' && orgAlertDeliveryProof.delivery.recordedDestinationIds.includes('destination_replay_contract'), 'Alert delivery proof should expose recorded destination proof even when other selected destinations are pending.', orgAlertDeliveryProof.delivery)
expect(!orgAlertDeliveryProof.alertScopedBlockerCodes.includes('terminal_failure') && orgAlertDeliveryProof.blockerGroups.setupBlockerCodes.includes('terminal_failure'), 'Alert delivery proof should separate selected-alert blockers from org-wide setup blockers.', orgAlertDeliveryProof.blockerGroups)
expect(orgAlertDeliveryProof.destinationSelection.selectedDestinationIds.includes('destination_replay_contract') && orgAlertDeliveryProof.destinationSelection.skippedDestinations.some(item => item.id === 'destination_disabled_contract'), 'Alert delivery proof should expose selected and skipped destinations.', orgAlertDeliveryProof.destinationSelection)
expect(orgAlertDeliveryProof.setup.summary.destinationCount === auditDestinationRows.length && orgAlertDeliveryProof.setup.stepStatuses.some(item => item.id === 'deliver_org_alert' && item.route === 'POST /api/dwm/webhook-deliveries'), 'Alert delivery proof should expose customer setup progress and routes.', orgAlertDeliveryProof.setup)
expect(orgAlertDeliveryProof.delivery.outcomeCounts.recorded >= 1 && orgAlertDeliveryProof.retryAndReplay.replayReadyCount >= 1 && orgAlertDeliveryProof.retryAndReplay.duplicateDeliveredCount === 0, 'Alert delivery proof should summarize scoped persisted delivery and replay guard state.', orgAlertDeliveryProof.retryAndReplay)
expect(orgAlertDeliveryProof.delivery.latestAuditEventIds.includes('audit_replay_duplicate_contract') && orgAlertDeliveryProof.blockerCodes.includes('terminal_failure'), 'Alert delivery proof should expose audit ids and typed blockers for probes.', orgAlertDeliveryProof)
expect(orgAlertDeliveryProof.dashboardProof.productProgress.schemaVersion === 'dwm.webhook.destination_admin_product_progress.v1' && orgAlertDeliveryProof.dashboardProof.deliveryRoute === 'POST /api/dwm/webhook-deliveries', 'Alert delivery proof should carry dashboard/integration readiness fields.', orgAlertDeliveryProof.dashboardProof)
const proofDryRunRequest = orgAlertDeliveryProof.actionRequests.dryRunDeliveries.find(item => item.destinationId === 'destination_replay_contract')
const proofLiveRequest = orgAlertDeliveryProof.actionRequests.liveDeliveries.find(item => item.destinationId === 'destination_replay_contract')
const proofTestRequest = orgAlertDeliveryProof.actionRequests.destinationTests.find(item => item.destinationId === 'destination_replay_contract')
const proofAlertEventReadiness = orgAlertDeliveryProof.actionRequests.alertEventReadiness
expect(proofDryRunRequest?.route === 'POST /api/dwm/webhook-deliveries' && proofDryRunRequest.noNetwork === true && proofDryRunRequest.body.dryRun === true && proofDryRunRequest.body.live === false, 'Alert delivery proof should include a safe dry-run delivery request.', proofDryRunRequest)
expect(proofDryRunRequest?.expectedIdempotencyKey === 'dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract', 'Alert delivery proof dry-run request should expose the replay idempotency key.', proofDryRunRequest)
expect(proofDryRunRequest?.expectedAuditAction === 'delivery.replayed', 'Alert delivery proof dry-run request should expose expected replay audit action.', proofDryRunRequest)
expect(proofDryRunRequest?.body.alert.casePath === replayWorkflowAlert.casePath && proofDryRunRequest.body.alert.alertUrl === replayWorkflowAlert.alertUrl && proofDryRunRequest.body.alert.watchlist.id === 'watchlist_item_replay_contract', 'Alert delivery proof dry-run request should preserve alert/watchlist/deep-link context.', proofDryRunRequest?.body)
expect(proofAlertEventReadiness.schemaVersion === 'dwm.webhook.alert_event_readiness_fixture.v1' && proofAlertEventReadiness.noNetwork === true && proofAlertEventReadiness.consumesSchemaVersion === 'dwm.webhook.alert_event_consumer.v1', 'Alert delivery proof should expose a no-network alert-to-webhook readiness fixture.', proofAlertEventReadiness)
expect(proofAlertEventReadiness.alertId === 'alert_replay_contract' && proofAlertEventReadiness.casePath === replayWorkflowAlert.casePath && proofAlertEventReadiness.sourceFamily === 'telegram_public' && proofAlertEventReadiness.provenanceSummary.includes('captures'), 'Alert event readiness fixture should preserve alert/case/source/provenance context.', proofAlertEventReadiness)
expect(proofAlertEventReadiness.expectedDeliveryAttempts.some(item => item.destinationId === 'destination_replay_contract' && item.idempotencyKey === proofDryRunRequest?.expectedIdempotencyKey && item.auditAction === 'delivery.replayed' && item.dryRun === true), 'Alert event readiness fixture should expose expected dry-run attempt idempotency and audit action.', proofAlertEventReadiness.expectedDeliveryAttempts)
expect(proofAlertEventReadiness.payloadValidation.valid === true && proofAlertEventReadiness.payloadPreview?.redaction.webhookSecretExposed === false && proofAlertEventReadiness.redaction.webhookSecretExposed === false, 'Alert event readiness fixture should include validated redacted Discord payload preview.', proofAlertEventReadiness)
expect(proofLiveRequest?.externalSendEnabled === false && proofLiveRequest.noNetwork === true && proofLiveRequest.body === null && proofLiveRequest.blockers.some(item => item.code === 'live_delivery_disabled'), 'Alert delivery proof should block live request bodies unless live delivery is enabled and allowed.', proofLiveRequest)
expect(proofLiveRequest?.expectedIdempotencyKey === proofDryRunRequest?.expectedIdempotencyKey, 'Alert delivery proof live and dry-run requests should share duplicate-send guard keys.', proofLiveRequest)
expect(proofLiveRequest?.expectedAuditAction === 'delivery.replayed', 'Alert delivery proof live request should expose expected replay audit action even when blocked.', proofLiveRequest)
expect(proofTestRequest?.route === 'POST /api/dwm/webhook-destinations/destination_replay_contract/test' && proofTestRequest.noNetwork === true && proofTestRequest.body.eventType === 'dwm.alert.test' && proofTestRequest.expectedIdempotencyKey === 'dwm.alert.test:org_contract:destination_replay_contract:webhook_test' && proofTestRequest.expectedAuditAction === 'delivery.tested', 'Alert delivery proof should include a safe destination test request with idempotency and audit proof.', proofTestRequest)
expect(proofTestRequest?.payloadPreview?.schemaVersion === 'dwm.webhook.destination_test_payload_preview.v1' && proofTestRequest.payloadPreview.discord.fieldNames.includes('Watchlist'), 'Alert delivery proof destination test request should include the no-network Discord payload preview.', proofTestRequest)
expect(proofTestRequest?.payloadPreview?.context.orgId === 'org_contract' && proofTestRequest.payloadPreview.context.dedupeKey.includes('webhook_test'), 'Alert delivery proof destination test preview should preserve org and test dedupe context.', proofTestRequest?.payloadPreview)
expect(orgAlertDeliveryProof.actionRequests.deliveryHistory.query.alertId === 'alert_replay_contract' && orgAlertDeliveryProof.actionRequests.deliveryHistory.query.dedupeKey === 'dwm_dedupe_replay_contract', 'Alert delivery proof should include a delivery history query for the alert/dedupe key.', orgAlertDeliveryProof.actionRequests.deliveryHistory)
expect(orgAlertDeliveryProof.actionRequests.deliveryHistory.expectedAuditActions.includes('delivery.replayed') && orgAlertDeliveryProof.actionRequests.deliveryHistory.expectedAuditActions.includes('delivery.failed'), 'Alert delivery proof should list expected audit actions for delivery history verification.', orgAlertDeliveryProof.actionRequests.deliveryHistory)
expect(!JSON.stringify(orgAlertDeliveryProof).includes(secret), 'Alert delivery proof should not leak endpoint, response, or audit secrets.', orgAlertDeliveryProof)
expect(persistedOnlyDestinationTest.status === 'verified' && persistedOnlyDestinationTest.latestTest?.source === 'destination_persistence' && persistedOnlyDestinationTest.latestTest.status === 'dry_run', 'Destination test contract should honor persisted last-test status when ledger rows are omitted.', persistedOnlyDestinationTest)
expect(persistedOnlyDestinationTest.preview === null && persistedOnlyDestinationTest.blockers.every(item => item.code !== 'no_verified_dry_run'), 'Persisted test status should not fake a payload preview or mark the destination untested.', persistedOnlyDestinationTest)
expect(dashboardReadiness.schemaVersion === 'dwm.webhook.dashboard_readiness.v1' && dashboardReadiness.summary.destinationCount === operationDestinations.length, 'Dashboard readiness should summarize all org destinations.', dashboardReadiness)
expect(dashboardVerified?.healthStates.includes('verified') && dashboardVerified.latestDeliveryProof.auditEventId === 'audit_replay_duplicate_contract', 'Dashboard readiness should expose verified dry-run/latest delivery proof.', dashboardVerified)
expect(dashboardVerified?.latestDeliveryProof.discordTemplate?.templateId === 'dwm.discord.alert_replay.v1' && dashboardVerified.latestDeliveryProof.discordTemplate.redaction.webhookSecretExposed === false, 'Dashboard readiness should expose redacted Discord template proof for latest delivery.', dashboardVerified?.latestDeliveryProof.discordTemplate)
expect(dashboardDisabled?.healthStates.includes('disabled') && dashboardDisabled.blockers.some(item => item.code === 'disabled'), 'Dashboard readiness should expose disabled destination blockers.', dashboardDisabled)
expect(dashboardSecretMissing?.healthStates.includes('secret_missing') && dashboardSecretMissing.secretState === 'missing', 'Dashboard readiness should expose missing secret/url state without leaking values.', dashboardSecretMissing)
expect(dashboardRetry?.healthStates.includes('retry_scheduled') && dashboardRetry.retry.nextRetryAt === '2026-06-28T12:11:00.000Z', 'Dashboard readiness should expose scheduled retry/backoff state.', dashboardRetry)
expect(dashboardTerminal?.healthStates.includes('terminal_failure') && dashboardTerminal.retry.terminalFailure === true, 'Dashboard readiness should expose terminal failure state.', dashboardTerminal)
expect(dashboardTestFailed?.healthStates.includes('test_failed') && dashboardTestFailed.test.status === 'failed' && !JSON.stringify(dashboardTestFailed).includes(secret), 'Dashboard readiness should expose failed test-send state with redaction.', dashboardTestFailed)
expect(dashboardLifecycleActive?.lifecycleState.primary === 'active' && dashboardLifecycleActive.lifecycleState.active === true, 'Dashboard readiness should expose active destination lifecycle state.', dashboardLifecycleActive?.lifecycleState)
expect(dashboardLifecycleDisabled?.lifecycleState.primary === 'disabled' && dashboardLifecycleDisabled.lifecycleState.disabled === true, 'Dashboard readiness should expose disabled destination lifecycle state.', dashboardLifecycleDisabled?.lifecycleState)
expect(dashboardLifecycleFailed?.lifecycleState.primary === 'failed' && dashboardLifecycleFailed.lifecycleState.failed === true, 'Dashboard readiness should expose failed destination lifecycle state.', dashboardLifecycleFailed?.lifecycleState)
expect(dashboardLifecycleSecretRotated?.lifecycleState.primary === 'secret_rotated' && dashboardLifecycleSecretRotated.lifecycleState.redaction.webhookSecretExposed === false, 'Dashboard readiness should expose secret-rotated lifecycle state without endpoint secrets.', dashboardLifecycleSecretRotated?.lifecycleState)
expect(dashboardLifecycleTestRequired?.lifecycleState.primary === 'test_required' && dashboardLifecycleTestRequired.lifecycleState.requiredActions.dryRunTest?.noNetworkDefault === true, 'Dashboard readiness should expose test-required lifecycle remediation.', dashboardLifecycleTestRequired?.lifecycleState)
expect(dashboardLifecycleRevokedOwner?.lifecycleState.primary === 'revoked_owner' && dashboardLifecycleRevokedOwner.lifecycleState.owner.createdBy === 'removed_member_contract', 'Dashboard readiness should expose revoked-owner lifecycle state to admins.', dashboardLifecycleRevokedOwner?.lifecycleState)
expect(dashboardLifecycleDisabled?.lifecycleReadinessReceipt.nextAction === 'enable_destination' && dashboardLifecycleDisabled.lifecycleReadinessReceipt.noNetwork === true, 'Dashboard readiness should expose destination lifecycle receipt next actions.', dashboardLifecycleDisabled?.lifecycleReadinessReceipt)
expect(dashboardLifecycleFailed?.lifecycleReadinessReceipt.status.lifecycle === 'failed' && dashboardLifecycleFailed.lifecycleReadinessReceipt.redaction.webhookSecretExposed === false, 'Dashboard readiness lifecycle receipt should expose failed state without secrets.', dashboardLifecycleFailed?.lifecycleReadinessReceipt)
expect(memberDashboardLifecycleRevokedOwner?.lifecycleState.owner.createdBy === null && memberDashboardLifecycleRevokedOwner.lifecycleState.redaction.actorExposed === false, 'Dashboard readiness should keep revoked-owner actor details member-safe.', memberDashboardLifecycleRevokedOwner?.lifecycleState)
expect(dashboardLifecycleReadiness.summary.lifecycleCounts.active >= 1 && dashboardLifecycleReadiness.summary.lifecycleCounts.disabled >= 1 && dashboardLifecycleReadiness.summary.lifecycleCounts.failed >= 1 && dashboardLifecycleReadiness.summary.lifecycleCounts.revokedOwner >= 1 && dashboardLifecycleReadiness.summary.lifecycleCounts.secretRotated >= 1 && dashboardLifecycleReadiness.summary.lifecycleCounts.testRequired >= 1, 'Dashboard readiness should summarize destination lifecycle states for operators.', dashboardLifecycleReadiness.summary.lifecycleCounts)
expect(dashboardLifecycleDryRunAction?.routeTemplate === 'POST /api/dwm/webhook-destinations/{destinationId}/test' && dashboardLifecycleDryRunAction.noNetworkDefault === true && dashboardLifecycleDryRunAction.redaction.webhookSecretExposed === false, 'Dashboard readiness should summarize no-network lifecycle test actions without secrets.', dashboardLifecycleDryRunAction)
expect(dashboardLifecycleEnableAction?.bodyPreview?.status === 'active' && dashboardLifecycleEnableAction.liveSendAllowed === false, 'Dashboard readiness should summarize disabled destination enable actions without live sends.', dashboardLifecycleEnableAction)
expect(dashboardLifecycleOwnerAction?.destinationIds.includes('destination_revoked_owner_contract') && dashboardLifecycleOwnerAction.redaction.actorExposed === false, 'Dashboard readiness should summarize revoked-owner review without exposing actors.', dashboardLifecycleOwnerAction)
expect(policyBlockedDashboardReadiness.summary.policyBlockedCount === 1 && policyBlockedDashboardReadiness.destinations.length === 0, 'Dashboard readiness should deny revoked/nonmember actors without destination leakage.', policyBlockedDashboardReadiness)
expect(archivedOrgDashboardReadiness.destinations.every(item => item.healthStates.includes('policy_blocked')) && archivedOrgDashboardReadiness.blockers.some(item => item.reason === 'org_archived'), 'Dashboard readiness should expose archived org policy blockers.', archivedOrgDashboardReadiness)
expect(retiredWatchlistDashboardReadiness.destinations.every(item => item.healthStates.includes('policy_blocked')) && retiredWatchlistDashboardReadiness.blockers.some(item => item.reason === 'watchlist_retired'), 'Dashboard readiness should expose retired watchlist policy blockers.', retiredWatchlistDashboardReadiness)
expect(!JSON.stringify(dashboardReadiness).includes(secret), 'Dashboard readiness should not leak endpoint secrets.', dashboardReadiness)
expect(customerSetup.schemaVersion === 'dwm.webhook.customer_setup.v1' && customerSetup.summary.destinationCount === operationDestinations.length, 'Customer setup proof should summarize org destinations.', customerSetup)
expect(customerSetup.access.canCreate === true && customerSetup.access.canTest === true && customerSetup.access.canDelete === true && customerSetup.routes.test.includes('/api/dwm/webhook-destinations/') && customerSetup.routes.delete === customerSetup.routes.archive, 'Customer setup proof should expose owner/admin setup routes.', customerSetup)
expect(customerSetupDryRunStep?.status === 'complete' && customerSetup.dryRunTestRequest?.noNetwork === true && customerSetup.dryRunTestRequest.externalSendEnabled === false, 'Customer setup proof should expose no-network dry-run test request.', customerSetup)
expect(customerSetup.dryRunTestRequest?.payloadPreview?.schemaVersion === 'dwm.webhook.destination_test_payload_preview.v1' && customerSetup.dryRunTestRequest.payloadPreview.discord.fieldNames.includes('Evidence count'), 'Customer setup proof should expose a Discord payload preview for dry-run tests.', customerSetup.dryRunTestRequest)
expect(customerSetup.dryRunTestRequest?.payloadPreview?.context.orgId === 'org_contract' && customerSetup.dryRunTestRequest.payloadPreview.context.dedupeKey.includes('webhook_test'), 'Customer setup dry-run preview should carry org and test dedupe context.', customerSetup.dryRunTestRequest?.payloadPreview)
expect(customerSetup.dryRunTestRequests.length === customerSetup.summary.activeDestinationCount && customerSetup.dryRunTestRequests.every(item => item.noNetwork === true && item.body.eventType === 'dwm.alert.test'), 'Customer setup proof should expose one no-network dry-run test request per active destination.', customerSetup.dryRunTestRequests)
expect(customerSetup.dryRunTestRequests.some(item => item.destinationId === 'destination_replay_contract' && item.payloadPreview?.discord.fieldNames.includes('Watchlist')) && customerSetup.dryRunTestRequests.every(item => item.destinationId !== 'destination_disabled_contract'), 'Customer setup dry-run request list should include Discord previews for active destinations and exclude disabled destinations.', customerSetup.dryRunTestRequests)
expect(customerSetupDeliveryStep?.route === 'POST /api/dwm/webhook-deliveries' && customerSetup.blockers.some(item => item.code === 'live_delivery_disabled'), 'Customer setup proof should expose delivery route and live-disabled blocker.', customerSetup)
expect(customerSetup.summary.retryScheduledCount >= 1 && customerSetup.summary.terminalFailureCount >= 1, 'Customer setup proof should surface retry and terminal failure counts.', customerSetup)
expect(nonmemberCustomerSetup.status === 'permission_denied' && nonmemberCustomerSetup.setupSteps.length === 0 && nonmemberCustomerSetup.blockers.some(item => item.code === 'permission_denied'), 'Customer setup proof should deny nonmembers without leaking setup details.', nonmemberCustomerSetup)
expect(!JSON.stringify(customerSetup).includes(secret), 'Customer setup proof should redact endpoint, response, and payload secrets.', customerSetup)
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
expect(crudCreateContract.routeContract.schemaVersion === 'dwm.webhook.destination_crud_routes.v1' && crudCreateContract.routeContract.create.requiredBody.includes('endpointUrl') && crudCreateContract.routeContract.test.noNetworkDefault === true, 'Destination CRUD contract should expose stable org-scoped management routes.', crudCreateContract.routeContract)
expect(crudCreateContract.managementRequest.method === 'POST' && crudCreateContract.managementRequest.route === '/api/dwm/webhook-destinations' && crudCreateContract.managementRequest.expectedAuditAction === 'destination.created', 'Destination CRUD contract should expose a create request proof.', crudCreateContract.managementRequest)
expect(crudCreateContract.managementRequest.bodyPreview?.redactedEndpoint.endpointExposed === false && crudCreateContract.managementRequest.bodyPreview.secretFields.includes('endpointUrl'), 'Destination CRUD create request should expose only redacted endpoint metadata.', crudCreateContract.managementRequest)
expect(crudDuplicateContract.canApply === false && crudDuplicateContract.blockers.some(item => item.code === 'duplicate_destination' && item.blocking === true), 'Destination CRUD contract should block duplicate org endpoint creates.', crudDuplicateContract)
expect(crudInvalidUrlContract.canApply === false && crudInvalidUrlContract.blockers.some(item => item.code === 'invalid_url'), 'Destination CRUD contract should block invalid/insecure URLs.', crudInvalidUrlContract)
expect(crudUnsupportedTypeContract.canApply === false && crudUnsupportedTypeContract.blockers.some(item => item.code === 'unsupported_destination_type'), 'Destination CRUD contract should block unsupported destination types.', crudUnsupportedTypeContract)
expect(crudEntitlementDeniedContract.canApply === false && crudEntitlementDeniedContract.blockers.some(item => item.code === 'entitlement_plan_denied'), 'Destination CRUD contract should expose entitlement/plan denial blockers.', crudEntitlementDeniedContract)
expect(crudUpdateContract.canApply === true && crudUpdateContract.action === 'update' && crudUpdateContract.desired.label === 'Renamed Discord' && crudUpdateContract.desired.channel === '#security', 'Destination CRUD contract should allow admin update and endpoint rotation preflight.', crudUpdateContract)
expect(crudUpdateContract.managementRequest.method === 'PUT' && crudUpdateContract.managementRequest.route === '/api/dwm/webhook-destinations/destination_replay_contract' && crudUpdateContract.managementRequest.expectedAuditAction === 'destination.updated', 'Destination CRUD contract should expose a destination update request proof.', crudUpdateContract.managementRequest)
expect(crudUpdateContract.managementRequest.bodyPreview?.redactedEndpoint.endpointHash?.startsWith('endpoint_') && !JSON.stringify(crudUpdateContract.managementRequest).includes('rotated-token'), 'Destination CRUD update request should prove secret redaction for endpoint rotation.', crudUpdateContract.managementRequest)
expect(crudUpdateContract.destinationPersistenceReceipt.schemaVersion === 'dwm.webhook.destination_persistence_receipt.v1' && crudUpdateContract.destinationPersistenceReceipt.mutation.persisted === true && crudUpdateContract.destinationPersistenceReceipt.audit.expectedAction === 'destination.updated', 'Destination persistence receipt should prove update persistence and audit action.', crudUpdateContract.destinationPersistenceReceipt)
expect(crudUpdateContract.destinationPersistenceReceipt.request.bodyPreview?.redactedEndpoint.endpointExposed === false && !JSON.stringify(crudUpdateContract.destinationPersistenceReceipt).includes('rotated-token'), 'Destination persistence receipt should keep update body previews secret-safe.', crudUpdateContract.destinationPersistenceReceipt)
expect(crudOrgScopeMismatchContract.canApply === false && crudOrgScopeMismatchContract.blockers.some(item => item.code === 'org_scope_mismatch') && crudOrgScopeMismatchContract.destination?.orgId === 'org_contract', 'Destination CRUD contract should block cross-org destination reassignment.', crudOrgScopeMismatchContract)
expect(crudOrgScopeMismatchContract.managementRequest.canSend === false && crudOrgScopeMismatchContract.managementRequest.blockingCodes.includes('org_scope_mismatch'), 'Destination CRUD management request should carry cross-org blockers without leaking destination secrets.', crudOrgScopeMismatchContract.managementRequest)
expect(crudOrgScopeMismatchContract.destinationPersistenceReceipt.denial.blockingCodes.includes('org_scope_mismatch') && crudOrgScopeMismatchContract.destinationPersistenceReceipt.mutation.persisted === false, 'Destination persistence receipt should block cross-org persistence.', crudOrgScopeMismatchContract.destinationPersistenceReceipt)
expect(crudDisableContract.canApply === true && crudDisableContract.access.canDisable === true && crudDisableContract.audit.auditEventIds.includes('audit_delivery_test_contract'), 'Destination CRUD contract should expose disable capability and audit linkage.', crudDisableContract)
expect(crudDisableContract.managementRequest.method === 'DELETE' && crudDisableContract.managementRequest.queryPreview?.orgId === 'org_contract' && crudDisableContract.managementRequest.expectedAuditAction === 'destination.archived', 'Destination CRUD contract should expose disable/archive request proof.', crudDisableContract.managementRequest)
expect(crudDisableContract.destinationPersistenceReceipt.mutation.nextStatus === 'paused' && crudDisableContract.destinationPersistenceReceipt.request.queryPreview?.orgId === 'org_contract', 'Destination persistence receipt should prove disable state transition and query preview.', crudDisableContract.destinationPersistenceReceipt)
expect(crudDeleteContract.canApply === true && crudDeleteContract.action === 'delete' && crudDeleteContract.desired.status === 'archived' && crudDeleteContract.access.canDelete === true, 'Destination CRUD contract should expose delete/archive capability without hard-deleting delivery proof.', crudDeleteContract)
expect(crudDeleteContract.destinationPersistenceReceipt.mutation.nextStatus === 'archived' && crudDeleteContract.destinationPersistenceReceipt.audit.expectedAction === 'destination.archived', 'Destination persistence receipt should prove archive/delete state transition.', crudDeleteContract.destinationPersistenceReceipt)
expect(crudEnableContract.canApply === true && crudEnableContract.action === 'enable' && crudEnableContract.access.canEnable === true, 'Destination CRUD contract should allow enable preflight for paused destinations.', crudEnableContract)
expect(crudTestContract.canApply === true && crudTestContract.access.canTest === true && crudTestContract.noNetwork === true, 'Destination CRUD contract should allow dry-run test preflight without network.', crudTestContract)
expect(crudTestContract.managementRequest.method === 'POST' && crudTestContract.managementRequest.route === '/api/dwm/webhook-destinations/destination_replay_contract/test' && crudTestContract.managementRequest.expectedPersistedAttempt === true, 'Destination CRUD test request should expose persisted dry-run receipt intent.', crudTestContract.managementRequest)
expect(crudTestContract.destinationPersistenceReceipt.dryRun.latestTestAuditEventId === 'audit_delivery_test_contract' && crudTestContract.destinationPersistenceReceipt.deliveryContext.workflowStatus === 'destination_mutation', 'Destination persistence receipt should expose dry-run test and non-alert workflow context.', crudTestContract.destinationPersistenceReceipt)
expect(crudRoleDeniedContract.canApply === false && crudRoleDeniedContract.blockers.some(item => item.code === 'permission_denied'), 'Destination CRUD contract should enforce owner/admin mutation gates.', crudRoleDeniedContract)
expect(crudRoleDeniedContract.managementRequest.canSend === false && crudRoleDeniedContract.managementRequest.blockingCodes.includes('permission_denied'), 'Destination CRUD management request should deny member mutation without destination leakage.', crudRoleDeniedContract.managementRequest)
expect(crudRoleDeniedContract.destinationPersistenceReceipt.denial.blockingCodes.includes('permission_denied') && crudRoleDeniedContract.destinationPersistenceReceipt.mutation.persisted === false, 'Destination persistence receipt should deny member persistence without endpoint leakage.', crudRoleDeniedContract.destinationPersistenceReceipt)
expect(crudIdempotencyContract.idempotency.alreadyDelivered === true && crudIdempotencyContract.blockers.some(item => item.code === 'idempotency_duplicate' && item.blocking === false), 'Destination CRUD contract should expose idempotency duplicates without leaking secrets.', crudIdempotencyContract)
expect(crudIdempotencyContract.destinationPersistenceReceipt.idempotency.alreadyDelivered === true && crudIdempotencyContract.destinationPersistenceReceipt.redactedTarget.endpoint.endpointExposed === false, 'Destination persistence receipt should carry idempotency proof and redacted target.', crudIdempotencyContract.destinationPersistenceReceipt)
expect(crudTestContract.health.productProgress.schemaVersion === 'dwm.webhook.destination_admin_product_progress.v1' && crudTestContract.health.productProgress.deliveryReadyCount >= 1, 'Destination CRUD contract should link product-progress/admin-proof health fields.', crudTestContract)
expect(!JSON.stringify([crudCreateContract, crudUpdateContract, crudIdempotencyContract]).includes(secret) && !JSON.stringify(crudUpdateContract).includes('rotated-token'), 'Destination CRUD contracts should not leak endpoint secrets.', { crudCreateContract, crudUpdateContract, crudIdempotencyContract })
expect(auditCreated?.category === 'destination' && auditCreated.outcome === 'created' && auditCreated.destination?.redactedEndpoint.endpointHash === 'endpoint_replay_hash', 'Audit contract should expose destination create events with redacted endpoint refs.', auditCreated)
expect(auditUpdated?.outcome === 'updated' && (auditUpdated.metadata as Record<string, unknown>).token === '[redacted]', 'Audit contract should expose destination update events without secrets.', auditUpdated)
expect(auditArchived?.outcome === 'disabled' && auditArchived.severity === 'warning' && auditArchived.destination?.enabled === false, 'Audit contract should expose destination disable/archive events.', auditArchived)
expect(auditTested?.category === 'delivery' && auditTested.outcome === 'tested' && auditTested.delivery?.dryRun === true && auditTested.requestId === 'delivery_test_contract', 'Audit contract should expose dry-run test delivery events.', auditTested)
expect(auditFailed?.action === 'delivery.retry_scheduled' && auditFailed.outcome === 'retry_scheduled' && auditFailed.severity === 'info' && auditFailed.retry?.retryable === true && auditFailed.retry.errorClass === 'upstream_5xx', 'Audit contract should expose scheduled retry delivery state.', auditFailed)
expect(!JSON.stringify(auditEventContracts).includes(secret), 'Audit event contracts should redact endpoint, token, and error secrets.', auditEventContracts)

console.log(JSON.stringify({
    ok: true,
    checked: [
        'destination validation',
        'discord kind inference',
        'endpoint redaction/hash',
        'delivery diagnostic persistence redaction',
        'HTTPS-only customer endpoint validation',
        'Discord payload formatting',
        'Discord payload alert URL/deep link',
        'Discord payload analyst action link',
        'Discord payload event timestamp context',
        'Discord payload confidence/workflow context',
        'Discord payload template contract',
        'Discord payload truncation limits',
        'destination selection',
        'disabled destination skip',
        'persistable skipped destination intents',
        'persistable missing destination intent',
        'missing destination delivery operations proof',
        'org/watchlist context propagation',
        'route/dedupe/case context',
        'alert replay trigger adapter',
        'workflow replay handoff type contract',
        'adapter destination dry-run/live selection',
        'API delivery bridge persisted-alert normalization',
        'alert event consumer created readiness fixture',
        'alert event consumer required field proof',
        'alert event consumer persistence targets',
        'alert event consumer audit readiness linkage',
        'alert event consumer audit redaction',
        'alert event consumer redacted Discord preview',
        'alert event consumer Discord schema validation',
        'alert event consumer Discord limit/redaction validation',
        'alert event consumer replay idempotency',
        'alert event consumer replay audit linkage',
        'alert event consumer missing destination denial',
        'alert event consumer missing audit denial',
        'replay alert/dedupe/case linkage',
        'replay confidence/workflow context',
        'idempotent duplicate replay key',
        'replay workflow immutability',
        'multi-evidence Discord summary',
        'delivery evidence shaping',
        'delivery ledger queued/sent/failed/skipped states',
        'delivery ledger retry backoff',
        'delivery ledger attempt counts',
        'delivery ledger persisted retry metadata',
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
        'dashboard readiness lifecycle state proof',
        'org alert delivery contract normalization',
        'org alert delivery watchlist/provenance context',
        'org alert delivery destination selection',
        'org alert delivery health/lifecycle linkage',
        'org alert delivery destination readiness handoff',
        'org alert delivery persisted outcome proof',
        'org alert delivery selected/skipped outcome blockers',
        'org alert delivery audit/ledger linkage',
        'org alert delivery readiness consumer proof',
        'org alert delivery readiness consumer redaction',
        'org alert delivery secret redaction',
        'two-org overlapping watchlist destination isolation',
        'two-org overlapping watchlist delivery isolation',
        'two-org overlapping watchlist Discord payload isolation',
        'delivery operations list/detail filters',
        'delivery operations retry/backoff summary',
        'delivery operations replay/audit linkage',
        'delivery history customer-safe read model',
        'delivery history Discord preview proof',
        'delivery history sanitized payload preview proof',
        'delivery history Discord template proof',
        'delivery preview retry/audit proof',
        'delivery history consumer proof',
        'delivery history consumer Discord template proof',
        'delivery history retry/terminal failure proof',
        'delivery history duplicate replay live-send guard',
        'delivery history duplicate replay skipped audit proof',
        'delivery history secret redaction',
        'delivery receipts customer-safe proof contract',
        'delivery receipts Discord preview proof',
        'delivery receipts retry/backoff blockers',
        'delivery receipts transition receipt retry state',
        'delivery receipts transition receipt dry-run request',
        'delivery receipts transition receipt live blocker',
        'delivery receipts transition receipt audit/provenance',
        'delivery receipts case action dry-run receipt',
        'delivery receipts case action replay/audit context',
        'delivery receipts case replay export consumer route',
        'delivery receipts case replay export dedupe/audit context',
        'delivery receipts case replay export retry/backoff state',
        'delivery receipts alert source handoff readiness consumer',
        'delivery receipts alert source provenance context',
        'delivery receipts alert source retry/dedupe state',
        'delivery receipts alert source missing destination blocker',
        'delivery receipts alert source support recovery bridge',
        'delivery receipts org destination readiness bridge',
        'delivery receipts org destination readiness redaction',
        'delivery receipts org destination readiness retry/idempotency',
        'delivery receipts case action terminal blocker',
        'delivery receipts case action missing destination blocker',
        'delivery receipts case action secret redaction',
        'delivery receipts terminal failure blocker',
        'delivery receipts missing destination transition blocker',
        'delivery receipts audit/no-network linkage',
        'delivery receipts nonmember denial',
        'delivery receipts replay/history filter routes',
        'delivery receipts replay/dedupe filter keys',
        'delivery receipts case-path filter keys',
        'delivery receipts missing/disabled filter presets',
        'delivery receipts filter idempotency/audit proof',
        'delivery receipts filter nonmember denial',
        'delivery receipts destination archive remediation link',
        'delivery receipts secret redaction',
        'delivery timeline customer history grouping',
        'delivery timeline replay/audit proof',
        'delivery timeline retry/backoff status',
        'delivery timeline terminal failure status',
        'delivery timeline org isolation',
        'delivery timeline nonmember denial',
        'delivery timeline secret redaction',
        'delivery action plan no-network next steps',
        'delivery action plan dry-run retry',
        'delivery action plan live-send blockers',
        'delivery action plan terminal failure remediation',
        'delivery action plan delivered monitoring',
        'delivery action plan typed remediation guidance',
        'delivery action plan nonmember denial',
        'delivery action plan secret redaction',
        'delivery replay guard dry-run replay',
        'delivery replay guard duplicate live-send block',
        'delivery replay guard terminal failure block',
        'delivery replay guard audit linkage',
        'delivery replay guard nonmember denial',
        'delivery replay guard secret redaction',
        'delivery retry persistence grouped idempotency keys',
        'delivery retry persistence persisted backoff/audit action',
        'delivery retry persistence secret-safe persisted ids',
        'delivery retry persistence terminal failure state',
        'delivery retry persistence terminal blocker action',
        'delivery retry persistence duplicate replay dedupe',
        'delivery retry persistence duplicate live-send guard',
        'delivery retry persistence wrong-org filtering',
        'delivery retry persistence secret redaction',
        'delivery retry queue no-network dry-run readiness',
        'delivery retry queue live-disabled blocker',
        'delivery retry queue delivered/terminal blockers',
        'delivery retry queue member/nonmember gates',
        'delivery retry queue secret redaction',
        'delivery retry work orders dry-run readiness',
        'delivery retry work orders duplicate protection',
        'delivery retry work orders terminal failure state',
        'delivery retry work orders member/nonmember gates',
        'delivery retry work orders secret redaction',
        'delivery readiness consumer success/retry/terminal states',
        'delivery readiness consumer idempotent replay proof',
        'delivery readiness consumer redacted dry-run proof',
        'delivery readiness consumer org/nonmember denial',
        'delivery readiness consumer secret redaction',
        'delivery audit trail destination/delivery events',
        'delivery audit trail retry/backoff linkage',
        'delivery audit trail replay/case/dedupe context',
        'delivery audit trail member/nonmember gates',
        'delivery audit trail secret redaction',
        'destination test contract dry-run proof',
        'destination test contract no-network payload preview',
        'destination test contract Discord preview/audit linkage',
        'destination test contract dry-run receipt proof',
        'destination test contract disabled/failed blockers',
        'destination test contract member-safe redaction',
        'destination delivery matrix route hints',
        'destination delivery matrix delete/archive route hints',
        'destination delivery matrix replay/test proof',
        'destination delivery matrix retry/disabled blockers',
        'destination delivery matrix member/nonmember gates',
        'destination delivery matrix secret redaction',
        'destination lookup org-scoped route contract',
        'destination lookup retry/audit proof',
        'destination lookup member/nonmember gates',
        'destination lookup secret redaction',
        'dashboard readiness verified delivery proof',
        'dashboard readiness failed test-send state',
        'dashboard readiness disabled/secret-missing blockers',
        'dashboard readiness retry scheduled state',
        'dashboard readiness terminal failure state',
        'dashboard readiness policy-blocked denial',
        'dashboard readiness retired watchlist blocker',
        'dashboard readiness secret redaction',
        'customer setup proof summary',
        'customer setup proof setup routes',
        'customer setup proof delete/archive routes',
        'customer setup proof dry-run request',
        'customer setup proof dry-run payload preview',
        'customer setup proof per-destination dry-run requests',
        'customer setup proof live-disabled blocker',
        'customer setup proof retry/terminal counts',
        'customer setup proof nonmember denial',
        'customer setup proof secret redaction',
        'alert delivery proof setup/readiness bridge',
        'alert delivery proof no-network blockers',
        'alert delivery proof destination test payload preview',
        'alert delivery proof alert event readiness fixture',
        'alert delivery proof alert event readiness redaction',
        'alert delivery proof audit/dashboard probe fields',
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
        'destination CRUD management route contract',
        'destination CRUD management request proof',
        'destination CRUD management redaction',
        'destination CRUD persistence receipt update proof',
        'destination CRUD persistence receipt disable/archive proof',
        'destination CRUD persistence receipt denial blockers',
        'destination CRUD persistence receipt dry-run/audit proof',
        'destination CRUD persistence receipt idempotency proof',
        'destination CRUD invalid URL blocker',
        'destination CRUD unsupported type blocker',
        'destination CRUD duplicate endpoint blocker',
        'destination CRUD entitlement blocker',
        'destination CRUD org-scope immutability',
        'destination CRUD delete/archive preflight',
        'destination CRUD disable/enable/test preflight',
        'destination CRUD role denial',
        'destination CRUD idempotency/audit linkage',
        'destination test persisted status fallback',
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
        'destination contract display/channel metadata',
        'destination contract audit ids',
        'structured audit contract create/update/disable/test/failure events',
        'structured audit contract retry state',
        'structured audit contract retry-scheduled action',
        'structured audit contract secret redaction',
        'dry-run Discord payload preview fields',
        'delivery evidence replay/live/dry-run distinction',
        'delivery attempt typed payload contract',
        'delivery attempt field contract',
        'delivery attempt duplicate replay history',
        'delivery attempt required field blockers',
        'delivery attempt wrong-org isolation',
        'delivery attempt unsupported destination blocker',
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
            'destinationLifecycle[].lifecycleState.primary',
            'destinationLifecycle[].lifecycleState.states',
            'destinationLifecycle[].lifecycleState.secretRotated',
            'destinationLifecycle[].lifecycleState.testRequired',
            'destinationLifecycle[].lifecycleState.revokedOwner',
            'destinationLifecycle[].lifecycleState.requiredActions.dryRunTest.noNetworkDefault',
            'destinationLifecycle[].lifecycleState.redaction.webhookSecretExposed',
            'destinationLifecycle[].lifecycleReadinessReceipt.status.nextDeliveryState',
            'destinationLifecycle[].lifecycleReadinessReceipt.nextAction',
            'destinationLifecycle[].lifecycleReadinessReceipt.routes.history',
            'destinationCrud.schemaVersion',
            'destinationCrud.action',
            'destinationCrud.canApply',
            'destinationCrud.blockers[].code',
            'destinationCrud.desired.redactedEndpoint.endpointHash',
            'destinationCrud.health.productProgress.status',
            'deliveryHistory.schemaVersion',
            'deliveryHistory.entries[].discordPreview.fieldNames',
            'deliveryHistory.entries[].sanitizedPayloadPreview.schemaVersion',
            'deliveryHistory.entries[].sanitizedPayloadPreview.payloadHash',
            'deliveryHistory.entries[].sanitizedPayloadPreview.discordTemplate.templateId',
            'deliveryHistory.entries[].sanitizedPayloadPreview.context.casePath',
            'deliveryHistory.entries[].deliveryProof.auditEventId',
            'deliveryHistory.entries[].retry.terminalFailure',
            'deliveryHistory.entries[].dedupe.alreadyDelivered',
            'deliveryHistory.entries[].status',
            'deliveryHistoryConsumer.schemaVersion',
            'deliveryHistoryConsumer.routeContract.detail.requiredQuery',
            'deliveryHistoryConsumer.routeContract.list.optionalQuery',
            'deliveryHistoryConsumer.routeContract.retryDryRun.noNetworkDefault',
            'deliveryHistoryConsumer.rows[].redactedDestination.endpointHash',
            'deliveryHistoryConsumer.rows[].discord.fieldNames',
            'deliveryHistoryConsumer.rows[].discord.template.templateId',
            'deliveryHistoryConsumer.rows[].idempotency.duplicateAttemptCount',
            'deliveryHistoryConsumer.rows[].replayHistory.duplicateReplay',
            'deliveryHistoryConsumer.rows[].routes.deliveryDetail',
            'deliveryPersistenceProof.schemaVersion',
            'deliveryPersistenceProof.rows[].sanitizedPayloadPreview.context.casePath',
            'deliveryPersistenceProof.rows[].retry.nextRetryAt',
            'deliveryPersistenceProof.rows[].audit.auditEventId',
            'deliveryPersistenceProof.rows[].actionRequests.deliveryHistory.query',
            'deliveryPersistenceProof.rows[].actionRequests.dryRunReplay.body',
            'deliveryPersistenceProof.rows[].actionRequests.liveReplay.blockers[].code',
            'deliveryPersistenceProof.blockers[].code',
            'deliveryAttemptContract.schemaVersion',
            'deliveryAttemptContract.payloadContract.required[].paths',
            'deliveryAttemptContract.payloadContract.missingRequired',
            'deliveryAttemptContract.attempts[].sanitizedPayloadPreview.discord.fieldNames',
            'deliveryAttemptContract.attempts[].retry.attemptCount',
            'deliveryAttemptContract.blockers[].code',
            'deliveryAttemptPersistence.schemaVersion',
            'deliveryAttemptPersistence.rows[].persistedDeliveryId',
            'deliveryAttemptPersistence.rows[].sanitizedPayloadPreview.discord.fieldNames',
            'deliveryAttemptPersistence.rows[].retry.nextRetryAt',
            'deliveryAttemptPersistence.rows[].audit.auditEventId',
            'deliveryAttemptPersistence.rows[].actionRequests.deliveryHistory.query',
            'deliveryAttemptPersistence.rows[].actionRequests.dryRunReplay.body',
            'deliveryAttemptPersistence.rows[].actionRequests.liveReplay.blockers[].code',
            'deliveryAttemptPersistence.rows[].operationLinks.deliveryDetail',
            'deliveryAttemptPersistence.rows[].idempotency.duplicateAttemptCount',
            'deliveryAttemptPersistence.rows[].replayHistory.duplicateReplay',
            'deliveryAttemptPersistence.blockers[].code',
            'deliveryReceipts.schemaVersion',
            'deliveryReceipts.receipts[].proof.auditEventId',
            'deliveryReceipts.receipts[].proof.noNetwork',
            'deliveryReceipts.receipts[].discordPreview.fieldNames',
            'deliveryReceipts.receipts[].sanitizedPayloadPreview.schemaVersion',
            'deliveryReceipts.receipts[].sanitizedPayloadPreview.discordTemplate.templateId',
            'deliveryReceipts.receipts[].sanitizedPayloadPreview.context.alertId',
            'deliveryReceipts.receipts[].operationLinks.deliveryDetail',
            'deliveryReceipts.receipts[].operationLinks.destinationTest',
            'deliveryReceipts.receipts[].operationLinks.destinationArchive',
            'deliveryReceipts.receipts[].retry.nextRetryAt',
            'deliveryReceipts.receipts[].transitionReceipt.state.next',
            'deliveryReceipts.receipts[].transitionReceipt.requests.dryRunRetry.body',
            'deliveryReceipts.receipts[].transitionReceipt.requests.liveRetry.blockers[].code',
            'deliveryReceipts.receipts[].transitionReceipt.provenance.captureIds',
            'deliveryReceipts.receipts[].transitionReceipt.audit.auditEventIds',
            'deliveryReceipts.receipts[].transitionReceipt.redactedTarget.endpointExposed',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.schemaVersion',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.actionRequest.body',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.historyQuery.query.casePath',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.payloadPreview.context.casePath',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.denial.blockingCodes',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.destination.endpointExposed',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.consumesSchemaVersion',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.route',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.webhookContext.dedupeKey',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.deliveryState.nextRetryAt',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.caseReplayExportConsumer.redaction.webhookSecretExposed',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.consumesSchemaVersion',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.alert.provenanceCaptureIds',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.webhookConsumer.deliveryDedupeKey',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.webhookConsumer.retry.nextRetryAt',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.supportRecoveryBridge.schemaVersion',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.schemaVersion',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.selectedDestination.id',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.expectedDeliveryFields',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.retry.nextRetryAt',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.orgDestinationReadinessBridge.idempotency.dedupeKey',
            'deliveryReceipts.receipts[].transitionReceipt.caseActionDryRunReceipt.sourceHandoffReadinessConsumer.redaction.webhookSecretExposed',
            'deliveryReceipts.receipts[].blockers[].code',
            'deliveryReceipts.historyReplayFilters.schemaVersion',
            'deliveryReceipts.historyReplayFilters.routeContract.replayHistory.requiredQuery',
            'deliveryReceipts.historyReplayFilters.routeContract.list.optionalQuery',
            'deliveryReceipts.historyReplayFilters.rows[].queryKeys.byDedupe',
            'deliveryReceipts.historyReplayFilters.rows[].queryKeys.byCase',
            'deliveryReceipts.historyReplayFilters.rows[].redactedTarget.endpointExposed',
            'deliveryReceipts.historyReplayFilters.queryPresets.retryable',
            'deliveryReceipts.historyReplayFilters.queryPresets.missingDestination',
            'deliveryTimeline.schemaVersion',
            'deliveryTimeline.timelines[].latestReceipt.proof.auditEventId',
            'deliveryTimeline.timelines[].latestReceipt.discordPreview.fieldNames',
            'deliveryTimeline.timelines[].operationLinks.deliveryHistory',
            'deliveryTimeline.timelines[].retry.nextRetryAt',
            'deliveryTimeline.timelines[].status',
            'deliveryTimeline.timelines[].blockers[].code',
            'deliveryActionPlan.schemaVersion',
            'deliveryActionPlan.actions[].action',
            'deliveryActionPlan.actions[].requests.dryRunRetry.body',
            'deliveryActionPlan.actions[].requests.liveRetry.blockers[].code',
            'deliveryActionPlan.actions[].requests.testDestination.body',
            'deliveryActionPlan.actions[].requests.testDestination.payloadPreview.discord.fieldNames',
            'deliveryActionPlan.actions[].operationLinks.retryDryRun',
            'deliveryActionPlan.actions[].audit.nextAction',
            'deliveryActionPlan.actions[].remediation.code',
            'deliveryActionPlan.actions[].remediation.nextSafeStep',
            'deliveryActionPlan.actions[].remediation.redaction.webhookSecretExposed',
            'deliveryReplayGuard.schemaVersion',
            'deliveryReplayGuard.entries[].guard.dryRunAllowed',
            'deliveryReplayGuard.entries[].guard.duplicateLiveBlocked',
            'deliveryReplayGuard.entries[].blockers[].code',
            'deliveryReplayGuard.entries[].latestReceipt.discordPreview.fieldNames',
            'deliveryReplayApi.schemaVersion',
            'deliveryReplayApi.requests[].dryRunReplay.body',
            'deliveryReplayApi.requests[].watchlistId',
            'deliveryReplayApi.requests[].dryRunReplay.body.watchlistName',
            'deliveryReplayApi.requests[].caseActionId',
            'deliveryReplayApi.requests[].dryRunReplay.body.caseActionPath',
            'deliveryReplayApi.requests[].liveReplay.blockers[].code',
            'deliveryReplayApi.requests[].latestAttempt.auditEventId',
            'deliveryReplayApi.requests[].redactedDestination.endpointHash',
            'deliveryReplayApi.requests[].idempotency.duplicateAttemptCount',
            'deliveryReplayApi.requests[].replayHistory.replayAttemptCount',
            'deliveryRetryPersistence.schemaVersion',
            'deliveryRetryPersistence.deliveryKeys[].retry.nextRetryAt',
            'deliveryRetryPersistence.deliveryKeys[].retry.persistedAttemptCount',
            'deliveryRetryPersistence.deliveryKeys[].retry.backoffPersisted',
            'deliveryRetryPersistence.deliveryKeys[].retry.nextAuditAction',
            'deliveryRetryPersistence.deliveryKeys[].retry.blockerCodes',
            'deliveryRetryPersistence.deliveryKeys[].retry.terminalFailure',
            'deliveryRetryPersistence.deliveryKeys[].dedupe.duplicateAttemptCount',
            'deliveryRetryPersistence.deliveryKeys[].persistence.persistedDeliveryIds',
            'deliveryRetryPersistence.deliveryKeys[].persistence.retryBackoffPersisted',
            'deliveryRetryPersistence.deliveryKeys[].persistence.nextAuditAction',
            'deliveryRetryPersistence.deliveryKeys[].persistence.blockerCodes',
            'deliveryRetryQueue.schemaVersion',
            'deliveryRetryQueue.noNetwork',
            'deliveryRetryQueue.entries[].retry.dryRunReady',
            'deliveryRetryQueue.entries[].retry.liveReady',
            'deliveryRetryQueue.entries[].blockers[].code',
            'deliveryRetryQueue.entries[].audit.latestAuditEventId',
            'deliveryRetryRequest.schemaVersion',
            'deliveryRetryRequest.entries[].dryRunRequest.body.destinationId',
            'deliveryRetryRequest.entries[].dryRunRequest.body.dedupeKey',
            'deliveryRetryRequest.entries[].liveRequest.blockers[].code',
            'deliveryRetryRequest.entries[].externalSendEnabled',
            'deliveryRetryWorkOrders.schemaVersion',
            'deliveryRetryWorkOrders.workOrders[].state',
            'deliveryRetryWorkOrders.workOrders[].eligibility.nextRetryAt',
            'deliveryRetryWorkOrders.workOrders[].audit.nextAction',
            'deliveryRetryWorkOrders.workOrders[].worker3Proof.expectedDryRunStatus',
            'deliveryReadinessConsumer.schemaVersion',
            'deliveryReadinessConsumer.routeContract.detail.requiredQuery',
            'deliveryReadinessConsumer.routeContract.retryDryRun.noNetworkDefault',
            'deliveryReadinessConsumer.access.canRetry',
            'deliveryReadinessConsumer.rows[].readiness.retryableFailure',
            'deliveryReadinessConsumer.rows[].readiness.nonRetryableFailure',
            'deliveryReadinessConsumer.rows[].readiness.idempotentReplay',
            'deliveryReadinessConsumer.rows[].readiness.redactedDryRun',
            'deliveryReadinessConsumer.rows[].operationLinks.deliveryDetail',
            'deliveryReadinessConsumer.rows[].operationLinks.retryDryRun',
            'deliveryReadinessConsumer.rows[].redaction.webhookSecretExposed',
            'deliveryReadinessConsumer.counts.crossOrgDenied',
            'deliveryAuditTrail.schemaVersion',
            'deliveryAuditTrail.entries[].customerSummary',
            'deliveryAuditTrail.entries[].retry.nextRetryAt',
            'deliveryAuditTrail.entries[].delivery.casePath',
            'deliveryAuditTrail.entries[].actionRequest.expectedAuditAction',
            'deliveryAuditTrail.entries[].routes.retry',
            'destinationTests[].schemaVersion',
            'destinationTests[].latestTest.status',
            'destinationTests[].preview.discord.fieldNames',
            'destinationTests[].dryRunTestRequest.body',
            'destinationTests[].dryRunTestRequest.expected.auditAction',
            'destinationTests[].dryRunTestRequest.payloadPreview.discord.fieldNames',
            'destinationTests[].dryRunTestRequest.payloadPreview.context.discordTemplate',
            'destinationTests[].dryRunTestReceipt.expected.auditAction',
            'destinationTests[].dryRunTestReceipt.redactedDestination.endpointHash',
            'destinationTests[].dryRunTestReceipt.payloadPreview.discord.fieldNames',
            'destinationTests[].audit.latestAuditEventId',
            'destinationTests[].blockers[].code',
            'destinationDeliveryMatrix.schemaVersion',
            'destinationDeliveryMatrix.routes.deliveryList',
            'destinationDeliveryMatrix.destinations[].routes.delete',
            'destinationDeliveryMatrix.destinations[].routes.archive',
            'destinationDeliveryMatrix.destinations[].deliveryProof.lastReplayed.requestId',
            'destinationDeliveryMatrix.destinations[].retry.nextRetryAt',
            'destinationDeliveryMatrix.destinations[].blockers[].code',
            'destinationLookup.schemaVersion',
            'destinationLookup.routeContract.list.requiredQuery',
            'destinationLookup.destinations[].redactedDestination.endpointHash',
            'destinationLookup.destinations[].delivery.lastReplayId',
            'destinationLookup.destinations[].retry.nextRetryAt',
            'destinationLookup.destinations[].audit.latestAuditEventId',
            'destinationLookup.destinations[].routes.destinationDetail',
            'destinationCrud.routeContract.update.requiredBody',
            'destinationCrud.managementRequest.method',
            'destinationCrud.managementRequest.route',
            'destinationCrud.managementRequest.expectedAuditAction',
            'destinationCrud.managementRequest.bodyPreview.redactedEndpoint.endpointExposed',
            'destinationCrud.managementRequest.blockingCodes',
            'destinationCrud.destinationPersistenceReceipt.schemaVersion',
            'destinationCrud.destinationPersistenceReceipt.mutation.nextStatus',
            'destinationCrud.destinationPersistenceReceipt.request.bodyPreview.redactedEndpoint.endpointExposed',
            'destinationCrud.destinationPersistenceReceipt.audit.expectedAction',
            'destinationCrud.destinationPersistenceReceipt.denial.blockingCodes',
            'destinationCrud.destinationPersistenceReceipt.idempotency.alreadyDelivered',
            'dashboardReadiness.schemaVersion',
            'dashboardReadiness.summary.lifecycleCounts',
            'dashboardReadiness.summary.lifecycleActions',
            'dashboardReadiness.destinations[].healthStates',
            'dashboardReadiness.destinations[].lifecycleState.primary',
            'dashboardReadiness.destinations[].lifecycleState.requiredActions.dryRunTest',
            'dashboardReadiness.destinations[].lifecycleReadinessReceipt.nextAction',
            'dashboardReadiness.destinations[].lifecycleReadinessReceipt.redaction.webhookSecretExposed',
            'dashboardReadiness.destinations[].latestDeliveryProof.auditEventId',
            'dashboardReadiness.destinations[].latestDeliveryProof.discordTemplate.templateId',
            'dashboardReadiness.destinations[].retry.nextRetryAt',
            'customerSetup.schemaVersion',
            'customerSetup.summary.destinationCount',
            'customerSetup.setupSteps[].status',
            'customerSetup.dryRunTestRequest.noNetwork',
            'customerSetup.dryRunTestRequest.payloadPreview.discord.fieldNames',
            'customerSetup.dryRunTestRequests[].destinationId',
            'customerSetup.dryRunTestRequests[].payloadPreview.discord.fieldNames',
            'customerSetup.routes.test',
            'customerSetup.routes.delete',
            'customerSetup.routes.archive',
            'customerSetup.blockers[].code',
            'orgAlertDelivery.alertDestinationReadiness.schemaVersion',
            'orgAlertDelivery.alertDestinationReadiness.destinationSelection.selectedDestinationIds',
            'orgAlertDelivery.alertDestinationReadiness.deliveryRetryPersistence.deliveryKeys[]',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.schemaVersion',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.requiredFields',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.persistenceTargets.idempotencyKey',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.auditReadiness.expectedNextAction',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.auditReadiness.linkedAuditEventIds',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.auditReadiness.auditMissing',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.auditReadiness.redaction',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.payloadPreview.discord.fieldNames',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.payloadPreview.context',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.payloadPreview.context.discordTemplate',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.payloadValidation.valid',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.payloadValidation.requiredDiscordFields',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.payloadValidation.limits',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.payloadValidation.redaction',
            'orgAlertDelivery.alertDestinationReadiness.alertEventConsumer.blockerCodes',
            'orgAlertDelivery.deliveryOutcome.schemaVersion',
            'orgAlertDelivery.deliveryOutcome.selectedDestinations[].latestAttempt.deliveryId',
            'orgAlertDelivery.deliveryOutcome.selectedDestinations[].preview.discord.fieldNames',
            'orgAlertDelivery.deliveryOutcome.selectedDestinations[].operationLinks.deliveryDetail',
            'orgAlertDelivery.deliveryOutcome.selectedDestinations[].operationLinks.destinationTest',
            'orgAlertDelivery.deliveryOutcome.skippedDestinations[].blockers[].code',
            'orgAlertDelivery.deliveryReadinessConsumer.schemaVersion',
            'orgAlertDelivery.deliveryReadinessConsumer.rows[].readiness.idempotentReplay',
            'orgAlertDelivery.deliveryReadinessConsumer.rows[].readiness.redactedDryRun',
            'orgAlertDelivery.deliveryReadinessConsumer.rows[].context.casePath',
            'orgAlertDelivery.deliveryReadinessConsumer.rows[].operationLinks.deliveryDetail',
            'orgAlertDelivery.deliveryReadinessConsumer.redaction.webhookSecretExposed',
            'orgAlertDelivery.organizationConsumerReceipt.schemaVersion',
            'orgAlertDelivery.organizationConsumerReceipt.consumesSchemaVersion',
            'orgAlertDelivery.organizationConsumerReceipt.destinationScope.crossOrgDestinationAllowed',
            'orgAlertDelivery.organizationConsumerReceipt.destinationScope.nonmemberDestinationEnumeration',
            'orgAlertDelivery.organizationConsumerReceipt.watchlistMatches[].destinationReadiness.dryRunReady',
            'orgAlertDelivery.organizationConsumerReceipt.destinationReceipts[].idempotencyKey',
            'orgAlertDelivery.organizationConsumerReceipt.destinationReceipts[].auditEventId',
            'orgAlertDelivery.organizationConsumerReceipt.destinationReceipts[].redactedDestination.endpointExposed',
            'orgAlertDelivery.organizationConsumerReceipt.skippedDestinations[].code',
            'orgAlertDelivery.organizationConsumerReceipt.readiness.idempotentReplayCount',
            'orgAlertDelivery.deliveryTimeline.schemaVersion',
            'orgAlertDelivery.deliveryTimeline.timelines[].latestReceipt.proof.auditEventId',
            'orgAlertDelivery.deliveryActionPlan.schemaVersion',
            'orgAlertDelivery.deliveryActionPlan.actions[].action',
            'orgAlertDelivery.deliveryReplayGuard.schemaVersion',
            'orgAlertDelivery.deliveryReplayGuard.entries[].guard.liveBlocked',
            'orgAlertDelivery.customerSetup.schemaVersion',
            'orgAlertDelivery.alertDeliveryProof.schemaVersion',
            'orgAlertDelivery.alertDeliveryProof.status',
            'orgAlertDelivery.alertDeliveryProof.alertScopedStatus',
            'orgAlertDelivery.alertDeliveryProof.noNetwork',
            'orgAlertDelivery.alertDeliveryProof.destinationSelection.selectedDestinationIds',
            'orgAlertDelivery.alertDeliveryProof.setup.stepStatuses[]',
            'orgAlertDelivery.alertDeliveryProof.delivery.latestAuditEventIds',
            'orgAlertDelivery.alertDeliveryProof.delivery.recordedDeliveryStatus',
            'orgAlertDelivery.alertDeliveryProof.delivery.recordedDestinationIds',
            'orgAlertDelivery.alertDeliveryProof.delivery.pendingDestinationIds',
            'orgAlertDelivery.alertDeliveryProof.retryAndReplay.replayReadyCount',
            'orgAlertDelivery.alertDeliveryProof.dashboardProof.productProgress.status',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.dryRunDeliveries[].body',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.dryRunDeliveries[].expectedIdempotencyKey',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.dryRunDeliveries[].expectedAuditAction',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.alertEventReadiness.schemaVersion',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.alertEventReadiness.expectedDeliveryAttempts[].idempotencyKey',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.alertEventReadiness.payloadValidation.valid',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.alertEventReadiness.redaction.webhookSecretExposed',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.liveDeliveries[].blockers[].code',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.liveDeliveries[].expectedIdempotencyKey',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.liveDeliveries[].expectedAuditAction',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.destinationTests[].route',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.destinationTests[].expectedIdempotencyKey',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.destinationTests[].expectedAuditAction',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.destinationTests[].payloadPreview.discord.fieldNames',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.deliveryHistory.query',
            'orgAlertDelivery.alertDeliveryProof.actionRequests.deliveryHistory.expectedAuditActions',
            'orgAlertDelivery.alertDeliveryProof.blockerCodes',
            'orgAlertDelivery.alertDeliveryProof.alertScopedBlockerCodes',
            'orgAlertDelivery.alertDeliveryProof.blockerGroups.setupBlockerCodes',
        ],
        expectedNoSecretFields: ['endpointUrl', 'endpointSecret', 'endpoint_encrypted'],
        expectedNoNetwork: true,
    },
}, null, 2))
