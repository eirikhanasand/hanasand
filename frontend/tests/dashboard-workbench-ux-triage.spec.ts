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

test('dashboard renders delivery management as a secondary workflow until opened', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'name', value: 'Render Proof', url: origin },
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), url: origin },
        { name: 'name', value: 'Render Proof', domain: 'localhost', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: 'localhost', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: 'localhost', path: '/' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), domain: 'localhost', path: '/' },
        { name: 'name', value: 'Render Proof', domain: '127.0.0.1', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: '127.0.0.1', path: '/' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), domain: '127.0.0.1', path: '/' },
    ])

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: /review today's cases/i })).toBeVisible()
    await expect(page.locator('[data-dashboard-operator-strip="true"]')).toBeVisible()
    await expect(page.getByText('Delivery management')).toBeVisible()

    const deliveryConsole = page.locator('[data-dashboard-delivery-console]')
    await expect(deliveryConsole).toBeHidden()
    await expect(page.getByText('Add or edit destination')).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Destinations' })).toBeHidden()

    await page.getByText('Delivery management').click()

    await expect(deliveryConsole).toBeVisible()
    await expect(page.getByText('Add or edit destination')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Destinations' })).toBeVisible()
    await expect(deliveryConsole.getByText('Dry-run payload').first()).toBeVisible()
    await expect(deliveryConsole.getByText('Delivery history').first()).toBeVisible()
    await expect(page.getByText('Select or create an organization before configuring destinations.')).toBeVisible()
})
