import assert from 'node:assert/strict'
import path from 'node:path'
import { chromium } from '@playwright/test'

// Render the real component with isolated session responses; never revoke a live token.
const build = await Bun.build({
    entrypoints: ['session-panel-test'], target: 'browser', define: { 'process.env': '{}' },
    plugins: [{ name: 'session-panel-test', setup(builder) {
        builder.onResolve({ filter: /^session-panel-test$/ }, () => ({ path: 'entry', namespace: 'fixture' }))
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: `import { createElement } from ${JSON.stringify(path.resolve('node_modules/react'))}; import { createRoot } from ${JSON.stringify(path.resolve('node_modules/react-dom/client'))}; import Sessions from ${JSON.stringify(path.resolve('src/components/profile/sessions.tsx'))}; createRoot(document.getElementById('root')).render(createElement(Sessions, { isSelf: true }));` }))
    } }],
})
assert.equal(build.success, true, String(build.logs))
const script = await build.outputs[0].text()
const browser = await chromium.launch()
try {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    page.on('pageerror', error => console.error(error))
    const current = { token_id: 1, id: 'fixture', current: true, ip: null, network: null, user_agent: 'Mozilla/5.0 (Macintosh) Version/18.0 Safari/605.1', created_at: '2026-09-07T10:00:00Z', last_seen_at: '2026-09-07T10:00:00Z', revoked_at: null }
    const other = { ...current, token_id: 2, current: false, user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0' }
    let sessions = [current, other]
    let fail = false
    let revokedCurrent = false
    let invalidRefreshes = 0
    await context.addCookies(['id', 'access_token', 'name', 'avatar', 'roles'].map(name => ({ name, value: 'fixture', url: 'http://session-revoke.test' })))
    await page.route('**/*', async route => {
        const request = route.request()
        const url = new URL(request.url())
        if (url.pathname.startsWith('/api/auth/sessions')) {
            if (request.method() === 'DELETE') {
                assert.equal(request.headers()['content-type'], undefined)
                assert.equal(request.postData(), null)
                if (fail) return route.fulfill({ status: 503, json: { error: 'Unavailable' } })
                const id = Number(url.pathname.split('/').at(-1))
                revokedCurrent = id === 1
                sessions = sessions.filter(session => session.token_id !== id)
                return route.fulfill({ json: { revoked: true } })
            }
            if (request.method() === 'POST') {
                assert.deepEqual(request.postDataJSON(), { keep_current: true })
                sessions = sessions.filter(session => session.current)
                return route.fulfill({ json: { revoked: 1 } })
            }
            if (revokedCurrent) { invalidRefreshes++; return route.fulfill({ status: 401, json: { error: 'Unauthorized' } }) }
            return route.fulfill({ json: { sessions } })
        }
        if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: script })
        return route.fulfill({ contentType: 'text/html', body: url.pathname === '/login' ? '<h1>Sign in</h1>' : '<div id="root"></div><script type="module" src="/fixture.js"></script>' })
    })
    await page.goto('http://session-revoke.test')
    const otherButton = page.getByRole('button', { name: 'Revoke Chrome on Windows session' })
    await otherButton.click()
    await otherButton.waitFor({ state: 'hidden' })
    assert.equal(sessions.length, 1)
    sessions = [current, other]
    await page.reload()
    await page.getByRole('button', { name: 'Log out others' }).click()
    await otherButton.waitFor({ state: 'hidden' })
    assert.equal(sessions[0].current, true)
    fail = true
    await page.getByRole('button', { name: 'Revoke Safari on macOS session' }).click()
    await page.getByRole('alert').waitFor()
    assert.equal((await context.cookies()).some(cookie => cookie.name === 'access_token'), true)
    fail = false
    await page.getByRole('button', { name: 'Revoke Safari on macOS session' }).click()
    await page.waitForURL('**/login')
    assert.equal(invalidRefreshes, 0, 'Do not reload sessions with the token just revoked')
    assert.deepEqual(await context.cookies(), [])
} finally { await browser.close() }
console.log('Session revocation passed: individual, others, failure recovery and current-session sign-out.')
