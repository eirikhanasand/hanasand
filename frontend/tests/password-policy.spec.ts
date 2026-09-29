import { test, expect } from '@playwright/test'

test('password reset keeps its verified token through client-side navigation without a token URL', async({ page }) => {
    const resetToken = 'reset-flow-test-token'
    let completedReset: Record<string, unknown> | null = null

    await page.route('**/auth/password-reset/request', route => route.fulfill({ json: { ok: true } }))
    await page.route('**/auth/password-reset/verify', route => route.fulfill({ json: { ok: true, resetToken } }))
    await page.route('**/auth/password-reset/complete', async route => {
        completedReset = route.request().postDataJSON()
        return route.fulfill({ json: { ok: true } })
    })

    await page.goto('/login')
    await page.getByRole('button', { name: 'Reset password', exact: true }).click()
    await page.locator('#login-reset-username').fill('policytest')
    await page.getByRole('button', { name: 'Send code', exact: true }).click()
    for (const [index, digit] of '123456'.split('').entries()) {
        await page.getByLabel(`Reset code digit ${index + 1}`).fill(digit)
    }

    await expect(page.getByRole('heading', { name: 'New password', exact: true })).toBeVisible()
    await expect(page.getByText('This reset link is missing or expired.', { exact: true })).toHaveCount(0)
    expect(new URL(page.url()).hash).toBe('')
    expect(page.url()).not.toContain(resetToken)
    await page.getByLabel('New password', { exact: true }).fill('Abcdefghijklmn1!')
    await page.getByLabel('Confirm password', { exact: true }).fill('Abcdefghijklmn1!')
    await page.getByRole('button', { name: 'Set password', exact: true }).click()
    await expect.poll(() => completedReset).toEqual({ id: 'policytest', resetToken, password: 'Abcdefghijklmn1!' })
})

test('signup and reset accept one of each character type and reject missing types', async({ page }) => {
    test.skip(process.env.PASSWORD_POLICY_TEST !== '1', 'Requires a local frontend.')
    await page.route('**/api/auth/register', route => route.fulfill({ status: 202, json: { verificationRequired: true, challengeId: 'policy-test' } }))
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()
    const form = page.locator('form[action="/api/auth/register"]')
    await form.getByLabel('Username', { exact: true }).fill('policytest')
    await form.getByLabel('Name', { exact: true }).fill('Policy test')
    await form.getByLabel('Email', { exact: true }).fill('policy@example.test')
    for (const value of ['Shortpass1!', 'abcdefghijklmn1!', 'ABCDEFGHIJKLMN1!', 'Abcdefghijklmnop!', 'Abcdefghijklmnop1']) {
        await form.getByLabel('Password', { exact: true }).fill(value)
        await expect(form.getByRole('button', { name: 'Create account', exact: true })).toBeDisabled()
    }
    await expect(form).toContainText('one uppercase letter')
    await form.getByLabel('Password', { exact: true }).fill('Abcdefghijklmn1!')
    await expect(form.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled()
    await form.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Check your email', exact: true })).toBeVisible()
    await page.goto('/register')
    const signup = page.locator('form[action="/api/auth/register"]')
    await signup.locator('[name=username]').fill('policytest')
    await signup.locator('[name=name]').fill('Policy test')
    await signup.getByLabel('Email', { exact: true }).fill('policy@example.test')
    await signup.locator('[name=password]').fill('Abcdefghijklmn1!')
    await signup.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Check your email', exact: true })).toBeVisible()
    let resetSubmitted = false
    await page.route('**/auth/password-reset/complete', route => { resetSubmitted = true; return route.fulfill({ json: { ok: true } }) })
    await page.goto('/reset-password?id=policytest#token=test-only-token')
    await page.getByPlaceholder('New password', { exact: true }).fill('Abcdefghijklmnop1')
    await page.getByPlaceholder('Confirm password', { exact: true }).fill('Abcdefghijklmnop1')
    await page.getByRole('button', { name: 'Set password', exact: true }).click()
    await expect(page.getByText('Use at least 16 characters, including one uppercase letter, one lowercase letter, one number, and one special character.', { exact: true })).toBeVisible()
    expect(resetSubmitted).toBe(false)
    await page.getByPlaceholder('New password', { exact: true }).fill('Abcdefghijklmn1!')
    await page.getByPlaceholder('Confirm password', { exact: true }).fill('Abcdefghijklmn1!')
    await page.getByRole('button', { name: 'Set password', exact: true }).click()
    await expect.poll(() => resetSubmitted).toBe(true)
})
