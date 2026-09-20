import { expect, test } from 'bun:test'
import { tiAutomaticReviewJob } from '../src/utils/systemCron.ts'

const telemetry = { scope: 'unavailable' as const, cpuPercent: null, memoryRssMb: null, memoryUsedMb: null, queueDepth: null, note: '' }

test('automatic review distinguishes paused, enabled, running and unavailable workers', () => {
    for (const [flag, counts, expected] of [
        [false, { running: 3 }, 'paused'],
        [true, {}, 'enabled'],
        [true, { running: 1 }, 'running'],
        [undefined, {}, 'blocked'],
    ] as const) {
        const job = tiAutomaticReviewJob({ ok: true, status: 200, error: null, json: { pressure: { automaticReview: { enabled: flag, counts } } } }, telemetry)
        expect(job.status).toBe(expected)
        expect(job.enabled).toBe(flag === true)
        expect(job.running).toBe(expected === 'running')
    }
    const unavailable = tiAutomaticReviewJob({ ok: false, status: 503, error: 'TI scraper returned 503', json: { pressure: { automaticReview: { enabled: false } } } }, telemetry)
    expect(unavailable.status).toBe('blocked')
    expect(unavailable.lastError).toBe('TI scraper returned 503')
})
