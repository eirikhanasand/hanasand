import WebSocket, { type RawData } from 'ws'
import { chromium, type Browser, type BrowserContext, type Frame, type Page } from 'playwright'
import recordLog from '#utils/logs/recordLog.ts'
import { finishBrowserRun, prepareBrowserRun } from '../browserSandboxRuns.ts'
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
    clientId?: string
    userId?: string
    sessionToken?: string
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
type ProviderCaptureReadiness = {
    ready: boolean
    blocker?: string
    statusText?: string
}
const DEFAULT_TARGET = 'http://sample-intel-source.onion'
const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 760
const MAX_DURATION_MS = 60 * 60 * 1000
const FRAME_INTERVAL_MS = 900
const DEFAULT_BROWSER_MAX_SESSIONS = 10

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

let activeBrowserSessions = 0
const browserSessionQueue: SandboxAdmissionRequest[] = []

function allowLocalSandboxTargets() {
    return process.env.BROWSER_SANDBOX_ALLOW_LOCAL_TARGETS === '1'
}

function browserMaxSessions() {
    const configured = Number(process.env.BROWSER_SANDBOX_MAX_SESSIONS)
    if (!Number.isFinite(configured)) return DEFAULT_BROWSER_MAX_SESSIONS
    return Math.max(1, Math.min(100, Math.floor(configured)))
}

function currentBrowserAdmissionStatus(queuePosition?: number): SandboxAdmissionStatus {
    return {
        activeSessions: activeBrowserSessions,
        queuedSessions: browserSessionQueue.length,
        maxSessions: browserMaxSessions(),
        queuePosition,
    }
}

function requestBrowserAdmission(sessionId: string, send: (payload: Record<string, unknown>) => void) {
    const maxSessions = browserMaxSessions()
    if (activeBrowserSessions < maxSessions) {
        activeBrowserSessions += 1
        return {
            promise: Promise.resolve({
                release: releaseBrowserAdmission(),
                status: currentBrowserAdmissionStatus(),
            }),
            cancel: () => undefined,
        }
    }

    let entry: SandboxAdmissionRequest
    const promise = new Promise<SandboxAdmissionRelease>((resolve) => {
        entry = { sessionId, send, resolve, cancelled: false }
        browserSessionQueue.push(entry)
        sendBrowserQueueStatus(entry)
        broadcastBrowserQueuePositions()
    })

    return {
        promise,
        cancel: () => {
            entry.cancelled = true
            const index = browserSessionQueue.indexOf(entry)
            if (index >= 0) {
                browserSessionQueue.splice(index, 1)
                broadcastBrowserQueuePositions()
            }
        },
    }
}

function releaseBrowserAdmission() {
    let released = false
    return () => {
        if (released) return
        released = true
        activeBrowserSessions = Math.max(0, activeBrowserSessions - 1)
        drainBrowserQueue()
    }
}

function drainBrowserQueue() {
    const maxSessions = browserMaxSessions()
    while (activeBrowserSessions < maxSessions && browserSessionQueue.length) {
        const entry = browserSessionQueue.shift()
        if (!entry || entry.cancelled) continue
        activeBrowserSessions += 1
        const status = currentBrowserAdmissionStatus()
        entry.send({
            type: 'status',
            state: 'capacity_admitted',
            sessionId: entry.sessionId,
            capacity: status,
            message: 'Sandbox capacity is available. Starting this queued browser now.',
        })
        entry.resolve({
            release: releaseBrowserAdmission(),
            status,
        })
    }
    broadcastBrowserQueuePositions()
}

function sendBrowserQueueStatus(entry: SandboxAdmissionRequest) {
    const position = browserSessionQueue.indexOf(entry) + 1
    const status = currentBrowserAdmissionStatus(position > 0 ? position : undefined)
    entry.send({
        type: 'status',
        state: 'capacity_busy',
        sessionId: entry.sessionId,
        capacity: status,
        message: `All ${status.maxSessions} sandbox slots are busy. This run is queued at position ${status.queuePosition}.`,
    })
}

function broadcastBrowserQueuePositions() {
    for (const [index, entry] of browserSessionQueue.entries()) {
        if (entry.cancelled) continue
        const status = currentBrowserAdmissionStatus(index + 1)
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
    let currentRunId: string | null = null
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
        const runId = currentRunId
        currentRunId = null
        if (runId) {
            const title = page ? await page.title().catch(() => '') : ''
            await finishBrowserRun(runId, 'ended', title).catch(() => undefined)
        }
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
        const network = message.network === 'regular' || message.network === 'tor' ? message.network : defaultNetwork
        const proxy = network === 'tor' ? process.env.ONION_SESSION_PROXY || process.env.TOR_SOCKS_PROXY || '' : ''
        const durationMs = Math.min(MAX_DURATION_MS, Math.max(60_000, (message.durationMinutes || 15) * 60_000))
        const browserRun = await prepareBrowserRun({
            id: sessionId,
            target,
            network,
            clientId: message.clientId,
            userId: message.userId,
            sessionToken: message.sessionToken,
        })
        if (!browserRun.allowed) {
            send({
                type: 'status',
                state: 'quota_exhausted',
                sessionId,
                network,
                quota: browserRun.quota,
                message: `Browser run limit reached for ${browserRun.quota.plan}.`,
            })
            send({ type: 'ended', reason: 'quota_exhausted', sessionId })
            connection.close()
            return
        }
        currentRunId = browserRun.run?.id || null
        const admission = requestBrowserAdmission(sessionId, send)
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
            await dismissCookieOverlays(page).catch(() => undefined)
            await sendFrame(true, 'initial_target')
            send({
                type: 'ready',
                sessionId,
                target,
                network,
                torProxyConfigured: Boolean(proxy),
                capacity: currentBrowserAdmissionStatus(),
                run: browserRun.run,
                quota: browserRun.quota,
            })
            frameTimer = setInterval(() => {
                void sendFrame(false)
            }, FRAME_INTERVAL_MS)
            const primaryEvidence = page ? await collectPageEvidence(page).catch(() => null) : null
            await captureProfileTools(context, message.profileTools || [], target, primaryEvidence?.deobfuscationTasks || [])
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
                await dismissCookieOverlays(toolPage).catch(() => undefined)
                await toolPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
                const readiness = await waitForProviderCaptureReadiness(toolPage, tool).catch(() => ({ ready: false, blocker: 'readiness-check-failed' }))
                if (!readiness.ready) {
                    const blockerEvidence = await collectPageEvidence(toolPage)
                    const blockerImage = await toolPage.screenshot({ type: 'jpeg', quality: 64, animations: 'disabled' }).catch(() => null)
                    const blockerSummary = analyzeToolEvidence(tool.name || toolUrl, blockerEvidence)
                    const hasParsedProviderResult = blockerSummary.vendorFlagged !== undefined
                        || blockerSummary.alertCount !== undefined
                        || blockerSummary.verdict === 'suspicious'
                        || blockerSummary.verdict === 'clean'
                    const blocker = `${readiness.blocker || 'provider-capture-blocked'}`
                    const isBlockerWithNoData = /provider-blocked-(?:urlquery|virustotal|generic)|provider-result-timeout/.test(blocker) && !hasParsedProviderResult
                    const isHardBlocker = /cloudflare-or-challenge/.test(blocker)
                    send({
                        type: 'tool_capture',
                        sessionId,
                        id: tool.id || safeToolId(tool.name || toolUrl),
                        name: tool.name || toolUrl,
                        url: toolPage.url(),
                        title: await toolPage.title().catch(() => ''),
                        capturedAt: startedAt,
                        image: blockerImage ? blockerImage.toString('base64') : null,
                        evidence: blockerEvidence,
                        toolAnalysis: {
                            ...blockerSummary,
                            verdict: blockerSummary.verdict ?? 'unknown',
                            extractedSignals: [
                                ...((blockerSummary.extractedSignals || []) as string[]),
                                `Provider not ready: ${blocker}`,
                            ].filter(Boolean),
                        },
                        target,
                        error: isHardBlocker || isBlockerWithNoData ? blocker : undefined,
                    })
                    if (isHardBlocker || isBlockerWithNoData) {
                        continue
                    }
                }
                await toolPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
                await toolPage.waitForTimeout(450).catch(() => undefined)
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

async function dismissCookieOverlays(page: Page) {
    const selectors = [
        'button:has-text("Accept all")',
        'button:has-text("Accept all cookies")',
        'button:has-text("Accept")',
        'button:has-text("Accept All")',
        'button:has-text("Accept all Cookies")',
        'button:has-text("I Accept")',
        'button:has-text("I ACCEPT")',
        'button:has-text("I AGREE")',
        'button:has-text("Allow all cookies and continue")',
        'button:has-text("Allow all and continue")',
        'button:has-text("Accept all")',
        'button:has-text("Allow all cookies")',
        'button:has-text("Allow all")',
        'button:has-text("Allow")',
        'button:has-text("I agree")',
        'button:has-text("I agree and close")',
        'button:has-text("I Agree")',
        'button:has-text("I Consent")',
        'button:has-text("Got it")',
        'button:has-text("I understand")',
        'button:has-text("Continue")',
        'button:has-text("Skip")',
        'button:has-text("Close")',
        'button:has-text("Godta")',
        'button:has-text("Godta alle")',
        'button:has-text("Accepter")',
        'button:has-text("Tout accepter")',
        'button:has-text("Only Essential")',
        'button:has-text("No thanks")',
        'button:has-text("Reject all")',
        'button:has-text("I’m Okay with That")',
        'button:has-text("I Accept")',
        'button:has-text("I am okay with that")',
        'button:has-text("Only Essential Cookies")',
        'button:has-text("Use Required Cookies")',
        'button:has-text("Enable All Cookies")',
        'button:has-text("Allow all cookies and continue")',
        'button:has-text("Gotcha")',
        'button:has-text("OK")',
        'button:has-text("Ok")',
        'button:has-text("Continue")',
        'button:has-text("Cookie settings")',
        'button:has-text("Cookie Settings")',
        'button:has-text("Manage options")',
        'button:has-text("Manage preferences")',
        'button:has-text("Manage Cookies")',
        'button:has-text("Cookie preferences")',
        'button:has-text("Customize")',
        'button:has-text("Essential only")',
        'button:has-text("Essential only cookies")',
        '[role="button"]:has-text("Allow")',
        '[role="button"]:has-text("Agree")',
        '[role="button"]:has-text("Accept")',
        '[role="button"]:has-text("Continue")',
        '[role="button"]:has-text("Close")',
        '[role="button"]:has-text("Dismiss")',
        'a:has-text("Accept")',
        'a:has-text("Accept all")',
        'a:has-text("Continue")',
        'a:has-text("Close")',
        '#CybotCookiebotDialogBodyButtonAccept',
        '#CybotCookiebotDialogBodyLevelButtonAcceptAll',
        '#didomi-notice-agree-button',
        '#didomi-notice-accept-button',
        '#onetrust-accept-btn-handler',
        '#onetrust-accept-all-handler',
        '#onetrust-accept-all',
        '#truste-consent-button',
        'button[data-testid="accept"]',
        '.didomi-continue-without-agreeing',
        '[data-testid="accept-button"]',
        '[data-testid*="accept" i]',
        '[data-testid*="consent" i]',
        '[data-testid*="cookies" i]',
        '[data-testid*="cookie" i]',
        '[data-cc-action="accept-all"]',
        '[data-cc-action="accept"]',
        '[id*="onetrust" i]',
        '[class*="onetrust" i]',
        '[aria-label*="Accept" i]',
        '[aria-label*="accept all" i]',
        '[aria-label*="Godta" i]',
        '[aria-label*="Accepter" i]',
        '[aria-label*="cookie settings" i]',
        '[aria-label*="cookie preferences" i]',
        '[aria-label*="consent" i]',
        '[id*="cookie-banner" i]',
        '[class*="cookie-banner" i]',
        '[role="dialog"][aria-label*="cookie" i]',
        '[role="dialog"][aria-label*="consent" i]',
        '[id*="consent" i][role="dialog"]',
        '[id*="cookie-consent" i]',
        '[class*="cookie-consent" i]',
        '[id*="consent-banner" i]',
        '[class*="consent-banner" i]',
        '[id*="truste" i]',
        '[class*="truste" i]',
        '[id*="gdpr" i]',
        '[class*="gdpr" i]',
    ]
    const cookiePromptText = (value: string) => /(cookie|consent|privacy|gdpr|tracking|analytics|preferences|cookie settings|cookie preferences|cookie notice|cookie popup|cookie wall|accept all|I agree)/i.test(value)
    const passLimit = 12

    const clickInFrame = async (frame: Frame) => {
        for (const selector of selectors) {
            try {
                const locator = frame.locator(selector).first()
                if (await locator.isVisible().catch(() => false)) {
                    await locator.click({ timeout: 1200 }).catch(() => undefined)
                    await frame.waitForTimeout(120).catch(() => undefined)
                    return true
                }
            } catch {
                // Continue trying other selectors.
            }
        }
        return false
    }

    const clickTextButtonInFrame = async (frame: Frame) => frame.evaluate(() => {
        const candidates = Array.from(
            document.querySelectorAll<HTMLElement>(
                'button, a, input[type="button"], input[type="submit"], [role="button"]',
            ),
        )
        const normalize = (candidate: string) => (candidate || '').trim().toLowerCase()
        const aroundCandidateText = (candidate: HTMLElement) => {
            const target = candidate.closest('[role="dialog"], [class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]')
            if (target) {
                return `${target.textContent || ''} ${candidate.textContent || ''}`
            }
            return candidate.textContent || ''
        }
        const isCookieAction = (value: string) => /^(accept|agree|allow|got it|continue|ok|understand|close|dismiss|not now|reject|decline|godta|accepter|enable|essential|required|manage|customize|settings|preference|configure|save|save and continue|proceed|i agree)/.test(value)
            && /(cookie|consent|privacy|gdpr|tracking|marketing|analytics|preferences)/.test(value)
        const isCookieLabel = (value: string) => /(cookie|consent|privacy|gdpr|tracking|analytics|preferences|opt.?out|data collection|essential)/.test(value)
        const target = candidates.find(candidate => {
            const value = normalize(candidate.textContent || '')
            const contextValue = normalize(aroundCandidateText(candidate))
            return isCookieAction(value) && isCookieLabel(contextValue) && candidate.offsetParent !== null
        })
        if (!target) return false
        target.click()
        return true
    }).catch(() => false)

    const clickShadowCookieElements = async (frame: Frame) => frame.evaluate(() => {
        const walk = (root: ParentNode): Element[] => {
            const nodes = Array.from(root.querySelectorAll<HTMLElement>('*'))
            const shadowHosts = Array.from(root.querySelectorAll<HTMLElement>('*')).filter(node => node.shadowRoot)
            const fromShadow: Element[] = shadowHosts.flatMap(node => walk(node.shadowRoot as unknown as ParentNode))
            return [...nodes, ...fromShadow]
        }

        const candidates = walk(document)
            .filter((candidate): candidate is HTMLElement => candidate instanceof HTMLButtonElement || candidate.getAttribute('role') === 'button' || candidate.tagName === 'A')
            .filter(candidate => {
                const value = (candidate.textContent || '').toLowerCase()
                const hasCookieAction = /^(accept|agree|allow|got it|continue|ok|understand|close|dismiss|not now|godta|accepter|enable|acceptall|only|essential|required|all|save|save and close|yes|proceed)/.test(value)
                const hasCookieContext = /(cookie|consent|privacy|gdpr|tracking|analytics|preferences|data collection|essential)/.test(value)
                return hasCookieAction && hasCookieContext && candidate.getAttribute('aria-hidden') !== 'true'
            })

        for (const candidate of candidates) {
            candidate.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
            return true
        }

        return false
    }).catch(() => false)

    const clickConsentButtonsByText = async (frame: Frame) => frame.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>(
            'button, a, input[type="button"], input[type="submit"], [role="button"]',
        ))
        const toFlatText = (value: string | null | undefined) => (value || '').trim().toLowerCase()
        const hasCookieContext = (value: string) => /(cookie|consent|privacy|gdpr|tracking|analytics|preferences|data collection)/i.test(value)
        const hasCookieAction = (value: string) => /^(accept|agree|allow|got it|continue|ok|understand|close|dismiss|not now|reject|decline|godta|accepter|enable|save|save and continue|proceed|i agree)/i.test(value)

        const candidate = nodes.find((node) => {
            const text = toFlatText(node.textContent)
            const title = toFlatText(node.getAttribute('title'))
            const value = toFlatText((node as HTMLInputElement).getAttribute('value') || '')
            const aria = toFlatText(node.getAttribute('aria-label'))
            const parentText = toFlatText(node.closest('[role="dialog"], [class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]')?.textContent)
            const sourceText = [text, title, value, aria, parentText].join(' ')
            return hasCookieAction(text) && hasCookieContext(sourceText)
        })

        if (!candidate) return false
        candidate.click()
        return true
    }).catch(() => false)

    const hideCandidateOverlays = async (frame: Frame) => frame.evaluate(() => {
        const selectors = [
            '[id*="cookie" i]',
            '[class*="cookie" i]',
            '[id*="consent" i]',
            '[class*="consent" i]',
            '[id*="onetrust" i]',
            '[class*="onetrust" i]',
            '[id*="gdpr" i]',
            '[class*="gdpr" i]',
            '[id*="cc-" i]',
            '[class*="cc-" i]',
            '[id*="cookie-banner" i]',
            '[class*="cookie-banner" i]',
            '[id*="sp_message" i]',
            '[class*="sp_message" i]',
            '[id*="cookie-consent" i]',
            '[class*="cookie-consent" i]',
            '[role="dialog"][aria-label*="cookie" i]',
            '[role="dialog"][aria-label*="consent" i]',
        ]
        for (const selector of selectors) {
            for (const node of Array.from(document.querySelectorAll(selector))) {
                const candidate = node as HTMLElement
                const text = (candidate.textContent || '').toLowerCase()
                const computedStyle = window.getComputedStyle(candidate)
                const containsCookieCopy = /cookie|consent|gdpr|privacy|tracking|preferences|analytics|essential|data collection/i.test(text)
            const isFixedOrSticky = ['fixed', 'sticky'].includes(computedStyle.position)
                const fillsView = candidate.getBoundingClientRect().width >= window.innerWidth * 0.5 && candidate.getBoundingClientRect().height >= window.innerHeight * 0.15
                if ((containsCookieCopy || isFixedOrSticky) && candidate.style.display !== 'none') {
                    candidate.style.setProperty('display', 'none', 'important')
                    candidate.setAttribute('data-hanasand-cookie-dismissed', '1')
                }
                const hasHighZ = Number(computedStyle.zIndex || 0) >= 2000
                const fixedOverlay = ['fixed', 'sticky', 'absolute'].includes(computedStyle.position)
                const fillsViewport = candidate.getBoundingClientRect().width >= window.innerWidth * 0.7 && candidate.getBoundingClientRect().height >= window.innerHeight * 0.25
                if ((hasHighZ && fixedOverlay && fillsViewport) || (containsCookieCopy && fillsView)) {
                    candidate.style.setProperty('display', 'none', 'important')
                    candidate.style.setProperty('pointer-events', 'none', 'important')
                }
            }
        }

        const iframes = Array.from(document.querySelectorAll('iframe')).filter(node => {
            const source = (node.getAttribute('src') || '').toLowerCase()
            const text = (node.textContent || node.getAttribute('title') || '').toLowerCase()
            const style = window.getComputedStyle(node)
            const rect = node.getBoundingClientRect()
            const textLooksLikeConsent = /cookie|consent|gdpr|privacy|trust|onetrust|cmp|civic|quantcast|cookiebot/i.test(source + ' ' + text)
            return textLooksLikeConsent || (['fixed', 'sticky'].includes(style.position) && rect.width >= window.innerWidth * 0.35 && rect.height >= window.innerHeight * 0.35)
        })
        for (const iframe of iframes) {
            iframe.style.setProperty('display', 'none', 'important')
            iframe.setAttribute('data-hanasand-cookie-dismissed', '1')
        }
        const shadowContainers = Array.from(document.querySelectorAll('[id*="sp_message" i], [class*="sp_message" i], [class*="cookie-banner" i], [id*="cookie-banner" i], [id*="cmp" i], [class*="cmp" i]'))
            .filter(node => {
                const text = (node.textContent || '').toLowerCase()
                const rect = node.getBoundingClientRect()
                return /cookie|consent|privacy|gdpr|tracking|preferences|notice/i.test(text) || rect.top < 120 || rect.height > 120
            })
        for (const node of shadowContainers) {
            const candidate = node as HTMLElement
            candidate.style.setProperty('display', 'none', 'important')
            candidate.setAttribute('data-hanasand-cookie-dismissed', '1')
        }
    }).catch(() => undefined)

    const hideTopLevelConsentFrame = async (frame: Page | Frame) => {
        await frame.evaluate(() => {
            const overlays = Array.from(document.querySelectorAll('iframe')).filter((iframe) => {
                const style = window.getComputedStyle(iframe)
                const rect = iframe.getBoundingClientRect()
                const src = (iframe.getAttribute('src') || '').toLowerCase()
                const isLargeFixedOverlay = ['fixed', 'absolute'].includes(style.position) && rect.height >= window.innerHeight * 0.35 && rect.width >= window.innerWidth * 0.35
                const hints = /consent|cookie|gdpr|privacy|trust|onetrust|cmp|civic|quantcast|cookiebot|otnotice|ot-banner|euconsent|banner|overlay/i
                return (hints.test(src) || isLargeFixedOverlay) && style.zIndex ? Number.parseInt(style.zIndex, 10) >= 1 : false
            })

            for (const iframe of overlays) {
                iframe.style.setProperty('display', 'none', 'important')
                iframe.setAttribute('data-hanasand-cookie-dismissed', '1')
            }
        }).catch(() => undefined)
    }

    const hasCookieCopy = async (frame: Frame) => {
        try {
            const text = await frame.locator('body').innerText().catch(() => '')
            return cookiePromptText(text)
        } catch {
            return false
        }
    }

    const aggressivelyHideConsentShims = async (frame: Frame) => frame.evaluate(() => {
        const blockedWords = /cookie|consent|privacy|gdpr|tracking|preferences|data collection|essentials|onetrust|truste/i
        const isLikelyModal = (node: Element) => {
            const style = window.getComputedStyle(node)
            const rect = node.getBoundingClientRect()
            const role = (node.getAttribute('role') || '').toLowerCase()
            const text = (node.textContent || '').toLowerCase()
            const isDialog = role === 'dialog' || node.matches('[role="dialog"]')
            const isOverlay = ['fixed', 'absolute', 'sticky'].includes(style.position)
            const highZ = Number.parseInt(style.zIndex || '0', 10)
            return (isDialog || isOverlay || /modal|overlay|backdrop/i.test(node.tagName.toLowerCase()) || /dialog|consent|cookie/i.test(node.className || node.id || ''))
                && (highZ >= 1000 || rect.width >= window.innerWidth * 0.35 || rect.height >= window.innerHeight * 0.35)
                && blockedWords.test(text)
        }

        for (const element of Array.from(document.querySelectorAll('*'))) {
            if (!isLikelyModal(element)) continue
            const node = element as HTMLElement
            node.style.setProperty('display', 'none', 'important')
            node.setAttribute('data-hanasand-cookie-dismissed', '1')
        }

        const forms = Array.from(document.querySelectorAll('iframe')).filter(node => blockedWords.test((node.src || '').toLowerCase()) || blockedWords.test(node.className || node.id || ''))
        for (const iframe of forms) {
            const frame = iframe as HTMLIFrameElement
            frame.style.setProperty('display', 'none', 'important')
            frame.style.setProperty('opacity', '0', 'important')
        }
    }).catch(() => undefined)

    const pressCookieShortcuts = async () => {
        await page.keyboard.press('Escape').catch(() => undefined)
        await page.keyboard.press('Tab').catch(() => undefined)
        await page.keyboard.press('Enter').catch(() => undefined)
        await page.mouse.click(8, 8).catch(() => undefined)
    }

    for (let attempt = 0; attempt < passLimit; attempt++) {
        let touched = false
        const frames = [page.mainFrame(), ...page.frames()]
        for (const frame of frames) {
            touched ||= await clickInFrame(frame)
        touched ||= await clickTextButtonInFrame(frame)
        touched ||= await clickShadowCookieElements(frame)
        touched ||= await clickConsentButtonsByText(frame)
        await hideCandidateOverlays(frame)
        await aggressivelyHideConsentShims(frame)
    }
        const bodyStillHasCookieText = await hasCookieCopy(page.mainFrame())
        const visibleConsentWidgets = await page.locator('iframe, [role="dialog"]').count().catch(() => 0)
        await hideTopLevelConsentFrame(page).catch(() => undefined)
        if (attempt % 2 === 0) {
            await pressCookieShortcuts()
        }
        if (!touched && !bodyStillHasCookieText && visibleConsentWidgets === 0) break
        await page.waitForTimeout(420).catch(() => undefined)
    }
}

async function waitForProviderCaptureReadiness(page: Page, tool: { id?: string; name?: string; url?: string }): Promise<ProviderCaptureReadiness> {
    const normalized = `${tool.id || ''} ${tool.name || ''} ${tool.url || ''}`.toLowerCase()
    const isVirusTotal = /virustotal|virus total/.test(normalized)
    const isUrlQuery = /urlquery/.test(normalized)
    const provider = isVirusTotal ? 'virustotal' : isUrlQuery ? 'urlquery' : 'generic'
    const markerSelectors = isVirusTotal
        ? [
            'text=/results/i',
            'text=/security vendors/i',
            'text=/harmless/i',
            'text=/undetected/i',
            'text=/malicious/i',
            'text=/no detections/i',
            'text=/detection ratio/i',
            'text=/analysis/i',
            'text=/threats?/i',
            'text=/suspicious/i',
            'text=/clean/i',
            'text=/vendors?/i',
            'text=/last analysis/i',
            'text=/detection/i',
            'text=/scanner/i',
            'text=/sha256/i',
            'text=/permalink/i',
            'text=/reports?/i',
            'text=/file info/i',
            'text=/community/i',
        ]
        : isUrlQuery
            ? [
                'text=/no results/i',
                'text=/0 alerts/i',
                'text=/alerts?/i',
                'text=/results?/i',
                'text=/search results/i',
                'text=/community/i',
                'text=/query/i',
                'text=/urlquery/i',
                'text=/malicious/i',
                'text=/detected/i',
                'text=/analysis/i',
                'text=/not malicious/i',
                'text=/clean/i',
            ]
            : [
                'text=/search/i',
                'text=/analysis/i',
                'text=/result/i',
            ]

    const cookieGateText = /cookie|consent|privacy|gdpr|opt.?out|data collection/i
    const hasCookieOverlay = async () => page.evaluate(() => {
        const selectors = [
            '[id*="cookie" i]',
            '[class*="cookie" i]',
            '[id*="consent" i]',
            '[class*="consent" i]',
            '[role="dialog"][aria-label*="cookie" i]',
            '[role="dialog"][aria-label*="consent" i]',
            '[id*="onetrust" i]',
            '[class*="onetrust" i]',
            '[id*="sp_message" i]',
            '[class*="sp_message" i]',
            'iframe[src*="cookie" i]',
            'iframe[src*="consent" i]',
            'iframe[src*="gdpr" i]',
            'iframe[src*="onetrust" i]',
        ]

        const hasVisible = (element: Element | null) => {
            if (!element) return false
            const style = window.getComputedStyle(element)
            if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') <= 0.05) return false
            const rect = element.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
        }

        const topMatch = (text: string) => /cookie|consent|privacy|gdpr|tracking|analytics|preferences|data collection/i.test(text)

        for (const selector of selectors) {
            for (const node of Array.from(document.querySelectorAll(selector))) {
                if (!hasVisible(node)) continue
                const text = (node.textContent || '').toLowerCase()
                if (topMatch(text)) return true
                const z = Number.parseInt(window.getComputedStyle(node as Element).zIndex || '0', 10)
                const bounds = (node as Element).getBoundingClientRect()
                if ((Number.isFinite(z) && z >= 2000) || (bounds.height > 120 && bounds.width > 300)) {
                    return true
                }
            }
        }

        const buttons = Array.from(document.querySelectorAll('button, a, input'))
        const likelyActions = buttons.filter((button) => {
            const text = (button.textContent || '').toLowerCase()
            const value = (button as HTMLInputElement).getAttribute('value')?.toLowerCase() || ''
            const combined = `${text} ${value}`
            return /accept|allow|ok|continue|agree|godta|accepter|proceed|got it|close|dismiss|manage/.test(combined)
        })

        return likelyActions.some((button) => {
            if (!hasVisible(button)) return false
            const parentText = ((button.closest('[role="dialog"], [class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]')?.textContent || '').toLowerCase())
            return /cookie|consent|privacy|gdpr|tracking/.test(parentText)
        })
    }).catch(() => false)

    const hasNoProviderSignal = (text: string) => /access denied|not authorized|403|rate limit|too many requests|error/i.test(text)
    const hardBlockers = [
        cookieGateText,
        /cloudflare|just a moment|bot check|enable javascript|challenge/i,
    ]
    const softWaitText = [
        /loading/i,
        /please wait/i,
        /analyzing/i,
        /preparing/i,
        /running/i,
        /searching/i,
        /redirecting/i,
    ]
    const antiBotText = /turnstile|captcha|human verification|anti.?bot/i
    const markerText = markerSelectors.map(item => item.replace(/^text=\/|\/$/g, '').replace(/\\i$/g, '').toLowerCase())
    const providerTimeoutMs = (isVirusTotal || isUrlQuery) ? 28_000 : 16_000
    const settledMs = (isVirusTotal || isUrlQuery) ? 14_000 : 7_000
    const stableMs = (isVirusTotal || isUrlQuery) ? 9_000 : 4_000
    const cookieAttemptLimit = (isVirusTotal || isUrlQuery) ? 12 : 4
    const deadline = Date.now() + providerTimeoutMs
    const settledDeadline = Date.now() + settledMs
    const stableDeadline = Date.now() + stableMs

    const hasExpectedProviderDomain = async () => {
        const current = page.url().toLowerCase()
        if (isVirusTotal) return /virustotal\.com/i.test(current)
        if (isUrlQuery) return /urlquery\.net/i.test(current) || /urlquery\.io/i.test(current) || /urlquery/i.test(current)
        return true
    }
    const hasProviderTextSignal = (text: string, tokens: RegExp[]) => tokens.some(token => token.test(text))
    const hasMeaningfulContent = (text: string) => text.length > 220 && /[a-z]{2,}/i.test(text)
    const readyTokens = isVirusTotal
        ? [
            /\b(vendor|vendors|engine|engines)\b/i,
            /\b(\d+\s*\/\s*\d+)\b/i,
            /\bdetection ratio\b/i,
            /\b(no detections|undetected|harmless|suspicious|malicious)\b/i,
            /\bsecurity\s+vendors\b/i,
            /\bcommunity\b/i,
            /\bpermalink\b/i,
            /\blast analysis\b/i,
        ]
        : [
            /\b(\d+)\s+(?:alerts?|detections?)\b/i,
            /\burlquery\b/i,
            /\b(community|security|threat)\b/i,
            /\b(no alerts|0 alerts|no results|undetected|not malicious|malicious)\b/i,
            /\bsearch results\b/i,
        ]
    const providerResultTokens = isVirusTotal
        ? [
            /\b\d+\s*\/\s*\d+\b/i,
            /\bsecurity\s+vendors\b/i,
            /\bdetection ratio\b/i,
            /\bno detections\b/i,
            /\bfile info\b/i,
            /\breport\b/i,
            /\b(analysis|scan)\b.*(?:result|report|summary)/i,
        ]
        : [
            /\b(\d+)\s+(?:alerts?|detections?)\b/i,
            /\bno alerts?\b/i,
            /\bno results\b/i,
            /\bnot malicious\b/i,
            /\bresults?\b/i,
            /\b(unblocked|malicious|community|query)\b/i,
            /\bcommunity comments?\b/i,
            /\b(\d+)\s*(?:security alerts?|detection|hits?)\b/i,
            /\bsearch results\b/i,
        ]
    const snapshotText = async () => {
        const result = await page.evaluate(() => `${document.title} ${document.body?.innerText || ''}`.toLowerCase()).catch(() => '')
        return `${result || ''}`
    }
    const hasReadyEvidence = (text: string) => markerText.some(item => text.includes(item))
    const hasResultLikeSignal = (text: string) => hasProviderTextSignal(text, readyTokens)
    let cookieGateAttempts = 0
    let meaningfulContentObserved = false
    while (Date.now() < deadline) {
        const text = await snapshotText()
        await dismissCookieOverlays(page).catch(() => undefined)
        const likelyCookieOverlay = await hasCookieOverlay()
        const inProviderDomain = await hasExpectedProviderDomain()
        const hasMeaningful = hasMeaningfulContent(text)
        if (hasMeaningful) meaningfulContentObserved = true
        const hasProviderResultText = hasProviderTextSignal(text, providerResultTokens)
        const hasProviderResultLikeSignal = hasProviderResultText || hasResultLikeSignal(text)
        const isLikelyCookiePath = /consent|cookie|privacy|gdpr/i.test(page.url())

        if ((isVirusTotal || isUrlQuery) && inProviderDomain && hasProviderResultLikeSignal && !antiBotText.test(text)) {
            return {
                ready: true,
                statusText: `content-ready-${provider}`,
            }
        }
        if (!isVirusTotal && !isUrlQuery && hasProviderResultLikeSignal && inProviderDomain && Date.now() > settledDeadline) {
            return {
                ready: true,
                statusText: `content-ready-${provider}`,
            }
        }

        if ((isVirusTotal || isUrlQuery) && likelyCookieOverlay && cookieGateAttempts < cookieAttemptLimit) {
            cookieGateAttempts += 1
            await dismissCookieOverlays(page).catch(() => undefined)
            await page.waitForTimeout(450).catch(() => undefined)
            continue
        }
        if (
            isVirusTotal
            && hasMeaningful
            && inProviderDomain
            && Date.now() > settledDeadline
            && !antiBotText.test(text)
            && !/access denied|challenge|captcha|cloudflare|just a moment/i.test(text)
        ) {
            return {
                ready: true,
                statusText: `stabilized-content-${provider}`,
            }
        }

        if (
            isUrlQuery
            && hasMeaningful
            && inProviderDomain
            && Date.now() > settledDeadline
            && !antiBotText.test(text)
            && !/access denied|challenge|captcha|cloudflare|just a moment/i.test(text)
        ) {
            return {
                ready: true,
                statusText: `stabilized-content-${provider}`,
            }
        }

        if (hasNoProviderSignal(text)) {
            return {
                ready: false,
                blocker: `provider-blocked-${provider}`,
                statusText: 'Provider returned access denial or error text.',
            }
        }
        if (!inProviderDomain && !isVirusTotal && !isUrlQuery) {
            // Unknown provider page is not a usable provider result.
            return {
                ready: false,
                blocker: `provider-domain-mismatch-${provider}`,
                statusText: `Expected provider domain context not reached yet (${tool.name || tool.id || provider}).`,
            }
        }
        if ((isVirusTotal || isUrlQuery) && !inProviderDomain) {
            if (cookieGateAttempts < cookieAttemptLimit) {
                cookieGateAttempts += 1
                await dismissCookieOverlays(page).catch(() => undefined)
                await page.waitForTimeout(500).catch(() => undefined)
                continue
            }
            return {
                ready: false,
                blocker: `provider-domain-mismatch-${provider}`,
                statusText: `Could not reach ${provider} provider page after consent handling.`,
            }
        }

        for (const selector of markerSelectors) {
            if (await page.locator(selector).first().isVisible({ timeout: 100 }).catch(() => false)) {
                return {
                    ready: true,
                    statusText: `selector-ready-${provider}`,
                }
            }
        }

        if ((isVirusTotal || isUrlQuery) && hasProviderResultText && hasMeaningful && inProviderDomain) {
            return {
                ready: true,
                statusText: `content-ready-${provider}`,
            }
        }
        if (hasProviderResultText) {
            return {
                ready: true,
                statusText: `content-ready-${provider}`,
            }
        }

        const cookieGate = cookieGateText.test(text)
        if (!isVirusTotal && !isUrlQuery && hasResultLikeSignal(text) && inProviderDomain && Date.now() > settledDeadline && hasMeaningful) {
            return {
                ready: true,
                statusText: `stabilized-content-${provider}`,
            }
        }
        if (!isVirusTotal && !isUrlQuery && hasResultLikeSignal(text) && hasMeaningful && hasProviderResultText && Date.now() > stableDeadline) {
            return {
                ready: true,
                statusText: `stabilized-content-${provider}`,
            }
        }
        if (cookieGate && likelyCookieOverlay && cookieGateAttempts < cookieAttemptLimit) {
            cookieGateAttempts += 1
            await dismissCookieOverlays(page).catch(() => undefined)
            await page.waitForTimeout(500).catch(() => undefined)
            continue
        }
        if (cookieGate && !likelyCookieOverlay && !isLikelyCookiePath && hasMeaningful && inProviderDomain && Date.now() > settledDeadline) {
            return {
                ready: true,
                statusText: `stabilized-content-${provider}`,
            }
        }
        if (cookieGate && !likelyCookieOverlay && !isLikelyCookiePath && hasResultLikeSignal(text) && Date.now() > settledDeadline) {
            return {
                ready: true,
                statusText: `stabilized-content-${provider}`,
            }
        }
        if (cookieGate && !likelyCookieOverlay && !isLikelyCookiePath && hasMeaningful && inProviderDomain) {
            // Non-overlay cookie vocabulary on the same result page may be benign footer text.
            if (Date.now() > settledDeadline && hasResultLikeSignal(text)) {
                return {
                    ready: true,
                    statusText: `stabilized-content-${provider}`,
                }
            }
        }

        if (cookieGate && !likelyCookieOverlay && inProviderDomain && hasMeaningful && Date.now() > stableDeadline) {
            return {
                ready: true,
                statusText: `stabilized-content-${provider}`,
            }
        }

        const hardBlockMatch = hardBlockers.find(item => item.test(text))
        if (hardBlockMatch) {
            const isCookieGate = cookieGateText.test(text) && hardBlockMatch === cookieGateText
            if (isCookieGate && likelyCookieOverlay && cookieGateAttempts < cookieAttemptLimit) {
                cookieGateAttempts += 1
                await dismissCookieOverlays(page).catch(() => undefined)
                await page.waitForTimeout(500).catch(() => undefined)
                continue
            }
            if (isCookieGate && !(hasMeaningful && inProviderDomain)) {
                return {
                    ready: false,
                    blocker: `blocked-by-${provider}-consent-or-cookie-gate`,
                    statusText: likelyCookieOverlay
                        ? `Detected persistent cookie-consent blocker UI on ${provider}.`
                        : `Detected cookie-consent keyword while waiting for ${provider}.`,
                }
            }
            const blocker = antiBotText.test(text) ? 'anti-bot-challenge' : 'cloudflare-or-challenge'
            return {
                ready: false,
                blocker: `${blocker}-${provider}`,
                statusText: antiBotText.test(text) ? 'Anti-bot challenge detected.' : 'Cloudflare or challenge gate detected.',
            }
        }

        if (inProviderDomain && Date.now() > settledDeadline && hasMeaningful && hasResultLikeSignal(text)) {
            return {
                ready: true,
                statusText: `stabilized-content-${provider}`,
            }
        }

        if (softWaitText.some(item => item.test(text)) && Date.now() < settledDeadline) {
            await page.waitForTimeout(350).catch(() => undefined)
            continue
        }
        if (Date.now() > stableDeadline && hasReadyEvidence(text) && hasResultLikeSignal(text)) {
            return {
                ready: true,
                statusText: `content-ready-${provider}`,
            }
        }
        await page.waitForTimeout(250).catch(() => undefined)
    }

    return {
        ready: false,
        blocker: `provider-result-timeout-${provider}`,
        statusText: `provider result not ready after timeout`,
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
        /wallet|seed phrase|connect wallet|verify account|install extension|wallet connect/i.test(snapshot.text) ? 'social-engineering language present' : '',
    ].filter(Boolean)

    return {
        url: page.url(),
        textExcerpt: snapshot.text.replace(/\s+/g, ' ').trim().slice(0, 900),
        indicators,
        comments: snapshot.comments.slice(0, 8),
        forms,
        scripts,
        obfuscatedScripts,
        verdict: suspiciousReasons.length >= 2 || obfuscatedScripts.length >= 1 ? 'suspicious' : 'unknown',
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
        || text.match(/(\d{1,3})\s+(?:of)\s+(\d{1,3})\s+security engines?/i)
        || text.match(/(\d{1,3})\s+out of\s+(\d{1,3})\s+engines?/i)
    const urlqueryNoAlertText = /no\s+(?:alerts?|detections?|results?|matches?|hits?)\s+(?:were|was)?\s*(?:found|detected)?/i.test(text) || /0\s+alerts?/i.test(text)
    const vtNoDetectionsText = /\b(?:no\s+detections?|0\s*\/\s*\d+\s+security\s+vendors?|no detections|undetected|clean)\b/i.test(text)
    const alertMatch = text.match(/(\d{1,3})\s+(?:alerts?|detections?|blacklists?|malicious requests?)/i)
        || text.match(/Found\s+(\d{1,3})\s+(?:alert|alerts)/i)
    const communityMatch = text.match(/(\d{1,3})\s+(?:community\s*)?(?:comments?|votes?|reviews?)/i)
    const isVirusTotal = /virus\s*total|virustotal/.test(tool) || /virustotal\.com/i.test(text)
    const isUrlQuery = /urlquery|urlquery\.net/.test(tool) || /urlquery\.net/i.test(text)
    const rawFlagged = vendorMatch ? Number(vendorMatch[1]) : undefined
    const flagged = Number.isFinite(rawFlagged) ? rawFlagged : vtNoDetectionsText ? 0 : undefined
    const total = vendorMatch?.[2] ? Number(vendorMatch[2]) : undefined
    const alertCount = alertMatch ? Number(alertMatch[1]) : urlqueryNoAlertText ? 0 : undefined
    const communityCommentCount = communityMatch ? Number(communityMatch[1]) : evidence.comments?.length || undefined
    const hasProviderNoDetectionText = /(?:no\s+(?:detections|alerts?|results?|matches?|issues)\s+(?:found)?|undetected|clean|harmless)/i.test(text)
    const hasVendorDetections = flagged !== undefined && Number.isFinite(flagged) && flagged > 0
    const hasUrlQueryAlerts = alertCount !== undefined && Number.isFinite(alertCount) && alertCount > 0
    const hasUrlQueryNoResult = /no\s+(?:alerts?|detections?|results?|matches?)\s+found/i.test(text) || /0\s+alerts?/i.test(text)
    const hasExplicitMaliciousIndicator = /malicious|phishing|blacklist|detected/i.test(text)
    const hasExplicitBenignIndicator = hasProviderNoDetectionText
    const hasParsedProviderSignal = vendorMatch !== null || alertMatch !== null || communityMatch !== null

    const verdict = isVirusTotal
        ? vendorMatch
            ? (hasVendorDetections ? 'suspicious' : hasExplicitBenignIndicator ? 'clean' : 'clean')
            : vtNoDetectionsText
                ? 'clean'
                : hasProviderNoDetectionText
                    ? 'clean'
                    : 'unknown'
        : isUrlQuery
            ? alertCount !== undefined
                ? (hasUrlQueryAlerts ? 'suspicious' : 'clean')
                : hasUrlQueryNoResult
                    ? 'clean'
                    : 'unknown'
            : hasExplicitMaliciousIndicator && hasParsedProviderSignal && !hasExplicitBenignIndicator
                ? 'suspicious'
                : hasExplicitBenignIndicator || /no(?:t|) malicious/i.test(text)
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
