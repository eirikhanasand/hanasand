import { expect, test } from '@playwright/test'

const validPayload = {
    schemaVersion: 'dwm.webhook.v1',
    eventType: 'dwm.alert.created',
    occurredAt: '2026-07-22T08:14:00.000Z',
    idempotencyKey: 'dwm.alert.created:org-live:destination-live:alert-live',
    org: { id: 'org-live', name: 'Live tenant', tenantId: 'org-live' },
    destination: { id: 'destination-live', name: 'Acceptance receiver', kind: 'webhook' },
    alert: {
        id: 'alert-live',
        severity: 'critical',
        matchedTerm: { value: 'tenant.example', kind: 'domain' },
        reviewState: 'needs_review',
        sourceFamily: 'restricted_metadata',
    },
    watchlist: { id: 'watchlist-live', name: 'Production watchlist', terms: ['tenant.example'] },
    delivery: { id: 'delivery-live', eventType: 'dwm.alert.created', replay: false },
    source: { family: 'restricted_metadata', artifactType: 'victim_claim', confidence: { score: 88 } },
}

test('public DWM webhook receiver accepts the real delivery payload contract', async ({ request }) => {
    const accepted = await request.post('/api/dwm/webhook-sink', {
        headers: { 'x-hanasand-event-id': 'preview_contract_ok' },
        data: validPayload,
    })

    expect(accepted.status()).toBe(202)
    await expect(accepted).toBeOK()
    await expect(accepted.json()).resolves.toMatchObject({
        accepted: true,
        eventId: 'preview_contract_ok',
        summary: {
            eventType: 'dwm.alert.created',
            matchedTerm: 'tenant.example',
            reviewState: 'needs_review',
            severity: 'critical',
        },
    })

    const rejected = await request.post('/api/dwm/webhook-sink', {
        headers: { 'x-hanasand-event-id': 'preview_contract_bad' },
        data: { ...validPayload, alert: { severity: 'critical', reviewState: 'needs_review' } },
    })

    expect(rejected.status()).toBe(400)
    await expect(rejected.json()).resolves.toMatchObject({
        accepted: false,
        eventId: 'preview_contract_bad',
        error: 'Missing required DWM webhook field: alert.id.',
    })
})
