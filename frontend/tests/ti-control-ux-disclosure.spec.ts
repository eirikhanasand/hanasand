import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('ti control keeps search and work queue primary while telemetry is disclosed', async () => {
    const source = await readFile(path.join(root, 'src/app/dashboard/ti/control/scraperControlClient.tsx'), 'utf8')

    expect(source).toContain('data-ti-control-telemetry-disclosure')
    expect(source).toContain('data-ti-control-telemetry-panels')
    expect(source).toContain('Operations telemetry')
    expect(source).toContain('{healthyEndpoints}/{Math.max(endpointRows.length, 1)} checks healthy')

    expect(source.indexOf('placeholder=\'Actor, company, domain, CVE...\'')).toBeLessThan(source.indexOf('data-ti-control-telemetry-disclosure'))
    expect(source.indexOf('runAction(\'run_query\')')).toBeLessThan(source.indexOf('data-ti-control-telemetry-disclosure'))
    expect(source.indexOf('<aside className=\'border-b border-ui-border bg-ui-canvas xl:border-b-0 xl:border-r\'>')).toBeLessThan(source.indexOf('data-ti-control-telemetry-disclosure'))
    expect(source.indexOf('Next work')).toBeLessThan(source.indexOf('data-ti-control-telemetry-disclosure'))
    expect(source.indexOf('data-ti-control-telemetry-disclosure')).toBeLessThan(source.indexOf('title=\'Endpoints\''))
    expect(source.indexOf('data-ti-control-telemetry-disclosure')).toBeLessThan(source.indexOf('title=\'Output feed\''))

    expect(source).toContain('endpointRows.map(([name, state])')
    expect(source).toContain('qualitySummary(snapshot)')
    expect(source).toContain('sourceGrowth.webhookDeliveries')
})
