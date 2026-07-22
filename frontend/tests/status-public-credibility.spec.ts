import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { publicStatusCoverageCheck, toPublicServiceStatus } from '@/utils/status/publicStatus'
import type { ServiceStatus } from '@/utils/status/getStatus'

const root = process.cwd()

test('public status does not claim operational health without fresh public checks', () => {
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: '2026-07-05T00:00:00.000Z',
        checks: [],
        history: [],
        incidents: [],
    }, Date.parse('2026-07-05T00:00:00.000Z'))

    expect(status.overall).toBe('degraded')
    expect(status.checks).toHaveLength(5)
    expect(status.checks.map(check => check.service)).toEqual([
        'Core platform',
        'Website',
        'Threat intelligence',
        'Browser sandbox',
        'Dark web monitoring',
    ])
    expect(status.checks[0]).toMatchObject({
        check_name: 'API Health',
        status: 'degraded',
        uptime_30d: 'unverified',
    })
    expect(status.checks[0].message).toContain('last 5 minutes')
})

test('public status keeps fresh failing checks more severe than freshness fallback', () => {
    const now = Date.parse('2026-07-05T00:00:00.000Z')
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: '2026-07-05T00:00:00.000Z',
        checks: [{
            service: 'core',
            check_name: 'API health',
            status: 'down',
            latency_ms: 1200,
            message: 'Status probe failed.',
            checked_at: new Date(now).toISOString(),
            uptime_30d: '99.1',
        }],
        history: [],
        incidents: [],
    } satisfies ServiceStatus, now)

    expect(status.overall).toBe('down')
    expect(status.checks[0]).toMatchObject({
        service: 'Core platform',
        check_name: 'API Health',
        status: 'down',
    })
})

test('public status is operational only when every buyer-facing monitor is fresh', () => {
    const now = Date.parse('2026-07-05T00:05:00.000Z')
    const checkedAt = '2026-07-05T00:04:00.000Z'
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: new Date(now).toISOString(),
        checks: [
            serviceCheck('core', 'API health', checkedAt),
            serviceCheck('website', 'Public website', checkedAt),
            serviceCheck('threat-intelligence', 'Public search', checkedAt),
            serviceCheck('browser-sandbox', 'Browser workspace', checkedAt),
            serviceCheck('dark-web-monitoring', 'Monitoring workspace', checkedAt),
            serviceCheck('content', 'Articles', checkedAt),
        ],
        history: [],
        incidents: [],
    }, now)

    expect(status.overall).toBe('up')
    expect(status.checks).toHaveLength(5)
    expect(status.checks.every(check => check.status === 'up')).toBe(true)
})

test('public status rejects monitor results older than five minutes', () => {
    const now = Date.parse('2026-07-05T00:10:01.000Z')
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: new Date(now).toISOString(),
        checks: [serviceCheck('core', 'API health', '2026-07-05T00:05:00.000Z')],
        history: [],
        incidents: [],
    }, now)

    expect(status.overall).toBe('degraded')
    expect(status.checks[0]).toMatchObject({ status: 'degraded', uptime_30d: 'unverified' })
})

test('public status fallback check is reusable by API and page fallbacks', () => {
    expect(publicStatusCoverageCheck('2026-07-05T00:00:00.000Z')).toMatchObject({
        service: 'Status coverage',
        status: 'degraded',
        checked_at: '2026-07-05T00:00:00.000Z',
    })
})

test('public status page renders unverified coverage without fake uptime', async () => {
    const source = await readFile(path.join(root, 'src/app/status/pageClient.tsx'), 'utf8')

    expect(source).toContain('Incident history')
    expect(source).toContain('formatUptime(check.uptime_30d)')
    expect(source).toContain('function formatUptime')
    expect(source).toContain('historyDaysFor(currentStatus, check)')
    expect(source).toContain('No incidents on')
    expect(source).toContain('/status/incidents/${day.incident.id}')
    expect(source).not.toContain('{check.uptime_30d}%')
    expect(source).not.toContain('Array.from({ length: 45 }')
    expect(source).not.toContain('index > 38')
})

test('public footer does not hardcode operational status', async () => {
    const footer = await readFile(path.join(root, 'src/components/footer/footer.tsx'), 'utf8')

    expect(footer).toContain('fetch(\'/api/status\'')
    expect(footer).toContain('useState<ServiceStatus[\'overall\'] | \'unknown\'>(\'unknown\')')
    expect(footer).toContain('return { label: \'Checking status\', dotClass: \'bg-ui-muted\' }')
    expect(footer).not.toContain('<span className=\'h-2.5 w-2.5 rounded-full bg-ui-success shadow-sm\' />')
})

test('status monitors probe buyer-facing surfaces without inserting fake traffic', async () => {
    const syntheticMonitor = await readFile(path.join(root, '../api/src/utils/status/monitor.ts'), 'utf8')
    const logMonitor = await readFile(path.join(root, '../api/src/utils/status/logMonitors.ts'), 'utf8')

    for (const expected of ['API health', 'Public website', 'Public search', 'Browser workspace', 'Monitoring workspace']) {
        expect(syntheticMonitor).toContain(`'${expected}'`)
    }
    expect(syntheticMonitor).toContain('\'https://api.hanasand.com/api/v1\'')
    expect(syntheticMonitor).toContain('\'https://hanasand.com\'')
    expect(syntheticMonitor).toContain('fetchJson(\'/openapi.json\', {}, publicApiBase)')
    expect(syntheticMonitor).toContain('result?.mode !== \'scraper\'')
    expect(logMonitor).not.toContain('INSERT INTO traffic_events')
    expect(logMonitor).not.toContain('synthetic-monitor')
    expect(logMonitor).not.toContain('normal sample')
})

function serviceCheck(service: string, check_name: string, checked_at: string): ServiceStatus['checks'][number] {
    return { service, check_name, checked_at, status: 'up', latency_ms: 20, message: null, uptime_30d: '100.00' }
}
