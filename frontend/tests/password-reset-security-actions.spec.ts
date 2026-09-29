import { expect, test } from '@playwright/test'

test('the security email lock link requires confirmation and locks after a POST', async({ page }) => {
    let lockRequests = 0
    let submittedToken = ''
    await page.route('**/auth/password-reset/lock-account', async route => {
        lockRequests += 1
        submittedToken = route.request().postDataJSON().token
        await route.fulfill({ json: { ok: true } })
    })

    await page.goto('/secure-account#token=lock-action-test')
    await expect(page.getByRole('heading', { name: 'Wasn’t you? Lock your account.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lock account', exact: true })).toBeVisible()
    expect(lockRequests).toBe(0)
    expect(page.url()).not.toContain('lock-action-test')

    await page.getByRole('button', { name: 'Lock account', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your account is locked' })).toBeVisible()
    expect(lockRequests).toBe(1)
    expect(submittedToken).toBe('lock-action-test')
})

test('the email reset action opens the new-password form without exposing its token in the URL', async({ page }) => {
    let resetRequests = 0
    let submittedToken = ''
    await page.route('**/auth/password-reset/start-again', async route => {
        resetRequests += 1
        submittedToken = route.request().postDataJSON().token
        await route.fulfill({ json: { ok: true, id: 'resetuser', resetToken: 'new-reset-session-token' } })
    })

    await page.goto('/reset-password-again#token=reset-action-test')
    await expect(page.getByRole('heading', { name: 'Reset your password again' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue to new password' })).toBeVisible()
    expect(resetRequests).toBe(0)
    expect(page.url()).not.toContain('reset-action-test')

    await page.getByRole('button', { name: 'Continue to new password' }).click()
    await expect(page.getByLabel('New password')).toBeVisible()
    expect(resetRequests).toBe(1)
    expect(submittedToken).toBe('reset-action-test')
    expect(page.url()).not.toContain('new-reset-session-token')
})
