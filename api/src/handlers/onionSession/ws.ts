import WebSocket, { type RawData } from 'ws'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import recordLog from '#utils/logs/recordLog.ts'
import {
    extractIndicators,
    extractThreatAssociations,
    inspectScript,
    sandboxUrlSafety,
    summarizeDeobfuscationTask,
} from './analysis.ts'

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
type SandboxNetworkEvent = {
    kind: 'request' | 'response' | 'failed' | 'download'
    url: string
    method?: string
    resourceType?: string
    status?: number
    failure?: string
    at: string
}
type SandboxDeobfuscationTask = {
    scriptId?: string
    source?: string
    sample?: string
    decodedPreview?: string
    summary?: string
}
type WebCrackLoadResult = {
    loaded: boolean
    scriptId?: string
    source?: string
    sampleBytes?: number
    action?: string
    reason?: string
}
const DEFAULT_TARGET = 'http://sample-intel-source.onion'
const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 760
const MAX_DURATION_MS = 60 * 60 * 1000
const FRAME_INTERVAL_MS = 900
const DEFAULT_REGULAR_SANDBOX_MAX_SESSIONS = 10

type SandboxAdmissionStatus = {
    activeSessions: number
    queuedSessions: number
    maxSessions: number
    queuePosition?: number
}
type SandboxAdmissionRelease = {
    release: () => void
    status: SandboxAdmissionStatus
}
type SandboxAdmissionRequest = {
    sessionId: string
    send: (payload: Record<string, unknown>) => void
    resolve: (release: SandboxAdmissionRelease) => void
    cancelled: boolean
}

let activeRegularSandboxSessions = 0
const regularSandboxQueue: SandboxAdmissionRequest[] = []

function allowLocalSandboxTargets() {
    return process.env.BROWSER_SANDBOX_ALLOW_LOCAL_TARGETS === '1'
}

function regularSandboxMaxSessions() {
    const configured = Number(process.env.BROWSER_SANDBOX_MAX_SESSIONS)
    if (!Number.isFinite(configured)) return DEFAULT_REGULAR_SANDBOX_MAX_SESSIONS
    return Math.max(1, Math.min(100, Math.floor(configured)))
}

function currentRegularSandboxAdmissionStatus(queuePosition?: number): SandboxAdmissionStatus {
    return {
        activeSessions: activeRegularSandboxSessions,
        queuedSessions: regularSandboxQueue.length,
        maxSessions: regularSandboxMaxSessions(),
        queuePosition,
    }
}

function requestRegularSandboxAdmission(sessionId: string, send: (payload: Record<string, unknown>) => void) {
    const maxSessions = regularSandboxMaxSessions()
    if (activeRegularSandboxSessions < maxSessions) {
        activeRegularSandboxSessions += 1
        return {
            promise: Promise.resolve({
                release: releaseRegularSandboxAdmission(),
                status: currentRegularSandboxAdmissionStatus(),
            }),
            cancel: () => undefined,
        }
    }

    let entry: SandboxAdmissionRequest
    const promise = new Promise<SandboxAdmissionRelease>((resolve) => {
        entry = { sessionId, send, resolve, cancelled: false }
        regularSandboxQueue.push(entry)
        sendRegularSandboxQueueStatus(entry)
        broadcastRegularSandboxQueuePositions()
    })

    return {
        promise,
        cancel: () => {
            entry.cancelled = true
            const index = regularSandboxQueue.indexOf(entry)
            if (index >= 0) {
                regularSandboxQueue.splice(index, 1)
                broadcastRegularSandboxQueuePositions()
            }
        },
    }
}

function releaseRegularSandboxAdmission() {
    let released = false
    return () => {
        if (released) return
        released = true
        activeRegularSandboxSessions = Math.max(0, activeRegularSandboxSessions - 1)
        drainRegularSandboxQueue()
    }
}

function drainRegularSandboxQueue() {
    const maxSessions = regularSandboxMaxSessions()
    while (activeRegularSandboxSessions < maxSessions && regularSandboxQueue.length) {
        const entry = regularSandboxQueue.shift()
        if (!entry || entry.cancelled) continue
        activeRegularSandboxSessions += 1
        const status = currentRegularSandboxAdmissionStatus()
        entry.send({
            type: 'status',
            state: 'capacity_admitted',
            sessionId: entry.sessionId,
            capacity: status,
            message: 'Sandbox capacity is available. Starting this queued browser now.',
        })
        entry.resolve({
            release: releaseRegularSandboxAdmission(),
            status,
        })
    }
    broadcastRegularSandboxQueuePositions()
}

function sendRegularSandboxQueueStatus(entry: SandboxAdmissionRequest) {
    const position = regularSandboxQueue.indexOf(entry) + 1
    const status = currentRegularSandboxAdmissionStatus(position > 0 ? position : undefined)
    entry.send({
        type: 'status',
        state: 'capacity_busy',
        sessionId: entry.sessionId,
        capacity: status,
        message: `All ${status.maxSessions} sandbox slots are busy. This run is queued at position ${status.queuePosition}.`,
    })
}

function broadcastRegularSandboxQueuePositions() {
    for (const [index, entry] of regularSandboxQueue.entries()) {
        if (entry.cancelled) continue
        const status = currentRegularSandboxAdmissionStatus(index + 1)
        entry.send({
            type: 'status',
            state: 'capacity_queue_position',
            sessionId: entry.sessionId,
            capacity: status,
            message: `Queued for sandbox capacity. Position ${status.queuePosition} of ${status.queuedSessions}.`,
        })
    }
}

export function handleOnionSessionSocket(connection: WebSocket, sessionId: string, defaultNetwork: 'tor' | 'regular' = 'tor') {
    let browser: Browser | null = null
    let page: Page | null = null
    let frameTimer: NodeJS.Timeout | null = null
    let closeTimer: NodeJS.Timeout | null = null
    let cancelAdmission: (() => void) | null = null
    let releaseAdmission: (() => void) | null = null
    let closed = false
    let lastFrame = ''
    let remoteClipboard = ''
    let editableSelectAllArmed = false
    let messageQueue = Promise.resolve()
    let networkEvents: SandboxNetworkEvent[] = []

    const send = (payload: Record<string, unknown>) => {
        if (connection.readyState === connection.OPEN) {
            connection.send(JSON.stringify(payload))
        }
    }

    const cleanup = async () => {
        closed = true
        cancelAdmission?.()
        cancelAdmission = null
        releaseAdmission?.()
        releaseAdmission = null
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
        networkEvents = []
        const target = normalizeTarget(message.target || DEFAULT_TARGET)
        const network = message.network === 'regular' ? 'regular' : defaultNetwork
        const proxy = network === 'tor' ? process.env.ONION_SESSION_PROXY || process.env.TOR_SOCKS_PROXY || '' : ''
        const durationMs = Math.min(MAX_DURATION_MS, Math.max(60_000, (message.durationMinutes || 15) * 60_000))
        const admission = network === 'regular' ? requestRegularSandboxAdmission(sessionId, send) : null
        cancelAdmission = admission?.cancel || null

        try {
            const slot = admission ? await admission.promise : null
            cancelAdmission = null
            if (slot) {
                if (closed) {
                    slot.release()
                    return
                }
                releaseAdmission = slot.release
            }

            send({
                type: 'status',
                state: 'launching',
                sessionId,
                network,
                torProxyConfigured: Boolean(proxy),
                capacity: slot?.status,
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
                permissions: network === 'regular' ? [] : ['clipboard-read', 'clipboard-write'],
            })
            page = await context.newPage()
            await page.route('**/*', async (route) => {
                const requestUrl = route.request().url()
                const safety = sandboxUrlSafety(requestUrl, { allowLocalTargets: allowLocalSandboxTargets() })
                if (!safety.ok) {
                    trackNetwork({
                        kind: 'failed',
                        url: requestUrl,
                        method: route.request().method(),
                        resourceType: route.request().resourceType(),
                        failure: `blocked unsafe sandbox request: ${safety.reason}`,
                        at: new Date().toISOString(),
                    })
                    send({ type: 'status', state: 'unsafe_request_blocked', url: requestUrl, message: `Blocked unsafe sandbox request: ${safety.reason}.` })
                    await route.abort('blockedbyclient').catch(() => undefined)
                    return
                }
                await route.continue().catch(() => undefined)
            })
            page.on('console', (entry) => send({ type: 'console', level: entry.type(), text: entry.text() }))
            page.on('pageerror', (error) => send({ type: 'pageerror', message: error.message }))
            page.on('request', (request) => {
                trackNetwork({
                    kind: 'request',
                    url: request.url(),
                    method: request.method(),
                    resourceType: request.resourceType(),
                    at: new Date().toISOString(),
                })
            })
            page.on('response', (response) => {
                trackNetwork({
                    kind: 'response',
                    url: response.url(),
                    status: response.status(),
                    at: new Date().toISOString(),
                })
            })
            page.on('requestfailed', (request) => {
                trackNetwork({
                    kind: 'failed',
                    url: request.url(),
                    method: request.method(),
                    resourceType: request.resourceType(),
                    failure: request.failure()?.errorText || 'request failed',
                    at: new Date().toISOString(),
                })
            })
            page.on('download', (download) => {
                trackNetwork({
                    kind: 'download',
                    url: download.url(),
                    failure: 'download blocked for sandbox safety',
                    at: new Date().toISOString(),
                })
                void download.cancel().catch(() => undefined)
                send({ type: 'status', state: 'download_blocked', url: download.url(), message: 'Download blocked for sandbox safety.' })
            })
            page.on('framenavigated', (frame) => {
                if (frame !== page?.mainFrame()) return
                send({ type: 'status', state: 'navigated', url: page.url(), sessionId })
                void sendFrame(true, 'navigation')
            })
            page.on('domcontentloaded', () => {
                send({ type: 'status', state: 'domcontentloaded', url: page?.url(), sessionId, message: 'Captured DOM-ready browser state.' })
                void sendFrame(true, 'domcontentloaded')
            })
            page.on('load', () => {
                send({ type: 'status', state: 'loaded', url: page?.url(), sessionId, message: 'Captured loaded browser state.' })
                void sendFrame(true, 'load')
            })

            closeTimer = setTimeout(() => {
                void cleanup()
                send({ type: 'ended', reason: 'timeout', sessionId })
                connection.close()
            }, durationMs)

            await navigate(target)
            await sendFrame(true, 'initial_target')
            const primaryEvidence = page ? await collectPageEvidence(page).catch(() => null) : null
            await captureProfileTools(context, message.profileTools || [], target, primaryEvidence?.deobfuscationTasks || [])
            frameTimer = setInterval(() => {
                void sendFrame(false)
            }, FRAME_INTERVAL_MS)
            send({ type: 'ready', sessionId, target, network, torProxyConfigured: Boolean(proxy), capacity: currentRegularSandboxAdmissionStatus() })
        } catch (error) {
            await cleanup()
            throw error
        }
    }

    async function captureProfileTools(
        context: BrowserContext,
        tools: Array<{ id?: string; name?: string; url?: string }>,
        target: string,
        deobfuscationTasks: SandboxDeobfuscationTask[] = [],
    ) {
        for (const tool of tools.slice(0, 6)) {
            if (!tool.url) continue
            const toolPage = await context.newPage().catch(() => null)
            if (!toolPage) continue
            const startedAt = new Date().toISOString()
            const toolUrl = tool.url.replaceAll('{url}', encodeURIComponent(target)).replaceAll('{rawUrl}', target)
            try {
                await toolPage.goto(toolUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 })
                await toolPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
                const webcrackLoad = isWebCrackTool(tool, toolUrl)
                    ? await loadWebCrackSample(toolPage, deobfuscationTasks)
                    : undefined
                if (webcrackLoad?.loaded) {
                    await toolPage.waitForTimeout(1200).catch(() => undefined)
                }
                const buffer = await toolPage.screenshot({ type: 'jpeg', quality: 64, animations: 'disabled' }).catch(() => null)
                const evidence = await collectPageEvidence(toolPage)
                const toolAnalysis = analyzeToolEvidence(tool.name || toolUrl, evidence, webcrackLoad)
                send({
                    type: 'tool_capture',
                    sessionId,
                    id: tool.id || safeToolId(tool.name || toolUrl),
                    name: tool.name || toolUrl,
                    url: toolPage.url(),
                    title: await toolPage.title().catch(() => ''),
                    capturedAt: startedAt,
                    image: buffer ? buffer.toString('base64') : null,
                    evidence,
                    toolAnalysis,
                    webcrackLoad,
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

    function trackNetwork(event: SandboxNetworkEvent) {
        networkEvents.push(event)
        if (networkEvents.length > 600) networkEvents = networkEvents.slice(-600)
    }

    async function navigate(value: string) {
        if (!page) return
        const target = normalizeTarget(value)
        const safety = sandboxUrlSafety(target, { allowLocalTargets: allowLocalSandboxTargets() })
        if (!safety.ok) {
            send({ type: 'navigation_error', target, message: `Blocked unsafe sandbox target: ${safety.reason}.` })
            send({ type: 'status', state: 'unsafe_target_blocked', url: target, message: `Blocked unsafe sandbox target: ${safety.reason}.` })
            return
        }
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
            evidence: await collectPageEvidence(page),
            networkSummary: summarizeNetworkEvents(networkEvents),
        })
    }
}

function summarizeNetworkEvents(events: SandboxNetworkEvent[]) {
    const requests = events.filter(event => event.kind === 'request')
    const responses = events.filter(event => event.kind === 'response')
    const failures = events.filter(event => event.kind === 'failed' || event.kind === 'download')
    const domains = Array.from(new Set(events.map(event => domainFromUrl(event.url)).filter(Boolean))).slice(0, 80)
    const statusCounts = responses.reduce<Record<string, number>>((current, event) => {
        const bucket = event.status ? `${Math.floor(event.status / 100)}xx` : 'unknown'
        current[bucket] = (current[bucket] || 0) + 1
        return current
    }, {})
    const redirectChain = events
        .filter(event => event.kind === 'response' && event.status && event.status >= 300 && event.status < 400)
        .map(event => event.url)
        .slice(-12)

    return {
        requestCount: requests.length,
        responseCount: responses.length,
        failedCount: failures.length,
        uniqueDomainCount: domains.length,
        domains,
        statusCounts,
        redirectChain,
        recentFailures: failures.slice(-8).map(event => ({
            url: event.url,
            failure: event.failure || 'failed',
            at: event.at,
        })),
        lastUpdatedAt: events.at(-1)?.at,
    }
}

function domainFromUrl(value: string) {
    try {
        return new URL(value).hostname.toLowerCase()
    } catch {
        return ''
    }
}

function isWebCrackTool(tool: { id?: string; name?: string; url?: string }, resolvedUrl: string) {
    return /web\s*crack|webcrack/i.test(`${tool.id || ''} ${tool.name || ''} ${tool.url || ''} ${resolvedUrl}`)
}

async function loadWebCrackSample(page: Page, tasks: SandboxDeobfuscationTask[]): Promise<WebCrackLoadResult> {
    const task = tasks.find(item => item.sample || item.decodedPreview)
    const sample = (task?.sample || task?.decodedPreview || '').slice(0, 12000)
    if (!task || !sample) {
        return { loaded: false, reason: 'no obfuscated script sample extracted from target page' }
    }

    const textArea = page.locator('textarea').first()
    if (await textArea.count().catch(() => 0)) {
        await textArea.fill(sample, { timeout: 2500 })
        await triggerWebCrackRun(page)
        return {
            loaded: true,
            scriptId: task.scriptId,
            source: task.source,
            sampleBytes: Buffer.byteLength(sample),
            action: 'filled_textarea',
        }
    }

    const editable = page.locator('[contenteditable="true"]').first()
    if (await editable.count().catch(() => 0)) {
        await editable.evaluate((element, value) => {
            element.textContent = value
            element.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }))
        }, sample)
        await triggerWebCrackRun(page)
        return {
            loaded: true,
            scriptId: task.scriptId,
            source: task.source,
            sampleBytes: Buffer.byteLength(sample),
            action: 'filled_contenteditable',
        }
    }

    const monaco = page.locator('.monaco-editor textarea, .cm-content, [role="textbox"]').first()
    if (await monaco.count().catch(() => 0)) {
        await monaco.click({ timeout: 2500 }).catch(() => undefined)
        await page.keyboard.insertText(sample).catch(() => undefined)
        await triggerWebCrackRun(page)
        return {
            loaded: true,
            scriptId: task.scriptId,
            source: task.source,
            sampleBytes: Buffer.byteLength(sample),
            action: 'inserted_editor_text',
        }
    }

    return {
        loaded: false,
        scriptId: task.scriptId,
        source: task.source,
        sampleBytes: Buffer.byteLength(sample),
        reason: 'WebCrack input editor was not found',
    }
}

async function triggerWebCrackRun(page: Page) {
    const runButton = page.getByRole('button', { name: /deobfuscate|unpack|analy[sz]e|run|crack/i }).first()
    if (await runButton.count().catch(() => 0)) {
        await runButton.click({ timeout: 2500 }).catch(() => undefined)
        return
    }
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter').catch(() => undefined)
}

async function collectPageEvidence(page: Page) {
    const snapshot = await page.evaluate(() => {
        const text = document.body?.innerText || ''
        const scripts = Array.from(document.scripts).map((script) => ({
            src: script.src || '',
            inline: script.src ? '' : (script.textContent || '').slice(0, 12000),
        }))
        const comments: string[] = []
        const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT)
        let node = walker.nextNode()
        while (node && comments.length < 20) {
            const value = node.textContent?.trim()
            if (value) comments.push(value.slice(0, 500))
            node = walker.nextNode()
        }
        const forms = Array.from(document.forms).map((form) => ({
            action: form.action || '',
            method: form.method || 'get',
            inputs: Array.from(form.querySelectorAll('input, textarea, select')).map((input) => {
                const element = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                return {
                    name: element.getAttribute('name') || '',
                    type: element.getAttribute('type') || element.tagName.toLowerCase(),
                    autocomplete: element.getAttribute('autocomplete') || '',
                }
            }).slice(0, 20),
        })).slice(0, 10)
        const anchors = Array.from(document.links).map((link) => link.href).slice(0, 80)

        return {
            text: text.slice(0, 8000),
            scripts,
            comments,
            forms,
            anchors,
            meta: Array.from(document.querySelectorAll('meta')).map((meta) => ({
                name: meta.getAttribute('name') || meta.getAttribute('property') || '',
                content: meta.getAttribute('content') || '',
            })).filter(item => item.name || item.content).slice(0, 40),
        }
    }).catch(() => ({
        text: '',
        scripts: [] as Array<{ src: string; inline: string }>,
        comments: [] as string[],
        forms: [] as Array<{ action: string; method: string; inputs: Array<{ name: string; type: string; autocomplete: string }> }>,
        anchors: [] as string[],
        meta: [] as Array<{ name: string; content: string }>,
    }))

    const joined = [
        page.url(),
        snapshot.text,
        snapshot.comments.join('\n'),
        snapshot.anchors.join('\n'),
        snapshot.forms.map(form => `${form.action} ${form.inputs.map(input => `${input.name}:${input.type}`).join(' ')}`).join('\n'),
        snapshot.scripts.map(script => `${script.src}\n${script.inline}`).join('\n'),
    ].join('\n')
    const scripts = snapshot.scripts.map((script, index) => inspectScript(script, index)).filter(script => script.src || script.sample || script.obfuscationScore > 0)
    const indicators = extractIndicators(joined)
    const obfuscatedScripts = scripts.filter(script => script.obfuscationScore >= 3)
    const forms = snapshot.forms.map(form => ({
        action: form.action,
        method: form.method,
        sensitiveInputCount: form.inputs.filter(input => /pass|token|otp|card|cc|email|user|login/i.test(`${input.name} ${input.type} ${input.autocomplete}`)).length,
        inputCount: form.inputs.length,
    }))
    const suspiciousReasons = [
        obfuscatedScripts.length ? `${obfuscatedScripts.length} obfuscated script candidate${obfuscatedScripts.length === 1 ? '' : 's'}` : '',
        indicators.ips.length ? `${indicators.ips.length} IP indicator${indicators.ips.length === 1 ? '' : 's'}` : '',
        forms.some(form => form.sensitiveInputCount > 0) ? 'sensitive form fields present' : '',
        /wallet|seed phrase|connect wallet|password|invoice|captcha|download|verify account/i.test(snapshot.text) ? 'social-engineering language present' : '',
    ].filter(Boolean)

    return {
        url: page.url(),
        textExcerpt: snapshot.text.replace(/\s+/g, ' ').trim().slice(0, 900),
        indicators,
        comments: snapshot.comments.slice(0, 8),
        forms,
        scripts,
        obfuscatedScripts,
        verdict: suspiciousReasons.length >= 2 || obfuscatedScripts.length ? 'suspicious' : 'unknown',
        confidence: Math.min(95, 35 + suspiciousReasons.length * 15 + obfuscatedScripts.length * 10),
        reasons: suspiciousReasons.length ? suspiciousReasons : ['No high-signal malicious pattern was extracted from the rendered page yet.'],
        threatAssociations: extractThreatAssociations(joined, 'rendered_page'),
        deobfuscationTasks: obfuscatedScripts.map(script => summarizeDeobfuscationTask(script)),
    }
}

function analyzeToolEvidence(toolName: string, evidence: Awaited<ReturnType<typeof collectPageEvidence>>, webcrackLoad?: WebCrackLoadResult) {
    const tool = toolName.toLowerCase()
    const text = [
        evidence.url || '',
        evidence.textExcerpt || '',
        ...(evidence.comments || []),
        ...(evidence.reasons || []),
    ].join('\n')
    const vendorMatch = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})\s*(?:security\s*)?(?:vendors?|engines?)/i)
        || text.match(/(\d{1,3})\s+(?:security\s*)?(?:vendors?|engines?)\s+(?:flagged|detected|marked)/i)
    const alertMatch = text.match(/(\d{1,3})\s+(?:alerts?|detections?|blacklists?|malicious requests?)/i)
    const communityMatch = text.match(/(\d{1,3})\s+(?:community\s*)?(?:comments?|votes?|reviews?)/i)
    const isVirusTotal = /virus\s*total|virustotal/.test(tool) || /virustotal\.com/i.test(text)
    const isUrlQuery = /urlquery|urlquery\.net/.test(tool) || /urlquery\.net/i.test(text)
    const flagged = vendorMatch ? Number(vendorMatch[1]) : undefined
    const total = vendorMatch?.[2] ? Number(vendorMatch[2]) : undefined
    const alertCount = alertMatch ? Number(alertMatch[1]) : undefined
    const communityCommentCount = communityMatch ? Number(communityMatch[1]) : evidence.comments?.length || undefined
    const verdict = /malicious|phishing|suspicious|blacklist|detected/i.test(text)
        ? 'suspicious'
        : /clean|harmless|undetected|no security vendors/i.test(text)
            ? 'clean'
            : 'unknown'

    return {
        toolKind: isVirusTotal ? 'virustotal' : isUrlQuery ? 'urlquery' : /webcrack/i.test(tool) ? 'webcrack' : 'generic',
        vendorFlagged: Number.isFinite(flagged) ? flagged : undefined,
        vendorTotal: Number.isFinite(total) ? total : undefined,
        alertCount: Number.isFinite(alertCount) ? alertCount : undefined,
        communityCommentCount: Number.isFinite(communityCommentCount) ? communityCommentCount : undefined,
        communitySummary: evidence.comments?.slice(0, 3).join(' ') || undefined,
        verdict,
        threatAssociations: extractThreatAssociations(text, 'tool_context'),
        extractedSignals: [
            isVirusTotal && Number.isFinite(flagged) ? `${flagged}/${total || '?'} vendors flagged` : '',
            isUrlQuery && Number.isFinite(alertCount) ? `${alertCount} urlquery alert${alertCount === 1 ? '' : 's'}` : '',
            communityCommentCount ? `${communityCommentCount} community comment${communityCommentCount === 1 ? '' : 's'}` : '',
            webcrackLoad?.loaded ? `WebCrack loaded ${webcrackLoad.scriptId || 'script sample'}` : '',
        ].filter(Boolean),
        webcrackLoaded: webcrackLoad?.loaded,
        webcrackScriptId: webcrackLoad?.scriptId,
        webcrackSampleBytes: webcrackLoad?.sampleBytes,
        webcrackLoadReason: webcrackLoad?.reason,
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
