import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('dwm analyst portal keeps alert triage primary while disclosing route setup', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/dwm/dwm-analyst-portal.tsx'), 'utf8')

    expect(page).toContain('Recent attacks')
    expect(page).toContain('Search company, actor, term, or status')
    expect(page).toContain('SelectedActionBar')
    expect(page).toContain('Customer delivery')
    expect(page).toContain('caseDetailHref')
    expect(page).toContain('&focus=destinations')
    expect(page).toContain('Manage destination')
    expect(page).not.toContain('&focus=webhooks')

    expect(page).toContain('data-dwm-workflow-snapshot')
    expect(page).toContain('Workflow route')
    expect(page).toContain('Use this path when a source match needs to become a customer case and delivery')
    expect(page).toContain('Run path')
    expect(page).toContain('data-dwm-selected-workflow-actions')

    expect(page.indexOf('<WorkflowRouteStrip')).toBeLessThan(page.indexOf('Recent attacks'))
    expect(page.indexOf('Recent attacks')).toBeLessThan(page.indexOf('SelectedActionBar'))
    expect(page.indexOf('data-dwm-selected-workflow-actions')).toBeGreaterThan(page.indexOf('<DeliveryPanel'))

    expect(page).toContain('<section id=\'dwm-workflow-actions\' className=\'scroll-mt-24\'>')
    expect(page).toContain('<NoCaseWorkspace latestCaptures={latestCaptures} workflowActions={workflowActions} />')
    expect(page).toContain('onReplay={replayAlert}')
    expect(page).toContain('onTest={testDelivery}')
    expect(page).toContain('onSend={sendAlert}')
})
