import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'https://hanasand.com'
const apiBase = process.env.PLAYWRIGHT_API_BASE || 'https://api.hanasand.com/api'
const adminId = process.env.PLAYWRIGHT_ADMIN_ID || ''
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || ''
const adminName = process.env.PLAYWRIGHT_ADMIN_NAME || 'Live Admin Smoke'
const adminToken = process.env.PLAYWRIGHT_ADMIN_TOKEN || ''
const adminExpiresAt = process.env.PLAYWRIGHT_ADMIN_EXPIRES_AT || new Date(Date.now() + 60 * 60 * 1000).toISOString()
const hasAdminToken = Boolean(adminToken && adminId)
const hasAdminLoginCredentials = Boolean(adminId && adminPassword)

type AuthPayload = {
    id: string
    name: string
    token: string
    expires_at: string
    roles?: Array<{ id: string }>
}

test.describe('live admin smoke', () => {
    test.setTimeout(180_000)
    test.skip(!hasAdminToken && !hasAdminLoginCredentials, 'Live admin smoke needs PLAYWRIGHT_ADMIN_TOKEN with PLAYWRIGHT_ADMIN_ID or explicit PLAYWRIGHT_ADMIN_ID/PLAYWRIGHT_ADMIN_PASSWORD.')

    test('dashboard vulnerabilities loads and profile VM action stays healthy', async ({ browser, request }) => {
        const auth = hasAdminToken
            ? {
                id: adminId,
                name: adminName,
                token: adminToken,
                expires_at: adminExpiresAt,
                roles: [{ id: 'administrator' }, { id: 'system_admin' }, { id: 'user_admin' }, { id: 'users' }],
            } satisfies AuthPayload
            : await loginAsAdmin(request)

        const context = await browser.newContext({ baseURL })
        try {
            await authenticateContext(context, auth, baseURL)
            const page = await context.newPage()

            await page.goto('/dashboard/vulnerabilities', { waitUntil: 'domcontentloaded' })
            await expect(page).toHaveURL(/\/dashboard\/vulnerabilities/)
            await expect(page.locator('main').getByRole('heading', { name: 'Vulnerabilities' }).first()).toBeVisible()
            await expect(page.getByText('Failed to load vulnerability report')).toHaveCount(0)
            await expect(page.getByText(/401 Unauthorized/i)).toHaveCount(0)
            await expect(page.getByText('Showing 0 of 0 images')).toHaveCount(0)
            await expect(page.getByText('No matches found')).toHaveCount(0)
            await expect(page.getByText(/unknown flag: --format/i)).toHaveCount(0)

            await page.goto('/dashboard/management', { waitUntil: 'domcontentloaded' })
            await expect(page).toHaveURL(/\/dashboard\/management/)
            await expect(page.getByRole('heading', { name: 'User management', exact: true })).toBeVisible()
            const managementHasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
            expect(managementHasHorizontalOverflow).toBeFalsy()

            await page.goto('/role/system_admin', { waitUntil: 'domcontentloaded' })
            await expect(page).toHaveURL(/\/role\/system_admin/)
            await expect(page.getByRole('heading', { name: 'System Administrator', exact: true })).toBeVisible()
            const rolePageHasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
            expect(rolePageHasHorizontalOverflow).toBeFalsy()

            await page.goto(`/profile/${adminId}`, { waitUntil: 'networkidle' })
            await expect(page).toHaveURL(new RegExp(`/profile/${adminId}$`))

            const vmCard = page.locator('section').filter({ hasText: 'Virtual Machines' })
            await expect(vmCard).toBeVisible()

            const playButton = vmCard.locator('button').filter({ has: page.locator('svg.lucide-play') }).first()
            if (await playButton.count()) {
                await playButton.click()
                await expect(page.getByText(/Bad Request/i)).toHaveCount(0)
                await expect(page.getByText(/Please log in to manage VMs/i)).toHaveCount(0)
            }
        } finally {
            await context.close()
        }
    })
})

async function authenticateContext(context: BrowserContext, auth: AuthPayload, appBaseUrl: string) {
    const expires = Math.floor(new Date(auth.expires_at).getTime() / 1000)
    const cookieUrl = new URL(appBaseUrl).origin
    const secure = cookieUrl.startsWith('https://')

    await context.addCookies([
        { name: 'id', value: encodeURIComponent(auth.id), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'name', value: encodeURIComponent(auth.name), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'access_token', value: encodeURIComponent(auth.token), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(auth.roles || [])), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
    ])
}

async function loginAsAdmin(request: APIRequestContext) {
    test.skip(!hasAdminLoginCredentials, 'Live admin smoke needs explicit PLAYWRIGHT_ADMIN_ID/PLAYWRIGHT_ADMIN_PASSWORD.')

    const loginResponse = await request.post(`${apiBase}/auth/login/${adminId}`, {
        data: { password: adminPassword },
    })
    test.skip(!loginResponse.ok(), 'Live admin smoke needs PLAYWRIGHT_ADMIN_TOKEN or valid PLAYWRIGHT_ADMIN_ID/PLAYWRIGHT_ADMIN_PASSWORD.')
    return await loginResponse.json() as AuthPayload
}
