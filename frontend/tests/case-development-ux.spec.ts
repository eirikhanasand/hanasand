import { expect, test } from '@playwright/test'

test('development links, repository setup and mobile layout', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3217'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([{ name: 'id', value: 'dashboard-render-proof-user', url: origin }, { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin }])
    await page.route('**/api/cases/HA-1?**', route => route.fulfill({ json: { case: { id: 'HA-1', title: 'HA-1 · Inference', status: 'open', severity: 'high', comments: [], notifications: [], history: [], occurrences: 2 } } }))
    let reads = 0
    await page.route('**/api/backend/cases/development?**', route => {
        expect(new URL(route.request().url()).searchParams.get('organizationId')).toBe('org')
        reads++
        return route.fulfill({ json: { items: [{ repository_id: 'repo', kind: 'commit', external_id: 'a'.repeat(40), title: 'Repair HA-1', url: 'https://github.com/team/app/commit/' + 'a'.repeat(40), provider: 'github', repository_url: 'https://github.com/team/app', state: 'committed', author: 'Engineer', updated_at: '2026-09-12T12:00:00Z', branch: 'refs/heads/main' }], hasMore: false } })
    })
    await page.route('**/api/backend/cases/repositories?**', route => {
        if (route.request().method() === 'POST') {
            expect(route.request().postDataJSON()).toEqual({ provider: 'github', repositoryUrl: 'https://github.com/team/app' })
            return route.fulfill({ status: 201, json: { secret: 'test-one-time-secret', webhookPath: '/api/cases/repository-events/test-id' } })
        }
        return route.fulfill({ json: { items: [] } })
    })
    await page.goto('/cases/HA-1?organizationId=org')
    await expect(page.getByRole('link', { name: 'aaaaaaaa · Repair HA-1' })).toHaveAttribute('href', 'https://github.com/team/app/commit/' + 'a'.repeat(40))
    const beforeRefresh = reads
    await page.getByRole('button', { name: 'Refresh development links' }).click()
    await expect.poll(() => reads).toBeGreaterThan(beforeRefresh)
    await page.getByText('Repository connections (0)', { exact: true }).click()
    await page.getByLabel('Provider', { exact: true }).selectOption('github')
    await page.getByLabel('Repository URL', { exact: true }).fill('https://github.com/team/app')
    await page.getByRole('button', { name: 'Connect repository', exact: true }).click()
    await expect(page.getByLabel('Webhook secret — shown once')).toHaveValue('test-one-time-secret')
    await page.getByRole('button', { name: 'Hide secret' }).click()
    await expect(page.getByLabel('Webhook secret — shown once')).toHaveCount(0)
    await page.screenshot({ path: '/tmp/case-development-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: '/tmp/case-development-mobile.png', fullPage: true })
})
