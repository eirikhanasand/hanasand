// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { exposureQueueFallback, normalizeExposureQueue } from '@/app/exposureQueue'
import { readFile } from 'node:fs/promises'

test('exposure failures never mint timestamps or empty-success state', async () => {
    expect(exposureQueueFallback('unavailable', 10)).toMatchObject({
        generatedAt: '',
        status: 'unavailable',
        items: [],
    })
    expect(normalizeExposureQueue({ items: [] })).toMatchObject({ generatedAt: '', status: 'unavailable' })
    expect(normalizeExposureQueue({ generatedAt: '2026-08-09T00:00:00.000Z', status: 'stale', items: [] })).toMatchObject({
        generatedAt: '2026-08-09T00:00:00.000Z',
        status: 'stale',
    })

    const [home, activity] = await Promise.all([
        readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/app/activity/page.tsx', import.meta.url), 'utf8'),
    ])
    expect(home).toContain('exposureQueueFallback(\'unavailable\', 10)')
    expect(activity).toContain('exposureQueueFallback(\'unavailable\', 50)')
    expect(home).not.toContain('exposureQueueFallback(isTimeoutError(error)')
    expect(activity).not.toContain('exposureQueueFallback(isTimeoutError(error)')
})
