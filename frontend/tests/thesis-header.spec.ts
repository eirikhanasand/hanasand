import { expect, test } from '@playwright/test'

test('document controls align with the title and preserve insertion, history and read-only access', async({ browser, baseURL }) => {
    test.skip(process.env.THESIS_HEADER_TEST !== '1', 'Requires the isolated thesis header fixture.')
    expect(baseURL).toBe('http://127.0.0.1:3230')
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.routeWebSocket('**/*', socket => socket.close())
    await context.addCookies([{ name: 'id', value: 'eirikhanasand', url: baseURL! }, { name: 'access_token', value: 'isolated-header-owner', url: baseURL! }])
    const page = await context.newPage()
    await page.goto('/thesis')
    const region = page.getByRole('region', { name: 'Thesis document' })
    const insert = region.getByRole('button', { name: 'Insert table', exact: true })
    const history = region.getByRole('button', { name: 'History', exact: true })
    await expect(insert).toBeVisible()
    const titleBox = (await region.getByRole('heading', { name: 'Thesis header check' }).boundingBox())!
    const historyBox = (await history.boundingBox())!
    const insertBox = (await insert.boundingBox())!
    expect(Math.abs(titleBox.y - historyBox.y)).toBeLessThan(8)
    expect(insertBox.x).toBeGreaterThan(titleBox.x + titleBox.width)
    const rightInset = await region.evaluate(element => {
        const box = element.getBoundingClientRect()
        return box.right - parseFloat(getComputedStyle(element).paddingRight)
    })
    expect(Math.abs(historyBox.x + historyBox.width - rightInset)).toBeLessThan(2)
    await region.getByText('Before cursor', { exact: true }).click()
    await region.getByRole('textbox', { name: 'Description Markdown', exact: true }).press('End')
    await insert.click()
    await expect(region.getByRole('region', { name: 'Inline table' })).toHaveCount(1)
    await expect.poll(async() => (await (await context.request.get(baseURL + '/api/thesis')).json()).body, { timeout: 12000 }).toMatch(/Before cursor[\s\S]*\| Task[\s\S]*After cursor/)
    await history.click()
    await expect(region.getByRole('region', { name: 'Version history' })).toBeVisible()
    await region.getByRole('button', { name: 'Close history', exact: true }).click()
    await expect(region.getByRole('region', { name: 'Version history' })).toHaveCount(0)
    await page.reload()
    await expect(region.getByRole('region', { name: 'Inline table' })).toHaveCount(1)
    await page.screenshot({ path: '/tmp/thesis-header-desktop.png' })
    for (const [width, height] of [[320, 568], [390, 844], [767, 1024], [768, 1024], [820, 1180], [1024, 768], [1180, 820]]) {
        await page.setViewportSize({ width, height })
        const insertBounds = (await insert.boundingBox())!
        const historyBounds = (await history.boundingBox())!
        const titleBounds = (await region.getByRole('heading', { name: 'Thesis header check' }).boundingBox())!
        expect(insertBounds.height).toBeGreaterThanOrEqual(44)
        expect(historyBounds.height).toBeGreaterThanOrEqual(44)
        expect(historyBounds.x + historyBounds.width).toBeLessThanOrEqual(width - 16)
        if (width >= 768) expect(insertBounds.x).toBeGreaterThan(titleBounds.x + titleBounds.width)
        else expect(insertBounds.y).toBeGreaterThan(titleBounds.y + titleBounds.height)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(insert).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: '/tmp/thesis-header-mobile.png' })
    const viewer = await browser.newContext()
    await viewer.routeWebSocket('**/*', socket => socket.close())
    const publicPage = await viewer.newPage()
    await publicPage.goto('/thesis')
    await expect(publicPage.getByRole('heading', { name: 'Thesis header check' })).toBeVisible()
    await expect(publicPage.getByRole('button', { name: /^(Insert table|History)$/ })).toHaveCount(0)
    await viewer.close()
    await context.close()
})
