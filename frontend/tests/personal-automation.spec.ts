import { expect, test } from '@playwright/test'

test('ordinary accounts open empty personal automation pages and save a scheduled job', async ({ context, page, baseURL }) => {
    test.setTimeout(90000)
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    for (const [name, value] of Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: encodeURIComponent('[]') })) await context.addCookies([{ name, value, url: baseURL! }])
    let rows: Record<string, unknown>[] = []
    let systemRequests = 0
    await page.route('**/api/backend/system/cron**', async route => { systemRequests++; await route.fulfill({ status: 403, json: { error: 'Forbidden' } }) })
    await page.route('**/api/backend/automations**', async route => {
        if (route.request().method() === 'POST') rows = [{ ...route.request().postDataJSON(), id: 'personal-job', ownerId: 'dashboard-render-proof-user', history: [], caseNumbers: [], certificateStatus: 'not_applicable' }]
        const list = new URL(route.request().url()).pathname.endsWith('/automations')
        await route.fulfill({ json: route.request().method() === 'POST' ? { automation: rows[0] } : list ? { automations: rows, canManageSystem: false } : { automation: rows[0], runs: [], issues: [], total: 0, nextCursor: null } })
    })
    async function open(path: string) {
        await page.goto(path)
        const retry = page.getByRole('button', { name: 'Try again' })
        await expect(retry).toBeVisible({ timeout: 20000 })
        await retry.click()
        expect(page.url()).not.toContain('notAllowed')
    }
    await open('/automation/health')
    await expect(page.getByRole('heading', { name: 'No health checks yet' })).toBeVisible()
    await page.getByRole('button', { name: 'Create health check' }).click()
    await expect(page.getByRole('combobox', { name: 'Automation type' }).locator('option[value="mail_health_check"]')).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('json')
    await expect(page.getByRole('combobox', { name: 'Source', exact: true }).locator('option[value="host"]')).toHaveCount(0)
    await open('/automation/cron')
    await expect(page.getByRole('heading', { name: 'No personal jobs yet' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'System jobs', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Create job' }).click()
    await page.getByLabel('Name', { exact: true }).fill('Renew my certificate')
    await page.getByRole('combobox', { name: 'Automation type', exact: true }).selectOption('echo')
    await page.getByRole('textbox', { name: /^Description/ }).fill('Review my certificate renewal')
    await page.getByRole('combobox', { name: 'Schedule', exact: true }).selectOption('once')
    await expect(page.getByLabel('Run every', { exact: false })).toBeHidden()
    await page.getByLabel('Run at', { exact: true }).fill('2030-01-02T12:00')
    await page.getByRole('combobox', { name: 'Notify me', exact: true }).selectOption('never')
    const saved = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/automations'))
    await page.getByRole('button', { name: 'Create automation', exact: true }).click()
    const payload = (await saved).postDataJSON()
    expect(payload).toMatchObject({ actionType: 'echo', scheduleKind: 'once' })
    expect(payload.organizationId ?? null).toBeNull()
    await expect(page.getByRole('button', { name: 'Renew my certificate', exact: true })).toBeVisible()
    await open('/automation/cron')
    await expect(page.getByRole('button', { name: 'Renew my certificate', exact: true })).toBeVisible()
    expect(systemRequests).toBe(0)
})
