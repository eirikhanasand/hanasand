import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
let output: string, bundle: string
const rule = { id: 'http.routine_access.v1', version: '1', name: 'Routine requests', family: 'HTTP', severity: 'high', explanation: 'Count routine requests.', evidence: [], enabled: true, definition: { stage: 'analyze', action: 'drop' } }
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'mill-rules-'))
    execFileSync('bun', ['-e', `const result = await Bun.build({entrypoints:['tests/fixtures/mill-rules.tsx'], outdir:${JSON.stringify(output)}, target:'browser', define:{'process.env':JSON.stringify({NODE_ENV:'production'})}, plugins:[{name:'workspace',setup(build){build.onLoad({filter:/workspaceProvider\\.tsx$/},()=>({contents:'export const useWorkspace = () => ({organizationId:"org-a", organizations:[{id:"org-a",role:"owner"}]})',loader:'tsx'}))}}]}); if(!result.success) throw new Error(result.logs.join('\\n'))`])
    bundle = readFileSync(path.join(output, 'mill-rules.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.route('http://mill.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://mill.test/mill/rules/*', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' }))
})
for (const category of ['match', 'analysis', 'detection']) test(`${category} has Create before Import and opens the creation form`, async ({ page }) => {
    await page.route('**/api/backend/mill/rules?*', route => route.fulfill({ json: { rules: [rule] } }))
    await page.goto(`http://mill.test/mill/rules/${category}`)
    const create = page.getByRole('button', { name: 'Create', exact: true })
    const names = await page.getByRole('button').allTextContents()
    expect(names.indexOf('Create')).toBeLessThan(names.indexOf('Import'))
    await create.click()
    await expect(page.getByLabel('Rule name', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create rule', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Import JSON pack', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Rule name', { exact: true })).toHaveCount(0)
})
test('analysis separates configured retention from enabled state', async ({ page }) => {
    let enabled = true
    await page.route('**/api/backend/mill/rules?*', route => route.fulfill({ json: { rules: [{ ...rule, enabled }, { ...rule, id: 'auth.new_country.v1', name: 'New country', definition: undefined }] } }))
    await page.route('**/api/backend/mill/rules/*/actions?*', route => { expect(route.request().postDataJSON()).toEqual({ action: 'disable' }); enabled = false; return route.fulfill({ json: {} }) })
    await page.goto('http://mill.test/mill/rules/analysis')
    await expect(page.getByRole('columnheader', { name: 'Action', exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Controls', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Drop · Routine requests' })).toHaveAttribute('href', '/mill/rules/analysis/http.routine_access')
    await expect(page.getByRole('link', { name: 'Store · New country' })).toBeVisible()
    await page.getByRole('button', { name: 'Disable Routine requests', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Enable Routine requests', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Drop · Routine requests' })).toBeVisible()
})
