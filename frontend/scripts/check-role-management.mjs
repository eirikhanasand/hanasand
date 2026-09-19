import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { chromium, expect } from '@playwright/test'

let roles = [
    { id: 'administrator', name: 'Administrator', description: 'Full access.', priority: 0 },
    { id: 'system_admin', name: 'System Administrator', description: 'Manages infrastructure.', priority: 20 },
    { id: 'user_admin', name: 'User Administrator', description: 'Manages user accounts.', priority: 40 },
    { id: 'content_admin', name: 'Content Administrator', description: 'Manages published content.', priority: 60 },
    { id: 'users', name: 'Users', description: 'Standard access.', priority: 200 },
    { id: 'support', name: 'Support', description: 'Helps customers.', priority: 1000 },
]
let failNext = false
const build = await Bun.build({ entrypoints: ['roles-entry'], target: 'browser', plugins: [{ name: 'role-fixture', setup(builder) {
    builder.onResolve({ filter: /^(roles-entry|next\/navigation|next\/link|@\/config)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/navigation'
        ? 'export const useRouter=()=>({refresh:()=>window.refreshRoles()})'
        : args.path === 'next/link' ? 'export default function Link(props){return <a {...props}/>}'
            : args.path === '@/config' ? 'export default {url:{api:"/api"},abortTimeout:5000}'
                : 'import {createRoot} from \'react-dom/client\';import RoleList from \'./src/components/roles/roleList\';const root=createRoot(document.getElementById(\'root\'));window.canManage=true;window.refreshRoles=async()=>root.render(<RoleList roles={await (await fetch(\'/api/roles\')).json()} canManage={window.canManage} highestPriority={0}/>);window.refreshRoles();',
    }))
} }] })
assert(build.success, build.logs.join('\n'))
const css = (await postcss([tailwind()]).process(await readFile('src/app/globals.css', 'utf8'), { from: 'src/app/globals.css' })).css
const server = Bun.serve({ port: 0, async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/app.js') return new Response(build.outputs[0], { headers: { 'content-type': 'text/javascript' } })
    if (path === '/app.css') return new Response(css, { headers: { 'content-type': 'text/css' } })
    if (path === '/api/roles') return Response.json(roles)
    if (path.startsWith('/api/role')) {
        if (failNext) { failNext = false; return Response.json({ error: 'Audit unavailable; change not saved.' }, { status: 500 }) }
        const body = await request.json()
        const id = path.split('/')[3] || body.id
        const role = { ...roles.find(role => role.id === id), ...body, id }
        roles = [...roles.filter(role => role.id !== id), role]
        return Response.json(role)
    }
    return new Response('<!doctype html><html class="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body style="padding:16px;background:var(--ui-canvas)"><main id="root" style="max-width:1000px;margin:auto"></main><script type="module" src="/app.js"></script></body></html>', { headers: { 'content-type': 'text/html' } })
} })
const browser = await chromium.launch()
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.context().addCookies(['id', 'access_token'].map(name => ({ name, value: 'fixture-admin', url: server.url.origin })))
    await page.goto(server.url.origin)
    await expect(page.locator('[data-role-icon]')).toHaveCount(6)
    assert.equal(new Set(await page.locator('[data-role-icon]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-role-icon')))).size, 6)
    await page.getByRole('button', { name: 'Edit roles', exact: true }).click()
    await page.getByRole('button', { name: 'Edit Administrator', exact: true }).click()
    await expect(page.getByRole('spinbutton')).toBeDisabled()
    await expect(page.getByRole('spinbutton')).toHaveValue('0')
    await expect(page.getByRole('button', { name: 'Delete Administrator', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: 'Edit Support', exact: true }).click()
    const priority = page.getByRole('spinbutton')
    await priority.fill('0')
    expect(await priority.evaluate(input => input.checkValidity())).toBe(false)
    await priority.fill('10')
    await page.getByRole('button', { name: 'Choose role icon' }).click()
    const catalog = page.getByRole('region', { name: 'Icon catalog' })
    await expect(catalog.locator('button[aria-pressed]')).toHaveCount(100)
    assert.equal(new Set(await catalog.locator('button[aria-pressed]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).size, 100)
    for (const width of [360, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const box = await catalog.boundingBox()
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(width)
        const iconBox = await catalog.getByRole('button', { name: 'Administrator icon', exact: true }).boundingBox()
        expect(iconBox.width).toBeGreaterThanOrEqual(44)
        expect(iconBox.height).toBeGreaterThanOrEqual(44)
        if (process.env.ROLE_SCREENSHOTS && [390, 1440].includes(width)) await page.screenshot({ path: `/tmp/role-editor-${width}.png`, fullPage: true })
    }
    await catalog.getByLabel('Category', { exact: true }).selectOption('Engineering')
    await expect(catalog.getByRole('status')).toHaveText('10 icons')
    await catalog.getByLabel('Category', { exact: true }).selectOption('All icons')
    await catalog.getByLabel('Category', { exact: true }).selectOption('Data & AI')
    await expect(catalog.getByRole('status')).toHaveText('10 icons')
    await catalog.getByLabel('Search icons', { exact: true }).fill('Backup')
    await catalog.getByRole('button', { name: 'Backup operator icon', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Choose role icon' })).toBeFocused()
    failNext = true
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Audit unavailable; change not saved.')).toBeVisible()
    await expect(priority).toHaveValue('10')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Role saved.')
    await page.reload()
    await page.getByRole('button', { name: 'Edit roles', exact: true }).click()
    await page.getByRole('button', { name: 'Edit Support', exact: true }).click()
    await expect(priority).toHaveValue('10')
    await expect(page.getByRole('button', { name: 'Choose role icon' }).locator('[data-role-icon]')).toHaveAttribute('data-role-icon', 'database-backup')
    await page.getByRole('button', { name: 'Choose role icon' }).click()
    await page.keyboard.press('Escape')
    await expect(catalog).toHaveCount(0)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.evaluate(() => { window.canManage = false; window.refreshRoles() })
    await expect(page.getByRole('button', { name: 'Edit roles', exact: true })).toHaveCount(0)
    console.log('Role editor passed: fixed admin priority, 100 presets, distinct defaults, search/categories, persistence, audit failure recovery, keyboard, read-only access and 360–1440px layouts.')
} finally { await browser.close(); server.stop(true) }
