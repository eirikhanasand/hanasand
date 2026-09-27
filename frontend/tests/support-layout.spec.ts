import { expect, test } from '@playwright/test'
import { mockSupportLive, supportSnapshot } from './support-fixture'

const ticket = { id: 'ticket-1', subject: 'Account question', status: 'open', user_name: 'Customer', updated_at: '2026-09-19T12:00:00Z' }
const message = { id: 'message-1', sender_id: 'customer', sender_name: 'Customer', body: 'I need help with my account.', created_at: ticket.updated_at }

for (const width of [390, 1440]) {
    test(`support uses the internal frame and fits at ${width}px`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.context().addCookies([{ name: 'id', value: 'customer', url: baseURL! }, { name: 'access_token', value: 'local-test', url: baseURL! }])
        await page.route('**/api/backend/support/tickets', route => route.fulfill({ json: { realtime: true, role: 'support', tickets: [ticket] } }))
        await page.route('**/api/backend/support/tickets/*/messages', route => route.fulfill({ json: { messages: [message] } }))
        await mockSupportLive(page)
        await page.goto('/support')
        await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible()
        await expect(page.getByRole('log')).toContainText(message.body)
        await expect(page.getByLabel('Open support assistant')).toHaveCount(0)
        await expect(page.locator('[data-site-header]')).toBeVisible()
        if (width >= 1280) await expect(page.getByRole('button', { name: 'Product', exact: true })).toBeVisible()
        const chat = page.getByRole('region', { name: 'Support chat', exact: true })
        expect(await chat.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
        const box = await chat.boundingBox()
        if (width > 1024) {
            const frame = await page.locator('[data-route-frame]').boundingBox()
            expect(Math.abs((box!.y - frame!.y) - (frame!.y + frame!.height - box!.y - box!.height))).toBeLessThan(1)
        }
        const composer = await page.getByRole('region', { name: 'Support chat', exact: true }).getByLabel('Message', { exact: true }).boundingBox()
        expect(composer!.x + composer!.width).toBeLessThanOrEqual(box!.x + box!.width)
        expect(composer!.y + composer!.height).toBeLessThanOrEqual(box!.y + box!.height)
        if (width > 1024) {
            const left = await page.getByRole('heading', { name: 'Support' }).boundingBox()
            const right = await page.getByRole('heading', { name: 'Account question' }).boundingBox()
            expect(Math.abs(left!.y - right!.y)).toBeLessThan(2)
            await expect(page.getByRole('link', { name: 'Support Chats', exact: true })).toBeVisible()
        }
        await page.screenshot({ path: `/tmp/support-page-${width}.png`, fullPage: true })
    })

}

test('an empty staff queue has no composer', async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: 'id', value: 'agent', url: baseURL! }, { name: 'access_token', value: 'local-test', url: baseURL! }])
    await page.route('**/api/backend/support/tickets', route => route.fulfill({ json: { realtime: true, role: 'support', tickets: [] } }))
    await mockSupportLive(page)
    await page.goto('/support')
    await expect(page.getByText('Select a customer chat to read and reply.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Support chat', exact: true }).getByLabel('Message', { exact: true })).toHaveCount(0)
})


test('public support places close conversation beside new chat', async ({ page }) => {
    const messages: { id: string; sender_kind: string; sender_name: string; body: string }[] = []
    await page.route('**/api/support/chat*', async route => {
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON()
            if (body.action === 'resolve') return route.fulfill({ json: { ...supportSnapshot(messages), status: 'closed' } })
            if (body.message) messages.push({ id: 'reply', sender_kind: 'assistant', sender_name: 'Hanasand AI', body: 'I can help with that.' })
        }
        await route.fulfill({ json: supportSnapshot(messages) })
    })
    await mockSupportLive(page)
    await page.goto('/support')
    await page.getByLabel('Message', { exact: true }).fill('Help with my account')
    await page.getByRole('button', { name: 'Send message' }).click()
    const newChat = page.getByRole('button', { name: 'New chat', exact: true })
    const closeChat = page.getByRole('button', { name: 'Close conversation', exact: true })
    await expect(closeChat).toBeVisible()
    const newChatBox = (await newChat.boundingBox())!
    const closeChatBox = (await closeChat.boundingBox())!
    expect(Math.abs(newChatBox.y - closeChatBox.y)).toBeLessThan(2)
    expect(newChatBox.x + newChatBox.width).toBeLessThanOrEqual(closeChatBox.x)
})

test('an unanswered conversation asks whether the customer found what they needed', async ({ page }) => {
    const feedback: Record<string, unknown>[] = []
    let closed = false
    await page.route('**/api/support/chat*', async route => {
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON()
            if (body.action === 'resolve') { closed = true; return route.fulfill({ json: { ...supportSnapshot([]), status: 'closed', resolution_version: 1, has_response: false } }) }
            if (body.action === 'close-feedback') { feedback.push(body); return route.fulfill({ json: { ok: true } }) }
        }
        await route.fulfill({ json: { ...supportSnapshot([]), status: closed ? 'closed' : 'open', resolution_version: closed ? 1 : 0, has_response: false, close_feedback_found: feedback.find(item => item.action === 'close-feedback')?.foundWhatLookingFor ?? null } })
    })
    await mockSupportLive(page)
    await page.goto('/support')
    await page.getByRole('button', { name: 'Close conversation' }).click()
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await expect(page.getByLabel('Reason', { exact: true })).toBeVisible()
    await page.getByLabel('Reason', { exact: true }).fill('I needed billing help.')
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByText('Thank you for letting us know.')).toBeVisible()
    expect(feedback).toHaveLength(2)
    expect(feedback[0]).toMatchObject({ action: 'close-feedback', foundWhatLookingFor: false })
    expect(feedback[1]).toMatchObject({ action: 'close-feedback', foundWhatLookingFor: false, reason: 'I needed billing help.' })
    await page.reload()
    await expect(page.getByText('Thank you for letting us know.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'No', exact: true })).toHaveCount(0)
})


test('internal support shows only the site loading icon while tickets load', async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: 'id', value: 'agent', url: baseURL! }, { name: 'access_token', value: 'local-test', url: baseURL! }])
    await page.route('**/api/backend/support/tickets', async route => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await route.fulfill({ json: { realtime: true, role: 'support', tickets: [] } })
    })
    await mockSupportLive(page)
    await page.goto('/support')
    const chat = page.getByRole('region', { name: 'Support chat', exact: true })
    await expect(chat.locator('.site-loading-icon')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your support chats' })).toHaveCount(0)
    await expect(chat.getByRole('heading', { name: 'Support' })).toBeVisible()
})
