import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.route('**/api/organizations', route => route.fulfill({ status: 401, json: { error: 'Unauthorized.' } }))
})

test('public navigation has distinct destinations and useful developer shortcuts', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/developers')
    const navigation = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(navigation.getByRole('button')).toHaveText(['Product', 'Developers', 'Resources'])
    await expect(navigation.getByRole('link', { name: 'Pricing', exact: true })).toHaveAttribute('href', '/pricing')
    await navigation.getByRole('button', { name: 'Product', exact: true }).hover()
    const destinations = await navigation.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')))
    expect(new Set(destinations).size).toBe(destinations.length)
    await expect(navigation.getByRole('link', { name: /All products and solutions/ })).toBeVisible()
    await navigation.getByRole('button', { name: 'Developers', exact: true }).focus()
    await page.mouse.move(0, 800)
    const reference = navigation.getByRole('link', { name: /^API reference/ })
    await expect(reference).toBeVisible()
    await reference.click()
    await expect(page).toHaveURL(/#endpoints$/)
    await expect.poll(async () => (await page.locator('#endpoints').boundingBox())?.y).toBeGreaterThanOrEqual(72)
    await expect.poll(async () => (await page.locator('#endpoints').boundingBox())?.y).toBeLessThan(130)
})

test('developer hero stays compact with inline desktop actions and mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/developers')
    await expect(page.getByText('Versioned, metadata-safe access', { exact: false })).toHaveCount(0)
    const heading = await page.getByRole('heading', { level: 1 }).boundingBox()
    const action = await page.getByRole('link', { name: 'Create API key', exact: true }).boundingBox()
    expect(action!.x).toBeGreaterThan(heading!.x + heading!.width)
    expect(Math.abs(action!.y + action!.height / 2 - heading!.y - heading!.height / 2)).toBeLessThan(24)
    expect((await page.locator('#api-access').boundingBox())!.y).toBeLessThan(260)
    for (const width of [1280, 1024, 390]) {
        await page.setViewportSize({ width, height: 844 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(page.getByRole('link', { name: 'Security Scanner', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'TypeScript client', exact: true }).click()
    await expect(page).toHaveURL(/#clients$/)
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
})
