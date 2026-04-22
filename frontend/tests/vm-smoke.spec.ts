import { expect, test } from '@playwright/test'

test('vm start control encodes the VM name and shows the API result', async ({ page, context, baseURL }) => {
    await context.addCookies([
        {
            name: 'access_token',
            value: encodeURIComponent('playwright-token'),
            url: baseURL!,
        },
        {
            name: 'id',
            value: 'playwright-user',
            url: baseURL!,
        },
    ])

    let requestedUrl = ''
    let authHeader = ''

    await page.route('https://api.hanasand.com/api/vm/**', async (route) => {
        requestedUrl = route.request().url()
        authHeader = route.request().headers().authorization || ''
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'VM started' }),
        })
    })

    await page.goto('/dev/vm-smoke')
    await page.getByRole('button').filter({ has: page.locator('svg') }).first().click()

    await expect(page.getByText('VM started')).toBeVisible()
    expect(requestedUrl).toContain('/vm/folder%2Ftest%20vm/start')
    expect(authHeader).toBe('Bearer playwright-token')
})
