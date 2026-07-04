import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { dwmNextOperatorAction, type DwmNextOperatorActionInput } from '@/utils/dwm/nextOperatorAction'

const root = process.cwd()

test('dwm analyst portal keeps alert triage primary while disclosing route setup', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/dwm/dwm-analyst-portal.tsx'), 'utf8')
    const actionContract = await readFile(path.join(root, 'src/utils/dwm/nextOperatorAction.ts'), 'utf8')

    expect(page).toContain('Recent attacks')
    expect(page).toContain('Search company, actor, term, or status')
    expect(page).toContain('SelectedActionBar')
    expect(page).toContain('data-dwm-next-action=\'true\'')
    expect(page).toContain('dwmNextOperatorAction({')
    expect(page).toContain('nextOperatorActionBusy')
    expect(actionContract).toContain('Send customer delivery')
    expect(actionContract).toContain('Waiting for source context')
    expect(page).toContain('Customer delivery')
    expect(page).toContain('caseDetailHref')
    expect(page).toContain('organizationDeliveryWorkspaceHref({ organizationId: orgId, alertId: alert?.id, caseId, delivery })')
    expect(page).toContain('params.set(\'focus\', \'destinations\')')
    expect(page).toContain('params.set(\'destinationId\', input.delivery.webhookDestinationId || input.delivery.destinationId || \'\')')
    expect(page).toContain('params.set(\'deliveryId\', input.delivery.id)')
    expect(page).toContain('params.set(\'watchlistId\', input.delivery.watchlistId)')
    expect(page).toContain('Manage destination')
    expect(page).not.toContain('&focus=webhooks')

    expect(page).toContain('data-dwm-workflow-snapshot')
    expect(page).toContain('Workflow route')
    expect(page).toContain('Use this path when a source match needs to become a customer case and delivery')
    expect(page).toContain('Run path')
    expect(page).toContain('data-dwm-selected-workflow-actions')

    expect(page.indexOf('<WorkflowRouteStrip')).toBeLessThan(page.indexOf('Recent attacks'))
    expect(page.indexOf('Recent attacks')).toBeLessThan(page.indexOf('SelectedActionBar'))
    expect(page.indexOf('data-dwm-next-action=\'true\'')).toBeLessThan(page.indexOf('<ActionStatus label=\'Owner\''))
    expect(page.indexOf('data-dwm-selected-workflow-actions')).toBeGreaterThan(page.indexOf('<DeliveryPanel'))

    expect(page).toContain('<section id=\'dwm-workflow-actions\' className=\'scroll-mt-24\'>')
    expect(page).toContain('<NoCaseWorkspace latestCaptures={latestCaptures} workflowActions={workflowActions} />')
    expect(page).toContain('onReplay={replayAlert}')
    expect(page).toContain('onTest={testDelivery}')
    expect(page).toContain('onSend={sendAlert}')
    expect(page).toContain('useSearchParams')
    expect(page).toContain('function selectAlert(alert: PortalAlert)')
    expect(page).toContain('nextParams.set(\'tenantId\', tenantId)')
    expect(page).toContain('nextParams.set(\'organizationId\', alertOrgId)')
    expect(page).toContain('nextParams.set(\'alert\', alert.id)')
    expect(page).toContain('router.replace(`/dashboard/dwm?${nextParams.toString()}`, { scroll: false })')
    expect(page).toContain('onClick={() => selectAlert(alert)}')
})

test('dwm next operator action prioritizes the workflow step an analyst can take now', () => {
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

    expect(dwmNextOperatorAction({ ...base, caseHref: '/dashboard/cases/case-1', latestDeliveryStatus: 'delivered', latestDeliverySummary: 'delivered from 2m ago' })).toMatchObject({
        kind: 'open_case_link',
        href: '/dashboard/cases/case-1',
        label: 'Review case and delivery trail',
    })

    expect(dwmNextOperatorAction({ ...base, caseReady: true })).toMatchObject({
        kind: 'open_case',
        cta: 'Open case',
    })

    expect(dwmNextOperatorAction({ ...base, deliverReady: true, latestDeliveryStatus: 'dry_run' })).toMatchObject({
        kind: 'send',
        cta: 'Send',
    })

    expect(dwmNextOperatorAction({ ...base, deliverReady: true })).toMatchObject({
        kind: 'test',
        cta: 'Test',
    })

    expect(dwmNextOperatorAction({ ...base, transitionReady: false, replayReady: true })).toMatchObject({
        kind: 'replay',
        cta: 'Replay',
    })

    expect(dwmNextOperatorAction({ ...base, transitionReady: false })).toMatchObject({
        kind: 'wait',
        disabled: true,
        cta: 'Unavailable',
    })
})
