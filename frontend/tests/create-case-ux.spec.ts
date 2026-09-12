import { expect, test } from '@playwright/test'

test('create case preserves scope, validation and retry identity, then opens the case', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3217'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([{ name: 'id', value: 'dashboard-render-proof-user', url: origin }, { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin }])
    const requests: Record<string, unknown>[] = []
    await page.route('**/api/cases?**', async route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: { items: [] } })
        expect(new URL(route.request().url()).searchParams.get('organizationId')).toBe('org')
        requests.push(route.request().postDataJSON())
        if (requests.length === 1) return route.fulfill({ status: 503, json: { error: { message: 'Case service is temporarily unavailable.' } } })
        return route.fulfill({ status: 201, json: { case: { id: 'manual-created' } } })
    })
    await page.route('**/api/cases/manual-created?**', route => route.fulfill({ status: 404, json: { error: { message: 'Fixture stops at navigation.' } } }))
    await page.goto('/cases?organizationId=org')
    await page.getByRole('button', { name: 'Create case', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Create case' })
    await expect(dialog.getByLabel('Title', { exact: true })).toBeFocused()
    await expect(dialog.getByRole('button', { name: 'Create case', exact: true })).toBeDisabled()
    await dialog.getByLabel('Title', { exact: true }).fill('Investigate failed deployment')
    await dialog.getByLabel('Description', { exact: true }).fill('Check the release logs.')
    await dialog.getByLabel('Severity', { exact: true }).selectOption('high')
    await dialog.getByRole('button', { name: 'Create case', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable')
    await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Investigate failed deployment')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '/tmp/create-case-mobile.png', fullPage: true })
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await dialog.getByRole('button', { name: 'Create case', exact: true }).click()
    await expect(page).toHaveURL(/\/cases\/manual-created\?organizationId=org$/)
    expect(requests[0]).toEqual(requests[1])
    expect(requests[0]).toMatchObject({ sourceType: 'manual', title: 'Investigate failed deployment', summary: 'Check the release logs.', priority: 'high' })
})
