import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
const organizations = [{ id: 'org-one', name: 'First org', role: 'owner', lifecycleStatus: 'active' }, { id: 'org-two', name: 'Second org', role: 'member', lifecycleStatus: 'active' }]
const calls = []
let bundle = ''
let switchGate = null
let failSwitch = false
let css = (await postcss([tailwind()]).process(await readFile('src/app/globals.css', 'utf8'), { from: 'src/app/globals.css' })).css
const server = Bun.serve({ port: 0, async fetch(request) {
    const url = new URL(request.url)
    const cookie = request.headers.get('cookie')?.split('; ').find(item => item.startsWith('hanasand_workspace='))?.split('=').slice(1).join('=')
    const workspace = cookie ? JSON.parse(decodeURIComponent(cookie)) : null
    if (url.pathname === '/app.js') return new Response(bundle, { headers: { 'content-type': 'text/javascript' } })
    if (url.pathname === '/app.css') return new Response(css, { headers: { 'content-type': 'text/css' } })
    if (url.pathname === '/hanasand-logo-transparent.png') return new Response(await readFile('public/hanasand-logo-transparent.png'), { headers: { 'content-type': 'image/png' } })
    if (url.pathname === '/api/organizations') return Response.json({ organizations })
    if (url.pathname === '/api/workspace-organization') {
        if (request.method === 'POST') {
            await switchGate
            if (failSwitch) return Response.json({ error: 'Organization access could not be checked. Please retry.' }, { status: 503 })
            const { org } = await request.json(); const selected = organizations.find(item => item.id === org)
            if (org && !selected) return Response.json({ error: 'You do not have access to this organization.' }, { status: 403 })
            const next = { userId: 'fixture', organizationId: org, name: selected?.name || 'Personal workspace', changedAt: Date.now() }
            return Response.json({ workspace: next }, { headers: { 'set-cookie': `hanasand_workspace=${encodeURIComponent(JSON.stringify(next))}; Path=/; HttpOnly; SameSite=Lax` } })
        }
        if (url.searchParams.has('consumeNotice') && workspace) {
            delete workspace.changedAt
            return Response.json({ workspace }, { headers: { 'set-cookie': `hanasand_workspace=${encodeURIComponent(JSON.stringify(workspace))}; Path=/; HttpOnly; SameSite=Lax` } })
        }
        return Response.json({ workspace })
    }
    if (url.pathname.startsWith('/api/')) {
        calls.push(url)
        if (url.pathname.includes('/mill/rules')) return Response.json({ rules: [{ id: 'rule-one', name: `Rule for ${url.searchParams.get('organizationId')}`, family: 'authentication', enabled: true, severity: 'medium', source: 'hanasand', explanation: 'Recorded event rule.', evidence: [] }, { id: 'network.signature_alert.v1', name: 'Network match', family: 'network', severity: 'high', explanation: 'Matching signature.', evidence: [], source: 'hanasand', enabled: false }, { id: 'auth.new_country.v1', name: 'Country analysis', family: 'identity', severity: 'medium', explanation: 'New login location.', evidence: [], source: 'hanasand', enabled: true }] })
        return Response.json({})
    }
    return new Response(`<html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script>window.initialWorkspace=${JSON.stringify(workspace)};</script><script type="module" src="/app.js"></script></body></html>`, { headers: { 'content-type': 'text/html', 'set-cookie': 'access_token=fixture; Path=/; SameSite=Lax' } })
} })
const built = await Bun.build({ entrypoints: ['workspace-fixture'], target: 'browser', plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /^(workspace-fixture|next\/link|next\/navigation|next\/image)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'export default function Link({prefetch,replace,scroll,...props}){return <a {...props}/>}' : args.path === 'next/image' ? 'export default function Image({priority,fill,...props}){return <img {...props}/>}' : args.path === 'next/navigation' ? 'export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:href=>location.assign(href),replace:href=>location.replace(href),refresh:()=>window.refreshWorkspace()});' : 'import {createRoot} from \'react-dom/client\';import WorkspaceProvider,{useWorkspace} from \'./src/components/organizations/workspaceProvider\';import Header from \'./src/components/header/header\';import MobileNavigation from \'./src/components/layout/mobileNavigation\';import DetectionRules from \'./src/app/dashboard/mill/rules/detection-rules\';import {workspaceShareUrl} from \'./src/utils/organizations/workspace\';function Content(){const {organizationId}=useWorkspace();return <><Header token path={location.pathname}/><div style={{paddingTop:80}}>{location.pathname.startsWith(\'/mill/rules\')?<DetectionRules category={location.pathname.includes(\'/analysis\')?\'analysis\':location.pathname.includes(\'/match\')?\'match\':\'detection\'}/>:<h1>Cases for {organizationId}</h1>}<button onClick={()=>navigator.clipboard.writeText(workspaceShareUrl(location.href,organizationId))}>Copy scoped link</button></div></>};const root=createRoot(document.getElementById(\'root\'));function render(initial){root.render(<WorkspaceProvider enabled initial={initial}><MobileNavigation enabled><Content/></MobileNavigation></WorkspaceProvider>)}window.refreshWorkspace=async()=>{const response=await fetch(\'/api/workspace-organization\');render((await response.json()).workspace)};render(window.initialWorkspace);' }))
} }] })
assert(built.success, built.logs.join('\n'));bundle = await built.outputs.find(output => output.path.endsWith('.js')).text()
for (const output of built.outputs.filter(output => output.path.endsWith('.css'))) css += await output.text()
const browser = await chromium.launch()
try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror', error => console.log('Browser error:', error.message))
    await page.goto(`${server.url}mill/rules?organizationId=org-one`)
    await page.getByRole('link', { name: 'Rule for org-one' }).waitFor().catch(async error => { console.log(await page.locator('body').innerText()); throw error })
    assert.equal(new URL(page.url()).search, '')
    assert.equal(await page.getByRole('combobox', { name: 'Org', exact: true }).count(), 1)
    assert.equal(await page.getByRole('combobox', { name: 'Organization', exact: true }).count(), 0)
    await page.getByRole('status').filter({ hasText: 'Switched to First org' }).waitFor()
    await page.getByRole('status').filter({ hasText: 'Switched to First org' }).waitFor({ state: 'hidden', timeout: 6000 })
    assert.equal(await page.evaluate(() => localStorage.length), 0)
    assert(!(await page.evaluate(() => document.cookie)).includes('hanasand_workspace'))
    await page.getByRole('link', { name: 'Cases', exact: true }).click()
    await page.getByRole('heading', { name: 'Cases for org-one' }).waitFor()
    assert.equal(new URL(page.url()).search, '')
    await page.getByRole('button', { name: 'Copy scoped link' }).click()
    const shared = await page.evaluate(() => navigator.clipboard.readText())
    assert.equal(new URL(shared).searchParams.get('org'), 'org-one')
    assert(!shared.includes('organizationId'))
    const second = await context.newPage(); await second.goto(`${server.url}mill/rules`)
    await second.getByRole('link', { name: 'Rule for org-one' }).waitFor()
    let finishSwitch
    switchGate = new Promise(resolve => { finishSwitch = resolve })
    await page.getByRole('combobox', { name: 'Org', exact: true }).selectOption('org-two')
    await page.getByRole('status').filter({ hasText: 'Switching to Second org' }).waitFor()
    assert(await page.getByRole('heading', { name: 'Cases for org-one' }).isVisible(), 'Current page stays mounted while switching')
    assert(await page.getByRole('combobox', { name: 'Org', exact: true }).isDisabled(), 'Serialize workspace changes')
    await page.getByRole('button', { name: 'Copy scoped link' }).click()
    assert.equal(new URL(await page.evaluate(() => navigator.clipboard.readText())).searchParams.get('org'), 'org-one')
    finishSwitch(); switchGate = null
    await page.getByRole('heading', { name: 'Cases for org-two' }).waitFor()
    await page.getByRole('status').filter({ hasText: 'Switched to Second org' }).waitFor()
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('[data-workspace-notice]')).pointerEvents), 'none')
    await page.getByRole('button', { name: 'Copy scoped link' }).click()
    await page.screenshot({ path: '/tmp/workspace-switch-light.png', fullPage: true })
    await page.getByRole('button', { name: 'Dismiss workspace notification' }).click()
    assert.equal(await page.locator('[data-workspace-notice]').count(), 0)
    await second.getByRole('link', { name: 'Rule for org-two' }).waitFor()
    failSwitch = true
    await page.getByRole('combobox', { name: 'Org', exact: true }).selectOption('org-one')
    await page.getByRole('alert').filter({ hasText: 'Please retry' }).waitFor()
    assert(await page.getByRole('heading', { name: 'Cases for org-two' }).isVisible())
    assert.equal(await page.locator('[data-workspace-notice]').count(), 0)
    failSwitch = false
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('combobox', { name: 'Org', exact: true }).selectOption('org-one')
    await page.getByRole('status').filter({ hasText: 'Switched to First org' }).waitFor()
    assert.equal(await page.locator('[data-workspace-notice]').evaluate(el => getComputedStyle(el).animationName), 'none')
    await page.screenshot({ path: '/tmp/workspace-switch-dark-mobile.png', fullPage: true })
    await page.getByRole('status').filter({ hasText: 'Switched to First org' }).waitFor({ state: 'hidden', timeout: 6000 })
    organizations[1].name = 'International Security Research and Incident Response Organization'
    await page.setViewportSize({ width: 320, height: 700 })
    await page.getByRole('combobox', { name: 'Org', exact: true }).selectOption('org-two')
    await page.getByRole('status').filter({ hasText: `Switched to ${organizations[1].name}` }).waitFor()
    const noticeBounds = await page.locator('[data-workspace-notice]').boundingBox()
    assert(noticeBounds.x >= 0 && noticeBounds.x + noticeBounds.width <= 320, 'Long organization names stay within the viewport')
    await page.getByRole('button', { name: 'Dismiss workspace notification' }).click()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const since = calls.length
    await page.goto(`${server.url}mill/rules?org=org-one`)
    await page.getByRole('link', { name: 'Rule for org-one' }).waitFor()
    assert(calls.slice(since).filter(url => url.pathname.includes('/mill/rules')).every(url => url.searchParams.get('organizationId') === 'org-one'))
    for (const width of [320,390,768,1440]) { await page.setViewportSize({ width, height: 1000 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Header overflow at ${width}`) }
    for (const [category, title, rule] of [['match', 'Match filter', 'Network match'], ['analysis', 'Analysis filter', 'Country analysis'], ['detection', 'Detection filter', 'Rule for org-one']]) {
        await page.goto(`${server.url}mill/rules/${category}`)
        await page.getByRole('heading', { name: title, exact: true }).waitFor()
        const table = page.getByRole('table')
        await table.getByRole('link', { name: rule }).waitFor()
        assert.equal(await page.getByRole('table').count(), 1)
        assert.equal(await table.locator('tbody tr').count(), 1)
        assert((await table.getByRole('link').getAttribute('href')).startsWith(`/mill/rules/${category}/`))
        await page.getByRole('searchbox', { name: 'Title', exact: true }).fill('unmatched title')
        await page.getByText('No rules in this category match these filters.').waitFor()
        await page.getByRole('button', { name: 'Clear filters' }).click()
        await table.getByRole('link', { name: rule }).waitFor()
        await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption(category === 'match' ? 'enabled' : 'disabled')
        await page.getByText('No rules in this category match these filters.').waitFor()
    }
    await page.goto(`${server.url}mill/rules?org=foreign`)
    await page.getByRole('alert').filter({ hasText: 'You do not have access' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Rules' }).count(), 0)
    await page.getByRole('link', { name: 'Keep current workspace' }).click()
    await page.getByRole('link', { name: 'Rule for org-one' }).waitFor()
    console.log('Workspace browser checks passed: nonblocking pending/confirmed feedback, dismissal, reduced motion, failure recovery, links, cookie-only scope, cross-tab changes, denied scope, responsive header.')
} finally { await browser.close(); server.stop(true) }
