import { strict as assert } from 'node:assert'
import { readFile, readdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'

// Render the shared header, sidebar and frame without backend-dependent workspace/support data.
const build = await Bun.build({ entrypoints: ['mobile-test-entry'], target: 'browser', plugins: [{ name: 'mobile-fixture', setup(builder) {
    builder.onResolve({ filter: /^(mobile-test-entry|next\/link|next\/image|next\/navigation|@\/components\/footer\/footer|@\/components\/organizations\/workspaceProvider|@\/components\/support\/supportAssistant)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/navigation'
        ? 'import {useSyncExternalStore} from \'react\'; export function usePathname(){return useSyncExternalStore(callback=>{window.addEventListener(\'popstate\',callback);return()=>window.removeEventListener(\'popstate\',callback)},()=>location.pathname,()=>\'/cases/HA-1991\')}'
        : args.path === 'next/link'
            ? 'export default function Link({href,children,onClick,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);event.preventDefault();history.pushState({},\'\',href);window.dispatchEvent(new Event(\'popstate\'))}}>{children}</a>}'
            : args.path === 'next/image' ? 'export default function Image({priority,...props}){return <img {...props}/>}'
                : args.path === '@/components/organizations/workspaceProvider' ? 'export function useWorkspace(){return {organizationId:"",organizations:[]}}; export function OrganizationSwitcher(){return <select aria-label="Org" className="h-10 min-w-0 max-w-20 sm:max-w-48"><option>Personal workspace</option><option>Hanasand</option></select>}'
                    : args.path === '@/components/support/supportAssistant' || args.path === '@/components/footer/footer' ? 'export default function Empty(){return null}'
                        : `import {createRoot} from 'react-dom/client';
import MobileNavigation from './src/components/layout/mobileNavigation';
import RouteFrame from './src/components/layout/routeFrame';
import Sidebar from './src/components/dashboard/dashboardSidebar';
import Header from './src/components/header/header';
const access={id:'navigation-fixture',isAdmin:true,canManageSystem:true,canManageContent:true};
const token=!location.search.includes('anonymous');
createRoot(document.getElementById('root')).render(<MobileNavigation enabled={token}><Header token={token} path={location.pathname} initialMode="compact"/><RouteFrame serverPath={location.pathname} token={token} sidebar={token ? <Sidebar {...access} initialMode="compact"/> : null} banner={null}><article className="rounded-lg border border-ui-border bg-ui-panel p-5"><h1>HA-1991 · Host storage</h1><p>Case details</p><div style={{height:1200}}>Comments</div><button>Post comment</button></article></RouteFrame></MobileNavigation>);`,
    }))
} }] })
assert(build.success, build.logs.join('\n'))
const css = await postcss([tailwindcss()]).process(await readFile('src/app/globals.css', 'utf8'), { from: 'src/app/globals.css' })
const server = Bun.serve({ port: 0, fetch(request) {
    const path = new URL(request.url).pathname
    if (path.startsWith('/api/')) return Response.json([])
    if (path === '/fixture.js') return new Response(build.outputs[0], { headers: { 'content-type': 'text/javascript' } })
    if (path === '/fixture.css') return new Response(css.css, { headers: { 'content-type': 'text/css' } })
    return new Response('<!doctype html><html class="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>', { headers: { 'content-type': 'text/html' } })
} })
const browser = await chromium.launch()
try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.context().addCookies([{ name: 'dashboard_view_mode', value: 'compact', url: server.url.href }])
    // Every page pathname uses the same header, with and without a signed-in session.
    const routes = (await readdir('src/app', { recursive: true })).filter(file => /(^|\/)page\.tsx$/.test(file))
        .map(file => `/${file.replace(/(^|\/)page\.tsx$/, '').replace(/\[[^/]+\]/g, 'example')}`)
    for (const token of [false, true]) {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto(`${server.url}pwned${token ? '' : '?anonymous'}`)
        for (const route of routes) {
            await page.evaluate(path => { history.pushState({}, '', path); window.dispatchEvent(new Event('popstate')) }, route)
            const header = page.locator('[data-site-header]')
            await header.getByRole('button', { name: 'Product', exact: true }).waitFor()
            assert.equal(await header.count(), 1, `One shared header on ${route}`)
            assert.equal(await header.getByRole('button', { name: 'Developers', exact: true }).count(), 1)
            assert.equal(await header.getByRole('button', { name: 'Resources', exact: true }).count(), 1)
            assert.equal(await header.getByRole('link', { name: 'API docs', exact: true }).count(), 0, `No old topbar on ${route}`)
        }
        for (const width of [320, 390, 768, 1280, 1440]) {
            await page.setViewportSize({ width, height: 900 })
            await page.goto(`${server.url}pwned${token ? '' : '?anonymous'}`)
            const header = page.locator('[data-site-header]')
            await header.waitFor()
            const bounds = await header.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, height: el.getBoundingClientRect().height }))
            assert(bounds.scroll <= bounds.width, `Header fits at ${width}px, token=${token}`)
            assert.equal(bounds.height, 73)
            assert.equal((await page.locator('[data-route-frame]').boundingBox()).y, 72)
            if (token) {
                await page.getByLabel('Account and workspace').click()
                await page.getByRole('combobox', { name: 'Org', exact: true }).selectOption('Hanasand')
                assert(await page.getByRole('link', { name: 'Sign out', exact: true }).isVisible())
                const panel = await header.locator('details > div').boundingBox()
                assert(panel.x >= 0 && panel.x + panel.width <= width, 'Account panel fits')
                await page.keyboard.press('Escape')
                assert(!await page.getByRole('link', { name: 'Sign out', exact: true }).isVisible())
            }
            if (width < 1280) {
                const label = token ? 'Open site navigation' : 'Open navigation'
                await page.getByRole('button', { name: label, exact: true }).click()
                const publicMenu = header.getByRole('navigation', { name: 'Mobile main navigation' })
                await publicMenu.locator('summary').filter({ hasText: 'Resources' }).click()
                await publicMenu.getByRole('link', { name: /^Hash Exposure Lookup/ }).click()
                assert(!await header.getByRole('navigation', { name: 'Mobile main navigation' }).getByRole('link', { name: /^Hash Exposure Lookup/ }).isVisible())
            }
            if (width === 1440 || width === 390) await page.screenshot({ path: `/tmp/shared-header-${token ? 'signed-in' : 'public'}-${width}.png` })
        }
    }
    for (const width of [390, 768, 1023]) {
        await page.setViewportSize({ width, height: 844 })
        await page.goto(`${server.url}cases/HA-1991`)
        const sidebar = page.getByRole('complementary', { name: 'Dashboard sidebar' })
        const heading = page.getByRole('heading', { name: 'HA-1991 · Host storage' })
        await heading.waitFor()
        assert(!await sidebar.isVisible(), 'Mobile sidebar must be closed on load')
        const before = await heading.boundingBox()
        assert(before.y < 120, 'Case content must start just below the header')
        await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
        await page.getByRole('searchbox', { name: 'Search navigation' }).waitFor()
        assert(await sidebar.isVisible())
        assert.deepEqual(await heading.boundingBox(), before, 'Opening navigation must not move content')
        assert(await page.getByRole('button', { name: 'Security & intelligence', exact: true }).isVisible(), 'Saved desktop compact mode must not hide mobile labels')
        assert(!await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).first().isVisible())
        await page.getByRole('searchbox').fill('Cron Jobs')
        await page.getByRole('link', { name: 'Cron Jobs', exact: true }).click()
        assert(!await sidebar.isVisible(), 'Selecting a destination must close navigation')
        assert(new URL(page.url()).pathname === '/automation/cron')
        await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
        await page.keyboard.press('Escape')
        assert(!await sidebar.isVisible())
        assert(await page.getByRole('button', { name: 'Open navigation', exact: true }).evaluate(el => el === document.activeElement))
        await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
        await page.getByRole('button', { name: 'Close navigation backdrop' }).click({ position: { x: 1, y: 2 } })
        assert(!await sidebar.isVisible())
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        if (width === 390) {
            await page.screenshot({ path: '/tmp/mobile-navigation-closed.png' })
            await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
            await page.screenshot({ path: '/tmp/mobile-navigation-open.png' })
        }
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.getByRole('button', { name: 'Open Security & intelligence' }).waitFor()
        assert(await sidebar.isVisible(), 'Desktop sidebar must remain available and compact')
        assert(!await page.getByRole('button', { name: 'Open navigation', exact: true }).isVisible())
        await page.setViewportSize({ width, height: 844 })
        assert(!await sidebar.isVisible(), 'Returning from desktop must close the mobile overlay')
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${server.url}cases/HA-1991`)
    await page.getByRole('button', { name: 'Open Logs & rules', exact: true }).click()
    const sidebar = page.getByRole('complementary', { name: 'Dashboard sidebar' })
    await page.getByRole('button', { name: 'Collapse all menus', exact: true }).click()
    const top = (await sidebar.boundingBox()).y
    for (const name of ['Security & intelligence', 'Investigations', 'Intelligence', 'Monitoring', 'Collection', 'Logs & rules', 'Logs', 'Rules']) {
        const toggle = sidebar.getByRole('button', { name, exact: true })
        await toggle.scrollIntoViewIfNeeded()
        const headingTop = (await sidebar.getByRole('heading', { name: 'Navigation' }).boundingBox()).y
        await toggle.click()
        assert.equal((await sidebar.boundingBox()).y, top, `${name} must expand downwards`)
        assert.equal((await sidebar.getByRole('heading', { name: 'Navigation' }).boundingBox()).y, headingTop, `${name} must not scroll the sidebar header upwards`)
    }
    assert(top >= 72, 'Sidebar must remain below the site header')
    await page.screenshot({ path: '/tmp/sidebar-nested-desktop.png' })
    await page.goto(`${server.url}browser/saved-result`)
    const reportFrame = page.locator('[data-route-frame]')
    const report = page.locator('article')
    await report.waitFor()
    const sidebarTop = (await sidebar.boundingBox()).y
    const content = report.locator('..')
    await content.evaluate(el => { el.scrollTop = el.scrollHeight })
    const bottom = await content.evaluate(el => el.scrollTop)
    const box = await content.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 30)
    await page.mouse.wheel(0, 1500)
    await page.waitForTimeout(150)
    assert.equal(await content.evaluate(el => el.scrollTop), bottom, 'Content stops at its end')
    assert.equal(await reportFrame.evaluate(el => el.scrollTop), 0, 'Scrolling the report never scrolls the outer frame')
    assert.equal(await page.evaluate(() => scrollY), 0, 'Scrolling the report never scrolls the document')
    assert.equal((await sidebar.boundingBox()).y, sidebarTop, 'Sidebar stays fixed when scrolling the report past its end')
    assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), 'No blank document overflow below the report')

    assert.deepEqual(errors, [])
    console.log(`Shared header passed on ${routes.length} page paths, signed in and out. Desktop/mobile menus, account controls, sizing, sidebar search, Escape/focus, backdrop and view preference passed.`)
} finally {
    await browser.close()
    server.stop(true)
}
