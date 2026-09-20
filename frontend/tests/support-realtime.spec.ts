import { expect, test } from '@playwright/test'
import { mockSupportLive } from './support-fixture'

test('multiple chats keep history, drafts and unread replies while another chat is open', async ({ page }) => {
    const first = '11111111-1111-4111-8111-111111111111'
    type Chat = { id: string; subject: string; channel: string; status: string; pending: boolean; agent_name?: string; messages: { id: string; sender_kind: string; sender_name: string; body: string; request_id?: string }[] }
    const chats: Chat[] = [{ id: first, subject: 'Billing', channel: 'human', status: 'open', pending: false, messages: [{ id: 'question', sender_kind: 'user', sender_name: 'You', body: 'Billing help' }] }]
    let reads = 0
    await page.route('**/api/support/chat*', async route => {
        const request = route.request()
        const body = request.method() === 'POST' ? request.postDataJSON() : null
        const id = body?.conversationId || new URL(request.url()).searchParams.get('conversationId') || first
        let chat = chats.find(chat => chat.id === id)
        if (body) {
            if (!chat) { chat = { id, subject: body.message, channel: 'ai', status: 'open', pending: false, messages: [] }; chats.unshift(chat) }
            chat.messages.push({ id: body.requestId, request_id: body.requestId, sender_kind: 'user', sender_name: 'You', body: body.message })
        } else reads++
        await route.fulfill({ json: { ...(chat || { id, channel: 'ai', status: 'open', messages: [], pending: false }), tickets: chats.map(chat => ({ id: chat.id, subject: chat.subject, reply_count: chat.messages.filter(message => ['assistant', 'support'].includes(message.sender_kind)).length })) } })
    })
    const live = await mockSupportLive(page)
    await page.goto('/contact')
    await page.getByLabel('Open support assistant', { exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Support assistant' })
    await expect(dialog.getByText('Waiting for support.', { exact: true })).toBeVisible()
    await dialog.getByLabel('Message', { exact: true }).fill('Unsent billing draft')
    await dialog.getByRole('button', { name: 'New chat', exact: true }).click()
    await expect(dialog.getByRole('heading', { name: 'How can we help?' })).toBeVisible()
    await dialog.getByLabel('Message', { exact: true }).fill('Another question')
    await dialog.getByLabel('Send message', { exact: true }).click()
    await expect(dialog.getByRole('log')).toContainText('Another question')
    const second = chats.find(chat => chat.id !== first)!.id
    const old = chats.find(chat => chat.id === first)!
    old.agent_name = 'Eirik Hanasand'
    old.messages.push({ id: 'reply', sender_kind: 'support', sender_name: 'Eirik Hanasand', body: 'Happy to help with billing.' })
    const started = Date.now(); live.notify()
    await expect(dialog.getByRole('status', { name: 'Unread replies in other chats' })).toHaveText('1', { timeout: 1200 })
    expect(Date.now() - started).toBeLessThan(1200)
    await expect(dialog.getByRole('log')).not.toContainText('Happy to help')
    await dialog.getByLabel('Conversation', { exact: true }).selectOption(first)
    await expect(dialog.getByText('Speaking with Eirik Hanasand', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('log')).toContainText('Happy to help with billing.')
    await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue('Unsent billing draft')
    await expect(dialog.getByRole('status', { name: 'Unread replies in other chats' })).toHaveCount(0)
    await dialog.getByLabel('Conversation', { exact: true }).selectOption(second)
    await page.getByLabel('Close support assistant').click()
    old.messages.push({ id: 'later', sender_kind: 'support', sender_name: 'Eirik Hanasand', body: 'One more thing.' }); live.notify()
    await expect(page.getByRole('status', { name: '1 unread support reply' })).toBeVisible({ timeout: 1200 })
    await page.reload()
    await expect(page.getByRole('status', { name: '1 unread support reply' })).toBeVisible()
    await page.getByLabel('Open support assistant', { exact: true }).click()
    await expect(dialog.getByLabel('Conversation', { exact: true })).toHaveValue(second)
    await page.screenshot({ path: '/tmp/support-history-unread.png' })
    const before = reads
    await page.waitForTimeout(4200)
    expect(reads).toBe(before)
    live.close()
    old.messages.push({ id: 'offline', sender_kind: 'support', sender_name: 'Eirik Hanasand', body: 'Sent while reconnecting.' })
    await expect(dialog.getByRole('status', { name: 'Unread replies in other chats' })).toHaveText('2')
    await dialog.getByLabel('Conversation', { exact: true }).selectOption(first)
    await expect(dialog.getByRole('log')).toContainText('Sent while reconnecting.')
})

test('staff receives live queue updates and a recovered refresh clears the error', async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: 'id', value: 'agent', url: baseURL! }, { name: 'access_token', value: 'test', url: baseURL! }])
    const tickets = [{ id: 'chat-a', subject: 'First question', user_name: 'Visitor', reply_count: 1 }, { id: 'chat-b', subject: 'Other question', user_name: 'Visitor', reply_count: 0 }]
    let fail = false
    const messages = [{ id: 'q1', sender_id: null, sender_kind: 'user', sender_name: 'Visitor', body: 'Hello' }]
    await page.route('**/api/backend/support/tickets', route => route.fulfill({ json: { role: 'support', tickets } }))
    await page.route('**/api/backend/support/tickets/*/messages', route => route.fulfill(fail ? { status: 503, json: { error: 'Temporary failure' } } : { json: { messages } }))
    const live = await mockSupportLive(page)
    await page.goto('/support')
    await expect(page.getByRole('log')).toContainText('Hello')
    fail = true; live.notify()
    await expect(page.getByRole('region', { name: 'Support chat', exact: true }).getByRole('alert')).toContainText('could not load')
    fail = false; messages.push({ id: 'q2', sender_id: null, sender_kind: 'user', sender_name: 'Visitor', body: 'Is anyone there?' }); tickets[1].reply_count = 1; live.notify()
    await expect(page.getByRole('log')).toContainText('Is anyone there?', { timeout: 1200 })
    await expect(page.getByRole('region', { name: 'Support chat', exact: true }).getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Other question/ }).getByRole('status')).toHaveText('1')
})

test('starting another chat while AI is answering keeps the reply with its original chat', async ({ page }) => {
    const first = '22222222-2222-4222-8222-222222222222'
    const messages: { id: string; request_id?: string; sender_kind: string; sender_name: string; body: string }[] = []
    let finish: (() => void) | undefined
    let pending = false
    await page.route('**/api/support/chat*', async route => {
        const id = new URL(route.request().url()).searchParams.get('conversationId') || first
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON()
            messages.push({ id: body.requestId, request_id: body.requestId, sender_kind: 'user', sender_name: 'You', body: body.message })
            pending = true
            await new Promise<void>(resolve => { finish = resolve })
            messages.push({ id: 'answer', sender_kind: 'assistant', sender_name: 'Hanasand AI', body: 'The answer to the first question.' }); pending = false
        }
        await route.fulfill({ json: { id, channel: 'ai', status: 'open', pending: id === first && pending, messages: id === first ? messages : [],
            tickets: [{ id: first, subject: 'First chat', reply_count: messages.filter(message => message.sender_kind === 'assistant').length }] } })
    })
    const live = await mockSupportLive(page)
    await page.goto('/contact')
    await page.getByLabel('Open support assistant', { exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Support assistant' })
    await dialog.getByLabel('Message', { exact: true }).fill('First question')
    await dialog.getByLabel('Send message', { exact: true }).click()
    await expect.poll(() => Boolean(finish)).toBe(true)
    await dialog.getByRole('button', { name: 'New chat', exact: true }).click()
    await dialog.getByLabel('Message', { exact: true }).fill('My second draft')
    finish!(); live.notify()
    await expect(dialog.getByRole('status', { name: 'Unread replies in other chats' })).toHaveText('1')
    await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue('My second draft')
    await expect(dialog.getByRole('log')).not.toContainText('answer to the first')
    await dialog.getByLabel('Conversation', { exact: true }).selectOption(first)
    await expect(dialog.getByRole('log')).toContainText('The answer to the first question.')
    await expect(dialog.getByLabel('Message', { exact: true })).toHaveValue('')
})
