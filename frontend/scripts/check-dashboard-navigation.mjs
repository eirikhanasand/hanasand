import { strict as assert } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { hasAppSidebar } from '../src/utils/routes/appRoutes.ts'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation.ts'

const access = { id: 'sidebar-test', isAdmin: true, canManageSystem: true, canManageContent: true, hasVMs: true }
const all = navigationLinks(getDashboardNavigation(access))
assert.equal(all.length, new Set(all.map(item => item.href)).size)
const memberAccess = { ...access, isAdmin: false, canManageSystem: false, canManageContent: false }
assert.deepEqual(getDashboardNavigation(memberAccess).map(item => item.label), ['Security operations', 'Automation', 'Infrastructure', 'Content', 'Settings'])
for (const permissions of [access, memberAccess]) {
    const automation = getDashboardNavigation(permissions).find(item => item.label === 'Automation')
    assert.deepEqual(automation.items.map(({ label, href, items }) => ({ label, href, items })), [
        { label: 'Health Checks', href: '/automation/health', items: undefined },
        { label: 'Cron Jobs', href: '/automation/cron', items: undefined },
    ])
}
assert.deepEqual(navigationLinks(getDashboardNavigation(memberAccess)).filter(item => item.ancestors.includes('Content')).map(item => item.href), ['/shares'])
const reviewer = navigationLinks(getDashboardNavigation({ ...memberAccess, canReviewIntel: true }))
assert.deepEqual(reviewer.filter(item => ['/ti/evaluation', '/ti/timeliness'].includes(item.href)).map(item => item.label), ['Evaluation', 'Timeliness'])
const operator = navigationLinks(getDashboardNavigation({ ...memberAccess, canManageSystem: true }))
assert(operator.some(item => item.href === '/system'))
assert.deepEqual(navigationLinks(getDashboardNavigation(memberAccess)).filter(item => item.ancestors.includes('Infrastructure')).map(item => item.href), ['/system', '/vms'])
assert(!navigationLinks(getDashboardNavigation({ ...memberAccess, hasVMs: false })).some(item => item.href === '/vms'))
assert(!operator.some(item => ['/db', '/logs', '/system/updates'].includes(item.href)))
assert.equal(all.find(item => item.href === '/dwm/actors')?.label, 'Monitored actors')
for (const path of ['/management/users', '/management/roles']) {
    assert.deepEqual(all.find(item => item.href === path)?.ancestors, ['Administration', 'Management'])
}
assert(!navigationLinks(getDashboardNavigation(memberAccess)).some(item => item.href.startsWith('/management')))
assert.deepEqual(all.find(item => item.href === '/cases')?.ancestors, ['Security operations'])
assert.deepEqual(all.find(item => item.href === '/dwm/actors')?.ancestors, ['Security operations', 'Dark web monitoring'])
assert.deepEqual(getDashboardNavigation(access)[0].items.slice(0, 3).map(item => item.label), ['Overview', 'Threat Search', 'Cases'])

for (const permissions of [access, memberAccess]) {
    const links = navigationLinks(getDashboardNavigation(permissions))
    assert(!links.some(item => item.href === '/solutions'), 'Marketing catalog must not appear in the internal menu')
    for (const href of ['/dwm', '/mill', '/ti', '/browser', '/organizations', '/pwned', '/test']) assert(links.some(item => item.href === href), `Missing product destination: ${href}`)
    assert(links.some(item => item.label === 'Security Scanner' && item.href === (permissions.canManageSystem ? '/scanner' : '/solutions/scanner')))
    assert(links.some(item => item.href === '/mill' && item.ancestors.includes('Security Monitoring')))
}
for (const path of ['/browser', '/browser/report', '/solutions', '/solutions/scanner', '/solutions/mill', '/pwned', '/test']) assert(hasAppSidebar(path), `Product loses the signed-in sidebar: ${path}`)
assert(!hasAppSidebar('/browser-unrelated'))

// Exercise the real component; only Next routing is replaced.
const build = await Bun.build({ entrypoints: ['sidebar-test-entry'], target: 'browser', plugins: [{ name: 'sidebar-fixture', setup(builder) {
    builder.onResolve({ filter: /^(sidebar-test-entry|next\/link|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/navigation'
        ? 'import {useSyncExternalStore} from \'react\'; export function usePathname(){return useSyncExternalStore(callback=>{window.addEventListener(\'popstate\',callback);return()=>window.removeEventListener(\'popstate\',callback)},()=>location.pathname,()=>\'/dashboard/overview\')}'
        : args.path === 'next/link'
            ? 'export default function Link({href,children,...props}){return <a {...props} href={href} onClick={event=>{event.preventDefault();history.pushState({},\'\',href);window.dispatchEvent(new Event(\'popstate\'))}}>{children}</a>}'
            : `import {createRoot} from 'react-dom/client'; import Sidebar from './src/components/dashboard/dashboardSidebar'; const root=createRoot(document.getElementById('root')); window.showSidebar=access=>root.render(<Sidebar {...access}/>); window.showSidebar(${JSON.stringify(access)});`,
    }))
} }] })
assert(build.success, build.logs.join('\n'))
const cssFiles = await readdir('.next/static/css').catch(() => [])
const css = (await Promise.all(cssFiles.filter(file => file.endsWith('.css')).map(file => readFile(`.next/static/css/${file}`, 'utf8')))).join('\n')
if (process.env.SIDEBAR_SCREENSHOT) assert(css.length > 0, 'Build the frontend before visual verification')
const server = Bun.serve({ port: 0, fetch(request) {
    const path = new URL(request.url).pathname
    if (path.startsWith('/api/backend/vms/')) return Response.json([{ name: 'fixture-vm' }])
    if (path === '/sidebar.js') return new Response(build.outputs[0], { headers: { 'content-type': 'text/javascript' } })
    if (path === '/sidebar.css') return new Response(css, { headers: { 'content-type': 'text/css' } })
    return new Response('<!doctype html><html class="light"><head><link rel="stylesheet" href="/sidebar.css"></head><body style="padding:16px;background:var(--ui-canvas)"><div id="root" style="width:232px"></div><script type="module" src="/sidebar.js"></script></body></html>', { headers: { 'content-type': 'text/html' } })
} })
const browser = await chromium.launch({ headless: true })
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${server.url}dwm/actors`)
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const button = (name) => nav.getByRole('button', { name, exact: true })
    const link = (name) => nav.getByRole('link', { name, exact: true })
    await link('Monitored actors').waitFor({ state: 'visible' })
    assert.equal(await link('Monitored actors').getAttribute('aria-current'), 'page')
    await link('Browser').click()
    assert.equal(await link('Browser').getAttribute('aria-current'), 'page')
    assert.equal(await link('All products and solutions').count(), 0)
    await page.getByRole('searchbox').fill('Security Monitoring')
    await link('Overview').click()
    assert.equal(new URL(page.url()).pathname, '/mill')
    await button('Security operations').click()
    await button('Automation').click()
    await link('Health Checks').click()
    assert.equal(await link('Health Checks').getAttribute('aria-current'), 'page')
    await link('Cron Jobs').click()
    assert.equal(await link('Cron Jobs').getAttribute('aria-current'), 'page')
    await page.reload()
    await link('Cron Jobs').waitFor({ state: 'visible' })
    assert.equal(await button('Monitoring').count(), 0)
    assert.equal(await button('Scheduling').count(), 0)
    assert.equal(await link('Execution Monitoring').count(), 0)
    assert.equal(await link('Monitored actors').isVisible(), false)
    await button('Infrastructure').click()
    await button('Compute').click()
    await link('Virtual Machines').click()
    await page.reload()
    await link('Virtual Machines').waitFor({ state: 'visible' })
    assert.equal(await button('Security operations').getAttribute('aria-expanded'), 'false')
    await button('Pin Virtual Machines').click()
    assert.equal(await button('Pinned').getAttribute('aria-expanded'), 'true')
    await page.reload()
    await button('Pinned').waitFor()
    await page.getByRole('searchbox').fill('actor')
    assert.equal(await nav.getByRole('link').count(), 2)
    await link('Actor Profiles').click()
    await button('Intelligence').waitFor({ state: 'visible' })
    assert.equal(await link('Actor Profiles').getAttribute('aria-current'), 'page')
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
    await button('Open Settings').click()
    await button('Account & organization').waitFor({ state: 'visible' })
    await page.setViewportSize({ width: 390, height: 844 })
    await button('Account & organization').focus()
    await page.keyboard.press('Enter')
    await link('Profile').waitFor({ state: 'visible' })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile sidebar must not overflow')
    if (process.env.SIDEBAR_SCREENSHOT) {
        await page.screenshot({ path: process.env.SIDEBAR_SCREENSHOT, fullPage: true })
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.evaluate(() => document.documentElement.className = 'dark')
        await page.screenshot({ path: process.env.SIDEBAR_SCREENSHOT.replace('.png', '-desktop-dark.png'), fullPage: true })
    }
    const collapseAll = page.getByRole('button', { name: 'Collapse all menus', exact: true })
    await collapseAll.focus()
    await page.keyboard.press('Enter')
    assert.equal(await nav.locator('[aria-expanded="true"]').count(), 0, 'Collapse all must include nested and pinned groups')
    assert.equal(await collapseAll.count(), 0, 'Hide collapse all when every menu is collapsed')
    await page.reload()
    await button('Pinned').waitFor()
    await page.waitForFunction(() => document.querySelector('nav') && !document.querySelector('nav [aria-expanded="true"]'))
    assert.equal(await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).count(), 1, 'Collapse all must keep the sidebar open')
    assert.equal(await collapseAll.count(), 0, 'Keep collapse all hidden after reloading collapsed preferences')
    await button('Pinned').click()
    assert(await collapseAll.isVisible(), 'An expanded pinned menu makes collapse all actionable')
    assert(await link('Virtual Machines').first().isVisible(), 'Collapse all must preserve pins')
    await button('Pinned').click()
    assert.equal(await collapseAll.count(), 0, 'Hide collapse all after manually closing the last menu')
    await button('Settings').click()
    assert.equal(await button('Account & organization').getAttribute('aria-expanded'), 'false', 'Reopening a section must leave its submenus collapsed')
    assert(await collapseAll.isVisible())
    await button('Account & organization').click()
    await button('Settings').click()
    assert.equal(await collapseAll.count(), 0, 'Expanded descendants inside a collapsed parent are not actionable')
    await button('Settings').click()
    assert(await collapseAll.isVisible())
    await page.getByRole('searchbox').fill('profile')
    assert.equal(await collapseAll.count(), 0, 'Search results do not expose expandable menus')
    await page.getByRole('searchbox').fill('')
    assert(await collapseAll.isVisible())
    await page.evaluate(access => window.showSidebar(access), { ...memberAccess, id: 'different-user' })
    await button('Content').click()
    await link('Shares').click()
    assert.equal(await link('Shares').getAttribute('aria-current'), 'page')
    await page.getByRole('searchbox').fill('database')
    assert.equal(await nav.getByRole('link').count(), 0)
    await page.getByRole('searchbox').fill('')
    assert.equal(await button('Pinned').count(), 0, 'Pins must not leak between users')
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw Error('Storage disabled') } })
    await button('Settings').click()
    assert.equal(await button('Settings').getAttribute('aria-expanded'), 'true')
    assert.deepEqual(errors, [])
    console.log(`Dashboard navigation passed: ${all.length} destinations, permissions, deep routes, persistence, pins, search, compact/mobile keyboard and unavailable storage.`)
} finally {
    await browser.close()
    server.stop(true)
}
