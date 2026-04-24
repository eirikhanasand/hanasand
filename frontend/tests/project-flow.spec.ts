import { expect, test } from '@playwright/test'

test('authenticated users can create a project from /s and trigger share + VM provisioning', async ({ page, context, baseURL }) => {
    const cookieUrl = baseURL || 'http://127.0.0.1:3000'
    let requestedVmUrl = ''
    let createdShareBody = ''

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
        const requestedShareId = JSON.parse(createdShareBody).id as string
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: requestedShareId,
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
    await page.getByRole('button', { name: 'Create project' }).click()

    const createdShareId = JSON.parse(createdShareBody).id as string
    await expect(page).toHaveURL(new RegExp(`/s/${createdShareId}$`))
    expect(requestedVmUrl).toContain('/api/vm')
    expect(createdShareBody).toContain('"name":"Playwright Project"')
})
