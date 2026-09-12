import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'account-deletion-test-'))
    execFileSync('bun', ['build', 'tests/fixtures/account-deletion.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await page.route('http://account-deletion.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://account-deletion.test/', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' }))
})
test('email link restores only after confirmation and shows the password form', async ({ page }) => {
    let restores = 0
    let resets = 0
    await page.route('**/api/user/restore', async route => {
        restores++
        expect(route.request().postDataJSON().restoreToken).toBe('email-secret')
        await route.fulfill({ json: { id: 'recovery-user', name: 'Recovery User', token: 'session', resetToken: 'reset-secret', expires_at: '2030-01-01T00:00:00Z', roles: [] } })
    })
    await page.route('**/api/auth/password-reset/complete', async route => {
        resets++
        expect(route.request().postDataJSON()).toEqual({ id: 'recovery-user', resetToken: 'reset-secret', password: 'New-Password-2026!secure' })
        await route.fulfill({ json: { ok: true } })
    })
    await page.goto('http://account-deletion.test/#restoreToken=email-secret')
    await expect(page.getByRole('button', { name: 'Restore', exact: true })).toBeEnabled()
    expect(restores).toBe(0)
    expect(page.url()).not.toContain('email-secret')
    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    await expect(page.getByText('Your account has been restored.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Wasn’t you? Change your password.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Continue to dashboard' })).toHaveAttribute('href', '/dashboard')
    await page.getByLabel('New password', { exact: true }).fill('New-Password-2026!secure')
    await page.getByLabel('Confirm password').fill('different')
    await page.getByRole('button', { name: 'Set password' }).click()
    await expect(page.getByText('Passwords do not match.')).toBeVisible()
    expect(resets).toBe(0)
    await page.getByLabel('Confirm password').fill('New-Password-2026!secure')
    await page.getByRole('button', { name: 'Set password' }).click()
    await expect(page.getByText('Password updated. Redirecting to login.')).toBeVisible()
    expect(restores).toBe(1)
    expect(resets).toBe(1)
})

test('invalid links show an error without claiming the account was restored', async ({ page }) => {
    await page.route('**/api/user/restore', route => route.fulfill({ status: 400, json: { error: 'This account can no longer be restored from this link.' } }))
    await page.goto('http://account-deletion.test/#restoreToken=expired')
    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    await expect(page.getByText('This account can no longer be restored from this link.')).toBeVisible()
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
})

test('recovery remains usable while older API replicas finish a rolling deployment', async ({ page }) => {
    await page.route('**/api/user/restore', route => route.fulfill({ json: { id: 'recovery-user', name: 'Recovery User', token: 'session', expires_at: '2030-01-01T00:00:00Z', roles: [] } }))
    await page.goto('http://account-deletion.test/#restoreToken=email-secret')
    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    await expect(page).toHaveURL('http://account-deletion.test/dashboard')
})
