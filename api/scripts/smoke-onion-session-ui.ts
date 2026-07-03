import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdir } from 'node:fs/promises'
import { WebSocketServer } from 'ws'
import { chromium } from 'playwright'
import { handleOnionSessionSocket } from '../src/handlers/onionSession/ws.ts'

const frontendBase = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000'
const brokerPort = Number(process.env.ONION_SESSION_SMOKE_BROKER_PORT || 8080)
const targetPort = Number(process.env.ONION_SESSION_SMOKE_TARGET_PORT || 8198)
const screenshotDir = process.env.ONION_SESSION_SCREENSHOT_DIR || ''

delete process.env.ONION_SESSION_PROXY
delete process.env.TOR_SOCKS_PROXY
process.env.CHROMIUM_BIN ||= chromium.executablePath()

const targetServer = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(`<!doctype html>
<html>
  <head>
    <title>Live onion UI target</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
      main { padding: 32px; }
      input { position: absolute; left: 96px; top: 32px; width: 360px; height: 42px; font-size: 20px; }
      button { position: absolute; left: 96px; top: 104px; width: 180px; height: 56px; font-size: 18px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Live remote frame target</h1>
      <input autofocus value="" oninput="console.log('remote-input:' + this.value)">
      <button onclick="document.body.dataset.clicked = 'true'; console.log('live-ui-clicked')">Remote click target</button>
    </main>
  </body>
</html>`)
})

await listen(targetServer, targetPort)
const targetUrl = `http://127.0.0.1:${targetPort}/`

const brokerServer = new WebSocketServer({ host: '127.0.0.1', port: brokerPort })
await onceListening(brokerServer)
brokerServer.on('connection', (connection) => {
    handleOnionSessionSocket(connection, `live-ui-${Date.now().toString(36)}`)
})

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await context.newPage()
const consoleMessages: string[] = []
page.on('console', (message) => consoleMessages.push(message.text()))
let clickPosition: { x: number, y: number } | null = null

try {
    if (screenshotDir) await mkdir(screenshotDir, { recursive: true })
    await page.goto(`${frontendBase}/solutions/onion-session`, { waitUntil: 'networkidle' })
    await page.locator('[data-onion-target-input]').fill(targetUrl)
    if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/01-onion-ready.png`, fullPage: true })
    await page.locator('[data-onion-action="start"]').click()
    await page.getByAltText('Live remote Tor browser frame').waitFor({ state: 'visible', timeout: 25_000 })
    if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/02-onion-live-frame.png`, fullPage: true })

    const canvas = page.locator('canvas[aria-label="Interactive remote Tor browser viewport"]')
    clickPosition = await canvas.evaluate((canvas) => {
        const frame = document.querySelector<HTMLImageElement>('img[alt="Live remote Tor browser frame"]')
        if (!frame) throw new Error('missing live remote frame')
        const rect = canvas.getBoundingClientRect()
        const frameWidth = Number(frame.getAttribute('width') || 900)
        const frameHeight = Number(frame.getAttribute('height') || 540)
        const scale = Math.min(rect.width / frameWidth, rect.height / frameHeight)
        const offsetX = (rect.width - frameWidth * scale) / 2
        const offsetY = (rect.height - frameHeight * scale) / 2

        return {
            x: offsetX + 186 * scale,
            y: offsetY + 132 * scale,
        }
    })
    await canvas.click({ position: clickPosition })
    const remoteClickObserved = await page.waitForFunction(() => document.body.textContent?.includes('Remote console: live-ui-clicked'), null, { timeout: 10_000 }).then(() => true)

    const inputPosition = await canvas.evaluate((canvas) => {
        const frame = document.querySelector<HTMLImageElement>('img[alt="Live remote Tor browser frame"]')
        if (!frame) throw new Error('missing live remote frame')
        const rect = canvas.getBoundingClientRect()
        const frameWidth = Number(frame.getAttribute('width') || 900)
        const frameHeight = Number(frame.getAttribute('height') || 540)
        const scale = Math.min(rect.width / frameWidth, rect.height / frameHeight)
        const offsetX = (rect.width - frameWidth * scale) / 2
        const offsetY = (rect.height - frameHeight * scale) / 2

        return {
            x: offsetX + 150 * scale,
            y: offsetY + 54 * scale,
        }
    })
    await canvas.click({ position: inputPosition })
    await page.evaluate(() => navigator.clipboard.writeText('remote-clipboard-proof'))
    await canvas.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')
    const remotePasteObserved = await page.waitForFunction(() => document.body.textContent?.includes('Remote console: remote-input:remote-clipboard-proof'), null, { timeout: 10_000 }).then(() => true)
    if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/03-onion-remote-paste.png`, fullPage: true })

    const result = await page.evaluate(() => ({
        h1: document.querySelector('h1')?.textContent || '',
        statusText: document.body.textContent || '',
        liveFrameVisible: Boolean(document.querySelector('img[alt="Live remote Tor browser frame"]')),
        brokerOpen: document.body.textContent?.includes('Brokeropen') || document.body.textContent?.includes('Broker open') || false,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        viewportCursor: window.getComputedStyle(document.querySelector('canvas[aria-label="Interactive remote Tor browser viewport"]') as Element).cursor,
    }))

    assert.equal(result.h1, 'Remote Tor Browser')
    assert.equal(result.liveFrameVisible, true)
    assert.equal(result.brokerOpen, true)
    assert.equal(result.viewportCursor, 'default')
    assert.equal(remoteClickObserved, true)
    assert.equal(remotePasteObserved, true)
    assert.equal(result.horizontalOverflow, 0)

    console.log(JSON.stringify({
        ok: true,
        targetUrl,
        result: {
            h1: result.h1,
            liveFrameVisible: result.liveFrameVisible,
            brokerOpen: result.brokerOpen,
            viewportCursor: result.viewportCursor,
            horizontalOverflow: result.horizontalOverflow,
            remoteClickObserved,
            remotePasteObserved,
        },
        consoleMessages,
        screenshots: screenshotDir ? [
            `${screenshotDir}/01-onion-ready.png`,
            `${screenshotDir}/02-onion-live-frame.png`,
            `${screenshotDir}/03-onion-remote-paste.png`,
        ] : [],
    }, null, 2))
} catch (error) {
    const debug = await page.evaluate(() => ({
        text: document.body.textContent?.slice(0, 4000) || '',
        canvas: (() => {
            const canvas = document.querySelector('canvas[aria-label="Interactive remote Tor browser viewport"]')
            const rect = canvas?.getBoundingClientRect()
            return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
        })(),
        frame: (() => {
            const frame = document.querySelector<HTMLImageElement>('img[alt="Live remote Tor browser frame"]')
            const rect = frame?.getBoundingClientRect()
            return frame && rect ? {
                attrWidth: frame.getAttribute('width'),
                attrHeight: frame.getAttribute('height'),
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            } : null
        })(),
    })).catch(() => null)
    console.error(JSON.stringify({ ok: false, clickPosition, debug, consoleMessages }, null, 2))
    throw error
} finally {
    await browser.close().catch(() => undefined)
    brokerServer.close()
    targetServer.close()
}

function listen(server: http.Server, port: number) {
    return new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '127.0.0.1', () => resolve())
    })
}

function onceListening(server: WebSocketServer) {
    return new Promise<void>((resolve) => {
        if (server.address()) {
            resolve()
            return
        }
        server.once('listening', () => resolve())
    })
}
