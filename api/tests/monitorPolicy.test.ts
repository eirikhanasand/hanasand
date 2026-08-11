import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { check, fetchJson } from '../src/utils/status/monitor.ts'
import { addMissingRequiredChecks, notificationEvent } from '../src/utils/status/monitorPolicy.ts'

describe('production monitor notification transitions', () => {
    test('status history SQL avoids reserved PostgreSQL window identifier', async () => {
        const source = await readFile(path.join(import.meta.dir, '../src/handlers/status/get.ts'), 'utf8')
        const schema = await readFile(path.join(import.meta.dir, '../src/utils/db/ensureSchema.ts'), 'utf8')
        expect(source).toContain('WINDOW status_history_window AS')
        expect(source).not.toContain('WINDOW window AS')
        expect(source).toContain('const [result, historyResult, incidentResult] = await Promise.all([')
        expect(source).toContain("WHERE status <> 'up'")
        expect(source).not.toContain('FROM service_monitor_results recovered')
        expect(source).toContain('LAG(status) OVER status_history_window')
        expect(schema).toContain('idx_service_monitor_results_non_up')
        expect(source).toContain('const STATUS_CACHE_MS = 15_000')
        expect(source).toContain('res.header(\'Cache-Control\', \'public, max-age=15, stale-while-revalidate=30\')')
    })

    test('status returns the last truthful payload while refreshing an expired cache', async () => {
        const source = await readFile(path.join(import.meta.dir, '../src/handlers/status/get.ts'), 'utf8')
        expect(source).toContain('if (statusCache) {')
        expect(source).toContain('return Promise.resolve(statusCache.payload)')
        expect(source).toContain('status refresh failed')
    })

    test('processing backlog deduplicates current review tasks by their persisted id', async () => {
        const source = await readFile(path.join(import.meta.dir, '../src/utils/status/monitor.ts'), 'utf8')
        expect(source).toContain('SELECT DISTINCT ON (record->>\'id\') record, updated_at')
        expect(source).toContain('ORDER BY record->>\'id\', updated_at DESC')
        expect(source).not.toContain('SELECT DISTINCT ON (record->>\'taskId\') record, updated_at')
    })

    test('status monitor bounds unavailable dependency requests', async () => {
        const source = await readFile(path.join(import.meta.dir, '../src/utils/status/monitor.ts'), 'utf8')
        expect(source).toContain('const MONITOR_REQUEST_TIMEOUT_MS = 5_000')
        expect(source).toContain('signal: options.signal || AbortSignal.timeout(timeoutMs)')
        expect(source).toContain('signal: AbortSignal.timeout(MONITOR_REQUEST_TIMEOUT_MS)')
    })

    test('scraper backlog is visible before it becomes a write failure', async () => {
        const source = await readFile(path.join(import.meta.dir, '../src/utils/status/monitor.ts'), 'utf8')
        expect(source).toContain('SCRAPER_PENDING_WRITES_DEGRADED_THRESHOLD = 1_000')
        expect(source).toContain('Threat-intelligence storage has ${pendingWrites} pending writes.')
    })

    test('latest activity failure does not retry inside one status read', async () => {
        const source = await readFile(path.join(import.meta.dir, '../src/utils/status/monitor.ts'), 'utf8')
        const latestActivity = source.slice(source.indexOf('check(\'dark-web-monitoring\', \'Latest activity\''))
        expect(latestActivity).toContain('fetchJson(\'/api/dwm/exposure-queue?limit=1\', {}, webBase)')
        expect(latestActivity).not.toContain('for (let attempt = 0; response.status >= 500')
        expect(latestActivity).not.toContain('setTimeout(resolve, 1_000)')
    })

    test('public search failure does not retry inside one status run', async () => {
        const source = await readFile(path.join(import.meta.dir, '../src/utils/status/monitor.ts'), 'utf8')
        const publicSearch = source.slice(source.indexOf('check(\'threat-intelligence\', \'Public search\''))
        expect(publicSearch).not.toContain('for (let attempt = 0;')
        expect(publicSearch).not.toContain('setTimeout(resolve, 1_000)')
    })

    test('incident hook cannot delay alert delivery when the scraper is slow', async () => {
        const source = await readFile(path.join(import.meta.dir, '../src/utils/status/record.ts'), 'utf8')
        expect(source).toContain('void notifyServiceMonitorIncident(transition.incident).catch')
        expect(source).not.toContain('await notifyServiceMonitorIncident(transition.incident)')
    })

    test('unavailable dependency records down promptly without substituting success', async () => {
        const originalFetch = globalThis.fetch
        const recorded: Array<{ status: string, message: string }> = []
        globalThis.fetch = ((_, init) => new Promise<Response>((_resolve, reject) => {
            const fail = () => reject(new Error('backend unavailable'))
            if (init?.signal?.aborted) fail()
            else init?.signal?.addEventListener('abort', fail, { once: true })
        })) as typeof fetch
        const started = performance.now()
        try {
            await check(
                'threat-intelligence',
                'Source operations',
                () => fetchJson('/v1/intel/source-operations', {}, 'http://unavailable.test', 5),
                undefined,
                async (_service, _checkName, status, _latency, message) => { recorded.push({ status, message }) },
            )
        } finally {
            globalThis.fetch = originalFetch
        }
        expect(performance.now() - started).toBeLessThan(1_000)
        expect(recorded).toEqual([{ status: 'down', message: 'backend unavailable' }])
    })

    test('latency-derived failure does not retain a success message', async () => {
        const recorded: Array<{ status: string, message: string }> = []
        await check(
            'threat-intelligence',
            'Public search',
            async () => 'A canonical threat-intelligence search completed successfully.',
            { degraded: 0, down: 0 },
            async (_service, _checkName, status, _latency, message) => { recorded.push({ status, message }) },
        )
        expect(recorded[0]?.status).toBe('down')
        expect(recorded[0]?.message).toMatch(/^Response took \d+ ms\.$/)
        expect(recorded[0]?.message).not.toContain('completed successfully')
    })

    test('does not re-alert while a check is flapping', () => {
        expect(notificationEvent('degraded', [])).toBe('alert')
        expect(notificationEvent('degraded', ['up'])).toBe('alert')
        expect(notificationEvent('degraded', ['degraded', 'up'])).toBeUndefined()
        expect(notificationEvent('degraded', ['up', 'up', 'up'])).toBe('alert')
    })

    test('does not report overall health without the required latest-activity check', () => {
        const checks = addMissingRequiredChecks([
            { service: 'core', check_name: 'API Health', status: 'up' as const },
        ], new Date('2026-08-08T23:48:00.000Z'))
        const latestActivity = checks.find(check => check.service === 'dark-web-monitoring' && check.check_name === 'Latest activity')
        expect(latestActivity).toMatchObject({
            status: 'down',
            message: 'No persisted monitor result is available for this required check.',
        })
    })

    test('does not report watchlist processing up when the scraper is unavailable', () => {
        expect(watchlistProcessingStatus(14, 14, false)).toEqual({
            status: 'down',
            message: 'Customer watchlists are synchronized, but the scraper is unavailable for collection.',
        })
        expect(watchlistProcessingStatus(14, 13, true).status).toBe('degraded')
        expect(watchlistProcessingStatus(14, 14, true).status).toBe('up')
    })
})
