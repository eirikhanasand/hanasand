import { expect, test } from '@playwright/test'
import { appRoutes } from '../src/utils/routes/appRoutes'

// Run against a production build bound to 127.0.0.1, behind forwarded HTTPS.
// Fake credentials are accepted only by the existing loopback render check.
const headers = {
    'x-forwarded-proto': 'https',
    'x-hanasand-render-proof-auth': 'local-dashboard-render-proof',
    cookie: 'id=dashboard-render-proof-user; access_token=local-dashboard-render-proof-token; roles=["administrator"]',
}

for (const [, path] of appRoutes) {
    test(`${path} returns a document behind HTTPS termination`, async ({ request }) => {
        const response = await request.get(path, { headers, maxRedirects: 0 })
        expect(response.status()).toBeLessThan(500)
        expect(response.headers()['content-disposition'] || '').not.toContain('attachment')
        if (response.status() === 200) {
            expect(response.headers()['content-type']).toContain('text/html')
            expect(await response.text()).toContain('<!DOCTYPE html>')
        } else {
            expect([301, 302, 303, 307, 308]).toContain(response.status())
            expect(response.headers().location).toBeTruthy()
        }
    })
}

for (const path of ['/ti/activity', '/ti/attacks']) {
    test(`${path} displays in the browser and preserves streaming navigation`, async ({ context, page, request, baseURL }) => {
        await context.setExtraHTTPHeaders({ 'x-forwarded-proto': 'https', 'x-hanasand-render-proof-auth': headers['x-hanasand-render-proof-auth'] })
        for (const [name, value] of Object.entries({ id: 'dashboard-render-proof-user', access_token: 'local-dashboard-render-proof-token', roles: '["administrator"]' })) {
            await context.addCookies([{ name, value, url: baseURL! }])
        }
        const downloads: string[] = []
        page.on('download', download => downloads.push(download.suggestedFilename()))
        const response = await page.goto(path)
        expect(response?.status()).toBe(200)
        await expect(page.getByRole('main').first()).toBeVisible()
        expect(downloads).toEqual([])
        const stream = await request.get(`${path}?_rsc=route-check`, { headers: { ...headers, rsc: '1' } })
        expect(stream.status()).toBe(200)
        expect(stream.headers()['content-type']).toContain('text/x-component')
        const guest = await request.get(path, { maxRedirects: 0 })
        expect(guest.status()).toBe(307)
        expect(guest.headers().location).toContain('/login?path=')
        const denied = await request.get(path, { headers: { ...headers, cookie: headers.cookie.replace('["administrator"]', '[]') }, maxRedirects: 0 })
        expect(denied.status()).toBe(307)
        expect(denied.headers().location).toContain('notAllowed=true')
    })
}
