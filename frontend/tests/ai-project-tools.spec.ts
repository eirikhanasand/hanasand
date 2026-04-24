import { expect, test } from '@playwright/test'

test('AI workspace can create a project and run a terminal command against the attached share', async ({ browser, baseURL }) => {
    const shareState = new Map<string, {
        id: string
        name: string
        path: string
        content: string
        parent: string
        type: string
        alias: string
    }>()
    const treeChildren = new Map<string, string[]>()
    let vmName = ''

    const context = await browser.newContext({ baseURL })
    await context.addCookies([
        {
            name: 'id',
            value: 'playwright-user',
            domain: '127.0.0.1',
            path: '/',
        },
        {
            name: 'access_token',
            value: encodeURIComponent('playwright-token'),
            domain: '127.0.0.1',
            path: '/',
        },
    ])

    await context.addInitScript(() => {
        ;(window as typeof window & {
            __lastTerminalCommand?: string
        }).__lastTerminalCommand = ''

        class MockWebSocket {
            static CONNECTING = 0
            static OPEN = 1
            static CLOSING = 2
            static CLOSED = 3

            url: string
            readyState = MockWebSocket.OPEN
            onopen: ((event: Event) => void) | null = null
            onclose: ((event: CloseEvent) => void) | null = null
            onerror: ((event: Event) => void) | null = null
            onmessage: ((event: MessageEvent<string>) => void) | null = null
            private listeners: Record<string, Array<(event: Event | MessageEvent<string> | CloseEvent) => void>> = {}

            constructor(url: string) {
                this.url = url
                window.setTimeout(() => {
                    const openEvent = new Event('open')
                    this.onopen?.(openEvent)
                    this.dispatch('open', openEvent)
                    if (url.includes('/client/ws/gpt')) {
                        this.emit({
                            type: 'snapshot',
                            participants: 1,
                            clients: [{
                                name: 'local-32b',
                                ram: [],
                                cpu: [],
                                gpu: [],
                                model: {
                                    conversationId: null,
                                    status: 'idle',
                                    currentTokens: 0,
                                    maxTokens: 0,
                                    promptTokens: 0,
                                    generatedTokens: 0,
                                    contextTokens: 0,
                                    contextMaxTokens: 0,
                                    tps: 137,
                                    lastUpdated: new Date().toISOString(),
                                    lastError: null,
                                },
                            }],
                        })
                    }
                }, 0)
            }

            send(data: string) {
                if (this.url.includes('/client/ws/gpt')) {
                    const payload = JSON.parse(data) as { conversationId?: string }
                    const conversationId = payload.conversationId || 'unknown'
                    this.emit({
                        type: 'prompt_started',
                        conversationId,
                        clientName: 'local-32b',
                        metrics: {
                            conversationId,
                            status: 'generating',
                            currentTokens: 0,
                            maxTokens: 1024,
                            promptTokens: 200,
                            generatedTokens: 0,
                            contextTokens: 200,
                            contextMaxTokens: 24576,
                            tps: 137,
                            lastUpdated: new Date().toISOString(),
                            lastError: null,
                        },
                    })
                    window.setTimeout(() => {
                        this.emit({
                            type: 'prompt_complete',
                            conversationId,
                            clientName: 'local-32b',
                            content: [
                                'Preparing a remote project and verifying it from the share terminal.',
                                '<hanasand-tool>{"action":"create_project","projectName":"Northstar Admin","vmName":"northstar-admin"}</hanasand-tool>',
                                '<hanasand-tool>{"action":"run_terminal_command","command":"pwd && ls","timeoutMs":4000}</hanasand-tool>',
                            ].join('\n\n'),
                            metrics: {
                                conversationId,
                                status: 'idle',
                                currentTokens: 0,
                                maxTokens: 1024,
                                promptTokens: 200,
                                generatedTokens: 80,
                                contextTokens: 280,
                                contextMaxTokens: 24576,
                                tps: 137,
                                lastUpdated: new Date().toISOString(),
                                lastError: null,
                            },
                        })
                    }, 50)
                    return
                }

                if (this.url.includes('/share/')) {
                    const payload = JSON.parse(data) as { content?: string }
                    ;(window as typeof window & {
                        __lastTerminalCommand?: string
                    }).__lastTerminalCommand = typeof payload.content === 'string' ? payload.content.trim() : ''
                    window.setTimeout(() => {
                        this.emit({
                            type: 'update',
                            content: '/workspace/northstar-admin\nREADME.md\npackage.json\n',
                        })
                        this.close()
                    }, 50)
                }
            }

            close() {
                this.readyState = MockWebSocket.CLOSED
                const event = new CloseEvent('close')
                this.onclose?.(event)
                this.dispatch('close', event)
            }

            private emit(payload: unknown) {
                const event = new MessageEvent('message', { data: JSON.stringify(payload) })
                this.onmessage?.(event)
                this.dispatch('message', event)
            }

            addEventListener(type: string, listener: (event: Event | MessageEvent<string> | CloseEvent) => void) {
                this.listeners[type] = [...(this.listeners[type] || []), listener]
            }

            removeEventListener(type: string, listener: (event: Event | MessageEvent<string> | CloseEvent) => void) {
                this.listeners[type] = (this.listeners[type] || []).filter((entry) => entry !== listener)
            }

            private dispatch(type: string, event: Event | MessageEvent<string> | CloseEvent) {
                for (const listener of this.listeners[type] || []) {
                    listener(event)
                }
            }
        }

        Object.defineProperty(window, 'WebSocket', {
            configurable: true,
            writable: true,
            value: MockWebSocket,
        })
        Object.defineProperty(globalThis, 'WebSocket', {
            configurable: true,
            writable: true,
            value: MockWebSocket,
        })
    })

    const page = await context.newPage()

    await page.route('**/api/ai/conversations', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
        })
    })

    await page.route(/.*\/api\/ai\/conversations\/[^/]+$/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
        })
    })

    await page.route(/.*\/api\/ai\/conversations\/[^/]+\/messages$/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
        })
    })

    await page.route('**/api/vm', async (route) => {
        const body = route.request().postDataJSON() as { name?: string }
        vmName = body.name || ''
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ message: `Created VM ${vmName}` }),
        })
    })

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as {
            id: string
            name?: string
            path?: string
            content?: string
            parent?: string
            type?: string
        }
        const parent = body.parent || ''
        const entry = {
            id: body.id,
            name: body.name || body.path || body.id,
            path: body.path || body.name || body.id,
            content: body.content || '',
            parent,
            type: body.type || 'file',
            alias: body.path || body.name || body.id,
        }
        shareState.set(entry.id, entry)
        treeChildren.set(entry.id, treeChildren.get(entry.id) || [])
        if (parent) {
            treeChildren.set(parent, [...(treeChildren.get(parent) || []), entry.id])
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: entry.id,
                alias: entry.alias,
                path: entry.path,
                content: entry.content,
                owner: 'playwright-user',
                parent,
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/tree\/.+/, async (route) => {
        const rootId = route.request().url().split('/').pop() || ''

        const buildTree = (parentId: string) => (treeChildren.get(parentId) || [])
            .map((childId) => shareState.get(childId))
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .map((entry) => ({
                id: entry.id,
                name: entry.name,
                type: entry.type === 'folder' ? 'folder' : 'file',
                children: entry.type === 'folder' ? buildTree(entry.id) : [],
            }))

        const root = shareState.get(rootId)
        await route.fulfill({
            status: root ? 200 : 404,
            contentType: 'application/json',
            body: JSON.stringify(root ? buildTree(rootId) : { message: 'not found' }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/user\/.+/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const method = route.request().method()
        const shareId = route.request().url().split('/').pop() || ''
        const existing = shareState.get(shareId)

        if (method === 'GET') {
            await route.fulfill({
                status: existing ? 200 : 404,
                contentType: 'application/json',
                body: JSON.stringify(existing || { message: 'not found' }),
            })
            return
        }

        if (method === 'PUT') {
            const updates = route.request().postDataJSON() as { content?: string, path?: string }
            const next = {
                ...(existing || {
                    id: shareId,
                    name: shareId,
                    path: shareId,
                    content: '',
                    parent: '',
                    type: 'file',
                    alias: shareId,
                }),
                content: updates.content ?? existing?.content ?? '',
                path: updates.path ?? existing?.path ?? shareId,
                alias: updates.path ?? existing?.alias ?? shareId,
            }
            shareState.set(shareId, next)
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(next),
            })
            return
        }

        await route.fallback()
    })

    await page.goto('/ai')
    await expect(page.getByText('Your chats stay attached to repos and shares.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New chat' })).toBeVisible()
    await expect(page.getByText('1 model connected')).toBeVisible()

    await page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill('Create a project and verify it from the terminal.')
    await page.getByRole('button', { name: 'Send' }).click()

    await expect(page.getByText('Preparing a remote project and verifying it from the share terminal.')).toBeVisible()
    await expect(page.getByText(/Created project workspace for Northstar Admin/)).toBeVisible()
    await expect(page.getByText(/Ran terminal command on share/)).toBeVisible()
    await expect(page.getByText('/workspace/northstar-admin')).toBeVisible()

    const terminalCommand = await page.evaluate(() => (window as typeof window & {
        __lastTerminalCommand?: string
    }).__lastTerminalCommand || '')
    expect(vmName).toBe('northstar-admin')
    expect(terminalCommand).toBe('pwd && ls')
    expect([...shareState.values()].some((entry) => entry.path === 'README.md')).toBeTruthy()
    expect([...shareState.values()].some((entry) => entry.path === 'package.json')).toBeTruthy()

    await context.close()
})
