import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'container-plans-test-'))
    execFileSync(process.env.BUN_BINARY || 'bun', ['build', 'tests/fixtures/container-plans.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.route('http://container-plans.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://container-plans.test/', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script src="/fixture.js"></script>' }))
})
test('selects one container, shows both prices and sends the selected option to checkout', async ({ page }) => {
    await page.route('**/api/backend/billing/container-products', route => route.fulfill({ json: { containers: [
        { name: 'demo-web', always_running_premium: true, failover_premium: false },
        { name: 'demo-worker', always_running_premium: false, failover_premium: false },
    ] } }))
    let submitted: unknown
    await page.route('**/api/backend/billing/container-checkout', route => {
        submitted = route.request().postDataJSON()
        return route.fulfill({ status: 503, json: { error: 'Payment service is temporarily unavailable.' } })
    })
    await page.goto('http://container-plans.test/')
    await expect(page.getByText('49 NOK')).toBeVisible()
    await expect(page.getByText('99 NOK')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Already purchased' })).toBeDisabled()
    await page.getByLabel('Container', { exact: true }).selectOption('demo-worker')
    await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Always running' }) }).getByRole('button').click()
    await expect(page.getByRole('alert')).toHaveText('Payment service is temporarily unavailable.')
    expect(submitted).toEqual({ vmName: 'demo-worker', feature: 'always_running' })
})
test('signed-out users see prices and a sign-in link without an enabled purchase button', async ({ page }) => {
    await page.route('**/api/backend/billing/container-products', route => route.fulfill({ status: 401, json: {} }))
    await page.goto('http://container-plans.test/')
    await expect(page.getByRole('link', { name: 'Sign in to choose a container' })).toBeVisible()
    for (const button of await page.getByRole('button').all()) await expect(button).toBeDisabled()
})
