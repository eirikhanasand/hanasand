import { beforeEach, expect, mock, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import tls from 'node:tls'

let clock = 0, requests = 0, failures = 0, tlsDuration = 0, requestDuration = 20, throwTimeout = false, unavailable = 0
const waits: number[] = [], timeouts: number[] = [], snapshots: number[] = []
const actualNow = Date.now
mock.module('node:timers/promises', () => ({ setTimeout: async (ms: number) => { waits.push(ms); clock += ms } }))
mock.module('../src/utils/publicMonitoringRequest.ts', () => ({
    monitoringUrl: (value: URL) => value,
    resolveMonitoringAddresses: async () => [{ address: '93.184.215.14', family: 4 }],
    monitoringLookup: () => () => {},
    publicMonitoringRequest: async (_target: URL, options: { timeoutMs: number }) => {
        timeouts.push(options.timeoutMs)
        requests++
        clock += requestDuration
        if (requests <= unavailable) throw new Error('Connection refused')
        if (throwTimeout) throw new DOMException('Timed out', 'TimeoutError')
        return { status: requests <= failures ? 503 : 200, body: '' }
    },
}))
mock.module('node:tls', () => ({ ...tls, connect: () => {
    const socket = Object.assign(new EventEmitter(), { authorized: true, setTimeout() {}, destroy() {},
        getPeerCertificate: () => ({ valid_to: new Date(actualNow() + 86400000 * 60).toUTCString(), subject: {}, issuer: {} }) })
    queueMicrotask(() => { clock += tlsDuration; socket.emit('secureConnect') })
    return socket
} }))
mock.module('../src/utils/jsonMonitoring.ts', () => ({
    normalizeJsonRule: (rule: unknown) => rule,
    evaluateJsonRule: (payload: { bad: boolean }) => ({ exceeded: payload.bad, observed: payload.bad }),
    sharedJsonSnapshot: async (_source: unknown, attempt: number) => {
        snapshots.push(attempt)
        if (attempt < unavailable) throw new Error('OVH host telemetry is unavailable.')
        return { payload: { bad: attempt < failures }, certificate: { status: 'not_applicable' } }
    },
}))
const { runMonitoringCheck } = await import('../src/utils/automations.ts')
import type { AutomationRow } from '../src/utils/automations.ts'
const monitor = { monitoring_type: 'fetch', target_url: 'http://example.test', timeout_seconds: 5, retry_count: 4 } as AutomationRow
beforeEach(() => { clock = 0; requests = 0; failures = 0; tlsDuration = 0; requestDuration = 20; throwTimeout = false; unavailable = 0; waits.length = 0; timeouts.length = 0; snapshots.length = 0 })
async function check(input = monitor) {
    Date.now = () => actualNow() + clock
    try { return await runMonitoringCheck(input) } finally { Date.now = actualNow }
}
test('a successful first check does not retry or wait', async () => {
    expect((await check()).warning).toBe(false)
    expect(requests).toBe(1)
    expect(waits).toEqual([])
    expect(timeouts[0]).toBeLessThanOrEqual(5000)
})
test('five failures use 1/2/3/4 second delays with no final delay', async () => {
    unavailable = 5
    await expect(check()).rejects.toThrow('Failed after 5 attempts.')
    expect(requests).toBe(5)
    expect(waits).toEqual([1000, 2000, 3000, 4000])
})
test('recovery stops retries and backoff does not create a slow-response warning', async () => {
    unavailable = 2
    expect((await check()).warning).toBe(false)
    expect(requests).toBe(3)
    expect(waits).toEqual([1000, 2000])
})
test('five timeouts fit the 35-second attempt and delay budget', async () => {
    requestDuration = 5000
    throwTimeout = true
    await expect(check()).rejects.toThrow('timed out after 5 seconds. Failed after 5 attempts.')
    expect(clock).toBe(35000)
})
test('certificate preflight shares the five-second request budget', async () => {
    tlsDuration = 2000
    await check({ ...monitor, target_url: 'https://example.test' })
    expect(timeouts[0]).toBeLessThanOrEqual(3000)
    expect(timeouts[0]).toBeGreaterThan(2900)
})
test('a received HTTP failure is final even if the next response would pass', async () => {
    failures = 1
    await expect(check()).rejects.toThrow('returned HTTP 503.')
    expect(requests).toBe(1)
    expect(waits).toEqual([])
})
const jsonMonitor = { ...monitor, monitoring_type: 'json', target_url: 'system:metrics', json_rule: { path: 'host.cpu', operator: 'gt', value: 80, aggregate: 'max' } } as AutomationRow
test('a high reading fails immediately even if the next sample would pass', async () => {
    failures = 1
    await expect(check(jsonMonitor)).rejects.toThrow('JSON threshold exceeded:')
    expect(snapshots).toEqual([0])
    expect(waits).toEqual([])
})
test('JSON retries unavailable snapshots and accepts the first valid reading', async () => {
    unavailable = 2
    await check(jsonMonitor)
    expect(snapshots).toEqual([0, 1, 2])
    expect(waits).toEqual([1000, 2000])
})
test('a high reading after connection recovery is final', async () => {
    unavailable = 2
    failures = 3
    await expect(check(jsonMonitor)).rejects.toThrow('JSON threshold exceeded:')
    expect(snapshots).toEqual([0, 1, 2])
    expect(waits).toEqual([1000, 2000])
})
test('unavailable JSON telemetry stops after five attempts', async () => {
    unavailable = 5
    await expect(check(jsonMonitor)).rejects.toThrow('Failed after 5 attempts.')
    expect(snapshots).toEqual([0, 1, 2, 3, 4])
    expect(waits).toEqual([1000, 2000, 3000, 4000])
})
test('inverted JSON checks also accept the first result', async () => {
    await expect(check({ ...jsonMonitor, upside_down: true })).rejects.toThrow('JSON threshold exceeded:')
    expect(snapshots).toEqual([0])
    expect(waits).toEqual([])
})
