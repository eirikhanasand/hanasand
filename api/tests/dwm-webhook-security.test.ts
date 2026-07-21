import { describe, expect, test } from 'bun:test'
import { assertPublicWebhookTarget, normalizeDwmWebhookDestinationInput, pinnedWebhookLookup } from '../src/utils/dwm/webhooks.ts'

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
})
