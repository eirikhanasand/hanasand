import { describe, expect, test } from 'bun:test'
import { activityFreshnessMinutes, activityCollectorHealthy, activityCountDrop } from '../src/utils/status/monitorPolicy.ts'

describe('activity freshness', () => {
    test('uses content age before the age of the last check', () => {
        expect(activityFreshnessMinutes({ collectionAgeMinutes: 80, collectionCheckAgeMinutes: 4 })).toBe(80)
    })

    test('falls back to a recent check only when content ages are unavailable', () => {
        expect(activityFreshnessMinutes({ collectionAgeMinutes: null, claimAgeMinutes: null, collectionCheckAgeMinutes: 4 })).toBe(4)
    })
})

describe('quiet latest activity', () => {
    const now = Date.parse('2026-09-12T19:00:00Z')
    const loop = { enabled: true, running: false, intervalSeconds: 300, lastSuccessAt: new Date(now - 60_000).toISOString(), consecutiveErrorCount: 0, latestResult: { status: 'completed' } }
    const health = { ok: true, storage: { databaseAvailable: true, pendingWrites: 0 }, collection: { public: loop, restrictedMetadata: loop } }
    const freshness = { collectionAgeMinutes: 254, collectionCheckAgeMinutes: 6, maxLiveAgeMinutes: 60 }

    test('old claims with recent successful collection are healthy', () => {
        expect(activityCollectorHealthy(health, freshness, now)).toBe(true)
    })
    test('a collection currently running is not a failure', () => {
        expect(activityCollectorHealthy({ ...health, collection: { ...health.collection, public: { ...loop, running: true } } }, freshness, now)).toBe(true)
    })
    test('stale, failed, disabled or missing collection stays unhealthy', () => {
        for (const patch of [{ lastSuccessAt: new Date(now - 3_600_000).toISOString() }, { lastSuccessAt: undefined }, { enabled: false }, { consecutiveErrorCount: 1 }, { latestResult: { status: 'failed' } }]) {
            expect(activityCollectorHealthy({ ...health, collection: { ...health.collection, public: { ...loop, ...patch } } }, freshness, now)).toBe(false)
        }
        expect(activityCollectorHealthy({}, freshness, now)).toBe(false)
        expect(activityCollectorHealthy({ ...health, collection: { ...health.collection, restrictedMetadata: { ...loop, failedSourceCount: 1 } } }, freshness, now)).toBe(false)
    })
    test('source checks must be recent even when the collector loop succeeds', () => {
        for (const collectionCheckAgeMinutes of [undefined, null, 61, NaN, -1]) {
            expect(activityCollectorHealthy(health, { ...freshness, collectionCheckAgeMinutes }, now)).toBe(false)
        }
    })
    test('storage failures and excessive pending writes stay unhealthy', () => {
        for (const patch of [{ databaseAvailable: false }, { lastWriteError: 'write failed' }, { pendingWrites: 1000 }]) {
            expect(activityCollectorHealthy({ ...health, storage: { ...health.storage, ...patch } }, freshness, now)).toBe(false)
        }
    })
    test('retained-record loss remains a failure during quiet periods', () => {
        expect(activityCountDrop(1000, { status: 'up', message: 'Latest activity returned 3221 retained records. Sources were checked successfully; no new activity.' })?.status).toBe('down')
    })
})
