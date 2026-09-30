import { expect, test } from '@playwright/test'

test('pending support is shown in expanded and compact dashboard sidebars', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.context().addCookies([
        { name: 'id', value: 'support-agent', url: baseURL! },
        { name: 'access_token', value: 'local-test', url: baseURL! },
    ])
    await page.route('**/api/backend/support/tickets', route => route.fulfill({
        json: { isSupport: true, tickets: [{ id: 'ticket-1', status: 'open' }] },
    }))

    await page.goto('/support')
    const expandedCommunication = page.getByRole('button', { name: 'Communication, 1 pending support chat' })
    await expect(expandedCommunication).toBeVisible()
    await expect(expandedCommunication.locator('span').filter({ hasText: /^1$/ })).toHaveClass(/rounded-full.*bg-neutral-700/)

    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
    const compactCommunication = page.getByRole('button', { name: 'Open Communication, 1 pending support chat' })
    await expect(compactCommunication).toBeVisible()
    await expect(compactCommunication.locator('span')).toHaveText('1')
    await expect(compactCommunication.locator('span')).toHaveClass(/rounded-full.*bg-neutral-700/)
})
