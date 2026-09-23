import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'

test('creates a drop rule and reprocesses actual stored matches without redeployment', async ({ page }) => {
    test.skip(!process.env.REPROCESS_INTEGRATION_URL, 'Run with the disposable PostgreSQL integration server.')
    const base = process.env.REPROCESS_INTEGRATION_URL!
    const output = mkdtempSync(path.join(tmpdir(), 'rule-reprocess-ui-'))
    try {
        execFileSync('bun', ['build', 'tests/fixtures/rule-reprocess.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outdir', output])
        const css = (await postcss([tailwind()]).process(readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') })).css
        await page.route(`${base}/fixture.js`, route => route.fulfill({ contentType: 'application/javascript', body: readFileSync(path.join(output, 'rule-reprocess.js'), 'utf8') }))
        await page.route(`${base}/test-rules`, route => route.fulfill({ contentType: 'text/html', body: `<html class="dark"><head><style>${css}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>` }))
        // API calls are not mocked: this talks to the real handlers and disposable PostgreSQL.
        await page.goto(`${base}/test-rules`)
        await page.getByLabel('Rule name').fill('Drop routine UI check')
        await page.getByLabel('Rule explanation').fill('Drop only the disposable UI check log.')
        await page.getByLabel('Rule action').selectOption('drop')
        await page.getByLabel('Condition 1 field', { exact: true }).fill('message')
        await page.getByLabel('Condition 1 operator').selectOption('equals')
        await page.getByLabel('Condition 1 value', { exact: true }).fill('routine ui-check')
        await expect(page.getByRole('button', { name: 'Create rule', exact: true })).toBeEnabled()
        await page.getByRole('button', { name: 'Create rule', exact: true }).click()
        await expect(page.getByRole('heading', { name: 'Drop routine UI check' })).toBeVisible()
        await page.getByRole('button', { name: 'Reprocess existing logs', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Apply to existing logs' })).toBeDisabled()
        await page.getByRole('checkbox', { name: /Apply saved version/ }).check()
        await expect(page.getByRole('button', { name: 'Apply to existing logs' })).toBeEnabled()
        await page.getByRole('button', { name: 'Apply to existing logs' }).click()
        await expect(page.getByText('completed · version 1', { exact: true })).toBeVisible({ timeout: 20_000 })
        await expect(page.getByText(/1 event removed · 1 original removed/)).toBeVisible()
        await page.reload()
        await expect(page.getByText('completed · version 1', { exact: true })).toBeVisible()
        await page.screenshot({ path: '/tmp/rule-reprocess-completed.png', fullPage: true })
        await page.setViewportSize({ width: 390, height: 844 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    } finally { rmSync(output, { recursive: true, force: true }) }
})
