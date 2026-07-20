import { expect, test } from '@playwright/test'

const validPayload = {
    eventType: 'darkweb.monitoring.match',
    generatedAt: '2026-07-03T02:14:00.000Z',
    severity: 'critical',
    actor: 'Akira',
    company: 'Acme Payments',
    matchedTerm: 'acme.com',
    artifactType: 'telegram_stealer_log_hint',
    sourceFamily: 'telegram_public + restricted_metadata',
    sourceName: 'monitored Telegram broker room and leak-site update',
    sourceUrl: 'https://hanasand.com/ti/Acme%20Payments',
    claimSummary: 'Telegram broker post and leak-site update mention a watched company.',
    firstSeenAt: '2026-07-03T02:08:00.000Z',
    confidence: 88,
    sourceCount: 5,
    reviewState: 'needs_review',
    recommendedAction: 'Confirm the company match and route to incident response.',
    selectedCaptureIds: ['cap_akira_acme'],
    deliveryReadinessContext: {
        deliveryDedupeKey: 'dwm_dedupe_akira_acme',
    },
}

test('public DWM webhook receiver validates sample payload shape before accepting', async ({ request }) => {
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
            eventType: 'darkweb.monitoring.match',
            matchedTerm: 'acme.com',
            reviewState: 'needs_review',
            severity: 'critical',
        },
    })

    const rejected = await request.post('/api/dwm/webhook-sink', {
        headers: { 'x-hanasand-event-id': 'preview_contract_bad' },
        data: { eventType: 'darkweb.monitoring.match', confidence: 88 },
    })

    expect(rejected.status()).toBe(400)
    await expect(rejected.json()).resolves.toMatchObject({
        accepted: false,
        eventId: 'preview_contract_bad',
        error: 'Missing required DWM webhook field: severity.',
    })
})
