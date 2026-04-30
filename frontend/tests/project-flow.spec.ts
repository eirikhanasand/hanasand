import { expect, test } from '@playwright/test'

test('share flow creates the share before opening the workspace route', async ({ page }) => {
    let createdShareBody = ''
    let createdShareId = ''

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
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

    await page.goto('/s')
    await Promise.all([
        page.waitForResponse('https://cdn.hanasand.com/api/share'),
        page.getByRole('button', { name: 'Create share' }).click(),
    ])

    await expect(page).toHaveURL(new RegExp(`/s/${createdShareId}$`))
    expect(createdShareBody).toContain('"includeTree":true')
    expect(createdShareBody).toContain('"type":"folder"')
    expect(createdShareBody).toContain('"name":"share-')
    await expect(page.getByText(`Share ready. Opening workspace ${createdShareId}.`)).toBeVisible()
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

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
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

    await page.route('https://api.hanasand.com/api/vm', async (route) => {
        requestedVmUrl = route.request().url()
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Created VM playwright-project' }),
        })
    })

    await page.goto('/s')
    await page.getByPlaceholder('Project name').fill('Playwright Project')
    await Promise.all([
        page.waitForResponse('https://cdn.hanasand.com/api/share'),
        page.waitForResponse('https://api.hanasand.com/api/vm'),
        page.getByRole('button', { name: 'Create project' }).click(),
    ])

    await expect(page).toHaveURL(new RegExp(`/s/${createdShareId}$`))
    expect(requestedVmUrl).toContain('/api/vm')
    expect(createdShareBody).toContain('"name":"Playwright Project"')
})

test('metadata reload keeps the current share id instead of opening a random workspace', async ({ page }) => {
    const shareId = 'pwshare-metadata'

    await page.route(`https://cdn.hanasand.com/api/share/${shareId}`, async (route) => {
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

    await page.route(`https://cdn.hanasand.com/api/share/tree/${shareId}`, async (route) => {
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
    await page.getByRole('button', { name: 'Open share metadata' }).click()
    await page.getByRole('link', { name: 'Reload current share workspace' }).click()

    await expect(page).toHaveURL(new RegExp(`/s/${shareId}$`))
    await expect(page.getByRole('link', { name: 'Reload current share workspace' })).toHaveAttribute('href', `/s/${shareId}`)
})
