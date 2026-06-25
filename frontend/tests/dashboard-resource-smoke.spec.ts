import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'

const apiBase = process.env.PLAYWRIGHT_API_BASE || 'http://127.0.0.1:8080/api'
const password = `Aa11!!${Date.now()}Bb22!!`
const adminId = process.env.PLAYWRIGHT_ADMIN_ID || 'codex_admin_20260422'
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'Aa11!!Bb22!!Cc33!!Dd44!!'
const adminName = process.env.PLAYWRIGHT_ADMIN_NAME || 'Codex Admin'
const adminToken = process.env.PLAYWRIGHT_ADMIN_TOKEN || ''
const adminExpiresAt = process.env.PLAYWRIGHT_ADMIN_EXPIRES_AT || new Date(Date.now() + 60 * 60 * 1000).toISOString()
const hasAdminLoginCredentials = Boolean(process.env.PLAYWRIGHT_ADMIN_ID && process.env.PLAYWRIGHT_ADMIN_PASSWORD)

const dashboardRoutes = [
    { path: '/dashboard', heading: /Good|You're|It’s/ },
    { path: '/dashboard/overview', heading: 'Operations Overview', screenshot: 'dashboard-overview.png' },
    { path: '/dashboard/dwm', heading: 'Company and vendor exposure alerts' },
    { path: '/dashboard/load-testing', heading: 'Permitted endpoint checks and launch confidence' },
    { path: '/dashboard/subscription', heading: 'Enable product access' },
    { path: '/dashboard/vms', heading: 'Virtual Machines', screenshot: 'dashboard-vms.png' },
    { path: '/dashboard/projects', heading: 'Projects', screenshot: 'dashboard-projects.png' },
    { path: '/dashboard/shares', heading: 'Code shares and projects', screenshot: 'dashboard-shares.png' },
    { path: '/dashboard/automations', heading: 'Automations' },
    { path: '/dashboard/notes', heading: 'Notes' },
]

const normalSidebarLinks = [
    { name: 'Console', href: '/dashboard' },
    { name: 'Threat search', href: '/ti' },
    { name: 'Dark web', href: '/dashboard/dwm' },
    { name: 'Alerts', href: '/dashboard/automations' },
    { name: 'Load testing', href: '/dashboard/load-testing' },
    { name: 'API docs', href: '/developers' },
    { name: 'Subscription', href: '/dashboard/subscription' },
    { name: 'Workspaces', href: '/dashboard/projects' },
    { name: 'Code shares', href: '/dashboard/shares' },
    { name: 'Notes', href: '/dashboard/notes' },
]

const privilegedSidebarLinks = [
    'Traffic',
    'System',
    'AI Metrics',
    'Vulnerabilities',
    'Logs',
    'Database',
    'Backup',
    'Rate Limits',
    'Cron Jobs',
    'Impersonation',
    'Management',
]

const privilegedDashboardRoutes = [
    { path: '/dashboard/traffic', heading: 'Traffic' },
    { path: '/dashboard/system', heading: 'System metrics' },
    { path: '/dashboard/vulnerabilities', heading: 'Vulnerabilities' },
]

test.describe('dashboard resource routes', () => {
    test.describe.configure({ mode: 'serial' })
    test.setTimeout(180_000)

    test('authenticated dashboard resource routes load without auth or server errors', async ({ browser, request, baseURL }, testInfo) => {
        const userId = `pdr${Date.now().toString().slice(-8)}`
        const auth = await createUser(request, userId, 'Dashboard Smoke')
        const context = await browser.newContext({ baseURL })
        const pageErrors: string[] = []
        const failedResponses: string[] = []

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            page.on('pageerror', (error) => pageErrors.push(error.message))
            page.on('response', (response) => {
                if (response.status() >= 500) {
                    failedResponses.push(`${response.status()} ${response.url()}`)
                }
            })

            for (const route of dashboardRoutes) {
                await page.goto(route.path, { waitUntil: 'domcontentloaded' })
                await expect(page).toHaveURL(new RegExp(`${route.path.replace(/\//g, '\\/')}$`))
                await expect(page.locator('main').getByRole('heading', { name: route.heading }).first()).toBeVisible()
                await expect(page.getByText(/401 Unauthorized|Please log in|Failed to load|Internal Server Error/i)).toHaveCount(0)

                if (route.path === '/dashboard') {
                    await expectNormalUserSidebar(page, userId)
                }

                if (route.path === '/dashboard/overview') {
                    await expectNormalUserOverviewActions(page)
                }

                if (route.path === '/dashboard/vms') {
                    await expect(page.getByText('Create a project')).toBeVisible()
                    await expect(page.getByText(/Click here/i)).toHaveCount(0)
                }

                if (route.screenshot) {
                    await page.screenshot({ path: testInfo.outputPath(route.screenshot), fullPage: true })
                }
            }

            expect(pageErrors).toEqual([])
            expect(failedResponses).toEqual([])
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })

    test('normal authenticated users are redirected away from privileged dashboard routes', async ({ browser, request, baseURL }) => {
        const userId = `pdrg${Date.now().toString().slice(-8)}`
        const auth = await createUser(request, userId, 'Dashboard Guard')
        const context = await browser.newContext({ baseURL })

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            for (const route of privilegedDashboardRoutes) {
                await page.goto(route.path, { waitUntil: 'domcontentloaded' })
                await expect(page).toHaveURL(/\/dashboard\?notAllowed=true/)
                await expect(page.getByText('That console area is not included in this account.')).toBeVisible()
                await expect(page.getByText(/Sign in to continue|Token expired/i)).toHaveCount(0)
            }
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })

    test('normal authenticated users can navigate allowed dashboard sidebar links', async ({ browser, request, baseURL }) => {
        const userId = `pdrnav${Date.now().toString().slice(-6)}`
        const auth = await createUser(request, userId, 'Dashboard Navigation')
        const context = await browser.newContext({ baseURL })

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
            await expectNormalUserSidebar(page, userId)

            const consoleRoutes = normalSidebarLinks.filter(link => link.href.startsWith('/dashboard') || link.href.startsWith('/ti'))
            for (const link of consoleRoutes) {
                await page.locator('aside nav').getByRole('link', { name: link.name, exact: true }).click()
                await expect(page).toHaveURL(new RegExp(`${link.href.replace(/\//g, '\\/')}$`))
                await expectNormalUserSidebar(page, userId)
                await expectNormalUserDestination(page, link.href)
            }
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })

    test('console sidebar stays bounded after page scrolling', async ({ browser, request, baseURL }) => {
        const userId = `pdrsb${uniqueSuffix()}`
        const auth = await createUser(request, userId, 'Dashboard Sidebar')
        const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()
            const routes = ['/dashboard/overview', '/dashboard/dwm', '/dashboard/subscription', '/dashboard/load-testing', '/dashboard/shares', '/ti/apt42']

            for (const route of routes) {
                await page.goto(route, { waitUntil: 'domcontentloaded' })
                await expect(page.locator('aside')).toBeVisible()
                await expect(page.locator('aside').getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
                await expect(page.locator('aside nav').getByRole('link', { name: 'Dark web', exact: true })).toHaveAttribute('href', '/dashboard/dwm')
                await expect(page.locator('aside nav').getByRole('link', { name: 'Subscription', exact: true })).toHaveAttribute('href', '/dashboard/subscription')
                await expect(page.locator('aside nav').getByRole('link', { name: 'Code shares', exact: true })).toHaveAttribute('href', '/dashboard/shares')
                await expect(page.locator('aside nav').getByRole('link', { name: 'Webhooks', exact: true })).toHaveCount(0)
                await expect(page.locator('aside nav').getByRole('link', { name: 'Pricing', exact: true })).toHaveCount(0)
                await expect(page.locator('aside nav').getByRole('link', { name: 'Articles', exact: true })).toHaveCount(0)

                const before = await sidebarLayoutMetrics(page)
                await page.mouse.wheel(0, 1200)
                await page.waitForTimeout(100)
                const afterWheel = await sidebarLayoutMetrics(page)
                await scrollConsoleContentToBottom(page)
                await page.waitForTimeout(100)
                const afterBottom = await sidebarLayoutMetrics(page)

                expect(before.asideBottom).toBeLessThanOrEqual(before.viewportHeight + 1)
                expect(afterWheel.asideTop).toBeGreaterThanOrEqual(-1)
                expect(afterWheel.asideBottom).toBeLessThanOrEqual(afterWheel.viewportHeight + 1)
                expect(afterWheel.documentScrollHeight).toBeLessThanOrEqual(afterWheel.viewportHeight + 20)
                expect(afterWheel.horizontalOverflow).toBeLessThanOrEqual(1)
                expect(afterBottom.asideTop).toBeGreaterThanOrEqual(-1)
                expect(afterBottom.asideBottom).toBeLessThanOrEqual(afterBottom.viewportHeight + 1)
                expect(afterBottom.documentScrollHeight).toBeLessThanOrEqual(afterBottom.viewportHeight + 20)
                expect(afterBottom.horizontalOverflow).toBeLessThanOrEqual(1)
            }
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })

    test('legacy VM detail aliases preserve nested VM names', async ({ browser, request, baseURL }) => {
        const userId = `pdra${Date.now().toString().slice(-8)}`
        const auth = await createUser(request, userId, 'Dashboard Alias')
        const context = await browser.newContext({ baseURL })

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            await page.goto('/dashboard/vm', { waitUntil: 'domcontentloaded' })
            await expect(page).toHaveURL(/\/dashboard\/vms$/)

            await page.goto('/dashboard/vm/folder/test%20vm', { waitUntil: 'domcontentloaded' })
            expect(new URL(page.url()).pathname).toBe('/dashboard/vms/folder/test%20vm')
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })

    test('notes dashboard supports create and delete flow', async ({ browser, request, baseURL }) => {
        const userId = `pdrn${Date.now().toString().slice(-8)}`
        const auth = await createUser(request, userId, 'Dashboard Notes')
        const context = await browser.newContext({ baseURL })
        const title = `Smoke note ${Date.now()}`
        const content = 'Created from the dashboard manage-flow smoke.'

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            const notesLoaded = page.waitForResponse((response) =>
                response.url().includes('/api/backend/notes') &&
                response.request().method() === 'GET' &&
                response.ok()
            )
            await page.goto('/dashboard/notes', { waitUntil: 'domcontentloaded' })
            await expect(page).toHaveURL(/\/dashboard\/notes$/)
            await notesLoaded
            await expect(page.getByText('No private notes yet.')).toBeVisible()

            const titleInput = page.getByPlaceholder('Title')
            const contentInput = page.getByPlaceholder('Write a private note...')

            await titleInput.fill(title)
            await contentInput.fill(content)
            await expect(titleInput).toHaveValue(title)
            await expect(contentInput).toHaveValue(content)
            await Promise.all([
                page.waitForResponse((response) =>
                    response.url().includes('/api/backend/notes') &&
                    response.request().method() === 'POST' &&
                    response.ok()
                ),
                page.getByRole('button', { name: 'Save', exact: true }).click(),
            ])

            await expect(page.getByText('Saved.')).toBeVisible()
            await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()

            await Promise.all([
                page.waitForResponse((response) =>
                    response.url().includes('/api/backend/notes/') &&
                    response.request().method() === 'DELETE' &&
                    response.ok()
                ),
                page.getByRole('button', { name: 'Delete', exact: true }).click(),
            ])
            await expect(page.getByText('Deleted.')).toBeVisible()
            await expect(page.getByText('No private notes yet.')).toBeVisible()
            await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0)
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })

    test('automations dashboard supports create cancel and delete flow', async ({ browser, request, baseURL }) => {
        const userId = `pdrau${Date.now().toString().slice(-7)}`
        const auth = await createUser(request, userId, 'Dashboard Automations')
        const context = await browser.newContext({ baseURL })
        const title = `Smoke automation ${Date.now()}`
        const canceledTitle = `${title} canceled`

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            const automationsLoaded = page.waitForResponse((response) =>
                response.url().includes('/api/backend/automations') &&
                response.request().method() === 'GET' &&
                response.ok()
            )
            await page.goto('/dashboard/automations', { waitUntil: 'domcontentloaded' })
            await expect(page).toHaveURL(/\/dashboard\/automations$/)
            await automationsLoaded
            await expect(page.getByText('No automations yet.')).toBeVisible()

            await page.getByRole('button', { name: 'New automation' }).click()
            await expect(page.getByText('Draft ready.')).toBeVisible()

            await page.getByLabel('Name').fill(title)
            await page.getByRole('textbox', { name: 'Prompt', exact: true }).fill('Echo this dashboard smoke without running it.')
            await page.getByLabel('Task type').selectOption('echo')
            await page.getByLabel('Status').selectOption('paused')

            await Promise.all([
                page.waitForResponse((response) =>
                    response.url().includes('/api/backend/automations') &&
                    response.request().method() === 'POST' &&
                    response.ok()
                ),
                page.getByRole('button', { name: 'Create automation' }).click(),
            ])

            await expect(page.getByText('Automation created.')).toBeVisible()
            await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()

            await page.getByLabel('Name').fill(canceledTitle)
            await page.getByRole('button', { name: 'Cancel', exact: true }).click()
            await expect(page.getByText('Changes discarded.')).toBeVisible()
            await expect(page.getByLabel('Name')).toHaveValue(title)
            await expect(page.getByRole('button', { name: new RegExp(canceledTitle) })).toHaveCount(0)

            await Promise.all([
                page.waitForResponse((response) =>
                    response.url().includes('/api/backend/automations/') &&
                    response.request().method() === 'DELETE' &&
                    response.ok()
                ),
                page.getByRole('button', { name: 'Delete', exact: true }).click(),
            ])

            await expect(page.getByText('Automation removed.')).toBeVisible()
            await expect(page.getByText('No automations yet.')).toBeVisible()
            await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0)
        } finally {
            await context.close()
            await deleteUser(request, userId, password)
        }
    })

    test('projects dashboard exposes explicit open and delete actions', async ({ browser, request, baseURL }) => {
        const userId = `pdrp${uniqueSuffix()}`
        const auth = await createUser(request, userId, 'Dashboard Projects')
        const projectId = `project-${userId}`
        await createShare(request, auth, {
            id: projectId,
            name: projectId,
            path: projectId,
            content: '',
            type: 'folder',
            includeTree: true,
        })
        const context = await browser.newContext({ baseURL })

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            await page.goto('/dashboard/projects', { waitUntil: 'networkidle' })
            await expect(page).toHaveURL(/\/dashboard\/projects$/)
            await expect(page.getByRole('link', { name: 'Open' })).toHaveAttribute('href', `/p/${projectId}`)
            await expect(page.getByText(projectId).first()).toBeVisible()

            await Promise.all([
                page.waitForResponse((response) =>
                    response.url().includes(`/api/project/${projectId}`) &&
                    response.request().method() === 'DELETE' &&
                    response.ok()
                ),
                page.getByRole('button', { name: `Delete project ${projectId}` }).click(),
            ])

            await expect(page.getByText('No projects yet.')).toBeVisible()
            await expect(page.getByText(projectId)).toHaveCount(0)
        } finally {
            await context.close()
            await request.delete(`${apiBase}/project/${projectId}`, {
                headers: authHeaders(auth),
            }).catch(() => undefined)
            await deleteUser(request, userId, password)
        }
    })

    test('shares dashboard exposes explicit open and delete actions', async ({ browser, request, baseURL }) => {
        const userId = `pdrs${uniqueSuffix()}`
        const auth = await createUser(request, userId, 'Dashboard Shares')
        const shareId = `share-${userId}`
        await createShare(request, auth, {
            id: shareId,
            name: shareId,
            path: shareId,
            content: 'Dashboard share smoke.',
            type: 'file',
        })
        const context = await browser.newContext({ baseURL })

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            await page.goto('/dashboard/shares', { waitUntil: 'networkidle' })
            await expect(page).toHaveURL(/\/dashboard\/shares$/)
            await expect(page.getByRole('link', { name: 'Open' })).toHaveAttribute('href', `/s/${shareId}`)
            await expect(page.getByText(shareId).first()).toBeVisible()

            await Promise.all([
                page.waitForResponse((response) =>
                    response.url().includes(`/api/share/${shareId}`) &&
                    response.request().method() === 'DELETE' &&
                    response.ok()
                ),
                page.getByRole('button', { name: `Delete share ${shareId}` }).click(),
            ])

            await expect(page.getByText('No shares yet.')).toBeVisible()
            await expect(page.getByText(shareId)).toHaveCount(0)
        } finally {
            await context.close()
            await request.delete(`${apiBase}/share/${shareId}`, {
                headers: authHeaders(auth),
            }).catch(() => undefined)
            await deleteUser(request, userId, password)
        }
    })

    test('privileged dashboard routes load for a system admin when credentials are available', async ({ browser, request, baseURL }) => {
        const auth = adminToken
            ? {
                id: adminId,
                name: adminName,
                token: adminToken,
                expires_at: adminExpiresAt,
                roles: [{ id: 'administrator' }, { id: 'system_admin' }],
            }
            : await loginAsAdmin(request)

        const context = await browser.newContext({ baseURL })
        const pageErrors: string[] = []
        const failedResponses: string[] = []

        try {
            await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
            const page = await context.newPage()

            page.on('pageerror', (error) => pageErrors.push(error.message))
            page.on('response', (response) => {
                if (response.status() >= 500) {
                    failedResponses.push(`${response.status()} ${response.url()}`)
                }
            })

            for (const route of privilegedDashboardRoutes) {
                await page.goto(route.path, { waitUntil: 'domcontentloaded' })
                await expect(page).toHaveURL(new RegExp(`${route.path.replace(/\//g, '\\/')}$`))
                await expect(page.locator('main').getByRole('heading', { name: route.heading }).first()).toBeVisible()
                await expect(page.getByText(/401 Unauthorized|Please log in|Failed to load|Internal Server Error/i)).toHaveCount(0)
            }

            expect(pageErrors).toEqual([])
            expect(failedResponses).toEqual([])
        } finally {
            await context.close()
        }
    })
})

async function expectNormalUserSidebar(page: Page, userId: string) {
    const sidebar = page.locator('aside nav')
    await expect(sidebar).toBeVisible()

    for (const link of normalSidebarLinks) {
        const item = sidebar.getByRole('link', { name: link.name, exact: true })
        await expect(item).toBeVisible()
        await expect(item).toHaveAttribute('href', link.href)
    }

    const profileLink = sidebar.getByRole('link', { name: 'Profile', exact: true })
    await expect(profileLink).toBeVisible()
    await expect(profileLink).toHaveAttribute('href', `/profile/${userId}`)

    for (const name of privilegedSidebarLinks) {
        await expect(sidebar.getByRole('link', { name, exact: true })).toHaveCount(0)
    }
}

async function expectNormalUserOverviewActions(page: Page) {
    const currentFocus = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Current Focus' }) }).first()
    await expect(currentFocus.getByRole('link', { name: /Status/i })).toBeVisible()

    for (const name of ['Vulnerabilities', 'Traffic', 'Backup']) {
        await expect(currentFocus.getByRole('link', { name, exact: true })).toHaveCount(0)
    }
}

async function expectNormalUserDestination(page: Page, href: string) {
    if (href === '/dashboard') {
        await expect(page.locator('main').getByRole('heading', { name: /Good|You're|It’s/ }).first()).toBeVisible()
        return
    }

    if (href === '/ti') {
        await expect(page.locator('main').getByRole('heading', { name: 'Threat Intelligence Search' })).toBeVisible()
        return
    }

    const route = dashboardRoutes.find((item) => item.path === href)
    if (route) {
        await expect(page.locator('main').getByRole('heading', { name: route.heading }).first()).toBeVisible()
    }
}

async function sidebarLayoutMetrics(page: Page) {
    return page.evaluate(() => {
        const aside = document.querySelector('aside')
        if (!aside) {
            throw new Error('Missing dashboard sidebar')
        }

        const rect = aside.getBoundingClientRect()
        return {
            asideTop: rect.top,
            asideBottom: rect.bottom,
            asideHeight: rect.height,
            asideClientHeight: aside.clientHeight,
            asideScrollHeight: aside.scrollHeight,
            documentScrollHeight: document.documentElement.scrollHeight,
            viewportHeight: window.innerHeight,
            horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        }
    })
}

async function scrollConsoleContentToBottom(page: Page) {
    await page.evaluate(() => {
        const aside = document.querySelector('aside')
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('body *'))
            .filter((node) => node !== aside && !aside?.contains(node))
            .filter((node) => {
                const style = window.getComputedStyle(node)
                return /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 10
            })
            .sort((a, b) => b.clientHeight - a.clientHeight)

        const scroller = candidates[0] || document.scrollingElement
        if (scroller) {
            scroller.scrollTop = scroller.scrollHeight
        }
    })
}

async function createUser(request: APIRequestContext, id: string, name: string) {
    const response = await request.post(`${apiBase}/user`, {
        data: { id, name, password },
    })
    expect(response.ok()).toBeTruthy()
    return await response.json() as {
        id: string
        name: string
        token: string
        expires_at: string
        roles?: string[]
    }
}

function uniqueSuffix() {
    return `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 6)}`
}

function authHeaders(auth: { id: string, token: string }) {
    return {
        Authorization: `Bearer ${decodeURIComponent(auth.token)}`,
        id: auth.id,
        'Content-Type': 'application/json',
    }
}

async function createShare(request: APIRequestContext, auth: { id: string, token: string }, data: {
    id: string
    name: string
    path: string
    content: string
    type: 'file' | 'folder'
    includeTree?: boolean
}) {
    const response = await request.post(`${apiBase}/share`, {
        headers: authHeaders(auth),
        data,
    })
    expect(response.ok()).toBeTruthy()
    return await response.json()
}

async function deleteUser(request: APIRequestContext, id: string, secret: string) {
    const loginResponse = await request.post(`${apiBase}/auth/login/${id}`, {
        data: { password: secret },
    })

    if (!loginResponse.ok()) {
        return
    }

    const token = (await loginResponse.json()).token as string
    await request.delete(`${apiBase}/user/self`, {
        headers: {
            Authorization: `Bearer ${decodeURIComponent(token)}`,
            id,
            'Content-Type': 'application/json',
        },
        data: { id },
    })
}

async function authenticateContext(context: BrowserContext, auth: {
    id: string
    name: string
    token: string
    expires_at: string
    roles?: Array<{ id: string } | string>
}, baseURL: string) {
    const expires = Math.floor(new Date(auth.expires_at).getTime() / 1000)
    const cookieUrl = new URL(baseURL).origin
    const secure = cookieUrl.startsWith('https://')
    const roles = auth.roles || []

    await context.addCookies([
        { name: 'id', value: encodeURIComponent(auth.id), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'name', value: encodeURIComponent(auth.name), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'access_token', value: encodeURIComponent(auth.token), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(roles)), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
    ])
}

async function loginAsAdmin(request: APIRequestContext) {
    test.skip(!hasAdminLoginCredentials, 'Privileged dashboard smoke needs PLAYWRIGHT_ADMIN_TOKEN or valid PLAYWRIGHT_ADMIN_ID/PLAYWRIGHT_ADMIN_PASSWORD.')

    const loginResponse = await request.post(`${apiBase}/auth/login/${adminId}`, {
        data: { password: adminPassword },
    })
    test.skip(!loginResponse.ok(), 'Privileged dashboard smoke needs PLAYWRIGHT_ADMIN_TOKEN or valid PLAYWRIGHT_ADMIN_ID/PLAYWRIGHT_ADMIN_PASSWORD.')
    return await loginResponse.json() as {
        id: string
        name: string
        token: string
        expires_at: string
        roles?: Array<{ id: string } | string>
    }
}
