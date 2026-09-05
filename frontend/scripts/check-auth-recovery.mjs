import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import { NextRequest } from 'next/server'
import { chromium } from '@playwright/test'

let healthy = false
mock.module('@/utils/proxy/tokenIsValid', () => ({
    default: async () => ({ valid: healthy, state: healthy ? 'valid' : 'unavailable', roles: [] }),
}))
const { proxy } = await import('../src/proxy.ts')
const server = Bun.serve({ port: 0, async fetch(request) {
    const result = await proxy(new NextRequest(request))
    return result.headers.get('x-middleware-next') === '1' || result.headers.has('x-middleware-rewrite')
        ? new Response('<h1>Verified session restored</h1>', { headers: { 'content-type': 'text/html' } })
        : result
} })
const browser = await chromium.launch()
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.context().addCookies([
        { name: 'id', value: 'test-user', url: server.url.href },
        { name: 'access_token', value: 'local-test-token', url: server.url.href },
    ])
    const target = `${server.url}content/thesis?view=history`
    const response = await page.goto(target)
    assert.equal(response.status(), 503)
    await page.getByRole('heading', { name: 'Reconnecting your session' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Verified session restored' }).count(), 0)
    assert.equal(await page.getByRole('link', { name: 'Try again now' }).getAttribute('href'), '/content/thesis?view=history')
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    if (process.env.AUTH_RECOVERY_SCREENSHOT) await page.screenshot({ path: process.env.AUTH_RECOVERY_SCREENSHOT })
    healthy = true
    await page.getByRole('heading', { name: 'Verified session restored' }).waitFor({ timeout: 8000 })
    assert.equal(page.url(), target)
    assert((await page.context().cookies()).some(cookie => cookie.name === 'access_token' && cookie.value === 'local-test-token'))
    console.log('Browser auth recovery passed: proper outage page, automatic retry, same URL and preserved session.')
} finally {
    await browser.close()
    server.stop(true)
}
