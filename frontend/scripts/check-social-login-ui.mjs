import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.SOCIAL_TEST_URL || 'http://127.0.0.1:3491'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 950 } })
try {
    await page.goto(`${base}/login?path=%2Fthesis`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Continue with Google', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Continue with Google', exact: true }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: 'Continue with Apple', exact: true }).count(), 0)
    assert.equal(await page.getByText('Awaiting provider setup', { exact: true }).count(), 1)
    assert.equal(await page.getByRole('button', { name: 'Log in', exact: true }).isEnabled(), true)
    await page.getByRole('button', { name: 'Sign in with passkey', exact: true }).waitFor()
    await page.getByRole('link', { name: 'Continue with SSO', exact: true }).waitFor()
    await page.screenshot({ path: '/tmp/social-login-desktop.png', fullPage: true })
    await page.route('**/api/auth/social/providers', route => route.fulfill({ json: { providers: [{ provider: 'google', configured: true }, { provider: 'apple', configured: true }] } }))
    await page.reload({ waitUntil: 'networkidle' })
    for (const provider of ['Google']) {
        const link = page.getByRole('link', { name: `Continue with ${provider}`, exact: true })
        await link.waitFor()
        assert.equal(await link.getAttribute('href'), `/api/auth/social/${provider.toLowerCase()}/start?redirectPath=%2Fthesis`)
    }
    assert.equal(await page.getByRole('link', { name: 'Continue with Apple', exact: true }).count(), 0)
    await page.goto(`${base}/login?socialError=Sign-in%20was%20cancelled.`, { waitUntil: 'networkidle' })
    await page.getByRole('alert').filter({ hasText: 'Sign-in was cancelled.' }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: '/tmp/social-login-mobile.png', fullPage: true })
    console.log('Login browser checks passed: unavailable/configured provider states, return path, cancellation, existing login/passkey/SSO controls and mobile fit.')
} finally { await browser.close() }
