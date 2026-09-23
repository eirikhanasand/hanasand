import type { MillRule } from '../src/app/dashboard/mill/rules/detection-rules'
import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
let output: string, bundle: string, css: string
const rule = { id: 'http.routine_access.v1', version: '1', name: 'Routine requests', hitCount: 12345, family: 'HTTP', severity: 'high', explanation: 'Count routine requests.', evidence: [], enabled: true, definition: { stage: 'analyze', action: 'drop' } }
test.beforeAll(async () => {
    output = mkdtempSync(path.join(tmpdir(), 'mill-rules-'))
    execFileSync('bun', ['-e', `const result = await Bun.build({entrypoints:['tests/fixtures/mill-rules.tsx'], outdir:${JSON.stringify(output)}, target:'browser', define:{'process.env':JSON.stringify({NODE_ENV:'production'})}, plugins:[{name:'workspace',setup(build){build.onLoad({filter:/workspaceProvider\\.tsx$/},()=>({contents:'export const useWorkspace = () => ({organizationId:"org-a", organizations:[{id:"org-a",role:"owner"}]})',loader:'tsx'}))}}]}); if(!result.success) throw new Error(result.logs.join('\\n'))`])
    css = (await postcss([tailwind()]).process(readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') })).css
    bundle = readFileSync(path.join(output, 'mill-rules.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.route('**/api/backend/mill/events?*', route => route.fulfill({ json: { events: [{ event_type: 'custom_health', normalized: { action: 'heartbeat' } }] } }))
    await page.route('http://mill.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://mill.test/mill/rules/*', route => route.fulfill({ contentType: 'text/html', body: `<html class="dark"><head><style>${css}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>` }))
})
for (const category of ['match', 'analysis', 'detection']) test(`${category} has Create before Import and opens the creation form`, async ({ page }) => {
    await page.route('**/api/backend/mill/rules?*', route => route.fulfill({ json: { canManageRetention: true, rules: [rule] } }))
    await page.goto(`http://mill.test/mill/rules/${category}`)
    const create = page.getByRole('button', { name: 'Create', exact: true })
    const names = await page.getByRole('button').allTextContents()
    expect(names.indexOf('Create')).toBeLessThan(names.indexOf('Import'))
    await create.click()
    await expect(page.getByLabel('Rule name', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create rule', exact: true })).toBeDisabled()
    await expect(page.getByRole('dialog', { name: 'Create rule', exact: true })).toBeVisible()
    if (category === 'analysis') {
        await page.screenshot({ path: '/tmp/mill-create-desktop.png' })
        await page.setViewportSize({ width: 390, height: 844 })
        await page.screenshot({ path: '/tmp/mill-create-mobile.png' })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.getByRole('button', { name: 'Close create rule' }).click()
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Import JSON pack', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Rule name', { exact: true })).toHaveCount(0)
})
test('analysis separates configured retention from enabled state', async ({ page }) => {
    let enabled = true
    await page.route('**/api/backend/mill/rules?*', route => route.fulfill({ json: { canManageRetention: true, rules: [{ ...rule, enabled }, { ...rule, id: 'auth.new_country.v1', name: 'New country', definition: undefined }] } }))
    await page.route('**/api/backend/mill/rules/*/actions?*', route => { expect(route.request().postDataJSON()).toEqual({ action: 'disable' }); enabled = false; return route.fulfill({ json: {} }) })
    await page.goto('http://mill.test/mill/rules/analysis')
    await expect(page.getByRole('columnheader', { name: 'Action', exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Controls', exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Hits', exact: true })).toBeVisible()
    await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: /Routine requests/ }) }).getByRole('cell', { name: '12,345', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Drop', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Drop', exact: true }).locator('a, button, [tabindex]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Routine requests/ })).toHaveAttribute('href', '/mill/rules/analysis/http.routine_access')
    await expect(page.getByRole('cell', { name: 'Store', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Disable Routine requests', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Enable Routine requests', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Drop', exact: true })).toBeVisible()
})


test('searchable event types, JSON and Drop creation preserve drafts on failure', async ({ page }) => {
    let saved: MillRule | undefined, attempts = 0
    await page.route('**/api/backend/mill/rules?*', route => {
        if (route.request().method() === 'POST') {
            attempts++
            if (attempts === 1) return route.fulfill({ status: 403, json: { error: 'System administrator access is required.' } })
            const body = route.request().postDataJSON()
            expect(body).toMatchObject({ stage: 'analyze', action: 'drop', conditions: [{ path: 'event_type', operator: 'equals', value: 'custom_health' }] })
            saved = { ...rule, ...body, id: 'custom.health.v1', source: 'owned', definition: { stage: body.stage, action: body.action, conditions: body.conditions } }
            return route.fulfill({ json: { rule: saved } })
        }
        return route.fulfill({ json: { canManageRetention: true, rules: saved ? [saved] : [] } })
    })
    await page.goto('http://mill.test/mill/rules/analysis')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.getByLabel('Rule name', { exact: true }).fill('Drop health events')
    await page.getByLabel('Rule explanation').fill('Discard routine health events from this source.')
    await page.getByLabel('Rule action').selectOption('drop')
    const value = page.getByRole('combobox', { name: 'Condition 1 value', exact: true })
    await value.fill('')
    await expect(page.getByRole('option', { name: 'authentication', exact: true })).toBeVisible()
    await value.fill('cust')
    await expect(page.getByRole('option', { name: 'authentication', exact: true })).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'custom_health', exact: true })).toBeVisible()
    await value.press('ArrowDown')
    await value.press('Enter')
    await expect(value).toHaveValue('custom_health')
    await page.getByLabel('Condition 1 operator').selectOption('regex')
    await value.fill('[')
    await expect(page.getByRole('alert')).toContainText('Invalid regular expression')
    await expect(page.getByRole('button', { name: 'Create rule', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Edit JSON', exact: true }).click()
    await page.getByLabel('Conditions JSON').fill(JSON.stringify([{ path: 'event_type', operator: 'equals', value: 'custom_health' }]))
    await page.getByRole('button', { name: 'Apply JSON' }).click()
    await expect(page.getByLabel('Rule JSON preview')).toContainText('"action": "drop"')
    await page.getByRole('button', { name: 'Create rule', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('System administrator')
    await expect(value).toHaveValue('custom_health')
    await page.getByRole('button', { name: 'Create rule', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'Drop', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('cell', { name: 'Drop', exact: true })).toBeVisible()
})
