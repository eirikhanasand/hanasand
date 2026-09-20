import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLogCatchupLimit, readLogCatchupSettings } from '../src/utils/mill/catchupLimit.ts'

let directory: string, path: string
const now = 1_000_000
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'catchup-limit-')); path = join(directory, 'trial.json') })
afterEach(() => rmSync(directory, { recursive: true }))
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
    expect(readLogCatchupSettings(path, '100', now)).toEqual({ limit: 1000, intervalMs: 100 })
    expect(readLogCatchupSettings(path, '100', now + 300_000)).toEqual({ limit: 100, intervalMs: 5000 })
})
for (const intervalMs of [0, 49, 5001, 100.5, '100']) test(`invalid cadence ${intervalMs} cannot accelerate processing`, () => {
    writeFileSync(path, JSON.stringify({ limit: 1000, intervalMs, expiresAt: now + 100 }))
    expect(() => readLogCatchupSettings(path, '100', now)).toThrow()
})
