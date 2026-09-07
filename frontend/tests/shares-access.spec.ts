import { expect, test } from '@playwright/test'

test('ordinary members can open Shares through either route and Content navigation', async ({ context, page, baseURL }) => {
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies(Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: '[]' }).map(([name, value]) => ({ name, value, url: baseURL! })))
    for (const route of ['/shares', '/dashboard/shares']) {
        await page.goto(route)
        await expect(page.getByRole('heading', { name: 'Shares', exact: true }).first()).toBeVisible()
        await expect(page.getByText('Personal test share', { exact: true }).first()).toBeVisible()
        const nav = page.getByRole('navigation', { name: 'Main navigation' })
        await expect(nav.getByRole('link', { name: 'Shares', exact: true })).toHaveAttribute('href', '/shares')
        await expect(nav.getByRole('link', { name: 'Content Management', exact: true })).toHaveCount(0)
        await expect(nav.getByRole('link', { name: 'Database', exact: true })).toHaveCount(0)
    }
})

test('signed-out visitors still need to sign in', async ({ page }) => {
    await page.goto('/shares')
    await expect(page).toHaveURL(/\/login\?path=/)
})
