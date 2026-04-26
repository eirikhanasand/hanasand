import { expect, test, type Browser } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

type ShareEntry = {
    id: string
    name: string
    path: string
    content: string
    parent: string
    type: string
    alias: string
}

async function createAiWorkspacePage({
    browser,
    baseURL,
    promptCompleteContent,
}: {
    browser: Browser
    baseURL: string | undefined
    promptCompleteContent: string
}) {
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

    await context.addInitScript((content: string) => {
        ;(window as typeof window & {
            __lastTerminalCommand?: string
            __HANASAND_CREATE_SOCKET__?: (url: string) => WebSocket
        }).__lastTerminalCommand = ''

        class MockHanasandSocket {
            static OPEN = 1
            static CLOSED = 3

            url: string
            readyState = MockHanasandSocket.OPEN
            onopen: ((event: Event) => void) | null = null
            onclose: ((event: CloseEvent) => void) | null = null
            onerror: ((event: Event) => void) | null = null
            onmessage: ((event: MessageEvent<string>) => void) | null = null

            constructor(url: string) {
                this.url = url
                window.setTimeout(() => {
                    this.onopen?.(new Event('open'))
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
                            content,
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
                this.readyState = MockHanasandSocket.CLOSED
                this.onclose?.(new CloseEvent('close'))
            }

            private emit(payload: unknown) {
                this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }))
            }
        }

        ;(window as typeof window & {
            __HANASAND_CREATE_SOCKET__?: (url: string) => WebSocket
        }).__HANASAND_CREATE_SOCKET__ = (url: string) => new MockHanasandSocket(url) as unknown as WebSocket
    }, promptCompleteContent)

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
            includeTree?: boolean
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
                tree: body.includeTree ? [] : undefined,
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/tree\/.+/, async (route) => {
        const rootId = route.request().url().split('/').pop() || ''

        type MockTreeNode = {
            id: string
            name: string
            type: 'folder' | 'file'
            children: MockTreeNode[]
        }

        const buildTree = (parentId: string): MockTreeNode[] => (treeChildren.get(parentId) || [])
            .map((childId) => shareState.get(childId))
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .map((entry): MockTreeNode => ({
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
        const url = route.request().url()
        if (url.includes('/share/tree/') || url.includes('/share/user/')) {
            await route.fallback()
            return
        }

        const method = route.request().method()
        const shareId = url.split('/').pop() || ''
        const existing = shareState.get(shareId)

        if (method === 'GET') {
            await route.fulfill({
                status: existing ? 200 : 404,
                contentType: 'application/json',
                body: JSON.stringify(existing ? {
                    ...existing,
                    tree: existing.type === 'folder' ? [] : undefined,
                } : { message: 'not found' }),
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
                body: JSON.stringify({
                    ...next,
                    tree: next.type === 'folder' ? [] : undefined,
                }),
            })
            return
        }

        await route.fallback()
    })

    await page.goto('/ai')
    await expect(page.getByText('Your chats stay attached to repos and shares.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New chat' })).toBeVisible()
    await expect(page.getByText('1 model connected')).toBeVisible({ timeout: 15000 })

    return {
        context,
        page,
        shareState,
        treeChildren,
        getVmName: () => vmName,
    }
}

function listWorkspacePaths({
    rootId,
    shareState,
    treeChildren,
}: {
    rootId: string
    shareState: Map<string, ShareEntry>
    treeChildren: Map<string, string[]>
}) {
    const paths: string[] = []

    const visit = (parentId: string, prefix = '') => {
        for (const childId of treeChildren.get(parentId) || []) {
            const entry = shareState.get(childId)
            if (!entry) {
                continue
            }

            const path = prefix ? `${prefix}/${entry.name}` : entry.name
            paths.push(path)
            if (entry.type === 'folder') {
                visit(childId, path)
            }
        }
    }

    visit(rootId)
    return paths.sort()
}

test('AI workspace can create a project and run a terminal command against the attached share', async ({ browser, baseURL }) => {
    const { context, page, shareState, getVmName } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: [
            'Preparing a remote project and verifying it from the share terminal.',
            '<hanasand-tool>{"action":"create_project","projectName":"Northstar Admin","vmName":"northstar-admin"}</hanasand-tool>',
            '<hanasand-tool>{"action":"run_terminal_command","command":"pwd && ls","timeoutMs":4000}</hanasand-tool>',
        ].join('\n\n'),
    })

    await page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill('Create a project and verify it from the terminal.')
    await page.getByRole('button', { name: 'Send' }).click()

    await expect(page.getByText('Preparing a remote project and verifying it from the share terminal.')).toBeVisible()
    await expect(page.getByText(/Created project workspace for Northstar Admin/).first()).toBeVisible()
    await expect(page.getByText(/Ran terminal command on share/).first()).toBeVisible()
    await expect(page.getByText('/workspace/northstar-admin').first()).toBeVisible()

    const terminalCommand = await page.evaluate(() => (window as typeof window & {
        __lastTerminalCommand?: string
    }).__lastTerminalCommand || '')
    expect(getVmName()).toBe('northstar-admin')
    expect(terminalCommand).toBe('pwd && ls')
    expect([...shareState.values()].some((entry) => entry.path === 'README.md')).toBeTruthy()
    expect([...shareState.values()].some((entry) => entry.path === 'package.json')).toBeTruthy()

    await context.close()
})

test('AI workspace can scaffold a Next.js and Docker starter directly into the attached share', async ({ browser, baseURL }) => {
    const { context, page, shareState, treeChildren, getVmName } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: [
            'Scaffolding a Docker-ready starter directly in the attached workspace.',
            '<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Moonbase Console"}</hanasand-tool>',
        ].join('\n\n'),
    })

    await page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill('Scaffold a Docker-ready Next.js workspace.')
    await page.getByRole('button', { name: 'Send' }).click()

    await expect(page.getByText('Scaffolding a Docker-ready starter directly in the attached workspace.')).toBeVisible()
    await expect(page.getByText(/Scaffolded a Next\.js \+ Docker workspace for Moonbase Console/).first()).toBeVisible()

    const rootEntry = [...shareState.values()].find((entry) => entry.type === 'folder' && entry.parent === '')
    expect(rootEntry).toBeTruthy()
    expect(rootEntry?.name).toBe('moonbase-console')
    expect(rootEntry?.path).toBe('moonbase-console')
    expect(getVmName()).toBe('')

    const workspacePaths = listWorkspacePaths({
        rootId: rootEntry!.id,
        shareState,
        treeChildren,
    })

    expect(workspacePaths).toEqual(expect.arrayContaining([
        '.dockerignore',
        '.gitignore',
        'Dockerfile',
        'README.md',
        'app',
        'app/globals.css',
        'app/layout.tsx',
        'app/page.tsx',
        'docker-compose.yml',
        'next-env.d.ts',
        'next.config.ts',
        'package.json',
        'public',
        'public/.gitkeep',
        'tsconfig.json',
    ]))

    const readmeEntry = [...shareState.values()].find((entry) => entry.name === 'README.md')
    const composeEntry = [...shareState.values()].find((entry) => entry.name === 'docker-compose.yml')
    const dockerfileEntry = [...shareState.values()].find((entry) => entry.name === 'Dockerfile')

    expect(readmeEntry?.content).toContain('# Moonbase Console')
    expect(readmeEntry?.content).toContain('HOST_PORT=3200 docker compose up --build')
    expect(composeEntry?.content).toContain('${HOST_PORT:-3000}:3000')
    expect(dockerfileEntry?.content).toContain('FROM node:20-alpine AS deps')

    await context.close()
})
