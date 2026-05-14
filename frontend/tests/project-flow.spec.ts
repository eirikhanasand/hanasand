import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const shareCreateUrl = '**/api/share*'
const syncAgentTargetUrl = /\/api\/vm\/[^/]+\/agent-target\/sync-access$/
const getAgentTargetUrl = /\/api\/vm\/[^/]+\/agent-target$/

function isShareCreateUrl(url: string) {
    return url.includes('/api/share')
}

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

    const shareResponse = page.waitForResponse((response) => isShareCreateUrl(response.url()))

    await page.goto('/s')
    await shareResponse

    await expect(page).toHaveURL(new RegExp(`/s/${createdShareId}(?:\\?new=1)?$`))
    await expect(page.getByText('Opening workspace')).toHaveCount(0)
    await expect(page.getByText('Creating project workspace')).toHaveCount(0)
    await expect(page.locator('main textarea').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create project' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await expect(page.locator('ul', { hasText: createdShareId })).toHaveCount(0)
    expect(createdShareBody).toContain(`"name":"${createdShareId}"`)
})

test('the /s entry automatically opens a saved workspace', async ({ page, context, baseURL }) => {
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

    const shareResponse = page.waitForResponse((response) => isShareCreateUrl(response.url()))

    await page.goto('/s')
    await expect(page.getByRole('button', { name: 'Create share' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create project' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await expect(page.getByText('Share flow')).toHaveCount(0)
    await expect(page.getByText('Project flow')).toHaveCount(0)

    await shareResponse

    await expect(page).toHaveURL(new RegExp(`/s/${createdShareId}(?:\\?new=1)?$`))
    await expect(page.locator('main textarea').first()).toBeVisible()
    expect(createdShareBody).toContain('"includeTree":true')
    expect(createdShareBody).toContain('"type":"folder"')
    expect(createdShareBody).toContain(`"name":"${createdShareId}"`)
})

test('authenticated users trigger share provisioning by opening /s', async ({ page, context, baseURL }) => {
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
                alias: `project-${createdShareId}`,
                path: `project-${createdShareId}`,
                content: '',
                tree: [],
            }),
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

    const shareResponse = page.waitForResponse((response) => isShareCreateUrl(response.url()))

    await page.goto('/s')
    await shareResponse

    await expect(page).toHaveURL(new RegExp(`/s/${createdShareId}(?:\\?new=1)?$`))
    await expect(page.locator('main textarea').first()).toBeVisible()
    expect(createdShareBody).toContain(`"name":"${createdShareId}"`)
})

test('new files stay inside the existing project root', async ({ page }) => {
    const shareId = 'pwshare-project'
    const rootId = 'project-root-from-api'
    const createdPaths: string[] = []

    await page.route(new RegExp(`/api/share/${shareId}$`), async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: 'mayapple-snake-vamo',
                path: shareId,
                content: '',
                wordCount: 0,
                estimatedMinutes: 0,
                timestamp: new Date().toISOString(),
                git: null,
                locked: false,
                owner: '',
                parent: '',
            }),
        })
    })

    await page.route(new RegExp(`/api/share/tree/${shareId}$`), async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    id: rootId,
                    name: 'project-QHNVEX',
                    alias: 'project-QHNVEX',
                    parent: null,
                    type: 'folder',
                    children: [],
                },
            ]),
        })
    })

    await page.route(shareCreateUrl, async (route) => {
        const body = JSON.parse(route.request().postData() || '{}')
        createdPaths.push(`${body.parent}:${body.name}`)
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id,
                alias: body.name,
                path: body.name,
                content: '',
                tree: [
                    {
                        id: rootId,
                        name: 'project-QHNVEX',
                        alias: 'project-QHNVEX',
                        parent: null,
                        type: 'folder',
                        children: [
                            {
                                id: body.id,
                                name: body.name,
                                alias: body.name,
                                parent: rootId,
                                type: 'file',
                            },
                        ],
                    },
                ],
            }),
        })
    })

    await page.goto(`/s/${shareId}`)
    await expect(page.getByText('project-QHNVEX').first()).toBeVisible()
    await expect(page.getByRole('link', { name: shareId })).toBeVisible()

    await page.getByRole('button', { name: 'Create file', exact: true }).click()
    const fileNameInput = page.getByRole('textbox', { name: 'New file name' })
    await fileNameInput.fill('ab')
    await fileNameInput.press('Enter')

    await expect(page.getByRole('link', { name: 'ab' })).toBeVisible()
    await expect(page.getByText('project-QHNVEX').first()).toBeVisible()
    expect(createdPaths).toContain(`${rootId}:ab`)
})

test('phone simulator opens and checks Expo through the share VM', async ({ page }) => {
    const shareId = 'pwshare-phone'

    await page.route(`**/api/share/request/${shareId}*`, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 200,
                ok: true,
                body: 'packager-status:running',
            }),
        })
    })

    await page.goto(`/s/${shareId}`)
    await page.waitForFunction(() => {
        const button = document.querySelector('[aria-label="Open share metadata"]') as HTMLButtonElement | null
        return Boolean(button?.onclick)
    })
    await page.evaluate(() => {
        document
            .querySelector('[aria-label="Open share metadata"]')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    })
    await expect(page.getByRole('button', { name: 'Phone simulator' })).toBeVisible()
    await page.getByRole('button', { name: 'Phone simulator' }).click()

    await expect(page.getByText('Expo phone')).toBeVisible()
    await page.getByRole('button', { name: 'Check' }).click()
    await expect(page.getByText('Metro online')).toBeVisible()
    await expect(page.getByText('Expo Metro is running from this project VM.')).toBeVisible()
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
    await page.waitForFunction(() => {
        const button = document.querySelector('[aria-label="Open share metadata"]') as HTMLButtonElement | null
        return Boolean(button?.onclick)
    })
    await page.evaluate(() => {
        document
            .querySelector('[aria-label="Open share metadata"]')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    })
    await page.getByRole('link', { name: 'Reload current share workspace' }).click()

    await expect(page).toHaveURL(new RegExp(`/s/${shareId}$`))
    await expect(page.getByRole('link', { name: 'Reload current share workspace' })).toHaveAttribute('href', `/s/${shareId}`)
})
