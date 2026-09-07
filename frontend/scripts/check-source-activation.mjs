import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
const source = { id: 'source-one', tenantId: 'default', name: 'Example feed', status: 'candidate', family: 'vendor', owner: 'source-ops', accessMethod: 'public_http', risk: 'low', lastRunAt: '', lastContentAt: '2026-09-07T10:00:00Z', lastUsefulAt: '2026-09-01T10:00:00Z', healthState: 'healthy', cadenceMinutes: 60, productiveCycleCount: 7, retainedEvidenceCount: 99, customerMatchCount: 0, domains: [], url: 'https://example.com' }
let bundle, fail = true, status = 'candidate'
const calls = []
const server = Bun.serve({ port: 0, async fetch(request) {
    if (new URL(request.url).pathname === '/app.js') return new Response(bundle, { headers: { 'content-type': 'text/javascript' } })
    if (request.method === 'POST') {
        const body = await request.json(); calls.push(body)
        if (fail) return Response.json({ ok: false, payload: { error: { message: 'Approval required' } } }, { status: 502 })
        status = body.status
        return Response.json({ ok: true, payload: { source: { status } } })
    }
    return new Response(`<div id="root"></div><script>window.savedStatus=${JSON.stringify(status)}</script><script type="module" src="/app.js"></script>`, { headers: { 'content-type': 'text/html' } })
} })
const result = await Bun.build({ entrypoints: ['source-fixture'], target: 'browser', plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /^(source-fixture|next\/link|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'export default function Link(props){return <a {...props}/>}' : args.path === 'next/navigation' ? 'export const useRouter=()=>({refresh:()=>{}})' : `import {createRoot} from 'react-dom/client';import SourceRow from './src/app/dashboard/ti/sources/sourceRow';createRoot(document.getElementById('root')).render(<SourceRow source={{...${JSON.stringify(source)},status:window.savedStatus,...(location.search.includes('empty')?{lastUsefulAt:'',productiveCycleCount:0}:{})}} scope="default"/>);` }))
} }] })
assert(result.success, result.logs.join('\n')); bundle = await result.outputs[0].text()
const browser = await chromium.launch()
try {
    const page = await browser.newPage()
    await page.goto(server.url.toString())
    await page.getByText('Inactive', { exact: true }).waitFor()
    assert.equal(await page.getByText('Available to activate').count(), 0)
    assert.equal(await page.getByText('healthy', { exact: true }).count(), 0)
    await page.getByText('7 times', { exact: true }).waitFor()
    assert.equal(await page.locator('time').getAttribute('datetime'), source.lastUsefulAt)
    await page.getByRole('button', { name: 'Activate Example feed', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Approval required' }).waitFor()
    await page.getByText('Inactive', { exact: true }).waitFor()
    fail = false
    await page.getByRole('button', { name: 'Activate Example feed', exact: true }).click()
    await page.getByText('Active', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Run', exact: true }).waitFor()
    await page.reload()
    await page.getByRole('button', { name: 'Deactivate Example feed', exact: true }).click()
    await page.getByText('Inactive', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Run', exact: true }).count(), 0)
    await page.reload()
    await page.getByRole('button', { name: 'Activate Example feed', exact: true }).waitFor()
    assert.deepEqual(calls.map(call => call.status), ['active', 'active', 'paused'])
    assert(calls.every(call => call.sourceId === source.id && call.tenantId === 'default'))
    await page.goto(new URL('?empty=1', server.url).toString())
    await page.getByText('No useful output yet', { exact: true }).waitFor()
    await page.getByText('0 times', { exact: true }).waitFor()
    console.log('Useful-output timestamp, productive-run count and empty state passed. Source activation browser passed: inactive label, activate/deactivate, failed update retry, saved state after reload, and Run visibility.')
} finally { await browser.close(); server.stop(true) }
