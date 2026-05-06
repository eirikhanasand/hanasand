import { expect, test } from '@playwright/test'

const apiBase = process.env.PLAYWRIGHT_API_BASE || 'http://127.0.0.1:8080/api'
const password = `Aa11!!${Date.now()}Bb22!!`

test('signup, login and delete account work end to end', async ({ browser, page, request, baseURL }) => {
    const id = `pw_${Date.now()}`
    const name = 'Playwright User'

    await page.goto('/register')
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
    await page.getByPlaceholder('Username').fill(id)
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name)
    await page.getByPlaceholder('Password').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/dashboard/)

    const loginContext = await browser.newContext({ baseURL })
    const loginPage = await loginContext.newPage()
    await loginPage.goto('/login')
    await expect(loginPage.getByRole('button', { name: 'Log in' })).toBeVisible()
    await loginPage.getByPlaceholder('Username').fill(id)
    await loginPage.getByPlaceholder('Password').fill(password)
    await loginPage.getByRole('button', { name: 'Log in' }).click()
    await expect(loginPage).toHaveURL(/dashboard/)
    await loginContext.close()

    const deleteId = `pw_delete_${Date.now()}`
    const createForDelete = await request.post(`${apiBase}/user`, {
        data: { id: deleteId, name: 'Delete Me', password },
    })
    expect(createForDelete.ok()).toBeTruthy()
    const deleteToken = (await createForDelete.json()).token
    expect(deleteToken.length).toBeGreaterThan(20)

    const deletion = await request.delete(`${apiBase}/user/self`, {
        headers: {
            Authorization: `Bearer ${decodeURIComponent(deleteToken)}`,
            id: deleteId,
            'Content-Type': 'application/json',
        },
        data: { id: deleteId },
    })
    expect(deletion.ok()).toBeTruthy()

    const deletedLogin = await request.post(`${apiBase}/auth/login/${deleteId}`, {
        data: { password },
    })
    expect(deletedLogin.status()).toBe(423)
    const pending = await deletedLogin.json()
    expect(pending.pending_deletion).toBe(true)
    expect(pending.restore_token.length).toBeGreaterThan(20)

    const restored = await request.post(`${apiBase}/user/restore`, {
        data: { id: deleteId, restoreToken: pending.restore_token },
    })
    expect(restored.ok()).toBeTruthy()
    const restoredBody = await restored.json()
    expect(restoredBody.token.length).toBeGreaterThan(20)
})

test('login page rejects bad credentials without hanging', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
    await page.getByPlaceholder('Username').fill(`missing_${Date.now()}`)
    await page.getByPlaceholder('Password').fill(password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/login/)
    await expect(page.getByRole('button', { name: 'Log in' })).toBeEnabled()
})

test('login page can switch to signup', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})
