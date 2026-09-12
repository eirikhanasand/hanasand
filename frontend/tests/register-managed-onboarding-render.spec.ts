import { expect, test } from '@playwright/test'

test('legacy signup links open one signup form with required email', async ({ page }) => {
    await page.route('**/api/auth/register', async route => {
        const fields = new URLSearchParams(route.request().postData() || '')
        expect(fields.get('email')).toBe('signup@example.test')
        expect(fields.get('redirectPath')).toBe('/developers#api-access')
        await route.fulfill({ contentType: 'text/html', body: 'Signup submitted once' })
    })
    await page.goto('/register?path=%2Fdevelopers%23api-access')
    await expect(page).toHaveURL(/\/login\?mode=signup/)
    await expect(page.getByText('Enterprise onboarding', { exact: true })).toHaveCount(0)
    const form = page.locator('form[action="/api/auth/register"]')
    await expect(form).toHaveCount(1)
    await form.getByLabel('Username', { exact: true }).fill('signup-example')
    await form.getByLabel('Name', { exact: true }).fill('Signup Example')
    await form.getByLabel('Password', { exact: true }).fill('Test-password-12345!')
    await expect(form.getByRole('button', { name: 'Create account', exact: true })).toBeDisabled()
    await expect(form.getByLabel('Email', { exact: true })).toHaveAttribute('required', '')
    await form.getByLabel('Email', { exact: true }).fill('signup@example.test')
    await form.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page.getByText('Signup submitted once')).toBeVisible()
})

test('signup errors remain on the single form with the intended destination', async ({ page }) => {
    await page.goto('/login?mode=signup&error=Username%20already%20exists&path=%2Forganizations')
    await expect(page.getByText('Username already exists', { exact: true })).toBeVisible()
    await expect(page.locator('form[action="/api/auth/register"] input[name="redirectPath"]')).toHaveValue('/organizations')
})
