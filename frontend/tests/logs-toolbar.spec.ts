import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'
import { openLogs, result } from './fixtures/logs-browser'

test('search toolbar keeps long services contained and controls aligned on desktop and mobile', async ({ page }) => {
    const stylesheet = await postcss([tailwindcss()]).process(readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') })
    await page.route('**/api/backend/logs/search?*', route => route.fulfill({ json: { ...result(), services: [{ service: 'hanasand-frontend-previous-daily-updates-' + 'a'.repeat(40), count: 1 }] } }))
    await openLogs(page, '/logs/search')
    await page.addStyleTag({ content: stylesheet.css })
    await page.evaluate(() => { document.body.classList.add('dark') })
    const toolbar = page.getByRole('region', { name: 'Log search', exact: true })
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(toolbar.getByRole('combobox', { name: 'Service', exact: true }).locator('option')).toHaveCount(4)
        const search = await toolbar.getByRole('searchbox').boundingBox()
        const hql = await toolbar.getByText('HQL', { exact: true }).boundingBox()
        const filters = await toolbar.getByRole('combobox').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right } }))
        expect(search!.y).toBe(hql!.y)
        expect(search!.height).toBe(hql!.height)
        expect(filters.every(filter => filter.width <= width / 2 && filter.right <= width)).toBe(true)
        expect(new Set(filters.map(filter => filter.height)).size).toBe(1)
        expect(new Set(filters.map(filter => filter.y)).size).toBe(width > 1000 ? 1 : 2)
        if (width > 1000) expect(search!.width).toBeGreaterThan(filters[0].width * 2)
        await toolbar.screenshot({ path: `/tmp/hanasand-logs-toolbar-${width}.png` })
        await toolbar.getByRole('checkbox', { name: 'HQL' }).check()
        await expect(page.getByRole('textbox', { name: 'HQL query' })).toBeVisible()
        await expect(toolbar.getByRole('searchbox')).toBeDisabled()
        await toolbar.getByRole('checkbox', { name: 'HQL' }).uncheck()
    }
})
