import { expect, test } from '@playwright/test'

test('Managed appears only beside a share-provisioned VM', async ({ context, page, baseURL }) => {
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    await page.route('**/api/backend/vms/**', route => route.fulfill({ json: [
        { name: 'share-project', managed: true, status: 'running', access_users: [] },
        { name: 'standalone-vm', managed: false, status: 'running', access_users: [] },
    ] }))
    await page.goto('/vms')
    await expect(page.getByRole('heading', { name: 'share-project', exact: true })).toBeVisible()
    await expect(page.getByText('Managed', { exact: true })).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'share-project', exact: true }).locator('..')).toContainText('Managed')
    await expect(page.getByRole('heading', { name: 'standalone-vm', exact: true }).locator('..')).not.toContainText('Managed')
    await expect(page.getByText('2 virtual machines', { exact: true })).toBeVisible()
})
