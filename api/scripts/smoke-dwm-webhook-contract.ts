import {
    buildDwmAlertDeliveryPayload,
    buildDwmAlertWebhookDispatchPlan,
    normalizeDwmWebhookDestinationInput,
    redactWebhookEndpoint,
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
expect(serialized.includes('customer_discord'), 'Payload should include route.', payload)
expect(serialized.includes('dwm_dedupe_acme_contract'), 'Payload should include alert dedupe key.', payload)
expect(serialized.includes('dwm.alert.replayed:org_contract:destination_contract:dwm_dedupe_acme_contract'), 'Payload should include destination idempotency key.', payload)
expect(serialized.includes('/dashboard/dwm?alert=alert_contract'), 'Payload should include case path.', payload)
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
        'secret-free payload',
    ],
}, null, 2))
