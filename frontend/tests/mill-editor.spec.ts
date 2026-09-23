import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
let output: string, bundle: string, css: string
const definition = { match: 'all', parameters: { windowMinutes: 15, minimumCount: 3 }, conditions: [], failureConditions: [] }
const initial = { id: 'auth.brute_force_success.v1', version: '1', source: 'hanasand', name: 'Brute-force success', family: 'Authentication', severity: 'high', explanation: 'Multiple failed logins followed by a successful login for the same user.', evidence: [], enabled: true, definition }
test.beforeAll(async () => {
    output = mkdtempSync(path.join(tmpdir(), 'mill-editor-'))
    execFileSync('bun', ['build', 'tests/fixtures/mill-editor.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outdir', output])
    bundle = readFileSync(path.join(output, 'mill-editor.js'), 'utf8')
    css = (await postcss([tailwind()]).process(readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') })).css
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.route('http://mill-editor.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://mill-editor.test/mill/rules/*', route => route.fulfill({ contentType: 'text/html', body: `<html class="dark"><head><style>${css}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>` }))
})
test('edits executable selectors, persists on reload, canonicalizes current links and fits mobile', async ({ page }) => {
    let saved = structuredClone(initial), writes = 0
    await page.route('**/api/backend/mill/rules/*?*', async route => {
        if (route.request().method() === 'PUT') {
            writes++
            const body = route.request().postDataJSON()
            expect(body.definition.parameters).toEqual({ windowMinutes: 30, minimumCount: 5 })
            expect(body.definition.failureConditions).toEqual([{ path: 'EventID', operator: 'regex', value: '^(4625|4771)$' }])
            expect(body.definition.conditions).toEqual([{ path: 'EventID', operator: 'equals', value: '4624' }])
            saved = { ...saved, ...body, version: '2' }
            return route.fulfill({ json: { rule: saved } })
        }
        return route.fulfill({ json: { rule: saved, isHistorical: false, currentVersion: saved.version, canEdit: true, triggerCount: 7, audit: [], nextOffset: null } })
    })
    await page.goto('http://mill-editor.test/mill/rules/auth.brute_force_success.v1')
    await expect(page).toHaveURL('http://mill-editor.test/mill/rules/auth.brute_force_success')
    await page.getByLabel('Time window').fill('30')
    await page.getByLabel('Minimum failed logins').fill('5')
    await page.getByRole('button', { name: 'Add failure selector condition' }).click()
    await page.getByLabel('Failure selector 1 field').fill('EventID')
    await page.getByLabel('Failure selector 1 operator').selectOption('regex')
    await page.getByLabel('Failure selector 1 value').fill('^(4625|4771)$')
    await page.getByRole('button', { name: 'Add success selector condition' }).click()
    await page.getByLabel('Success selector 1 field').fill('EventID')
    await page.getByLabel('Success selector 1 value').fill('4624')
    await expect(page.getByLabel('Signature preview')).toContainText('"windowMinutes": 30')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Rule saved. New events use this version.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Time window')).toHaveValue('30')
    await expect(page.getByLabel('Failure selector 1 value')).toHaveValue('^(4625|4771)$')
    expect(writes).toBe(1)
    await page.screenshot({ path: '/tmp/mill-editor-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '/tmp/mill-editor-mobile.png', fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('historical rules retain their version, disallow edits, and link to current', async ({ page }) => {
    await page.route('**/api/backend/mill/rules/*?*', route => route.fulfill({ json: { rule: initial, isHistorical: true, currentVersion: '2', canEdit: false, triggerCount: 7, audit: [], nextOffset: null } }))
    await page.goto('http://mill-editor.test/mill/rules/auth.brute_force_success.v1')
    await expect(page.getByText('Version 1 · Historical')).toBeVisible()
    await expect(page.getByLabel('Time window')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Open current rule' })).toHaveAttribute('href', '/mill/rules/auth.brute_force_success')
})
test('failed saves preserve the draft and show the server error', async ({ page }) => {
    await page.route('**/api/backend/mill/rules/*?*', route => route.request().method() === 'PUT' ? route.fulfill({ status: 409, json: { error: 'This rule changed since you opened it. Reload the rule before saving again.' } }) : route.fulfill({ json: { rule: initial, canEdit: true, currentVersion: '1', triggerCount: 0, audit: [], nextOffset: null } }))
    await page.goto('http://mill-editor.test/mill/rules/auth.brute_force_success')
    await page.getByLabel('Time window').fill('25')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('alert')).toContainText('This rule changed')
    await expect(page.getByLabel('Time window')).toHaveValue('25')
})

test('Analyze rule exposes reversible retention and persists its action', async ({ page }) => {
    let saved = { ...initial, id: 'http.routine_access.v1', name: 'Routine successful requests',
        definition: { match: 'all', stage: 'analyze', action: 'drop', conditions: [], parameters: { windowMinutes: 1, requestThreshold: 50 } } }
    await page.route('**/api/backend/mill/rules/*?*', async route => {
        if (route.request().method() === 'PUT') {
            saved = { ...saved, ...route.request().postDataJSON(), version: '2' }
            return route.fulfill({ json: { rule: saved } })
        }
        return route.fulfill({ json: { rule: saved, canEdit: true, currentVersion: saved.version, triggerCount: 0, audit: [], nextOffset: null } })
    })
    await page.goto('http://mill-editor.test/mill/rules/http.routine_access')
    await expect(page.getByText('ANALYZE FIRST', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Alert above')).toHaveValue('50')
    await page.getByLabel('Action', { exact: true }).selectOption('keep')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await page.reload()
    await expect(page.getByLabel('Action', { exact: true })).toHaveValue('keep')
    await expect(page.getByRole('button', { name: 'Add event selector condition' })).toHaveCount(0)
    await page.screenshot({ path: '/tmp/hanasand-analyze-rule.png', fullPage: true })
})


test('historical Drop rules display their recorded severity', async ({ page }) => {
    await page.route('**/api/backend/mill/rules/*?*', route => route.fulfill({ json: { rule: { ...initial, definition: { ...definition, stage: 'analyze', action: 'drop' } }, isHistorical: true, currentVersion: '2', canEdit: false, triggerCount: 0, audit: [], nextOffset: null } }))
    await page.goto('http://mill-editor.test/mill/rules/auth.brute_force_success.v1')
    await expect(page.getByRole('combobox', { name: /^Severity/ })).toHaveValue('high')
    await expect(page.getByRole('combobox', { name: /^Severity/ })).toBeDisabled()
})
