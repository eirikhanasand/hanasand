import { expect, test } from '@playwright/test'

const apiBase = process.env.PLAYWRIGHT_API_BASE || 'http://127.0.0.1:8080/api'
const password = `Aa11!!${Date.now()}Bb22!!`

test('signup, login and delete account work end to end', async ({ page, request }) => {
    const id = `pw_${Date.now()}`
    const name = 'Playwright User'

    await page.goto('/register')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('Username').fill(id)
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name)
    await page.getByPlaceholder('Password').fill(password)
    const signupResponsePromise = page.waitForResponse(response => response.url().includes('/api/user') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Create account' }).click()
    const signupResponse = await signupResponsePromise
    expect(signupResponse.ok()).toBeTruthy()
    const signupBody = await signupResponse.json()
    const token = signupBody.token || ''
    expect(token.length).toBeGreaterThan(20)
    await expect(page).toHaveURL(/dashboard/)

    await page.goto('/logout')
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('Username').fill(id)
    await page.getByPlaceholder('Password').fill(password)
    const loginResponsePromise = page.waitForResponse(response => response.url().includes(`/api/auth/login/${id}`) && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Login' }).click()
    const loginResponse = await loginResponsePromise
    expect(loginResponse.ok()).toBeTruthy()
    await expect(page).toHaveURL(/dashboard/)

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
    expect(deletedLogin.status()).toBe(404)
})

test('login page rejects bad credentials without hanging', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('Username').fill(`missing_${Date.now()}`)
    await page.getByPlaceholder('Password').fill(password)
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page).toHaveURL(/login/)
    await expect(page.getByRole('button', { name: 'Login' })).toBeEnabled()
})
