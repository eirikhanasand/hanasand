import { expect, test } from '@playwright/test'

const ticket = { id: 'ticket-1', subject: 'Account question', status: 'open', user_name: 'Customer', updated_at: '2026-09-19T12:00:00Z' }
const message = { id: 'message-1', sender_id: 'customer', sender_name: 'Customer', body: 'I need help with my account.', created_at: ticket.updated_at }

for (const width of [390, 1440]) {
    test(`support uses the internal frame and fits at ${width}px`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.context().addCookies([{ name: 'id', value: 'customer', url: baseURL! }, { name: 'access_token', value: 'local-test', url: baseURL! }])
        await page.route('**/api/backend/support/tickets', route => route.fulfill({ json: { role: 'support', tickets: [ticket] } }))
        await page.route('**/api/backend/support/tickets/*/messages', route => route.fulfill({ json: { messages: [message] } }))
        await page.goto('/support')
        await expect(page.getByRole('heading', { name: 'Support queue' })).toBeVisible()
        await expect(page.getByRole('log')).toContainText(message.body)
        await expect(page.getByLabel('Open support assistant')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Product', exact: true })).toHaveCount(0)
        const chat = page.getByRole('region', { name: 'Support chat', exact: true })
        expect(await chat.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
        const box = await chat.boundingBox()
        const composer = await page.getByRole('region', { name: 'Support chat', exact: true }).getByLabel('Message', { exact: true }).boundingBox()
        expect(composer!.x + composer!.width).toBeLessThanOrEqual(box!.x + box!.width)
        expect(composer!.y + composer!.height).toBeLessThanOrEqual(box!.y + box!.height)
        if (width > 1024) {
            const left = await page.getByRole('heading', { name: 'Support queue' }).boundingBox()
            const right = await page.getByRole('heading', { name: 'Account question' }).boundingBox()
            expect(Math.abs(left!.y - right!.y)).toBeLessThan(2)
            await expect(page.getByRole('link', { name: 'Support chats', exact: true })).toBeVisible()
        }
        await page.screenshot({ path: `/tmp/support-page-${width}.png`, fullPage: true })
    })

}

test('an empty staff queue has no composer', async ({ page }) => {
    await page.route('**/api/backend/support/tickets', route => route.fulfill({ json: { role: 'support', tickets: [] } }))
    await page.goto('/support')
    await expect(page.getByText('Select a customer chat to read and reply.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Support chat', exact: true }).getByLabel('Message', { exact: true })).toHaveCount(0)
})
