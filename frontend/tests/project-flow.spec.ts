import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const shareCreateUrl = /\/api\/share$/
const vmCreateUrl = /\/api\/vm$/
const syncAgentTargetUrl = /\/api\/vm\/[^/]+\/agent-target\/sync-access$/
const getAgentTargetUrl = /\/api\/vm\/[^/]+\/agent-target$/

test('the /s entry only exposes the project-backed workspace flow', async ({ page, context, baseURL }) => {
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

    await page.goto('/s')
    await expect(page.getByRole('button', { name: 'Create share' })).toHaveCount(0)
    await expect(page.getByText('Share flow')).toHaveCount(0)
    await expect(page.getByText('Project flow')).toHaveCount(0)

    await Promise.all([
        page.waitForResponse((response) => shareCreateUrl.test(response.url())),
        page.waitForResponse((response) => vmCreateUrl.test(response.url())),
        page.getByRole('button', { name: 'Create project' }).click(),
    ])

    await expect(page).toHaveURL(new RegExp(`/s/${createdShareId}$`))
    expect(createdShareBody).toContain('"includeTree":true')
    expect(createdShareBody).toContain('"type":"folder"')
    expect(createdShareBody).toContain('"name":"hanasand-project"')
})

test('authenticated users can create a project from /s and trigger share + VM provisioning', async ({ page, context, baseURL }) => {
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
                alias: 'Playwright Project',
                path: 'Playwright Project',
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
            body: JSON.stringify({ message: 'Created VM playwright-project' }),
        })
    })

    await page.route(syncAgentTargetUrl, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                vmName: 'playwright-project',
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
                name: 'playwright-project',
                capabilities: { canConnect: true },
                network: { sshHost: '127.0.0.1' },
            }),
        })
    })

    await page.goto('/s')
    await page.getByPlaceholder('Project name').fill('Playwright Project')
    await Promise.all([
        page.waitForResponse((response) => shareCreateUrl.test(response.url())),
        page.waitForResponse((response) => vmCreateUrl.test(response.url())),
        page.getByRole('button', { name: 'Create project' }).click(),
    ])

    await expect(page).toHaveURL(new RegExp(`/s/${createdShareId}$`))
    expect(requestedVmUrl).toContain('/api/vm')
    expect(createdShareBody).toContain('"name":"Playwright Project"')
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
