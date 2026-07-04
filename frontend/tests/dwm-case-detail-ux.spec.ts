import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('DWM case detail keeps row-heavy evidence behind disclosures', async () => {
    const source = await readFile(path.join(root, 'src/app/dashboard/dwm/cases/[id]/case-detail-client.tsx'), 'utf8')

    expect(source).toContain('<CollapsiblePanel title=\'Evidence rows\'')
    expect(source).toContain('<CollapsiblePanel title=\'Audit timeline\'')
    expect(source).toContain('function CollapsiblePanel')
    expect(source).toContain('CaseCommandBar')
    expect(source).toContain('WorkflowStrip')
    expect(source).toContain('DecisionBrief')
    expect(source).toContain('data-dwm-case-decision-brief')
    expect(source).toContain('actionDockHref=\'#dwm-case-actions\'')
    expect(source).toContain('id=\'dwm-case-actions\'')
    expect(source).toContain('runAction(action)')
    expect(source).toContain('notifyCustomer')
    expect(source).toContain('sendWebhook')
    expect(source).toContain('Manage destination')
    expect(source).toContain('Delivery history')
    expect(source).toContain('focus: \'destinations\'')
    expect(source).toContain('latestDelivery.nextRetryAt')
    expect(source).toContain('latestDelivery.requestId || latestDelivery.auditEventId')
    expect(source).toContain('Case export')
    expect(source).not.toContain('What returned')
})
