import { expect, test } from '@playwright/test'
import { mockSupportLive } from './support-fixture'

test('mail and support badges appear on their own rows in expanded and compact navigation', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.context().setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await page.context().addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: baseURL! },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: baseURL! },
    ])
    await page.route('**/api/backend/support/tickets', route => route.fulfill({
        json: { isSupport: true, tickets: [{ id: 'ticket-1', status: 'open', reply_count: 1 }] },
    }))
    await page.route('**/api/backend/mail/overview**', route => route.fulfill({
        json: { accessibleAccounts: [{ id: 'dashboard-render-proof-user', unreadCount: 1 }] },
    }))

    await page.goto('/dashboard')
    const collapsedCommunication = page.getByRole('button', { name: 'Communication, unread mail and unread support chats' })
    await expect(collapsedCommunication).toBeVisible()
    await expect(collapsedCommunication).toHaveAttribute('aria-expanded', 'false')
    await expect(collapsedCommunication.locator('span[aria-hidden="true"]')).toHaveText('1')
    await expect(collapsedCommunication.locator('span[aria-hidden="true"]')).toHaveClass(/rounded-full.*bg-neutral-700/)

    await collapsedCommunication.click()
    const expandedCommunication = page.getByRole('button', { name: 'Communication', exact: true })
    const mailLink = page.getByRole('link', { name: 'Mail, unread messages', exact: true })
    const supportLink = page.getByRole('link', { name: 'Support Chats, unread messages', exact: true })
    await expect(expandedCommunication).toBeVisible()
    await expect(expandedCommunication).toHaveAttribute('aria-expanded', 'true')
    await expect(expandedCommunication.locator('span[aria-hidden="true"]')).toHaveCount(0)
    await expect(mailLink.locator('span[aria-hidden="true"]')).toHaveText('1')
    await expect(mailLink.locator('span[aria-hidden="true"]')).toHaveClass(/rounded-full.*bg-neutral-700/)
    await expect(supportLink.locator('span[aria-hidden="true"]')).toHaveText('1')
    await expect(supportLink.locator('span[aria-hidden="true"]')).toHaveClass(/rounded-full.*bg-neutral-700/)

    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
    const compactCommunication = page.getByRole('button', { name: 'Open Communication, unread mail and unread support chats' })
    await expect(compactCommunication).toBeVisible()
    await expect(compactCommunication.locator('span[aria-hidden="true"]')).toHaveText('1')
    await expect(compactCommunication.locator('span[aria-hidden="true"]')).toHaveClass(/rounded-full.*bg-neutral-700/)
    await compactCommunication.hover()
    const compactPreview = page.getByRole('region', { name: 'Communication navigation' })
    await expect(compactCommunication.locator('span[aria-hidden="true"]')).toHaveCount(0)
    await expect(compactPreview.getByRole('link', { name: 'Mail, unread messages', exact: true })).toBeVisible()
    await expect(compactPreview.getByRole('link', { name: 'Support Chats, unread messages', exact: true })).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(compactPreview).toBeHidden()
    await expect(compactCommunication.locator('span[aria-hidden="true"]')).toHaveText('1')
})

test('only unread support chats show first and clear their notification when opened', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.context().setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await page.context().addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: baseURL! },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: baseURL! },
    ])
    let unreadReplies = 0
    const tickets = [
        { id: 'read-ticket', subject: 'Read conversation', status: 'open', reply_count: 0, updated_at: '2026-01-02T00:00:00Z', user_name: 'Visitor' },
        { id: 'unread-ticket', subject: 'Unread conversation', status: 'open', reply_count: 0, updated_at: '2026-01-01T00:00:00Z', user_name: 'Visitor' },
    ]
    await page.route('**/api/backend/support/tickets', route => route.fulfill({
        json: { isSupport: true, tickets: tickets.map(ticket => ({ ...ticket, reply_count: ticket.id === 'unread-ticket' ? unreadReplies : ticket.reply_count })) },
    }))
    await page.route('**/api/backend/support/tickets/*/messages', route => route.fulfill({
        json: { messages: [{ id: 'message', sender_id: null, sender_kind: 'user', sender_name: 'Visitor', body: 'Question', created_at: '2026-01-01T00:00:00Z' }] },
    }))
    await page.route('**/api/backend/mail/overview**', route => route.fulfill({
        json: { accessibleAccounts: [{ id: 'dashboard-render-proof-user', unreadCount: 0 }] },
    }))
    const live = await mockSupportLive(page)

    await page.goto('/dashboard')
    await expect(page.getByRole('button', { name: 'Communication', exact: true }).locator('span[aria-hidden="true"]')).toHaveCount(0)
    unreadReplies = 1
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page.getByRole('button', { name: 'Communication, unread support chats' })).toBeVisible()
    await page.getByRole('button', { name: 'Communication, unread support chats' }).click()
    const supportLink = page.getByRole('link', { name: 'Support Chats, unread messages', exact: true })
    await expect(supportLink.locator('span[aria-hidden="true"]')).toHaveText('1')
    await supportLink.click()

    const chatList = page.getByRole('region', { name: 'Support chat', exact: true }).locator('aside')
    const unreadChat = chatList.getByRole('button', { name: /Unread conversation/ })
    await expect(unreadChat.getByRole('img', { name: 'Unread messages' })).toBeVisible()
    await expect(chatList.getByRole('button', { name: /conversation/ }).first()).toContainText('Unread conversation')
    await unreadChat.click()
    await expect(unreadChat.getByRole('img', { name: 'Unread messages' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Support Chats', exact: true }).locator('span[aria-hidden="true"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Communication', exact: true }).locator('span[aria-hidden="true"]')).toHaveCount(0)
    live.close()
})
