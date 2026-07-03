import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('logs dashboard keeps real streams while focusing the primary triage flow', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/logs/pageClient.tsx'), 'utf8')

    expect(page).toContain('data-logs-primary-triage')
    expect(page).toContain('Recommended next')
    expect(page).toContain('const primaryView: LogsView')
    expect(page).toContain('setView(primaryView)')
    expect(page).toContain('data-logs-primary-action')

    expect(page).toContain('data-logs-metrics-disclosure')
    expect(page).toContain('data-logs-metrics')
    expect(page.indexOf('data-logs-metrics-disclosure')).toBeLessThan(page.indexOf(' data-logs-metrics>'))

    expect(page).toContain('/logs/realtime?${params.toString()}')
    expect(page).toContain('if (serviceFilter !== \'all\')')
    expect(page).toContain('router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })')
    expect(page).toContain('data-logs-service-filter')
    expect(page).toContain('data-logs-tabs')
})
