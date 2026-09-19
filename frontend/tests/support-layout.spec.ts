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

    test(`public support bubble fits and preserves failed drafts at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 })
        await page.route('**/api/backend/support/tickets', route => route.fulfill({ json: { role: 'user', tickets: [ticket] } }))
        let fail = true
        await page.route('**/api/backend/support/tickets/*/messages', route => route.request().method() === 'POST'
            ? route.fulfill(fail ? { status: 500, json: {} } : { json: { ok: true } })
            : route.fulfill({ json: { messages: [message] } }))
        await page.goto('/contact')
        await page.getByRole('button', { name: 'Switch to dark mode' }).click()
        await page.getByLabel('Open support assistant').click()
        const dialog = page.getByRole('dialog', { name: 'Support assistant' })
        await expect(dialog.getByRole('log')).toContainText(message.body)
        await page.getByRole('region', { name: 'Support chat', exact: true }).getByLabel('Message', { exact: true }).fill('Keep this draft')
        await page.getByRole('button', { name: 'Send', exact: true }).click()
        await expect(dialog.getByRole('alert')).toContainText('could not send')
        await expect(page.getByRole('region', { name: 'Support chat', exact: true }).getByLabel('Message', { exact: true })).toHaveValue('Keep this draft')
        expect(await dialog.evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true)
        const box = await dialog.boundingBox()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.y).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width)
        expect(box!.y + box!.height).toBeLessThanOrEqual(844)
        await page.screenshot({ path: `/tmp/support-bubble-${width}.png` })
        fail = false
        await page.getByRole('button', { name: 'Send', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Support chat', exact: true }).getByLabel('Message', { exact: true })).toHaveValue('')
        await page.getByLabel('Close support assistant').click()
        await expect(dialog).toHaveCount(0)
    })
}

test('signed-out visitors get a sign-in action, and an empty staff queue has no composer', async ({ page }) => {
    await page.route('**/api/backend/support/tickets', route => route.fulfill({ status: 401, json: {} }))
    await page.goto('/contact')
    await page.getByLabel('Open support assistant').click()
    await expect(page.getByRole('link', { name: 'Sign in to support' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Support chat', exact: true }).getByLabel('Message', { exact: true })).toHaveCount(0)
    await page.unroute('**/api/backend/support/tickets')
    await page.route('**/api/backend/support/tickets', route => route.fulfill({ json: { role: 'support', tickets: [] } }))
    await page.goto('/support')
    await expect(page.getByText('Select a customer chat to read and reply.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Support chat', exact: true }).getByLabel('Message', { exact: true })).toHaveCount(0)
})
