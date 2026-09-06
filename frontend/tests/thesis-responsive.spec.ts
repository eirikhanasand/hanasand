import { expect, test } from '@playwright/test'

for (const [width, height] of [[320, 568], [390, 844], [767, 1024], [768, 1024], [820, 1180], [1023, 768], [1024, 768], [1180, 820], [1279, 800], [1280, 800], [1440, 900]]) {
    test(`thesis footer and sheet navigation work at ${width}x${height}`, async({ page }) => {
        await page.setViewportSize({ width, height })
        await page.goto('/thesis')
        const bar = page.getByRole('navigation', { name: 'Sheet navigation' })
        const footer = page.getByRole('contentinfo')
        await expect(bar).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await page.getByRole('tab', { name: 'Research', exact: true }).click()
        await expect(page.getByRole('tab', { name: 'Research', exact: true })).toHaveAttribute('aria-selected', 'true')
        await page.getByRole('tab', { name: 'Research', exact: true }).press('ArrowLeft')
        await expect(page.getByRole('tab', { name: 'Plan', exact: true })).toBeFocused()
        await footer.evaluate(element => element.scrollIntoView({ block: 'end' }))
        await expect(bar).toBeHidden()
        expect((await footer.boundingBox())!.y + (await footer.boundingBox())!.height).toBeLessThanOrEqual(height + 1)
        const link = footer.getByRole('link').last()
        await link.scrollIntoViewIfNeeded()
        expect(await link.evaluate(element => {
            const box = element.getBoundingClientRect()
            return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
        })).toBe(true)
        await page.locator('.enterprise-theme').evaluate(element => element.scrollTo({ top: 0 }))
        await expect(bar).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
}
