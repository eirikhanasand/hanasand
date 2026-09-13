import { expect, test } from '@playwright/test'

test('legacy signup links open one signup form with required email', async ({ page }) => {
    let requests = 0
    await page.route('**/api/auth/register', async route => {
        requests++
        const fields = route.request().postDataJSON()
        expect(fields.email).toBe('signup@example.test')
        if (requests === 1 || requests === 3) {
            expect(fields.code).toBeUndefined()
            await route.fulfill({ status: 202, json: { verificationRequired: true, challengeId: `challenge-${requests}` } })
        } else if (requests === 2) {
            expect(fields.code).toBe('111111')
            await route.fulfill({ status: 400, json: { error: 'The code is incorrect or expired.' } })
        } else {
            expect(fields.code).toBe('123456')
            expect(fields.challengeId).toBe('challenge-3')
            await route.fulfill({ json: { id: 'signup-example' } })
        }
    })
    await page.route('**/developers', route => route.fulfill({ contentType: 'text/html', body: 'Signed in' }))
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
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    const firstDigit = page.getByRole('textbox', { name: 'Verification code digit 1', exact: true })
    await expect(page.getByRole('textbox', { name: /Verification code digit/ })).toHaveCount(6)
    await firstDigit.fill('111111')
    await expect(page.getByText('The code is incorrect or expired.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Resend code' }).click()
    await expect.poll(() => requests).toBe(3)
    await expect(page.getByRole('status')).toContainText('A new code has been sent')
    await firstDigit.fill('123456')
    await expect(page).toHaveURL(/\/developers#api-access$/)
    expect(requests).toBe(4)
})

test('signup errors remain on the single form with the intended destination', async ({ page }) => {
    await page.goto('/login?mode=signup&error=Username%20already%20exists&path=%2Forganizations')
    await expect(page.getByText('Username already exists', { exact: true })).toBeVisible()
    await expect(page.locator('form[action="/api/auth/register"] input[name="redirectPath"]')).toHaveValue('/organizations')
})


test('initial send and resend failures stay visible and both can be retried', async ({ page }) => {
    let requests = 0
    await page.route('**/api/auth/register', async route => {
        requests++
        if (requests === 1 || requests === 3) {
            await route.fulfill({ status: 503, json: { error: 'We could not send the verification email. Please try again shortly.' } })
        } else {
            await route.fulfill({ status: 202, json: { verificationRequired: true, challengeId: `challenge-${requests}` } })
        }
    })
    await page.goto('/login?mode=signup')
    await expect(page.getByText('We’ll email you a six-digit code', { exact: false })).toBeVisible()
    const form = page.locator('form[action="/api/auth/register"]')
    await form.getByLabel('Username', { exact: true }).fill('signup-example')
    await form.getByLabel('Name', { exact: true }).fill('Signup Example')
    await form.getByLabel('Email', { exact: true }).fill('signup@example.test')
    await form.getByLabel('Password', { exact: true }).fill('Test-password-12345!')
    await form.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page.locator('p[role=alert]')).toContainText('could not send')
    await form.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await page.getByRole('button', { name: 'Resend code' }).click()
    await expect(page.locator('p[role=alert]')).toContainText('could not send')
    await page.getByRole('button', { name: 'Resend code' }).click()
    await expect(page.locator('p[role=alert]')).toHaveCount(0)
    await expect(page.getByRole('status')).toContainText('A new code has been sent')
    expect(requests).toBe(4)
})
