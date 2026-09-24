import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'
import { openLogs, result } from './fixtures/logs-browser'

test('compact filters open with icon or shortcut and retain search on desktop and mobile', async ({ page }) => {
    const stylesheet = await postcss([tailwindcss()]).process(readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') })
    await page.route('**/api/backend/logs/search?*', route => route.fulfill({ json: { ...result(), services: [{ service: 'hanasand-frontend-previous-daily-updates-' + 'a'.repeat(40), count: 1 }] } }))
    await openLogs(page, '/logs/search')
    await page.addStyleTag({ content: stylesheet.css })
    await page.evaluate(() => { document.body.classList.add('dark') })
    const panel = page.getByRole('region', { name: 'Log filters' })
    const button = page.getByRole('button', { name: 'Filter logs', exact: true })
    await expect(panel).toBeHidden()
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await button.click()
        await expect(panel.getByRole('searchbox')).toBeFocused()
        await expect(panel.getByText('⌘J')).toBeVisible()
        await expect(panel.getByRole('combobox', { name: 'Service', exact: true }).locator('option')).toHaveCount(4)
        const bounds = await panel.boundingBox()
        const content = await page.getByRole('region', { name: 'Log events', exact: true }).boundingBox()
        expect(content!.y).toBeGreaterThanOrEqual(bounds!.y + bounds!.height)
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
        const filters = await panel.getByRole('combobox').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { y: r.y, height: r.height, right: r.right } }))
        expect(filters.every(filter => filter.right <= width)).toBe(true)
        expect(new Set(filters.map(filter => filter.height)).size).toBe(1)
        await panel.screenshot({ path: `/tmp/hanasand-logs-toolbar-${width}.png` })
        await panel.getByRole('searchbox').fill('whoami')
        await page.keyboard.press('Escape')
        await expect(panel).toBeHidden()
        await expect(button).toBeFocused()
        await expect(button).toContainText('1')
        await page.keyboard.press('Meta+j')
        await expect(panel.getByRole('searchbox')).toBeFocused()
        await expect(panel.getByRole('searchbox')).toHaveValue('whoami')
        await panel.getByRole('checkbox', { name: 'HQL' }).check()
        await expect(page.getByRole('textbox', { name: 'HQL query' })).toBeFocused()
        await expect(panel.getByRole('searchbox')).toBeDisabled()
        await panel.getByRole('button', { name: 'Close log filters' }).click()
        await page.keyboard.press('Control+j')
        await expect(page.getByRole('textbox', { name: 'HQL query' })).toBeFocused()
        await panel.getByRole('checkbox', { name: 'HQL' }).uncheck()
        await page.getByRole('heading', { name: 'Search logs', exact: true }).click()
        await expect(panel).toBeVisible()
        await panel.getByRole('button', { name: 'Close log filters' }).click()
        await expect(panel).toBeHidden()
    }
})
