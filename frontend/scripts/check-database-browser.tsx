// @ts-nocheck -- This standalone browser harness uses Bun's build/server APIs.
import { chromium } from '@playwright/test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const temporary = await mkdtemp(path.join(tmpdir(), 'db-browser-ui-'))
const root = process.cwd()
const entry = path.join(temporary, 'entry.tsx')
await writeFile(entry, `import React from '${root}/node_modules/react/index.js';
import {createRoot} from '${root}/node_modules/react-dom/client.js';
import Workbench from '${root}/src/app/dashboard/db/databaseWorkbench.tsx';
import Connection from '${root}/src/app/dashboard/db/databaseConnection.tsx';
import Inventory from '${root}/src/app/dashboard/db/databaseInventory.tsx';
createRoot(document.getElementById('root')).render(<><Connection/><Workbench overview={{clusters:[]}}/><Inventory stale={false} instances={[{id:'test',engine:'PostgreSQL',status:'healthy',databases:[{name:'example',sizeBytes:1000,tableCount:1,connections:1,tables:[{schema:'public',name:'items',sizeBytes:100,columns:['id','value'],lastWriteObservedAt:null}]}]}]}/></>);`)
const build = await Bun.build({ entrypoints: [entry], target: 'browser', outdir: temporary, plugins: [{ name: 'server-actions', setup(builder) {
    builder.onResolve({ filter: /^react\/jsx/ }, args => ({ path: path.join(root, 'node_modules', args.path + '.js') }))
    builder.onLoad({ filter: /dashboard\/db\/actions\.ts$/ }, () => ({ contents: 'export async function databaseRowsAction(){return {rows:[],fields:[],rowCount:0}};export const databaseSqlAction=databaseRowsAction;', loader: 'js' }))
} }] })
assert(build.success, build.logs.join('\n'))
let checks = 0, healthFails = false
const pages: string[] = []
const server = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/bundle.js') return new Response(Bun.file(build.outputs[0].path))
    if (url.pathname === '/api/db/health') { checks++; return Response.json({ ok: !healthFails }, { status: healthFails ? 503 : 200 }) }
    if (url.pathname === '/api/db/browse') {
        const cursor = url.searchParams.get('cursor') || '0'; pages.push(cursor)
        if (cursor === '5') return Response.json({ rows: [], fields: ['id','value'], nextCursor: 'gap' })
        const offset = cursor === 'gap' ? 5 : Number(cursor)
        return Response.json({ rows: Array.from({ length: Math.min(5, 13 - offset) }, (_, n) => ({ id: offset+n, value: 'sample' })), fields: ['id','value'], nextCursor: offset < 10 ? String(offset+5) : null })
    }
    return new Response('<html><head><style>.max-h-80{max-height:320px}.overflow-auto{overflow:auto}.h-px{height:1px}td{padding:8px} [hidden]{display:none}</style></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>', { headers: { 'Content-Type': 'text/html' } })
} })
const browser = await chromium.launch({ headless: true })
try {
    const page = await browser.newPage()
    page.setDefaultTimeout(10000)
    page.on('pageerror', error => console.error(error.message))
    await page.clock.install()
    await page.goto(`http://localhost:${server.port}`)
    await page.getByText('Connected', { exact: true }).waitFor()
    assert.equal(await page.getByText(/Checked \d+s ago/).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Inspect rows' }).isVisible(), false)
    await page.keyboard.press('Meta+j')
    await page.getByRole('button', { name: 'Inspect rows' }).waitFor()
    await page.keyboard.press('Meta+j')
    assert.equal(await page.getByRole('button', { name: 'Inspect rows' }).isVisible(), false)
    await page.getByRole('button', { name: 'example', exact: true }).click()
    await page.getByRole('button', { name: /public.items/ }).click()
    for (let attempt = 0; attempt < 5 && !await page.getByText('13 rows · End of preview').count(); attempt++) {
        await page.getByLabel('items rows').scrollIntoViewIfNeeded()
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.getByLabel('items rows').evaluate(element => { element.scrollTop = element.scrollHeight })
        await page.waitForTimeout(100)
    }
    await page.getByText('13 rows · End of preview').waitFor()
    assert.deepEqual(pages, ['0','5','gap','10'])
    await page.clock.runFor(5100)
    await page.waitForFunction(() => document.body.textContent?.includes('Connected'))
    assert(checks >= 2)
    healthFails = true
    await page.clock.runFor(5100)
    await page.getByText('Unavailable', { exact: true }).waitFor()
    console.log(JSON.stringify({ result: 'passed', checks: ['collapsed workbench', 'Cmd+J', 'inline database expansion', 'five-row infinite pages', '5s health refresh', 'connection failure'] }))
} finally { await browser.close(); server.stop(); await rm(temporary, { recursive: true, force: true }) }
