import { connectResumableWorker } from '../utils/ws/resumableWorker.ts'
import { resumableBrowserSocket } from '../utils/ws/browserReconnect.ts'
import { browserLeaseHeartbeat } from '../utils/ws/browserLease.ts'
import fp from 'fastify-plugin'
import { proxyModelSocket } from '../utils/ws/proxyModelSocket.ts'
import { browserStartOptions } from '../utils/ws/browserAccess.ts'
import { BrowserWarmPool, BROWSER_WARM_MAX_AGE_MS, type WarmWorker, type WarmStatus } from '../utils/ws/browserWarmPool.ts'
import registerSupportStream from '../handlers/supportStream.ts'
import registerSystemStream from '../handlers/metrics/systemStream.ts'
import registerVmConsole from '../handlers/vms/console.ts'
import { subscribeThesis } from '#utils/thesis.ts'
import WebSocket from 'ws'
import type { RawData } from 'ws'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { FastifyReply } from 'fastify'
import { createHmac, randomUUID } from 'node:crypto'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { registerClient } from '#utils/ws/registerClient.ts'
import { removeClient } from '#utils/ws/removeClient.ts'
import { countGptViewers, gpt, handleGptMessage, sendGptSnapshot, unregisterGptSocket } from '#utils/ws/handleGptMessage.ts'
import recordLog from '#utils/logs/recordLog.ts'
import run from '#db'
import { currentBrowserAdmissionStatus, handleOnionSessionSocket, registerPrestartedBrowser, requestBrowserAdmission } from '../handlers/onionSession/ws.ts'
import { browserPaidExtensionAllowed, finishBrowserRun, prepareBrowserRun, refreshBrowserRunLease, updateBrowserRunProviderResult, type BrowserProviderRunResult } from '../handlers/browserSandboxRuns.ts'
import { createRuntimeContainer, getRuntimeContainer, getRuntimeContainerLogs, listRuntimeContainers, renameRuntimeContainer, removeRuntimeContainer, startRuntimeContainer } from '#utils/docker/engine.ts'

const browserWorkerSeccompProfile = fs.readFileSync(new URL('../../seccomp-chromium.json', import.meta.url), 'utf8')

type PendingUpdates = {
    content: string
    timer: NodeJS.Timeout
    userId?: string | null
}

const browserRunWarningLogTimes = new Map<string, number>()
const browserRunFailureLogTimes = new Map<string, number>()
const browserRunUnreachableLogTimes = new Map<string, number>()
const browserRunLogContexts = new Map<string, BrowserRunLogContext>()
const browserStreams = new Map<string, BrowserStream>()

type BrowserStream = {
    token: string
    ip: string
    containerId: string
    expiresAt: number
}

type BrowserRunLogContext = {
    target?: string
    network?: string
    runStatus?: string
    lastUrl?: string
    framesDelivered?: number
}

export const testClients = new Map<string, Set<WebSocket>>()
export const shareClients = new Map<string, Set<WebSocket>>()
export const pendingUpdates = new Map<string, PendingUpdates>()

export default fp(async function wsPlugin(fastify: FastifyInstance) {
    if (process.env.BROWSER_SANDBOX_WORKER_ONLY === '1') {
        registerBrowserSessionRoutes(fastify)
        return
    }

    registerVmConsole(fastify)
    registerSystemStream(fastify)
    registerSupportStream(fastify)

    fastify.get('/api/ws/thesis', { websocket: true }, socket => subscribeThesis(socket))
    registerBrowserStreamRoute(fastify)
    if (process.env.NODE_ENV === 'production' && process.env.BROWSER_SANDBOX_EGRESS_FIREWALL_READY === '1') {
        const maintain = () => {
            void browserWarmPool.replenish()
            // Reap abandoned claims after the longest possible run and idle wait.
            void listRuntimeContainers().then(containers => Promise.all(containers
                .filter(container => container.name.startsWith('hanasand_browser_warm_used_') && Date.now() - Date.parse(container.created_at) > BROWSER_WARM_MAX_AGE_MS)
                .map(container => removeRuntimeContainer(container.id))))
                .catch(error => fastify.log.error(error, 'Browser pool cleanup failed'))
        }
        let timer: ReturnType<typeof setInterval>
        fastify.addHook('onReady', async () => { maintain(); timer = setInterval(maintain, 5000); timer.unref() })
        fastify.addHook('onClose', async () => { clearInterval(timer) })
    }

    // test
    fastify.get('/api/ws/test/:id', { websocket: true }, (connection, req: FastifyRequest) => {
        const id = (req.params as { id: string}).id
        registerClient(id, connection, testClients)

        void import('../handlers/test/follow.ts').then(({ startLoadTestQueue }) => startLoadTestQueue())

        connection.on('message', (msg) => {
            try {
                const parsed = JSON.parse(msg.toString()) as { type?: string }
                if (parsed.type === 'rerun') {
                    void import('../handlers/test/follow.ts').then(({ enqueueLoadTestRun }) => enqueueLoadTestRun(id, true))
                }
            } catch (error) {
                void recordWebsocketFailure('test-message', id, error)
            }
        })

        connection.on('error', (error) => {
            void recordWebsocketFailure('test-client', id, error)
        })

        connection.on('close', () => {
            removeClient(id, connection, testClients)
        })
    })

    // share editor collaboration
    fastify.get<{ Params: { id: string } }>('/api/ws/share/:id', { websocket: true }, (connection, req) => {
        const id = req.params.id

        registerClient(id, connection, shareClients)

        connection.on('message', (message) => {
            void import('#utils/ws/handleMessage.ts').then(({ handleMessage }) => handleMessage(id, connection, message, shareClients))
        })

        connection.on('error', (error) => {
            void recordWebsocketFailure('share-client', id, error)
        })

        connection.on('close', () => {
            removeClient(id, connection, shareClients)
        })
    })

    // share terminal
    fastify.get<{
        Params: { alias: string, user: string, session: string }
    }>('/api/ws/share/:alias/shell/:user/:session', { websocket: true }, (connection, req) => {
        const { alias, user, session } = req.params
        const terminal = createShareTerminal(alias)

        sendTerminalUpdate(connection, `Connected to ${terminal.label}\r\n${terminal.prompt}`)
        connection.send(JSON.stringify({
            type: 'terminal_credentials',
            credentials: {
                username: user || 'browser',
                password: '',
                sshCommand: `browser terminal ${terminal.label}`,
                domain: 'hanasand.local',
            },
        }))

        connection.on('message', (message) => {
            void handleShareTerminalMessage(connection, terminal, message).catch((error) => {
                sendTerminalUpdate(connection, `\r\n${error instanceof Error ? error.message : String(error)}\r\n${terminal.prompt}`)
                void recordWebsocketFailure('share-terminal-message', `${alias}:${session}`, error)
            })
        })

        connection.on('error', (error) => {
            void recordWebsocketFailure('share-terminal-client', `${alias}:${session}`, error)
        })
    })

    // gpt
    fastify.get<{ Params: { id: string } }>('/api/client/ws/:id', { websocket: true }, (connection: WebSocket, req: FastifyRequest<{ Params: { id: string } }>) => {
        const id = (req.params as { id: string}).id

        if (proxyModelSocket(connection, id, Boolean(req.headers['x-ai-models-forwarded']))) return
        registerClient(id, connection, gpt, countGptViewers)
        sendGptSnapshot(id, connection)
        connection.on('message', (message) => {
            handleGptMessage(id, connection, message)
        })

        connection.on('close', () => {
            unregisterGptSocket(id, connection)
            removeClient(id, connection, gpt)
        })

        connection.on('error', (error) => {
            void recordWebsocketFailure('gpt-client', id, error)
        })
    })

    registerBrowserSessionRoutes(fastify)
})

function registerBrowserSessionRoutes(fastify: FastifyInstance) {
    registerPrestartedBrowser(fastify)
    fastify.get<{ Params: { id: string } }>('/api/ws/browser/:id', { websocket: true }, (connection: WebSocket, req: FastifyRequest<{ Params: { id: string } }>) => {
        if (proxyBrowserSocket(connection, req.params.id, 'browser')) return
        const worker = process.env.BROWSER_SANDBOX_WORKER_ONLY === '1' ? resumableBrowserSocket(connection, req.params.id) : connection
        if (!worker) return
        handleOnionSessionSocket(worker, req.params.id, 'regular')
    })

    fastify.get<{ Params: { id: string } }>('/api/ws/onion-session/:id', { websocket: true }, (connection: WebSocket, req: FastifyRequest<{ Params: { id: string } }>) => {
        if (proxyBrowserSocket(connection, req.params.id, 'onion-session')) return
        const worker = process.env.BROWSER_SANDBOX_WORKER_ONLY === '1' ? resumableBrowserSocket(connection, req.params.id) : connection
        if (!worker) return
        handleOnionSessionSocket(worker, req.params.id)
    })

    fastify.get<{ Params: { id: string } }>('/api/ws/browser-sandbox/:id', { websocket: true }, (connection: WebSocket, req: FastifyRequest<{ Params: { id: string } }>) => {
        if (proxyBrowserSocket(connection, req.params.id, 'browser-sandbox')) return
        const worker = process.env.BROWSER_SANDBOX_WORKER_ONLY === '1' ? resumableBrowserSocket(connection, req.params.id) : connection
        if (!worker) return
        handleOnionSessionSocket(worker, req.params.id, 'regular')
    })
}

function registerBrowserStreamRoute(fastify: FastifyInstance) {
    fastify.route<{
        Params: { id: string, token: string, '*': string }
    }>({
        method: 'GET',
        url: '/api/browser-stream/:id/:token/*',
        handler: (req, reply) => proxyBrowserStreamHttp(req, reply),
        wsHandler: (connection, req) => proxyBrowserStreamWebSocket(connection, req),
    })
}

function browserStreamFor(id: string, token: string) {
    const stream = browserStreams.get(id)
    if (!stream || stream.token !== token || stream.expiresAt <= Date.now()) return null
    return stream
}

function browserStreamUpstreamPath(req: FastifyRequest<{ Params: { '*': string } }>) {
    const query = req.raw.url?.split('?')[1]
    return `/${req.params['*'] || ''}${query ? `?${query}` : ''}`
}

function proxyBrowserStreamHttp(
    req: FastifyRequest<{ Params: { id: string, token: string, '*': string } }>,
    reply: FastifyReply,
) {
    const stream = browserStreamFor(req.params.id, req.params.token)
    if (!stream) return reply.code(404).send({ error: 'Browser stream is unavailable.' })

    reply.hijack()
    const upstream = http.request({
        hostname: stream.ip,
        port: 8080,
        method: 'GET',
        path: browserStreamUpstreamPath(req),
        headers: { accept: req.headers.accept || '*/*', 'user-agent': req.headers['user-agent'] || 'hanasand-browser-stream' },
    }, response => {
        reply.raw.writeHead(response.statusCode || 502, response.headers)
        response.pipe(reply.raw)
    })
    upstream.setTimeout(10_000, () => upstream.destroy(new Error('Browser stream proxy timed out.')))
    upstream.on('error', error => {
        if (!reply.raw.headersSent) reply.raw.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
        reply.raw.end(`Browser stream unavailable: ${error.message}`)
    })
    req.raw.on('aborted', () => upstream.destroy())
    upstream.end()
}

function proxyBrowserStreamWebSocket(
    connection: WebSocket,
    req: FastifyRequest<{ Params: { id: string, token: string, '*': string } }>,
) {
    const stream = browserStreamFor(req.params.id, req.params.token)
    if (!stream) {
        connection.close(1008, 'Browser stream is unavailable.')
        return
    }

    const upstream = new WebSocket(`ws://${stream.ip}:8080${browserStreamUpstreamPath(req)}`)
    const pending: string[] = []
    let closed = false
    const keepAliveTimer = setInterval(() => {
        if (connection.readyState === WebSocket.OPEN) connection.ping()
        if (upstream.readyState === WebSocket.OPEN) upstream.ping()
    }, 20_000)
    keepAliveTimer.unref()
    const closeBoth = () => {
        if (closed) return
        closed = true
        clearInterval(keepAliveTimer)
        if (connection.readyState === WebSocket.OPEN) connection.close()
        if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close()
    }
    upstream.on('open', () => {
        while (pending.length && upstream.readyState === WebSocket.OPEN) upstream.send(pending.shift()!)
    })
    upstream.on('message', message => {
        if (connection.readyState === WebSocket.OPEN) connection.send(socketMessageText(message))
    })
    connection.on('message', message => {
        const text = socketMessageText(message)
        if (upstream.readyState === WebSocket.OPEN) upstream.send(text)
        else pending.push(text)
    })
    connection.on('close', (code, reason) => {
        if (code === 1006) void logBrowserStreamClosure(req.params.id, code, reason)
        closeBoth()
    })
    upstream.on('close', closeBoth)
    connection.on('error', error => {
        void recordWebsocketFailure('browser-stream-client', req.params.id, error)
        closeBoth()
    })
    upstream.on('error', error => {
        void recordWebsocketFailure('browser-stream-upstream', req.params.id, error)
        closeBoth()
    })
}

function proxyBrowserSocket(connection: WebSocket, id: string, route: 'browser' | 'browser-sandbox' | 'onion-session') {
    if (process.env.BROWSER_SANDBOX_WORKER_ONLY === '1') return false
    if (process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER !== 'unsafe-dev-only') {
        void recordLog({
            level: 'info',
            message: `Starting isolated browser worker for ${route} session ${id}`,
            metadata: { category: 'browser_sandbox_worker', route, sessionId: id },
        }).catch(() => {})
        const resumed = resumableBrowserSocket(connection, `${route}:${id}`)
        if (resumed) proxyEphemeralBrowserSocket(resumed, id, route)
        return true
    }
    const base = process.env.BROWSER_SANDBOX_WORKER_WS
    if (!base) {
        const message = 'Shared browser worker is disabled; isolated per-session workers are required in production.'
        if (connection.readyState === WebSocket.OPEN) {
            sendErrorThenClose(connection, message)
        }
        void recordLog({
            level: 'error',
            message,
            metadata: { category: 'browser_sandbox_worker', route, sessionId: id },
        }).catch(() => {})
        return true
    }

    const upstream = new WebSocket(`${base.replace(/\/$/, '')}/${route}/${encodeURIComponent(id)}`)
    const pending: RawData[] = []
    let closed = false

    upstream.on('open', () => {
        while (pending.length && upstream.readyState === WebSocket.OPEN) upstream.send(pending.shift()!)
    })
    upstream.on('message', message => {
        if (connection.readyState === WebSocket.OPEN) connection.send(socketMessageText(message))
    })
    connection.on('message', message => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(message)
        else pending.push(message)
    })
    const closeBoth = () => {
        if (closed) return
        closed = true
        if (connection.readyState === WebSocket.OPEN) connection.close()
        if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close()
    }
    connection.on('close', closeBoth)
    upstream.on('close', closeBoth)
    connection.on('error', error => void recordWebsocketFailure(`browser-proxy-client-${route}`, id, error))
    upstream.on('error', error => {
        void recordWebsocketFailure(`browser-proxy-upstream-${route}`, id, error)
        closeBoth()
    })

    return true
}

function proxyEphemeralBrowserSocket(connection: WebSocket, id: string, route: 'browser' | 'browser-sandbox' | 'onion-session') {
    const startup = new AbortController()
    const pending: RawData[] = []
    let upstream: WebSocket | null = null
    let containerId = ''
    let closed = false
    let runPrepared = false
    let leaseTimer: NodeJS.Timeout | null = null
    let messages = Promise.resolve()
    let sawReady = false
    let deliveredFrame = false
    let sawTerminalMessage = false
    let streamMetricsTimer: NodeJS.Timeout | null = null
    let releaseAdmission: (() => void) | null = null
    let resolveStreamResolution: (options: { resolution: string; regular: boolean }) => void = () => undefined
    const streamResolution = new Promise<{ resolution: string; regular: boolean }>(resolve => { resolveStreamResolution = resolve })
    const workerResumeToken = randomUUID()
    const streamToken = randomUUID().replaceAll('-', '')
    const admission = requestBrowserAdmission(id, payload => {
        if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify(payload))
    })

    const closeBoth = () => {
        if (closed) return
        closed = true
        startup.abort()
        if (connection.readyState === WebSocket.OPEN) connection.close()
        if (upstream && (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING)) upstream.close()
        if (streamMetricsTimer) clearInterval(streamMetricsTimer)
        if (leaseTimer) clearInterval(leaseTimer)
        admission.cancel()
        releaseAdmission?.()
        releaseAdmission = null
        browserStreams.delete(id)
        if (containerId) void (!sawReady || !deliveredFrame ? recordBrowserWorkerLogs(containerId, route, id) : Promise.resolve())
            .finally(() => removeRuntimeContainer(containerId))
            .catch(error => recordWebsocketFailure(`browser-session-remove-${route}`, id, error))
    }

    const forwardMessage = async (message: RawData) => {
        let payload = parseSocketMessage(message)
        if (!payload || closed) return
        if (!runPrepared) {
            if (payload.type !== 'start') return
            const start = await prepareProxiedBrowserRun(id, message, connection)
            if (!start) { closeBoth(); return }
            if (closed) { await finishBrowserRun(id, 'ended'); return }
            payload = start
            runPrepared = true
            leaseTimer = setInterval(browserLeaseHeartbeat(() => refreshBrowserRunLease(id), () => {
                if (connection.readyState === WebSocket.OPEN) sendErrorThenClose(connection, 'Browser session tracking is unavailable. Please try again.')
                closeBoth()
            }), 30_000)
            leaseTimer.unref()
            resolveStreamResolution({ resolution: browserStreamResolution(payload), regular: payload.network !== 'tor' && route !== 'onion-session' })
        } else if (payload.type === 'start') return
        // Authorization flags are supplied by this authenticated broker only.
        payload = { ...payload, paidAuthorized: false, ...(payload.type === 'start' ? { resumeToken: workerResumeToken } : {}) }
        if (payload.type === 'extend' && payload.extension === 'paid') {
            const allowed = await browserPaidExtensionAllowed(id)
            if (!allowed) {
                if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({
                    type: 'status', state: 'payment_required',
                    message: 'Upgrade Browser for another five minutes.',
                }))
                return
            }
            payload.paidAuthorized = true
        }
        const forwarded = Buffer.from(JSON.stringify(payload))
        if (upstream?.readyState === WebSocket.OPEN) upstream.send(forwarded)
        else pending.push(forwarded)
    }
    connection.on('message', message => {
        messages = messages.then(() => forwardMessage(message)).catch(error => {
            void recordWebsocketFailure(`browser-session-prepare-${route}`, id, error)
            if (connection.readyState === WebSocket.OPEN) sendErrorThenClose(connection, 'Unable to start or update this browser session. Please try again.')
            closeBoth()
        })
    })
    connection.on('close', (code, reason) => {
        if (runPrepared && !sawTerminalMessage) {
            void logBrowserClientClosure(id, code, reason, sawReady, deliveredFrame)
            void finishBrowserRun(id, 'ended')
        }
        closeBoth()
    })
    connection.on('error', error => {
        void recordWebsocketFailure(`browser-session-client-${route}`, id, error)
        closeBoth()
    })

    void Promise.all([admission.promise, streamResolution]).then(async ([slot, options]) => {
        if (closed) {
            slot.release()
            return null
        }
        releaseAdmission = slot.release
        if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({
            type: 'status',
            state: 'capacity_admitted',
            capacity: slot.status,
            message: 'Sandbox capacity is available. Starting this browser.',
        }))
        assertBrowserWorkerEgress()
        const warm = options.regular ? await browserWarmPool.take(id).catch(error => {
            console.error('Browser pool claim failed; starting a fresh worker:', error instanceof Error ? error.message : String(error))
            return null
        }) : null
        if (warm) {
            sendStatus(connection, 'worker_prestarted', 'Reserved a ready browser.')
            return warm
        }
        sendStatus(connection, 'launching_worker', 'Starting isolated browser worker.')
        return startEphemeralBrowserWorker(id, options.resolution)
    })
        .then(worker => {
            if (!worker) return
            const { containerId: nextContainerId, wsUrl, streamIp } = worker
            if (closed) {
                void removeRuntimeContainer(nextContainerId).catch(() => undefined)
                return
            }
            containerId = nextContainerId
            browserStreams.set(id, { token: streamToken, ip: streamIp, containerId, expiresAt: Date.now() + 65 * 60_000 })
            void announceBrowserStream(connection, id, streamToken, streamIp).then(timer => {
                if (closed && timer) clearInterval(timer)
                else streamMetricsTimer = timer
            })
            return connectResumableWorker(`${wsUrl.replace(/\/$/, '')}/${route}/${encodeURIComponent(id)}`, startup.signal, workerResumeToken)
        })
        .then(nextUpstream => {
            if (!nextUpstream) return
            if (closed) {
                nextUpstream.close()
                return
            }
            upstream = nextUpstream
            sendStatus(connection, 'worker_connected', 'Isolated browser worker connected.')
            upstream.on('open', () => {
                while (pending.length && upstream?.readyState === WebSocket.OPEN) upstream.send(pending.shift()!)
            })
            while (pending.length && upstream.readyState === WebSocket.OPEN) upstream.send(pending.shift()!)
            upstream.on('message', message => {
                const payload = parseSocketMessage(message)
                if (payload?.type === 'ready') sawReady = true
                if (payload?.type === 'frame') deliveredFrame = true
                if (payload?.type === 'ended') {
                    sawTerminalMessage = true
                    if (leaseTimer) clearInterval(leaseTimer)
                }
                void persistBrowserProviderResult(id, message)
                void finishProxiedBrowserRun(id, message)
                if (connection.readyState === WebSocket.OPEN) connection.send(payload?.capacity
                    ? JSON.stringify({ ...payload, capacity: currentBrowserAdmissionStatus() })
                    : socketMessageText(message))
            })
            upstream.on('close', (code, reason) => {
                if (connection.readyState === WebSocket.OPEN) {
                    if (!sawReady || !deliveredFrame) void recordBrowserWorkerLogs(containerId, route, id)
                    void logBrowserRunClosure(id, sawReady, deliveredFrame, sawTerminalMessage, code, reason)
                    if (sawReady) {
                        void finishBrowserRun(id, 'ended')
                        connection.close()
                    } else {
                        void logBrowserRunFailure(id, 'worker_closed_before_ready', closeMessage(code, reason))
                        void finishBrowserRun(id, 'failed')
                        sendErrorThenClose(connection, 'Isolated browser worker closed before completing the run.')
                    }
                }
                else closeBoth()
            })
            upstream.on('error', error => {
                void recordWebsocketFailure(`browser-session-upstream-${route}`, id, error)
                void logBrowserRunFailure(id, 'worker_connection_error', error instanceof Error ? error.message : String(error))
                void finishBrowserRun(id, 'failed')
                if (connection.readyState === WebSocket.OPEN) sendErrorThenClose(connection, `Isolated browser worker connection failed: ${error instanceof Error ? error.message : String(error)}`)
                else closeBoth()
            })
        })
        .catch(error => {
            const message = error instanceof Error ? error.message : String(error)
            if (connection.readyState === WebSocket.OPEN) {
                sendErrorThenClose(connection, `Failed to start isolated browser worker: ${message}`)
            } else {
                closeBoth()
            }
            void recordWebsocketFailure(`browser-session-create-${route}`, id, error)
            void logBrowserRunFailure(id, 'worker_start_failed', message)
            if (runPrepared) void finishBrowserRun(id, 'failed')
        })
}

async function prepareProxiedBrowserRun(id: string, message: RawData, connection: WebSocket) {
    const payload = parseSocketMessage(message)
    if (payload?.type !== 'start') return null
    const target = typeof payload.target === 'string' ? payload.target : ''
    const network = payload.network === 'tor' ? 'tor' : 'regular'
    rememberBrowserRunLogContext(id, { target, network })
    const result = await prepareBrowserRun({
        id,
        target,
        network,
        clientId: typeof payload.clientId === 'string' ? payload.clientId : undefined,
        userId: typeof payload.userId === 'string' ? payload.userId : undefined,
        sessionToken: typeof payload.sessionToken === 'string' ? payload.sessionToken : undefined,
    })
    if (result.allowed) {
        if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ type: 'status', state: 'access_ready', quota: result.quota }))
        return browserStartOptions(payload, result.quota)
    }
    if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify({
            type: 'status',
            state: result.reason,
            sessionId: id,
            network,
            quota: result.quota,
            message: result.reason === 'concurrency_limit' ? `You already have ${result.quota?.concurrentLimit} active browser${result.quota?.concurrentLimit === 1 ? '' : 's'}. Close a run${result.quota?.paid ? '' : ' or upgrade for three at once'}.` : 'Reload the browser page to start a new session.',
        }))
        connection.send(JSON.stringify({ type: 'ended', reason: result.reason, sessionId: id }))
        connection.close()
    }
    return null
}

function persistBrowserProviderResult(id: string, message: RawData) {
    const payload = parseSocketMessage(message)
    if (payload?.type !== 'tool_capture') return
    const result = providerRunResultValue(payload.toolAnalysis, String(payload.error || ''))
    if (!result) return
    void updateBrowserRunProviderResult(id, String(payload.toolAnalysis.toolKind), result).catch(() => undefined)
}

async function finishProxiedBrowserRun(id: string, message: RawData) {
    const payload = parseSocketMessage(message)
    rememberBrowserRunPayload(id, payload)
    if (payload?.type === 'status') {
        if (payload.state === 'frame_capture_failed') {
            await logBrowserRunWarning(id, 'frame_capture_failed', payload.message || payload.reason)
            return
        }
        const failureStates = new Set(['failed', 'unsafe_target_blocked', 'quota_exhausted'])
        if (failureStates.has(String(payload.state))) {
            await logBrowserRunFailure(id, `status_${String(payload.state)}`, payload.message || payload.url || payload.reason)
            if (payload.state === 'failed' || payload.state === 'unsafe_target_blocked' || payload.state === 'quota_exhausted') await finishBrowserRun(id, 'failed')
            return
        }
    }
    if (payload?.type === 'navigation_error') {
        await finishBrowserRun(id, 'unreachable')
        await logBrowserRunUnreachable(id, 'navigation_error', payload.message || payload.target)
        return
    }
    if (payload?.type === 'ended') {
        const failed = payload.reason === 'launch_failed' || payload.reason === 'quota_exhausted'
        if (failed) await logBrowserRunFailure(id, String(payload.reason), payload.message)
        await finishBrowserRun(id, failed ? 'failed' : 'ended')
    }
    if (payload?.type === 'error') {
        await logBrowserRunFailure(id, 'error', payload.message)
        await finishBrowserRun(id, 'failed')
    }
}

function parseSocketMessage(message: RawData): any {
    const text = socketMessageText(message)
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

function socketMessageText(message: RawData) {
    if (Buffer.isBuffer(message)) return message.toString('utf8')
    if (message instanceof ArrayBuffer) return Buffer.from(message).toString('utf8')
    if (Array.isArray(message)) return Buffer.concat(message).toString('utf8')
    return String(message)
}

async function logBrowserRunWarning(id: string, reason: string, message: unknown) {
    const key = `${id}:${reason}`
    const now = Date.now()
    const last = browserRunWarningLogTimes.get(key) || 0
    if (now - last < 60_000) return
    browserRunWarningLogTimes.set(key, now)
    if (browserRunWarningLogTimes.size > 1000) {
        const oldestKey = browserRunWarningLogTimes.keys().next().value
        if (oldestKey) browserRunWarningLogTimes.delete(oldestKey)
    }
    const text = typeof message === 'string' && message ? message : reason
    const context = await browserRunLogContext(id)
    console.warn(JSON.stringify({ level: 'warn', category: 'browser_run_warning', sessionId: id, reason, message: text, ...context }))
    await recordLog({
        level: 'warn',
        message: `Browser run warning for ${context.target || id}: ${text}`,
        metadata: {
            category: 'browser_run_warning',
            sessionId: id,
            reason,
            workerMessage: typeof message === 'string' ? message : '',
            ...context,
        },
    }).catch(() => undefined)
}

async function logBrowserRunFailure(id: string, reason: string, message: unknown) {
    const text = typeof message === 'string' && message ? message : reason
    const key = `${id}:${text}`
    const now = Date.now()
    const last = browserRunFailureLogTimes.get(key) || 0
    if (now - last < 60_000) return
    browserRunFailureLogTimes.set(key, now)
    trimBrowserLogMap(browserRunFailureLogTimes)
    const context = await browserRunLogContext(id)
    console.warn(JSON.stringify({ level: 'warn', category: 'browser_run_failed', sessionId: id, reason, message: text, ...context }))
    await recordLog({
        level: 'warn',
        message: `Browser run failed for ${context.target || id}: ${text}`,
        metadata: {
            category: 'browser_run_failed',
            sessionId: id,
            reason,
            workerMessage: typeof message === 'string' ? message : '',
            ...context,
        },
    }).catch(() => undefined)
}

async function logBrowserRunUnreachable(id: string, reason: string, message: unknown) {
    const text = typeof message === 'string' && message ? message : reason
    const key = `${id}:${text}`
    const now = Date.now()
    const last = browserRunUnreachableLogTimes.get(key) || 0
    if (now - last < 60_000) return
    browserRunUnreachableLogTimes.set(key, now)
    trimBrowserLogMap(browserRunUnreachableLogTimes)
    const context = await browserRunLogContext(id)
    const unreachableContext = { ...context, runStatus: 'unreachable' }
    console.info(JSON.stringify({ level: 'info', category: 'browser_run_unreachable', sessionId: id, reason, message: text, ...unreachableContext }))
    await recordLog({
        level: 'info',
        message: `Browser target unreachable for ${unreachableContext.target || id}: ${text}`,
        metadata: {
            category: 'browser_run_unreachable',
            sessionId: id,
            reason,
            workerMessage: typeof message === 'string' ? message : '',
            ...unreachableContext,
        },
    }).catch(() => undefined)
}

async function logBrowserRunClosure(id: string, sawReady: boolean, deliveredFrame: boolean, sawTerminalMessage: boolean, code: number, reason: Buffer) {
    const reasonText = closeMessage(code, reason)
    const context = await browserRunLogContext(id)
    await recordLog({
        level: deliveredFrame ? 'info' : 'warn',
        message: `Browser worker closed for ${context.target || id}${deliveredFrame ? '' : ' before a frame was delivered'}: ${reasonText}.`,
        metadata: {
            category: 'browser_run_closed',
            sessionId: id,
            sawReady,
            deliveredFrame,
            sawTerminalMessage,
            closeCode: code,
            closeReason: reasonText,
            ...context,
        },
    }).catch(() => undefined)
}

async function logBrowserClientClosure(id: string, code: number, reason: Buffer, sawReady: boolean, deliveredFrame: boolean) {
    const reasonText = closeMessage(code, reason)
    const context = await browserRunLogContext(id)
    await recordLog({
        level: 'warn',
        message: `Browser client disconnected before the worker completed ${context.target || id}: ${reasonText}.`,
        metadata: {
            category: 'browser_run_client_closed',
            sessionId: id,
            sawReady,
            deliveredFrame,
            closeCode: code,
            closeReason: reasonText,
            ...context,
        },
    }).catch(() => undefined)
}

async function logBrowserStreamClosure(id: string, code: number, reason: Buffer) {
    const reasonText = closeMessage(code, reason)
    const context = await browserRunLogContext(id)
    await recordLog({
        level: 'warn',
        message: `Browser WebRTC signalling disconnected unexpectedly for ${context.target || id}: ${reasonText}.`,
        metadata: {
            category: 'browser_stream_disconnected',
            sessionId: id,
            closeCode: code,
            closeReason: reasonText,
            ...context,
        },
    }).catch(() => undefined)
}

function closeMessage(code: number, reason: Buffer) {
    const text = reason.toString('utf8')
    return text ? `${code} ${text}` : String(code)
}

function providerRunResultValue(analysis: any, error = ''): BrowserProviderRunResult | null {
    if (analysis?.toolKind === 'virustotal') {
        const total = Number(analysis.vendorTotal)
        if (!Number.isFinite(total) || total <= 0) return null
        const flagged = Number.isFinite(Number(analysis.vendorFlagged)) ? Number(analysis.vendorFlagged) : 0
        return { status: flagged > 0 ? 'suspicious' : error ? 'blocked' : 'clean', label: `${flagged}/${total} VT` }
    }
    if (analysis?.toolKind === 'urlquery') {
        const alerts = Number(analysis.alertCount)
        if (!Number.isFinite(alerts)) return null
        return { status: alerts > 0 ? 'suspicious' : error ? 'blocked' : 'clean', label: alerts > 0 ? `${alerts}` : 'urlquery' }
    }
    return null
}

async function recordBrowserWorkerLogs(containerId: string, route: string, id: string) {
    const logs = await getRuntimeContainerLogs(containerId).catch(error => `Could not read browser worker logs: ${error instanceof Error ? error.message : String(error)}`)
    if (!logs) return
    const context = await browserRunLogContext(id)
    const tail = logs.slice(-4000)
    await recordLog({
        level: 'warn',
        message: `Browser worker emitted logs before ${route} session ${context.target || id} closed.`,
        metadata: {
            category: 'browser_sandbox_worker',
            route,
            sessionId: id,
            containerId,
            logTail: tail,
            ...context,
        },
    }).catch(() => {})
}

async function browserRunLogContext(id: string) {
    if (!id) return {}
    const result = await run('SELECT target, network, status FROM browser_runs WHERE id = $1 LIMIT 1', [id]).catch(() => null)
    const row = result?.rows?.[0]
    const cached = browserRunLogContexts.get(id) || {}
    return {
        ...cached,
        ...(row ? { target: row.target || cached.target || '', network: row.network || cached.network || '', runStatus: row.status || cached.runStatus || '' } : {}),
    }
}

function rememberBrowserRunPayload(id: string, payload: any) {
    if (!payload || typeof payload !== 'object') return
    if (payload.type === 'frame') {
        const current = browserRunLogContexts.get(id)
        rememberBrowserRunLogContext(id, {
            lastUrl: typeof payload.url === 'string' ? payload.url : current?.lastUrl,
            framesDelivered: (current?.framesDelivered || 0) + 1,
        })
        return
    }
    if (typeof payload.url === 'string') rememberBrowserRunLogContext(id, { lastUrl: payload.url })
    if (typeof payload.target === 'string') rememberBrowserRunLogContext(id, { target: payload.target })
}

function rememberBrowserRunLogContext(id: string, context: BrowserRunLogContext) {
    if (!id) return
    const current = browserRunLogContexts.get(id) || {}
    browserRunLogContexts.set(id, { ...current, ...context })
    trimBrowserLogMap(browserRunLogContexts)
}

function trimBrowserLogMap(map: Map<string, unknown>) {
    while (map.size > 1000) {
        const oldestKey = map.keys().next().value
        if (!oldestKey) return
        map.delete(oldestKey)
    }
}

function sendStatus(connection: WebSocket, state: string, message: string) {
    if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ type: 'status', state, message }))
}

function sendErrorThenClose(connection: WebSocket, message: string) {
    connection.send(JSON.stringify({ type: 'error', message }), () => {
        if (connection.readyState === WebSocket.OPEN) connection.close()
    })
}

function browserTurnCredentials(sessionId: string, lifetimeSeconds = 60 * 60) {
    const secret = process.env.BROWSER_SANDBOX_TURN_SECRET || ''
    const host = process.env.BROWSER_SANDBOX_TURN_HOST || ''
    if (process.env.NODE_ENV === 'production' && (!secret || secret === 'unsafe-dev-turn-secret' || !host)) {
        throw new Error('Production WebRTC browser streams require BROWSER_SANDBOX_TURN_SECRET and BROWSER_SANDBOX_TURN_HOST.')
    }
    const username = `${Math.floor(Date.now() / 1000) + lifetimeSeconds}:${sessionId}`
    return {
        host: host || '127.0.0.1',
        username,
        password: createHmac('sha1', secret || 'unsafe-dev-turn-secret').update(username).digest('base64'),
    }
}

async function announceBrowserStream(connection: WebSocket, id: string, token: string, ip: string) {
    const ready = await waitForBrowserStream(ip)
    if (!ready) {
        sendStatus(connection, 'stream_unavailable', 'The browser started, but its WebRTC transport did not become ready.')
        return null
    }
    if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify({
            type: 'stream_ready',
            transport: 'webrtc',
            targetFps: 30,
            streamUrl: `/api/browser-stream/${encodeURIComponent(id)}/${token}/index.html`,
        }))
    }
    const sendMetrics = () => void browserStreamMetrics(ip).then(metrics => {
        if (metrics && connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ type: 'stream_metrics', ...metrics }))
    })
    sendMetrics()
    const timer = setInterval(sendMetrics, 1_000)
    timer.unref()
    return timer
}

async function waitForBrowserStream(ip: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        const ready = await fetch(`http://${ip}:8080/health`, { signal: AbortSignal.timeout(750) })
            .then(response => response.ok)
            .catch(() => false)
        if (ready) return true
        await new Promise(resolve => setTimeout(resolve, 250))
    }
    return false
}

async function browserStreamMetrics(ip: string) {
    const body = await fetch(`http://${ip}:9081/metrics`, { signal: AbortSignal.timeout(750) })
        .then(response => response.ok ? response.text() : '')
        .catch(() => '')
    if (!body) return null
    const fps = Number(body.match(/^fps ([\d.]+)$/m)?.[1])
    const latencyMs = Number(body.match(/^latency ([\d.]+)$/m)?.[1])
    if (!Number.isFinite(fps) && !Number.isFinite(latencyMs)) return null
    return {
        fps: Number.isFinite(fps) ? fps : undefined,
        latencyMs: Number.isFinite(latencyMs) ? latencyMs : undefined,
        sampledAt: new Date().toISOString(),
    }
}

function browserStreamResolution(payload: { width?: unknown; height?: unknown }) {
    const width = Math.max(320, Math.min(2400, Math.round(Number(payload.width) || 1280)))
    const height = Math.max(320, Math.min(2160, Math.round(Number(payload.height) || width * 9 / 16)))
    return `${width}x${height}`
}

const browserWarmPool = new BrowserWarmPool({
    async inspect(slot) {
        const inspect = await getRuntimeContainer(`hanasand_browser_warm_${slot}`).catch(error => {
            if (String(error).includes('No such container')) return null
            throw error
        })
        if (!inspect?.Id) return null
        const ip = inspect.NetworkSettings?.Networks?.[process.env.BROWSER_SANDBOX_WORKER_NETWORK || 'hanasand_browsernet']?.IPAddress
        const token = inspect.Config?.Env?.find(value => value.startsWith('BROWSER_SANDBOX_POOL_TOKEN='))?.split('=')[1] || ''
        return { containerId: inspect.Id, wsUrl: `ws://${ip}:8090/api/ws`, streamIp: ip || '', token, createdAt: Date.parse(inspect.Created || ''), running: inspect.State?.Running }
    },
    async create(slot) {
        try { await startEphemeralBrowserWorker(`warm-${slot}`, '1280x720', slot) }
        catch (error) {
            // Another API replica may have filled the same empty slot first.
            if (!String(error).includes('already in use')) throw error
        }
    },
    async status(worker) {
        if (!worker.streamIp || !worker.token) return null
        const response = await warmWorkerRequest(worker).catch(() => null)
        if (!response?.ok) return null
        const status = await response.json() as WarmStatus
        if (status.state === 'ready' && !await fetch(`http://${worker.streamIp}:8080/health`, { signal: AbortSignal.timeout(1000) }).then(r => r.ok).catch(() => false)) return null
        return status
    },
    async claim(worker, sessionId) {
        const response = await warmWorkerRequest(worker, { sessionId })
        if (response.status === 409) return false
        if (!response.ok) throw new Error(`Browser claim failed: ${response.status}`)
        return true
    },
    async detach(worker) { await renameRuntimeContainer(worker.containerId, `hanasand_browser_warm_used_${worker.containerId.slice(0, 24)}`) },
    async retire(worker) { return (await warmWorkerRequest(worker, { retire: true })).ok },
    async remove(worker) { await removeRuntimeContainer(worker.containerId).catch(error => { if (!String(error).includes('No such container')) throw error }) },
    error(error) { console.error('Browser ready pool:', error instanceof Error ? error.message : String(error)) },
})

function warmWorkerRequest(worker: WarmWorker, body?: { sessionId?: string; retire?: boolean }) {
    return fetch(`http://${worker.streamIp}:8090/internal/browser-warm`, {
        method: body ? 'POST' : 'GET',
        headers: { 'x-browser-pool-token': worker.token, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(1500),
    })
}

function assertBrowserWorkerEgress() {
    if (process.env.NODE_ENV === 'production' && process.env.BROWSER_SANDBOX_EGRESS_FIREWALL_READY !== '1') {
        throw new Error('Browser sandbox egress firewall is not marked ready. Run ops/browser-worker/install-egress-firewall.sh before enabling production browser sessions.')
    }
}

async function startEphemeralBrowserWorker(sessionId: string, resolution = '1280x720', warmSlot?: number) {
    assertBrowserWorkerEgress()
    const containerName = warmSlot === undefined ? `hanasand_browser_session_${sessionId.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 48)}_${randomUUID().slice(0, 8)}` : `hanasand_browser_warm_${warmSlot}`
    const networkName = process.env.BROWSER_SANDBOX_WORKER_NETWORK || 'hanasand_browsernet'
    const turn = browserTurnCredentials(sessionId, warmSlot === undefined ? 60 * 60 : 120 * 60)
    const containerId = await createRuntimeContainer(containerName, {
        Image: process.env.BROWSER_SANDBOX_WORKER_IMAGE || 'hanasand_browser_worker',
        User: '1000',
        Env: [
            'NODE_ENV=production',
            'PORT=8090',
            'HOME=/tmp',
            'USER=ubuntu',
            'DISPLAY=:20',
            'START_XFCE4=false',
            `BROWSER_STREAM_RESOLUTION=${resolution}`,
            'BROWSER_SANDBOX_WORKER_ONLY=1',
            'BROWSER_SANDBOX_SKIP_RUN_DB=1',
            'BROWSER_SANDBOX_CHROMIUM_SANDBOX=1',
            'BROWSER_SANDBOX_MAX_SESSIONS=1',
            'BROWSER_SANDBOX_PREWARM=0',
            ...(warmSlot === undefined ? [] : [`BROWSER_SANDBOX_POOL_TOKEN=${randomUUID()}`]),
            'SELKIES_ENABLE_BASIC_AUTH=false',
            'SELKIES_ENABLE_RESIZE=false',
            'SELKIES_ENCODER=x264enc',
            'SELKIES_FRAMERATE=60',
            'SELKIES_KEYFRAME_DISTANCE=1',
            'SELKIES_CONGESTION_CONTROL=true',
            'SELKIES_VIDEO_BITRATE=4000',
            `SELKIES_TURN_HOST=${turn.host}`,
            'SELKIES_TURN_PORT=3478',
            'SELKIES_TURN_PROTOCOL=udp',
            `SELKIES_TURN_USERNAME=${turn.username}`,
            `SELKIES_TURN_PASSWORD=${turn.password}`,
            `ONION_SESSION_PROXY=${process.env.ONION_SESSION_PROXY || 'socks5://hanasand_onion_tor:9050'}`,
        ],
        ExposedPorts: { '8080/tcp': {}, '8090/tcp': {}, '9081/tcp': {} },
        HostConfig: {
            NetworkMode: networkName,
            AutoRemove: true,
            Init: true,
            Privileged: false,
            IpcMode: 'private',
            ReadonlyRootfs: true,
            Tmpfs: {
                '/tmp': 'rw,noexec,nosuid,size=1g',
                '/etc/nginx/sites-available': 'rw,noexec,nosuid,size=1m,uid=1000,gid=1000',
                '/var/lib/nginx': 'rw,noexec,nosuid,size=16m,uid=1000,gid=1000',
            },
            CapAdd: [],
            CapDrop: ['ALL'],
            SecurityOpt: [`seccomp=${browserWorkerSeccompProfile}`, 'apparmor=docker-default', 'no-new-privileges'],
            ShmSize: 1024 * 1024 * 1024,
            Memory: 3 * 1024 * 1024 * 1024,
            NanoCpus: 3_000_000_000,
            PidsLimit: 512,
        },
        Labels: {
            'com.hanasand.role': 'browser-session-worker',
            'com.hanasand.session': sessionId,
        },
    }, warmSlot !== undefined)

    try {
        await startRuntimeContainer(containerId)
        const inspect = await getRuntimeContainer(containerId)
        const ip = inspect.NetworkSettings?.Networks?.[networkName]?.IPAddress
        return { containerId, wsUrl: `ws://${ip || containerName}:8090/api/ws`, streamIp: ip || containerName }
    } catch (error) {
        await removeRuntimeContainer(containerId).catch(() => undefined)
        throw error
    }
}

type ShareTerminal = {
    label: string
    root: string
    prompt: string
}

function createShareTerminal(alias: string): ShareTerminal {
    const safeAlias = alias.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'share'
    const root = path.resolve(process.env.SHARE_TERMINAL_ROOT || process.cwd())

    fs.mkdirSync(root, { recursive: true })

    return {
        label: safeAlias,
        root,
        prompt: `${safeAlias}:~$ `,
    }
}

async function handleShareTerminalMessage(connection: WebSocket, terminal: ShareTerminal, message: RawData) {
    const parsed = parseTerminalMessage(message)

    if (!parsed || parsed.type === 'resize') {
        return
    }

    if (parsed.type !== 'terminalInput') {
        return
    }

    const content = parsed.content.replace(/\r/g, '\n')
    const commands = content.split('\n').map(command => command.trim()).filter(Boolean)

    for (const command of commands) {
        const output = await runShareTerminalCommand(terminal, command)
        sendTerminalUpdate(connection, `${command}\r\n${output}${terminal.prompt}`)
    }
}

function parseTerminalMessage(message: RawData) {
    try {
        const parsed = JSON.parse(message.toString()) as { type?: string, content?: string }

        if (typeof parsed.type !== 'string') {
            return null
        }

        return {
            type: parsed.type,
            content: typeof parsed.content === 'string' ? parsed.content : '',
        }
    } catch {
        return {
            type: 'terminalInput',
            content: message.toString(),
        }
    }
}

async function runShareTerminalCommand(terminal: ShareTerminal, command: string) {
    const [program, ...args] = command.split(/\s+/)

    switch (program) {
        case 'pwd':
            return `${terminal.root}\r\n`
        case 'ls':
            return `${await listShareTerminalDirectory(terminal.root, args)}\r\n`
        case 'clear':
            return '\u001Bc'
        case 'help':
            return 'Available commands: pwd, ls, clear, help\r\n'
        default:
            return `${program}: command is not available in this browser terminal\r\n`
    }
}

async function listShareTerminalDirectory(root: string, args: string[]) {
    const visibleArgs = args.filter(arg => !arg.startsWith('-'))
    const target = visibleArgs[0] ? path.resolve(root, visibleArgs[0]) : root

    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        return 'Cannot list paths outside this workspace.'
    }

    try {
        const entries = await fs.promises.readdir(target, { withFileTypes: true })
        return entries
            .map(entry => `${entry.name}${entry.isDirectory() ? '/' : ''}`)
            .sort((a, b) => a.localeCompare(b))
            .join('  ') || '.'
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
}

function sendTerminalUpdate(connection: WebSocket, content: string) {
    if (connection.readyState !== WebSocket.OPEN) {
        return
    }

    connection.send(JSON.stringify({
        type: 'update',
        content,
        participants: 1,
    }))
}

async function recordWebsocketFailure(kind: string, id: string, error: unknown) {
    await recordLog({
        level: 'warn',
        message: `Websocket ${kind} failure for ${id}: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
            category: 'websocket_failure',
            kind,
            id,
        },
    }).catch(() => {})
}
