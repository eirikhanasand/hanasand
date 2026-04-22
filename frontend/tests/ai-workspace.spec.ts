import { expect, test } from '@playwright/test'

const apiBase = process.env.PLAYWRIGHT_API_BASE || 'http://127.0.0.1:8080/api'

test('persisted AI workspace loads from the database into the app shell', async ({ browser, request, baseURL }) => {
    const suffix = Date.now()
    const id = `ai_ui_${suffix}`
    const password = `Aa11!!${suffix}Bb22!!`
    const conversationId = `conv_${suffix}`
    const messageId = `msg_${suffix}`

    const signup = await request.post(`${apiBase}/user`, {
        data: { id, name: 'AI Workspace', password },
    })
    expect(signup.ok()).toBeTruthy()
    const signupBody = await signup.json()
    const token = decodeURIComponent(String(signupBody.token || ''))
    expect(token.length).toBeGreaterThan(20)

    const createConversation = await request.post(`${apiBase}/ai/conversations`, {
        headers: {
            Authorization: `Bearer ${token}`,
            id,
        },
        data: {
            id: conversationId,
            title: 'Database chat',
            modelStrategy: 'auto',
            preferredModel: null,
            activeModel: null,
            workspaceKind: null,
            workspaceId: null,
            shareIds: [],
            workspaceMeta: {},
        },
    })
    expect(createConversation.ok()).toBeTruthy()

    const storeMessage = await request.put(`${apiBase}/ai/conversations/${conversationId}/messages`, {
        headers: {
            Authorization: `Bearer ${token}`,
            id,
        },
        data: {
            id: messageId,
            role: 'user',
            content: 'Persist this coding plan.',
            pending: false,
            error: false,
            modelName: null,
            metadata: { source: 'playwright' },
            createdAt: new Date().toISOString(),
        },
    })
    expect(storeMessage.ok()).toBeTruthy()

    const context = await browser.newContext({
        baseURL,
    })
    await context.addCookies([
        {
            name: 'id',
            value: id,
            domain: '127.0.0.1',
            path: '/',
        },
        {
            name: 'access_token',
            value: token,
            domain: '127.0.0.1',
            path: '/',
        },
    ])
    const page = await context.newPage()
    await page.goto('/ai')

    await expect(page.getByText('Hanasand AI', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Database chat' })).toBeVisible()
    await expect(page.getByText('Persist this coding plan.', { exact: true }).last()).toBeVisible()
    await expect(page.getByPlaceholder('Ask about your code, request a patch, inspect a repo, or describe the task you want done...')).toBeVisible()

    await context.close()
})
