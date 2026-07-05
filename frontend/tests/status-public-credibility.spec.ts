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
    })

    expect(status.overall).toBe('degraded')
    expect(status.checks).toHaveLength(1)
    expect(status.checks[0]).toMatchObject({
        service: 'Status coverage',
        check_name: 'Public monitor freshness',
        status: 'degraded',
        uptime_30d: 'unverified',
    })
    expect(status.checks[0].message).toContain('Treat status as unverified')
})

test('public status keeps fresh failing checks more severe than freshness fallback', () => {
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: '2026-07-05T00:00:00.000Z',
        checks: [{
            service: 'frontend',
            check_name: 'api-status',
            status: 'down',
            latency_ms: 1200,
            message: 'Status probe failed.',
            checked_at: new Date().toISOString(),
            uptime_30d: '99.1',
        }],
    } satisfies ServiceStatus)

    expect(status.overall).toBe('down')
    expect(status.checks[0]).toMatchObject({
        service: 'Website',
        check_name: 'API Status',
        status: 'down',
    })
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

    expect(source).toContain('Status awaiting fresh checks')
    expect(source).toContain('formatUptime(check.uptime_30d)')
    expect(source).toContain('function formatUptime')
    expect(source).toContain('function StatusEvidenceCard')
    expect(source).toContain('Reported by the latest public monitor check.')
    expect(source).toContain('function isCoverageFallbackCheck')
    expect(source).not.toContain('{check.uptime_30d}%')
    expect(source).not.toContain('StatusSpeedometer')
    expect(source).not.toContain('statusScore')
    expect(source).not.toContain('Latest public monitor signal.')
})

test('public footer does not hardcode operational status', async () => {
    const footer = await readFile(path.join(root, 'src/components/footer/footer.tsx'), 'utf8')

    expect(footer).toContain('fetch(\'/api/status\'')
    expect(footer).toContain('useState<ServiceStatus[\'overall\'] | \'unknown\'>(\'unknown\')')
    expect(footer).toContain('return { label: \'Checking status\', dotClass: \'bg-ui-muted\' }')
    expect(footer).not.toContain('<span className=\'h-2.5 w-2.5 rounded-full bg-ui-success shadow-sm\' />')
})
