import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const shareCreateUrl = /\/api\/share$/
const vmCreateUrl = /\/api\/vm$/
const syncAgentTargetUrl = /\/api\/vm\/[^/]+\/agent-target\/sync-access$/
const getAgentTargetUrl = /\/api\/vm\/[^/]+\/agent-target$/

test('logged-out users get an editor workspace without action buttons', async ({ page }) => {
    let createdShareBody = ''
    let createdShareId = ''

    await page.route(shareCreateUrl, async (route) => {
        createdShareBody = route.request().postData() || ''
        createdShareId = JSON.parse(createdShareBody).id as string
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: createdShareId,
                alias: `project-${createdShareId}`,
                path: `project-${createdShareId}`,
                content: '',
                tree: [],
            }),
        })
    })

    const shareResponse = page.waitForResponse((response) => shareCreateUrl.test(response.url()))

    await page.goto('/s')
    await shareResponse

    await expect(page).toHaveURL(/\/s$/)
    await expect(page.getByText('Opening workspace')).toHaveCount(0)
    await expect(page.getByText('Creating project workspace')).toHaveCount(0)
    await expect(page.locator('main textarea').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create project' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await expect(page.locator('ul', { hasText: `project-${createdShareId}` })).toHaveCount(0)
    expect(createdShareBody).toContain(`"name":"project-${createdShareId}"`)
})

test('the /s entry automatically opens a project-backed workspace', async ({ page, context, baseURL }) => {
    const cookieUrl = baseURL || 'http://127.0.0.1:3000'
    let createdShareBody = ''
    let createdShareId = ''

    await context.addCookies([
        {
            name: 'access_token',
            value: encodeURIComponent('playwright-token'),
            url: cookieUrl,
        },
        {
            name: 'id',
            value: 'playwright-user',
            url: cookieUrl,
        },
    ])

    await page.route(shareCreateUrl, async (route) => {
        createdShareBody = route.request().postData() || ''
        createdShareId = JSON.parse(createdShareBody).id as string
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: createdShareId,
                alias: 'Playwright Share',
                path: 'Playwright Share',
                content: '',
                tree: [],
            }),
        })
    })

    await page.route(vmCreateUrl, async (route) => {
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Created VM hanasand-project' }),
        })
    })

    await page.route(syncAgentTargetUrl, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                vmName: 'hanasand-project',
                scope: 'current_user',
                triggeredBy: 'playwright-user',
                syncedUserIds: ['playwright-user'],
                certificateCount: 1,
                received: 1,
                added: 1,
                total: 1,
                updatedAt: new Date().toISOString(),
                notes: [],
            }),
        })
    })

    await page.route(getAgentTargetUrl, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                name: 'hanasand-project',
                capabilities: { canConnect: true },
                network: { sshHost: '127.0.0.1' },
            }),
        })
    })

    const shareResponse = page.waitForResponse((response) => shareCreateUrl.test(response.url()))
    const vmResponse = page.waitForResponse((response) => vmCreateUrl.test(response.url()))

    await page.goto('/s')
    await expect(page.getByRole('button', { name: 'Create share' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create project' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await expect(page.getByText('Share flow')).toHaveCount(0)
    await expect(page.getByText('Project flow')).toHaveCount(0)

    await Promise.all([shareResponse, vmResponse])

    await expect(page).toHaveURL(/\/s$/)
    await expect(page.locator('main textarea').first()).toBeVisible()
    expect(createdShareBody).toContain('"includeTree":true')
    expect(createdShareBody).toContain('"type":"folder"')
    expect(createdShareBody).toContain(`"name":"project-${createdShareId}"`)
})

test('authenticated users trigger share and VM provisioning by opening /s', async ({ page, context, baseURL }) => {
    const cookieUrl = baseURL || 'http://127.0.0.1:3000'
    let requestedVmUrl = ''
    let createdShareBody = ''
    let createdShareId = ''

    await context.addCookies([
        {
            name: 'access_token',
            value: encodeURIComponent('playwright-token'),
            url: cookieUrl,
        },
        {
            name: 'id',
            value: 'playwright-user',
            url: cookieUrl,
        },
    ])

    await page.route(shareCreateUrl, async (route) => {
        createdShareBody = route.request().postData() || ''
        createdShareId = JSON.parse(createdShareBody).id as string
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: createdShareId,
                alias: `project-${createdShareId}`,
                path: `project-${createdShareId}`,
                content: '',
                tree: [],
            }),
        })
    })

    await page.route(vmCreateUrl, async (route) => {
        requestedVmUrl = route.request().url()
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Created VM' }),
        })
    })

    await page.route(syncAgentTargetUrl, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                vmName: 'project',
                scope: 'current_user',
                triggeredBy: 'playwright-user',
                syncedUserIds: ['playwright-user'],
                certificateCount: 1,
                received: 1,
                added: 1,
                total: 1,
                updatedAt: new Date().toISOString(),
                notes: [],
            }),
        })
    })

    await page.route(getAgentTargetUrl, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                name: 'project',
                capabilities: { canConnect: true },
                network: { sshHost: '127.0.0.1' },
            }),
        })
    })

    const shareResponse = page.waitForResponse((response) => shareCreateUrl.test(response.url()))
    const vmResponse = page.waitForResponse((response) => vmCreateUrl.test(response.url()))

    await page.goto('/s')
    await Promise.all([shareResponse, vmResponse])

    await expect(page).toHaveURL(/\/s$/)
    await expect(page.locator('main textarea').first()).toBeVisible()
    expect(requestedVmUrl).toContain('/api/vm')
    expect(createdShareBody).toContain(`"name":"project-${createdShareId}"`)
})

test('metadata reload keeps the current share id instead of opening a random workspace', async ({ page }) => {
    const shareId = 'pwshare-metadata'

    await page.route(new RegExp(`/api/share/${shareId}$`), async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: 'Playwright Share',
                path: `share-${shareId}`,
                content: '',
                wordCount: 1,
                estimatedMinutes: 1,
            }),
        })
    })

    await page.route(new RegExp(`/api/share/tree/${shareId}$`), async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    id: shareId,
                    alias: 'Playwright Share',
                    path: `share-${shareId}`,
                    content: '',
                    type: 'folder',
                    name: `share-${shareId}`,
                    children: [],
                },
            ]),
        })
    })

    await page.goto(`/s/${shareId}`)
    await page.getByRole('link', { name: 'Reload current share workspace' }).click()

    await expect(page).toHaveURL(new RegExp(`/s/${shareId}$`))
    await expect(page.getByRole('link', { name: 'Reload current share workspace' })).toHaveAttribute('href', `/s/${shareId}`)
})
