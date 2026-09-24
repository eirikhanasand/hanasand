import { expect, test } from 'bun:test'
import { buildDwmWebhookTestAlert, buildDwmAlertDeliveryPayload } from '../src/utils/dwm/webhooks'

test('each explicit example test has a distinct identity and truthful message', () => {
    const destination = { id: 'destination', kind: 'webhook' as const, name: 'Example', org_id: 'org' }
    const first = buildDwmWebhookTestAlert(destination)
    const second = buildDwmWebhookTestAlert(destination)
    expect(first.id).not.toBe(second.id)
    expect(first.claimSummary).toContain('example message')
    expect(first.claimSummary).not.toContain('dry-run')
    const payload = buildDwmAlertDeliveryPayload({ destination, alert: first, eventType: 'dwm.alert.test' })
    const nextPayload = buildDwmAlertDeliveryPayload({ destination, alert: second, eventType: 'dwm.alert.test' })
    expect((payload as { idempotencyKey: string }).idempotencyKey).not.toBe((nextPayload as { idempotencyKey: string }).idempotencyKey)
    expect(JSON.stringify(payload)).toContain(first.id)
    expect(JSON.stringify(payload)).toContain('Hanasand delivery test')
})

test('destination preview identity stays stable without sending', () => {
    expect(buildDwmWebhookTestAlert({ org_id: 'org' }, 'preview')).toEqual(buildDwmWebhookTestAlert({ org_id: 'org' }, 'preview'))
})
