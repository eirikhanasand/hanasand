import { expect, test } from '@playwright/test'
import { mockSupportLive } from './support-fixture'

for (const width of [390, 1440]) test(`resolved guest chat collects low ratings and reopens live at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const id = '55555555-5555-4555-8555-555555555555'
    let status = 'open', rating: number | null = null, comment = '', fail = true
    await page.route('**/api/support/chat*', async route => {
        const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null
        if (body?.action === 'feedback') {
            expect(body).toMatchObject({ conversationId: id, resolutionVersion: 1, rating: 3, comment: 'Please explain the steps.' })
            if (fail) return route.fulfill({ status: 503, json: { error: 'Please try again.' } })
            rating = body.rating; comment = body.comment
        }
        await route.fulfill({ json: { id, status, channel: 'human', pending: false, resolution_version: 1, feedback_rating: rating, feedback_comment: comment,
            messages: [{ id: 'question', sender_kind: 'user', sender_name: 'You', body: 'Help please' }], tickets: [{ id, subject: 'Help please', reply_count: status === 'closed' ? 1 : 0 }] } })
    })
    const live = await mockSupportLive(page)
    await page.goto('/contact'); await page.getByLabel('Open support assistant', { exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Support assistant' })
    await expect(dialog.getByLabel('Message', { exact: true })).toBeVisible()
    await page.getByLabel('Close support assistant').click()
    status = 'closed'; live.notify()
    await expect(page.getByRole('status', { name: '1 unread support reply' })).toBeVisible()
    await page.getByLabel('Open support assistant', { exact: true }).click()
    await expect(dialog.getByText('Chat resolved', { exact: true })).toBeVisible()
    await expect(dialog.getByLabel('Message', { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: '5 stars', exact: true }).click()
    await expect(dialog.getByLabel('Feedback', { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: '3 stars', exact: true }).click()
    await dialog.getByLabel('Feedback', { exact: true }).fill('Please explain the steps.')
    await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Please try again.')
    await expect(dialog.getByLabel('Feedback', { exact: true })).toHaveValue('Please explain the steps.')
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true)
    await page.screenshot({ path: `/tmp/support-resolved-guest-${width}.png` })
    fail = false
    await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click()
    await expect(dialog.getByText('Thank you for your feedback.')).toBeVisible()
    await page.reload(); await page.getByLabel('Open support assistant', { exact: true }).click()
    await expect(dialog.getByLabel('3 out of 5 stars')).toBeVisible()
    status = 'open'; live.notify()
    await expect(dialog.getByLabel('Message', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Send feedback', exact: true })).toHaveCount(0)
})

test('staff resolves, sees queue tag and written feedback, then reopens', async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: 'id', value: 'agent', url: baseURL! }, { name: 'access_token', value: 'test', url: baseURL! }])
    const ticket = { id: 'ticket', subject: 'Billing help', status: 'open', user_name: 'Visitor', reply_count: 1, resolution_version: 0, feedback_rating: null as number | null, feedback_comment: '' }
    await page.route('**/api/backend/support/tickets', route => route.fulfill({ json: { realtime: true, role: 'support', tickets: [ticket] } }))
    await page.route('**/api/backend/support/tickets/ticket/messages', route => route.fulfill({ json: { messages: [{ id: 'message', sender_kind: 'user', sender_name: 'Visitor', body: 'Help with billing.' }] } }))
    await page.route('**/api/backend/support/tickets/ticket/status', route => { ticket.status = route.request().postDataJSON().status; return route.fulfill({ json: { ok: true } }) })
    const live = await mockSupportLive(page)
    await page.goto('/support')
    await page.getByRole('button', { name: 'Resolve chat', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Reopen chat', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Billing help.*Resolved/ })).toBeVisible()
    await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0)
    ticket.feedback_rating = 2; ticket.feedback_comment = 'Please explain the bill.'; live.notify()
    const feedback = page.getByRole('region', { name: 'Customer feedback' })
    await expect(feedback).toContainText('Please explain the bill.')
    await expect(page.getByRole('button', { name: /Billing help.*Resolved/ }).getByLabel('2 out of 5 stars')).toBeVisible()
    await page.screenshot({ path: '/tmp/support-resolved-staff.png' })
    await page.getByRole('button', { name: 'Reopen chat', exact: true }).click()
    await expect(page.getByLabel('Message', { exact: true })).toBeVisible()
    await expect(feedback).toContainText('Please explain the bill.')
    await expect(page.getByText('Resolved', { exact: true })).toHaveCount(0)
})
