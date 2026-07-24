import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('ti control keeps search and work queue primary while telemetry is disclosed', async () => {
    const source = await readFile(path.join(root, 'src/app/dashboard/ti/control/scraperControlClient.tsx'), 'utf8')
    const manualRun = await readFile(path.join(root, 'src/app/dashboard/ti/manualRunButton.tsx'), 'utf8')
    const controlRoute = await readFile(path.join(root, 'src/app/api/ti/scraper/control/route.ts'), 'utf8')

    expect(source).toContain('data-ti-control-telemetry-disclosure')
    expect(source).toContain('data-ti-control-telemetry-panels')
    expect(source).toContain('data-ti-control-secondary-actions')
    expect(source).toContain('Advanced source controls')
    expect(source).toContain('Operations telemetry')
    expect(source).toContain('ChevronDown')
    expect(source).toContain('group-open:rotate-180')
    expect(source).toContain('{healthyEndpoints}/{Math.max(endpointRows.length, 1)} checks healthy')

    expect(source.indexOf('placeholder=\'Actor, company, domain, CVE...\'')).toBeLessThan(source.indexOf('data-ti-control-telemetry-disclosure'))
    expect(source.indexOf('runAction(\'run_query\')')).toBeLessThan(source.indexOf('data-ti-control-telemetry-disclosure'))
    expect(source.indexOf('runAction(\'run_query\')')).toBeLessThan(source.indexOf('data-ti-control-secondary-actions'))
    expect(source.indexOf('runAction(\'scheduler_run_now\')', source.indexOf('data-ti-control-secondary-actions'))).toBeGreaterThan(source.indexOf('data-ti-control-secondary-actions'))
    expect(source.indexOf('data-ti-control-secondary-actions')).toBeLessThan(source.indexOf('onClick={runEnrichment}'))
    expect(source.indexOf('data-ti-control-secondary-actions')).toBeLessThan(source.indexOf('runAction(\'rebuild_alerts\')'))
    expect(source.indexOf('<aside className=\'border-b border-ui-border bg-ui-canvas xl:border-b-0 xl:border-r\'>')).toBeLessThan(source.indexOf('data-ti-control-telemetry-disclosure'))
    expect(source.indexOf('Next work')).toBeLessThan(source.indexOf('data-ti-control-telemetry-disclosure'))
    expect(source.indexOf('data-ti-control-telemetry-disclosure')).toBeLessThan(source.indexOf('title=\'Endpoints\''))
    expect(source.indexOf('data-ti-control-telemetry-disclosure')).toBeLessThan(source.indexOf('title=\'Output feed\''))

    expect(source).toContain('endpointRows.map(([name, state])')
    expect(source).toContain('qualitySummary(snapshot)')
    expect(source).toContain('sourceGrowth.webhookDeliveries')
    expect(source).toContain('<Info label=\'Useful now\' value={String(scheduler.usefulSources)} />')
    expect(source).toContain('<Info label=\'Capture-producing\' value={String(scheduler.captureProducingSources)} />')
    expect(source).toContain('<Info label=\'Recently seen\' value={String(scheduler.recentlySeenSources)} />')
    expect(source).toContain('Run ${String(run.id)} completed with')
    expect(source).not.toContain('returned with')
    expect(source).not.toContain('Source plan returned')
    expect(source).not.toContain('What returned')
    expect(manualRun).toContain("action: sourceId === 'all_sources' ? 'scheduler_run_now' : 'run_query'")
    expect(manualRun).toContain("setState(controlResult.ok ? 'queued' : 'idle')")
    expect(manualRun).not.toContain("Run request recorded")
    expect(controlRoute).toContain("if (!base) return unavailable('TI_SCRAPER_API_BASE is not configured.')")
    expect(controlRoute).not.toContain('hanasand_ai_scheduler_fallback')
})
