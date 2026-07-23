import { expect, test } from '@playwright/test'
import { randomBytes } from 'node:crypto'

test('signed-in customer creates an organization key, runs the shown request, and revokes it', async ({ context, page, baseURL }) => {
    const origin = new URL(baseURL!)
    const issuedSecret = `hsk_${randomBytes(6).toString('hex')}_${randomBytes(24).toString('hex')}`
    const organization = { id: 'org-browser-proof', name: 'Browser Proof Security', role: 'owner', status: 'active' }
    const key = {
        id: 'key-browser-proof',
        organizationId: organization.id,
        name: 'Developer API',
        keyPrefix: issuedSecret.split('_')[1],
        enabled: true,
        expiresAt: '2026-10-21T10:00:00.000Z',
        lastUsedAt: null,
        scopes: Array.from({ length: 12 }, (_, index) => ({ method: index < 2 ? 'POST' : 'GET', route: `/api/v1/scope-${index}` })),
    }
    let organizations = [] as typeof organization[]
    let activeKey: typeof key | undefined
    const requests: Array<{ method: string, path: string }> = []

    await context.addCookies([
        { name: 'id', value: 'browser-proof-owner', url: origin.href },
        { name: 'access_token', value: 'browser-proof-session', url: origin.href },
    ])
    await page.route(url => new URL(url).pathname === '/api/organizations', async route => {
        requests.push({ method: route.request().method(), path: new URL(route.request().url()).pathname })
        organizations = [organization]
        await route.fulfill({ json: { organization } })
    })
    await page.route(url => new URL(url).pathname.startsWith('/api/backend/organizations'), async route => {
        const request = route.request()
        const path = new URL(request.url()).pathname
        requests.push({ method: request.method(), path })
        if (path === `/api/backend/organizations/${organization.id}/api-keys` && request.method() === 'POST') {
            activeKey = key
            await route.fulfill({ status: 201, json: { apiKey: key, secret: issuedSecret } })
            return
        }
        if (path === `/api/backend/organizations/${organization.id}/api-keys/${key.id}` && request.method() === 'DELETE') {
            activeKey = undefined
            await route.fulfill({ json: { apiKey: { ...key, enabled: false } } })
            return
        }
        if (path === `/api/backend/organizations/${organization.id}/api-keys`) {
            await route.fulfill({ json: { organizationId: organization.id, apiKeys: activeKey ? [activeKey] : [] } })
            return
        }
        await route.fulfill({ json: { organizations } })
    })

    await page.goto('/developers#api-access', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Organization, API key, first request.' })).toBeVisible()
    await page.getByLabel('Organization name').fill(organization.name)
    await page.getByRole('button', { name: 'Create organization' }).click()
    await expect(page.getByText('Organization created. Create its API key next.')).toBeVisible()

    await page.getByRole('button', { name: 'Create API key' }).click()
    await expect(page.getByText(issuedSecret, { exact: true })).toBeVisible()
    await expect(page.getByText(new RegExp(`X-API-Key: ${issuedSecret}`))).toBeVisible()
    await expect(page.getByText('12 read scopes')).toBeVisible()

    await page.getByRole('button', { name: 'Revoke key' }).click()
    await page.getByRole('button', { name: 'Confirm revoke' }).click()
    await expect(page.getByText('API key revoked. Calls using it now return invalid_api_key.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create API key' })).toBeVisible()

    expect(requests).toEqual(expect.arrayContaining([
        { method: 'POST', path: '/api/organizations' },
        { method: 'POST', path: `/api/backend/organizations/${organization.id}/api-keys` },
        { method: 'DELETE', path: `/api/backend/organizations/${organization.id}/api-keys/${key.id}` },
    ]))
})

test('signed-out customer gets direct registration and login choices instead of a sales contact', async ({ page }) => {
    await page.route(url => new URL(url).pathname === '/api/backend/organizations', route => route.fulfill({ status: 401, json: { error: 'Unauthorized.' } }))
    await page.goto('/developers#api-access', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Sign in to create a real key' })).toBeVisible()
    const alertsRow = page.getByRole('row').filter({ has: page.getByText('/alerts', { exact: true }) })
    await expect(alertsRow.getByText('API key', { exact: true })).toBeVisible()
    await expect(alertsRow.getByText('API key or session', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register?path=%2Fdevelopers%23api-access')
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login?path=%2Fdevelopers%23api-access')
    await expect(page.locator('#api-access').getByRole('link', { name: /contact|sales/i })).toHaveCount(0)
})
