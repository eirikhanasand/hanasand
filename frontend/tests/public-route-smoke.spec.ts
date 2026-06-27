import { expect, test } from '@playwright/test'

const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/reset-password',
    '/status',
    '/articles',
    '/articles/bot',
    '/pwned',
    '/upload',
    '/g',
    '/test',
    '/profile/eirikhanasand',
    '/s',
]

const unfinishedCopy = [
    /coming soon/i,
    /lorem ipsum/i,
    /not implemented/i,
    /\bTODO\b/i,
]

test.describe('public website routes', () => {
    for (const route of publicRoutes) {
        test(`${route} loads without unfinished production copy`, async ({ page }, testInfo) => {
            const consoleErrors: string[] = []
            page.on('console', (message) => {
                if (message.type() === 'error') {
                    consoleErrors.push(message.text())
                }
            })

            const response = await page.goto(route)

            expect(response?.status(), `${route} should not return a server error`).toBeLessThan(500)
            await expect(page.locator('body')).toBeVisible()

            const bodyText = await page.locator('body').innerText()
            for (const pattern of unfinishedCopy) {
                expect(bodyText, `${route} should not expose ${pattern}`).not.toMatch(pattern)
            }

            expect(consoleErrors, `${route} should not log browser console errors`).toEqual([])

            await testInfo.attach(`${route.replaceAll('/', '_') || 'home'}-screenshot`, {
                body: await page.screenshot({ fullPage: false }),
                contentType: 'image/png',
            })
        })
    }

    test('public navigation keeps readable light contrast and exposes load testing', async ({ page }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL || 'http://127.0.0.1:3000'
        await page.context().addCookies([
            {
                name: 'theme',
                value: 'light dark',
                url: baseURL,
            },
        ])

        await page.goto('/')
        const header = page.locator('header')
        await expect(header).toBeVisible()

        const brand = header.getByRole('link', { name: 'hanasand' }).locator('span').filter({ hasText: /^hanasand$/ })
        await expect(brand).toBeVisible()
        const productButton = header.getByRole('button', { name: 'Product' })
        await expect(productButton).toBeVisible()

        const contrast = await brand.evaluate((element) => {
            const style = window.getComputedStyle(element)
            const headerStyle = window.getComputedStyle(element.closest('header')!)
            return {
                text: style.color,
                background: headerStyle.backgroundColor,
            }
        })

        expect(contrast).toEqual({
            text: 'rgb(23, 26, 33)',
            background: 'rgb(255, 255, 255)',
        })

        await productButton.hover()
        const loadTesting = page.getByRole('link', { name: /Load Testing/i }).first()
        await expect(loadTesting).toBeVisible()
        await expect(loadTesting).toHaveAttribute('href', '/test')
    })
})
