import { NextRequest, NextResponse } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export const dynamic = 'force-dynamic'
const MAX_WEBHOOK_BYTES = 512 * 1024

export async function POST(request: Request) {
    const receivedAt = new Date().toISOString()
    const text = await request.text()
    const eventId = request.headers.get('x-hanasand-event-id')
        || request.headers.get('x-webhook-id')
        || request.headers.get('x-hanasand-delivery-id')
        || `dwm_sink_${Date.now()}`
    if (new TextEncoder().encode(text).byteLength > MAX_WEBHOOK_BYTES) {
        return NextResponse.json({
            schemaVersion: 'dwm.webhook_sink.acceptance.v1',
            accepted: false,
            eventId,
            receivedAt,
            error: 'DWM webhook payload exceeds the 512 KiB receiver limit.',
        }, {
            status: 413,
            headers: { 'cache-control': 'no-store' },
        })
    }
    const payload = parseJsonRecord(text)
    const context = webhookContext(payload)
    const error = validateDwmWebhookPayload(context)

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

    const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN || ''
    if (!serviceToken) {
        return unavailableReceiver(eventId, receivedAt)
    }
    let persisted: Response
    try {
        persisted = await fetch(`${authApiUrl().replace(/\/$/, '')}/dwm/webhook-receiver`, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                'x-hanasand-service-token': serviceToken,
            },
            body: JSON.stringify({
                eventId,
                receivedAt,
                payload,
                payloadBody: text,
                deliveryId: request.headers.get('x-hanasand-delivery-id'),
                idempotencyKey: request.headers.get('x-hanasand-dedupe-key'),
                signature: request.headers.get('x-hanasand-delivery-signature'),
            }),
            signal: AbortSignal.timeout(12_000),
        })
    } catch {
        return unavailableReceiver(eventId, receivedAt)
    }
    const persistedPayload = await persisted.json().catch(() => null) as Record<string, unknown> | null
    if (!persisted.ok || persistedPayload?.accepted !== true || !record(persistedPayload.receipt)) {
        return unavailableReceiver(eventId, receivedAt)
    }

    return NextResponse.json({
        schemaVersion: 'dwm.webhook_sink.acceptance.v1',
        accepted: true,
        eventId,
        receivedAt,
        receipt: persistedPayload.receipt,
        summary: {
            eventType: context?.eventType,
            matchedTerm: webhookMatchedTerm(context),
            reviewState: record(context?.alert)?.reviewState ?? context?.reviewState,
            severity: record(context?.alert)?.severity ?? context?.severity,
        },
    }, {
        status: 202,
        headers: { 'cache-control': 'no-store' },
    })
}

export async function GET(request: NextRequest) {
    return proxyOrganizationApiRequest(request, '/dwm/webhook-receiver', { method: 'GET' })
}

function unavailableReceiver(eventId: string, receivedAt: string) {
    return NextResponse.json({
        schemaVersion: 'dwm.webhook_sink.acceptance.v1',
        accepted: false,
        eventId,
        receivedAt,
        error: 'Durable receiver persistence is temporarily unavailable.',
    }, {
        status: 503,
        headers: { 'cache-control': 'no-store' },
    })
}

function parseJsonRecord(value: string) {
    try {
        return record(JSON.parse(value))
    } catch {
        return null
    }
}

function validateDwmWebhookPayload(payload: Record<string, unknown> | null) {
    if (!payload) {
        return 'A JSON DWM webhook payload is required.'
    }

    if (['organization.webhook.test', 'darkweb.monitoring.test'].includes(String(payload.eventType))) {
        for (const field of ['organizationId', 'tenantId', 'webhookDestinationId', 'deliveryId', 'idempotencyKey', 'generatedAt', 'message', 'expectedAlertEvent']) {
            if (typeof payload[field] !== 'string' || !payload[field].trim()) return `Missing required organization webhook test field: ${field}.`
        }
        return ''
    }

    if (payload.schemaVersion === 'dwm.webhook.v1') {
        for (const field of ['eventType', 'occurredAt', 'idempotencyKey']) {
            if (typeof payload[field] !== 'string' || !payload[field].trim()) return `Missing required DWM webhook field: ${field}.`
        }
        if (!['dwm.alert.created', 'dwm.alert.updated', 'dwm.alert.replayed', 'dwm.alert.test'].includes(String(payload.eventType))) {
            return 'Unsupported DWM webhook event type.'
        }
        for (const [name, fields] of Object.entries({
            org: ['id', 'tenantId'],
            destination: ['id', 'kind'],
            alert: ['id', 'severity', 'reviewState'],
            delivery: ['id', 'eventType'],
        })) {
            const value = record(payload[name])
            if (!value) return `Missing required DWM webhook object: ${name}.`
            for (const field of fields) {
                if (typeof value[field] !== 'string' || !value[field].trim()) return `Missing required DWM webhook field: ${name}.${field}.`
            }
        }
        if (!webhookMatchedTerm(payload)) return 'Missing required DWM webhook field: alert.matchedTerm.value.'
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
        'organizationId',
        'tenantId',
        'webhookDestinationId',
        'deliveryId',
        'idempotencyKey',
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

function webhookContext(payload: Record<string, unknown> | null) {
    return record(payload?._hanasand) ?? payload
}

function webhookMatchedTerm(payload: Record<string, unknown> | null) {
    const alert = record(payload?.alert)
    const matchedTerm = record(alert?.matchedTerm)
    return stringValue(matchedTerm?.value) || stringValue(alert?.matchedTerm) || stringValue(payload?.matchedTerm)
}

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}
