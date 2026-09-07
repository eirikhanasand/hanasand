import { afterEach, expect, setSystemTime, test } from 'bun:test'
import { cachedLogQuery } from '../src/utils/logs/cache.ts'

afterEach(() => setSystemTime())

test('cold concurrent readers share work and warm reads reuse it', async () => {
    let calls = 0
    let finish!: (value: number) => void
    const load = () => { calls++; return new Promise<number>(resolve => { finish = resolve }) }
    const a = cachedLogQuery('concurrent', 5000, load)
    const b = cachedLogQuery('concurrent', 5000, load)
    expect(calls).toBe(1)
    finish(42)
    expect(await Promise.all([a, b])).toEqual([42, 42])
    expect(await cachedLogQuery('concurrent', 5000, load)).toBe(42)
    expect(calls).toBe(1)
})

test('expired snapshots return immediately while one refresh runs', async () => {
    const now = Date.now()
    setSystemTime(now)
    await cachedLogQuery('refresh', 1000, async () => 'old')
    setSystemTime(now + 1001)
    let finish!: (value: string) => void
    let calls = 0
    const load = () => { calls++; return new Promise<string>(resolve => { finish = resolve }) }
    expect(await cachedLogQuery('refresh', 1000, load)).toBe('old')
    expect(await cachedLogQuery('refresh', 1000, load)).toBe('old')
    expect(calls).toBe(1)
    finish('new')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(await cachedLogQuery('refresh', 1000, load)).toBe('new')
})

test('failed cold loads reject and stale records are not served indefinitely', async () => {
    const fail = async () => { throw new Error('database unavailable') }
    await expect(cachedLogQuery('cold-failure', 1000, fail)).rejects.toThrow('database unavailable')
    const now = Date.now()
    setSystemTime(now)
    await cachedLogQuery('old-failure', 1000, async () => 'old')
    setSystemTime(now + 1001)
    expect(await cachedLogQuery('old-failure', 1000, fail)).toBe('old')
    await new Promise(resolve => setTimeout(resolve, 0))
    setSystemTime(now + 301_000)
    await expect(cachedLogQuery('old-failure', 1000, fail)).rejects.toThrow('database unavailable')
})

test('distinct filters cannot reuse another query result', async () => {
    expect(await cachedLogQuery('filter:a', 5000, async () => 'a')).toBe('a')
    expect(await cachedLogQuery('filter:b', 5000, async () => 'b')).toBe('b')
})
