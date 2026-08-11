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
