import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.route('**/api/organizations', route => route.fulfill({ status: 401, json: { error: 'Unauthorized.' } }))
})

test('retired Solutions page is unavailable and absent from navigation', async ({ page, request }) => {
    const response = await page.goto('/solutions')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'This page is not available.' })).toBeVisible()
    await expect(page.locator('a[href="/solutions"]')).toHaveCount(0)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    await expect(page.locator('a[href="/solutions"]')).toHaveCount(0)
    const mobile = page.getByRole('navigation', { name: 'Mobile main navigation' })
    await mobile.locator('summary').filter({ hasText: 'Product' }).click()
    await expect(mobile.getByRole('link', { name: /^Dark Web Monitoring/ })).toBeVisible()

    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.ok()).toBe(true)
    expect(await sitemap.text()).not.toContain('<loc>https://hanasand.com/solutions</loc>')
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
    await expect(navigation.getByRole('link', { name: /^Dark Web Monitoring/ })).toBeVisible()
    await expect(page.locator('a[href="/solutions"]')).toHaveCount(0)
    await navigation.getByRole('button', { name: 'Developers', exact: true }).focus()
    await page.mouse.move(0, 800)
    const reference = navigation.getByRole('link', { name: /^API reference/ })
    await expect(reference).toBeVisible()
    await reference.click()
    await expect(page).toHaveURL(/#endpoints$/)
    await expect.poll(async () => (await page.locator('#endpoints').boundingBox())?.y).toBeGreaterThanOrEqual(72)
    await expect.poll(async () => (await page.locator('#endpoints').boundingBox())?.y).toBeLessThan(200)
})

test('developer hero stays compact with inline desktop actions and mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/developers')
    await expect(page.getByText('Versioned, metadata-safe access', { exact: false })).toHaveCount(0)
    const heading = await page.getByRole('heading', { level: 1 }).boundingBox()
    const action = await page.locator('#api-key-header-action').getByRole('link', { name: 'Create account', exact: true }).boundingBox()
    expect(action!.x).toBeGreaterThan(heading!.x + heading!.width)
    expect(Math.abs(action!.y + action!.height / 2 - heading!.y - heading!.height / 2)).toBeLessThan(24)
    expect((await page.locator('#api-access').boundingBox())!.y).toBeLessThan(260)
    for (const width of [1280, 1024, 390]) {
        await page.setViewportSize({ width, height: 844 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const mobile = page.getByRole('navigation', { name: 'Mobile main navigation' })
    await mobile.locator('summary').filter({ hasText: 'Product' }).click()
    await expect(mobile.getByRole('link', { name: /^Security Scanner/ })).toBeVisible()
    await mobile.locator('summary').filter({ hasText: 'Developers' }).click()
    await mobile.getByRole('link', { name: /^TypeScript client/ }).click()
    await expect(page).toHaveURL(/#clients$/)
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
})

test('mobile navigation preserves desktop groups and destinations', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/developers')
    const desktop = page.getByRole('navigation', { name: 'Main navigation', exact: true })
    const groups = await desktop.getByRole('button').allTextContents()
    const destinations = await desktop.locator('a').evaluateAll(links => links.map(link => ({ text: link.textContent, href: link.getAttribute('href') })))
    for (const width of [320, 390, 820]) {
        await page.setViewportSize({ width, height: 844 })
        const trigger = page.getByRole('button', { name: 'Open navigation', exact: true })
        await trigger.click()
        const mobile = page.getByRole('navigation', { name: 'Mobile main navigation', exact: true })
        await expect(mobile.locator('summary')).toHaveText(groups)
        const mobileDestinations = await mobile.locator('a').evaluateAll(links => links.map(link => ({ text: link.textContent, href: link.getAttribute('href') })))
        expect(mobileDestinations.slice(0, destinations.length)).toEqual(destinations)
        for (const group of groups) {
            await mobile.locator('summary').filter({ hasText: group }).click()
            await expect(mobile.locator('details[open]')).toHaveCount(1)
            const bounds = (await mobile.boundingBox())!
            expect(bounds.x).toBeGreaterThanOrEqual(0)
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        }
        await page.keyboard.press('Escape')
        await expect(mobile).toHaveCount(0)
        await expect(trigger).toBeFocused()
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    const mobile = page.getByRole('navigation', { name: 'Mobile main navigation' })
    await mobile.locator('summary').filter({ hasText: 'Developers' }).click()
    await mobile.getByRole('link', { name: /^API reference/ }).click()
    await expect(page).toHaveURL(/#endpoints$/)
    await expect(mobile).toHaveCount(0)
})
