import { strict as assert } from 'node:assert'
import test from 'node:test'
import { POST } from '../src/app/api/dwm/webhook-sink/route.ts'

const payload = {
    schemaVersion: 'dwm.webhook.v1',
    eventType: 'dwm.alert.updated',
    occurredAt: '2026-07-24T10:00:00.000Z',
    idempotencyKey: 'dwm.alert.updated:org_1:destination_1:report_1',
    org: { id: 'org_1', tenantId: 'org_1' },
    destination: { id: 'destination_1', kind: 'webhook' },
    alert: {
        id: 'alert_1',
        severity: 'high',
        reviewState: 'confirmed',
        matchedTerm: { value: 'example.org' },
    },
    delivery: { id: 'delivery_1', eventType: 'dwm.alert.updated' },
}

test('acknowledges a webhook only after the central API persists its receiver receipt', async () => {
    const previousFetch = globalThis.fetch
    const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
    process.env.TI_SCRAPER_SERVICE_TOKEN = 'service-token'
    const persisted: Request[] = []
    globalThis.fetch = async (input, init) => {
        persisted.push(new Request(input, init))
        return Response.json({
            accepted: true,
            created: true,
            receipt: {
                id: 'receiver_receipt_1',
                deliveryId: 'delivery_1',
                payloadHash: 'payload_1',
            },
        }, { status: 201 })
    }
    try {
        const payloadBody = JSON.stringify(payload, null, 2)
        const accepted = await POST(new Request('http://local/api/dwm/webhook-sink', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-hanasand-event-id': 'event_1',
                'x-hanasand-delivery-id': 'delivery_1',
                'x-hanasand-dedupe-key': payload.idempotencyKey,
                'x-hanasand-delivery-signature': 'sha256=signed-by-api',
            },
            body: payloadBody,
        }))
        assert.equal(accepted.status, 202)
        assert.deepEqual(await accepted.json(), {
            schemaVersion: 'dwm.webhook_sink.acceptance.v1',
            accepted: true,
            eventId: 'event_1',
            receivedAt: (await persisted[0].clone().json()).receivedAt,
            receipt: {
                id: 'receiver_receipt_1',
                deliveryId: 'delivery_1',
                payloadHash: 'payload_1',
            },
            summary: {
                eventType: 'dwm.alert.updated',
                matchedTerm: 'example.org',
                reviewState: 'confirmed',
                severity: 'high',
            },
        })
        assert.equal(persisted.length, 1)
        assert.equal(new URL(persisted[0].url).pathname, '/api/dwm/webhook-receiver')
        assert.equal(persisted[0].headers.get('x-hanasand-service-token'), 'service-token')
        assert.deepEqual(await persisted[0].clone().json(), {
            eventId: 'event_1',
            receivedAt: (await persisted[0].clone().json()).receivedAt,
            payload,
            payloadBody,
            deliveryId: 'delivery_1',
            idempotencyKey: payload.idempotencyKey,
            signature: 'sha256=signed-by-api',
        })

        globalThis.fetch = async () => {
            throw new Error('central API unavailable')
        }
        const unavailable = await POST(new Request('http://local/api/dwm/webhook-sink', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        }))
        assert.equal(unavailable.status, 503)
        assert.equal((await unavailable.json()).accepted, false)

        const oversized = await POST(new Request('http://local/api/dwm/webhook-sink', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: `{"padding":"${'x'.repeat(512 * 1024)}"}`,
        }))
        assert.equal(oversized.status, 413)
        assert.match(String((await oversized.json()).error), /512 KiB/)
    } finally {
        globalThis.fetch = previousFetch
        if (previousToken === undefined) delete process.env.TI_SCRAPER_SERVICE_TOKEN
        else process.env.TI_SCRAPER_SERVICE_TOKEN = previousToken
    }
})

test('keeps scraper-owned legacy delivery in its authoritative sender ledger', async () => {
    const previousFetch = globalThis.fetch
    let centralCalls = 0
    globalThis.fetch = async () => {
        centralCalls += 1
        throw new Error('legacy delivery must not cross stores')
    }
    try {
        const response = await POST(new Request('http://local/api/dwm/webhook-sink', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                eventType: 'organization.webhook.test',
                organizationId: 'org_1',
                tenantId: 'org_1',
                webhookDestinationId: 'destination_1',
                generatedAt: '2026-07-24T10:00:00.000Z',
                message: 'Hanasand organization webhook test.',
                expectedAlertEvent: 'darkweb.monitoring.match',
            }),
        }))
        assert.equal(response.status, 202)
        const responseBody = await response.json()
        assert.deepEqual(responseBody, {
            schemaVersion: 'dwm.webhook_sink.transport_ack.v1',
            accepted: true,
            durableReceiverReceipt: false,
            eventId: responseBody.eventId,
            receivedAt: responseBody.receivedAt,
            summary: {
                eventType: 'organization.webhook.test',
                matchedTerm: '',
            },
        })
        assert.equal(centralCalls, 0)
    } finally {
        globalThis.fetch = previousFetch
    }
})
