import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('TI workbench keeps selected-case actions primary and collapses secondary rail context', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/ti/workbench/workbenchClient.tsx'), 'utf8')

    expect(page).toContain('<OperatorActionRail')
    expect(page).toContain('data-workbench-stats-disclosure')
    expect(page).toContain('data-workbench-stats')
    expect(page).toContain('data-workbench-org-disclosure')
    expect(page).toContain('data-workbench-case-groups-disclosure')
    expect(page.indexOf('data-workbench-stats-disclosure')).toBeLessThan(page.indexOf('Workbench counters'))
    expect(page.indexOf('Workbench counters')).toBeLessThan(page.indexOf('{workbenchStatsGrid}'))
    expect(page.indexOf('<OperatorActionRail')).toBeLessThan(page.indexOf('data-workbench-org-disclosure'))
    expect(page.indexOf('data-workbench-org-disclosure')).toBeLessThan(page.indexOf('data-workbench-case-groups-disclosure'))

    expect(page).toContain('embedded')
    expect(page).toContain('Workbench counters')
    expect(page).toContain('const workbenchStatsGrid')
    expect(page).toContain('Org and shared watchlist')
    expect(page).toContain('Case groups and links')
    expect(page).toContain('Members, terms, visibility')
    expect(page).toContain('onRunAction={(action) => selected && runWorkbenchAction')
    expect(page).toContain('onCustomerNotification={() => selected && recordCustomerNotification')
    expect(page).toContain('onCreateSharedWatchlistTerm={() => selected && createSharedWatchlistTerm(selected)}')
    expect(page).not.toContain('What returned')
})
