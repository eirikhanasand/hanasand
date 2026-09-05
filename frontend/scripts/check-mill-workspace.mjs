import { strict as assert } from 'node:assert'
import { chromium } from '@playwright/test'

// Run against a local frontend: bun scripts/check-mill-workspace.mjs
const base = process.env.MILL_TEST_URL || 'http://127.0.0.1:3017'
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
const browser = await chromium.launch({ headless: true })
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' } })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: '[]', theme: 'dark' }).map(([name, value]) => ({ name, value, url: base })))
    const requests = []
    const writes = []
    await context.route('**/api/**', route => {
        const request = route.request()
        const url = new URL(request.url())
        requests.push(url.pathname)
        if (request.method() === 'POST') writes.push({ path: url.pathname, body: request.postDataJSON(), org: url.searchParams.get('organizationId') })
        const rule = { id: 'rule-1', name: 'Repeated login failures', family: 'identity', severity: 'high', explanation: 'Repeated unsuccessful authentication attempts.', evidence: [], enabled: true }
        const payload = url.pathname === '/api/organizations' ? { organizations: [{ id: 'alpha', name: 'Alpha', role: 'owner' }, { id: 'beta', name: 'Beta', role: 'owner' }, { id: 'reader', name: 'Read only', role: 'member' }] }
            : url.pathname.endsWith('/rules') ? { rules: [rule] }
                : url.pathname.endsWith('/findings') ? { findings: [{ id: 'finding-1', rule_id: 'rule-1', severity: 'high', status: 'new', summary: 'Suspicious login activity', evidence: {}, event_ids: [], first_observed: '2026-09-01T12:00:00Z', last_observed: '2026-09-01T12:00:00Z' }] }
                    : url.pathname.endsWith('/usage') ? { metering: { active_rules: 7, events_30d: 1200 } } : {}
        return route.fulfill({ json: payload })
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/dashboard/mill?organizationId=beta`)
    await page.getByRole('heading', { name: 'Findings queue' }).waitFor()
    await page.getByRole('button', { name: /Suspicious login activity/ }).waitFor()
    assert.equal(await page.getByLabel('Organization', { exact: true }).inputValue(), 'beta')
    assert.equal(await page.locator('form').count(), 0)
    assert.equal(await page.getByText('Active rules', { exact: true }).locator('..').locator('p').last().innerText(), '7')
    const queue = await page.getByRole('heading', { name: 'Findings queue' }).boundingBox()
    const detail = await page.getByRole('heading', { name: 'Suspicious login activity', exact: true }).boundingBox()
    assert(Math.abs(queue.y - detail.y) < 60, 'Queue and detail must share the first row')
    if (process.env.MILL_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MILL_SCREENSHOT_DIR}/mill-overview.png` })
    await page.getByRole('link', { name: 'Detection rules', exact: true }).last().click()
    await page.getByRole('heading', { name: 'Rule library' }).waitFor()
    assert.equal(await page.getByLabel('Organization', { exact: true }).inputValue(), 'beta')
    assert.equal(await page.locator('details').count(), 3)
    assert.equal(await page.locator('details[open]').count(), 0)
    assert.equal(await page.getByRole('heading', { name: 'Findings queue' }).count(), 0)
    if (process.env.MILL_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MILL_SCREENSHOT_DIR}/mill-rules.png` })
    await page.getByText('Create custom rule', { exact: true }).click()
    await page.getByLabel('Rule name', { exact: true }).fill('Test rule')
    await page.getByLabel('Rule explanation').fill('Investigate unusual authentication.')
    await page.getByLabel('Rule value').fill('authentication')
    await page.getByRole('button', { name: 'Create rule', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Custom rule created' }).waitFor()
    assert.equal(writes.at(-1).org, 'beta')
    assert.equal(writes.at(-1).body.conditions[0].value, 'authentication')
    await page.getByText('Import JSON pack', { exact: true }).click()
    await page.getByLabel('Pack name', { exact: true }).fill('Test pack')
    await page.getByLabel('Pack version', { exact: true }).fill('1')
    await page.getByLabel('Pack source reference', { exact: true }).fill('https://example.com/rules')
    await page.getByRole('button', { name: 'Import pack', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Signature pack imported' }).waitFor()
    assert.equal(writes.at(-1).path, '/api/backend/mill/rules/packs')
    await page.getByText('Import Sigma YAML', { exact: true }).click()
    await page.getByLabel('Sigma pack name').fill('Sigma pack')
    await page.getByLabel('Sigma pack version').fill('1')
    await page.getByLabel('Sigma pack source reference').fill('https://example.com/sigma')
    await page.getByRole('button', { name: 'Import Sigma', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Sigma rules imported' }).waitFor()
    assert.equal(writes.at(-1).path, '/api/backend/mill/rules/sigma')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).first().click()
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Forms must fit mobile')
    if (process.env.MILL_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MILL_SCREENSHOT_DIR}/mill-rules-mobile.png` })
    await page.getByLabel('Organization', { exact: true }).selectOption('reader')
    assert(await page.getByRole('button', { name: 'Disable', exact: true }).isDisabled())
    assert(await page.getByRole('button', { name: 'Create rule', exact: true }).isDisabled())
    requests.length = 0
    await page.reload()
    await page.getByRole('button', { name: 'Disable', exact: true }).waitFor()
    assert(!requests.some(path => /\/(findings|events|usage|members)$/.test(path)), 'Rules must not load investigation data')
    await page.getByRole('link', { name: 'Back to overview' }).click()
    await page.getByRole('heading', { name: 'Findings queue' }).waitFor()
    assert.equal(await page.getByLabel('Organization', { exact: true }).inputValue(), 'reader')
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overview must fit mobile')
    assert.deepEqual(errors, [])
    console.log('Mill workspace passed: routes, organization context, compact layout, rule creation and imports, permissions, mobile, and scoped data loading.')
} finally {
    await browser.close()
}
