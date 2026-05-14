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

    await page.route('**/api/vm/**', async (route) => {
        requestedUrl = route.request().url()
        authHeader = route.request().headers().authorization || ''
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'VM started' }),
        })
    })

    await page.goto('/dev/vm-smoke')
    const startButton = page.getByRole('button', { name: 'Start folder/test vm' })
    await expect(startButton).toBeEnabled()
    await startButton.click()

    await expect(page.getByText('VM started')).toBeVisible()
    expect(requestedUrl).toContain('/vm/folder%2Ftest%20vm/start')
    expect(authHeader).toBe('Bearer playwright-token')
})

test('vm start control shows plain-text API errors without parser noise', async ({ page, context, baseURL }) => {
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

    await page.route('**/api/vm/**', async (route) => {
        await route.fulfill({
            status: 503,
            contentType: 'text/plain',
            body: 'VM host is temporarily unavailable',
        })
    })

    await page.goto('/dev/vm-smoke')
    const startButton = page.getByRole('button', { name: 'Start folder/test vm' })
    await expect(startButton).toBeEnabled()
    await startButton.click()

    await expect(page.getByText('VM host is temporarily unavailable')).toBeVisible()
    await expect(page.getByText(/Unexpected token|JSON|parser/i)).toHaveCount(0)
})

test('vm hardware fields use user-facing empty placeholders', async ({ page }) => {
    await page.goto('/dev/vm-smoke')

    await expect(page.getByRole('heading', { name: 'Hardware' })).toBeVisible()
    await expect(page.getByText('Not reported')).toHaveCount(3)
    await expect(page.getByText('missing')).toHaveCount(0)
})
