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
    promptResponses = [],
    modelConnected = true,
}: {
    browser: Browser
    baseURL: string | undefined
    promptCompleteContent: string
    promptResponses?: { match: string, content: string }[]
    modelConnected?: boolean
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
    const cookieDomain = new URL(baseURL || 'http://127.0.0.1:3000').hostname

    const context = await browser.newContext({ baseURL })
    await context.addCookies([
        {
            name: 'id',
            value: 'playwright-user',
            domain: cookieDomain,
            path: '/',
        },
        {
            name: 'access_token',
            value: encodeURIComponent('playwright-token'),
            domain: cookieDomain,
            path: '/',
        },
    ])

    await context.addInitScript(({ content, responses, connected }: { content: string, responses: { match: string, content: string }[], connected: boolean }) => {
        ;(window as typeof window & {
            __lastTerminalCommand?: string
            __lastAiPromptRequest?: unknown
            __HANASAND_CREATE_SOCKET__?: (url: string) => WebSocket
        }).__lastTerminalCommand = ''
        ;(window as typeof window & {
            __lastAiPromptRequest?: unknown
        }).__lastAiPromptRequest = null

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
                    if (url.includes('/client/ws/gpt') && connected) {
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
                    const payload = JSON.parse(data) as { conversationId?: string, messages?: { role: string, content: string }[] }
                    ;(window as typeof window & {
                        __lastAiPromptRequest?: unknown
                    }).__lastAiPromptRequest = payload
                    const conversationId = payload.conversationId || 'unknown'
                    const userPrompt = [...(payload.messages || [])].reverse().find((message) => message.role === 'user')?.content || ''
                    const selectedContent = responses.find((response) => userPrompt.toLowerCase().includes(response.match.toLowerCase()))?.content || content
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
                            content: selectedContent,
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
    }, { content: promptCompleteContent, responses: promptResponses, connected: modelConnected })

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

    await page.route('**/api/tools/http/request', async (route) => {
        const body = route.request().postDataJSON() as { url?: string, method?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                status: 200,
                url: body.url,
                method: body.method || 'GET',
                body: '<html><title>Preview OK</title><main>Ready</main></html>',
            }),
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
    await expect(page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...')).toBeVisible()
    await expect(page.getByText('No workspace attached')).toBeVisible()
    await expect(page.getByText('Starter', { exact: true })).toBeVisible()
    await expect(page.getByText('Deploy', { exact: true })).toBeVisible()
    if (modelConnected) {
        await expect(page.getByRole('button', { name: 'local-32b' })).toBeVisible({ timeout: 15000 })
    } else {
        await expect(page.getByRole('button', { name: 'No model connected' })).toBeVisible({ timeout: 15000 })
        await expect(page.getByText('Offline', { exact: true })).toBeVisible()
        await expect(page.getByText('Ready', { exact: true })).toHaveCount(0)
    }

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

test('AI website workbench handles stricter ambiguous product-building stories without hiding the tools', async ({ browser, baseURL }) => {
    const stories = [
        ['motion designer', 'Portfolio direction set.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Motion Designer Portfolio"}</hanasand-tool>'],
        ['uptime product', 'Waitlist shell ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Uptime Waitlist"}</hanasand-tool>'],
        ['restaurant booking', 'Booking preview path chosen.\n<hanasand-tool>{"action":"create_project","projectName":"Restaurant Booking Preview","vmName":"restaurant-preview"}</hanasand-tool>'],
        ['compliance dashboard', 'Enterprise dashboard skeleton created.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Vendor Compliance Dashboard"}</hanasand-tool>'],
        ['repo is broken', 'I need the repository URL or owner/name to import it; then I will inspect env and config before editing.'],
        ['cramped on mobile', 'Responsive pass started.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['pricing page', 'Pricing page workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Pricing Page"}</hanasand-tool>'],
        ['reviewers to understand', 'Review handoff should stay visible in Workspace, Ownership, Deploy, and Release history before the summary.'],
        ['meeting notes product', 'Demo shell workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Meeting Notes Demo"}</hanasand-tool>'],
        ['actually run', 'Checking the attached workspace now.\n<hanasand-tool>{"action":"run_terminal_command","command":"pwd && ls","timeoutMs":8000}</hanasand-tool>'],
        ['handmade lamps', 'Product page workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Handmade Lamps Product Page"}</hanasand-tool>'],
        ['docker compose', 'Docker check queued.\n<hanasand-tool>{"action":"run_terminal_command","command":"docker compose config","timeoutMs":12000}</hanasand-tool>'],
        ['schools and teachers', 'Admin prototype workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"School Admin Prototype"}</hanasand-tool>'],
        ['norwegian coffee', 'Campaign workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Norwegian Coffee Campaign"}</hanasand-tool>'],
        ['prod db', 'I cannot connect to or mutate production data from a vague prompt. Share a staging export or migration goal and I will build the safe review path first.'],
        ['angry tickets', 'Support triage board workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Support Triage Board"}</hanasand-tool>'],
        ['book shoots', 'Booking funnel workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Photography Booking Funnel"}</hanasand-tool>'],
        ['less templatey', 'I will make the current workspace more editorial, keep the conversion path, and verify the result.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['preview link', 'Preview healthcheck requested.\n<hanasand-tool>{"action":"http_request","url":"https://example.com","method":"GET"}</hanasand-tool>'],
        ['homepage', 'Homepage fix path: edit, check, summarize compactly.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
    ] as const

    const prompts = [
        'make me a sharp little portfolio for a motion designer, dark but not boring, with a case study and contact.',
        'i need a landing page for an uptime product. make it feel legit and collect emails somehow.',
        'client needs a preview by lunch for a restaurant booking site, not a blog.',
        'mock an internal compliance dashboard for vendors. should look enterprise, not startup toy.',
        'my repo is broken after i changed env stuff, can you look?',
        'this page feels cramped on mobile. make it breathe but keep the desktop dense.',
        'pricing page please. make the middle plan sell without being cheesy.',
        'we need reviewers to understand what changed and who deployed it.',
        'build a realistic ai meeting notes product demo, but no login yet.',
        'does this app actually run? check it, don\'t just say it should.',
        'make a premium product page for handmade lamps, needs variants and shipping info.',
        'docker compose is annoying here, make it deployable.',
        'prototype the admin area for managing schools and teachers.',
        'we\'re launching a norwegian coffee thing, make a campaign page with signup.',
        'connect to our prod db and fix the users table.',
        'make a customer support triage board for angry tickets.',
        'i need people to book shoots and see packages, make it classy.',
        'less templatey, more editorial, but still converts.',
        'ship a preview link my cofounder can open.',
        'fix the homepage and don\'t write me an essay.',
    ]

    const { context, page } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Default compact progress update.',
        promptResponses: stories.map(([match, content]) => ({ match, content })),
    })

    await expect(page.getByText('No workspace attached')).toBeVisible()
    await expect(page.getByText('Review handoff', { exact: true })).toBeVisible()
    await expect(page.getByText('Release history', { exact: true })).toBeVisible()
    await expect(page.getByText('Create Next.js + Docker workspace')).toBeVisible()
    await expect(page.getByText('Start VM deploy check')).toBeVisible()

    for (const [index, prompt] of prompts.entries()) {
        await test.step(`story ${901 + index}`, async () => {
            const storyContent = stories[index][1]
            await page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill(prompt)
            await page.getByRole('button', { name: 'Send' }).click()
            await expect(page.getByText(storyContent.split('\n')[0])).toBeVisible({ timeout: 10000 })
            const toolText = expectedToolCompletionText(storyContent)
            if (toolText) {
                await expect(page.getByText(toolText).last()).toBeVisible({ timeout: 10000 })
            }
        })
    }

    const lastPromptRequest = await page.evaluate(() => (window as typeof window & {
        __lastAiPromptRequest?: { messages?: { role: string, content: string }[] }
    }).__lastAiPromptRequest)
    const systemPrompt = lastPromptRequest?.messages?.find((message) => message.role === 'system')?.content || ''
    expect(systemPrompt).toContain('Optimize for fast product progress')
    expect(systemPrompt).toContain('Keep visible replies compact')
    expect(systemPrompt).toContain('scaffold or attach workspace -> implement files -> run a focused terminal check -> verify UI in browser')

    await expect(page.getByText(/Scaffolded a Next\.js \+ Docker workspace/).first()).toBeVisible()
    await expect(page.getByText(/Ran terminal command on share/).first()).toBeVisible()
    await expect(page.getByText(/HTTP GET https:\/\/example\.com/).first()).toBeVisible()
    await expect(page.getByText('I cannot connect to or mutate production data from a vague prompt.')).toBeVisible()

    await context.close()
})

test('AI website workbench handles reliability, handoff, and low-bloat pressure stories', async ({ browser, baseURL }) => {
    const offline = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Model pool unavailable.',
        modelConnected: false,
    })
    await offline.context.close()

    const stories = [
        ['airbnb for rehearsal rooms', 'MVP scope picked: rehearsal room listings, search, availability request, and host contact.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Rehearsal Room Marketplace"}</hanasand-tool>'],
        ['not look ai-generated', 'Visual pass: stronger hierarchy, tighter copy, less templated spacing.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['what changed and what ran', 'Proof path: use visible artifacts, changed files, command output, and release history before any claim of done.'],
        ['build broke', 'Build-first fix path.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run build","timeoutMs":20000}</hanasand-tool>'],
        ['dental clinic', 'Dental clinic workspace ready with real service, trust, booking, and emergency sections.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Dental Clinic Website"}</hanasand-tool>'],
        ['contractor review', 'Use reviewer access for the contractor; do not grant editor rights unless the owner explicitly asks.'],
        ['finance app', 'Finance onboarding prototype ready with safe multi-step states and no fake bank connection.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Finance Onboarding Prototype"}</hanasand-tool>'],
        ['too generic', 'Revision path: keep the offer, improve premium positioning, and verify the changed surface.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['preview is broken', 'Checking the preview endpoint and naming the blocker.\n<hanasand-tool>{"action":"http_request","url":"https://example.com","method":"GET"}</hanasand-tool>'],
        ['phone users only', 'Mobile-first course page workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Mobile Course Page"}</hanasand-tool>'],
        ['overdue obvious', 'SLA triage workspace ready with overdue-first states.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"SLA Ticket Dashboard"}</hanasand-tool>'],
        ['private admin endpoint', 'Do not paste private tokens into chat. Put the token in a secret or env var and I can build a safe verification harness.'],
        ['add payments', 'I can prototype pricing and checkout UI now; real payments need configured Stripe credentials before I claim they work.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Payments Demo Prototype"}</hanasand-tool>'],
        ['failing nav', 'Focused nav fix: inspect nav files only, run the narrow check, and summarize compactly.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['childcare support', 'Accessible childcare support page workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Childcare Support Service"}</hanasand-tool>'],
        ['investor demo', 'Investor demo workspace ready with clearly marked traction placeholders.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Investor Demo Page"}</hanasand-tool>'],
        ['continue this tomorrow', 'Handoff path: recent files, checks run, deploy state, and next steps stay visible in the workbench.'],
        ['screenshot it', 'Visual verification path selected; screenshot evidence should drive the next edit.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['obvious thing', 'Doing the sensible default now.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
    ] as const

    const prompts = [
        'make the simplest version of airbnb for rehearsal rooms',
        'make this not look ai-generated',
        'before i trust this, show me what changed and what ran',
        'build broke after my last change, fix fast',
        'site for a dental clinic. no lorem ipsum.',
        'let the contractor review but not edit',
        'prototype onboarding for a finance app, has to feel safe',
        'client says too generic. make it premium but keep the same offer',
        'preview is broken. tell me the blocker not a pep talk',
        'phone users only basically. make the course page convert',
        'dashboard for tickets, make overdue obvious',
        'curl this private admin endpoint with my token: paste-token-later',
        'add payments to the demo',
        'don\'t read the whole repo, fix the failing nav',
        'page for applying for childcare support. has to be clear',
        'make the investor demo page look credible by tonight',
        'another dev needs to continue this tomorrow',
        'screenshot it and fix what looks off',
        'just do the obvious thing',
    ]

    const { context, page } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Default compact reliability update.',
        promptResponses: stories.map(([match, content]) => ({ match, content })),
    })

    for (const [index, prompt] of prompts.entries()) {
        await test.step(`story ${922 + index}`, async () => {
            const storyContent = stories[index][1]
            await page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill(prompt)
            await page.getByRole('button', { name: 'Send' }).click()
            await expect(page.getByText(storyContent.split('\n')[0])).toBeVisible({ timeout: 10000 })
            const toolText = expectedToolCompletionText(storyContent)
            if (toolText) {
                await expect(page.getByText(toolText).last()).toBeVisible({ timeout: 10000 })
            }
        })
    }

    const lastPromptRequest = await page.evaluate(() => (window as typeof window & {
        __lastAiPromptRequest?: { messages?: { role: string, content: string }[] }
    }).__lastAiPromptRequest)
    const systemPrompt = lastPromptRequest?.messages?.find((message) => message.role === 'system')?.content || ''
    expect(systemPrompt).toContain('Ask a clarifying question only when the next action would be destructive')
    expect(systemPrompt).toContain('Keep visible replies compact')

    await expect(page.getByText('Tool complete').first()).toBeVisible()
    await expect(page.getByText('Do not paste private tokens into chat.')).toBeVisible()
    await expect(page.getByText('real payments need configured Stripe credentials')).toBeVisible()
    await expect(page.getByText(/HTTP GET https:\/\/example\.com/).first()).toBeVisible()

    await context.close()
})

test('AI website workbench handles accessibility, messy scope, and evidence pressure stories', async ({ browser, baseURL }) => {
    const stories = [
        ['unlabeled button', 'Workbench controls are named: search chats, open editor, and workspace details are keyboard-readable.'],
        ['where do i see the files', 'Use the Editor link to inspect files; attached workspaces also show project files in the details rail.'],
        ['too gray', 'Art direction workspace ready: warmer contrast, sharper hierarchy, premium without fintech gloss.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Premium Visual Direction"}</hanasand-tool>'],
        ['rent tools nearby', 'Nearby tool rental MVP ready: listings, search, availability request, and owner contact.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Nearby Tool Rental Marketplace"}</hanasand-tool>'],
        ['legal should only comment', 'Legal should be reviewer-only; engineering can be editor. Keep review handoff visible.'],
        ['looks like a template', 'Template rescue workspace ready: keep the offer, change visual system, then verify.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Brand Rescue Workspace"}</hanasand-tool>'],
        ['public or private', 'Exposure lives in Deploy and Release history. If missing, run a deploy healthcheck before claiming public access.'],
        ['test broke', 'Running the check first; no guessing.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm test","timeoutMs":20000}</hanasand-tool>'],
        ['add login', 'I can build an auth-shaped demo UI now, but real authentication needs configured backend/session handling.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Auth Demo Shell"}</hanasand-tool>'],
        ['housing help', 'Accessible housing support service page ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Housing Help Service"}</hanasand-tool>'],
        ['sell my presets', 'Preset storefront skeleton ready with licensing and honest checkout placeholder.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Preset Storefront"}</hanasand-tool>'],
        ['refunds, bugs, chaos', 'Support chaos dashboard ready with refunds, bugs, SLA, and severity triage.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Support Chaos Dashboard"}</hanasand-tool>'],
        ['prod secrets', 'Do not paste production secrets into chat. Use env vars or a managed secret path.'],
        ['metrics look good', 'I will label metrics as demo/sample unless you provide verified numbers.'],
        ['look at it, not the code', 'Browser-first visual review needs a workspace first, so I am creating one before screenshot evidence.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Visual Review Workspace"}</hanasand-tool>'],
        ['another agent taking over', 'Continuity path: record changed files, checks, release state, and next steps in the visible workbench.'],
        ['is it stuck', 'Status should distinguish Offline, Thinking, Ready, Tool complete, and Tool error without mixed signals.'],
        ['iphone', 'Mobile proof workspace ready; verify the narrow viewport or name the blocker next.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Mobile Proof Workspace"}</hanasand-tool>'],
        ['booking, payments, crm, and ads', 'Scope cut: build booking first, stub payments honestly, defer CRM and ads until the first workflow works.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Booking First Workflow"}</hanasand-tool>'],
        ['show evidence', 'Evidence-first summary: changed surface, check output, and artifact links before commentary.\n<hanasand-tool>{"action":"run_terminal_command","command":"pwd && ls","timeoutMs":8000}</hanasand-tool>'],
    ] as const

    const prompts = [
        'i only tab around. what does this unlabeled button do?',
        'where do i see the files?',
        'too gray. make it feel expensive but not fintech.',
        'marketplace idea, dunno, people rent tools nearby',
        'legal should only comment, eng can edit',
        'client says it looks like a template. fix that.',
        'is preview public or private rn?',
        'test broke. stop guessing.',
        'add login but don\'t make me deal with auth yet',
        'people need to apply for housing help. make it simple.',
        'sell my presets. fast.',
        'angry customers, refunds, bugs, chaos. dashboard.',
        'i can paste prod secrets if easier',
        'make metrics look good',
        'look at it, not the code',
        'will this survive another agent taking over?',
        'is it stuck?',
        'client only checks on iphone.',
        'make booking, payments, crm, and ads today',
        'less talk. show evidence.',
    ]

    const { context, page } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Default compact ambiguity update.',
        promptResponses: stories.map(([match, content]) => ({ match, content })),
    })

    await expect(page.getByRole('button', { name: 'Search chats' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open editor' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hide workspace details' })).toBeVisible()

    await page.getByRole('button', { name: 'Hide workspace details' }).click()
    await expect(page.getByRole('button', { name: 'Show workspace details' })).toBeVisible()
    await page.getByRole('button', { name: 'Show workspace details' }).click()
    await expect(page.getByText('No workspace attached')).toBeVisible()

    for (const [index, prompt] of prompts.entries()) {
        await test.step(`story ${941 + index}`, async () => {
            const storyContent = stories[index][1]
            await page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill(prompt)
            await page.getByRole('button', { name: 'Send' }).click()
            await expect(page.getByText(storyContent.split('\n')[0])).toBeVisible({ timeout: 10000 })
            const toolText = expectedToolCompletionText(storyContent)
            if (toolText) {
                await expect(page.getByText(toolText).last()).toBeVisible({ timeout: 10000 })
            }
        })
    }

    await expect(page.getByText('Do not paste production secrets into chat.')).toBeVisible()
    await expect(page.getByText('I will label metrics as demo/sample')).toBeVisible()
    await expect(page.getByText('Scope cut: build booking first')).toBeVisible()
    await expect(page.getByText('Tool complete').first()).toBeVisible()

    const lastPromptRequest = await page.evaluate(() => (window as typeof window & {
        __lastAiPromptRequest?: { messages?: { role: string, content: string }[] }
    }).__lastAiPromptRequest)
    const systemPrompt = lastPromptRequest?.messages?.find((message) => message.role === 'system')?.content || ''
    expect(systemPrompt).toContain('Do not run terminal, read_share, or update_share tools before a workspace is attached')

    await context.close()
})

function expectedToolCompletionText(content: string) {
    if (content.includes('"action":"scaffold_nextjs_docker"')) {
        const projectName = content.match(/"projectName":"([^"]+)"/)?.[1]
        return projectName ? `Scaffolded a Next.js + Docker workspace for ${projectName}. The workspace is attached and ready for follow-up edits.` : null
    }

    if (content.includes('"action":"create_project"')) {
        const projectName = content.match(/"projectName":"([^"]+)"/)?.[1]
        return projectName ? `Created project workspace for ${projectName}` : null
    }

    if (content.includes('"action":"run_terminal_command"')) {
        const command = content.match(/"command":"([^"]+)"/)?.[1]
        return command ? `Command: ${command}` : null
    }

    if (content.includes('"action":"http_request"')) {
        const url = content.match(/"url":"([^"]+)"/)?.[1]
        return url ? `HTTP GET ${url}` : null
    }

    return null
}
