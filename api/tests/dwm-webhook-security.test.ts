import { describe, expect, test } from 'bun:test'
import { assertPublicWebhookTarget, buildDwmAlertDeliveryPayload, normalizeDwmWebhookDestinationInput, pinnedWebhookLookup } from '../src/utils/dwm/webhooks.ts'

describe('DWM webhook network boundary', () => {
    test('rejects local and private literal destinations before encryption', () => {
        for (const endpointUrl of [
            'https://localhost/hook',
            'https://127.0.0.1/hook',
            'https://10.0.0.1/hook',
            'https://169.254.169.254/latest/meta-data',
            'https://[::1]/hook',
            'https://[::ffff:7f00:1]/hook',
            'https://user:pass@example.com/hook',
        ]) {
            expect(() => normalizeDwmWebhookDestinationInput({ endpointUrl }, 'owner')).toThrow()
        }
    })

    test('rejects private DNS answers and accepts a public pinned target', async () => {
        const privateResolver = async () => [{ address: '10.0.0.2', family: 4 }]
        const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }]

        await expect(assertPublicWebhookTarget('https://hooks.example.com/alerts', privateResolver)).rejects.toThrow('private network')
        await expect(assertPublicWebhookTarget('https://hooks.example.com/alerts', publicResolver)).resolves.toBe('https://hooks.example.com/alerts')
    })

    test('returns pinned addresses in the shape requested by Node HTTPS', async () => {
        const pinned = pinnedWebhookLookup([
            { address: '2001:db8::10', family: 6 },
            { address: '93.184.216.34', family: 4 },
        ])
        const all = await new Promise<unknown>((resolve, reject) => pinned('hooks.example.com', { all: true }, (error, result) => error ? reject(error) : resolve(result)))
        const ipv4 = await new Promise<unknown>((resolve, reject) => pinned('hooks.example.com', { family: 4 }, (error, result) => error ? reject(error) : resolve(result)))

        expect(all).toEqual([
            { address: '2001:db8::10', family: 6 },
            { address: '93.184.216.34', family: 4 },
        ])
        expect(ipv4).toBe('93.184.216.34')
    })

    test('preserves scraper evidence excerpts and observation timestamps', () => {
        const payload = buildDwmAlertDeliveryPayload({
            destination: { id: 'destination_1', kind: 'webhook', name: 'Customer receiver', org_id: 'org_1' },
            eventType: 'dwm.alert.created',
            deliveryId: 'delivery_1',
            alert: {
                id: 'alert_1',
                title: 'APT29 source mention',
                severity: 'low',
                matchedTerm: { value: 'APT29', kind: 'actor' },
                firstSeenAt: '2026-07-21T07:15:42.826Z',
                evidence: [{
                    sourceName: 'Public threat report',
                    excerpt: 'Public reporting attributes the activity to APT29.',
                    observedAt: '2026-07-21T07:15:42.826Z',
                }],
            },
        }) as any

        expect(payload.alert.evidence).toEqual([{
            label: 'Evidence',
            detail: 'Public reporting attributes the activity to APT29.',
            source: 'Public threat report',
            capturedAt: '2026-07-21T07:15:42.826Z',
        }])
        expect(payload.alert.evidenceTimestamp).toBe('2026-07-21T07:15:42.826Z')
    })
})
