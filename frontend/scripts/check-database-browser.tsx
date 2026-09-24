// @ts-nocheck -- This standalone browser harness uses Bun's build/server APIs.
import { chromium } from '@playwright/test'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'

const temporary = await mkdtemp(path.join(tmpdir(), 'db-browser-ui-'))
const root = process.cwd()
const css = (await postcss([tailwind()]).process(await readFile(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') })).css
const fields = ['id', ...Array.from({length: 24}, (_, n) => `column_${n}`)]
const entry = path.join(temporary, 'entry.tsx')
await writeFile(entry, `import React from '${root}/node_modules/react/index.js';
import {createRoot} from '${root}/node_modules/react-dom/client.js';
import Workbench from '${root}/src/app/dashboard/db/databaseWorkbench.tsx';
import Inventory from '${root}/src/app/dashboard/db/databaseInventory.tsx';
createRoot(document.getElementById('root')).render(<><Workbench overview={{clusters:[]}}/><Inventory stale={false} instances={[{id:'test',engine:'PostgreSQL',status:'healthy',databases:[{name:'example',sizeBytes:1000,tableCount:1,connections:1,tables:[{schema:'public',name:'items',sizeBytes:1000,columns:${JSON.stringify(fields)},lastWriteObservedAt:null},...Array.from({length: 7},(_,n)=>({schema:'public',name:'extra_'+n,sizeBytes:n*100,columns:['id'],lastWriteObservedAt:'2026-09-'+String(10+n)+'T00:00:00Z'}))]}]},...Array.from({length:5},(_,n)=>({id:'instance_'+n,engine:'PostgreSQL',status:n<2?'unhealthy':'healthy',databases:[{name:'db_'+n,sizeBytes:(n+2)*1000,tableCount:n+2,connections:n+2,tables:[]}]}))]}/></>);`)
const build = await Bun.build({ entrypoints: [entry], target: 'browser', outdir: temporary, plugins: [{ name: 'server-actions', setup(builder) {
    builder.onResolve({ filter: /^react\/jsx/ }, args => ({ path: path.join(root, 'node_modules', args.path + '.js') }))
    builder.onLoad({ filter: /dashboard\/db\/actions\.ts$/ }, () => ({ contents: 'export async function databaseRowsAction(){return {rows:[],fields:[],rowCount:0}};export const databaseSqlAction=databaseRowsAction;', loader: 'js' }))
} }] })
assert(build.success, build.logs.join('\n'))
let checks = 0, healthFails = false, rowCount = 13
const pages: string[] = []
const server = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/bundle.js') return new Response(Bun.file(build.outputs[0].path))
    if (url.pathname === '/api/db/health') { checks++; return Response.json({ ok: !healthFails }, { status: healthFails ? 503 : 200 }) }
    if (url.pathname === '/api/db/browse') {
        if (url.searchParams.get('mode') === 'count') return Response.json({ totalRows: rowCount, nextCursor: null })
        const cursor = url.searchParams.get('cursor') || '0'; pages.push(cursor)
        if (cursor === '5') return Response.json({ rows: [], fields, nextCursor: 'gap' })
        const offset = cursor === 'gap' ? 5 : Number(cursor)
        return Response.json({ rows: Array.from({ length: Math.min(5, rowCount - offset) }, (_, n) => ({ id: offset+n, ...Object.fromEntries(fields.slice(1).map(field => [field, 'x'.repeat(500)])) })), fields, nextCursor: offset + 5 < rowCount ? String(offset+5) : null })
    }
    return new Response(`<html><head><style>${css}</style></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>`, { headers: { 'Content-Type': 'text/html' } })
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
    assert.equal(await page.locator('[data-db-workbench]').isVisible(), false)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.getByRole('heading', { name: 'Search', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.keyboard.press('Meta+j')
    await page.getByRole('button', { name: 'Inspect rows' }).waitFor()
    await page.keyboard.press('Meta+j')
    assert.equal(await page.getByRole('button', { name: 'Inspect rows' }).isVisible(), false)
    const databaseNames = () => page.locator('[data-database-row] td:first-child button').allTextContents()
    assert.deepEqual(await databaseNames(), ['db_1','db_0','db_4','db_3','db_2','example'])
    const databaseViewport = page.getByLabel('Databases', { exact: true })
    assert(await databaseViewport.evaluate(element => element.scrollHeight > element.clientHeight))
    const databaseSize = await databaseViewport.evaluate(element => ({ height: element.clientHeight, five: element.querySelector('thead').getBoundingClientRect().height + Array.from(element.querySelectorAll('[data-database-row]')).slice(0,5).reduce((sum, row) => sum + row.getBoundingClientRect().height, 1) }))
    assert(Math.abs(databaseSize.height - databaseSize.five) <= 1)
    for (const column of ['database','instance','tables / keys','connections','size']) {
        await page.getByRole('button', { name: `Sort by ${column} ascending`, exact: true }).click()
        const ascending = await databaseNames()
        await page.getByRole('button', { name: `Sort by ${column} descending`, exact: true }).click()
        assert.deepEqual(await databaseNames(), ascending.reverse(), column)
    }
    await page.getByRole('button', { name: 'Sort by health ascending', exact: true }).click()
    assert.deepEqual(await databaseNames(), ['db_1','db_0','db_4','db_3','db_2','example'])
    await page.getByRole('button', { name: 'Sort by health descending', exact: true }).click()
    assert.deepEqual(await databaseNames(), ['db_4','db_3','db_2','example','db_1','db_0'])
    await page.getByRole('button', { name: 'example', exact: true }).click()
    const contentsSort = page.getByLabel('Sort database contents')
    const itemNames = () => page.locator('[data-table-selector] > span:first-child').allTextContents()
    assert.equal((await itemNames())[0], 'public.items')
    await contentsSort.getByRole('button', { name: 'Sort by size ascending' }).click()
    assert.equal((await itemNames())[0], 'public.extra_0')
    await contentsSort.getByRole('button', { name: 'Sort by name ascending' }).click()
    assert.equal((await itemNames())[0], 'public.extra_0')
    await contentsSort.getByRole('button', { name: 'Sort by name descending' }).click()
    assert.equal((await itemNames())[0], 'public.items')
    await contentsSort.getByRole('button', { name: 'Sort by last write ascending' }).click()
    assert.equal((await itemNames())[0], 'public.extra_0')
    assert.equal((await itemNames()).at(-1), 'public.items')
    await contentsSort.getByRole('button', { name: 'Sort by last write descending' }).click()
    assert.equal((await itemNames())[0], 'public.extra_6')
    assert.equal((await itemNames()).at(-1), 'public.items')
    await contentsSort.getByRole('button', { name: 'Sort by size ascending' }).click()
    await contentsSort.getByRole('button', { name: 'Sort by size descending' }).click()
    const search = page.getByRole('searchbox', { name: 'Search tables' })
    await search.waitFor()
    assert.equal(await page.getByText('Last write: Never', { exact: false }).count(), 0)
    const list = page.locator('[data-table-selector]').first().locator('../..')
    assert(await list.evaluate(element => element.scrollHeight > element.clientHeight))
    const listSize = await list.evaluate(element => ({ height: element.clientHeight, five: Array.from(element.querySelectorAll('[data-table-selector]')).slice(0,5).reduce((sum, button) => sum + button.getBoundingClientRect().height + 2, 48) }))
    assert(Math.abs(listSize.height - listSize.five) <= 1)
    await page.keyboard.press('Meta+x')
    assert(await search.evaluate(element => element === document.activeElement))
    await search.fill('extra_6')
    assert.equal(await page.locator('[data-table-selector]').count(), 1)
    await search.fill('not-a-table')
    await page.getByText('No matching tables.').waitFor()
    await search.fill('')
    await page.getByRole('button', { name: /public.items/ }).click()
    await page.getByText('5/13 rows', { exact: true }).waitFor()
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 760 })
        const sizes = await page.getByLabel('items rows').evaluate(element => ({
            page: document.documentElement.scrollWidth, viewport: window.innerWidth,
            inner: element.scrollWidth, outer: element.clientWidth,
        }))
        assert(sizes.page <= sizes.viewport, `Page overflow at ${width}: ${JSON.stringify(sizes)}`)
        assert(sizes.inner > sizes.outer, 'Wide columns must scroll inside the preview')
        await page.getByLabel('items rows').evaluate(element => { element.scrollLeft = 100 })
        assert(await page.getByLabel('items rows').evaluate(element => element.scrollLeft > 0))
    }
    for (let attempt = 0; attempt < 5 && !await page.getByText('13/13 rows').count(); attempt++) {
        await page.getByLabel('items rows').scrollIntoViewIfNeeded()
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.getByLabel('items rows').evaluate(element => { element.scrollTop = element.scrollHeight })
        await page.waitForTimeout(100)
    }
    await page.getByText('13/13 rows').waitFor()
    assert.deepEqual(pages, ['0','5','gap','10'])
    for (const count of [1, 0]) {
        await page.getByRole('button', { name: /public.items/ }).click()
        rowCount = count
        await page.getByRole('button', { name: /public.items/ }).click()
        await page.getByText(`${count}/${count} ${count === 1 ? 'row' : 'rows'}`, { exact: true }).waitFor()
    }
    await page.clock.runFor(5100)
    await page.waitForFunction(() => document.body.textContent?.includes('Connected'))
    assert(checks >= 2)
    healthFails = true
    await page.clock.runFor(5100)
    await page.getByText('Unavailable', { exact: true }).waitFor()
    console.log(JSON.stringify({ result: 'passed', checks: ['collapsed workbench', 'Cmd+J', 'inline database expansion', 'five-row infinite pages', 'partial and complete row counts', 'wide table containment at desktop and mobile widths', '5s health refresh', 'connection failure'] }))
} finally { await browser.close(); server.stop(); await rm(temporary, { recursive: true, force: true }) }
