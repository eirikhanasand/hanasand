import { expect, test } from '@playwright/test'

test('members can create VMs from System and VMs without requesting host telemetry', async ({ context, page, baseURL }) => {
    test.skip(!process.env.VM_FIXTURE_API, 'Requires the VM fixture API')
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: '[]' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    const rows = [{ name: 'my-machine', owner: 'dashboard-render-proof-user', status: 'running', access_users: [] }]
    await page.route('**/api/backend/vms/**', route => route.fulfill({ json: rows }))
    await page.route('**/api/vm', async route => {
        expect(route.request().postDataJSON()).toEqual({ name: 'new-machine' })
        rows.push({ ...rows[0], name: 'new-machine' })
        await route.fulfill({ status: 201, json: rows.at(-1) })
    })
    for (const route of ['/system', '/vms']) {
        await page.goto(route)
        await expect(page.getByRole('heading', { name: 'Virtual machines', exact: true }).first()).toBeVisible()
        await expect(page.getByRole('button', { name: 'Create VM', exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'my-machine', exact: true })).toBeVisible()
        await expect(page.locator('[data-system-summary-metrics]')).toHaveCount(0)
        await expect(page.getByRole('region', { name: 'Service resilience' })).toHaveCount(0)
        await expect(page.getByText('OVHcloud', { exact: true })).toHaveCount(0)
    }
    await page.getByLabel('VM name', { exact: true }).fill('new-machine')
    await page.getByRole('button', { name: 'Create VM', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'new-machine', exact: true })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Created VM' })).toContainText('Created VM new-machine.')
    const status = await page.request.get('/api/resilience')
    const data = await status.json()
    expect(data).not.toHaveProperty('compute')
    expect(data).not.toHaveProperty('sites')
    expect(data).not.toHaveProperty('replicaEligibility')
    expect(data.mode).toBe('normal')
    // A client-side role cookie cannot unlock server-rendered host data.
    await context.addCookies([{ name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), url: baseURL! }])
    await page.goto('/system')
    await expect(page.getByRole('button', { name: 'Create VM', exact: true })).toBeVisible()
    await expect(page.locator('[data-system-summary-metrics]')).toHaveCount(0)
    const requests = await (await fetch(`${process.env.VM_FIXTURE_API}/requests`)).json()
    expect(requests).not.toContain('/api/metrics')
    expect(requests).not.toContain('/api/docker')
})

test('VM pages still require a signed-in session', async ({ page }) => {
    await page.goto('/vms')
    await expect(page).toHaveURL(/\/login\?path=/)
})

test('verified system admins retain the system dashboard and private recovery metrics', async ({ context, page, baseURL }) => {
    test.skip(!process.env.VM_FIXTURE_API, 'Requires the VM fixture API')
    await context.addCookies(Object.entries({ id: 'admin-proof', access_token: 'local-admin-token', roles: '[]' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    await page.goto('/system')
    await expect(page.getByRole('region', { name: 'Service resilience' })).toBeVisible()
    const data = await (await page.request.get('/api/resilience')).json()
    expect(data.compute.memoryTotalBytes).toBe(123)
    expect(data.sites.inspur.compute.diskFreeBytes).toBe(456)
})


test('empty accounts only see Infrastructure Overview until their first VM is created', async ({ context, page, baseURL }) => {
    test.skip(!process.env.VM_FIXTURE_API, 'Requires the VM fixture API')
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: '[]' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    const rows: Array<{ name: string, owner: string, status: string, access_users: string[] }> = []
    await page.route('**/api/backend/vms/**', route => route.fulfill({ json: rows }))
    await page.route('**/api/vm', async route => {
        rows.push({ name: 'first-machine', owner: 'dashboard-render-proof-user', status: 'running', access_users: [] })
        await route.fulfill({ status: 201, json: rows[0] })
    })
    await page.goto('/system')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(page.getByText('0 managed targets', { exact: true })).toBeVisible()
    await expect(nav.locator('a[href="/system"]')).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Compute', exact: true })).toHaveCount(0)
    await expect(nav.locator('a[href="/vms"]')).toHaveCount(0)
    await page.getByLabel('VM name', { exact: true }).fill('first-machine')
    await page.getByRole('button', { name: 'Create VM', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'first-machine', exact: true })).toBeVisible()
    await nav.getByRole('button', { name: 'Compute', exact: true }).click()
    await expect(nav.locator('a[href="/vms"]')).toBeVisible()
    rows.length = 0
    await page.evaluate(() => window.dispatchEvent(new Event('vms-updated')))
    await expect(nav.getByRole('button', { name: 'Compute', exact: true })).toHaveCount(0)
    await expect(nav.locator('a[href="/system"]')).toBeVisible()
})
