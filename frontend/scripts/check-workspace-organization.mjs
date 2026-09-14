import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const organizations = [{ id: 'org-one', name: 'First org', role: 'owner', lifecycleStatus: 'active' }, { id: 'org-two', name: 'Second org', role: 'member', lifecycleStatus: 'active' }]
const calls = []
let bundle = ''
const cssDir = process.env.DWM_CSS_DIR || '.next/static/css'
const css = (await Promise.all((await readdir(cssDir)).filter(name => name.endsWith('.css')).map(name => readFile(`${cssDir}/${name}`, 'utf8')))).join('\n')
const server = Bun.serve({ port: 0, async fetch(request) {
    const url = new URL(request.url)
    const cookie = request.headers.get('cookie')?.split('; ').find(item => item.startsWith('hanasand_workspace='))?.split('=').slice(1).join('=')
    const workspace = cookie ? JSON.parse(decodeURIComponent(cookie)) : null
    if (url.pathname === '/app.js') return new Response(bundle, { headers: { 'content-type': 'text/javascript' } })
    if (url.pathname === '/app.css') return new Response(css, { headers: { 'content-type': 'text/css' } })
    if (url.pathname === '/api/organizations') return Response.json({ organizations })
    if (url.pathname === '/api/workspace-organization') {
        if (request.method === 'POST') {
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
        if (url.pathname.includes('/mill/rules')) return Response.json({ rules: [{ id: 'rule-one', name: `Rule for ${url.searchParams.get('organizationId')}`, family: 'authentication', enabled: true, severity: 'medium', source: 'hanasand', explanation: 'Recorded event rule.', evidence: [] }] })
        return Response.json({})
    }
    return new Response(`<html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script>window.initialWorkspace=${JSON.stringify(workspace)};</script><script type="module" src="/app.js"></script></body></html>`, { headers: { 'content-type': 'text/html', 'set-cookie': 'access_token=fixture; Path=/; SameSite=Lax' } })
} })
const built = await Bun.build({ entrypoints: ['workspace-fixture'], target: 'browser', plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /^(workspace-fixture|next\/link|next\/navigation|next\/image)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'export default function Link({prefetch,replace,scroll,...props}){return <a {...props}/>}' : args.path === 'next/image' ? 'export default function Image({priority,fill,...props}){return <img {...props}/>}' : args.path === 'next/navigation' ? 'export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:href=>location.assign(href),replace:href=>location.replace(href),refresh:()=>window.refreshWorkspace()});' : 'import {createRoot} from \'react-dom/client\';import WorkspaceProvider,{useWorkspace} from \'./src/components/organizations/workspaceProvider\';import Header from \'./src/components/header/header\';import MobileNavigation from \'./src/components/layout/mobileNavigation\';import DetectionRules from \'./src/app/dashboard/mill/rules/detection-rules\';import {workspaceShareUrl} from \'./src/utils/organizations/workspace\';function Content(){const {organizationId}=useWorkspace();return <><Header token path={location.pathname}/><div style={{paddingTop:80}}>{location.pathname===\'/mill/rules\'?<DetectionRules/>:<h1>Cases for {organizationId}</h1>}<button onClick={()=>navigator.clipboard.writeText(workspaceShareUrl(location.href,organizationId))}>Copy scoped link</button></div></>};const root=createRoot(document.getElementById(\'root\'));function render(initial){root.render(<WorkspaceProvider enabled initial={initial}><MobileNavigation enabled><Content/></MobileNavigation></WorkspaceProvider>)}window.refreshWorkspace=async()=>{const response=await fetch(\'/api/workspace-organization\');render((await response.json()).workspace)};render(window.initialWorkspace);' }))
} }] })
assert(built.success, built.logs.join('\n'));bundle = await built.outputs[0].text()
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
    await page.getByRole('status').filter({ hasText: 'Switched to First org' }).waitFor({ state: 'hidden', timeout: 5000 })
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
    await page.getByRole('combobox', { name: 'Org', exact: true }).selectOption('org-two')
    await page.getByRole('heading', { name: 'Cases for org-two' }).waitFor()
    await second.getByRole('link', { name: 'Rule for org-two' }).waitFor()
    const since = calls.length
    await page.goto(`${server.url}mill/rules?org=org-one`)
    await page.getByRole('link', { name: 'Rule for org-one' }).waitFor()
    assert(calls.slice(since).filter(url => url.pathname.includes('/mill/rules')).every(url => url.searchParams.get('organizationId') === 'org-one'))
    for (const width of [320,390,768,1440]) { await page.setViewportSize({ width, height: 1000 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Header overflow at ${width}`) }
    await page.goto(`${server.url}mill/rules?org=foreign`)
    await page.getByRole('alert').filter({ hasText: 'You do not have access' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Detection rules' }).count(), 0)
    await page.getByRole('link', { name: 'Keep current workspace' }).click()
    await page.getByRole('link', { name: 'Rule for org-one' }).waitFor()
    console.log('Workspace browser checks passed: legacy and short links, clean navigation, shared copy, three-second notice, cookie-only scope, cross-tab changes, denied scope, responsive header.')
} finally { await browser.close(); server.stop(true) }
