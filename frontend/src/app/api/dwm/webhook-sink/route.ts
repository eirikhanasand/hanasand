import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    const receivedAt = new Date().toISOString()
    const eventId = request.headers.get('x-hanasand-event-id') || request.headers.get('x-webhook-id') || `dwm_sink_${Date.now()}`
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null
    const error = validateDwmWebhookPayload(payload)

    if (error) {
        return NextResponse.json({
            schemaVersion: 'dwm.webhook_sink.acceptance.v1',
            accepted: false,
            eventId,
            receivedAt,
            error,
        }, {
            status: 400,
            headers: { 'cache-control': 'no-store' },
        })
    }

    return NextResponse.json({
        schemaVersion: 'dwm.webhook_sink.acceptance.v1',
        accepted: true,
        eventId,
        receivedAt,
        summary: {
            eventType: payload?.eventType,
            matchedTerm: payload?.matchedTerm,
            reviewState: payload?.reviewState,
            severity: payload?.severity,
        },
    }, {
        status: 202,
        headers: { 'cache-control': 'no-store' },
    })
}

function validateDwmWebhookPayload(payload: Record<string, unknown> | null) {
    if (!payload) {
        return 'A JSON DWM webhook payload is required.'
    }

    if (payload.eventType === 'organization.webhook.test') {
        for (const field of ['organizationId', 'tenantId', 'webhookDestinationId', 'generatedAt', 'message', 'expectedAlertEvent']) {
            if (typeof payload[field] !== 'string' || !payload[field].trim()) return `Missing required organization webhook test field: ${field}.`
        }
        return ''
    }

    const requiredStrings = [
        'eventType',
        'severity',
        'actor',
        'company',
        'matchedTerm',
        'artifactType',
        'sourceFamily',
        'claimSummary',
        'reviewState',
        'recommendedAction',
    ]

    for (const field of requiredStrings) {
        if (typeof payload[field] !== 'string' || !payload[field].trim()) {
            return `Missing required DWM webhook field: ${field}.`
        }
    }

    if (![payload.generatedAt, payload.deliveredAt].some(value => typeof value === 'string' && value.trim())) {
        return 'Missing required DWM webhook field: generatedAt or deliveredAt.'
    }

    if (payload.eventType !== 'darkweb.monitoring.match') {
        return 'Unsupported DWM webhook event type.'
    }

    if (typeof payload.confidence !== 'number' || payload.confidence < 0 || payload.confidence > 100) {
        return 'DWM webhook confidence must be a number from 0 to 100.'
    }

    if (!Array.isArray(payload.selectedCaptureIds) && !Array.isArray(payload.pivots)) {
        return 'DWM webhook evidence references must be an array.'
    }

    if (![payload.deliveryReadinessContext, payload.webhookDelivery].some(value => value && typeof value === 'object')) {
        return 'DWM webhook delivery metadata is required.'
    }

    return ''
}
