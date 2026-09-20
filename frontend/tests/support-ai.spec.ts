import { expect, test } from '@playwright/test'
import { mockSupportLive, supportSnapshot } from './support-fixture'

type Message = { id: string; sender_kind: string; sender_name: string; body: string; request_id?: string }
for (const width of [390, 1440]) {
    test(`guest AI chat and human handoff fit at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 })
        let channel = 'ai'
        const messages: Message[] = []
        await page.route('**/api/support/chat*', async route => {
            if (route.request().method() === 'POST') {
                const body = route.request().postDataJSON()
                messages.push({ id: body.requestId, request_id: body.requestId, sender_kind: 'user', sender_name: 'You', body: body.message })
                if (body.handoff) {
                    channel = 'human'
                    messages.push({ id: 'handoff', sender_kind: 'system', sender_name: 'Support', body: 'You’re in the support queue. A member of the team can read this conversation and reply here.' })
                } else messages.push({ id: 'answer', sender_kind: 'assistant', sender_name: 'Hanasand AI', body: 'Open [Subscriptions](/subscription) to view your plan.' })
            }
            await route.fulfill({ json: { ...supportSnapshot(messages, channel), accepted: true } })
        })
        const live = await mockSupportLive(page)
        await page.goto('/contact')
        if (width === 390) await page.getByRole('button', { name: 'Switch to dark mode' }).click()
        await page.getByLabel('Open support assistant').click()
        const dialog = page.getByRole('dialog', { name: 'Support assistant' })
        await expect(dialog.getByRole('heading', { name: 'How can we help?' })).toBeVisible()
        await expect(dialog.getByRole('link', { name: 'Sign in to support' })).toHaveCount(0)
        const checkLayout = async () => {
            expect(await dialog.evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true)
            const box = (await dialog.boundingBox())!
            const composer = (await dialog.getByLabel('Message', { exact: true }).boundingBox())!
            expect(box.x).toBeGreaterThanOrEqual(0)
            expect(box.y).toBeGreaterThanOrEqual(0)
            expect(box.x + box.width).toBeLessThanOrEqual(width)
            expect(box.y + box.height).toBeLessThanOrEqual(844)
            expect(composer.x + composer.width).toBeLessThanOrEqual(box.x + box.width)
            expect(composer.y + composer.height).toBeLessThanOrEqual(box.y + box.height)
        }
        await checkLayout()
        await page.screenshot({ path: `/tmp/support-ai-welcome-${width}.png` })
        await dialog.getByRole('button', { name: 'Billing question', exact: true }).click()
        await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue('Billing question')
        await dialog.getByRole('button', { name: 'Send message', exact: true }).click()
        await expect(dialog.getByRole('log')).toContainText('view your plan')
        await expect(dialog.getByRole('link', { name: 'Subscriptions', exact: true })).toHaveAttribute('href', '/subscription')
        await dialog.getByRole('button', { name: 'Talk to a human', exact: true }).click()
        await expect(dialog.getByText('Waiting for support.')).toBeVisible()
        await expect(dialog.getByRole('log')).toContainText('view your plan')
        messages.push({ id: 'agent', sender_kind: 'support', sender_name: 'Alex · Support', body: 'I can help with your subscription.' })
        live.notify()
        await expect(dialog.getByRole('log')).toContainText('I can help with your subscription.')
        await checkLayout()
        await page.screenshot({ path: `/tmp/support-ai-handoff-${width}.png` })
        await dialog.getByLabel('Close support assistant').click()
        await page.getByLabel('Open support assistant').click()
        await expect(page.getByRole('log')).toContainText('I can help with your subscription.')
    })
}

test('failed sends retain their draft and retry ID; handoff stays available during AI response', async ({ page }) => {
    const messages: Message[] = []
    const ids: string[] = []
    let fail = true
    let finishAi: (() => void) | undefined
    let channel = 'ai'
    await page.route('**/api/support/chat*', async route => {
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON()
            ids.push(body.requestId)
            if (fail) { await route.fulfill({ status: 503, json: { error: 'We could not send your message.' } }); return }
            if (body.handoff) { channel = 'human'; finishAi?.() }
            else {
                messages.push({ id: body.requestId, request_id: body.requestId, sender_kind: 'user', sender_name: 'You', body: body.message })
                await new Promise<void>(resolve => { finishAi = resolve })
            }
        }
        await route.fulfill({ json: { ...supportSnapshot(messages, channel), accepted: true } })
    })
    await mockSupportLive(page)
    await page.goto('/contact')
    await page.getByLabel('Open support assistant').click()
    const dialog = page.getByRole('dialog')
    const input = dialog.getByLabel('Message', { exact: true })
    await input.fill('Keep this draft')
    await dialog.getByLabel('Send message', { exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('could not send')
    await expect(input).toHaveValue('Keep this draft')
    fail = false
    await dialog.getByLabel('Send message', { exact: true }).click()
    await expect(dialog.getByRole('status')).toContainText('thinking')
    await expect(dialog.getByRole('log')).toContainText('Keep this draft')
    await dialog.getByRole('button', { name: 'Talk to a human', exact: true }).click()
    await expect(dialog.getByText('Waiting for support.')).toBeVisible()
    expect(ids[0]).toBe(ids[1])
})


for (const expiredSession of [false, true]) {
    test(`full support page allows human support without login (expired session: ${expiredSession})`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width: expiredSession ? 1440 : 390, height: 844 })
        if (expiredSession) await page.context().addCookies([{ name: 'id', value: 'expired', url: baseURL! }, { name: 'access_token', value: 'expired', url: baseURL! }])
        await page.route('**/api/backend/support/tickets', route => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }))
        let channel = 'ai'
        const messages: Message[] = []
        await page.route('**/api/support/chat*', async route => {
            if (route.request().method() === 'POST') {
                const body = route.request().postDataJSON()
                expect(body.handoff).toBe(true)
                channel = 'human'
                messages.push({ id: body.requestId, sender_kind: 'user', sender_name: 'You', body: body.message })
            }
            await route.fulfill({ json: { ...supportSnapshot(messages, channel), accepted: true } })
        })
        await mockSupportLive(page)
        await page.goto('/support')
        await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Sign in to support' })).toHaveCount(0)
        await page.getByRole('button', { name: 'Talk to a human', exact: true }).click()
        await expect(page.getByText('Waiting for support.')).toBeVisible()
        await page.reload()
        await expect(page.getByText('Waiting for support.')).toBeVisible()
        expect(new URL(page.url()).pathname).toBe('/support')
        const panel = page.getByRole('region', { name: 'Guest support', exact: true })
        expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true)
        await expect(panel.getByLabel('Message', { exact: true })).toBeVisible()
        await page.screenshot({ path: `/tmp/support-guest-full-${expiredSession ? 'expired' : 'anonymous'}.png` })
    })
}
