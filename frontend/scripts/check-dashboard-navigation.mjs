import { strict as assert } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation.ts'

const access = { id: 'sidebar-test', isAdmin: true, canManageSystem: true, canManageContent: true }
const all = navigationLinks(getDashboardNavigation(access))
assert.equal(all.length, new Set(all.map(item => item.href)).size)
const memberAccess = { ...access, isAdmin: false, canManageSystem: false, canManageContent: false }
assert.deepEqual(getDashboardNavigation(memberAccess).map(item => item.label), ['Security operations', 'Automation', 'Settings'])
const reviewer = navigationLinks(getDashboardNavigation({ ...memberAccess, canReviewIntel: true }))
assert.deepEqual(reviewer.filter(item => item.href.startsWith('/dashboard/ti/')).map(item => item.label), ['Evaluation', 'Timeliness'])
const operator = navigationLinks(getDashboardNavigation({ ...memberAccess, canManageSystem: true }))
assert(operator.some(item => item.href === '/dashboard/system'))
assert(!operator.some(item => ['/dashboard/db', '/dashboard/logs', '/dashboard/system/updates'].includes(item.href)))
assert.equal(all.find(item => item.href === '/dashboard/dwm/actors')?.label, 'Monitored actors')
assert(all.some(item => item.href === '/dashboard/management'))

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
    if (path === '/sidebar.js') return new Response(build.outputs[0], { headers: { 'content-type': 'text/javascript' } })
    if (path === '/sidebar.css') return new Response(css, { headers: { 'content-type': 'text/css' } })
    return new Response('<!doctype html><html class="light"><head><link rel="stylesheet" href="/sidebar.css"></head><body style="padding:16px;background:var(--ui-canvas)"><div id="root" style="width:232px"></div><script type="module" src="/sidebar.js"></script></body></html>', { headers: { 'content-type': 'text/html' } })
} })
const browser = await chromium.launch({ headless: true })
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${server.url}dashboard/dwm/actors`)
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const button = (name) => nav.getByRole('button', { name, exact: true })
    const link = (name) => nav.getByRole('link', { name, exact: true })
    await link('Monitored actors').waitFor({ state: 'visible' })
    assert.equal(await link('Monitored actors').getAttribute('aria-current'), 'page')
    await button('Security operations').click()
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
    await page.evaluate(access => window.showSidebar(access), { ...memberAccess, id: 'different-user' })
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
