import { afterEach, expect, test } from 'bun:test'
import { readSnapshot } from './pull-ovh-host-metrics.ts'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('reads fresh OVH host metrics and tolerates missing disk diagnostics', async () => {
    globalThis.fetch = async url => {
        if (String(url).endsWith('/status')) {
            return new Response(JSON.stringify({
                site: 'ovhcloud',
                hostMetrics: { sampledAt: '2026-09-28T00:00:00.000Z', cpuPercent: 10 },
            }))
        }
        throw new Error('diagnostic tunnel unavailable')
    }

    await expect(readSnapshot(Date.parse('2026-09-28T00:00:30.000Z'))).resolves.toEqual({
        host: { sampledAt: '2026-09-28T00:00:00.000Z', cpuPercent: 10 },
        diagnostics: null,
    })
})

test('rejects stale, future, and wrong-site snapshots', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
        site: 'ovhcloud', hostMetrics: { sampledAt: '2026-09-27T23:58:00.000Z' },
    }))
    await expect(readSnapshot(Date.parse('2026-09-28T00:00:00.000Z'))).rejects.toThrow('stale')

    globalThis.fetch = async () => new Response(JSON.stringify({
        site: 'inspur', hostMetrics: { sampledAt: '2026-09-28T00:00:00.000Z' },
    }))
    await expect(readSnapshot(Date.parse('2026-09-28T00:00:00.000Z'))).rejects.toThrow('Expected OVH')
})

test('rejects oversized host snapshots', async () => {
    globalThis.fetch = async () => new Response(new Uint8Array(1_048_577))
    await expect(readSnapshot()).rejects.toThrow('too large')
})
