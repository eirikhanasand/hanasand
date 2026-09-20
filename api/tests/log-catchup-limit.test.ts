import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLogCatchupLimit, readLogCatchupSettings } from '../src/utils/mill/catchupLimit.ts'

let directory: string, path: string
const originalHistoryLimit = process.env.LOG_CATCHUP_HISTORY_LIMIT
const now = 1_000_000
beforeEach(() => { delete process.env.LOG_CATCHUP_HISTORY_LIMIT; directory = mkdtempSync(join(tmpdir(), 'catchup-limit-')); path = join(directory, 'trial.json') })
afterEach(() => {
    rmSync(directory, { recursive: true })
    if (originalHistoryLimit === undefined) delete process.env.LOG_CATCHUP_HISTORY_LIMIT
    else process.env.LOG_CATCHUP_HISTORY_LIMIT = originalHistoryLimit
})
test('persistent history limit is independent of fresh admission and restored after a trial', () => {
    process.env.LOG_CATCHUP_HISTORY_LIMIT = '5000'
    expect(readLogCatchupSettings(path, '1000', now).historyLimit).toBe(5000)
    expect(readLogCatchupSettings(path, '1000', now).limit).toBe(1000)
    writeFileSync(path, JSON.stringify({ limit: 100, historyLimit: 10000, expiresAt: now + 100 }))
    expect(readLogCatchupSettings(path, '1000', now + 100).historyLimit).toBe(5000)
    process.env.LOG_CATCHUP_HISTORY_LIMIT = '10001'
    expect(() => readLogCatchupSettings(path, '1000', now)).toThrow()
})
test('missing and expired trials retain the validated operator limit', () => {
    expect(readLogCatchupLimit(path, '100', now)).toBe(100)
    writeFileSync(path, JSON.stringify({ limit: 250, expiresAt: now }))
    expect(readLogCatchupLimit(path, '100', now)).toBe(100)
})
test('the same running worker observes trial changes and expires without a controller or restart', () => {
    writeFileSync(path, JSON.stringify({ limit: 250, expiresAt: now + 300_000 }))
    expect(readLogCatchupLimit(path, '100', now)).toBe(250)
    writeFileSync(path, JSON.stringify({ limit: 100, expiresAt: now + 300_000 }))
    expect(readLogCatchupLimit(path, '100', now + 10)).toBe(100)
    writeFileSync(path, JSON.stringify({ limit: 1000, expiresAt: now + 300_000 }))
    expect(readLogCatchupLimit(path, '100', now + 20)).toBe(1000)
    expect(readLogCatchupLimit(path, '100', now + 300_000)).toBe(100)
})
for (const trial of [
    { limit: 0, expiresAt: now + 1 }, { limit: 1001, expiresAt: now + 1 },
    { limit: 1.5, expiresAt: now + 1 }, { limit: '250', expiresAt: now + 1 },
    { limit: 250 }, { limit: 250, expiresAt: 'soon' },
    { limit: 250, expiresAt: now + 600_001 }, null, [],
]) test('invalid trial cannot raise or silently replace the operator limit: ' + JSON.stringify(trial), () => {
    writeFileSync(path, JSON.stringify(trial))
    expect(() => readLogCatchupLimit(path, '100', now)).toThrow()
})
test('malformed configuration and invalid fallback stay visible', () => {
    writeFileSync(path, '{')
    expect(() => readLogCatchupLimit(path, '100', now)).toThrow()
    writeFileSync(path, JSON.stringify({ limit: 250, expiresAt: now + 100 }))
    expect(() => readLogCatchupLimit(path, '0', now)).toThrow()
})

test('cadence and batch size expire together without a restart', () => {
    writeFileSync(path, JSON.stringify({ limit: 1000, intervalMs: 100, expiresAt: now + 300_000 }))
    expect(readLogCatchupSettings(path, '100', now)).toEqual({ limit: 1000, historyLimit: 1000, intervalMs: 100 })
    expect(readLogCatchupSettings(path, '100', now + 300_000)).toEqual({ limit: 100, historyLimit: 100, intervalMs: 5000 })
})
for (const historyLimit of [5000, 10000]) test(`historical trial ${historyLimit} does not increase fresh work and expires`, () => {
    writeFileSync(path, JSON.stringify({ limit: 1000, historyLimit, expiresAt: now + 300_000 }))
    expect(readLogCatchupSettings(path, '100', now)).toEqual({ limit: 1000, historyLimit, intervalMs: 5000 })
    expect(readLogCatchupSettings(path, '100', now + 300_000).historyLimit).toBe(100)
})
for (const historyLimit of [0, 10001, 1.5, '5000']) test(`invalid historical limit ${historyLimit} is rejected`, () => {
    writeFileSync(path, JSON.stringify({ limit: 1000, historyLimit, expiresAt: now + 100 }))
    expect(() => readLogCatchupSettings(path, '100', now)).toThrow()
})
for (const intervalMs of [0, 49, 5001, 100.5, '100']) test(`invalid cadence ${intervalMs} cannot accelerate processing`, () => {
    writeFileSync(path, JSON.stringify({ limit: 1000, intervalMs, expiresAt: now + 100 }))
    expect(() => readLogCatchupSettings(path, '100', now)).toThrow()
})
