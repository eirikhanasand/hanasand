import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('dashboard keeps analyst queue primary and discloses delivery management', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/page.tsx'), 'utf8')

    expect(page).toContain('data-dashboard-operator-strip')
    expect(page).toContain('<AnalystWorkbenchClient initialCases={cases} chrome=\'compact\'')
    expect(page).toContain('data-dashboard-delivery-console-disclosure')
    expect(page).toContain('data-dashboard-delivery-console')
    expect(page).toContain('Delivery management')

    expect(page.indexOf('<OperatorTopBar')).toBeLessThan(page.indexOf('<AnalystWorkbenchClient'))
    expect(page.indexOf('<AnalystWorkbenchClient')).toBeLessThan(page.indexOf('data-dashboard-delivery-console-disclosure'))
    expect(page.indexOf('data-dashboard-delivery-console-disclosure')).toBeLessThan(page.indexOf('<WebhookDeliveryConsole'))
    expect(page.indexOf('data-dashboard-delivery-console-disclosure')).toBeLessThan(page.indexOf('data-dashboard-delivery-console>'))

    expect(page).toContain('initialDestinations={organizationState.webhooks}')
    expect(page).toContain('initialDeliveries={deliveries}')
    expect(page).toContain('alertOptions={webhookAlertOptions}')
    expect(page).toContain('loadDwmDeliveries(scope, viewerIdentity)')
})
