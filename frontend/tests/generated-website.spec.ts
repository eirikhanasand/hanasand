import { expect, test } from '@playwright/test'

test('generated website builds a usable desktop and mobile page', async({ page }) => {
    test.skip(!process.env.GENERATED_WEBSITE_URL, 'Requires an isolated generated website')
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(process.env.GENERATED_WEBSITE_URL!)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Field & Form')
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('form')).toHaveCount(0)
    const contact = page.getByRole('link', { name: 'Contact', exact: true })
    if (process.env.GENERATED_WEBSITE_CONTACT_EMAIL) {
        await expect(contact).toHaveAttribute('href', 'mailto:' + encodeURIComponent(process.env.GENERATED_WEBSITE_CONTACT_EMAIL))
    } else {
        await expect(contact).toHaveCount(0)
    }
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('main')).toBeFocused()
    for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
    if (process.env.GENERATED_WEBSITE_SCREENSHOT) {
        await page.evaluate(() => { document.documentElement.style.fontSize = '' })
        await page.setViewportSize({ width: 1440, height: 1000 })
        await page.screenshot({ path: process.env.GENERATED_WEBSITE_SCREENSHOT, fullPage: true })
    }
})
