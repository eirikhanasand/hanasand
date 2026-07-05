import { expect, test } from '@playwright/test'

test('public DWM webhook preview validates delivery shape without creating a tenant subscription', async ({ page }) => {
    await page.goto('/solutions/dwm#webhooks', { waitUntil: 'domcontentloaded' })
    const preview = page.locator('#webhooks')
    await preview.scrollIntoViewIfNeeded()

    await expect(preview.getByRole('heading', { name: 'Webhook payload preview' })).toBeVisible()
    await expect(preview.getByText('Customer endpoint delivery is created inside the authenticated console.')).toBeVisible()
    await expect(preview.locator('[data-dwm-public-webhook-boundary]')).toContainText('Endpoint safety')
    await expect(preview.locator('[data-dwm-public-webhook-boundary]')).toContainText('without contacting your endpoint')
    await expect(preview.locator('[data-dwm-webhook-preview-ready="true"]')).toBeVisible()

    await preview.getByRole('button', { name: 'Save local preview' }).click()
    await expect(preview.getByText(/Preview draft saved locally/)).toBeVisible()
    await expect(preview.getByText(/The endpoint is not contacted from this public page/)).toBeVisible()

    await preview.getByRole('button', { name: 'Validate delivery preview' }).click()
    await expect(preview.getByText(/Delivery preview accepted by the Hanasand receiver/)).toBeVisible()
    await expect(preview.getByText(/Your endpoint was not contacted/)).toBeVisible()
    await expect(preview.getByRole('link', { name: 'Create in console' })).toHaveAttribute('href', '/dashboard/automations?setup=dwm')
})
