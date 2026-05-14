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
})
