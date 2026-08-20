import { afterAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, utimes } from 'node:fs/promises'
import path from 'node:path'

const stateDir = await mkdtemp(path.join('/tmp', 'hanasand-web-scan-'))
process.env.WEB_SCAN_STATE_PATH = path.join(stateDir, 'web-scan.json')
process.env.WEB_SCAN_INTERVAL_MINUTES = 'not-a-number'

const { cookieChecks, countSeverities, fallbackExplanation, headerChecks, normalizeIntervalMinutes, normalizeTarget, redirectChecks, setWebScanSchedule, withWebScanLock } = await import('../src/utils/vulnerabilities/webScanner.ts')

afterAll(async() => {
    await rm(stateDir, { recursive: true, force: true })
})

describe('Hanasand safe web scanner', () => {
    test('reports missing security controls without sending a request', () => {
        const checks = headerChecks({ server: 'example' }, true)
        expect(checks.find(check => check.id === 'header.hsts')?.status).toBe('fail')
        expect(checks.find(check => check.id === 'header.csp')?.status).toBe('warn')
        expect(checks.find(check => check.id === 'header.server')?.status).toBe('warn')
    })

    test('explains retained checks from their recorded evidence', () => {
        const checks = headerChecks({ 'content-security-policy': 'default-src \'self\'', server: 'nginx' }, true)
        expect(fallbackExplanation(checks.find(check => check.id === 'header.csp')!)).toContain('included Content-Security-Policy')
        expect(fallbackExplanation(checks.find(check => check.id === 'header.server')!)).toContain('nginx')
        expect(fallbackExplanation(checks.find(check => check.id === 'http.reachable')!)).toContain('accepted an HTTPS request')
    })

    test('normalizes malformed and bounded schedule intervals', async() => {
        expect(normalizeIntervalMinutes('not-a-number')).toBe(60)
        expect(normalizeIntervalMinutes(1)).toBe(5)
        expect(normalizeIntervalMinutes(2000)).toBe(1440)
        const report = await setWebScanSchedule({ enabled: true, intervalMinutes: 1 })
        expect(report.schedule.intervalMinutes).toBe(5)
        expect(report.schedule.target).toBeNull()
        expect(report.error).toContain('target configuration is unavailable')
        expect(report.schedule.scope).toBe('global')
    })

    test('accepts only safe HTTPS scanner targets', () => {
        expect(normalizeTarget('https://example.com/')).toBe('https://example.com')
        expect(normalizeTarget('http://example.com')).toBeNull()
        expect(normalizeTarget('https://user:password@example.com')).toBeNull()
        expect(normalizeTarget('https://example.com?token=secret')).toBeNull()
    })

    test('flags insecure redirects and cookie attributes', () => {
        expect(redirectChecks(302, 'http://example.com/login', new URL('https://example.com')).at(0)?.status).toBe('fail')
        expect(cookieChecks('session=abc; Path=/').at(0)?.status).toBe('fail')
        expect(cookieChecks('session=abc; Secure; HttpOnly; SameSite=Lax').at(0)?.status).toBe('pass')
    })

    test('aggregates actionable severities', () => {
        expect(countSeverities([{ target: 'https://hanasand.com', status: '200', checks: [{ id: 'csp', status: 'warn', severity: 'medium', title: 'CSP', evidence: {} }], ports: [{ port: 8080, open: true, elapsedMs: 1 }] }])).toEqual({ critical: 0, high: 0, medium: 2, low: 0, info: 0 })
    })

    test('allows only one writer to own the scan lock', async() => {
        const outcomes = await Promise.allSettled([
            withWebScanLock(async() => {
                await new Promise(resolve => setTimeout(resolve, 20))
                return 'held'
            }),
            withWebScanLock(async() => 'second'),
        ])
        expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1)
        expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1)
        expect((outcomes.find(outcome => outcome.status === 'rejected') as PromiseRejectedResult).reason.message).toContain('already running')
    })

    test('stale-lock recovery remains exclusive under contention', async() => {
        const lockPath = `${process.env.WEB_SCAN_STATE_PATH}.lock`
        await mkdir(lockPath)
        const stale = new Date(Date.now() - 11 * 60 * 1000)
        await utimes(lockPath, stale, stale)
        const outcomes = await Promise.allSettled([
            withWebScanLock(async() => {
                await new Promise(resolve => setTimeout(resolve, 20))
                return 'recovered'
            }),
            withWebScanLock(async() => 'contender'),
        ])
        expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1)
        expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1)
        expect((outcomes.find(outcome => outcome.status === 'rejected') as PromiseRejectedResult).reason.message).toContain('already running')
    })
})
