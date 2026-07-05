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
    expect(page).toContain('{highConfidenceCount} strong evidence')
    expect(page).toContain('{ id: \'high_confidence\', label: \'Strong\' }')
    expect(page).toContain('function evidenceStrengthLabel(value: number)')
    expect(page).toContain('<th className=\'px-4 py-2 font-semibold\'>Items</th>')
    expect(page).toContain('<th className=\'px-4 py-2 font-semibold\'>Strength</th>')
    expect(page).toContain('{evidenceStrengthLabel(alert.confidence)} evidence')
    expect(page).toContain('{evidenceStrengthLabel(payload.artifact.confidence)} evidence')
    expect(page).not.toContain('80%+ confidence')
    expect(page).not.toContain('{ id: \'high_confidence\', label: \'80%+\' }')
    expect(page).not.toContain('<th className=\'px-4 py-2 font-semibold\'>Confidence</th>')
    expect(page).not.toContain('% confidence</span>')
    expect(page).not.toContain('% confidence')
    expect(page).toContain('const DWM_QUEUE_PREVIEW_ROWS = 5')
    expect(page).toContain('const limit = DWM_QUEUE_PREVIEW_ROWS')
    expect(page).toContain('max-h-[480px] overflow-auto')
    expect(page).toContain('Narrow the search or filters to see more matching attacks.')
    expect(page).not.toContain('const limit = 12')
    expect(page).not.toContain('max-h-[610px] overflow-auto')
    expect(page).toContain('SelectedActionBar')
    expect(page).toContain('data-dwm-next-action=\'true\'')
    expect(page).toContain('const blockedActions = [')
    expect(page).toContain('data-dwm-action-blockers=\'true\'')
    expect(page).toContain('Configure a webhook destination before testing or sending.')
    expect(page).toContain('<ActionAvailability label=\'Delivery\' ready={deliverReady} reason={deliveryReason} />')
    expect(page).toContain('function shortActionBlocker')
    expect(page).toContain('return \'add destination\'')
    expect(page).toContain('return \'needs evidence\'')
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
    expect(page).toContain('Watchlist to source, alert, case, and delivery.')
    expect(page).toContain('Use this workflow when a source match needs to become a customer case and delivery.')
    expect(page).toContain('Run workflow')
    expect(page).toContain('data-dwm-selected-workflow-actions')

    expect(page.indexOf('<WorkflowRouteStrip')).toBeLessThan(page.indexOf('Recent attacks'))
    expect(page.indexOf('Recent attacks')).toBeLessThan(page.indexOf('SelectedActionBar'))
    expect(page.indexOf('data-dwm-next-action=\'true\'')).toBeLessThan(page.indexOf('Owner {assignee}'))
    expect(page.indexOf('data-dwm-selected-workflow-actions')).toBeGreaterThan(page.indexOf('<DeliveryPanel'))

    expect(page).toContain('<section id=\'dwm-workflow-actions\' className=\'scroll-mt-24\'>')
    expect(page).toContain('<NoCaseWorkspace latestCaptures={latestCaptures} workflowActions={workflowActions} />')
    expect(page).toContain('onReplay={replayAlert}')
    expect(page).toContain('onTest={testDelivery}')
    expect(page).toContain('onSend={sendAlert}')
    expect(page).toContain('<DeliveryPanel alert={selectedAlert} deliveries={localDeliveries} busyAction={busyAction} onTest={testDelivery} onSend={sendAlert} />')
    expect(page).toContain('useSearchParams')
    expect(page).toContain('function selectAlert(alert: PortalAlert)')
    expect(page).toContain('nextParams.set(\'tenantId\', input.tenantId)')
    expect(page).toContain('nextParams.set(\'organizationId\', input.organizationId)')
    expect(page).toContain('nextParams.set(\'alert\', input.alertId)')
    expect(page).toContain('function updateQueueFilter(filter: QueueFilter)')
    expect(page).toContain('function updateQueueQuery(query: string)')
    expect(page).toContain('function clearQueueView()')
    expect(page).toContain('function normalizeQueueFilter(value: string | null): QueueFilter')
    expect(page).toContain('function dwmQueueHref(input: { params: URLSearchParams, tenantId: string, organizationId?: string, alertId?: string, filter: QueueFilter, query: string })')
    expect(page).toContain('searchParams.get(\'filter\')')
    expect(page).toContain('searchParams.get(\'q\')?.slice(0, 120)')
    expect(page).toContain('nextParams.set(\'filter\', input.filter)')
    expect(page).toContain('nextParams.set(\'q\', query.slice(0, 120))')
    expect(page).toContain('router.replace(dwmQueueHref({')
    expect(page).toContain('onClick={() => selectAlert(alert)}')
    expect(page).toContain('onClick={() => updateQueueFilter(filter.id)}')
    expect(page).toContain('onChange={event => updateQueueQuery(event.target.value)}')
    expect(page).toContain('Clear queue view')
    expect(page).toContain('onClick={clearQueueView}')
    expect(page).toContain('const webhookDestinationIds = webhookContext?.webhookDestinationIds || workflowContext?.webhookDestinationIds || []')
    expect(page).toContain('hasWebhookRoute: Boolean(webhookContext?.hasWebhookRoute || webhookDestinationIds.length || alert.webhookDelivery.dedupeKey)')
    expect(page).toContain('function safeTimelineDetail(value: string)')
    expect(page).toContain('event.note ? safeTimelineDetail(event.note)')
    expect(page).toContain('detail: safeTimelineDetail(context.localState.note)')
    expect(page).toContain('detail: delivery.error ? safeTimelineDetail(delivery.error)')
    expect(page).toContain('row.error ? ` ${safeTimelineDetail(row.error)}`')
    expect(page).toContain('data-dwm-delivery-latest=\'true\'')
    expect(page).toContain('data-dwm-delivery-panel-actions=\'true\'')
    expect(page).toContain('onClick={() => alert ? void onTest(alert.id) : undefined}')
    expect(page).toContain('onClick={() => alert ? void onSend(alert.id) : undefined}')
    expect(page).toContain('const visible = orderDeliveries(')
    expect(page).toContain('function orderDeliveries(rows: DeliveryItem[])')
    expect(page).toContain('const lastFailedDelivery = visible.find(delivery => delivery.status === \'failed\')')
    expect(page).toContain('const lastSuccessfulDelivery = visible.find(delivery => delivery.status === \'delivered\' || delivery.status === \'dry_run\')')
    expect(page).toContain('<DeliveryFact label=\'Last attempt\'')
    expect(page).toContain('<DeliveryFact label=\'Last success\'')
    expect(page).toContain('<DeliveryFact label=\'Needs review\'')
    expect(page).toContain('data-dwm-delivery-empty=\'true\'')
    expect(page).toContain('No delivery attempt yet')
    expect(page).toContain('Configure delivery')
    expect(page).toContain('href={orgHref}')
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
