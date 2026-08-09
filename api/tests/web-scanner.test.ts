import { describe, expect, test } from 'bun:test'
import { countSeverities, headerChecks, setWebScanSchedule } from '../src/utils/vulnerabilities/webScanner.ts'

describe('Hanasand safe web scanner', () => {
    test('reports missing security controls without sending a request', () => {
        const checks = headerChecks({ server: 'example' }, true)
        expect(checks.find(check => check.id === 'header.hsts')?.status).toBe('fail')
        expect(checks.find(check => check.id === 'header.csp')?.status).toBe('warn')
        expect(checks.find(check => check.id === 'header.server')?.status).toBe('warn')
    })

    test('aggregates actionable severities and clamps schedule inputs', async () => {
        expect(countSeverities([{ target: 'https://hanasand.com', status: '200', checks: [{ id: 'csp', status: 'warn', severity: 'medium', title: 'CSP', evidence: {} }], ports: [{ port: 8080, open: true, elapsedMs: 1 }] }])).toEqual({ critical: 0, high: 0, medium: 2, low: 0, info: 0 })
        const report = await setWebScanSchedule({ enabled: true, intervalMinutes: 1 })
        expect(report.schedule.intervalMinutes).toBe(5)
        expect(report.schedule.target).toBe('https://hanasand.com')
    })
})
