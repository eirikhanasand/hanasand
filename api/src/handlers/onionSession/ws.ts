import { createHash } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import { readFile, stat } from 'node:fs/promises'
import WebSocket, { type RawData } from 'ws'
import { chromium, type Browser, type BrowserContext, type Frame, type Page, type Request } from 'playwright'
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
    host?: string
    mimeType?: string
    initiator?: string
    durationMs?: number
    ip?: string
    asn?: string
    port?: number
    protocol?: string
    tlsIssuer?: string
    tlsSubject?: string
    tlsValidFrom?: number
    tlsValidTo?: number
    fileName?: string
    bytes?: number
    sha256?: string
    hashStatus?: string
    failure?: string
    at: string
}
type SandboxDeobfuscationTask = ReturnType<typeof summarizeDeobfuscationTask>
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
const DEFAULT_HEIGHT = 720
const MAX_DURATION_MS = 60 * 60 * 1000
const FRAME_INTERVAL_MS = 900
const DEFAULT_BROWSER_MAX_SESSIONS = 10
const MAX_DOWNLOAD_HASH_BYTES = 5 * 1024 * 1024
const asnCache = new Map<string, Promise<string | undefined>>()
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

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
let warmRegularBrowser: Promise<Browser> | null = null

function allowLocalSandboxTargets() {
    return process.env.BROWSER_SANDBOX_ALLOW_LOCAL_TARGETS === '1'
}

function chromiumHeadless() {
    if (process.env.BROWSER_SANDBOX_HEADLESS) return process.env.BROWSER_SANDBOX_HEADLESS !== '0'
    return process.platform === 'linux' && !process.env.DISPLAY
}

function chromiumLaunchOptions(proxy?: string) {
    return {
        headless: chromiumHeadless(),
        executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium',
        proxy: proxy ? { server: proxy } : undefined,
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-blink-features=AutomationControlled',
        ],
    }
}

function regularBrowser() {
    warmRegularBrowser ||= chromium.launch(chromiumLaunchOptions()).then(browser => {
        browser.on('disconnected', () => {
            warmRegularBrowser = null
        })
        return browser
    }).catch(error => {
        warmRegularBrowser = null
        throw error
    })
    return warmRegularBrowser
}

if (process.env.NODE_ENV === 'production' && process.env.BROWSER_SANDBOX_PREWARM !== '0') {
    setTimeout(() => void regularBrowser().catch(() => undefined), 1000).unref()
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
    let context: BrowserContext | null = null
    let page: Page | null = null
    let ownsBrowser = false
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
    let cachedDeobfuscationTasks: SandboxDeobfuscationTask[] = []
    let cachedThreatAssociations: ReturnType<typeof extractThreatAssociations> = []
    let cachedIndicators: ReturnType<typeof extractIndicators> | null = null
    let documentEvidencePromises: Promise<void>[] = []

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
        cachedDeobfuscationTasks = []
        cachedThreatAssociations = []
        cachedIndicators = null
        await context?.close().catch(() => undefined)
        if (ownsBrowser) await browser?.close().catch(() => undefined)
        context = null
        browser = null
        page = null
        ownsBrowser = false
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
            send({ type: 'ended', sessionId })
            await cleanup()
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
            await page.setViewportSize(browserViewportForMessage(message))
            await sendFrame(true)
        }
    }

    async function startBrowser(message: BrokerMessage) {
        await cleanup()
        closed = false
        remoteClipboard = ''
        networkEvents = []
        cachedDeobfuscationTasks = []
        cachedThreatAssociations = []
        cachedIndicators = null
        documentEvidencePromises = []
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

            ownsBrowser = Boolean(proxy || network !== 'regular')
            browser = ownsBrowser ? await chromium.launch(chromiumLaunchOptions(proxy)) : await regularBrowser()
            context = await browser.newContext({
                viewport: browserViewportForMessage(message),
                ignoreHTTPSErrors: true,
                userAgent: CHROME_USER_AGENT,
                locale: 'en-US',
                extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
                acceptDownloads: true,
                permissions: network === 'regular' ? [] : ['clipboard-read', 'clipboard-write'],
            })
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
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
            page.on('response', async (response) => {
                const [server, security] = await Promise.all([
                    response.serverAddr().catch(() => null),
                    response.securityDetails().catch(() => null),
                ])
                const asn = await lookupAsn(server?.ipAddress)
                const request = response.request()
                const capturedAt = new Date().toISOString()
                const startedAt = [...networkEvents].reverse().find(event => event.kind === 'request' && event.url === response.url() && event.method === request.method())?.at
                trackNetwork({
                    kind: 'response',
                    url: response.url(),
                    method: request.method(),
                    resourceType: request.resourceType(),
                    status: response.status(),
                    host: domainFromUrl(response.url()),
                    mimeType: response.headers()['content-type'],
                    initiator: requestInitiator(request),
                    durationMs: responseDurationMs(request.timing()) ?? elapsedMs(startedAt, capturedAt),
                    ip: server?.ipAddress,
                    asn,
                    port: server?.port,
                    protocol: security?.protocol,
                    tlsIssuer: security?.issuer,
                    tlsSubject: security?.subjectName,
                    tlsValidFrom: security?.validFrom,
                    tlsValidTo: security?.validTo,
                    at: capturedAt,
                })
                if (response.request().resourceType() === 'document' && /html/i.test(response.headers()['content-type'] || '')) {
                    queueDocumentEvidence(response.text())
                }
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
                void inspectDownload(download).then(evidence => {
                    trackNetwork({
                        kind: 'download',
                        url: download.url(),
                        failure: 'download saved for hash evidence, then deleted',
                        at: new Date().toISOString(),
                        ...evidence,
                    })
                    send({ type: 'status', state: 'download_blocked', url: download.url(), message: 'Download hashed for evidence and deleted.' })
                })
                    .catch(() => {
                        trackNetwork({
                            kind: 'download',
                            url: download.url(),
                            failure: 'download blocked for sandbox safety',
                            at: new Date().toISOString(),
                        })
                        send({ type: 'status', state: 'download_blocked', url: download.url(), message: 'Download blocked for sandbox safety.' })
                    })
                    .finally(() => void download.delete().catch(() => undefined))
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
            await Promise.allSettled(documentEvidencePromises)
            const initialEvidence = page ? await collectPageEvidence(page).catch(() => null) : null
            rememberDeobfuscationTasks(initialEvidence)
            void captureProfileTools(
                context,
                message.profileTools || [],
                target,
                initialEvidence?.deobfuscationTasks?.length ? initialEvidence.deobfuscationTasks : cachedDeobfuscationTasks,
            ).catch(error => {
                send({
                    type: 'status',
                    state: 'profile_tools_failed',
                    sessionId,
                    message: error instanceof Error ? error.message : String(error),
                })
            })
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
            void sendFrame(true, 'initial_target')
            void dismissCookieOverlays(page)
                .then(() => sendFrame(true, 'cookie_dismissed'))
                .catch(() => undefined)
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
        const plannedTools = tools.slice(0, 6).filter(tool => tool.url)
        if (process.env.BROWSER_SANDBOX_PROVIDER_TABS === '0') return
        await Promise.all(plannedTools.map(async (tool) => {
            const toolPage = await context.newPage().catch(() => null)
            if (!toolPage) return
            const startedAt = new Date().toISOString()
            const toolUrl = tool.url!.replaceAll('{url}', encodeURIComponent(target)).replaceAll('{rawUrl}', target)
            const providerBodies = collectProviderResponses(toolPage, tool.name || toolUrl)
            try {
                toolPage.setDefaultTimeout(providerTimeoutMs(tool))
                send({
                    type: 'status',
                    state: 'profile_tool_started',
                    sessionId,
                    message: `${tool.name || toolUrl} provider capture started.`,
                })
                const preparedUrl = providerStartUrl(tool, toolUrl, target)
                let navigationError = await withTimeout(
                    toolPage.goto(preparedUrl, { waitUntil: 'commit', timeout: providerTimeoutMs(tool) })
                        .then(() => '')
                        .catch(error => error instanceof Error ? error.message : String(error)),
                    providerTimeoutMs(tool),
                    `provider navigation still pending after ${Math.round(providerTimeoutMs(tool) / 1000)}s`,
                )
                await toolPage.waitForLoadState('domcontentloaded', { timeout: providerTimeoutMs(tool) }).catch(() => undefined)
                await dismissCookieOverlays(toolPage).catch(() => undefined)
                const actionError = await interactWithProvider(toolPage, tool, target)
                navigationError ||= actionError
                const openedImage = await withTimeout(toolPage.screenshot({ type: 'jpeg', quality: 56, animations: 'disabled', timeout: 800 }), 800, null)
                const openedEvidence = providerPendingEvidence(toolPage.url() || preparedUrl, tool.name || toolUrl, target)
                send({
                    type: 'tool_capture',
                    sessionId,
                    id: tool.id || safeToolId(tool.name || toolUrl),
                    name: tool.name || toolUrl,
                    url: toolPage.url() || preparedUrl,
                    title: await toolPage.title().catch(() => ''),
                    capturedAt: startedAt,
                    image: openedImage ? openedImage.toString('base64') : null,
                    evidence: openedEvidence,
                    toolAnalysis: analyzeToolEvidence(tool.name || toolUrl, openedEvidence),
                    target,
                    error: navigationError || 'Provider tab opened; verdict parsing is still running.',
                })
                const providerText = officialProviderKind(preparedUrl)
                    ? await waitForProviderData(tool, toolPage, providerBodies)
                    : [providerBodies(), await collectFastRenderedText(toolPage)].filter(Boolean).join('\n')
                if (providerText && hasParsedProviderData(tool, providerText)) {
                    navigationError = ''
                    const parsedEvidence = enrichProviderEvidence(providerPendingEvidence(toolPage.url() || preparedUrl, tool.name || toolUrl, target), providerText)
                    const parsedImage = await withTimeout(toolPage.screenshot({ type: 'jpeg', quality: 64, animations: 'disabled', timeout: 1500 }), 1500, openedImage)
                    send({
                        type: 'tool_capture',
                        sessionId,
                        id: tool.id || safeToolId(tool.name || toolUrl),
                        name: tool.name || toolUrl,
                        url: toolPage.url() || preparedUrl,
                        title: await toolPage.title().catch(() => ''),
                        capturedAt: startedAt,
                        image: parsedImage ? parsedImage.toString('base64') : null,
                        evidence: parsedEvidence,
                        toolAnalysis: analyzeToolEvidence(tool.name || toolUrl, parsedEvidence),
                        target,
                    })
                }
                const webcrackTool = isWebCrackTool(tool, toolUrl)
                let webcrackLoad: WebCrackLoadResult | undefined
                if (webcrackTool) {
                    const tasks = await webCrackTasks(deobfuscationTasks)
                    webcrackLoad = await withTimeout(loadWebCrackSample(toolPage, tasks), 2500, { loaded: false, reason: 'WebCrack did not accept a sample within the provider budget.' })
                }
                await toolPage.waitForTimeout(webcrackLoad?.loaded ? 150 : 1200).catch(() => undefined)
                if (webcrackTool) {
                    const evidence = enrichProviderEvidence(await withTimeout(collectPageEvidence(toolPage), 400, providerPendingEvidence(toolPage.url() || toolUrl, tool.name || toolUrl, target)), providerBodies())
                    const image = await withTimeout(toolPage.screenshot({ type: 'jpeg', quality: 64, animations: 'disabled', timeout: 500 }), 500, null)
                    send({
                        type: 'tool_capture',
                        sessionId,
                        id: tool.id || safeToolId(tool.name || toolUrl),
                        name: tool.name || toolUrl,
                        url: toolPage.url(),
                        title: await toolPage.title().catch(() => ''),
                        capturedAt: startedAt,
                        image: image ? image.toString('base64') : null,
                        evidence,
                        toolAnalysis: analyzeToolEvidence(tool.name || toolUrl, evidence, webcrackLoad),
                        webcrackLoad,
                        target,
                        error: navigationError || undefined,
                    })
                    return
                }
                const initialEvidence = enrichProviderEvidence(await withTimeout(collectPageEvidence(toolPage), 2500, providerPendingEvidence(toolPage.url() || toolUrl, tool.name || toolUrl, target)), providerBodies())
                const initialImage = await withTimeout(toolPage.screenshot({ type: 'jpeg', quality: 64, animations: 'disabled', timeout: 2500 }), 2500, null)
                const initialAnalysis = analyzeToolEvidence(tool.name || toolUrl, initialEvidence)
                let image = initialImage
                let evidence = initialEvidence
                let toolAnalysis = navigationError
                    ? {
                        ...initialAnalysis,
                        extractedSignals: [
                            ...((initialAnalysis.extractedSignals || []) as string[]),
                            `Provider navigation incomplete: ${navigationError}`,
                        ],
                    }
                    : initialAnalysis
                if (webcrackTool) {
                    image = await withTimeout(toolPage.screenshot({ type: 'jpeg', quality: 64, animations: 'disabled', timeout: 500 }), 500, image)
                    evidence = enrichProviderEvidence(await withTimeout(collectPageEvidence(toolPage), 500, evidence), providerBodies())
                    toolAnalysis = analyzeToolEvidence(tool.name || toolUrl, evidence, webcrackLoad)
                }
                send({
                    type: 'tool_capture',
                    sessionId,
                    id: tool.id || safeToolId(tool.name || toolUrl),
                    name: tool.name || toolUrl,
                    url: toolPage.url(),
                    title: await toolPage.title().catch(() => ''),
                    capturedAt: startedAt,
                    image: image ? image.toString('base64') : null,
                    evidence,
                    toolAnalysis,
                    webcrackLoad,
                    target,
                    error: navigationError || undefined,
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
        }))
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
        const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 25_000 }).catch((error) => {
            send({ type: 'navigation_error', target, message: error instanceof Error ? error.message : String(error) })
            return null
        })
        if (response && /html/i.test(response.headers()['content-type'] || '')) {
            await queueDocumentEvidence(response.text())
        }
        void sendFrame(true)
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
        await page.waitForTimeout(80).catch(() => undefined)
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
            await page.keyboard.insertText(message.key)
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
        const frameQuality = await collectFrameQuality(page, viewport?.width || DEFAULT_WIDTH, viewport?.height || DEFAULT_HEIGHT)
        const evidence = await collectPageEvidence(page)
        if (!evidence.deobfuscationTasks.length && cachedDeobfuscationTasks.length) {
            evidence.deobfuscationTasks = cachedDeobfuscationTasks
            evidence.obfuscatedScripts = cachedDeobfuscationTasks.map(task => ({
                id: task.scriptId || 'cached_script',
                src: task.source || 'inline',
                inlineBytes: Buffer.byteLength(task.sample || task.decodedPreview || ''),
                obfuscationScore: 3,
                reasons: ['cached from document HTML'],
                sample: task.sample || task.decodedPreview || '',
                sha256: task.sha256 || createHash('sha256').update(task.source || task.sample || task.decodedPreview || '').digest('hex'),
            }))
        }
        if (cachedThreatAssociations.length && !evidence.threatAssociations.length) evidence.threatAssociations = cachedThreatAssociations
        if (cachedIndicators) {
            evidence.indicators = {
                domains: Array.from(new Set([...evidence.indicators.domains, ...cachedIndicators.domains])).slice(0, 80),
                ips: Array.from(new Set([...evidence.indicators.ips, ...cachedIndicators.ips])).slice(0, 80),
                urls: Array.from(new Set([...evidence.indicators.urls, ...cachedIndicators.urls])).slice(0, 80),
            }
        }
        rememberDeobfuscationTasks(evidence)
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
            frameQuality,
            evidence,
            networkSummary: summarizeNetworkEvents(networkEvents),
        })
    }

    async function collectFrameQuality(targetPage: Page, viewportWidth: number, viewportHeight: number) {
        return await targetPage.evaluate(({ viewportWidth, viewportHeight }) => {
            const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
            const elementCount = document.body ? document.body.querySelectorAll('*').length : 0
            const bodyHeight = Math.max(
                document.body?.scrollHeight || 0,
                document.documentElement?.scrollHeight || 0,
            )
            const visibleMedia = document.querySelectorAll('img, video, canvas, svg, picture').length
            const looksBlank = text.length < 20 && elementCount < 5 && visibleMedia === 0
            return {
                looksBlank,
                visibleTextLength: text.length,
                elementCount,
                visibleMedia,
                bodyHeight,
                viewportWidth,
                viewportHeight,
            }
        }, { viewportWidth, viewportHeight }).catch(() => ({
            looksBlank: true,
            visibleTextLength: 0,
            elementCount: 0,
            visibleMedia: 0,
            bodyHeight: 0,
            viewportWidth,
            viewportHeight,
        }))
    }

    function rememberDeobfuscationTasks(evidence: { deobfuscationTasks?: SandboxDeobfuscationTask[] } | null) {
        if (evidence?.deobfuscationTasks?.length) cachedDeobfuscationTasks = evidence.deobfuscationTasks
    }

    function rememberDocumentEvidence(html: string) {
        rememberDeobfuscationTasks({ deobfuscationTasks: documentDeobfuscationTasks(html) })
        const renderedText = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
        cachedIndicators = extractIndicators(`${html}\n${renderedText}`)
        const associations = extractThreatAssociations(renderedText, 'rendered_page')
        if (associations.length) cachedThreatAssociations = associations
    }

    function queueDocumentEvidence(body: Promise<string>) {
        const pending = body.then(html => rememberDocumentEvidence(html)).catch(() => undefined)
        documentEvidencePromises.push(pending)
        void pending.finally(() => {
            documentEvidencePromises = documentEvidencePromises.filter(item => item !== pending)
        })
        return pending
    }

    async function webCrackTasks(tasks: SandboxDeobfuscationTask[]) {
        const deadline = Date.now() + 1200
        while (!tasks.length && !cachedDeobfuscationTasks.length && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }
        return tasks.length ? tasks : cachedDeobfuscationTasks
    }
}

function documentDeobfuscationTasks(html: string): SandboxDeobfuscationTask[] {
    const scripts = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
        .map((match, index) => inspectScript({
            src: /\bsrc=["']([^"']+)["']/i.exec(match[1])?.[1] || '',
            inline: match[2] || '',
        }, index))
        .filter(script => script.obfuscationScore >= 3)
    return scripts.map(script => summarizeDeobfuscationTask(script))
}

function summarizeNetworkEvents(events: SandboxNetworkEvent[]) {
    const requests = events.filter(event => event.kind === 'request')
    const responses = events.filter(event => event.kind === 'response')
    const failures = events.filter(event => event.kind === 'failed' || event.kind === 'download')
    const domains = Array.from(new Set(events.map(event => domainFromUrl(event.url)).filter(Boolean))).slice(0, 80)
    const recentRequests = events
        .filter(event => event.kind === 'request' || event.kind === 'response' || event.kind === 'failed')
        .slice(-60)
        .map(event => ({
            url: event.url,
            method: event.method,
            resourceType: event.resourceType,
            status: event.status,
            host: event.host || domainFromUrl(event.url),
            mimeType: event.mimeType,
            initiator: event.initiator,
            durationMs: event.durationMs,
            ip: event.ip,
            asn: event.asn,
            port: event.port,
            protocol: event.protocol,
            tlsIssuer: event.tlsIssuer,
            tlsSubject: event.tlsSubject,
            tlsValidFrom: event.tlsValidFrom,
            tlsValidTo: event.tlsValidTo,
            failure: event.failure,
            at: event.at,
        }))
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
        recentRequests,
        statusCounts,
        redirectChain,
        downloads: events.filter(event => event.kind === 'download').slice(-20).map(event => ({
            url: event.url,
            fileName: event.fileName,
            bytes: event.bytes,
            sha256: event.sha256,
            hashStatus: event.hashStatus,
            at: event.at,
        })),
        recentFailures: failures.slice(-8).map(event => ({
            url: event.url,
            failure: event.failure || 'failed',
            at: event.at,
        })),
        lastUpdatedAt: events.at(-1)?.at,
    }
}

async function lookupAsn(ip: string | undefined) {
    if (!ip || !isPublicIPv4(ip)) return undefined
    if (!asnCache.has(ip)) {
        asnCache.set(ip, withTimeout(
            resolveTxt(`${ip.split('.').reverse().join('.')}.origin.asn.cymru.com`).then(parseCymruAsn).catch(() => undefined),
            700,
            undefined,
        ))
    }
    return asnCache.get(ip)
}

export function parseCymruAsn(records: string[][]) {
    const row = records.flat().find(Boolean)?.split('|').map(part => part.trim())
    return row?.[0] && /^\d+$/.test(row[0]) ? row[0] : undefined
}

function isPublicIPv4(ip: string) {
    const parts = ip.split('.').map(part => Number(part))
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
    const [a, b] = parts
    return !(a === 10 || a === 127 || a === 0 || a >= 224 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254))
}

function responseDurationMs(timing: { startTime: number; responseEnd: number }) {
    if (!Number.isFinite(timing.startTime) || !Number.isFinite(timing.responseEnd) || timing.responseEnd < 0) return undefined
    return Math.max(0, Math.round(timing.responseEnd))
}

function elapsedMs(start?: string, end?: string) {
    const started = Date.parse(start || '')
    const ended = Date.parse(end || '')
    if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) return undefined
    return ended - started
}

function requestInitiator(request: Request) {
    try {
        return request.frame()?.url() || 'browser'
    } catch {
        return 'browser'
    }
}

async function inspectDownload(download: { path: () => Promise<string | null>; suggestedFilename: () => string }) {
    const path = await download.path()
    if (!path) return { fileName: download.suggestedFilename(), hashStatus: 'no_download_path' }
    const info = await stat(path)
    if (info.size > MAX_DOWNLOAD_HASH_BYTES) {
        return {
            fileName: download.suggestedFilename(),
            bytes: info.size,
            hashStatus: `too_large_over_${MAX_DOWNLOAD_HASH_BYTES}_bytes`,
        }
    }
    return {
        fileName: download.suggestedFilename(),
        bytes: info.size,
        sha256: createHash('sha256').update(await readFile(path)).digest('hex'),
        hashStatus: 'hashed_and_deleted',
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
        'button:has-text("Godta og fortsett")',
        'button:has-text("Godta og lukk")',
        'button:has-text("Accepter")',
        'button:has-text("Aksepter")',
        'button:has-text("Tillat alle")',
        'button:has-text("Lagre og fortsett")',
        'button:has-text("Lagre valg")',
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

    const clickExactConsentAction = async (frame: Frame) => frame.evaluate(() => {
        const wanted = [
            'godta alle',
            'accept all',
            'accept all cookies',
            'allow all',
            'allow all cookies',
            'i agree',
        ]
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], input[type="button"], input[type="submit"]'))
        const target = candidates.find(candidate => {
            const text = `${candidate.textContent || ''} ${(candidate as HTMLInputElement).value || ''} ${candidate.getAttribute('aria-label') || ''}`.trim().toLowerCase()
            if (!wanted.some(value => text.includes(value))) return false
            const style = window.getComputedStyle(candidate)
            const rect = candidate.getBoundingClientRect()
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
        })
        if (!target) return false
        for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
            target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
        }
        target.click()
        return true
    }).catch(() => false)

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
        const isCookieAction = (value: string) => /^(accept|agree|allow|got it|continue|ok|understand|close|dismiss|not now|reject|decline|godta|aksepter|accepter|tillat|lagre|enable|essential|required|manage|customize|settings|preference|configure|save|save and continue|proceed|i agree)/.test(value)
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
        const hasCookieAction = (value: string) => /^(accept|agree|allow|got it|continue|ok|understand|close|dismiss|not now|reject|decline|godta|aksepter|accepter|tillat|lagre|enable|save|save and continue|proceed|i agree)/i.test(value)

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
            touched ||= await clickExactConsentAction(frame)
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

function isVirusTotalTool(tool: { id?: string; name?: string; url?: string }, resolvedUrl = '') {
    return /virus\s*total|virustotal/i.test(`${tool.id || ''} ${tool.name || ''} ${tool.url || ''} ${resolvedUrl}`)
}

function isUrlQueryTool(tool: { id?: string; name?: string; url?: string }, resolvedUrl = '') {
    return /urlquery/i.test(`${tool.id || ''} ${tool.name || ''} ${tool.url || ''} ${resolvedUrl}`)
}

function officialProviderKind(resolvedUrl: string) {
    const host = domainFromUrl(resolvedUrl)
    if (host.endsWith('virustotal.com')) return 'virustotal'
    if (host === 'urlquery.net' || host.endsWith('.urlquery.net')) return 'urlquery'
    return ''
}

function providerStartUrl(tool: { id?: string; name?: string; url?: string }, resolvedUrl: string, target: string) {
    const kind = officialProviderKind(resolvedUrl)
    if (kind === 'virustotal') return `https://www.virustotal.com/gui/url/${virusTotalUrlId(target)}`
    if (kind === 'urlquery') return `https://urlquery.net/api/htmx/search/?limit=24&offset=0&q=${encodeURIComponent(target)}&type=reports`
    return resolvedUrl
}

function virusTotalUrlId(target: string) {
    try {
        return createHash('sha256').update(new URL(target).href).digest('hex')
    } catch {
        return createHash('sha256').update(target).digest('hex')
    }
}

async function interactWithProvider(page: Page, tool: { id?: string; name?: string; url?: string }, target: string) {
    try {
        const kind = officialProviderKind(page.url())
        if (kind === 'virustotal' && /\/gui\/url\//i.test(page.url())) return ''
        if (kind === 'urlquery' && /\/api\/htmx\/search/i.test(page.url())) return ''
        if (kind === 'virustotal' && isVirusTotalTool(tool, page.url())) {
            await page.waitForTimeout(900)
            const searchInput = page.locator('input[type="text"], textarea:not([name="g-recaptcha-response"])').first()
            await searchInput.fill(target, { timeout: 2500 }).catch(async () => {
                await page.keyboard.type(target)
            })
            await page.keyboard.press('Enter')
            return ''
        }
        if (kind === 'urlquery' && isUrlQueryTool(tool, page.url())) {
            await page.locator('input[name="q"]').fill(target, { timeout: 3000 })
            await page.keyboard.press('Enter')
            return ''
        }
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
    return ''
}

function collectProviderResponses(page: Page, toolName: string) {
    const bodies: string[] = []
    page.on('response', response => {
        const url = response.url()
        if (!providerResponseUrl(toolName, url)) return
        const contentType = response.headers()['content-type'] || ''
        if (!/json|html|text/i.test(contentType)) return
        void response.text()
            .then(body => {
                if (body) bodies.push(body.slice(0, 80_000))
                if (bodies.length > 8) bodies.shift()
            })
            .catch(() => undefined)
    })
    return () => bodies.join('\n')
}

function providerResponseUrl(toolName: string, url: string) {
    const lower = `${toolName} ${url}`.toLowerCase()
    return lower.includes('virustotal') && /\/ui\/(?:search|urls\/)/i.test(url)
        || lower.includes('urlquery') && /\/(?:api\/htmx\/search|search\?)/i.test(url)
}

function enrichProviderEvidence<T extends Awaited<ReturnType<typeof collectPageEvidence>>>(evidence: T, providerText: string): T {
    if (!providerText) return evidence
    const summary = providerSummaryText(providerText)
    return {
        ...evidence,
        textExcerpt: [evidence.textExcerpt, summary, providerText.replace(/\s+/g, ' ').trim().slice(0, 1800)].filter(Boolean).join('\n'),
        comments: [...(evidence.comments || []), summary].filter(Boolean),
    }
}

export function providerSummaryText(providerText: string) {
    const vt = parseVirusTotalStats(providerText)
    const uq = parseUrlQueryScores(providerText)
    return [
        vt ? `${vt.flagged}/${vt.total || '?'} security vendors flagged this URL.` : '',
        uq ? `${uq.alerts} urlquery alerts were found.` : '',
    ].filter(Boolean).join('\n')
}

async function waitForProviderData(tool: { id?: string; name?: string; url?: string }, page: Page, providerText: () => string) {
    const deadline = Date.now() + providerDataTimeoutMs(tool)
    let text = [providerText(), await collectRenderedText(page)].filter(Boolean).join('\n')
    while (Date.now() < deadline) {
        if (hasParsedProviderData(tool, text)) return text
        await new Promise(resolve => setTimeout(resolve, 250))
        text = [providerText(), await collectRenderedText(page)].filter(Boolean).join('\n')
    }
    return text
}

function providerTimeoutMs(tool: { id?: string; name?: string; url?: string }) {
    return isVirusTotalTool(tool) ? 15_000 : isUrlQueryTool(tool) ? 10_000 : 4_000
}

function providerDataTimeoutMs(tool: { id?: string; name?: string; url?: string }) {
    return isVirusTotalTool(tool) ? 45_000 : isUrlQueryTool(tool) ? 18_000 : 5_000
}

function hasParsedProviderData(tool: { id?: string; name?: string; url?: string }, text: string) {
    if (isVirusTotalTool(tool) && parseVirusTotalStats(text)) return true
    if (isUrlQueryTool(tool) && parseUrlQueryScores(text)) return true
    return false
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
    return Promise.race([
        promise,
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), timeoutMs)),
    ])
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

async function collectRenderedText(page: Page) {
    const domText = await page.evaluate(() => {
        const read = (node: Node): string => {
            const parts: string[] = []
            if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent || '')
            if (node instanceof HTMLElement || node instanceof SVGElement) {
                const style = window.getComputedStyle(node)
                if (style.display === 'none' || style.visibility === 'hidden') return ''
            }
            const element = node as Element & { shadowRoot?: ShadowRoot }
            if (element.shadowRoot) parts.push(read(element.shadowRoot))
            for (const child of Array.from(node.childNodes)) parts.push(read(child))
            return parts.join(' ')
        }
        return [document.body?.innerText || '', read(document.documentElement)].join(' ').replace(/\s+/g, ' ').trim()
    }).catch(() => '')
    const accessibilityText = await page.context().newCDPSession(page)
        .then(session => session.send('Accessibility.getFullAXTree'))
        .then(tree => (tree.nodes || [])
            .flatMap(node => [node.name?.value, node.value?.value, node.description?.value])
            .filter(Boolean)
            .join(' '))
        .catch(() => '')
    return [domText, accessibilityText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

async function collectFastRenderedText(page: Page) {
    return page.evaluate(() => [document.body?.innerText || '', document.documentElement?.textContent || ''].join(' ').replace(/\s+/g, ' ').trim())
        .catch(() => '')
}

async function collectPageEvidence(page: Page) {
    const snapshot = await page.evaluate(() => {
        const html = document.documentElement?.outerHTML || ''
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
            sourceCode: html.slice(0, 80_000),
            text: (document.body?.innerText || '').slice(0, 8000),
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
        scripts: [] as Array<{ src: string; inline: string }>,
        comments: [] as string[],
        forms: [] as Array<{ action: string; method: string; inputs: Array<{ name: string; type: string; autocomplete: string }> }>,
        anchors: [] as string[],
        meta: [] as Array<{ name: string; content: string }>,
        sourceCode: '',
    }))
    const text = await collectRenderedText(page)
    const sourceIndicators = extractIndicators(snapshot.sourceCode)

    const joined = [
        page.url(),
        text,
        snapshot.sourceCode,
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
        /wallet|seed phrase|connect wallet|verify account|install extension|wallet connect/i.test(text) ? 'social-engineering language present' : '',
    ].filter(Boolean)

    return {
        url: page.url(),
        textExcerpt: text.replace(/\s+/g, ' ').trim().slice(0, 900),
        indicators,
        sourceCode: snapshot.sourceCode,
        sourceUrls: sourceIndicators.urls.filter(url => url !== page.url()).slice(0, 40),
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
        || text.match(/(\d{1,3})\s*\/\s*(\d{1,3})\s+Community Score/i)
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
    const vtStats = parseVirusTotalStats(text)
    const urlqueryScores = parseUrlQueryScores(text)
    const rawFlagged = vtStats ? vtStats.flagged : vendorMatch ? Number(vendorMatch[1]) : undefined
    const flagged = Number.isFinite(rawFlagged) ? rawFlagged : vtNoDetectionsText ? 0 : undefined
    const total = vtStats?.total || (vendorMatch?.[2] ? Number(vendorMatch[2]) : undefined)
    const alertCount = Number.isFinite(urlqueryScores?.alerts) ? urlqueryScores?.alerts : alertMatch ? Number(alertMatch[1]) : urlqueryNoAlertText ? 0 : undefined
    const communityCommentCount = communityMatch ? Number(communityMatch[1]) : evidence.comments?.length || undefined
    const hasProviderNoDetectionText = /(?:no\s+(?:detections|alerts?|results?|matches?|issues)\s+(?:found)?|undetected|clean|harmless)/i.test(text)
    const hasVendorDetections = flagged !== undefined && Number.isFinite(flagged) && flagged > 0
    const hasUrlQueryAlerts = alertCount !== undefined && Number.isFinite(alertCount) && alertCount > 0
    const hasUrlQueryNoResult = /no\s+(?:alerts?|detections?|results?|matches?)\s+found/i.test(text) || /0\s+alerts?/i.test(text)
    const hasExplicitMaliciousIndicator = /malicious|phishing|blacklist|detected/i.test(text)
    const hasExplicitBenignIndicator = hasProviderNoDetectionText
    const hasParsedProviderSignal = vendorMatch !== null || alertMatch !== null || communityMatch !== null || Boolean(vtStats || urlqueryScores)

    const verdict = isVirusTotal
        ? vendorMatch || vtStats
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

function parseVirusTotalStats(text: string) {
    const renderedScore = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})\s+(?:Community\s+Score|security\s+vendors?)/i)
    if (renderedScore) return { flagged: Number(renderedScore[1]), total: Number(renderedScore[2]) }

    const match = text.match(/"last_analysis_stats"\s*:\s*\{([^}]+)\}/)
    if (!match) return null
    const malicious = numberFromJsonField(match[1], 'malicious')
    const suspicious = numberFromJsonField(match[1], 'suspicious')
    const harmless = numberFromJsonField(match[1], 'harmless')
    const undetected = numberFromJsonField(match[1], 'undetected')
    const timeout = numberFromJsonField(match[1], 'timeout')
    const flagged = malicious + suspicious
    const total = malicious + suspicious + harmless + undetected + timeout
    return { flagged, total }
}

function numberFromJsonField(text: string, field: string) {
    const match = new RegExp(`"${field}"\\s*:\\s*(\\d+)`).exec(text)
    return match ? Number(match[1]) : 0
}

function parseUrlQueryScores(text: string) {
    const rows = Array.from(text.matchAll(/\b(\d{1,3})\s*-\s*(\d{1,3})\s*-\s*(\d{1,3})\b/g))
    if (!rows.length && !/Search:\s*\d+\s+hits/i.test(text)) return null
    const alerts = rows.reduce((max, row) => Math.max(max, Number(row[1]) + Number(row[2]) + Number(row[3])), 0)
    return { alerts }
}

function providerPendingEvidence(url: string, toolName: string, target: string): Awaited<ReturnType<typeof collectPageEvidence>> {
    return {
        url,
        textExcerpt: `${toolName} provider capture queued for ${target}. Parsed provider result is pending or blocked by provider navigation.`,
        indicators: extractIndicators(`${url}\n${target}`),
        sourceCode: '',
        sourceUrls: [],
        comments: [],
        forms: [],
        scripts: [],
        obfuscatedScripts: [],
        verdict: 'unknown',
        confidence: 10,
        reasons: ['Provider result has not returned yet.'],
        threatAssociations: [],
        deobfuscationTasks: [],
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

function browserViewportForMessage(message: Pick<BrokerMessage, 'width'>) {
    const width = clampNumber(message.width, 640, 2400, DEFAULT_WIDTH)
    return { width, height: Math.round(width * 9 / 16) }
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
