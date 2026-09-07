import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
let bundle
const result = await Bun.build({ entrypoints: ['filters-fixture'], target: 'browser', plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /^(filters-fixture|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/navigation' ? `
        import {useState,useEffect} from 'react';
        window.calls=[];
        export function useSearchParams(){const [url,setUrl]=useState(location.search);useEffect(()=>{const sync=()=>setUrl(location.search);window.addEventListener('popstate',sync);window.addEventListener('navigation',sync);return()=>{window.removeEventListener('popstate',sync);window.removeEventListener('navigation',sync)}},[]);return new URLSearchParams(url)}
        export const useRouter=()=>({replace(url){window.calls.push(url);setTimeout(()=>{history.replaceState(null,'',url);window.dispatchEvent(new Event('navigation'))},120)}});
    ` : 'import {createRoot} from \'react-dom/client\';import SourceFilters from \'./src/app/dashboard/ti/sources/sourceFilters\';createRoot(document.getElementById(\'root\')).render(<SourceFilters/>);' }))
} }] })
assert(result.success, result.logs.join('\n')); bundle = await result.outputs[0].text()
const server = Bun.serve({ port: 0, fetch(request) {
    return new URL(request.url).pathname === '/app.js' ? new Response(bundle, { headers: { 'content-type': 'text/javascript' } }) : new Response('<div id="root"></div><script type="module" src="/app.js"></script>', { headers: { 'content-type': 'text/html' } })
} })
const browser = await chromium.launch()
try {
    const page = await browser.newPage()
    await page.goto(new URL('/ti/sources?sort=useful&dir=desc&page=3', server.url).toString())
    const search = page.getByRole('textbox', { name: 'Search sources' })
    await search.waitFor()
    assert.equal(await page.getByRole('button', { name: 'Apply', exact: true }).count(), 0)
    await page.getByLabel('Status', { exact: true }).selectOption('active')
    await search.fill('Sigma')
    await page.getByLabel('Useful output', { exact: true }).selectOption('yes')
    await page.waitForURL(url => url.searchParams.get('q') === 'Sigma' && url.searchParams.get('output') === 'yes')
    assert.equal(new URL(page.url()).searchParams.get('lifecycle'), 'active')
    assert.equal(new URL(page.url()).searchParams.get('page'), '1')
    assert.equal(new URL(page.url()).searchParams.get('sort'), 'useful')
    assert.equal(new URL(page.url()).searchParams.get('dir'), 'desc')
    await search.fill('SigmaHQ')
    await page.waitForURL(url => url.searchParams.get('q') === 'SigmaHQ')
    assert.equal(await search.inputValue(), 'SigmaHQ')
    await page.reload()
    assert.equal(await search.inputValue(), 'SigmaHQ')
    await search.fill('pending')
    await page.getByRole('button', { name: 'Clear', exact: true }).click()
    await page.waitForURL(url => !url.searchParams.has('q') && !url.searchParams.has('lifecycle'))
    await page.waitForTimeout(450)
    assert.equal(await search.inputValue(), '')
    assert.equal(new URL(page.url()).searchParams.has('q'), false)
    await search.fill('cancel on back')
    await page.evaluate(() => { history.pushState(null, '', '/ti/sources?q=restored'); window.dispatchEvent(new PopStateEvent('popstate')) })
    await page.waitForTimeout(450)
    assert.equal(await search.inputValue(), 'restored')
    assert.equal(new URL(page.url()).searchParams.get('q'), 'restored')
    console.log('Source filters passed: immediate selection, debounced search, rapid changes, page reset, sorting, reload, Clear and history restoration.')
} finally { await browser.close(); server.stop(true) }
