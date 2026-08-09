import { describe, expect, test } from 'bun:test'
import { destinationTestResponseOutcome, deliveryResponseOutcome } from '../src/handlers/dwm/webhooks.ts'

describe('DWM webhook destination test response', () => {
    test('returns a failure response when the persisted test row failed', () => {
        expect(destinationTestResponseOutcome({ status: 'failed' })).toEqual({
            status: 502,
            failed: true,
            code: 'webhook_destination_test_failed',
            error: 'Webhook destination test failed.',
        })
        expect(destinationTestResponseOutcome({ status: 'delivered', error: 'transport failed' }).status).toBe(502)
    })

    test('keeps accepted status for durable non-failed outcomes', () => {
        expect(destinationTestResponseOutcome({ status: 'dry_run' })).toEqual({ status: 202, failed: false })
        expect(destinationTestResponseOutcome({ status: 'delivered' })).toEqual({ status: 202, failed: false })
    })

    test('does not report a durable failed delivery as accepted', () => {
        expect(deliveryResponseOutcome([{ status: 'failed', error: 'receiver unavailable' }])).toEqual({
            status: 502,
            failed: true,
            code: 'webhook_delivery_failed',
            error: 'Webhook delivery failed.',
        })
        expect(deliveryResponseOutcome([{ status: 'dry_run' }, { status: 'skipped' }])).toEqual({ status: 202, failed: false })
        expect(deliveryResponseOutcome([{ status: 'delivered' }])).toEqual({ status: 202, failed: false })
    })
})
