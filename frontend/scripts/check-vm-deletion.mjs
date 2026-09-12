import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const initial = { name: 'cashflow', owner: 'admin', created_by: 'admin', access_users: [], status: 'Running', primary_host: 'inspur' }
let vm = { ...initial }
let failDelete = false
let failRestore = false
const deletions = []
let restores = 0
const cssDir = process.env.VM_CSS_DIR || '.next/static/css'
const css = (await Promise.all((await readdir(cssDir)).filter(name => name.endsWith('.css')).map(name => readFile(`${cssDir}/${name}`, 'utf8')))).join('\n')
let bundle = ''
const server = Bun.serve({ port: 0, async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/app.js') return new Response(bundle, { headers: { 'content-type': 'text/javascript' } })
    if (path === '/vm' && request.method === 'GET') return Response.json(vm)
    if (request.method === 'DELETE') {
        deletions.push(await request.json())
        if (failDelete) return Response.json({ error: 'Host is temporarily unavailable.' }, { status: 503 })
        vm = { ...initial, deleted_at: new Date().toISOString(), delete_after: new Date(Date.now() + 30 * 86400000).toISOString() }
        return Response.json({ vm })
    }
    if (path.endsWith('/restore')) {
        restores++
        if (failRestore) return Response.json({ error: 'Could not restore. Try again.' }, { status: 503 })
        vm = { ...initial }
        return Response.json({ vm })
    }
    return new Response(`<html><head><style>${css}</style></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`, { headers: { 'content-type': 'text/html' } })
} })
const build = await Bun.build({ entrypoints: ['deletion-fixture'], target: 'browser', plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /^(deletion-fixture|next\/link|next\/navigation|@\/config)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'export default function Link(props){return <a {...props}/>}' : args.path === 'next/navigation' ? 'export const useRouter=()=>({push:()=>{},refresh:()=>{}})' : args.path === '@/config' ? 'export default {url:{api:location.origin},abortTimeout:1000}' : `
        import {createRoot} from 'react-dom/client';import {useState} from 'react';import VMRow from './src/components/profile/vm';
        document.cookie='id=admin';document.cookie='access_token=fixture';
        function App(){const[vm,setVM]=useState(${JSON.stringify(initial)});return <VMRow vm={vm} update={async()=>setVM(await(await fetch('/vm')).json())}/>}
        createRoot(document.getElementById('root')).render(<App/>);
    ` }))
} }] })
assert(build.success, build.logs.join('\n')); bundle = await build.outputs[0].text()
const browser = await chromium.launch()
try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
    const errors = []; const nativeDialogs = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => { nativeDialogs.push(dialog.type()); void dialog.dismiss() })
    await page.goto(server.url.toString())
    await page.getByText('Danger actions', { exact: true }).click()
    const open = () => page.getByRole('button', { name: 'Delete VM', exact: true }).click()
    await open()
    const modal = page.getByRole('dialog')
    const input = modal.getByRole('textbox')
    const confirm = modal.getByRole('button', { name: 'Delete VM', exact: true })
    assert(await modal.isVisible())
    assert(await input.evaluate(el => el === document.activeElement))
    assert(await confirm.isDisabled())
    for (const value of ['Cashflow', 'cashflow ', 'other']) { await input.fill(value); assert(await confirm.isDisabled()) }
    assert.equal(deletions.length, 0)
    await page.keyboard.press('Escape'); assert.equal(await modal.count(), 0)
    await open(); assert.equal(await input.inputValue(), '')
    await input.fill('cashflow')
    failDelete = true; await confirm.click()
    await modal.getByRole('alert').filter({ hasText: 'Host is temporarily unavailable.' }).waitFor()
    assert(await modal.isVisible())
    failDelete = false; await confirm.click()
    await page.getByRole('button', { name: 'Restore VM', exact: true }).waitFor()
    assert.equal(await modal.count(), 0)
    assert(deletions.every(body => body.confirmation === 'cashflow'))
    assert.equal(await page.getByRole('link', { name: 'Open cashflow console' }).count(), 0)
    assert.equal(await page.getByText('Danger actions', { exact: true }).count(), 0)
    failRestore = true
    await page.getByRole('button', { name: 'Restore VM', exact: true }).click()
    await page.getByText('Could not restore. Try again.', { exact: true }).waitFor()
    failRestore = false
    await page.getByRole('button', { name: 'Restore VM', exact: true }).click()
    await page.getByRole('link', { name: 'Open cashflow console' }).waitFor()
    assert.equal(restores, 2)
    for (const width of [390, 1200]) {
        await page.setViewportSize({ width, height: 800 })
        await page.getByText('Danger actions', { exact: true }).click()
        await open()
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        const box = await modal.boundingBox(); assert(box.width <= width && box.x >= 0)
        await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
        await page.getByText('Danger actions', { exact: true }).click()
    }
    assert.deepEqual(errors, []); assert.deepEqual(nativeDialogs, [])
    console.log('VM deletion UI: typed confirmation, accessible modal, retry, one-click restore and responsive layout passed.')
} finally { await browser.close(); server.stop(true) }
