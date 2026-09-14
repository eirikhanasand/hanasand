import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('logs dashboard keeps real streams while focusing the primary triage flow', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/logs/pageClient.tsx'), 'utf8')

    expect(page).toContain('data-logs-controls')
    expect(page).toContain('className=\'border-b border-ui-border\' data-logs-toolbar')
    expect(page).toContain('data-logs-error-summary')
    expect(page).toContain('Total errors')
    expect(page).toContain('Live error lines')
    expect(page).toContain('Errors in the past hour')
    expect(page).not.toContain('Recommended next')
    expect(page).not.toContain('Open error review')
    expect(page).not.toMatch(/tracked failures/i)

    expect(page).toContain('data-logs-metrics-disclosure')
    expect(page).toContain('data-logs-metrics')
    expect(page.indexOf('data-logs-metrics-disclosure')).toBeLessThan(page.indexOf(' data-logs-metrics>'))

    expect(page).toContain('/logs/realtime?${params.toString()}')
    expect(page).toContain('if (serviceFilter !== \'all\')')
    expect(page).toContain('router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })')
    expect(page).toContain('data-logs-service-filter')
    expect(page).toContain('data-logs-tabs')
    expect(page).toContain('Recent errors')
    expect(page).toMatch(/title='Errors'/)
    expect(page).toContain('Most active services')
    expect(page).toContain('Live across running apps')
    expect(page).toContain('Showing {events.errors.length} recent rows from {events.summary.total} errors')
    expect(page).toContain('break-all')
})
