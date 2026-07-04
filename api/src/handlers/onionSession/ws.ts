import WebSocket, { type RawData } from 'ws'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import recordLog from '#utils/logs/recordLog.ts'

type BrokerMessage = {
    type?: string
    sessionId?: string
    network?: 'tor' | 'regular'
    target?: string
    durationMinutes?: number
    profileTools?: Array<{ id?: string; name?: string; url?: string }>
    width?: number
    height?: number
    x?: number
    y?: number
    deltaX?: number
    deltaY?: number
    event?: string
    button?: number
    buttons?: number
    key?: string
    ctrlKey?: boolean
    metaKey?: boolean
    altKey?: boolean
    shiftKey?: boolean
    text?: string
    direction?: string
}

const DEFAULT_TARGET = 'http://sample-intel-source.onion'
const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 760
const MAX_DURATION_MS = 60 * 60 * 1000
const FRAME_INTERVAL_MS = 900

export function handleOnionSessionSocket(connection: WebSocket, sessionId: string, defaultNetwork: 'tor' | 'regular' = 'tor') {
    let browser: Browser | null = null
    let page: Page | null = null
    let frameTimer: NodeJS.Timeout | null = null
    let closeTimer: NodeJS.Timeout | null = null
    let closed = false
    let lastFrame = ''
    let remoteClipboard = ''
    let editableSelectAllArmed = false
    let messageQueue = Promise.resolve()

    const send = (payload: Record<string, unknown>) => {
        if (connection.readyState === connection.OPEN) {
            connection.send(JSON.stringify(payload))
        }
    }

    const cleanup = async () => {
        closed = true
        if (frameTimer) clearInterval(frameTimer)
        if (closeTimer) clearTimeout(closeTimer)
        frameTimer = null
        closeTimer = null
        await browser?.close().catch(() => undefined)
        browser = null
        page = null
    }

    connection.on('message', (message) => {
        messageQueue = messageQueue.then(() => handleMessage(message)).catch((error) => {
            send({
                type: 'error',
                message: error instanceof Error ? error.message : String(error),
            })
        })
    })

    connection.on('close', () => {
        void cleanup()
    })

    connection.on('error', (error) => {
        void recordLog({
            level: 'warn',
            service: 'hanasand-api',
            message: `Onion session websocket failed for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
            metadata: { category: 'websocket_failure', kind: 'onion-session', sessionId },
        }).catch(() => undefined)
    })

    async function handleMessage(raw: RawData) {
        const message = parseMessage(raw)
        if (!message?.type) return

        if (message.type === 'start') {
            await startBrowser(message)
            return
        }

        if (message.type === 'end') {
            await cleanup()
            send({ type: 'ended', sessionId })
            connection.close()
            return
        }

        if (!page) {
            send({ type: 'status', state: 'waiting_for_start' })
            return
        }

        if (message.type === 'pointer' || message.type === 'click') {
            await handlePointer(message)
            return
        }

        if (message.type === 'wheel') {
            await handleWheel(message)
            return
        }

        if (message.type === 'key') {
            await handleKey(message)
            return
        }

        if (message.type === 'navigate') {
            await navigate(message.target || DEFAULT_TARGET)
            return
        }

        if (message.type === 'clipboard') {
            if (message.direction === 'remote-to-browser') {
                const text = await readRemoteClipboard()
                send({ type: 'clipboard', direction: 'remote-to-browser', ok: true, text })
            } else {
                remoteClipboard = String(message.text || '')
                await page.evaluate((text) => navigator.clipboard?.writeText?.(text).catch(() => undefined), remoteClipboard).catch(() => undefined)
                send({ type: 'clipboard', direction: 'browser-to-remote', ok: true })
            }
            return
        }

        if (message.type === 'resize') {
            await page.setViewportSize({
                width: clampNumber(message.width, 640, 2400, DEFAULT_WIDTH),
                height: clampNumber(message.height, 420, 1600, DEFAULT_HEIGHT),
            })
            await sendFrame(true)
        }
    }

    async function startBrowser(message: BrokerMessage) {
        await cleanup()
        closed = false
        remoteClipboard = ''
        const target = normalizeTarget(message.target || DEFAULT_TARGET)
        const network = message.network === 'regular' ? 'regular' : defaultNetwork
        const proxy = network === 'tor' ? process.env.ONION_SESSION_PROXY || process.env.TOR_SOCKS_PROXY || '' : ''
        const durationMs = Math.min(MAX_DURATION_MS, Math.max(60_000, (message.durationMinutes || 15) * 60_000))

        send({
            type: 'status',
            state: 'launching',
            sessionId,
            network,
            torProxyConfigured: Boolean(proxy),
            message: network === 'regular'
                ? 'Launching isolated regular-web browser with a fresh context.'
                : proxy ? 'Launching isolated browser through configured Tor proxy.' : 'Launching isolated browser without Tor proxy; configure ONION_SESSION_PROXY or TOR_SOCKS_PROXY for onion routing.',
        })

        browser = await chromium.launch({
            headless: true,
            executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium-browser',
            proxy: proxy ? { server: proxy } : undefined,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-background-networking',
            ],
        })
        const context = await browser.newContext({
            viewport: {
                width: clampNumber(message.width, 640, 2400, DEFAULT_WIDTH),
                height: clampNumber(message.height, 420, 1600, DEFAULT_HEIGHT),
            },
            ignoreHTTPSErrors: true,
            permissions: ['clipboard-read', 'clipboard-write'],
        })
        page = await context.newPage()
        page.on('console', (entry) => send({ type: 'console', level: entry.type(), text: entry.text() }))
        page.on('pageerror', (error) => send({ type: 'pageerror', message: error.message }))
        page.on('framenavigated', (frame) => {
            if (frame !== page?.mainFrame()) return
            send({ type: 'status', state: 'navigated', url: page.url(), sessionId })
            void sendFrame(true, 'navigation')
        })

        closeTimer = setTimeout(() => {
            void cleanup()
            send({ type: 'ended', reason: 'timeout', sessionId })
            connection.close()
        }, durationMs)

        await navigate(target)
        await captureProfileTools(context, message.profileTools || [], target)
        frameTimer = setInterval(() => {
            void sendFrame(false)
        }, FRAME_INTERVAL_MS)
        send({ type: 'ready', sessionId, target, network, torProxyConfigured: Boolean(proxy) })
    }

    async function captureProfileTools(context: BrowserContext, tools: Array<{ id?: string; name?: string; url?: string }>, target: string) {
        for (const tool of tools.slice(0, 6)) {
            if (!tool.url) continue
            const toolPage = await context.newPage().catch(() => null)
            if (!toolPage) continue
            const startedAt = new Date().toISOString()
            const toolUrl = tool.url.replaceAll('{url}', encodeURIComponent(target)).replaceAll('{rawUrl}', target)
            try {
                await toolPage.goto(toolUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 })
                await toolPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
                const buffer = await toolPage.screenshot({ type: 'jpeg', quality: 64, animations: 'disabled' }).catch(() => null)
                send({
                    type: 'tool_capture',
                    sessionId,
                    id: tool.id || safeToolId(tool.name || toolUrl),
                    name: tool.name || toolUrl,
                    url: toolPage.url(),
                    title: await toolPage.title().catch(() => ''),
                    capturedAt: startedAt,
                    image: buffer ? buffer.toString('base64') : null,
                    target,
                })
            } catch (error) {
                send({
                    type: 'tool_capture',
                    sessionId,
                    id: tool.id || safeToolId(tool.name || toolUrl),
                    name: tool.name || toolUrl,
                    url: toolUrl,
                    capturedAt: startedAt,
                    error: error instanceof Error ? error.message : String(error),
                    target,
                })
            } finally {
                await toolPage.close().catch(() => undefined)
            }
        }
    }

    async function navigate(value: string) {
        if (!page) return
        const target = normalizeTarget(value)
        send({ type: 'status', state: 'navigating', target })
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 25_000 }).catch((error) => {
            send({ type: 'navigation_error', target, message: error instanceof Error ? error.message : String(error) })
        })
        await sendFrame(true)
    }

    async function handlePointer(message: BrokerMessage) {
        if (!page) return
        const x = clampNumber(message.x, 0, 2400, 0)
        const y = clampNumber(message.y, 0, 1600, 0)
        if (message.type === 'click') {
            await page.mouse.click(x, y, { button: mouseButton(message.button) })
        } else {
            await page.mouse.move(x, y)
            if (message.event === 'pointerdown') {
                await page.mouse.down({ button: mouseButton(message.button) }).catch(() => undefined)
            } else if (message.event === 'pointerup') {
                await page.mouse.up({ button: mouseButton(message.button) }).catch(() => undefined)
            } else if (message.buttons) {
                await page.mouse.down({ button: mouseButton(message.button) }).catch(() => undefined)
            }
        }
        await sendFrame(false)
    }

    async function handleWheel(message: BrokerMessage) {
        if (!page) return
        const deltaX = clampNumber(message.deltaX, -1600, 1600, 0)
        const deltaY = clampNumber(message.deltaY, -1600, 1600, 0)
        if (typeof message.x === 'number' && typeof message.y === 'number') {
            await page.mouse.move(clampNumber(message.x, 0, 2400, 0), clampNumber(message.y, 0, 1600, 0)).catch(() => undefined)
        }
        await page.mouse.wheel(deltaX, deltaY)
        await sendFrame(false)
    }

    async function handleKey(message: BrokerMessage) {
        if (!page || !message.key) return
        const shortcut = keyShortcut(message)
        if (isPasteShortcut(message) && remoteClipboard) {
            editableSelectAllArmed = false
            await page.keyboard.insertText(remoteClipboard)
        } else if (isSelectAllShortcut(message) && await selectEditableText()) {
            editableSelectAllArmed = true
            // The client may be on macOS while the remote browser is Linux-like; normalize select-all in editable fields.
        } else if (shortcut) {
            let selectedText = isCopyShortcut(message) ? await readSelectedText() : ''
            if (isCopyShortcut(message) && !selectedText && editableSelectAllArmed) {
                selectedText = await readEditableValue()
            }
            await page.keyboard.press(shortcut).catch(() => undefined)
            if (isCopyShortcut(message)) {
                const copiedText = await readSelectedText() || selectedText
                if (copiedText) remoteClipboard = copiedText
            }
            if (isCopyShortcut(message)) editableSelectAllArmed = false
            if (!isCopyShortcut(message)) editableSelectAllArmed = false
        } else if (message.key.length === 1) {
            editableSelectAllArmed = false
            await page.keyboard.type(message.key)
        } else {
            editableSelectAllArmed = false
            await page.keyboard.press(normalizeKey(message.key)).catch(() => undefined)
        }
        await sendFrame(false)
    }

    async function readRemoteClipboard() {
        if (!page) return ''
        const browserClipboard = await page.evaluate(() => navigator.clipboard?.readText?.().catch(() => '') || '').catch(() => '')
        return remoteClipboard || browserClipboard
    }

    async function readSelectedText() {
        if (!page) return remoteClipboard
        const selected = await page.evaluate(() => {
            const active = document.activeElement
            if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
                const start = active.selectionStart ?? 0
                const end = active.selectionEnd ?? 0
                return active.value.slice(Math.min(start, end), Math.max(start, end))
            }

            return window.getSelection()?.toString() || ''
        }).catch(() => '')

        return selected
    }

    async function selectEditableText() {
        if (!page) return false
        return await page.evaluate(() => {
            const active = document.activeElement
            if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
                active.select()
                return true
            }

            return false
        }).catch(() => false)
    }

    async function readEditableValue() {
        if (!page) return ''
        return await page.evaluate(() => {
            const active = document.activeElement
            if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
                return active.value
            }

            return ''
        }).catch(() => '')
    }

    async function sendFrame(force: boolean, reason = 'interval') {
        if (!page || closed || connection.readyState !== connection.OPEN) return
        const buffer = await page.screenshot({ type: 'jpeg', quality: 68, animations: 'disabled' }).catch(() => null)
        if (!buffer) return
        const image = buffer.toString('base64')
        if (!force && image === lastFrame) return
        lastFrame = image
        const viewport = page.viewportSize()
        send({
            type: 'frame',
            encoding: 'jpeg',
            image,
            width: viewport?.width || DEFAULT_WIDTH,
            height: viewport?.height || DEFAULT_HEIGHT,
            sessionId,
            url: page.url(),
            title: await page.title().catch(() => ''),
            capturedAt: new Date().toISOString(),
            reason,
        })
    }
}

function safeToolId(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'tool'
}

function parseMessage(raw: RawData): BrokerMessage | null {
    try {
        return JSON.parse(raw.toString()) as BrokerMessage
    } catch {
        return null
    }
}

function normalizeTarget(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return DEFAULT_TARGET
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `http://${trimmed}`
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return fallback
    return Math.max(min, Math.min(max, Math.round(numeric)))
}

function mouseButton(value: unknown): 'left' | 'right' | 'middle' {
    if (value === 2) return 'right'
    if (value === 1) return 'middle'
    return 'left'
}

function keyShortcut(message: BrokerMessage) {
    const modifiers = [
        message.ctrlKey || message.metaKey ? 'Control' : '',
        message.altKey ? 'Alt' : '',
        message.shiftKey ? 'Shift' : '',
    ].filter(Boolean)

    if (modifiers.length === 0) return ''
    return [...modifiers, normalizeKey(message.key || '')].join('+')
}

function normalizeKey(key: string) {
    if (key === ' ') return 'Space'
    if (key.length === 1) return key.toUpperCase()
    return key
}

function isPasteShortcut(message: BrokerMessage) {
    return Boolean((message.ctrlKey || message.metaKey) && message.key?.toLowerCase() === 'v')
}

function isCopyShortcut(message: BrokerMessage) {
    return Boolean((message.ctrlKey || message.metaKey) && message.key?.toLowerCase() === 'c')
}

function isSelectAllShortcut(message: BrokerMessage) {
    return Boolean((message.ctrlKey || message.metaKey) && message.key?.toLowerCase() === 'a')
}
