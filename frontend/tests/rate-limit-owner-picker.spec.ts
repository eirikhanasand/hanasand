import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const adminId = process.env.PLAYWRIGHT_ADMIN_ID || 'dashboard-render-proof-user'
const adminName = process.env.PLAYWRIGHT_ADMIN_NAME || 'Rate Limit Owner Picker'
const adminToken = process.env.PLAYWRIGHT_ADMIN_TOKEN || 'local-dashboard-render-proof-token'
const adminExpiresAt = process.env.PLAYWRIGHT_ADMIN_EXPIRES_AT || new Date(Date.now() + 60 * 60 * 1000).toISOString()

test.describe('rate-limit owner picker', () => {
    test.describe.configure({ mode: 'serial' })

    test('selects users, keeps exact-ID fallback, and submits ownerId', async ({ page, context, baseURL }) => {
        const submittedPayloads: Array<Record<string, unknown>> = []

        await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
        await authenticateContext(context, {
            id: adminId,
            name: adminName,
            token: adminToken,
            expires_at: adminExpiresAt,
            roles: [{ id: 'administrator' }, { id: 'system_admin' }],
        }, baseURL || 'http://127.0.0.1:3000')

        await mockClientRateLimitRequests(page, submittedPayloads)
        const usersLoaded = page.waitForResponse((response) => response.url().includes('/api/users'))
        await page.goto('/dashboard/system/rate-limits', { waitUntil: 'domcontentloaded' })
        await usersLoaded

        await expect(page.getByRole('heading', { name: 'Tiered tokens' })).toBeVisible()
        await expect(page.getByRole('group', { name: 'Rate-limit workspace' })).toBeVisible()
        await expect(page.getByText('Choose an owner')).toBeVisible()
        await expect(page.getByText(/Global API pressure|now live in the same surface|Issue owner-linked keys|tuned independently/i)).toHaveCount(0)
        await expect(page.getByText('Owner user ID')).toHaveCount(0)

        await typeOwnerQuery(page, 'no-such-user')
        await expect(page.getByText('No matching users. Paste an exact ID to use it.')).toBeVisible()

        await fillDraftOwner(page, 'northwind', 'Blair Chen')
        await expect(page.getByText('Name the key')).toBeVisible()
        await page.getByLabel('Key name').first().fill('Blair integration')
        await page.getByRole('button', { name: 'Add first scope' }).click()
        await expect(page.getByText('Ready to issue')).toBeVisible()
        await page.getByRole('button', { name: 'Issue API key' }).click()
        await expect.poll(() => submittedPayloads.length).toBe(1)
        expect(submittedPayloads[0].ownerId).toBe('user_blair')

        await typeOwnerQuery(page, 'manual-owner-77')
        await expect(page.getByText('Using exact ID `manual-owner-77`')).toBeVisible()
        await page.getByLabel('Key name').first().fill('Manual integration')
        await page.getByRole('button', { name: 'Add first scope' }).click()
        await page.getByRole('button', { name: 'Issue API key' }).click()
        await expect.poll(() => submittedPayloads.length).toBe(2)
        expect(submittedPayloads[1].ownerId).toBe('manual-owner-77')
    })

    test('shows user loading errors and recovers on retry', async ({ page, context, baseURL }) => {
        let userAttempts = 0

        await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
        await authenticateContext(context, {
            id: adminId,
            name: adminName,
            token: adminToken,
            expires_at: adminExpiresAt,
            roles: [{ id: 'administrator' }, { id: 'system_admin' }],
        }, baseURL || 'http://127.0.0.1:3000')

        await page.route('**/api/users', async (route) => {
            userAttempts += 1
            if (userAttempts === 1) {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Unable to load users.' }),
                })
                return
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    { id: 'user_avery', name: 'Avery Stone', organization: 'Stone Labs', active: true },
                ]),
            })
        })

        const usersFailed = page.waitForResponse((response) => response.url().includes('/api/users') && response.status() === 500)
        await page.goto('/dashboard/system/rate-limits', { waitUntil: 'domcontentloaded' })
        await usersFailed
        const owner = page.getByRole('combobox', { name: 'Owner' }).first()
        await owner.click()
        await expect(page.getByText('Unable to load users.')).toBeVisible()
        await page.getByRole('button', { name: 'Retry' }).click()
        await owner.fill('stone')
        await expect(page.getByRole('option', { name: /Avery Stone/ })).toBeVisible()
    })
})

async function fillDraftOwner(page: Page, query: string, option: string) {
    await typeOwnerQuery(page, query)
    await page.getByRole('option', { name: new RegExp(option) }).click()
    await expect(page.getByText(new RegExp(`Selected ${option}`))).toBeVisible()
}

async function typeOwnerQuery(page: Page, query: string) {
    const owner = page.getByRole('combobox', { name: 'Owner' }).first()
    await owner.click()
    await owner.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await owner.press('Backspace')
    await owner.pressSequentially(query)
}

async function mockClientRateLimitRequests(page: Page, submittedPayloads: Array<Record<string, unknown>>) {
    await page.route('**/api/users', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 'user_avery', name: 'Avery Stone', email: 'avery@example.test', organization: 'Stone Labs', active: true },
                { id: 'user_blair', name: 'Blair Chen', email: 'blair@example.test', organization: 'Northwind', organization_ids: 'org_northwind', active: true },
            ]),
        })
    })

    await page.route('**/api/rate-limit/keys', async (route) => {
        if (route.request().method() !== 'POST') {
            await route.continue()
            return
        }

        const payload = route.request().postDataJSON() as Record<string, unknown>
        submittedPayloads.push(payload)
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                secret: `hs_test_${submittedPayloads.length}`,
                apiKey: {
                    id: `key_${submittedPayloads.length}`,
                    ownerId: payload.ownerId,
                    name: payload.name,
                    tier: payload.tier || 'starter',
                    description: payload.description || null,
                    enabled: payload.enabled !== false,
                    keyPrefix: 'hs_test',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    expiresAt: payload.expiresAt || null,
                    lastUsedAt: null,
                    scopes: payload.scopes || [],
                },
            }),
        })
    })
}

async function authenticateContext(context: BrowserContext, auth: {
    id: string
    name: string
    token: string
    expires_at: string
    roles?: Array<{ id: string } | string>
}, baseURL: string) {
    const expires = Math.floor(new Date(auth.expires_at).getTime() / 1000)
    const cookieUrl = new URL(baseURL).origin
    const secure = cookieUrl.startsWith('https://')

    await context.addCookies([
        { name: 'id', value: encodeURIComponent(auth.id), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'name', value: encodeURIComponent(auth.name), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'access_token', value: encodeURIComponent(auth.token), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(auth.roles || [])), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
    ])
}
