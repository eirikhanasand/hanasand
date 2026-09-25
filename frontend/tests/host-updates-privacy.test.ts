// @ts-expect-error Bun supplies the focused test runtime.
import { expect, test, mock } from 'bun:test'

mock.module('@/utils/vms/hostAccess', () => ({ canViewHostMetrics: async () => false }))
const { GET } = await import('../src/app/api/recovery/route')

test('public recovery responses exclude private package telemetry', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => Response.json({ mode: 'normal', hostMetrics: { cpuPercent: 10, aptUpdates: { pending_updates: [{ package: 'private-package', version: '1' }] } } })) as typeof fetch
    try {
        const response = await GET()
        expect(await response.json()).toEqual({ mode: 'normal', hostMetrics: { cpuPercent: 10 } })
    } finally {
        globalThis.fetch = originalFetch
    }
})
