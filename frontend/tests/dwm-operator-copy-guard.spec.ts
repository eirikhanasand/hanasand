import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('dashboard DWM operator copy avoids backend-shaped returned wording', async () => {
    const dwmPage = await readFile(path.join(root, 'src/app/dashboard/dwm/page.tsx'), 'utf8')
    const dashboardPage = await readFile(path.join(root, 'src/app/dashboard/page.tsx'), 'utf8')
    const workflowActions = await readFile(path.join(root, 'src/app/dashboard/dwm/dwm-workflow-actions.tsx'), 'utf8')

    expect(dwmPage).toContain('The exposure monitor is showing live watchlists, sources, actors, and alerts.')
    expect(dwmPage).toContain('Collection is showing source and evidence state.')
    expect(dashboardPage).toContain('DWM alerts reported HTTP')
    expect(workflowActions).toContain('<RouteRunSummary route={lastRoute} organizationId={organizationId} />')
    expect(workflowActions).toContain('function organizationDestinationPath(organizationId: string, alertId?: string, caseId?: string)')
    expect(workflowActions).toContain('focus: \'destinations\'')
    expect(workflowActions).toContain('#delivery-history')
    expect(workflowActions).toContain('Open delivery log')
    expect(workflowActions).toContain('alert linked')
    expect(workflowActions).not.toContain('{route.alertId}</span>')

    expect(dwmPage).not.toContain('returning live')
    expect(dwmPage).not.toContain('returning source')
    expect(dwmPage).not.toContain('What returned')
    expect(dashboardPage).not.toContain('DWM alerts returned HTTP')
    expect(dashboardPage).not.toContain('What returned')
})
