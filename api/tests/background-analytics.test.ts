import { afterAll, afterEach, expect, mock, spyOn, test } from 'bun:test'

const originalEssential = process.env.RESILIENCE_ESSENTIAL_ONLY
const originalAuth = process.env.AUTH_SERVICE_ONLY
const warmLogs = mock(async () => {})
const stopLogs = mock(() => {})
const refreshLogs = mock(() => stopLogs)
const warmTraffic = mock(async () => {})
const stopTraffic = mock(() => {})
const refreshTraffic = mock(() => stopTraffic)
const warn = mock(() => {})
mock.module('../src/utils/logs/warm.ts', () => ({ warmLogSnapshots: warmLogs, refreshLogSnapshots: refreshLogs }))
mock.module('../src/handlers/traffic/legacy.ts', () => ({ warmTrafficStatistics: warmTraffic }))
mock.module('../src/utils/traffic/history.ts', () => ({ refreshTrafficHistory: refreshTraffic }))
const { startBackgroundAnalytics } = await import('../src/utils/backgroundAnalytics.ts')
const intervals = spyOn(globalThis, 'setInterval')
let stop: (() => void) | undefined
afterAll(() => intervals.mockRestore())
afterEach(() => {
    stop?.()
    stop = undefined
    for (const fn of [warmLogs, stopLogs, refreshLogs, warmTraffic, stopTraffic, refreshTraffic, warn, intervals]) fn.mockClear()
    if (originalEssential === undefined) delete process.env.RESILIENCE_ESSENTIAL_ONLY
    else process.env.RESILIENCE_ESSENTIAL_ONLY = originalEssential
    if (originalAuth === undefined) delete process.env.AUTH_SERVICE_ONLY
    else process.env.AUTH_SERVICE_ONLY = originalAuth
})

test('backup API starts no analytics queries or refresh timers', async () => {
    process.env.RESILIENCE_ESSENTIAL_ONLY = '1'
    stop = await startBackgroundAnalytics({ warn })
    for (const fn of [warmLogs, refreshLogs, warmTraffic, refreshTraffic, intervals]) expect(fn).not.toHaveBeenCalled()
})

test('primary analytics retain warming, refresh and shutdown', async () => {
    delete process.env.RESILIENCE_ESSENTIAL_ONLY
    delete process.env.AUTH_SERVICE_ONLY
    stop = await startBackgroundAnalytics({ warn })
    for (const fn of [warmLogs, refreshLogs, warmTraffic, refreshTraffic, intervals]) expect(fn).toHaveBeenCalledTimes(1)
    stop()
    stop = undefined
    expect(stopLogs).toHaveBeenCalledTimes(1)
    expect(stopTraffic).toHaveBeenCalledTimes(1)
})

test('auth workers retain log warming without traffic analytics', async () => {
    delete process.env.RESILIENCE_ESSENTIAL_ONLY
    process.env.AUTH_SERVICE_ONLY = '1'
    stop = await startBackgroundAnalytics({ warn })
    expect(warmLogs).toHaveBeenCalledTimes(1)
    for (const fn of [warmTraffic, refreshTraffic, intervals]) expect(fn).not.toHaveBeenCalled()
})

test('traffic warm failure keeps retries and shutdown available', async () => {
    delete process.env.RESILIENCE_ESSENTIAL_ONLY
    delete process.env.AUTH_SERVICE_ONLY
    warmTraffic.mockRejectedValueOnce(new Error('Database busy'))
    stop = await startBackgroundAnalytics({ warn })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(intervals).toHaveBeenCalledTimes(1)
    expect(refreshTraffic).toHaveBeenCalledTimes(1)
})
