import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { dwmNextOperatorAction, type DwmNextOperatorActionInput } from '@/utils/dwm/nextOperatorAction'

const root = process.cwd().endsWith(`${path.sep}frontend`) ? process.cwd() : path.join(process.cwd(), 'frontend')

test('DWM keeps Cases focused and workflow controls on scoped non-Cases views', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/dwm/dwm-analyst-portal.tsx'), 'utf8')

    expect(page).toContain('function CaseOverview(')
    expect(page).toContain('return <CaseOverview organizationId={organizationId} state={casesState} alerts={alerts} />')
    expect(page).toContain('const workflowActions = view === \'cases\' ? null')
    expect(page).toContain('<DwmWorkflowActions')
    expect(page).toContain('tenantId={tenantId}')
    expect(page).toContain('organizationId={selectedOrganizationId}')
    expect(page).toContain('dwmScopeSearchParams(tenantId, organizationId)')
    expect(page).toContain('view === \'cases\' ? \'loading\' : \'ready\'')
    expect(page).toContain('No cases.')
    expect(page).toContain('state: latestDelivery?.status === \'delivered\' ? \'ready\'')
    expect(page).toContain('const lastSuccessfulDelivery = visible.find(delivery => delivery.status === \'delivered\')')
})

test('DWM next operator action remains scoped to the available workflow step', () => {
    const base: DwmNextOperatorActionInput = {
        reviewState: 'reviewing',
        deliveryState: 'pending_review',
        caseReady: false,
        transitionReady: true,
        replayReady: false,
        deliverReady: false,
        closeReady: false,
        reopenReady: false,
        suppressReady: false,
    }

    expect(dwmNextOperatorAction({ ...base, caseHref: '/dwm/cases/case-1', latestDeliveryStatus: 'delivered', latestDeliverySummary: 'delivered from 2m ago' })).toMatchObject({
        kind: 'open_case_link',
        href: '/dwm/cases/case-1',
        label: 'Review case and delivery trail',
    })
})
