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
    expect(source).toContain('runAction(action)')
    expect(source).toContain('notifyCustomer')
    expect(source).toContain('sendWebhook')
    expect(source).toContain('Case export')
    expect(source).not.toContain('What returned')
})
