import { expect, test } from '@playwright/test'
import { publicStatusCoverageCheck, toPublicServiceStatus } from '@/utils/status/publicStatus'
import type { ServiceStatus } from '@/utils/status/getStatus'

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
