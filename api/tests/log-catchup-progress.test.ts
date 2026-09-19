import { expect, test } from 'bun:test'
import { catchupSample } from '../src/utils/mill/catchupProgress.ts'

test('catch-up starts with an exact remaining count and no invented ETA', () => {
    expect(catchupSample(4000, 900, { payload: {}, checked_count: 0, sampled_at: null }, new Date('2026-09-19T12:00:00Z'))).toMatchObject({ remaining: 4000, processed: 0, total: 4000, rate: null, estimated_seconds: null })
})
test('durable processed counts measure throughput across worker restarts', () => {
    const first = catchupSample(4000, 900, { payload: {}, checked_count: 0, sampled_at: null }, new Date('2026-09-19T12:00:00Z'))
    const second = catchupSample(3000, 1900, { payload: first, checked_count: '900', sampled_at: first.updated_at }, new Date('2026-09-19T12:01:00Z'))
    expect(second).toMatchObject({ remaining: 3000, processed: 1000, total: 4000, estimated_seconds: 180 })
    expect(second.rate).toBeCloseTo(1000 / 60)
    const paused = catchupSample(3000, 1900, { payload: second, checked_count: 1900, sampled_at: second.updated_at }, new Date('2026-09-19T12:02:00Z'))
    expect(paused).toMatchObject({ rate: null, estimated_seconds: null, processed: 1000 })
})
test('retention and new arrivals change remaining counts without fabricating processing speed', () => {
    const previous = { payload: { processed: 50 }, checked_count: 50, sampled_at: '2026-09-19T12:00:00Z' }
    expect(catchupSample(10, 50, previous, new Date('2026-09-19T12:01:00Z'))).toMatchObject({ processed: 50, total: 60, estimated_seconds: null })
    expect(catchupSample(0, 50, previous, new Date('2026-09-19T12:01:00Z'))).toMatchObject({ estimated_seconds: 0, remaining: 0 })
})
