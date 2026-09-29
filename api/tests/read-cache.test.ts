import { expect, test } from 'bun:test'
import { cachedRead } from '../src/utils/readCache.ts'

test('preview reads admit a thousand queued requests without a false capacity timeout', async () => {
    let active = 0
    let peak = 0
    const results = await Promise.all(Array.from({ length: 1000 }, (_, index) => cachedRead(`preview-capacity-${index}`, 0, async () => {
        active += 1
        peak = Math.max(peak, active)
        await Promise.resolve()
        active -= 1
        return index
    }, { lane: 'preview' })))

    expect(results).toHaveLength(1000)
    expect(new Set(results).size).toBe(1000)
    expect(peak).toBeLessThanOrEqual(8)
})
