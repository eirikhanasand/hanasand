import assert from 'node:assert/strict'
import { chromium, expect as playwrightExpect } from '@playwright/test'

const expect = playwrightExpect.configure({ timeout: 30000 })

// Real Next pages and proxies, with an isolated API matching the production response shape.
const base = 'http://127.0.0.1:3029'
const organizations = [
    { id: 'cashflow', name: 'Cashflow', slug: 'cashflow', role: 'reader', lifecycleStatus: 'active' },
    { id: 'hanasand', name: 'Hanasand', slug: 'hanasand', role: 'owner', lifecycleStatus: 'active' },
    { id: 'research-norsk-tipping', name: 'Research - Norsk Tipping', slug: 'research-norsk-tipping', role: 'reader', lifecycleStatus: 'active' },
    { id: 'research-mnemonic', name: 'Research - mnemonic', slug: 'research-mnemonic', role: 'editor', lifecycleStatus: 'active' },
]
const calls = []
let settingsError = false
let destinationRemoved = false
const api = Bun.serve({ port: 0, async fetch(request) {
    const url = new URL(request.url)
    calls.push({ path: url.pathname, method: request.method })
    if (url.pathname.includes('/auth/token/')) return Response.json({ roles: [{ id: 'system_admin' }] })
    if (url.pathname.includes('/certificates/user/')) return Response.json([])
    if (url.pathname.includes('/user/')) {
        const id = url.pathname.split('/').pop()
        return Response.json({ id, username: id, name: id === 'dashboard-render-proof-user' ? 'Fixture owner' : 'Other person' })
    }
    if (url.pathname === '/api/organizations') {
        if (request.method === 'POST') {
            const { name } = await request.json()
            const organization = { id: 'created-org', name, slug: 'created-org', role: 'owner', lifecycleStatus: 'active' }
            organizations.push(organization)
            return Response.json({ organization }, { status: 201 })
        }
        return Response.json({ organizations })
    }
    if (url.pathname.startsWith('/api/dwm/webhook-destinations') && (url.searchParams.get('orgId') === 'research-mnemonic' || url.pathname.endsWith('/editor-target'))) {
        if (request.method === 'DELETE') { destinationRemoved = true; return Response.json({}) }
        return Response.json({ destinations: destinationRemoved ? [] : [{ id: 'editor-target', name: 'Editor target', kind: 'webhook', status: 'active', endpointHint: 'example.test', url: 'https://example.test/hook', events: ['dwm.alert.created'] }] })
    }
    const [, orgId, resource] = url.pathname.match(/^\/api\/organizations\/([^/]+)(?:\/([^/]+))?/) || []
    const organization = organizations.find(item => item.id === orgId)
    if (organization) {
        if (!resource) return Response.json({ organization })
        if (['api-keys', 'invites'].includes(resource) && organization.role === 'reader') return Response.json({ error: { message: 'Owner or admin required.' } }, { status: 403 })
        if (resource === 'settings') {
            if (settingsError) return Response.json({ error: { message: 'Settings temporarily unavailable.' } }, { status: 503 })
            if (request.method === 'PUT') {
                assert.equal(organization.role, 'owner')
                Object.assign(organization, await request.json())
            }
            return Response.json({ organization, settings: { retentionDays: 365, defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active' } })
        }
        if (resource === 'watchlists') return Response.json({ watchlistItems: [{ id: 'archived-watch', kind: 'domain', value: 'example.test', status: 'archived' }] })
        if (resource === 'members') return Response.json({ members: [
            { userId: 'dashboard-render-proof-user', name: 'Fixture user', role: organization.role, status: 'active' },
            { userId: 'teammate-one', name: 'First teammate', role: organization.role === 'owner' ? 'reader' : 'owner', status: 'active' },
            { userId: 'teammate-two', name: 'Second teammate', role: 'reader', status: 'active' },
        ] })
    }
    return Response.json({})
} })
const dev = Bun.spawn(['node', './node_modules/.bin/next', 'dev', '--webpack', '-p', '3029'], {
    env: { ...process.env, FRONTEND_AUTH_API: `${api.url}api`, FRONTEND_INTERNAL_API: `${api.url}api`, TI_SCRAPER_API_BASE: String(api.url), NEXT_DIST_DIR: '.next/organization-pages' },
    stdout: 'ignore', stderr: 'inherit',
})
let browser
try {
    for (let attempt = 0; attempt < 120; attempt++) {
        if (dev.exitCode !== null) throw new Error('Test frontend failed to start')
        if (await fetch(base).then(() => true).catch(() => false)) break
        await Bun.sleep(500)
    }
    browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' } })
    await context.addCookies(Object.entries({
        id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: '["system_admin"]',
        hanasand_workspace: JSON.stringify({ userId: 'dashboard-render-proof-user', organizationId: 'cashflow', name: 'Cashflow' }),
    }).map(([name, value]) => ({ name, value, url: base })))
    const page = await context.newPage()
    page.setDefaultTimeout(20000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/organizations/settings`)
    console.log('Opened Reader settings')
    const name = page.locator('#settings').getByLabel('Name', { exact: true })
    await expect(name).toHaveValue('Cashflow')
    await expect(name).toBeDisabled()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true, level: 1 })).toBeVisible()
    await expect(page.getByText('Read-only organization policy.', { exact: true })).toHaveCount(0)
    await expect(page.locator('[data-org-workspace-summary]')).not.toContainText('cashflow · cashflow')
    assert.equal((await page.locator('[data-org-workspace-summary]').innerText()).match(/cashflow/gi)?.length, 1)
    await page.getByRole('navigation', { name: 'Organization pages' }).getByRole('link', { name: 'Team', exact: true }).click()
    await expect(page.locator('[data-org-member-status-counts]')).toHaveText('Active: 3Owner: 1Reader: 2')
    await expect(page.locator('[data-org-member-access-state]')).toHaveCount(0)
    for (const button of await page.getByRole('button', { name: 'Remove member', exact: true }).all()) await expect(button).toBeDisabled()
    await page.screenshot({ path: '/tmp/organization-team-desktop.png', fullPage: true })
    await page.getByRole('navigation', { name: 'Organization pages' }).getByRole('link', { name: 'Destinations', exact: true }).click()
    await expect(page.getByText('Maintainers can add destinations', { exact: true })).toBeVisible()
    await expect(page.getByText('Inventory, tests, and removal stay available after a destination is saved.', { exact: true })).toHaveCount(0)
    await page.getByRole('navigation', { name: 'Organization pages' }).getByRole('link', { name: 'Settings', exact: true }).click()
    await expect(name).toHaveValue('Cashflow')
    console.log('Verified Reader settings')
    await expect(page.getByText('Organization name is required.', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/Sign in with an organization account/)).toHaveCount(0)
    assert(!calls.some(call => /\/cashflow\/(api-keys|invites)/.test(call.path)), 'Members must not request management-only resources')
    await page.getByRole('combobox', { name: 'Org', exact: true }).selectOption('hanasand')
    await expect(name).toHaveValue('Hanasand')
    await expect(name).toBeEnabled()
    console.log('Verified owner settings')
    assert(calls.some(call => call.path.endsWith('/hanasand/api-keys')))
    assert(calls.some(call => call.path.endsWith('/hanasand/invites')))
    await name.fill('')
    await expect(page.getByText('Organization name is required.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save settings', exact: true })).toBeDisabled()
    await name.fill('Hanasand updated')
    await page.getByRole('button', { name: 'Save settings', exact: true }).click()
    await expect(page.getByText('Organization settings updated.', { exact: true }).first()).toBeVisible()
    await page.reload()
    await expect(name).toHaveValue('Hanasand updated')
    assert.equal(organizations[1].name, 'Hanasand updated')
    console.log('Verified save and reload')

    const nav = page.getByRole('navigation', { name: 'Organization pages' })
    for (const [label, selector] of [['Team', '#members'], ['Watchlists', '#watchlists'], ['Destinations', '#destinations'], ['API keys', '#mill-api-key'], ['Privacy & retention', '#privacy'], ['Delivery history', '#delivery-history'], ['Alerts & cases', '[data-org-scope-empty], [data-org-scope-records]'], ['Activity', '#audit']]) {
        console.log('Checking section:', label)
        await nav.getByRole('link', { name: label, exact: true }).click()
        await expect(page.locator(selector)).toBeVisible()
        await expect(page.locator('#settings')).toHaveCount(0)
        await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page')
    }
    await nav.getByRole('link', { name: 'Overview', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Overview', exact: true, level: 2 })).toBeVisible()
    await expect(page.getByText('Pilot measurement', { exact: true })).toHaveCount(0)
    await expect(page.locator('#privacy, #settings, #members, #watchlists')).toHaveCount(0)
    const createButton = page.getByRole('button', { name: 'Create organization', exact: true })
    const refreshButton = page.getByRole('button', { name: 'Refresh', exact: true })
    assert(await createButton.evaluate((element) => element.parentElement.contains([...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Refresh'))))
    await expect(refreshButton).toBeVisible()
    await createButton.click()
    const createForm = page.locator('#org-create-primary')
    await expect(createForm.getByLabel('Name', { exact: true })).toBeFocused()
    await createForm.getByLabel('Name', { exact: true }).fill('Cashflow')
    await expect(createForm.getByRole('button', { name: 'Create organization', exact: true })).toBeDisabled()
    await page.locator('header').getByRole('button', { name: 'Create organization', exact: true }).click()
    await expect(createForm).toHaveCount(0)
    await page.screenshot({ path: '/tmp/organization-overview-desktop.png', fullPage: true })
    for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`)
        const research = page.getByRole('button', { name: /^Research - Norsk Tipping Reader/ })
        await expect(research).toBeVisible()
        assert(await research.evaluate(button => {
            const bounds = button.getBoundingClientRect()
            const panel = button.closest('section').getBoundingClientRect()
            const badge = button.firstElementChild.querySelector('span')
            const badgeBounds = badge.getBoundingClientRect()
            return bounds.right <= panel.right && button.scrollWidth <= button.clientWidth
                && badgeBounds.right <= bounds.right && badgeBounds.height <= 18
                && Number.parseFloat(getComputedStyle(badge).fontSize) <= 10
        }), `Workspace name and compact role must fit at ${width}`)
        if (width === 1440 || width === 390) await page.screenshot({ path: `/tmp/organization-sidebar-${width}.png`, fullPage: true })
    }
    await page.getByRole('combobox', { name: 'Org', exact: true }).selectOption('research-mnemonic')
    await nav.getByRole('link', { name: 'Destinations', exact: true }).click()
    const removeDestination = page.getByRole('button', { name: 'Remove destination', exact: true })
    await expect(removeDestination).toBeEnabled()
    await removeDestination.click()
    await page.getByRole('button', { name: 'Confirm remove destination', exact: true }).click()
    await expect(page.getByText('Editor target destination removed.', { exact: true }).first()).toBeVisible()
    assert(destinationRemoved, 'Editor removal must reach the API')
    await page.reload()
    await expect(removeDestination).toHaveCount(0)
    await nav.getByRole('link', { name: 'Watchlists', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Cleanup archived', exact: true })).toBeDisabled()
    await nav.getByRole('link', { name: 'Settings', exact: true }).click()
    await expect(name).toBeDisabled()
    await nav.getByRole('link', { name: 'Team', exact: true }).click()
    for (const button of await page.getByRole('button', { name: 'Remove member', exact: true }).all()) await expect(button).toBeDisabled()
    await page.getByRole('combobox', { name: 'Org', exact: true }).selectOption('hanasand')
    await nav.getByRole('link', { name: 'Settings', exact: true }).click()
    await expect(name).toHaveValue('Hanasand updated')
    await page.goto(`${base}/organizations?focus=members`)
    await expect(page.locator('#members')).toBeVisible()
    await page.goto(`${base}/organizations/settings`)
    await expect(name).toHaveValue('Hanasand updated')
    await page.screenshot({ path: '/tmp/organization-settings-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '/tmp/organization-settings-mobile.png', fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole('combobox', { name: 'Org', exact: true }).selectOption('cashflow')
    await expect(name).toHaveValue('Cashflow')
    await expect(name).toBeDisabled()
    console.log('Verified Reader settings')
    settingsError = true
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByText(/Organization service is temporarily unavailable/)).toBeVisible()
    settingsError = false

    await page.goto(`${base}/profile/dashboard-render-proof-user`)
    const accountNav = page.getByRole('navigation', { name: 'Account pages' })
    await expect(accountNav).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Certificates', exact: true })).toHaveCount(0)
    await accountNav.getByRole('link', { name: 'Certificates', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Certificates', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sessions', exact: true })).toHaveCount(0)
    const sidebar = page.getByRole('complementary', { name: 'Dashboard sidebar' })
    await expect(sidebar.getByRole('button', { name: 'Account', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('button', { name: 'Organization', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('button', { name: 'Account & organization', exact: true })).toHaveCount(0)
    await page.goto(`${base}/profile/other-person/security`)
    await expect(page.getByRole('navigation', { name: 'Account pages' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Delete account', exact: true })).toHaveCount(0)
    await page.goto(`${base}/organizations`)
    await page.getByRole('button', { name: 'Create organization', exact: true }).click()
    await createForm.getByLabel('Name', { exact: true }).fill('Created organization')
    await createForm.getByRole('button', { name: 'Create organization', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Org', exact: true })).toHaveValue('created-org')
    await expect(createForm).toHaveCount(0)
    assert.equal(organizations.find(item => item.id === 'created-org')?.name, 'Created organization')
    assert.deepEqual(errors, [])
    console.log('Organization pages passed: Reader/owner permissions, name validation and persistence, switching, all section routes, legacy links, responsive layout, real errors, and separate private account pages.')
} finally {
    await browser?.close()
    dev.kill()
    await dev.exited
    api.stop(true)
}
