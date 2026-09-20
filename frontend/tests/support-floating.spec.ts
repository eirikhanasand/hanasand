import { expect, test } from '@playwright/test'

test('bubble and window drag, remember position, and remain reachable after resizing', async ({ page }) => {
    await page.route('**/api/support/chat', route => route.fulfill({ json: { channel: 'ai', status: 'open', pending: false, messages: [] } }))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/contact')
    const bubble = page.getByLabel('Open support assistant', { exact: true })
    const start = (await bubble.boundingBox())!
    await page.mouse.move(start.x + 32, start.y + 32)
    await page.mouse.down()
    await page.mouse.move(start.x - 350, start.y - 200, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByRole('dialog', { name: 'Support assistant' })).toBeHidden()
    const moved = (await bubble.boundingBox())!
    expect(moved.x).toBeLessThan(start.x - 300)
    expect(moved.y).toBeLessThan(start.y - 150)
    await page.reload()
    await expect.poll(async () => (await bubble.boundingBox())!.x).toBeCloseTo(moved.x, 0)
    await bubble.click()
    const dialog = page.getByRole('dialog', { name: 'Support assistant' })
    await expect(dialog).toBeVisible()
    const handle = page.getByRole('button', { name: 'Move support window', exact: true })
    const before = (await dialog.boundingBox())!
    const grip = (await handle.boundingBox())!
    await page.mouse.move(grip.x + 20, grip.y + 20)
    await page.mouse.down()
    await page.mouse.move(grip.x - 300, grip.y + 50, { steps: 8 })
    await page.mouse.up()
    expect((await dialog.boundingBox())!.x).toBeLessThan(before.x - 250)
    await handle.focus()
    const keyboardStart = (await dialog.boundingBox())!.x
    await page.keyboard.press('ArrowLeft')
    await expect.poll(async () => (await dialog.boundingBox())!.x).toBeCloseTo(keyboardStart - 10, 0)
    await page.setViewportSize({ width: 390, height: 650 })
    await expect.poll(async () => {
        const box = (await dialog.boundingBox())!
        return box.x >= 8 && box.y >= 8 && box.x + box.width <= 382 && box.y + box.height <= 642
    }).toBe(true)
    await expect(dialog.getByLabel('Message', { exact: true })).toBeVisible()
    await page.screenshot({ path: '/tmp/support-floating-mobile.png' })
})

test('touch dragging moves the bubble without opening it', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route('**/api/support/chat', route => route.fulfill({ json: { channel: 'ai', status: 'open', pending: false, messages: [] } }))
    await page.goto('/contact')
    const bubble = page.getByLabel('Open support assistant', { exact: true })
    const start = (await bubble.boundingBox())!
    const client = await context.newCDPSession(page)
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x + 32, y: start.y + 32 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 60, y: 250 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByRole('dialog', { name: 'Support assistant' })).toBeHidden()
    await expect.poll(async () => (await bubble.boundingBox())!.y).toBeLessThan(300)
    await bubble.click()
    await expect(page.getByRole('dialog', { name: 'Support assistant' })).toBeVisible()
})

test('closed chat notifies for new replies, persists unread state, and clears when read', async ({ page }) => {
    await page.clock.install()
    const messages = [{ id: 'first', sender_kind: 'assistant', sender_name: 'Hanasand AI', body: 'How can I help?' }]
    await page.route('**/api/support/chat', route => route.fulfill({ json: { channel: 'human', status: 'open', pending: false, messages } }))
    await page.goto('/contact')
    await expect(page.getByRole('status', { name: '1 unread support reply' })).toBeVisible()
    await page.getByLabel('Open support assistant', { exact: true }).click()
    await expect(page.getByRole('log')).toContainText('How can I help?')
    await page.getByRole('dialog', { name: 'Support assistant' }).getByLabel('Message', { exact: true }).fill('Keep my draft')
    await page.getByLabel('Close support assistant').click()
    await expect(page.getByRole('status', { name: /unread support/ })).toHaveCount(0)
    messages.push({ id: 'user', sender_kind: 'user', sender_name: 'You', body: 'My question' }, { id: 'system', sender_kind: 'system', sender_name: 'Support', body: 'In queue' })
    await page.clock.fastForward(16000)
    await expect(page.getByRole('status', { name: /unread support/ })).toHaveCount(0)
    messages.push({ id: 'agent', sender_kind: 'support', sender_name: 'Alex', body: 'I can help you.' })
    await page.clock.fastForward(16000)
    await expect(page.getByRole('status', { name: '1 unread support reply' })).toBeVisible()
    await page.screenshot({ path: '/tmp/support-unread-badge.png' })
    await page.reload()
    await expect(page.getByRole('status', { name: '1 unread support reply' })).toBeVisible()
    await page.getByLabel('Open support assistant', { exact: true }).click()
    await expect(page.getByRole('log')).toContainText('I can help you.')
    await page.getByRole('dialog', { name: 'Support assistant' }).getByLabel('Message', { exact: true }).fill('Draft survives closing')
    await page.getByLabel('Close support assistant').click()
    await page.getByLabel('Open support assistant', { exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Support assistant' }).getByLabel('Message', { exact: true })).toHaveValue('Draft survives closing')
    await page.getByLabel('Close support assistant').click()
    await page.reload()
    await expect(page.getByRole('status', { name: /unread support/ })).toHaveCount(0)
})

test('an AI reply arriving after closing the window raises the badge', async ({ page }) => {
    const messages: { id: string; request_id?: string; sender_kind: string; sender_name: string; body: string }[] = []
    let finishReply: (() => void) | undefined
    await page.route('**/api/support/chat', async route => {
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON()
            messages.push({ id: body.requestId, request_id: body.requestId, sender_kind: 'user', sender_name: 'You', body: body.message })
            await new Promise<void>(resolve => { finishReply = resolve })
            messages.push({ id: 'late-answer', sender_kind: 'assistant', sender_name: 'Hanasand AI', body: 'Here is your answer.' })
        }
        await route.fulfill({ json: { channel: 'ai', status: 'open', pending: false, accepted: true, messages } })
    })
    await page.goto('/contact')
    await page.getByLabel('Open support assistant', { exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Support assistant' })
    await dialog.getByLabel('Message', { exact: true }).fill('A question')
    await dialog.getByLabel('Send message', { exact: true }).click()
    await expect.poll(() => Boolean(finishReply)).toBe(true)
    await page.getByLabel('Close support assistant').click()
    finishReply!()
    await expect(page.getByRole('status', { name: '1 unread support reply' })).toBeVisible()
    await page.getByLabel('Open support assistant', { exact: true }).click()
    await expect(dialog.getByRole('log')).toContainText('Here is your answer.')
    await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue('')
})
