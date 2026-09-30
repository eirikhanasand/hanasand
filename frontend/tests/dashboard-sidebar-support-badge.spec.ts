import { expect, test } from '@playwright/test'

test('mail and support badges appear on their own rows in expanded and compact navigation', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.context().setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await page.context().addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: baseURL! },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: baseURL! },
    ])
    await page.route('**/api/backend/support/tickets', route => route.fulfill({
        json: { isSupport: true, tickets: [{ id: 'ticket-1', status: 'open' }] },
    }))
    await page.route('**/api/backend/mail/overview**', route => route.fulfill({
        json: { accessibleAccounts: [{ id: 'dashboard-render-proof-user', unreadCount: 1 }] },
    }))

    await page.goto('/dashboard')
    const collapsedCommunication = page.getByRole('button', { name: 'Communication, unread mail and pending support chats' })
    await expect(collapsedCommunication).toBeVisible()
    await expect(collapsedCommunication).toHaveAttribute('aria-expanded', 'false')
    await expect(collapsedCommunication.locator('span[aria-hidden="true"]')).toHaveText('1')
    await expect(collapsedCommunication.locator('span[aria-hidden="true"]')).toHaveClass(/rounded-full.*bg-neutral-700/)

    await collapsedCommunication.click()
    const expandedCommunication = page.getByRole('button', { name: 'Communication', exact: true })
    const mailLink = page.getByRole('link', { name: 'Mail, unread messages', exact: true })
    const supportLink = page.getByRole('link', { name: 'Support Chats, pending conversations', exact: true })
    await expect(expandedCommunication).toBeVisible()
    await expect(expandedCommunication).toHaveAttribute('aria-expanded', 'true')
    await expect(expandedCommunication.locator('span[aria-hidden="true"]')).toHaveCount(0)
    await expect(mailLink.locator('span[aria-hidden="true"]')).toHaveText('1')
    await expect(mailLink.locator('span[aria-hidden="true"]')).toHaveClass(/rounded-full.*bg-neutral-700/)
    await expect(supportLink.locator('span[aria-hidden="true"]')).toHaveText('1')
    await expect(supportLink.locator('span[aria-hidden="true"]')).toHaveClass(/rounded-full.*bg-neutral-700/)

    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
    const compactCommunication = page.getByRole('button', { name: 'Open Communication, unread mail and pending support chats' })
    await expect(compactCommunication).toBeVisible()
    await expect(compactCommunication.locator('span[aria-hidden="true"]')).toHaveText('1')
    await expect(compactCommunication.locator('span[aria-hidden="true"]')).toHaveClass(/rounded-full.*bg-neutral-700/)
    await compactCommunication.hover()
    const compactPreview = page.getByRole('region', { name: 'Communication navigation' })
    await expect(compactCommunication.locator('span[aria-hidden="true"]')).toHaveCount(0)
    await expect(compactPreview.getByRole('link', { name: 'Mail, unread messages', exact: true })).toBeVisible()
    await expect(compactPreview.getByRole('link', { name: 'Support Chats, pending conversations', exact: true })).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(compactPreview).toBeHidden()
    await expect(compactCommunication.locator('span[aria-hidden="true"]')).toHaveText('1')
})
