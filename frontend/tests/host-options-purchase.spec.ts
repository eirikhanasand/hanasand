import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'host-options-test-'))
    execFileSync(process.env.BUN_BINARY || 'bun', ['build', 'tests/fixtures/host-options.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.route('http://host-options.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://host-options.test/', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script src="/fixture.js"></script>' }))
})
test('unpaid options have direct buy buttons for the current container', async ({ page }) => {
    let submitted: unknown
    await page.route('**/api/backend/billing/container-checkout', route => {
        submitted = route.request().postDataJSON()
        return route.fulfill({ status: 503, json: { error: 'Payment service is temporarily unavailable.' } })
    })
    await page.goto('http://host-options.test/')
    await expect(page.getByRole('button', { name: 'Buy Always running for 49 NOK per month' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Buy Failover for 99 NOK per month' })).toBeEnabled()
    await expect(page.getByRole('switch')).toHaveCount(0)
    await page.getByRole('button', { name: 'Buy Always running for 49 NOK per month' }).click()
    await expect(page.getByText('Payment service is temporarily unavailable.')).toBeVisible()
    expect(submitted).toEqual({ vmName: 'demo-worker', feature: 'always_running' })
    await expect(page).toHaveURL('http://host-options.test/')
})
test('a purchased option becomes an accessible toggle', async ({ page }) => {
    await page.goto('http://host-options.test/')
    await page.getByRole('button', { name: 'Show purchased option' }).click()
    await expect(page.getByRole('switch', { name: 'Always running' })).not.toBeChecked()
    await expect(page.getByRole('button', { name: 'Buy Always running for 49 NOK per month' })).toHaveCount(0)
})
test('buy opens Stripe directly without a products-page detour', async ({ page }) => {
    await page.route('**/api/backend/billing/container-checkout', route => route.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/test-placeholder' } }))
    await page.route('https://checkout.stripe.com/**', route => route.fulfill({ body: 'Test checkout destination' }))
    await page.goto('http://host-options.test/')
    await page.getByRole('button', { name: 'Buy Failover for 99 NOK per month' }).click()
    await expect(page).toHaveURL('https://checkout.stripe.com/c/pay/test-placeholder')
})
