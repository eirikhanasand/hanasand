import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

let bundle = ''
let streamLoads = 0
const css = (await Promise.all((await readdir('.next/static/css')).filter(file => file.endsWith('.css')).map(file => readFile(`.next/static/css/${file}`, 'utf8')))).join('\n')
const server = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/app.js') return new Response(bundle, { headers: { 'content-type': 'text/javascript' } })
    if (url.pathname === '/app.css') return new Response(css, { headers: { 'content-type': 'text/css' } })
    if (url.pathname.startsWith('/api/')) return Response.json({ runs: [], profiles: [] })
    if (url.pathname === '/stream/index.html') {
        streamLoads++
        return new Response('<html><body style="margin:0;background:white;color:black"><button onclick="window.remoteClicks=(window.remoteClicks||0)+1">Remote click</button><div style="height:2000px">Remote page</div></body></html>', { headers: { 'content-type': 'text/html' } })
    }
    return new Response('<html class="dark"><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>', { headers: { 'content-type': 'text/html' } })
} })
const build = await Bun.build({ entrypoints: ['browser-test-entry'], target: 'browser', define: { 'process.env': JSON.stringify({ NEXT_PUBLIC_API: `${server.url}api` }) }, plugins: [{ name: 'browser-fixture', setup(builder) {
    builder.onResolve({ filter: /^(browser-test-entry|next\/link)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'export default function Link(props){return <a {...props}/>}' : 'import {createRoot} from \'react-dom/client\'; import Browser from \'./src/app/browser/pageClient\'; createRoot(document.getElementById(\'root\')).render(<Browser initialData={{history:[],quota:null,stats:{runs24h:0,darkwebRuns24h:0}}}/>);' }))
} }] })
assert(build.success, build.logs.join('\n'))
bundle = await build.outputs[0].text()
const browser = await chromium.launch()
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
        window.browserMessages = []
        window.WebSocket = class {
            static OPEN = 1
            readyState = 1
            constructor() { window.testSocket = this; setTimeout(() => this.onopen?.(), 0) }
            send(message) { window.browserMessages.push(JSON.parse(message)) }
            close() { this.readyState = 3; this.onclose?.() }
        }
        window.deliver = payload => window.testSocket.onmessage({ data: JSON.stringify(payload) })
    })
    await page.goto(server.url.toString())
    await page.getByPlaceholder('URL to investigate').fill('https://example.com')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    const viewport = page.locator('[data-browser-viewport]')
    await viewport.waitFor()
    assert((await viewport.boundingBox()).height < 220, 'Waiting must not reserve a full-screen viewport')
    assert.equal(await page.getByRole('tablist').count(), 1)
    await page.evaluate(() => window.deliver({ type: 'ready' }))
    const image = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720
        const ctx = canvas.getContext('2d'); const pixels = ctx.createImageData(1280, 720)
        for (let i = 0; i < pixels.data.length; i += 4) { pixels.data[i] = i % 251; pixels.data[i + 1] = i % 191; pixels.data[i + 2] = i % 139; pixels.data[i + 3] = 255 }
        ctx.putImageData(pixels, 0, 0); return canvas.toDataURL('image/jpeg').split(',')[1]
    })
    await page.evaluate(image => window.deliver({ type: 'frame', image, width: 1280, height: 720, url: 'https://example.com' }), image)
    await page.getByAltText('Live browser sandbox frame').waitFor()
    const box = await viewport.boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    const pointers = await page.evaluate(() => window.browserMessages.filter(message => message.type === 'pointer'))
    assert.equal(pointers.filter(message => message.event === 'pointerdown').length, 1)
    assert.equal(pointers.filter(message => message.event === 'pointerup').length, 1)
    assert(Math.abs(pointers.at(-1).x - 640) < 2 && Math.abs(pointers.at(-1).y - 360) < 2, 'Map the contained image, not letterbox space')
    assert.equal(await page.evaluate(() => window.browserMessages.filter(message => message.type === 'click').length), 0, 'A pointer click must not also send a duplicate click command')
    await page.mouse.wheel(0, 180)
    await page.waitForFunction(() => window.browserMessages.some(message => message.type === 'wheel' && message.deltaY === 180))
    await page.evaluate(url => window.deliver({ type: 'stream_ready', streamUrl: url }), `${server.url}stream/index.html`)
    const iframe = page.getByTitle('Live WebRTC browser sandbox')
    await iframe.waitFor()
    const frame = page.frameLocator('iframe')
    await frame.getByRole('button', { name: 'Remote click' }).waitFor()
    assert((await viewport.boundingBox()).height <= 180, 'Keep the player compact before its first video frame')
    const nativeFrame = page.frames().find(frame => frame.url().includes('/stream/index.html'))
    await nativeFrame.evaluate(() => parent.postMessage({ type: 'hanasand-browser-stream', state: 'ready' }, location.origin))
    await page.waitForFunction(() => document.querySelector('[data-browser-viewport]').getBoundingClientRect().height > 300)
    for (const name of ['VirusTotal', 'urlquery', 'WebCrack', 'Browser', 'VirusTotal', 'Browser']) await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
    assert.equal(streamLoads, 1, 'Switching tools must preserve the stream document and connection')
    const beforeInput = await page.evaluate(() => window.browserMessages.length)
    await frame.getByRole('button', { name: 'Remote click' }).click()
    assert.equal(await nativeFrame.evaluate(() => window.remoteClicks), 1)
    assert.equal(await page.evaluate(() => window.browserMessages.length), beforeInput, 'Native stream input must not also use screenshot input forwarding')
    const streamBox = await iframe.boundingBox()
    await page.mouse.move(streamBox.x + 150, streamBox.y + 100)
    await page.mouse.wheel(0, 300)
    await nativeFrame.waitForFunction(() => scrollY > 0)
    await page.getByRole('tab', { name: /^Browser/ }).focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.getByRole('tab', { name: /^VirusTotal/ }).getAttribute('aria-selected'), 'true')
    await page.setViewportSize({ width: 390, height: 844 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile workspace must not overflow horizontally')
    assert.equal(streamLoads, 1, 'Responsive changes must not recreate the stream')
    const mobileViewport = await viewport.boundingBox()
    assert(mobileViewport.x + mobileViewport.width <= 390, `Viewport clipped at ${mobileViewport.x + mobileViewport.width}px`)
    if (process.env.BROWSER_WORKSPACE_SCREENSHOT) {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.screenshot({ path: process.env.BROWSER_WORKSPACE_SCREENSHOT.replace('.png', '-desktop.png'), fullPage: false })
        await page.setViewportSize({ width: 390, height: 844 })
    }
    if (process.env.BROWSER_WORKSPACE_SCREENSHOT) await page.screenshot({ path: process.env.BROWSER_WORKSPACE_SCREENSHOT, fullPage: true })
    assert.deepEqual(errors, [])
    console.log('Browser workspace passed: compact waiting, single toolbar, stable stream, native click/scroll, screenshot coordinates, keyboard tabs, and mobile width.')
} finally { await browser.close(); server.stop(true) }
