import assert from 'node:assert/strict'
import { readdirSync, existsSync } from 'node:fs'
import { appRoutes, canonicalAppPath, appPagePath, hasAppSidebar } from '../src/utils/routes/appRoutes'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation'
import { proxy } from '../src/proxy'
import { NextRequest } from 'next/server'

const base = new URL('../src/app/dashboard/', import.meta.url)
const pages = readdirSync(base, { recursive: true }).map(String).filter(path => path.endsWith('page.tsx'))
for (const page of pages) {
    const original = '/dashboard/' + page.replace(/\/?page.tsx$/, '')
    if (original === '/dashboard/') continue
    const canonical = canonicalAppPath(original)
    assert.ok(!canonical.startsWith('/dashboard/'), original)
    assert.equal(canonical === '/dashboard' ? '/dashboard/overview' : appPagePath(canonical), original)
    assert.ok(hasAppSidebar(canonical), canonical)
}
for (const [original, canonical] of appRoutes) {
    assert.ok(existsSync(new URL('../src/app' + original + '/page.tsx', import.meta.url)), original)
    const response = await proxy(new NextRequest('http://localhost:3127' + canonical + '?test=1'))
    const location = new URL(response.headers.get('location')!)
    assert.equal(location.pathname, '/login', canonical)
    assert.equal(location.searchParams.get('path'), canonical + '?test=1')
    const authenticated = await proxy(new NextRequest('http://localhost:3127' + canonical + '?test=1', { headers: {
        'x-hanasand-render-proof-auth': 'local-dashboard-render-proof',
        cookie: 'id=dashboard-render-proof-user; access_token=local-dashboard-render-proof-token; roles=["administrator"]',
    } }))
    assert.equal(authenticated.status, 200, canonical)
    assert.equal(authenticated.headers.get('x-current-path'), canonical)
    if (canonical !== '/dashboard') {
        const destination = new URL(authenticated.headers.get('x-middleware-rewrite')!)
        assert.equal(destination.pathname, original)
        assert.equal(destination.search, '?test=1')
    }
}
assert.equal(appPagePath('/content/articles/create'), '/dashboard/articles/create')
assert.equal(appPagePath('/millimeter'), '/millimeter')
assert.equal(appPagePath('/articles/example'), '/articles/example')
assert.equal(appPagePath('/ti/example'), '/ti/example')
for (const path of ['/organizations', '/organizations/123', '/profile/123', '/ti', '/ti/example', '/api']) assert.ok(hasAppSidebar(path))
for (const path of ['/', '/articles', '/login', '/pricing']) assert.ok(!hasAppSidebar(path))
for (const link of navigationLinks(getDashboardNavigation({ id: 'test', isAdmin: true, canManageSystem: true, canManageContent: true }))) {
    assert.ok(!link.href.startsWith('/dashboard/'), link.href)
    assert.ok(hasAppSidebar(link.href), link.href)
}
const restricted = await proxy(new NextRequest('http://localhost:3127/db', { headers: {
    'x-hanasand-render-proof-auth': 'local-dashboard-render-proof',
    cookie: 'id=dashboard-render-proof-user; access_token=local-dashboard-render-proof-token; roles=[]',
} }))
assert.equal(new URL(restricted.headers.get('location')!).searchParams.get('notAllowed'), 'true')
console.log(`Checked ${pages.length} page routes, ${appRoutes.length} login guards, navigation, collisions, and role protection.`)
