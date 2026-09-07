import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

for (const [path, size] of [['hanasand-logo.png', 1254], ['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const { data, info } = await sharp(`public/${path}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    assert.equal(info.width, size)
    assert.equal(info.height, size)
    const alpha = data.filter((_, index) => index % 4 === 3)
    assert.equal(alpha[0], 0, `${path} must have transparent corners`)
    assert(alpha.filter(value => value === 0).length > alpha.length * 0.7, `${path} must have no background plate`)
    assert(alpha.some(value => value === 255), `${path} must retain visible artwork`)
}

const build = await Bun.build({ entrypoints: ['brand-fixture'], target: 'browser', plugins: [{ name: 'brand-fixture', setup(builder) {
    builder.onResolve({ filter: /^(brand-fixture|next\/link|next\/image)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/link'
        ? 'export default function Link({children,...props}){return <a {...props}>{children}</a>}'
        : args.path === 'next/image'
            ? 'export default function Image({priority,...props}){return <img {...props}/> }'
            : 'import {createRoot} from \'react-dom/client\'; import BrandLogo from \'./src/components/brand/brandLogo\'; createRoot(document.getElementById(\'root\')).render(<BrandLogo/>);',
    }))
} }] })
assert(build.success, build.logs.join('\n'))
const server = Bun.serve({ port: 0, async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/brand.js') return new Response(build.outputs[0], { headers: { 'content-type': 'text/javascript' } })
    if (path === '/hanasand-logo.png') return new Response(await readFile('public/hanasand-logo.png'), { headers: { 'content-type': 'image/png' } })
    return new Response('<!doctype html><div id="root"></div><script type="module" src="/brand.js"></script>', { headers: { 'content-type': 'text/html' } })
} })
const browser = await chromium.launch({ headless: true })
try {
    const page = await browser.newPage()
    await page.goto(String(server.url))
    const image = page.locator('img')
    await image.waitFor()
    assert.equal(await image.getAttribute('src'), '/hanasand-logo.png?v=transparent-1')
    assert(await image.evaluate(img => img.complete && img.naturalWidth === 1254))
    assert.equal(await image.evaluate(img => img.parentElement.tagName), 'A', 'Logo must have no decorative wrapper')
    assert(!/\b(?:bg-|border|shadow)/.test(await image.getAttribute('class')))
    assert.equal(await page.getByRole('link').getAttribute('href'), '/')
    console.log('Branding passed: transparent PNG variants, visible artwork, shared logo without background wrapper, and home link.')
} finally {
    await browser.close()
    server.stop(true)
}
