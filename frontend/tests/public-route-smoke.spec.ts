import { expect, test } from '@playwright/test'

const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/reset-password',
    '/status',
    '/trust',
    '/trust/security-overview',
    '/trust/dpa-and-data',
    '/trust/subprocessors',
    '/trust/sla-onboarding',
    '/faq',
    '/support',
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

    test('public navigation keeps readable light contrast and exposes service checks', async ({ page }, testInfo) => {
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
        const resourcesButton = header.getByRole('button', { name: 'Resources' })
        await expect(productButton).toBeVisible()
        await expect(resourcesButton).toBeVisible()

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

        await resourcesButton.hover()
        const serviceChecks = page.getByRole('link', { name: /Service Checks/i }).first()
        await expect(serviceChecks).toBeVisible()
        await expect(serviceChecks).toHaveAttribute('href', '/test')
    })

    test('homepage and FAQ explain threat intelligence basics', async ({ page }) => {
        await page.goto('/')
        await expect(page.getByRole('heading', { name: 'Clear answers before teams trust a signal.' })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'What is a threat actor?' })).toBeVisible()
        await expect(page.getByRole('link', { name: 'View all FAQ' })).toHaveAttribute('href', '/faq')

        await page.goto('/faq')
        await expect(page.getByRole('heading', { name: 'Answers for security teams evaluating Hanasand.' })).toBeVisible()
        await page.getByRole('button', { name: 'Does an alert mean the company was breached?' }).click()
        await expect(page.getByText('No. An alert means a source made a relevant claim or mention.')).toBeVisible()
        await expect(page.getByText('Was this useful?')).toBeVisible()
        await page.getByRole('button', { name: 'Yes' }).click()
        await expect(page.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true')
    })
})
