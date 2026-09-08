import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'

// Render the real menu, sidebar and page shell with only framework routing and the unused footer replaced.
const build = await Bun.build({ entrypoints: ['mobile-test-entry'], target: 'browser', plugins: [{ name: 'mobile-fixture', setup(builder) {
    builder.onResolve({ filter: /^(mobile-test-entry|next\/link|next\/navigation|@\/components\/footer\/footer)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/navigation'
        ? 'import {useSyncExternalStore} from \'react\'; export function usePathname(){return useSyncExternalStore(callback=>{window.addEventListener(\'popstate\',callback);return()=>window.removeEventListener(\'popstate\',callback)},()=>location.pathname,()=>\'/cases/HA-1991\')}'
        : args.path === 'next/link'
            ? 'export default function Link({href,children,onClick,...props}){return <a {...props} href={href} onClick={event=>{onClick?.(event);event.preventDefault();history.pushState({},\'\',href);window.dispatchEvent(new Event(\'popstate\'))}}>{children}</a>}'
            : args.path === '@/components/footer/footer' ? 'export default function Footer(){return null}'
                : `import {createRoot} from 'react-dom/client';
import MobileNavigation from './src/components/layout/mobileNavigation';
import RouteFrame from './src/components/layout/routeFrame';
import Sidebar from './src/components/dashboard/dashboardSidebar';
import Menu from './src/components/menu/menu';
import ViewModeToggle from './src/components/header/viewModeToggle';
const access={id:'navigation-fixture',isAdmin:true,canManageSystem:true,canManageContent:true};
createRoot(document.getElementById('root')).render(<MobileNavigation enabled><header className="fixed inset-x-0 top-0 z-1000 flex h-16 items-center justify-between bg-ui-panel px-3"><span>Hanasand</span><div className="flex"><ViewModeToggle initialMode="compact"/><Menu/></div></header><RouteFrame serverPath="/cases/HA-1991" token sidebar={<Sidebar {...access} initialMode="compact"/>} banner={null}><article className="rounded-lg border border-ui-border bg-ui-panel p-5"><h1>HA-1991 · Host storage</h1><p>Case details</p><div style={{height:1200}}>Comments</div><button>Post comment</button></article></RouteFrame></MobileNavigation>);`,
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
        assert(await page.getByRole('button', { name: 'Security operations', exact: true }).isVisible(), 'Saved desktop compact mode must not hide mobile labels')
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
        await page.getByRole('button', { name: 'Open Security operations' }).waitFor()
        assert(await sidebar.isVisible(), 'Desktop sidebar must remain available and compact')
        assert(!await page.getByRole('button', { name: 'Open navigation', exact: true }).isVisible())
        await page.setViewportSize({ width, height: 844 })
        assert(!await sidebar.isVisible(), 'Returning from desktop must close the mobile overlay')
    }
    assert.deepEqual(errors, [])
    console.log('Mobile navigation passed at 390, 768 and 1023px: content position, labels, search, destinations, Escape/focus, backdrop, resizing and desktop compact preference.')
} finally {
    await browser.close()
    server.stop(true)
}
