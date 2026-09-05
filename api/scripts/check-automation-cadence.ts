import assert from 'node:assert/strict'
import { computeNextRunAt } from '../src/utils/automations.ts'

const start = Date.parse('2026-09-06T12:00:00.000Z')
const next = (completedAt: number, intervalMinutes = 1) => computeNextRunAt({
    scheduleKind: 'interval', intervalMinutes, runAt: null, from: new Date(completedAt),
})!.getTime()

// Simulate the real minute poller, including slow checks and millisecond jitter.
for (const duration of [0, 175, 396, 999, 30_000, 59_990]) {
    let dueAt = start
    for (let minute = 0; minute < 10; minute++) {
        const tick = start + minute * 60_000 + 5
        assert.ok(dueAt <= tick, `Missed minute ${minute} after a ${duration}ms check`)
        dueAt = next(tick + duration)
        assert.ok(dueAt > tick + duration, 'Next run must remain in the future')
    }
}
assert.equal(next(start + 396, 5), start + 5 * 60_000)
assert.equal(next(start + 90_000), start + 2 * 60_000)
assert.equal(next(start + 396, 0), start + 60 * 60_000)
assert.equal(next(start + 396, 1440), start + 24 * 60 * 60_000)
const runAt = new Date(start + 12_345)
for (const scheduleKind of ['once', 'interval'] as const) {
    assert.equal(computeNextRunAt({ scheduleKind, intervalMinutes: 1, runAt, from: new Date(start) }), runAt)
}
assert.equal(computeNextRunAt({ scheduleKind: 'once', intervalMinutes: null, runAt: new Date(start - 2000), from: new Date(start) }), null)
console.log('Automation cadence passed: minute ticks, runtime jitter, long checks, longer intervals and explicit run times.')
