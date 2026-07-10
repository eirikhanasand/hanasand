'use client'

import { Check, Clipboard, Download, Globe2, Hourglass, Play, Plus, RotateCcw, Share2, ShieldCheck, Square, Trash2 } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

type SessionState = 'prompt' | 'queued' | 'connecting' | 'live' | 'ended' | 'failed'
type SocketState = 'closed' | 'connecting' | 'open' | 'error'
type BrowserNetwork = 'regular' | 'tor'
type SandboxCapacity = {
    activeSessions: number
    queuedSessions: number
    maxSessions: number
    queuePosition?: number
}
type SandboxProfile = {
    id: string
    name: string
    tools: SandboxTool[]
}
type SandboxTool = {
    id: string
    name: string
    url: string
}
type Capture = {
    id: string
    kind: 'page' | 'tool'
    label: string
    url: string
    target?: string
    title?: string
    capturedAt: string
    reason?: string
    image?: string | null
    frameWidth?: number
    frameHeight?: number
    frameQuality?: FrameQuality
    error?: string
    evidence?: SandboxEvidence
    toolAnalysis?: SandboxToolAnalysis
    networkSummary?: SandboxNetworkSummary
    webcrackLoad?: SandboxWebCrackLoad
}
type FrameQuality = {
    looksBlank?: boolean
    visibleTextLength?: number
    elementCount?: number
    visibleMedia?: number
    bodyHeight?: number
    viewportWidth?: number
    viewportHeight?: number
}
type SandboxWebCrackLoad = {
    loaded?: boolean
    scriptId?: string
    source?: string
    sampleBytes?: number
    action?: string
    reason?: string
}
type SandboxNetworkSummary = {
    requestCount?: number
    responseCount?: number
    failedCount?: number
    uniqueDomainCount?: number
    domains?: string[]
    recentRequests?: Array<{ url?: string; method?: string; resourceType?: string; status?: number; host?: string; mimeType?: string; initiator?: string; durationMs?: number; ip?: string; asn?: string; port?: number; protocol?: string; tlsIssuer?: string; tlsSubject?: string; tlsValidFrom?: number; tlsValidTo?: number; failure?: string; at?: string }>
    statusCounts?: Record<string, number>
    redirectChain?: string[]
    downloads?: Array<{ url?: string; fileName?: string; bytes?: number; sha256?: string; hashStatus?: string; at?: string }>
    recentFailures?: Array<{ url?: string; failure?: string; at?: string }>
    lastUpdatedAt?: string
}
type SandboxToolAnalysis = {
    toolKind?: string
    vendorFlagged?: number
    vendorTotal?: number
    alertCount?: number
    communityCommentCount?: number
    communitySummary?: string
    verdict?: string
    extractedSignals?: string[]
    webcrackLoaded?: boolean
    webcrackScriptId?: string
    webcrackSampleBytes?: number
    webcrackLoadReason?: string
    threatAssociations?: SandboxThreatAssociation[]
}
type SandboxThreatAssociation = {
    name?: string
    category?: 'actor' | 'malware' | 'ransomware' | 'tool' | 'campaign'
    confidence?: 'high' | 'medium' | 'low'
    evidence?: string
    source?: 'rendered_page' | 'tool_context' | 'decoded_script'
}
type BrowserRunHistory = {
    id: string
    target: string
    network: BrowserNetwork
    status: string
    startedAt: string
    checkCount?: number
    title?: string
    providerResults?: Record<string, ProviderRunResult>
    reportUrl?: string
}
type ProviderRunResult = {
    status: 'clean' | 'suspicious' | 'blocked' | 'loading'
    label: string
}
type BrowserQuota = {
    plan: string
    limit: number
    used: number
    remaining: number
    resetsAt?: string | null
    identityKind?: string
}
type SandboxEvidence = {
    url?: string
    textExcerpt?: string
    sourceCode?: string
    sourceUrls?: string[]
    verdict?: string
    confidence?: number
    reasons?: string[]
    comments?: string[]
    indicators?: {
        domains?: string[]
        ips?: string[]
        urls?: string[]
    }
    forms?: Array<{ action?: string; method?: string; sensitiveInputCount?: number; inputCount?: number }>
    scripts?: Array<{ id?: string; src?: string; inlineBytes?: number; obfuscationScore?: number; reasons?: string[]; sample?: string; sha256?: string }>
    obfuscatedScripts?: Array<{ id?: string; src?: string; inlineBytes?: number; obfuscationScore?: number; reasons?: string[]; sample?: string; sha256?: string }>
    threatAssociations?: SandboxThreatAssociation[]
    deobfuscationTasks?: Array<{
        scriptId?: string
        source?: string
        webcrackReady?: boolean
        sample?: string
        sha256?: string
        decodedPreview?: string
        decodedTransforms?: string[]
        indicators?: { domains?: string[]; ips?: string[]; urls?: string[] }
        threatAssociations?: SandboxThreatAssociation[]
        assessment?: string
        summary?: string
    }>
}
type ReviewQueueItem = {
    severity: 'high' | 'medium' | 'low'
    source: string
    title: string
    detail: string
    evidence?: string
}

const storageKey = 'hanasand:browser:profiles:v1'
const historyStorageKey = 'hanasand:browser:history:v1'
const clientIdStorageKey = 'hanasand:browser:client-id:v1'
const profileApiPath = '/api/backend/browser/profiles'
const historyApiPath = '/api/backend/browser/runs'
const brokerBaseUrl = process.env.NEXT_PUBLIC_BROWSER_WS || `${config.url.api_client_wss}/ws/browser`
const defaultTools: SandboxTool[] = [
    { id: 'virustotal', name: 'VirusTotal', url: 'https://www.virustotal.com/gui/search/{url}' },
    { id: 'urlquery', name: 'urlquery', url: 'https://urlquery.net/search?q={url}' },
    { id: 'webcrack', name: 'WebCrack', url: 'https://webcrack.netlify.app/' },
]
const defaultProfiles: SandboxProfile[] = [
    { id: 'triage-default', name: 'SOC triage', tools: defaultTools },
    { id: 'browser-only', name: 'Browser only', tools: [] },
]

function normalizeTarget(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
}

function sessionId() {
    return `regular-${Date.now().toString(36)}`
}

function brokerUrlForSession(baseUrl: string, id: string) {
    if (baseUrl.includes(':id')) return baseUrl.replace(':id', encodeURIComponent(id))
    return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(id)}`
}

function resolveToolUrl(template: string, target: string) {
    if (!target) return template
    return template.replaceAll('{url}', encodeURIComponent(target)).replaceAll('{rawUrl}', target)
}

function browserViewportSize(element: HTMLElement | null) {
    const rect = element?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return null
    const width = Math.round(rect.width)
    return {
        width,
        height: Math.round(width * 9 / 16),
    }
}

export default function BrowserPageClient() {
    const [formReady, setFormReady] = useState(false)
    const [target, setTarget] = useState('')
    const [sessionState, setSessionState] = useState<SessionState>('prompt')
    const [socketState, setSocketState] = useState<SocketState>('closed')
    const [profiles, setProfiles] = useState<SandboxProfile[]>(defaultProfiles)
    const [selectedProfileId, setSelectedProfileId] = useState(defaultProfiles[0].id)
    const [captures, setCaptures] = useState<Capture[]>([])
    const [activeImage, setActiveImage] = useState<string | null>(null)
    const [activeFrame, setActiveFrame] = useState<{ width: number; height: number }>({ width: 1280, height: 720 })
    const [activeUrl, setActiveUrl] = useState('')
    const [runBlocker, setRunBlocker] = useState('')
    const [events, setEvents] = useState<string[]>(['Sandbox ready.'])
    const [consoleEvents, setConsoleEvents] = useState<string[]>([])
    const [activeSandboxTab, setActiveSandboxTab] = useState('browser')
    const [customProfileName, setCustomProfileName] = useState('')
    const [customToolName, setCustomToolName] = useState('')
    const [customToolUrl, setCustomToolUrl] = useState('')
    const [profilesLoaded, setProfilesLoaded] = useState(false)
    const [profileSyncEnabled, setProfileSyncEnabled] = useState(false)
    const [profileSyncState, setProfileSyncState] = useState<'local' | 'loading' | 'synced' | 'saving' | 'error'>('loading')
    const [capacity, setCapacity] = useState<SandboxCapacity | null>(null)
    const [history, setHistory] = useState<BrowserRunHistory[]>([])
    const [quota, setQuota] = useState<BrowserQuota | null>(null)
    const [expandedRun, setExpandedRun] = useState<BrowserRunHistory | null>(null)
    const [currentRunId, setCurrentRunId] = useState('')
    const [shareStatus, setShareStatus] = useState('')
    const socketRef = useRef<WebSocket | null>(null)
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const imageRef = useRef<HTMLImageElement | null>(null)
    const touchFrameRef = useRef<{ clientX: number; clientY: number; lastX: number; lastY: number; moved: boolean } | null>(null)

    const normalizedTarget = useMemo(() => normalizeTarget(target), [target])
    const selectedProfile = useMemo(() => profiles.find(profile => profile.id === selectedProfileId) || profiles[0], [profiles, selectedProfileId])
    const summary = useMemo(() => buildAnalystSummary(normalizedTarget, captures, selectedProfile), [captures, normalizedTarget, selectedProfile])
    const toolCaptures = useMemo(() => captures.filter(capture => capture.kind === 'tool'), [captures])
    const latestPageImage = useMemo(() => captures.find(capture => capture.kind === 'page' && capture.image && !capture.frameQuality?.looksBlank)?.image || null, [captures])
    const activeTool = useMemo(() => selectedProfile.tools.find(tool => tool.id === activeSandboxTab), [activeSandboxTab, selectedProfile.tools])
    const activeToolCapture = activeTool ? selectToolCapture(toolCaptures, activeTool, normalizedTarget) : undefined
    const activeViewportImage = activeTool ? activeToolCapture?.image : activeImage || latestPageImage
    const activeViewportUrl = activeTool ? activeToolCapture?.url || resolveToolUrl(activeTool.url, activeUrl || normalizedTarget) : activeUrl || normalizedTarget

    useEffect(() => {
        setFormReady(true)
    }, [])

    const pushEvent = useCallback((event: string) => {
        setEvents(current => [event, ...current].slice(0, 8))
    }, [])
    const pushConsoleEvent = useCallback((event: string) => {
        setConsoleEvents(current => [event, ...current].slice(0, 20))
    }, [])

    const exportReport = useCallback(() => {
        const blob = new Blob([JSON.stringify(buildExportReport({
            target: normalizedTarget,
            activeUrl,
            sessionState,
            socketState,
            profile: selectedProfile,
            summary,
            captures,
            events,
            consoleEvents,
            capacity,
        }), null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `browser-sandbox-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
        link.click()
        URL.revokeObjectURL(url)
    }, [activeUrl, capacity, captures, consoleEvents, events, normalizedTarget, selectedProfile, sessionState, socketState, summary])

    const saveReport = useCallback(async () => {
        if (!currentRunId || !captures.length) return
        setShareStatus('saving')
        const response = await fetch(`${historyApiPath}/${encodeURIComponent(currentRunId)}/report`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId: getOrCreateBrowserClientId(),
                report: buildExportReport({
                    target: normalizedTarget,
                    activeUrl,
                    sessionState,
                    socketState,
                    profile: selectedProfile,
                    summary,
                    captures,
                    events,
                    consoleEvents,
                    capacity,
                }),
            }),
        })
        if (!response.ok) {
            setShareStatus('failed')
            return
        }
        const payload = await response.json() as { reportUrl?: string }
        const reportUrl = payload.reportUrl ? new URL(payload.reportUrl, window.location.origin).toString() : ''
        if (reportUrl) await navigator.clipboard?.writeText(reportUrl).catch(() => undefined)
        setHistory(current => persistHistory(current.map(run => run.id === currentRunId ? { ...run, reportUrl } : run)))
        setShareStatus(reportUrl ? 'copied' : 'saved')
    }, [activeUrl, capacity, captures, consoleEvents, currentRunId, events, normalizedTarget, selectedProfile, sessionState, socketState, summary])

    useEffect(() => {
        let cancelled = false
        try {
            const stored = sanitizeProfiles(JSON.parse(window.localStorage.getItem(storageKey) || '[]'))
            if (Array.isArray(stored) && stored.length) {
                setProfiles(mergeProfiles(stored))
                setSelectedProfileId(stored[0]?.id || defaultProfiles[0].id)
            }
        } catch {
            setProfiles(defaultProfiles)
        } finally {
            setProfilesLoaded(true)
        }

        fetch(profileApiPath, { credentials: 'include', cache: 'no-store' })
            .then(async response => {
                if (cancelled) return
                if (response.status === 401 || response.status === 403) {
                    setProfileSyncEnabled(false)
                    setProfileSyncState('local')
                    return
                }
                if (!response.ok) throw new Error('Profile sync failed')
                const payload = await response.json() as { profiles?: unknown }
                const serverProfiles = sanitizeProfiles(payload.profiles)
                if (serverProfiles.length) {
                    setProfiles(mergeProfiles(serverProfiles))
                    setSelectedProfileId(serverProfiles[0]?.id || defaultProfiles[0].id)
                }
                setProfileSyncEnabled(true)
                setProfileSyncState('synced')
            })
            .catch(() => {
                if (cancelled) return
                setProfileSyncEnabled(false)
                setProfileSyncState('local')
            })

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!profilesLoaded) return
        const userProfiles = profiles.filter(profile => !isDefaultProfile(profile.id))
        window.localStorage.setItem(storageKey, JSON.stringify(userProfiles))
        if (!profileSyncEnabled) return
        const controller = new AbortController()
        const timer = window.setTimeout(() => {
            setProfileSyncState('saving')
            fetch(profileApiPath, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profiles: userProfiles }),
                signal: controller.signal,
            })
                .then(response => {
                    if (!response.ok) throw new Error('Profile sync failed')
                    setProfileSyncState('synced')
                })
                .catch(error => {
                    if (error?.name !== 'AbortError') setProfileSyncState('error')
                })
        }, 650)
        return () => {
            controller.abort()
            window.clearTimeout(timer)
        }
    }, [profileSyncEnabled, profiles, profilesLoaded])

    useEffect(() => {
        if (activeSandboxTab !== 'browser' && !selectedProfile.tools.some(tool => tool.id === activeSandboxTab)) setActiveSandboxTab('browser')
    }, [activeSandboxTab, selectedProfile.tools])

    useEffect(() => {
        try {
            const stored = JSON.parse(window.localStorage.getItem(historyStorageKey) || '[]')
            if (Array.isArray(stored)) setHistory(sanitizeHistory(stored))
        } catch {
            setHistory([])
        }
        fetch(`${historyApiPath}?clientId=${encodeURIComponent(getOrCreateBrowserClientId())}`, { credentials: 'include', cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('history unavailable')
                const payload = await response.json() as { runs?: unknown; quota?: unknown }
                const runs = sanitizeHistory(payload.runs)
                if (runs.length) {
                    setHistory(runs)
                    window.localStorage.setItem(historyStorageKey, JSON.stringify(runs.slice(0, 12)))
                }
                const nextQuota = quotaValue(payload.quota)
                if (nextQuota) setQuota(nextQuota)
            })
            .catch(() => undefined)
    }, [])

    useEffect(() => () => {
        socketRef.current?.close()
        socketRef.current = null
    }, [])

    const sendBrowserResize = useCallback(() => {
        const size = browserViewportSize(viewportRef.current)
        const socket = socketRef.current
        if (!size || !socket || socket.readyState !== WebSocket.OPEN) return
        socket.send(JSON.stringify({ type: 'resize', ...size }))
    }, [])

    useEffect(() => {
        if (sessionState === 'prompt') return
        const element = viewportRef.current
        if (!element) return
        sendBrowserResize()
        const observer = new ResizeObserver(sendBrowserResize)
        observer.observe(element)
        return () => observer.disconnect()
    }, [sendBrowserResize, sessionState])

    const startRun = useCallback((override?: { target?: string; network?: BrowserNetwork }) => {
        const url = normalizeTarget(override?.target ?? target)
        if (!url) return
        const id = sessionId()
        const socket = new WebSocket(brokerUrlForSession(brokerBaseUrl, id))
        const runNetwork = inferNetwork(url)
        if (override?.target) setTarget(override.target)
        socketRef.current?.close()
        socketRef.current = socket
        setCurrentRunId(id)
        setShareStatus('')
        setCaptures([])
        setConsoleEvents([])
        setRunBlocker('')
        setActiveImage(null)
        setActiveUrl(url)
        setActiveSandboxTab('browser')
        setCapacity(null)
        setSessionState('connecting')
        setSocketState('connecting')
        pushEvent(`Launching isolated browser for ${url}.`)

        socket.onopen = () => {
            setSocketState('open')
            const profileTools = selectedProfileId === 'browser-only'
                ? []
                : selectedProfile.tools.length ? selectedProfile.tools : defaultTools
            socket.send(JSON.stringify({
                type: 'start',
                sessionId: id,
                network: runNetwork,
                target: url,
                durationMinutes: 15,
                profileTools,
                ...browserViewportSize(viewportRef.current),
                clientId: getOrCreateBrowserClientId(),
                userId: getCookie('id') || undefined,
                sessionToken: getCookie('access_token') || undefined,
            }))
        }
        socket.onclose = () => {
            if (socketRef.current !== socket) return
            setSocketState('closed')
            setSessionState(current => current === 'prompt' || current === 'failed' ? current : 'ended')
            pushEvent('Sandbox broker closed.')
        }
        socket.onerror = () => {
            if (socketRef.current !== socket) return
            setSocketState('error')
            setSessionState('failed')
            pushEvent('Sandbox broker errored.')
        }
        socket.onmessage = (message) => {
            if (socketRef.current !== socket) return
            if (typeof message.data !== 'string') return
            const payload = parsePayload(message.data)
            if (!payload) return
            if (payload.type === 'ready') {
                setCapacity(capacityValue(payload.capacity) || null)
                const runRecord = runHistoryValue(payload.run) || {
                    id,
                    target: url,
                    network: runNetwork,
                    status: 'running',
                    startedAt: new Date().toISOString(),
                    title: '',
                }
                setHistory(current => persistHistory([runRecord, ...current]))
                const nextQuota = quotaValue(payload.quota)
                if (nextQuota) setQuota(nextQuota)
                setSessionState('live')
                pushEvent('Browser is live.')
                return
            }
            if (payload.type === 'frame' && typeof payload.image === 'string') {
                const image = `data:image/jpeg;base64,${payload.image}`
                const evidence = evidenceValue(payload.evidence)
                if (isUsefulFrameImage(image)) setActiveImage(image)
                setSessionState(current => current === 'connecting' || current === 'queued' ? 'live' : current)
                const urlValue = String(payload.url || url)
                const frameWidth = finiteNumber(payload.width) || 1280
                const frameHeight = finiteNumber(payload.height) || 720
                setActiveUrl(urlValue)
                setActiveFrame({ width: frameWidth, height: frameHeight })
                const reason = stringValue(payload.reason)
                setCaptures(current => addCapture(current, {
                    id: `page-${payload.capturedAt || Date.now()}-${current.length}`,
                    kind: 'page',
                    label: captureLabel(reason),
                    url: urlValue,
                    title: stringValue(payload.title),
                    capturedAt: stringValue(payload.capturedAt) || new Date().toISOString(),
                    reason,
                    image,
                    frameWidth,
                    frameHeight,
                    frameQuality: frameQualityValue(payload.frameQuality),
                    evidence,
                    networkSummary: networkSummaryValue(payload.networkSummary),
                }))
                return
            }
            if (payload.type === 'tool_capture') {
                const image = typeof payload.image === 'string' ? `data:image/jpeg;base64,${payload.image}` : null
                const toolAnalysis = toolAnalysisValue(payload.toolAnalysis)
                const providerResult = providerRunResult(toolAnalysis, stringValue(payload.error))
                setCaptures(current => addCapture(current, {
                    id: `tool-${payload.id || current.length}-${payload.capturedAt || Date.now()}`,
                    kind: 'tool',
                    label: stringValue(payload.name) || 'Profile tool',
                    url: stringValue(payload.url) || '',
                    target: stringValue(payload.target),
                    title: stringValue(payload.title),
                    capturedAt: stringValue(payload.capturedAt) || new Date().toISOString(),
                    image,
                    error: stringValue(payload.error),
                    evidence: evidenceValue(payload.evidence),
                    toolAnalysis,
                    webcrackLoad: webcrackLoadValue(payload.webcrackLoad),
                }))
                if (providerResult) {
                    setHistory(current => persistHistory(current.map(run => run.id === id
                        ? { ...run, providerResults: { ...(run.providerResults || {}), [toolAnalysis?.toolKind || safeToolKey(stringValue(payload.id) || stringValue(payload.name))]: providerResult } }
                        : run)))
                }
                pushEvent(`${stringValue(payload.name) || 'Profile tool'} captured.`)
                return
            }
            if (payload.type === 'status') {
                const statusState = stringValue(payload.state)
                const nextCapacity = capacityValue(payload.capacity)
                if (nextCapacity) setCapacity(nextCapacity)
                const nextQuota = quotaValue(payload.quota)
                if (nextQuota) setQuota(nextQuota)
                if (statusState === 'capacity_busy' || statusState === 'capacity_queue_position') {
                    setSessionState('queued')
                } else if (statusState === 'capacity_admitted' || statusState === 'launching') {
                    setSessionState('connecting')
                } else if (statusState === 'quota_exhausted') {
                    setSessionState('failed')
                    setRunBlocker(String(payload.message || 'Browser run limit reached.'))
                } else if (statusState === 'failed') {
                    setSessionState('failed')
                    setRunBlocker(String(payload.message || 'Sandbox launch failed.'))
                }
                if (payload.url) setActiveUrl(String(payload.url))
                pushEvent(String(payload.message || payload.state || 'Browser status updated.'))
                return
            }
            if (payload.type === 'console') {
                pushConsoleEvent(cleanConsoleEvent(stringValue(payload.text)))
                return
            }
            if (payload.type === 'pageerror') {
                pushConsoleEvent(cleanConsoleEvent(`pageerror: ${stringValue(payload.message)}`))
                return
            }
            if (payload.type === 'navigation_error' || payload.type === 'error') {
                if (payload.type === 'navigation_error' && isDegradedNavigationError(stringValue(payload.message))) {
                    setRunBlocker(String(payload.message || 'Target navigation did not complete; showing captured browser/provider evidence.'))
                    pushEvent(String(payload.message || 'Target navigation did not complete; showing captured browser/provider evidence.'))
                    return
                }
                setSessionState('failed')
                setRunBlocker(String(payload.message || 'Sandbox navigation failed.'))
                pushEvent(String(payload.message || 'Sandbox navigation failed.'))
            }
        }
    }, [pushConsoleEvent, pushEvent, selectedProfile.tools, selectedProfileId, target])

    const stopRun = useCallback(() => {
        socketRef.current?.send(JSON.stringify({ type: 'end' }))
        socketRef.current?.close()
        socketRef.current = null
        setSessionState('ended')
        pushEvent('Sandbox stopped.')
    }, [pushEvent])

    const resetRun = useCallback(() => {
        socketRef.current?.close()
        socketRef.current = null
        setSessionState('prompt')
        setSocketState('closed')
        setCaptures([])
        setRunBlocker('')
        setActiveImage(null)
        setActiveUrl('')
        setCapacity(null)
        pushEvent('Sandbox reset.')
    }, [pushEvent])

    const sendBrowserInput = useCallback((payload: Record<string, unknown>) => {
        const socket = socketRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN) return
        socket.send(JSON.stringify(payload))
    }, [])

    const browserPoint = useCallback((clientX: number, clientY: number) => {
        const image = imageRef.current
        if (!image) return null
        const rect = image.getBoundingClientRect()
        if (!rect.width || !rect.height) return null
        const x = Math.max(0, Math.min(activeFrame.width, Math.round(((clientX - rect.left) / rect.width) * activeFrame.width)))
        const y = Math.max(0, Math.min(activeFrame.height, Math.round(((clientY - rect.top) / rect.height) * activeFrame.height)))
        return { x, y }
    }, [activeFrame.height, activeFrame.width])

    const eventInsideViewport = useCallback((clientX: number, clientY: number) => {
        const viewport = viewportRef.current
        if (!viewport) return false
        const rect = viewport.getBoundingClientRect()
        return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    }, [])

    const keyBrowserFrame = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        const keyPayload = {
            type: 'key',
            key: event.key,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
            event.preventDefault()
            void navigator.clipboard?.readText?.()
                .then(text => {
                    sendBrowserInput({ type: 'clipboard', direction: 'browser-to-remote', text })
                    sendBrowserInput(keyPayload)
                })
                .catch(() => sendBrowserInput(keyPayload))
            return
        }
        if (event.metaKey || event.ctrlKey || event.altKey || event.key.length === 1 || ['Enter', 'Tab', 'Backspace', 'Delete', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            sendBrowserInput(keyPayload)
            if (event.key !== 'Tab') event.preventDefault()
        }
    }, [sendBrowserInput])

    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport || activeTool) return
        const wheelBrowserFrame = (event: globalThis.WheelEvent) => {
            const rect = viewport.getBoundingClientRect()
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return
            const scrollRoot = document.scrollingElement
            const scrollLeft = scrollRoot?.scrollLeft ?? window.scrollX
            const scrollTop = scrollRoot?.scrollTop ?? window.scrollY
            viewport.focus()
            const point = browserPoint(event.clientX, event.clientY)
            if (!point) return
            event.preventDefault()
            event.stopPropagation()
            sendBrowserInput({ type: 'wheel', ...point, deltaX: event.deltaX, deltaY: event.deltaY })
            requestAnimationFrame(() => {
                if (scrollRoot) scrollRoot.scrollTo(scrollLeft, scrollTop)
                else window.scrollTo(scrollLeft, scrollTop)
            })
        }
        window.addEventListener('wheel', wheelBrowserFrame, { capture: true, passive: false })
        return () => window.removeEventListener('wheel', wheelBrowserFrame, { capture: true })
    }, [activeTool, browserPoint, sendBrowserInput])

    useEffect(() => {
        if (activeTool) return
        const capturePointerFrame = (event: globalThis.PointerEvent) => {
            if (event.pointerType === 'touch' || !eventInsideViewport(event.clientX, event.clientY)) return
            const point = browserPoint(event.clientX, event.clientY)
            if (!point) return
            event.preventDefault()
            event.stopPropagation()
            viewportRef.current?.focus()
            sendBrowserInput({ type: 'pointer', event: event.type, ...point, button: event.button, buttons: event.buttons })
        }
        const captureClickFrame = (event: globalThis.MouseEvent) => {
            if (!eventInsideViewport(event.clientX, event.clientY)) return
            const point = browserPoint(event.clientX, event.clientY)
            if (!point) return
            event.preventDefault()
            event.stopPropagation()
            viewportRef.current?.focus()
            sendBrowserInput({ type: 'click', ...point, button: event.button })
        }
        const captureTouchFrame = (event: globalThis.TouchEvent) => {
            const touch = event.changedTouches[0]
            if (!touch || !eventInsideViewport(touch.clientX, touch.clientY)) return
            const point = browserPoint(touch.clientX, touch.clientY)
            if (!point) return
            event.preventDefault()
            event.stopPropagation()
            viewportRef.current?.focus()

            if (event.type === 'touchstart') {
                touchFrameRef.current = { clientX: touch.clientX, clientY: touch.clientY, lastX: touch.clientX, lastY: touch.clientY, moved: false }
                sendBrowserInput({ type: 'pointer', event: 'pointerdown', ...point, button: 0, buttons: 1 })
                return
            }

            const touchState = touchFrameRef.current
            if (!touchState) return
            const deltaX = touch.clientX - touchState.lastX
            const deltaY = touch.clientY - touchState.lastY
            touchState.lastX = touch.clientX
            touchState.lastY = touch.clientY
            if (Math.abs(touch.clientX - touchState.clientX) > 6 || Math.abs(touch.clientY - touchState.clientY) > 6) touchState.moved = true

            if (event.type === 'touchmove') {
                sendBrowserInput({ type: 'wheel', ...point, deltaX: -deltaX, deltaY: -deltaY })
                return
            }

            sendBrowserInput({ type: 'pointer', event: 'pointerup', ...point, button: 0, buttons: 0 })
            if (!touchState.moved && event.type === 'touchend') sendBrowserInput({ type: 'click', ...point, button: 0 })
            touchFrameRef.current = null
        }
        window.addEventListener('pointerdown', capturePointerFrame, { capture: true })
        window.addEventListener('pointermove', capturePointerFrame, { capture: true })
        window.addEventListener('pointerup', capturePointerFrame, { capture: true })
        window.addEventListener('click', captureClickFrame, { capture: true })
        window.addEventListener('touchstart', captureTouchFrame, { capture: true, passive: false })
        window.addEventListener('touchmove', captureTouchFrame, { capture: true, passive: false })
        window.addEventListener('touchend', captureTouchFrame, { capture: true, passive: false })
        window.addEventListener('touchcancel', captureTouchFrame, { capture: true, passive: false })
        return () => {
            window.removeEventListener('pointerdown', capturePointerFrame, { capture: true })
            window.removeEventListener('pointermove', capturePointerFrame, { capture: true })
            window.removeEventListener('pointerup', capturePointerFrame, { capture: true })
            window.removeEventListener('click', captureClickFrame, { capture: true })
            window.removeEventListener('touchstart', captureTouchFrame, { capture: true })
            window.removeEventListener('touchmove', captureTouchFrame, { capture: true })
            window.removeEventListener('touchend', captureTouchFrame, { capture: true })
            window.removeEventListener('touchcancel', captureTouchFrame, { capture: true })
        }
    }, [activeTool, browserPoint, eventInsideViewport, sendBrowserInput])

    const saveProfile = useCallback(() => {
        const name = customProfileName.trim()
        if (!name) return
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `profile-${Date.now()}`
        const profile = { id, name, tools: defaultTools }
        setProfiles(current => mergeProfiles([profile, ...current]))
        setSelectedProfileId(id)
        setCustomProfileName('')
    }, [customProfileName])

    const deleteProfile = useCallback((id: string) => {
        if (isDefaultProfile(id)) return
        setProfiles(current => current.filter(profile => profile.id !== id))
        if (selectedProfileId === id) setSelectedProfileId(defaultProfiles[0].id)
    }, [selectedProfileId])

    const addToolToSelectedProfile = useCallback(() => {
        const name = customToolName.trim()
        const url = customToolUrl.trim()
        if (!name || !/^https?:\/\//i.test(url) || isDefaultProfile(selectedProfile.id)) return
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `tool-${Date.now()}`
        setProfiles(current => current.map(profile => profile.id === selectedProfile.id
            ? { ...profile, tools: [...profile.tools.filter(tool => tool.id !== id), { id, name, url }].slice(0, 8) }
            : profile))
        setCustomToolName('')
        setCustomToolUrl('')
    }, [customToolName, customToolUrl, selectedProfile.id])

    const removeToolFromSelectedProfile = useCallback((toolId: string) => {
        if (isDefaultProfile(selectedProfile.id)) return
        setProfiles(current => current.map(profile => profile.id === selectedProfile.id
            ? { ...profile, tools: profile.tools.filter(tool => tool.id !== toolId) }
            : profile))
    }, [selectedProfile.id])

    if (sessionState === 'prompt') {
        return (
            <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
                <section className='mx-auto grid min-h-[calc(100vh-4.5rem)] w-full max-w-7xl items-center gap-8 overflow-x-hidden px-4 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.1fr)]'>
                    <div className='grid gap-4'>
                        <p className='text-xs font-semibold uppercase text-ui-primary'>Browser sandbox</p>
                        <h1 className='max-w-xl text-4xl font-semibold tracking-normal text-ui-text md:text-6xl'>Browser</h1>
                        <p className='max-w-xl text-base leading-7 text-ui-muted'>
                            Check unknown URLs in a sandbox. Onion addresses are also supported.
                        </p>
                        <div className='grid max-w-xl gap-2 text-sm text-ui-muted sm:grid-cols-3'>
                            <span className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2'><strong className='text-ui-text'>{capacity?.activeSessions ?? 0}/{capacity?.maxSessions ?? 10}</strong> browsers active</span>
                            <span className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>Queues when full</span>
                            <span className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>Onion supported</span>
                        </div>
                    </div>
                    <div className='grid min-w-0 gap-3'>
                        <form
                            className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'
                            onSubmit={(event) => {
                                event.preventDefault()
                                startRun()
                            }}
                        >
                            <div className='flex items-start justify-between gap-3'>
                                <div>
                                    <h2 className='text-lg font-semibold text-ui-text'>Investigate</h2>
                                </div>
                                <Globe2 className='h-5 w-5 shrink-0 text-ui-primary' />
                            </div>
                            <div className='grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]'>
                                <input
                                    id='sandbox-url'
                                    value={target}
                                    onChange={event => setTarget(event.target.value)}
                                    placeholder='URL to investigate'
                                    disabled={!formReady}
                                    className='h-12 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 font-mono text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                                />
                                <button type='submit' disabled={!formReady || !normalizedTarget} className='inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'>
                                    <Play className='h-4 w-4' />
                                    Start
                                </button>
                            </div>
                            <details className='grid gap-3 rounded-md border border-ui-border bg-ui-raised p-3'>
                                <summary className='flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden'>
                                    <ProfilePicker profiles={profiles} selectedProfileId={selectedProfileId} onSelect={setSelectedProfileId} onDelete={deleteProfile} />
                                    <span className='ml-auto shrink-0 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-primary'>Edit</span>
                                </summary>
                                <div className='mt-3 grid gap-3'>
                                    <p className='text-sm text-ui-muted'>Profiles run the selected URL through external triage surfaces in the remote sandbox context.</p>
                                    <p className='text-xs text-ui-muted'>{profileSyncLabel(profileSyncState)}</p>
                                    <div className='flex gap-2'>
                                        <input value={customProfileName} onChange={event => setCustomProfileName(event.target.value)} placeholder='Profile name' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none' />
                                        <button type='button' onClick={saveProfile} className='grid h-9 w-9 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary' aria-label='Save profile'>
                                            <Plus className='h-4 w-4' />
                                        </button>
                                    </div>
                                    <ProfileToolEditor
                                        profile={selectedProfile}
                                        locked={isDefaultProfile(selectedProfile.id)}
                                        toolName={customToolName}
                                        toolUrl={customToolUrl}
                                        onToolName={setCustomToolName}
                                        onToolUrl={setCustomToolUrl}
                                        onAddTool={addToolToSelectedProfile}
                                        onRemoveTool={removeToolFromSelectedProfile}
                                    />
                                </div>
                            </details>
                            <HistoryPanel history={history} quota={quota} onRerun={(run) => startRun({ target: run.target })} onExpand={setExpandedRun} embedded />
                        </form>
                    </div>
                </section>
                {expandedRun ? <RunDetailModal run={expandedRun} onClose={() => setExpandedRun(null)} onRerun={(run) => startRun({ target: run.target })} /> : null}
            </main>
        )
    }

    return (
        <main className='min-h-[calc(100vh-4.5rem)] overflow-x-hidden bg-ui-canvas text-ui-text'>
            <section className='grid min-h-[calc(100vh-4.5rem)] grid-rows-[auto_minmax(0,1fr)]'>
                <header className='border-b border-ui-border bg-ui-panel px-4 py-3'>
                    <div className='mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-3'>
                        <div className='min-w-0'>
                            <p className='text-xs font-semibold uppercase text-ui-primary'>Browser sandbox</p>
                            <h1 className='truncate text-lg font-semibold text-ui-text'>{activeUrl || normalizedTarget}</h1>
                        </div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <StatusPill label='Run' value={sessionStateLabel(sessionState)} good={sessionState === 'live'} />
                            {sessionState !== 'ended' ? <StatusPill label='Connection' value={socketStateLabel(socketState)} good={socketState === 'open'} /> : null}
                            {capacity ? <StatusPill label='Capacity' value={capacity.queuePosition ? `${capacity.queuePosition}/${capacity.queuedSessions} queued` : `${capacity.activeSessions}/${capacity.maxSessions} active`} good={!capacity.queuePosition} /> : null}
                            <button type='button' onClick={exportReport} disabled={!captures.length} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary disabled:cursor-not-allowed disabled:opacity-50'>
                                <Download className='h-4 w-4' />
                                Export
                            </button>
                            <button type='button' onClick={() => void saveReport()} disabled={!captures.length || !currentRunId || shareStatus === 'saving'} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary disabled:cursor-not-allowed disabled:opacity-50'>
                                <Share2 className='h-4 w-4' />
                                {shareStatus === 'saving' ? 'Saving' : shareStatus === 'copied' ? 'Copied' : 'Share'}
                            </button>
                            {sessionState === 'queued' || sessionState === 'connecting' || sessionState === 'live' ? (
                                <button type='button' onClick={stopRun} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-danger/35 bg-ui-danger/10 px-3 text-sm font-semibold text-ui-danger'>
                                    <Square className='h-4 w-4' />
                                    Stop
                                </button>
                            ) : null}
                            <button type='button' onClick={resetRun} className='grid h-9 w-9 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary' aria-label='New sandbox run'>
                                <RotateCcw className='h-4 w-4' />
                            </button>
                        </div>
                    </div>
                </header>
                <div className='mx-auto grid w-full max-w-[96rem] gap-4 px-4 py-4'>
                    <div className='grid min-w-0 items-start gap-4'>
                        <section className='grid overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                            <SandboxTabStrip
                                activeTab={activeSandboxTab}
                                sessionState={sessionState}
                                tools={selectedProfile.tools}
                                toolCaptures={toolCaptures}
                                target={normalizedTarget}
                                browserCaptured={Boolean(activeImage || latestPageImage)}
                                onSelect={setActiveSandboxTab}
                            />
                            <div className='flex items-center gap-2 border-b border-ui-border bg-ui-raised px-3 py-2'>
                                <span className='h-3 w-3 rounded-full bg-ui-danger' />
                                <span className='h-3 w-3 rounded-full bg-ui-warning' />
                                <span className='h-3 w-3 rounded-full bg-ui-success' />
                                <div className='min-w-0 flex-1 truncate rounded-md border border-ui-border bg-ui-canvas px-3 py-2 font-mono text-xs text-ui-muted'>{activeViewportUrl}</div>
                            </div>
                            <div
                                ref={viewportRef}
                                className={`relative aspect-[16/9] w-full overflow-hidden overscroll-contain bg-ui-canvas outline-none focus:ring-2 focus:ring-ui-primary/30 ${activeTool ? 'touch-auto' : 'touch-none'}`}
                                tabIndex={0}
                                role='application'
                                aria-label='Interactive isolated browser viewport'
                                onKeyDown={keyBrowserFrame}
                            >
                                {activeTool && activeToolCapture ? (
                                    <ProviderViewportEvidence tool={activeTool} capture={activeToolCapture} />
                                ) : activeViewportImage ? (
                                    <img
                                        ref={imageRef}
                                        src={activeViewportImage}
                                        alt='Live browser sandbox frame'
                                        className='pointer-events-none absolute inset-0 h-full w-full cursor-pointer select-none bg-ui-canvas object-contain'
                                        draggable={false}
                                        onDragStart={event => event.preventDefault()}
                                    />
                                ) : (
                                    <div className='grid h-full place-items-center'>
                                        <div className='grid max-w-md gap-2 text-center'>
                                            <ShieldCheck className='mx-auto h-8 w-8 text-ui-primary' />
                                            <p className='text-lg font-semibold text-ui-text'>{activeTool ? `${activeTool.name} tab loading` : runBlocker ? 'Browser run blocked' : sessionState === 'queued' ? 'Queued for sandbox capacity' : sessionState === 'connecting' ? 'Waiting for first browser frame' : 'No browser frame captured yet'}</p>
                                            <p className='text-sm leading-6 text-ui-muted'>{activeTool ? providerDetail(activeToolCapture?.toolAnalysis, activeToolCapture) : runBlocker || (sessionState === 'queued' ? queueCopy(capacity) : 'The remote browser has not sent a screenshot yet. If this persists, rerun the URL or check the broker and provider status below.')}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                        <RunOutcomeCard summary={summary} captures={captures} sessionState={sessionState} />
                        <QuickTriageStrip summary={summary} toolCaptures={toolCaptures} toolCount={selectedProfile.tools.length} />
                        <aside className='grid gap-4 xl:grid-cols-3'>
                            <CapacityPanel capacity={capacity} sessionState={sessionState} />
                            <ProviderStatusPanel tools={selectedProfile.tools} toolCaptures={toolCaptures} target={normalizedTarget} onSelect={setActiveSandboxTab} />
                            <div className='rounded-lg border border-ui-border bg-ui-panel p-3 text-xs text-ui-muted'>
                                Latest event: {events[0]}
                            </div>
                        </aside>
                    </div>
                    <div className='grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]'>
                        <EvidenceWorkspace captures={captures} profile={selectedProfile} target={normalizedTarget} summary={summary} events={events} consoleEvents={consoleEvents} />
                        <aside className='grid min-w-0 gap-4'>
                            <AnalystSummary summary={summary} captures={captures} />
                            <CaptureTimeline captures={captures} />
                        </aside>
                    </div>
                </div>
            </section>
        </main>
    )
}

function SandboxTabStrip({
    activeTab,
    sessionState,
    tools,
    toolCaptures,
    target,
    browserCaptured,
    onSelect,
}: {
    activeTab: string
    sessionState: SessionState
    tools: SandboxTool[]
    toolCaptures: Capture[]
    target: string
    browserCaptured: boolean
    onSelect: (tab: string) => void
}) {
    return (
        <div className='grid grid-cols-4 gap-1.5 border-b border-ui-border bg-ui-panel px-2 py-2 md:flex md:justify-center md:gap-2 md:overflow-x-auto md:px-3'>
            <SandboxTabButton
                active={activeTab === 'browser'}
                label='Browser'
                status={sessionState === 'live' ? 'live frame' : sessionState === 'ended' ? (browserCaptured ? 'captured frame' : 'no frame') : sessionStateLabel(sessionState)}
                onClick={() => onSelect('browser')}
            />
            {tools.map(tool => {
                const capture = selectToolCapture(toolCaptures, tool, target)
                return (
                    <SandboxTabButton
                        key={tool.id}
                        active={activeTab === tool.id}
                        label={tool.name}
                        status={providerTabStatus(capture, capture?.toolAnalysis)}
                        onClick={() => onSelect(tool.id)}
                    />
                )
            })}
        </div>
    )
}

function SandboxTabButton({ active, label, status, onClick }: { active: boolean; label: string; status: string; onClick: () => void }) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`grid min-w-0 gap-1 rounded-md border px-2 py-2 text-left transition md:min-w-[9rem] md:shrink-0 md:px-3 ${active ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary/60'}`}
        >
            <span className='truncate text-xs font-semibold md:text-sm'>{label}</span>
            <span className='truncate text-[11px] text-ui-muted'>{status}</span>
        </button>
    )
}

function ProviderStatusPanel({ tools, toolCaptures, target, onSelect }: { tools: SandboxTool[]; toolCaptures: Capture[]; target: string; onSelect: (tab: string) => void }) {
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <h2 className='text-sm font-semibold uppercase text-ui-primary'>Provider tabs</h2>
            <div className='mt-3 grid gap-2'>
                {tools.length ? tools.map(tool => {
                    const capture = selectToolCapture(toolCaptures, tool, target)
                    const analysis = capture?.toolAnalysis
                    return (
                        <button
                            key={tool.id}
                            type='button'
                            onClick={() => onSelect(tool.id)}
                            className='grid gap-1 rounded-md border border-ui-border bg-ui-raised p-3 text-left transition hover:border-ui-primary'
                        >
                            <span className='flex items-center justify-between gap-2'>
                                <span className='font-semibold text-ui-text'>{tool.name}</span>
                                <span className='rounded border border-ui-border bg-ui-panel px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ui-muted'>{providerStatus(capture, analysis)}</span>
                            </span>
                            <span className='text-xs leading-5 text-ui-muted'>{providerDetail(analysis, capture)}</span>
                        </button>
                    )
                }) : <p className='text-xs text-ui-muted'>No provider tools configured for this profile.</p>}
            </div>
        </section>
    )
}

function ProfileToolEditor({
    profile,
    locked,
    toolName,
    toolUrl,
    onToolName,
    onToolUrl,
    onAddTool,
    onRemoveTool,
}: {
    profile: SandboxProfile
    locked: boolean
    toolName: string
    toolUrl: string
    onToolName: (value: string) => void
    onToolUrl: (value: string) => void
    onAddTool: () => void
    onRemoveTool: (id: string) => void
}) {
    return (
        <div className='grid gap-3 rounded-md border border-ui-border bg-ui-raised p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                    <p className='text-sm font-semibold text-ui-text'>{profile.name}</p>
                    <p className='mt-1 text-xs text-ui-muted'>{profile.tools.length ? `${profile.tools.length} tool${profile.tools.length === 1 ? '' : 's'} open on every run.` : 'Browser-only profile.'}</p>
                </div>
                {locked ? <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted'>built in</span> : null}
            </div>
            <div className='grid gap-2'>
                {profile.tools.map(tool => (
                    <div key={tool.id} className='grid gap-2 rounded-md border border-ui-border bg-ui-panel p-2 text-sm md:grid-cols-[8rem_minmax(0,1fr)_auto]'>
                        <span className='font-semibold text-ui-text'>{tool.name}</span>
                        <span className='min-w-0 truncate font-mono text-xs text-ui-muted'>{tool.url}</span>
                        {!locked ? (
                            <button type='button' onClick={() => onRemoveTool(tool.id)} className='grid h-8 w-8 place-items-center rounded-md border border-ui-border text-ui-muted hover:text-ui-danger' aria-label={`Remove ${tool.name}`}>
                                <Trash2 className='h-3.5 w-3.5' />
                            </button>
                        ) : null}
                    </div>
                ))}
            </div>
            {!locked ? (
                <div className='grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)_auto]'>
                    <input value={toolName} onChange={event => onToolName(event.target.value)} placeholder='Tool name' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none' />
                    <input value={toolUrl} onChange={event => onToolUrl(event.target.value)} placeholder='https://tool.example/search?q={url}' className='h-9 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 font-mono text-xs text-ui-text outline-none' />
                    <button type='button' onClick={onAddTool} className='inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                        <Plus className='h-4 w-4' />
                        Add
                    </button>
                </div>
            ) : null}
        </div>
    )
}

function ProfilePicker({ profiles, selectedProfileId, onSelect, onDelete }: { profiles: SandboxProfile[]; selectedProfileId: string; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
    return (
        <div className='flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1'>
            {profiles.map(profile => {
                const selected = selectedProfileId === profile.id
                const locked = defaultProfiles.some(item => item.id === profile.id)
                return (
                    <span key={profile.id} className={`inline-flex min-h-9 shrink-0 items-center overflow-hidden rounded-md border transition ${selected ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-text'}`}>
                        <button
                            type='button'
                            onClick={() => onSelect(profile.id)}
                            className='inline-flex min-h-9 items-center gap-2 px-3 text-sm font-semibold leading-none transition hover:bg-ui-primary/5'
                        >
                            {selected ? <Check className='h-4 w-4' /> : null}
                            <span>{profile.name}</span>
                            <span className='inline-flex items-center self-center text-xs leading-none text-ui-muted'>{profile.tools.length} tools</span>
                        </button>
                        {!locked ? (
                            <button
                                type='button'
                                onClick={() => onDelete(profile.id)}
                                className='grid h-9 w-8 place-items-center border-l border-ui-border text-ui-muted hover:text-ui-danger'
                                aria-label={`Delete ${profile.name}`}
                            >
                                <Trash2 className='h-3.5 w-3.5' />
                            </button>
                        ) : null}
                    </span>
                )
            })}
        </div>
    )
}

function HistoryPanel({ history, quota, onRerun, onExpand, embedded = false }: { history: BrowserRunHistory[]; quota: BrowserQuota | null; onRerun: (run: BrowserRunHistory) => void; onExpand: (run: BrowserRunHistory) => void; embedded?: boolean }) {
    const used = quota?.used ?? history.length
    const limit = quota?.limit ?? 3
    return (
        <section className={embedded ? 'grid gap-3 border-t border-ui-border pt-3' : 'grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4'}>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h2 className='text-sm font-semibold text-ui-text'>Recent browser runs</h2>
                    <p className='mt-1 text-xs text-ui-muted'>{quota ? `${used}/${limit} ${quota.plan} run${limit === 1 ? '' : 's'} used${quota.resetsAt ? ` · resets ${new Date(quota.resetsAt).toLocaleDateString()}` : ''}.` : 'Anonymous history is saved to this browser and synced when available.'}</p>
                </div>
            </div>
            <div className='grid max-h-[10.75rem] gap-2 overflow-y-auto pr-1'>
                {history.map(run => (
                    <div key={run.id} className='grid gap-2 rounded-md border border-ui-border bg-ui-raised p-2 text-xs md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center'>
                        <button type='button' onClick={() => onExpand(run)} className='min-w-0 truncate text-left font-mono text-ui-text'>
                            {run.target}
                            {run.checkCount && run.checkCount > 1 ? <span className='ml-2 font-sans font-semibold text-ui-muted'>({run.checkCount} checks)</span> : null}
                        </button>
                        <ProviderRunBadges run={run} />
                        <span className='whitespace-nowrap text-ui-muted'>{new Date(run.startedAt).toLocaleString()}</span>
                        <button
                            type='button'
                            onClick={() => onRerun(run)}
                            className='inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text transition hover:border-ui-primary hover:text-ui-primary'
                        >
                            <RotateCcw className='h-3.5 w-3.5' />
                            Run again
                        </button>
                    </div>
                ))}
                {!history.length ? <div className='rounded-md border border-dashed border-ui-border p-3 text-xs text-ui-muted'>No browser runs recorded yet.</div> : null}
            </div>
        </section>
    )
}

function RunDetailModal({ run, onClose, onRerun }: { run: BrowserRunHistory; onClose: () => void; onRerun: (run: BrowserRunHistory) => void }) {
    return (
        <div className='fixed inset-0 z-50 grid place-items-center bg-black/55 p-4'>
            <section className='w-full max-w-xl rounded-lg border border-ui-border bg-ui-panel p-4 shadow-xl'>
                <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                        <h2 className='text-base font-semibold text-ui-text'>Browser run</h2>
                        <p className='mt-1 truncate font-mono text-xs text-ui-muted'>{run.target}</p>
                    </div>
                    <button type='button' onClick={onClose} className='rounded-md border border-ui-border px-2 py-1 text-xs font-semibold text-ui-text'>Close</button>
                </div>
                <div className='mt-3 grid gap-2 text-sm'>
                    <div className='flex justify-between gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2'><span className='text-ui-muted'>Started</span><span className='text-ui-text'>{new Date(run.startedAt).toLocaleString()}</span></div>
                    <div className='flex justify-between gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2'><span className='text-ui-muted'>Providers</span><ProviderRunBadges run={run} /></div>
                    {run.reportUrl ? <a href={run.reportUrl} className='rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-ui-primary hover:border-ui-primary'>Open saved report</a> : null}
                </div>
                <button type='button' onClick={() => onRerun(run)} className='mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text hover:border-ui-primary'>
                    <RotateCcw className='h-4 w-4' />
                    Run again
                </button>
            </section>
        </div>
    )
}

function ProviderRunBadges({ run }: { run: BrowserRunHistory }) {
    return (
        <span className='inline-flex items-center gap-1.5 whitespace-nowrap'>
            <ProviderRunBadge provider='virustotal' label='VT' result={run.providerResults?.virustotal} />
            <ProviderRunBadge provider='urlquery' label='urlquery' result={run.providerResults?.urlquery} />
        </span>
    )
}

function ProviderRunBadge({ provider, label, result }: { provider: 'virustotal' | 'urlquery'; label: string; result?: ProviderRunResult }) {
    const clean = !result || result.status === 'clean'
    const icon = provider === 'urlquery' && !clean ? '!' : clean ? '✓' : '!'
    const text = provider === 'virustotal' ? virustotalRunLabel(result?.label || label) : (result?.label || label)
    return <span className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold ${clean ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-warning/40 bg-ui-warning/10 text-ui-warning'}`}>{provider === 'urlquery' ? <span>{icon}</span> : null}<span>{text}</span></span>
}

function virustotalRunLabel(label?: string) {
    if (!label) return 'VT'
    return /\bVT\b/i.test(label) ? label : `${label} VT`
}

function virusTotalVendorLabel(analysis: Pick<SandboxToolAnalysis, 'vendorFlagged' | 'vendorTotal'>) {
    const flagged = analysis.vendorFlagged ?? 0
    return analysis.vendorTotal ? `${flagged}/${analysis.vendorTotal}` : `${flagged} flagged`
}

function CapacityPanel({ capacity, sessionState }: { capacity: SandboxCapacity | null; sessionState: SessionState }) {
    const active = capacity?.activeSessions ?? 0
    const max = capacity?.maxSessions ?? 10
    const queued = capacity?.queuedSessions ?? 0
    const position = capacity?.queuePosition
    const busy = sessionState === 'queued'

    return (
        <section className={`rounded-lg border p-4 ${busy ? 'border-ui-warning/35 bg-ui-warning/10' : 'border-ui-border bg-ui-panel'}`}>
            <div className='flex items-start gap-3'>
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border ${busy ? 'border-ui-warning/40 bg-ui-warning/10 text-ui-warning' : 'border-ui-primary/30 bg-ui-primary/10 text-ui-primary'}`}>
                    {busy ? <Hourglass className='h-4 w-4' /> : <ShieldCheck className='h-4 w-4' />}
                </div>
                <div className='min-w-0 flex-1'>
                    <p className='text-sm font-semibold text-ui-text'>{busy ? 'Queued for isolated capacity' : 'Sandbox capacity'}</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>{busy ? queueCopy(capacity) : `${active}/${max} browser slots are active. Overflow runs queue instead of failing silently.`}</p>
                </div>
                <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted'>
                    {position ? `#${position}` : `${active}/${max}`}
                </span>
            </div>
            <div className='mt-3 h-1.5 overflow-hidden rounded-full bg-ui-raised'>
                <div className={`h-full ${busy ? 'bg-ui-warning' : 'bg-ui-primary'}`} style={{ width: `${Math.min(100, Math.round((active / Math.max(1, max)) * 100))}%` }} />
            </div>
            {queued ? <p className='mt-2 text-xs text-ui-muted'>{queued} queued run{queued === 1 ? '' : 's'} waiting for a browser slot.</p> : null}
        </section>
    )
}

function AnalystSummary({ summary, captures }: { summary: ReturnType<typeof buildAnalystSummary>; captures: Capture[] }) {
    const metadataItems = metadataRows(summary, captures)
    return (
        <section className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <h2 className='text-sm font-semibold uppercase text-ui-primary'>SOC analyst summary</h2>
                    <p className='mt-2 wrap-break-word text-sm leading-6 text-ui-text'>{summary.narrative}</p>
                </div>
                <button
                    type='button'
                    onClick={() => void navigator.clipboard?.writeText(summary.indicators.join('\n'))}
                    className='grid h-8 w-8 shrink-0 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary'
                    aria-label='Copy indicators'
                >
                    <Clipboard className='h-4 w-4' />
                </button>
            </div>
            <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                        <p className='text-xs font-semibold uppercase text-ui-primary'>Analyst brief</p>
                        <h3 className='mt-1 text-base font-semibold text-ui-text'>{summary.brief.verdict}</h3>
                    </div>
                    <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted'>{summary.brief.confidence}</span>
                </div>
                <div className='mt-3 grid gap-2 md:grid-cols-2'>
                    <div className='rounded-md border border-ui-border bg-ui-panel p-2'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Impact</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-text'>{summary.brief.impact}</p>
                    </div>
                    <div className='rounded-md border border-ui-border bg-ui-panel p-2'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Recommended action</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-text'>{summary.brief.recommendedAction}</p>
                    </div>
                    <div className='rounded-md border border-ui-border bg-ui-panel p-2'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Freshness</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-text'>{summary.brief.freshness}</p>
                    </div>
                    <div className='rounded-md border border-ui-border bg-ui-panel p-2'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Next steps</p>
                        <ul className='mt-1 grid gap-1 wrap-break-word text-xs leading-5 text-ui-text'>
                            {summary.brief.nextSteps.map(step => <li key={step}>{step}</li>)}
                        </ul>
                    </div>
                </div>
            </div>
            <div className='mt-3 grid gap-2 text-sm'>
                {metadataItems.map(row => (
                    <details key={row.label} className='group rounded-md border border-ui-border bg-ui-raised'>
                        <summary className='flex min-w-0 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden'>
                            <span className='text-ui-muted'>{row.label}</span>
                            <span className='min-w-0 wrap-break-word text-right font-semibold text-ui-text'>{row.value}</span>
                        </summary>
                        <div className='grid gap-2 border-t border-ui-border p-3 text-xs text-ui-muted'>
                            {row.details.map(detail => <p key={detail} className='wrap-break-word leading-5'>{detail}</p>)}
                            {row.captures.slice(0, 3).map(capture => (
                                <div key={capture.id} className='grid gap-2 rounded-md border border-ui-border bg-ui-panel p-2'>
                                    <p className='truncate font-mono text-ui-text'>{capture.url}</p>
                                    {cleanEvidenceExcerpt(capture.evidence?.textExcerpt) ? <p className='line-clamp-3 leading-5'>{cleanEvidenceExcerpt(capture.evidence?.textExcerpt)}</p> : null}
                                    {capture.image ? <img src={capture.image} alt={`${capture.label} screenshot`} className='max-h-44 w-full rounded border border-ui-border object-contain' /> : null}
                                </div>
                            ))}
                        </div>
                    </details>
                ))}
            </div>
            {summary.indicators.length ? (
                <pre className='mt-3 max-h-32 overflow-auto rounded-md border border-ui-border bg-ui-canvas p-3 text-xs text-ui-text'>{summary.indicators.join('\n')}</pre>
            ) : null}
            {summary.threatAssociations.length ? (
                <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>Threat context</p>
                    <div className='mt-2 grid gap-2'>
                        {summary.threatAssociations.slice(0, 6).map(item => (
                            <div key={`${item.name}-${item.source}`} className='grid gap-1 rounded-md border border-ui-border bg-ui-panel p-2 text-xs'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='font-semibold text-ui-text'>{item.name}</span>
                                    <span className='rounded border border-ui-border px-1.5 py-0.5 text-[10px] uppercase text-ui-muted'>{item.category || 'context'}</span>
                                    <span className='text-ui-muted'>{item.confidence || 'low'} confidence · {item.source?.replace(/_/g, ' ') || 'evidence'}</span>
                                </div>
                                {item.evidence ? <p className='line-clamp-2 text-ui-muted'>{item.evidence}</p> : null}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            {summary.urlTimeline.length ? (
                <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>URL timeline</p>
                    <div className='mt-2 grid gap-1 text-xs text-ui-muted'>
                        {summary.urlTimeline.slice(0, 8).map(item => (
                            <div key={`${item.capturedAt}-${item.url}`} className='grid gap-1 rounded-md border border-ui-border bg-ui-panel p-2'>
                                <span>{item.capturedAt}{item.reason ? ` · ${item.reason}` : ''}</span>
                                <span className='truncate font-mono text-ui-text'>{item.url}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            {summary.deobfuscationTasks.length ? (
                <div className='mt-3 rounded-md border border-ui-warning/30 bg-ui-warning/10 p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-warning'>WebCrack analysis</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>{summary.deobfuscationTasks.length} script sample{summary.deobfuscationTasks.length === 1 ? '' : 's'} extracted. {summary.webcrackLoaded ? `WebCrack loaded ${summary.webcrackLoaded} sample${summary.webcrackLoaded === 1 ? '' : 's'} for deobfuscation.` : 'WebCrack did not accept an extracted sample yet.'} {summary.deobfuscationSummary}</p>
                </div>
            ) : null}
        </section>
    )
}

function EvidenceWorkspace({
    captures,
    profile,
    target,
    summary,
    events,
    consoleEvents,
}: {
    captures: Capture[]
    profile: SandboxProfile
    target: string
    summary: ReturnType<typeof buildAnalystSummary>
    events: string[]
    consoleEvents: string[]
}) {
    const pageCaptures = captures.filter(capture => capture.kind === 'page')
    const toolCaptures = captures.filter(capture => capture.kind === 'tool')
    const latestPage = pageCaptures[0]
    const latestNetwork = pageCaptures.find(capture => capture.networkSummary)?.networkSummary
    const scriptHashCount = new Set(pageCaptures.flatMap(capture => [
        ...(capture.evidence?.scripts || []).map(script => script.sha256),
        ...(capture.evidence?.deobfuscationTasks || []).map(task => task.sha256),
    ]).filter(Boolean)).size

    return (
        <section className='min-h-0 min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
            <div className='border-b border-ui-border px-4 py-3'>
                <h2 className='text-sm font-semibold uppercase text-ui-primary'>Evidence workspace</h2>
                <p className='mt-1 text-xs text-ui-muted'>Source-attributed capture, provider, network, script, and indicator status.</p>
            </div>
            <div className='grid max-h-[42rem] gap-3 overflow-auto p-3'>
                <EvidencePanel title='Browser capture' status={latestPage ? 'Captured' : 'Awaiting frame'}>
                    {latestPage ? (
                        <div className='grid gap-2 text-xs text-ui-muted'>
                            <p className='break-all font-mono text-ui-text'>{latestPage.url}</p>
                            <p>{latestPage.capturedAt}{latestPage.reason ? ` · ${latestPage.reason}` : ''}{latestPage.title ? ` · ${latestPage.title}` : ''}</p>
                            {cleanEvidenceExcerpt(latestPage.evidence?.textExcerpt) ? <p className='leading-5'>{cleanEvidenceExcerpt(latestPage.evidence?.textExcerpt)}</p> : null}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No browser screenshot has arrived. The run is not treated as successful until a frame, provider result, or explicit failure is visible here.</p>
                    )}
                </EvidencePanel>

                <EvidencePanel title='Run evidence summary' status={latestPage ? 'Ready for review' : 'Waiting'}>
                    <div className='grid gap-2 text-xs text-ui-muted sm:grid-cols-2'>
                        <EvidenceFact label='Final URL' value={summary.urlTimeline.at(-1)?.url || latestPage?.url || 'unknown'} mono />
                        <EvidenceFact label='URL states' value={String(summary.urlTimeline.length || pageCaptures.length || 0)} />
                        <EvidenceFact label='Redirects' value={String(latestNetwork?.redirectChain?.length || 0)} />
                        <EvidenceFact label='Contacted domains' value={latestNetwork?.domains?.slice(0, 4).join('  ') || 'none yet'} mono />
                        <EvidenceFact label='DNS / IP / certificate peers' value={String(networkPeerSummary(latestNetwork).length)} />
                        <EvidenceFact label='Network requests' value={String(latestNetwork?.requestCount || 0)} />
                        <EvidenceFact label='Hashed downloads' value={String(latestNetwork?.downloads?.filter(download => download.sha256).length || 0)} />
                        <EvidenceFact label='Script hashes' value={String(scriptHashCount)} />
                        <EvidenceFact label='Provider captures' value={`${toolCaptures.length}/${profile.tools.length}`} />
                        <EvidenceFact label='Copyable indicators' value={String(summary.indicators.length)} />
                    </div>
                </EvidencePanel>

                <EvidencePanel title='Analyst review list' status={`${summary.reviewQueue.length} item${summary.reviewQueue.length === 1 ? '' : 's'}`}>
                    {summary.reviewQueue.length ? (
                        <div className='grid gap-2 text-xs text-ui-muted'>
                            {summary.reviewQueue.map(item => (
                                <div key={`${item.source}-${item.title}-${item.evidence || item.detail}`} className='grid gap-1 rounded-md border border-ui-border bg-ui-panel p-2'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${item.severity === 'high' ? 'border-ui-danger/40 text-ui-danger' : item.severity === 'medium' ? 'border-ui-warning/40 text-ui-warning' : 'border-ui-border text-ui-muted'}`}>{item.severity}</span>
                                        <span className='font-semibold text-ui-text'>{item.title}</span>
                                        <span className='text-ui-muted'>{item.source}</span>
                                    </div>
                                    <p className='leading-5'>{item.detail}</p>
                                    {item.evidence ? <p className='truncate font-mono text-[11px] text-ui-text'>{item.evidence}</p> : null}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No priority review items from the captured evidence.</p>
                    )}
                </EvidencePanel>

                <div className='grid gap-3 md:grid-cols-3'>
                    {profile.tools.map(tool => {
                        const capture = selectToolCapture(toolCaptures, tool, target)
                        const analysis = capture?.toolAnalysis
                        return (
                            <EvidencePanel key={tool.id} title={tool.name} status={providerStatus(capture, analysis)}>
                                {capture ? (
                                    <ProviderReportDetails tool={tool} capture={capture} compact />
                                ) : (
                                    <p className='text-xs leading-5 text-ui-muted'>Provider unavailable: this profile tool has not returned a capture or parsed result for this run.</p>
                                )}
                            </EvidencePanel>
                        )
                    })}
                </div>

                <EvidencePanel title='WebCrack / decoded scripts' status={summary.webcrackLoaded ? 'Sample loaded' : 'No decoded result'}>
                    {summary.deobfuscationTasks.length ? (
                        <div className='grid gap-2 text-xs text-ui-muted'>
                            {summary.deobfuscationTasks.slice(0, 4).map(task => (
                                <div key={`${task.scriptId}-${task.source}`} className='rounded-md border border-ui-border bg-ui-panel p-2'>
                                    <p className='font-semibold text-ui-text'>{task.scriptId || 'script sample'} · {task.assessment || 'review required'}</p>
                                    {task.sha256 ? <p className='mt-1 break-all font-mono text-[11px] text-ui-text'>sha256 {task.sha256}</p> : null}
                                    <p className='mt-1 leading-5'>{task.summary || task.decodedPreview || 'Decoded summary unavailable.'}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No obfuscated script sample was loaded into WebCrack for this run.</p>
                    )}
                </EvidencePanel>

                <EvidencePanel title='Network / requests' status={latestNetwork ? 'Captured' : 'No network summary'}>
                    {latestNetwork ? (
                        <div className='grid gap-2 text-xs text-ui-muted'>
                            <p>{latestNetwork.requestCount || 0} requests · {latestNetwork.responseCount || 0} responses · {latestNetwork.failedCount || 0} blocked/failed</p>
                            {latestNetwork.domains?.length ? <p className='break-all font-mono text-ui-text'>{latestNetwork.domains.slice(0, 8).join('\n')}</p> : null}
                            {latestNetwork.redirectChain?.length ? <pre className='max-h-20 overflow-auto whitespace-pre-wrap rounded-md border border-ui-border bg-ui-panel p-2 font-mono text-[11px] text-ui-text'>Redirects:{'\n'}{latestNetwork.redirectChain.join('\n')}</pre> : null}
                            {latestNetwork.downloads?.length ? <pre className='max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-ui-border bg-ui-panel p-2 font-mono text-[11px] text-ui-text'>Downloads:{'\n'}{latestNetwork.downloads.map(downloadEvidenceLine).filter(Boolean).join('\n\n')}</pre> : null}
                            {latestNetwork.recentRequests?.length ? (
                                <div className='max-h-56 overflow-auto rounded-md border border-ui-border'>
                                    <table className='w-full min-w-[48rem] border-collapse text-left text-[11px]'>
                                        <thead className='sticky top-0 bg-ui-raised text-ui-muted'>
                                            <tr>
                                                <th className='border-b border-ui-border px-2 py-1'>Method</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Status</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Host</th>
                                                <th className='border-b border-ui-border px-2 py-1'>MIME</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Time</th>
                                                <th className='border-b border-ui-border px-2 py-1'>DNS / ASN / TLS</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Initiator</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Block reason</th>
                                                <th className='border-b border-ui-border px-2 py-1'>URL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {latestNetwork.recentRequests.slice(-30).map((request, index) => (
                                                <tr key={`${request.at}-${request.url}-${index}`}>
                                                    <td className='border-b border-ui-border/60 px-2 py-1'>{request.method || 'GET'}{request.resourceType ? ` · ${request.resourceType}` : ''}</td>
                                                    <td className='border-b border-ui-border/60 px-2 py-1'>{request.status || request.failure || ''}</td>
                                                    <td className='max-w-36 truncate border-b border-ui-border/60 px-2 py-1 font-mono text-ui-muted'>{request.host || ''}</td>
                                                    <td className='max-w-36 truncate border-b border-ui-border/60 px-2 py-1'>{request.mimeType || ''}</td>
                                                    <td className='border-b border-ui-border/60 px-2 py-1'>{request.durationMs !== undefined ? `${request.durationMs}ms` : ''}</td>
                                                    <td className='border-b border-ui-border/60 px-2 py-1 font-mono text-ui-muted'>{networkPeerLabel(request)}</td>
                                                    <td className='max-w-48 truncate border-b border-ui-border/60 px-2 py-1 font-mono text-ui-muted'>{request.initiator || ''}</td>
                                                    <td className='max-w-48 truncate border-b border-ui-border/60 px-2 py-1 text-ui-danger'>{request.failure || ''}</td>
                                                    <td className='max-w-[28rem] truncate border-b border-ui-border/60 px-2 py-1 font-mono text-ui-text'>{request.url}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No request summary has been emitted by the browser broker yet.</p>
                    )}
                </EvidencePanel>

                <EvidencePanel title='Page captures' status={`${pageCaptures.length} frame${pageCaptures.length === 1 ? '' : 's'}`}>
                    {pageCaptures.length ? (
                        <div className='grid gap-2 text-xs text-ui-muted'>
                            {pageCaptures.slice(0, 6).map(capture => (
                                <div key={capture.id} className='grid gap-2 rounded-md border border-ui-border bg-ui-panel p-2'>
                                    <p>{capture.capturedAt}{capture.reason ? ` · ${capture.reason}` : ''}</p>
                                    <p className='truncate font-mono text-ui-text'>{capture.url}</p>
                                    <SourceCodeDisclosure evidence={capture.evidence} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No page capture available yet.</p>
                    )}
                </EvidencePanel>

                <EvidencePanel title='Activity' status={`${events.length} event${events.length === 1 ? '' : 's'}`}>
                    <div className='grid gap-1 text-xs text-ui-muted'>
                        {events.slice(0, 6).map(event => <p key={event} className='wrap-break-word'>{event}</p>)}
                    </div>
                </EvidencePanel>

                <EvidencePanel title='Console logs' status={`${consoleEvents.length} log${consoleEvents.length === 1 ? '' : 's'}`}>
                    {consoleEvents.length ? (
                        <div className='grid gap-1 text-xs text-ui-muted'>
                            {consoleEvents.slice(0, 10).map((event, index) => <p key={`${index}-${event}`} className='wrap-break-word font-mono'>{event}</p>)}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No console output was emitted by the inspected page.</p>
                    )}
                </EvidencePanel>

                <EvidencePanel title='Indicators' status={`${summary.indicators.length} copied-ready`}>
                    {summary.indicators.length ? (
                        <pre className='max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-ui-border bg-ui-canvas p-2 text-xs text-ui-text'>{summary.indicators.join('\n')}</pre>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No domains, IPs, or URLs beyond the submitted target have been extracted.</p>
                    )}
                </EvidencePanel>
            </div>
        </section>
    )
}

function EvidencePanel({ title, status, children }: { title: string; status: string; children: ReactNode }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-raised p-3'>
            <div className='mb-2 flex items-start justify-between gap-2'>
                <h3 className='text-xs font-semibold uppercase text-ui-primary'>{title}</h3>
                <span className='rounded border border-ui-border bg-ui-panel px-1.5 py-0.5 text-[10px] font-semibold text-ui-muted'>{status}</span>
            </div>
            {children}
        </div>
    )
}

function QuickTriageStrip({ summary, toolCaptures, toolCount }: { summary: ReturnType<typeof buildAnalystSummary>; toolCaptures: Capture[]; toolCount: number }) {
    const latestNetwork = summary.latestNetwork
    const finalUrl = summary.urlTimeline.at(-1)?.url || 'unknown'
    const parsedProviders = new Set(toolCaptures.filter(capture => hasParsedProviderResult(capture.toolAnalysis) && capture.error !== 'provider_navigation_pending').map(capture => capture.toolAnalysis?.toolKind || capture.label)).size
    return (
        <section className='grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-3 text-xs text-ui-muted md:grid-cols-3 xl:grid-cols-6'>
            <EvidenceFact label='Final URL' value={finalUrl} mono />
            <EvidenceFact label='Redirects' value={String(latestNetwork?.redirectChain?.length || 0)} />
            <EvidenceFact label='Contacted domains' value={latestNetwork?.domains?.slice(0, 3).join('  ') || 'none yet'} mono />
            <EvidenceFact label='Requests' value={String(latestNetwork?.requestCount || 0)} />
            <EvidenceFact label='Providers' value={`${parsedProviders}/${toolCount}`} />
            <EvidenceFact label='Review items' value={String(summary.reviewQueue.length)} />
        </section>
    )
}

function RunOutcomeCard({ summary, captures, sessionState }: { summary: ReturnType<typeof buildAnalystSummary>; captures: Capture[]; sessionState: SessionState }) {
    if (!captures.length && sessionState !== 'failed') return null
    const pageCaptures = captures.filter(capture => capture.kind === 'page').length
    const vt = summary.rows.find(row => row.label === 'VirusTotal vendors')?.value || 'unknown'
    const urlquery = summary.rows.find(row => row.label === 'urlquery alerts')?.value || 'unknown'
    const domains = summary.latestNetwork?.uniqueDomainCount ?? summary.latestNetwork?.domains?.length ?? 0
    const requests = summary.latestNetwork?.requestCount ?? 0
    return (
        <section className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 md:grid-cols-[minmax(0,1fr)_auto]'>
            <div className='min-w-0'>
                <p className='text-xs font-semibold uppercase text-ui-primary'>Investigation result</p>
                <h2 className='mt-1 text-lg font-semibold text-ui-text'>{sessionState === 'failed' && !pageCaptures ? 'Run failed before browser evidence was captured' : summary.brief.verdict}</h2>
                <p className='mt-1 text-sm leading-6 text-ui-muted'>{sessionState === 'failed' && !pageCaptures ? 'No browser frame, provider verdict, or network evidence was available for this run.' : summary.brief.impact}</p>
            </div>
            <div className='grid grid-cols-2 gap-2 text-xs text-ui-muted sm:grid-cols-4 md:min-w-[26rem]'>
                <EvidenceFact label='VT' value={vt} />
                <EvidenceFact label='urlquery' value={urlquery} />
                <EvidenceFact label='Domains' value={String(domains)} />
                <EvidenceFact label='Requests' value={String(requests)} />
            </div>
        </section>
    )
}

function EvidenceFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className={`mt-1 truncate font-semibold text-ui-text ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</p>
        </div>
    )
}

function SourceCodeDisclosure({ evidence }: { evidence?: SandboxEvidence }) {
    if (!evidence?.sourceCode && !evidence?.sourceUrls?.length) return null
    return (
        <details open className='rounded-md border border-ui-border bg-ui-canvas'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-2 py-1.5 text-xs font-semibold text-ui-primary [&::-webkit-details-marker]:hidden'>
                <span>Source code</span>
                <span className='text-[10px] text-ui-muted'>{evidence.sourceUrls?.length || 0} source URL{evidence.sourceUrls?.length === 1 ? '' : 's'}</span>
            </summary>
            <div className='grid gap-2 border-t border-ui-border p-2'>
                {evidence.sourceUrls?.length ? (
                    <div className='grid gap-1'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Source URLs</p>
                        <pre className='max-h-24 overflow-auto whitespace-pre-wrap break-all rounded border border-ui-border bg-ui-panel p-2 text-[11px] text-ui-text'>{evidence.sourceUrls.join('\n')}</pre>
                    </div>
                ) : null}
                {evidence.sourceCode ? (
                    <pre className='max-h-56 overflow-auto whitespace-pre-wrap break-all rounded border border-ui-border bg-ui-panel p-2 font-mono text-[11px] leading-5 text-ui-muted'>{evidence.sourceCode}</pre>
                ) : null}
            </div>
        </details>
    )
}

function metadataRows(summary: ReturnType<typeof buildAnalystSummary>, captures: Capture[]) {
    const pageCaptures = captures.filter(capture => capture.kind === 'page')
    const toolCaptures = captures.filter(capture => capture.kind === 'tool')
    return summary.rows.flatMap(row => {
        if (/^(unknown|none extracted)$/i.test(row.value)) return []
        const lower = row.label.toLowerCase()
        const numericValue = Number(row.value.replace(/[^\d.-]/g, ''))
        const isZeroValue = Number.isFinite(numericValue) && numericValue === 0
        const isNoValue = /^(no|false)$/i.test(row.value)
        if ((isZeroValue || isNoValue) && !lower.includes('blocked') && !lower.includes('profile tools')) return []
        const related = lower.includes('page') || lower.includes('network') || lower.includes('domain') || lower.includes('failed') || lower.includes('url states')
            ? pageCaptures
            : lower.includes('virustotal')
                ? toolCaptures.filter(capture => capture.toolAnalysis?.toolKind === 'virustotal')
                : lower.includes('urlquery')
                    ? toolCaptures.filter(capture => capture.toolAnalysis?.toolKind === 'urlquery')
                    : lower.includes('webcrack') || lower.includes('obfuscated')
                        ? captures.filter(capture => capture.webcrackLoad || capture.evidence?.deobfuscationTasks?.length || capture.evidence?.obfuscatedScripts?.length)
                        : lower.includes('profile tools')
                            ? toolCaptures
                            : captures
        if (!related.length && row.value === '0') return []
        return [{
            ...row,
            captures: related,
            details: metadataDetails(row.label, row.value, related),
        }]
    })
}

function metadataDetails(label: string, value: string, captures: Capture[]) {
    const lines = [
        `${label}: ${value}`,
        ...captures.flatMap(capture => [
            capture.toolAnalysis?.extractedSignals?.join(' · ') || '',
            capture.networkSummary ? `${capture.networkSummary.requestCount || 0} requests, ${capture.networkSummary.uniqueDomainCount || 0} domains, ${capture.networkSummary.failedCount || 0} blocked/failed.` : '',
            capture.evidence?.reasons?.join(' · ') || '',
        ]),
    ].map(line => line.trim()).filter(Boolean)
    return Array.from(new Set(lines)).slice(0, 6)
}

function CaptureTimeline({ captures }: { captures: Capture[] }) {
    return (
        <section className='min-h-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
            <div className='border-b border-ui-border px-4 py-3'>
                <h2 className='text-sm font-semibold uppercase text-ui-primary'>Screenshot timeline</h2>
                <p className='mt-1 text-xs text-ui-muted'>{captures.length} captures with URL state.</p>
            </div>
            <div className='grid max-h-[34rem] gap-3 overflow-auto p-3'>
                {captures.length ? captures.map(capture => (
                    <article key={capture.id} className='grid gap-2 rounded-md border border-ui-border bg-ui-raised p-3'>
                        <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                                <p className='text-sm font-semibold text-ui-text'>{capture.label}</p>
                                <p className='mt-1 truncate font-mono text-xs text-ui-muted'>{capture.url || providerErrorText(capture.error)}</p>
                            </div>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted'>{capture.kind}</span>
                        </div>
                        {capture.image ? <img src={capture.image} alt={`${capture.label} screenshot`} className='max-h-64 w-full rounded border border-ui-border object-contain' /> : null}
                        {capture.frameQuality ? <p className={`text-[11px] font-semibold ${capture.frameQuality.looksBlank ? 'text-ui-danger' : 'text-ui-success'}`}>{capture.frameQuality.looksBlank ? 'Blank-looking frame' : 'Rendered frame'} · {capture.frameQuality.visibleTextLength || 0} chars · {capture.frameQuality.elementCount || 0} elements</p> : null}
                        <SourceCodeDisclosure evidence={capture.evidence} />
                        {cleanEvidenceExcerpt(capture.evidence?.textExcerpt) ? <p className='line-clamp-3 text-xs leading-5 text-ui-muted'>{cleanEvidenceExcerpt(capture.evidence?.textExcerpt)}</p> : null}
                        {capture.networkSummary ? (
                            <div className='grid gap-1 rounded-md border border-ui-border bg-ui-panel p-2 text-[11px] text-ui-muted'>
                                <p>{capture.networkSummary.requestCount || 0} requests · {capture.networkSummary.uniqueDomainCount || 0} domains · {capture.networkSummary.failedCount || 0} blocked/failed</p>
                                {capture.networkSummary.domains?.length ? <p className='truncate font-mono'>{capture.networkSummary.domains.slice(0, 4).join('  ')}</p> : null}
                            </div>
                        ) : null}
                        {capture.webcrackLoad ? (
                            <div className='grid gap-1 rounded-md border border-ui-warning/30 bg-ui-warning/10 p-2 text-[11px] text-ui-muted'>
                                <p>{capture.webcrackLoad.loaded ? 'WebCrack sample loaded' : 'WebCrack sample not loaded'}{capture.webcrackLoad.scriptId ? ` · ${capture.webcrackLoad.scriptId}` : ''}</p>
                                {capture.webcrackLoad.sampleBytes ? <p>{capture.webcrackLoad.sampleBytes} bytes inserted for deobfuscation.</p> : null}
                                {capture.webcrackLoad.reason ? <p>{capture.webcrackLoad.reason}</p> : null}
                            </div>
                        ) : null}
                        {capture.evidence?.reasons?.length ? (
                            <div className='flex flex-wrap gap-1'>
                                {capture.evidence.reasons.slice(0, 4).map(reason => <span key={reason} className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted'>{reason}</span>)}
                            </div>
                        ) : null}
                        <p className='text-xs text-ui-muted'>{capture.capturedAt}{capture.title ? ` · ${capture.title}` : ''}</p>
                    </article>
                )) : (
                    <div className='rounded-md border border-dashed border-ui-border p-6 text-center text-sm text-ui-muted'>No captures yet.</div>
                )}
            </div>
        </section>
    )
}

function StatusPill({ label, value, good }: { label: string; value: string; good: boolean }) {
    return <span className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${good ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : 'border-ui-border bg-ui-panel text-ui-text'}`}><span className='text-ui-muted'>{label}</span>{value}</span>
}

function ProviderViewportEvidence({ tool, capture }: { tool: SandboxTool; capture: Capture }) {
    if (capture.image) {
        return (
            <div className='h-full w-full min-w-0 overflow-auto bg-ui-canvas'>
                <img src={capture.image} alt={`${tool.name} provider screenshot`} className='block w-full min-w-0 bg-white' />
                <div className='border-t border-ui-border bg-ui-panel/95 p-3'>
                    <ProviderReportDetails tool={tool} capture={capture} compact />
                </div>
            </div>
        )
    }
    return (
        <div className='grid h-full w-full overflow-auto p-4'>
            <ProviderReportDetails tool={tool} capture={capture} />
        </div>
    )
}

function ProviderReportDetails({ tool, capture, compact = false }: { tool: SandboxTool; capture: Capture; compact?: boolean }) {
    const analysis = capture.toolAnalysis
    const commentCount = analysis?.communityCommentCount
    const facts = [
        analysis?.vendorFlagged !== undefined ? ['Vendors', virusTotalVendorLabel(analysis)] : undefined,
        analysis?.alertCount !== undefined ? ['urlquery alerts', String(analysis.alertCount)] : undefined,
        commentCount !== undefined ? [commentCount === 1 ? 'Comment' : 'Comments', String(commentCount)] : undefined,
        analysis?.verdict && analysis.verdict !== 'unknown' ? ['Verdict', analysis.verdict] : undefined,
        capture.image ? ['Screenshot', 'captured'] : undefined,
        capture.error && capture.error !== 'provider_navigation_pending' ? `Error: ${providerErrorText(capture.error)}` : '',
    ].filter(Boolean) as Array<string | [string, string]>
    return (
        <div className={`grid w-full content-start gap-3 text-left ${compact ? 'text-xs' : 'rounded-md border border-ui-border bg-ui-panel p-4 shadow-sm'}`}>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>{providerStatus(capture, analysis)}</p>
                    <h2 className={`${compact ? 'text-sm' : 'text-lg'} mt-1 font-semibold text-ui-text`}>{tool.name}</h2>
                    <a href={capture.url || tool.url} target='_blank' rel='noreferrer noopener' className='mt-1 block break-all font-mono text-xs text-ui-primary underline-offset-2 hover:underline'>{capture.url || tool.url}</a>
                </div>
                {facts.length ? (
                    <div className='flex max-w-full flex-wrap justify-end gap-2'>
                        {facts.map((fact) => Array.isArray(fact)
                            ? <div key={fact[0]} className='min-w-24 rounded-md border border-ui-border bg-ui-canvas px-2 py-1.5'><p className='text-[10px] font-semibold uppercase text-ui-muted'>{fact[0]}</p><p className='mt-0.5 font-semibold text-ui-text'>{fact[1]}</p></div>
                            : <p key={fact} className='text-ui-danger'>{fact}</p>)}
                    </div>
                ) : null}
            </div>
            {capture.image && !compact ? <img src={capture.image} alt={`${tool.name} provider screenshot`} className='max-h-[32rem] w-full rounded border border-ui-border bg-ui-canvas object-contain' /> : null}
            {!facts.length ? <p className='text-sm text-ui-muted'>{providerDetail(analysis, capture)}</p> : null}
            {analysis?.communitySummary ? <p className='text-xs leading-5 text-ui-muted'>{analysis.communitySummary}</p> : null}
            {analysis?.threatAssociations?.length ? (
                <div className='flex flex-wrap gap-1'>
                    {analysis.threatAssociations.slice(0, 4).map(item => <span key={`${item.name}-${item.source}`} className='rounded-md border border-ui-warning/30 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning'>{item.name} · {item.confidence || 'low'}</span>)}
                </div>
            ) : null}
            {analysis?.extractedSignals?.length ? <pre className={`${compact ? 'max-h-24' : 'max-h-40'} overflow-auto whitespace-pre-wrap rounded-md border border-ui-border bg-ui-canvas p-2 font-mono text-xs text-ui-text`}>{analysis.extractedSignals.slice(0, compact ? 6 : 16).join('\n')}</pre> : null}
        </div>
    )
}

function sessionStateLabel(state: SessionState) {
    if (state === 'queued') return 'queued'
    if (state === 'connecting') return 'starting'
    if (state === 'live') return 'running'
    if (state === 'ended') return 'complete'
    if (state === 'failed') return 'failed'
    return 'ready'
}

function socketStateLabel(state: SocketState) {
    if (state === 'open') return 'connected'
    if (state === 'connecting') return 'connecting'
    if (state === 'error') return 'failed'
    return 'closed'
}

function addCapture(current: Capture[], next: Capture) {
    if (current.some(capture => capture.id === next.id)) return current.map(capture => capture.id === next.id ? next : capture)
    const last = current[0]
    if (last && last.kind === next.kind && last.url === next.url && last.image === next.image) return current
    return [next, ...current].slice(0, 24)
}

function providerRunResult(analysis?: SandboxToolAnalysis, error = ''): ProviderRunResult | null {
    if (!analysis?.toolKind) return null
    if (analysis.toolKind === 'virustotal') {
        const flagged = analysis.vendorFlagged || 0
        return { status: flagged > 0 ? 'suspicious' : error ? 'blocked' : 'clean', label: `${virusTotalVendorLabel(analysis)} VT` }
    }
    if (analysis.toolKind === 'urlquery') {
        const alerts = analysis.alertCount || 0
        return { status: alerts > 0 ? 'suspicious' : error ? 'blocked' : 'clean', label: alerts > 0 ? `${alerts}` : 'urlquery' }
    }
    return null
}

function isDegradedNavigationError(message = '') {
    return /timeout|net::err_(?:connection_timed_out|timed_out|name_not_resolved|connection_refused|address_unreachable)/i.test(message)
}

function cleanConsoleEvent(value: string) {
    return value.replace(/^Remote console:\s*/i, '').trim() || 'Console event.'
}

function captureLabel(reason: string) {
    if (reason === 'navigation') return 'Navigation capture'
    if (reason === 'domcontentloaded') return 'DOM-ready capture'
    if (reason === 'load') return 'Loaded-page capture'
    if (reason === 'initial_target') return 'Initial target capture'
    if (reason === 'interval') return 'Interval capture'
    return 'Page capture'
}

function networkPeerLabel(request: NonNullable<SandboxNetworkSummary['recentRequests']>[number]) {
    return [
        request.ip ? `${request.ip}${request.port ? `:${request.port}` : ''}` : '',
        request.asn ? `AS${request.asn}` : '',
        request.protocol || '',
        request.tlsSubject ? `cert ${request.tlsSubject}` : '',
        request.tlsIssuer || '',
        request.tlsValidTo ? `expires ${formatEpochDate(request.tlsValidTo)}` : '',
    ].filter(Boolean).join(' · ')
}

function formatEpochDate(value: number) {
    return new Date(value * 1000).toISOString().slice(0, 10)
}

function downloadEvidenceLine(item: NonNullable<SandboxNetworkSummary['downloads']>[number]) {
    return [
        item.fileName || item.url || 'download',
        item.bytes !== undefined ? `${item.bytes} bytes` : '',
        item.sha256 ? `sha256 ${item.sha256}` : item.hashStatus || '',
        item.url && item.fileName ? item.url : '',
    ].filter(Boolean).join('\n')
}

function buildExportReport(input: {
    target: string
    activeUrl: string
    sessionState: SessionState
    socketState: SocketState
    profile: SandboxProfile
    summary: ReturnType<typeof buildAnalystSummary>
    captures: Capture[]
    events: string[]
    consoleEvents: string[]
    capacity: SandboxCapacity | null
}) {
    return {
        exportedAt: new Date().toISOString(),
        target: input.target,
        finalUrl: input.activeUrl || input.summary.urlTimeline[0]?.url || input.target,
        status: {
            run: input.sessionState,
            connection: input.socketState,
            capacity: input.capacity,
        },
        profile: input.profile,
        analystSummary: {
            narrative: input.summary.narrative,
            brief: input.summary.brief,
            rows: input.summary.rows,
            indicators: input.summary.indicators,
            threatAssociations: input.summary.threatAssociations,
            urlTimeline: input.summary.urlTimeline,
            reviewQueue: input.summary.reviewQueue,
        },
        analystReport: buildShareableAnalystReport(input),
        captures: input.captures.map(capture => ({
            kind: capture.kind,
            label: capture.label,
            url: capture.url,
            title: capture.title,
            capturedAt: capture.capturedAt,
            reason: capture.reason,
            error: providerErrorText(capture.error),
            image: capture.image,
            frameQuality: capture.frameQuality,
            evidence: capture.evidence,
            networkSummary: capture.networkSummary,
            toolAnalysis: capture.toolAnalysis,
            webcrackLoad: capture.webcrackLoad,
        })),
        activityEvents: input.events,
        consoleEvents: input.consoleEvents,
        events: input.events,
    }
}

function buildShareableAnalystReport(input: Parameters<typeof buildExportReport>[0]) {
    const pageCaptures = input.captures.filter(capture => capture.kind === 'page')
    const toolCaptures = input.captures.filter(capture => capture.kind === 'tool')
    const latestNetwork = pageCaptures.find(capture => capture.networkSummary)?.networkSummary
    const providerReports = input.profile.tools.map(tool => {
        const capture = selectToolCapture(toolCaptures, tool, input.target)
        const analysis = capture?.toolAnalysis
        return {
            tool: tool.name,
            status: providerStatus(capture, analysis),
            url: capture?.url || resolveToolUrl(tool.url, input.activeUrl || input.target),
            verdict: analysis?.verdict && analysis.verdict !== 'unknown' ? analysis.verdict : undefined,
            vendorFlagged: analysis?.vendorFlagged,
            vendorTotal: analysis?.vendorTotal,
            alertCount: analysis?.alertCount,
            communityCommentCount: analysis?.communityCommentCount,
            communitySummary: analysis?.communitySummary,
            screenshotCaptured: Boolean(capture?.image),
            signals: analysis?.extractedSignals || [],
            threatAssociations: analysis?.threatAssociations || [],
            error: providerErrorText(capture?.error),
        }
    })
    const scriptArtifacts = [
        ...pageCaptures.flatMap(capture => capture.evidence?.scripts || []).map(script => ({
            scriptId: script.id,
            source: script.src || 'inline',
            sha256: script.sha256,
            assessment: (script.obfuscationScore || 0) >= 3 ? 'suspicious' : 'observed',
            summary: [
                script.inlineBytes !== undefined ? `${script.inlineBytes} inline bytes` : '',
                script.obfuscationScore !== undefined ? `obfuscation score ${script.obfuscationScore}` : '',
                ...(script.reasons || []),
            ].filter(Boolean).join(' · '),
        })),
        ...pageCaptures.flatMap(capture => capture.evidence?.deobfuscationTasks || []).map(task => ({
            scriptId: task.scriptId,
            source: task.source,
            sha256: task.sha256,
            assessment: task.assessment,
            summary: task.summary,
            indicators: task.indicators,
        })),
    ]
    const resourceUrls = Array.from(new Set(pageCaptures.flatMap(capture => capture.evidence?.sourceUrls || []))).filter(Boolean)
    const urlStates = Array.from(new Set(input.summary.urlTimeline.map(item => item.url).filter(Boolean)))
    const peerSummary = networkPeerSummary(latestNetwork)
    const scriptHashCount = new Set(scriptArtifacts.map(script => script.sha256).filter(Boolean)).size
    const report = {
        verdict: input.summary.brief.verdict,
        target: input.target,
        finalUrl: input.activeUrl || input.summary.urlTimeline[0]?.url || input.target,
        exportedAt: new Date().toISOString(),
        evidenceChecklist: {
            renderedScreenshots: pageCaptures.filter(capture => capture.image && isUsefulFrameImage(capture.image) && !capture.frameQuality?.looksBlank).length,
            providerReports: providerReports.filter(report => report.status === 'Results').length,
            networkRequests: latestNetwork?.requestCount || 0,
            contactedDomains: latestNetwork?.uniqueDomainCount || 0,
            redirectStates: input.summary.urlTimeline.length,
            downloadsHashed: latestNetwork?.downloads?.filter(download => download.sha256).length || 0,
            scriptHashes: scriptHashCount,
            copyableIndicators: input.summary.indicators.length,
        },
        providerReports,
        networkEvidence: latestNetwork ? {
            requests: latestNetwork.requestCount,
            responses: latestNetwork.responseCount,
            blockedOrFailed: latestNetwork.failedCount,
            contactedDomains: latestNetwork.domains,
            finalUrl: input.activeUrl || input.summary.urlTimeline.at(-1)?.url || input.target,
            redirectChain: latestNetwork.redirectChain,
            urlStates,
            peerSummary,
            downloads: latestNetwork.downloads,
            recentRequests: latestNetwork.recentRequests?.slice(-50),
        } : null,
        scriptArtifacts,
        resourceUrls,
        urlTimeline: input.summary.urlTimeline,
        reviewQueue: input.summary.reviewQueue,
        indicators: input.summary.indicators,
        threatAssociations: input.summary.threatAssociations,
        recommendedActions: input.summary.brief.nextSteps,
    }
    return {
        ...report,
        markdown: [
            '# Browser sandbox report',
            `Target: ${report.target}`,
            `Final URL: ${report.finalUrl}`,
            `Verdict: ${report.verdict}`,
            '',
            '## Evidence',
            ...Object.entries(report.evidenceChecklist).map(([key, value]) => `- ${key}: ${value}`),
            '',
            '## Providers',
            ...providerReports.map(provider => `- ${provider.tool}: ${provider.status}${provider.verdict ? `, verdict ${provider.verdict}` : ''}${provider.communitySummary ? `, ${provider.communitySummary}` : ''}${provider.signals.length ? `, signals ${provider.signals.slice(0, 4).join(' | ')}` : ''}${provider.error ? `, error ${provider.error}` : ''}`),
            '',
            '## Network',
            `- requests: ${latestNetwork?.requestCount || 0}`,
            `- responses: ${latestNetwork?.responseCount || 0}`,
            `- blocked/failed: ${latestNetwork?.failedCount || 0}`,
            `- final URL: ${report.finalUrl}`,
            ...urlStates.slice(0, 12).map(url => `- URL state: ${url}`),
            ...peerSummary.slice(0, 12).map(peer => `- peer: ${[peer.host, peer.ip, peer.asn ? `AS${peer.asn}` : '', peer.protocol || '', peer.tlsSubject ? `cert ${peer.tlsSubject}` : '', peer.tlsIssuer || '', peer.tlsValidTo ? `expires ${formatEpochDate(peer.tlsValidTo)}` : ''].filter(Boolean).join(', ')}`),
            ...((latestNetwork?.domains || []).slice(0, 20).map(domain => `- domain: ${domain}`)),
            ...((latestNetwork?.redirectChain || []).slice(0, 10).map(url => `- redirect: ${url}`)),
            ...((latestNetwork?.downloads || []).slice(0, 10).map(download => `- download: ${[download.fileName || download.url || 'file', download.sha256 ? `sha256 ${download.sha256}` : download.hashStatus || '', download.bytes !== undefined ? `${download.bytes} bytes` : ''].filter(Boolean).join(', ')}`)),
            '',
            '## Resource URLs',
            ...resourceUrls.slice(0, 40).map(url => `- ${url}`),
            '',
            '## Script artifacts',
            ...scriptArtifacts.slice(0, 12).map(script => `- ${script.assessment || 'script'}: ${script.scriptId || script.source || 'sample'}${script.sha256 ? `, sha256 ${script.sha256}` : ''}`),
            '',
            '## Analyst review',
            ...report.reviewQueue.slice(0, 12).map(item => `- ${item.severity || 'review'}: ${item.title || 'Evidence item'}${item.detail ? `, ${item.detail}` : ''}${item.evidence ? `, ${item.evidence}` : ''}`),
            '',
            '## Threat context',
            ...report.threatAssociations.slice(0, 12).map(item => `- ${item.name || 'Threat association'}${item.category ? `, ${item.category}` : ''}${item.confidence ? `, ${item.confidence} confidence` : ''}${item.evidence ? `, ${item.evidence}` : ''}`),
            '',
            '## Indicators',
            ...report.indicators.slice(0, 80).map(indicator => `- ${indicator}`),
            '',
            '## Recommended actions',
            ...report.recommendedActions.map(action => `- ${action}`),
        ].join('\n'),
    }
}

function isUsefulFrameImage(image: string) {
    return image.length > 24_000
}

function networkPeerSummary(network?: SandboxNetworkSummary) {
    const peers = new Map<string, NonNullable<SandboxNetworkSummary['recentRequests']>[number]>()
    for (const request of network?.recentRequests || []) {
        if (!request.ip && !request.asn && !request.tlsSubject && !request.tlsIssuer) continue
        const key = [request.host, request.ip, request.asn, request.protocol, request.tlsSubject, request.tlsIssuer, request.tlsValidTo].filter(Boolean).join('|')
        if (!peers.has(key)) peers.set(key, request)
    }
    return Array.from(peers.values()).slice(0, 40)
}

function buildAnalystSummary(target: string, captures: Capture[], profile: SandboxProfile) {
    const pageCaptures = captures.filter(capture => capture.kind === 'page')
    const toolCaptures = captures.filter(capture => capture.kind === 'tool')
    const redirected = new Set(pageCaptures.map(capture => capture.url)).size > 1
    const extracted = extractIndicators(captures.map(capture => `${capture.url} ${capture.title || ''}`).join('\n'))
    const evidenceIndicators = captures.flatMap(capture => [
        ...(capture.evidence?.indicators?.domains || []),
        ...(capture.evidence?.indicators?.ips || []),
        ...(capture.evidence?.indicators?.urls || []),
        ...(capture.evidence?.sourceUrls || []),
    ])
    const indicators = usefulIndicators([...extracted, ...evidenceIndicators], target)
    const toolAnalyses = toolCaptures.map(capture => capture.toolAnalysis).filter(Boolean) as SandboxToolAnalysis[]
    const virusTotal = toolAnalyses.find(item => item.toolKind === 'virustotal')
    const urlquery = toolAnalyses.find(item => item.toolKind === 'urlquery')
    const suspiciousCaptures = pageCaptures.filter(capture => capture.evidence?.verdict === 'suspicious')
    const obfuscatedScripts = pageCaptures.flatMap(capture => capture.evidence?.obfuscatedScripts || [])
    const deobfuscationTasks = pageCaptures.flatMap(capture => capture.evidence?.deobfuscationTasks || [])
    const suspiciousDeobfuscationTasks = deobfuscationTasks.filter(task => task.assessment === 'suspicious')
    const webcrackLoads = captures.flatMap(capture => capture.webcrackLoad ? [capture.webcrackLoad] : [])
    const webcrackLoaded = webcrackLoads.filter(load => load.loaded).length
    const comments = captures.flatMap(capture => capture.evidence?.comments || []).map(cleanEvidenceComment).filter(Boolean).slice(0, 4) as string[]
    const confidence = Math.max(0, ...captures.map(capture => capture.evidence?.confidence || 0))
    const latestNetwork = pageCaptures.find(capture => capture.networkSummary)?.networkSummary
    const networkDomains = captures.flatMap(capture => capture.networkSummary?.domains || [])
    const failedRequests = captures.reduce((count, capture) => count + (capture.networkSummary?.failedCount || 0), 0)
    const decodedIndicators = deobfuscationTasks.flatMap(task => [
        ...(task.indicators?.domains || []),
        ...(task.indicators?.ips || []),
        ...(task.indicators?.urls || []),
    ])
    const allIndicators = usefulIndicators([...indicators, ...decodedIndicators, ...networkDomains], target)
    const deobfuscationSummary = deobfuscationTasks.find(task => task.summary)?.summary || 'No decoded malicious payload summary is available yet.'
    const capturedToolCount = profile.tools.filter(tool => toolCaptures.some(capture => matchesTool(capture, tool))).length
    const threatAssociations = dedupeThreatAssociations([
        ...captures.flatMap(capture => capture.evidence?.threatAssociations || []),
        ...toolAnalyses.flatMap(analysis => analysis.threatAssociations || []),
        ...deobfuscationTasks.flatMap(task => task.threatAssociations || []),
    ])
    const urlTimeline = pageCaptures
        .map(capture => ({
            url: capture.url || capture.evidence?.url || target,
            capturedAt: capture.capturedAt,
            reason: capture.reason || 'capture',
            title: capture.title || '',
        }))
        .filter(item => item.url)
        .reverse()
    const reviewQueue = buildReviewQueue({
        pageCaptures,
        toolCaptures,
        latestNetwork,
        urlTimeline,
        threatAssociations,
        deobfuscationTasks,
    })
    const threatNarrative = threatAssociations.length
        ? `Observed threat context in captured evidence: ${threatAssociations.slice(0, 4).map(item => `${item.name} (${item.category || 'context'}, ${item.confidence || 'low'})`).join('; ')}.`
        : 'No named actor, malware family, or tool label was extracted from the captured evidence yet.'
    const parsedToolAnalyses = toolAnalyses.filter(hasParsedProviderResult)
    const providerNarrative = parsedToolAnalyses.length
        ? `Parsed provider evidence is available from ${parsedToolAnalyses.map(item => item.toolKind || 'profile tool').join(', ')}.`
        : toolCaptures.length
            ? 'Profile tools produced captures, but no parsed provider verdict was returned.'
            : 'No external provider result has been parsed yet; provider panels show configured tools and blockers.'
    const narrative = pageCaptures.length
        ? `The sandbox loaded ${target || 'the submitted URL'} and captured ${pageCaptures.length} browser state${pageCaptures.length === 1 ? '' : 's'}${redirected ? ' across at least one URL change' : ''}. ${providerNarrative} ${suspiciousCaptures.length ? `Rendered evidence requires review: ${suspiciousCaptures.flatMap(capture => capture.evidence?.reasons || []).slice(0, 3).join('; ')}.` : 'No signs of suspicious activity were found in the captured browser evidence.'} ${threatNarrative} ${comments.length ? `Source comments observed: ${comments.join(' ')}` : 'No community comments were extracted from provider or page evidence.'}`
        : `The sandbox is preparing ${target || 'the submitted URL'}. No success verdict is shown until a browser frame, provider result, or explicit blocker is captured for profile "${profile.name}".`
    const brief = buildAnalystBrief({
        target,
        pageCaptureCount: pageCaptures.length,
        redirected,
        virusTotal,
        urlquery,
        suspiciousCaptureCount: suspiciousCaptures.length,
        suspiciousDeobfuscationCount: suspiciousDeobfuscationTasks.length,
        obfuscatedScriptCount: obfuscatedScripts.length,
        webcrackLoaded,
        threatAssociations,
        indicatorCount: allIndicators.length,
        failedRequests,
        confidence,
        latestCapturedAt: pageCaptures[0]?.capturedAt || toolCaptures[0]?.capturedAt || '',
    })

    return {
        narrative,
        brief,
        indicators: allIndicators,
        threatAssociations,
        latestNetwork,
        urlTimeline,
        reviewQueue,
        deobfuscationTasks,
        deobfuscationSummary,
        webcrackLoaded,
        rows: [
            { label: 'Page captures', value: String(pageCaptures.length) },
            { label: 'Profile tools', value: `${capturedToolCount}/${profile.tools.length}` },
            { label: 'VirusTotal vendors', value: virusTotal?.vendorFlagged !== undefined ? virusTotalVendorLabel(virusTotal) : 'unknown' },
            { label: 'urlquery alerts', value: urlquery?.alertCount !== undefined ? String(urlquery.alertCount) : 'unknown' },
            { label: 'Community comments', value: String(Math.max(virusTotal?.communityCommentCount || 0, urlquery?.communityCommentCount || 0, comments.length)) },
            { label: 'Redirect observed', value: redirected ? 'yes' : 'no' },
            { label: 'Network requests', value: latestNetwork?.requestCount !== undefined ? String(latestNetwork.requestCount) : 'unknown' },
            { label: 'Contacted domains', value: latestNetwork?.uniqueDomainCount !== undefined ? String(latestNetwork.uniqueDomainCount) : 'unknown' },
            { label: 'Blocked/failed requests', value: String(failedRequests) },
            { label: 'Suspicious captures', value: String(suspiciousCaptures.length) },
            { label: 'Threat context', value: threatAssociations.length ? threatAssociations.map(item => item.name).slice(0, 3).join(', ') : 'none extracted' },
            { label: 'URL states', value: String(urlTimeline.length) },
            { label: 'Obfuscated scripts', value: String(obfuscatedScripts.length) },
            { label: 'WebCrack loaded', value: String(webcrackLoaded) },
            { label: 'Highest confidence', value: formatConfidencePercent(confidence) || 'unknown' },
            { label: 'Copyable indicators', value: String(allIndicators.length) },
        ],
    }
}

function buildReviewQueue(input: {
    pageCaptures: Capture[]
    toolCaptures: Capture[]
    latestNetwork?: SandboxNetworkSummary
    urlTimeline: Array<{ url: string; capturedAt: string; reason: string; title: string }>
    threatAssociations: SandboxThreatAssociation[]
    deobfuscationTasks: NonNullable<SandboxEvidence['deobfuscationTasks']>
}): ReviewQueueItem[] {
    const items: ReviewQueueItem[] = []
    const hasRenderedFrame = input.pageCaptures.some(capture => capture.image && !capture.frameQuality?.looksBlank)
    const blankFrame = hasRenderedFrame ? undefined : input.pageCaptures.find(capture => capture.frameQuality?.looksBlank)
    if (blankFrame) items.push({
        severity: 'high',
        source: 'browser',
        title: 'Blank-looking rendered frame',
        detail: `${blankFrame.frameQuality?.visibleTextLength || 0} visible chars and ${blankFrame.frameQuality?.elementCount || 0} elements were observed.`,
        evidence: blankFrame.url,
    })
    input.toolCaptures.filter(capture => capture.error && capture.error !== 'provider_navigation_pending').slice(0, 2).forEach(capture => items.push({
        severity: 'medium',
        source: capture.label,
        title: 'Provider failed or blocked',
        detail: providerErrorText(capture.error) || 'Provider returned no usable evidence.',
        evidence: capture.url,
    }))
    if ((input.latestNetwork?.failedCount || 0) > 0) items.push({
        severity: 'medium',
        source: 'network',
        title: 'Blocked or failed requests',
        detail: `${input.latestNetwork?.failedCount || 0} blocked/failed request${input.latestNetwork?.failedCount === 1 ? '' : 's'} recorded.`,
        evidence: input.latestNetwork?.recentFailures?.[0]?.url || input.latestNetwork?.recentRequests?.find(request => request.failure)?.url,
    })
    if ((input.latestNetwork?.redirectChain?.length || input.urlTimeline.length) > 1) items.push({
        severity: 'medium',
        source: 'navigation',
        title: 'Redirect or URL change',
        detail: `${input.latestNetwork?.redirectChain?.length || input.urlTimeline.length} URL state${(input.latestNetwork?.redirectChain?.length || input.urlTimeline.length) === 1 ? '' : 's'} captured.`,
        evidence: input.latestNetwork?.redirectChain?.at(-1) || input.urlTimeline.at(-1)?.url,
    })
    input.latestNetwork?.downloads?.slice(0, 2).forEach(download => items.push({
        severity: download.sha256 ? 'medium' : 'high',
        source: 'download',
        title: download.sha256 ? 'Downloaded file hashed' : 'Downloaded file missing hash',
        detail: [download.fileName || 'download', download.bytes !== undefined ? `${download.bytes} bytes` : '', download.hashStatus || ''].filter(Boolean).join(' · '),
        evidence: download.sha256 || download.url,
    }))
    input.deobfuscationTasks.filter(task => task.assessment === 'suspicious' || task.sha256).slice(0, 3).forEach(task => items.push({
        severity: task.assessment === 'suspicious' ? 'high' : 'medium',
        source: 'script',
        title: task.assessment === 'suspicious' ? 'Suspicious decoded script' : 'Script sample hashed',
        detail: task.summary || task.decodedPreview || task.source || 'Script evidence requires review.',
        evidence: task.sha256 || task.source,
    }))
    input.threatAssociations.filter(item => item.confidence !== 'low').slice(0, 2).forEach(item => items.push({
        severity: item.confidence === 'high' ? 'high' : 'medium',
        source: item.source?.replace(/_/g, ' ') || 'threat context',
        title: item.name || 'Threat association',
        detail: item.evidence || `${item.category || 'context'} association from captured evidence.`,
    }))
    return items.slice(0, 8)
}

function buildAnalystBrief(input: {
    target: string
    pageCaptureCount: number
    redirected: boolean
    virusTotal?: SandboxToolAnalysis
    urlquery?: SandboxToolAnalysis
    suspiciousCaptureCount: number
    suspiciousDeobfuscationCount: number
    obfuscatedScriptCount: number
    webcrackLoaded: number
    threatAssociations: SandboxThreatAssociation[]
    indicatorCount: number
    failedRequests: number
    confidence: number
    latestCapturedAt: string
}) {
    const vtFlagged = input.virusTotal?.vendorFlagged || 0
    const urlqueryAlerts = input.urlquery?.alertCount || 0
    const highSignal = Boolean(vtFlagged || urlqueryAlerts || input.suspiciousCaptureCount || input.suspiciousDeobfuscationCount)
    const meaningfulThreatContext = input.threatAssociations.some(item => item.confidence !== 'low')
    const mediumSignal = Boolean(input.obfuscatedScriptCount || meaningfulThreatContext)
    const verdict = highSignal
        ? 'Review required - detection source present'
        : mediumSignal
            ? 'Review required'
            : input.pageCaptureCount
                ? 'No signs of suspicious activity'
                : 'Insufficient external evidence'
    const impact = highSignal
        ? `External detections, suspicious rendered evidence, or decoded script indicators were observed for ${input.target || 'the submitted URL'}.`
        : mediumSignal
            ? 'The run contains obfuscation or meaningful threat-context signals that need analyst review.'
            : input.pageCaptureCount
                ? 'Captured browser and provider evidence did not show suspicious activity.'
                : 'No browser evidence has been captured yet.'
    const recommendedAction = highSignal
        ? 'Open the evidence workspace, copy indicators, and create or update the alert with the observed route and sourced evidence.'
        : mediumSignal
            ? 'Review the suspicious evidence, contacted domains, and WebCrack output before allowing user access.'
            : input.pageCaptureCount
                ? 'Record the run as no signs of suspicious activity based on the captured evidence.'
                : 'Wait for the first page frame, provider result, or explicit blocker.'
    const confidence = input.confidence
        ? `${formatConfidencePercent(input.confidence)} evidence confidence`
        : input.virusTotal || input.urlquery
            ? 'Tool evidence parsed, confidence not provided'
            : 'Confidence pending'
    const freshness = input.latestCapturedAt
        ? `Latest capture ${input.latestCapturedAt}`
        : 'No capture timestamp yet'
    const nextSteps = [
        input.indicatorCount ? `Copy ${input.indicatorCount} indicator${input.indicatorCount === 1 ? '' : 's'} into the alert workflow.` : 'Keep the indicator list open until domains, IPs, or URLs appear.',
        input.webcrackLoaded ? 'Review WebCrack decoded output for second-stage URLs and payload logic.' : 'Use WebCrack if obfuscated script samples appear.',
        input.threatAssociations.length ? `Check threat context: ${input.threatAssociations.slice(0, 2).map(item => item.name).join(', ')}.` : 'Confirm actor or malware context from external sources if needed.',
    ]
    return { verdict, impact, recommendedAction, confidence, freshness, nextSteps }
}

function dedupeThreatAssociations(input: SandboxThreatAssociation[]) {
    const seen = new Set<string>()
    return input
        .filter(item => item?.name)
        .filter(item => {
            const key = `${item.name}:${item.category}:${item.source}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        .slice(0, 12)
}

function cleanEvidenceExcerpt(value?: string) {
    const cleaned = value
        ?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim() || ''
    if (!cleaned || /^(ads do fetching\.?\s*){2,}/i.test(cleaned)) return ''
    return cleaned.length > 260 ? `${cleaned.slice(0, 257)}...` : cleaned
}

function cleanEvidenceComment(value?: string) {
    const cleaned = cleanEvidenceExcerpt(value)
    if (!cleaned || /^ads do fetching/i.test(cleaned)) return ''
    return cleaned
}

function formatConfidencePercent(value: number) {
    if (!value) return ''
    const percent = value <= 1 ? Math.round(value * 100) : Math.round(value)
    return `${percent}%`
}

function matchesTool(capture: Capture, tool: SandboxTool) {
    const toolId = safeToolKey(tool.id)
    const label = capture.label.toLowerCase()
    const kind = capture.toolAnalysis?.toolKind?.toLowerCase()
    return label.includes(toolId) || label.includes(tool.name.toLowerCase()) || kind === toolId
}

function selectToolCapture(captures: Capture[], tool: SandboxTool, target = '') {
    const normalizedHost = target ? hostWithoutWww(target) : ''
    const matches = captures.filter(capture => {
        if (!matchesTool(capture, tool)) return false
        if (!normalizedHost || !capture.target) return true
        return hostWithoutWww(capture.target) === normalizedHost
    })
    return matches.find(capture => hasParsedProviderResult(capture.toolAnalysis) && capture.error !== 'provider_navigation_pending' && capture.image)
        || matches.find(capture => hasParsedProviderResult(capture.toolAnalysis) && capture.error !== 'provider_navigation_pending')
        || matches.find(capture => capture.error !== 'provider_navigation_pending' && capture.image)
        || matches[0]
}

function hostWithoutWww(value: string) {
    try {
        return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
    } catch {
        return value.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    }
}

function safeToolKey(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function providerStatus(capture?: Capture, analysis?: SandboxToolAnalysis) {
    if (!capture) return 'Unavailable'
    if (capture.error === 'provider_navigation_pending') return 'Loading'
    if (analysis?.toolKind === 'webcrack' && analysis.webcrackLoaded === false && /no obfuscated script sample/i.test(analysis.webcrackLoadReason || '')) return 'No sample needed'
    if (hasParsedProviderResult(analysis)) return 'Results'
    if (capture.error) return 'Provider error'
    return 'Result unavailable'
}

function providerTabStatus(capture?: Capture, analysis?: SandboxToolAnalysis) {
    if (!capture) return 'waiting'
    if (analysis?.vendorFlagged !== undefined) return `${virusTotalVendorLabel(analysis)} vendors`
    if (analysis?.alertCount !== undefined) return `${analysis.alertCount} alerts`
    if (analysis?.toolKind === 'webcrack' && analysis.webcrackLoaded === true) return 'sample loaded'
    if (analysis?.toolKind === 'webcrack' && analysis.webcrackLoaded === false) return /no obfuscated script sample/i.test(analysis.webcrackLoadReason || '') ? 'no sample' : 'not loaded'
    if (capture.error === 'provider_navigation_pending') return 'loading'
    if (capture.error) return 'blocked'
    return analysis?.verdict && analysis.verdict !== 'unknown' ? analysis.verdict : 'unavailable'
}

function providerDetail(analysis?: SandboxToolAnalysis, capture?: Capture) {
    if (analysis?.vendorFlagged !== undefined) return `VirusTotal vendors: ${virusTotalVendorLabel(analysis)}${analysis.communityCommentCount !== undefined ? ` · ${communityCommentLabel(analysis.communityCommentCount)}` : ''}`
    if (analysis?.alertCount !== undefined) return `urlquery alerts: ${analysis.alertCount}${analysis.communityCommentCount !== undefined ? ` · ${communityCommentLabel(analysis.communityCommentCount)}` : ''}`
    if (analysis?.toolKind === 'webcrack' && analysis.webcrackLoaded === false && /no obfuscated script sample/i.test(analysis.webcrackLoadReason || '')) return 'No obfuscated script sample was extracted from this page; WebCrack was not required for this run.'
    if (analysis?.extractedSignals?.length) return analysis.extractedSignals.slice(0, 2).join(' · ')
    if (capture?.error === 'provider_navigation_pending') return 'Provider tab is open and loading in the sandbox.'
    if (capture?.error) return `Provider blocked or failed: ${providerErrorText(capture.error)}`
    if (capture) return 'Provider tab captured, but no parsed verdict was returned.'
    return 'Provider tab has not returned a capture yet.'
}

function providerErrorText(error?: string) {
    if (!error || error === 'provider_navigation_pending') return ''
    const lower = error.toLowerCase()
    if (lower.includes('screenshot') && lower.includes('timeout')) return 'Provider screenshot timed out.'
    if (lower.includes('timeout')) return 'Provider timed out.'
    if (lower.includes('net::err')) return 'Provider network request failed.'
    return error.split('\n')[0].slice(0, 140)
}

function communityCommentLabel(count: number) {
    return `${count} community comment${count === 1 ? '' : 's'}`
}

function hasParsedProviderResult(analysis?: SandboxToolAnalysis) {
    return analysis?.vendorFlagged !== undefined
        || analysis?.alertCount !== undefined
        || Boolean(analysis?.verdict && analysis.verdict !== 'unknown')
        || Boolean(analysis?.toolKind === 'webcrack' && analysis.webcrackLoaded !== undefined)
}

function extractIndicators(value: string) {
    const domains = value.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi) || []
    const ips = (value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [])
        .filter(ip => ip.split('.').every(part => Number(part) >= 0 && Number(part) <= 255))
    const urls = value.match(/https?:\/\/[^\s"'<>]+/gi) || []
    return Array.from(new Set([
        ...urls.filter(isUsefulUrlIndicator),
        ...domains.filter(isUsefulDomainIndicator),
        ...ips,
    ].map(item => item.toLowerCase()))).slice(0, 80)
}

function usefulIndicators(values: string[], target: string) {
    const normalizedTarget = target.toLowerCase()
    return Array.from(new Set(values.map(item => item.toLowerCase().trim()).filter(item => item && !normalizedTarget.includes(item) && isUsefulIndicator(item)))).slice(0, 80)
}

function isUsefulIndicator(value: string) {
    if (/^https?:\/\//i.test(value)) return isUsefulUrlIndicator(value)
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return value.split('.').every(part => Number(part) >= 0 && Number(part) <= 255)
    return /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i.test(value) && isUsefulDomainIndicator(value)
}

const GENERIC_DOTTED_INDICATORS = new Set([
    'document.createelement',
    'document.body',
    'document.head',
    'document.cookie',
    'document.location',
    'window.location',
    'window.history',
    'object.assign',
    'object.create',
    'json.parse',
    'json.stringify',
    'console.log',
    'el.style',
    'el.textcontent',
    'element.style',
])
const ANALYSIS_TOOL_DOMAINS = new Set(['virustotal.com', 'www.virustotal.com', 'urlquery.net', 'www.urlquery.net', 'webcrack.netlify.app'])

function isUsefulDomainIndicator(value: string) {
    const normalized = value.toLowerCase()
    if (ANALYSIS_TOOL_DOMAINS.has(normalized)) return false
    if (GENERIC_DOTTED_INDICATORS.has(normalized)) return false
    return !/^(?:document|window|object|array|string|number|console|json|math|element|el|node|event|navigator|location|history|localstorage|sessionstorage)\./i.test(normalized)
}

function isUsefulUrlIndicator(value: string) {
    try {
        const url = new URL(value)
        return isUsefulDomainIndicator(url.hostname)
    } catch {
        return false
    }
}

function parsePayload(value: string) {
    try {
        return JSON.parse(value) as Record<string, unknown>
    } catch {
        return null
    }
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function evidenceValue(value: unknown): SandboxEvidence | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as SandboxEvidence
}

function toolAnalysisValue(value: unknown): SandboxToolAnalysis | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as SandboxToolAnalysis
}

function networkSummaryValue(value: unknown): SandboxNetworkSummary | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as SandboxNetworkSummary
}

function webcrackLoadValue(value: unknown): SandboxWebCrackLoad | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as SandboxWebCrackLoad
}

function frameQualityValue(value: unknown): FrameQuality | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as FrameQuality
}

function capacityValue(value: unknown): SandboxCapacity | null {
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    const activeSessions = finiteNumber(record.activeSessions)
    const queuedSessions = finiteNumber(record.queuedSessions)
    const maxSessions = finiteNumber(record.maxSessions)
    if (activeSessions === null || queuedSessions === null || maxSessions === null) return null
    const queuePosition = finiteNumber(record.queuePosition)
    return {
        activeSessions,
        queuedSessions,
        maxSessions,
        queuePosition: queuePosition === null ? undefined : queuePosition,
    }
}

function quotaValue(value: unknown): BrowserQuota | null {
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    const limit = finiteNumber(record.limit)
    const used = finiteNumber(record.used)
    const remaining = finiteNumber(record.remaining)
    if (limit === null || used === null || remaining === null) return null
    return {
        plan: stringValue(record.plan) || 'anonymous',
        limit,
        used,
        remaining,
        resetsAt: stringValue(record.resetsAt) || null,
        identityKind: stringValue(record.identityKind) || 'anonymous',
    }
}

function runHistoryValue(value: unknown): BrowserRunHistory | null {
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    const id = stringValue(record.id)
    const target = stringValue(record.target)
    const runNetwork = stringValue(record.network) === 'tor' ? 'tor' : 'regular'
    const startedAt = stringValue(record.startedAt) || stringValue(record.started_at) || new Date().toISOString()
    if (!id || !target) return null
    return {
        id,
        target,
        network: runNetwork,
        status: stringValue(record.status) || 'running',
        startedAt,
        title: stringValue(record.title),
        providerResults: providerResultsValue(record.providerResults),
        reportUrl: stringValue(record.reportUrl),
    }
}

function providerResultsValue(value: unknown): Record<string, ProviderRunResult> | undefined {
    if (!value || typeof value !== 'object') return undefined
    const entries = Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
        if (!item || typeof item !== 'object') return []
        const record = item as Record<string, unknown>
        const status = stringValue(record.status)
        if (status !== 'clean' && status !== 'suspicious' && status !== 'blocked' && status !== 'loading') return []
        return [[safeToolKey(key), { status, label: stringValue(record.label) || key }] as const]
    })
    return entries.length ? Object.fromEntries(entries) : undefined
}

function sanitizeHistory(value: unknown): BrowserRunHistory[] {
    if (!Array.isArray(value)) return []
    return value.map(runHistoryValue).filter(Boolean).slice(0, 12) as BrowserRunHistory[]
}

function persistHistory(next: BrowserRunHistory[]) {
    const deduped = Array.from(new Map(next.map(item => [item.id, item])).values()).slice(0, 12)
    try {
        window.localStorage.setItem(historyStorageKey, JSON.stringify(deduped))
    } catch {
        // Local history is best effort; backend history is authoritative for authenticated users.
    }
    return deduped
}

function getOrCreateBrowserClientId() {
    try {
        const existing = window.localStorage.getItem(clientIdStorageKey)
        if (existing) return existing
        const next = crypto.randomUUID()
        window.localStorage.setItem(clientIdStorageKey, next)
        return next
    } catch {
        return 'browser-storage-unavailable'
    }
}

function inferNetwork(target: string): BrowserNetwork {
    return /\.onion(?::\d+)?(?:\/|$)/i.test(target) ? 'tor' : 'regular'
}

function finiteNumber(value: unknown) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return null
    return Math.max(0, Math.round(numeric))
}

function queueCopy(capacity: SandboxCapacity | null) {
    if (!capacity?.queuePosition) return 'All browser slots are busy. This run will start automatically when a slot is released.'
    return `All ${capacity.maxSessions} browser slots are busy. This run is position ${capacity.queuePosition} of ${capacity.queuedSessions} and will start automatically.`
}

function mergeProfiles(input: SandboxProfile[]) {
    const merged = [...sanitizeProfiles(input), ...defaultProfiles]
    const seen = new Set<string>()
    return merged.filter(profile => {
        if (!profile?.id || seen.has(profile.id)) return false
        seen.add(profile.id)
        return true
    })
}

function sanitizeProfiles(value: unknown): SandboxProfile[] {
    if (!Array.isArray(value)) return []
    return value.flatMap(item => {
        if (!item || typeof item !== 'object') return []
        const profile = item as Partial<SandboxProfile>
        const id = typeof profile.id === 'string' ? profile.id.trim() : ''
        const name = typeof profile.name === 'string' ? profile.name.trim() : ''
        if (!id || !name) return []
        return [{
            id,
            name,
            tools: sanitizeTools(profile.tools),
        }]
    }).slice(0, 16)
}

function sanitizeTools(value: unknown): SandboxTool[] {
    if (!Array.isArray(value)) return []
    return value.flatMap(item => {
        if (!item || typeof item !== 'object') return []
        const tool = item as Partial<SandboxTool>
        const id = typeof tool.id === 'string' ? tool.id.trim() : ''
        const name = typeof tool.name === 'string' ? tool.name.trim() : ''
        const url = normalizeToolUrl(id, name, typeof tool.url === 'string' ? tool.url.trim() : '')
        if (!id || !name || !/^https?:\/\//i.test(url)) return []
        return [{ id, name, url }]
    }).slice(0, 8)
}

function normalizeToolUrl(id: string, name: string, url: string) {
    if (/virus\s*total|virustotal/i.test(`${id} ${name} ${url}`) && url.includes('/gui/search/{rawUrl}')) {
        return 'https://www.virustotal.com/gui/search/{url}'
    }
    return url
}

function isDefaultProfile(id: string) {
    return defaultProfiles.some(profile => profile.id === id)
}

function profileSyncLabel(state: 'local' | 'loading' | 'synced' | 'saving' | 'error') {
    if (state === 'loading') return 'Loading account profiles.'
    if (state === 'saving') return 'Saving profiles to account.'
    if (state === 'synced') return 'Profiles synced to account.'
    if (state === 'error') return 'Account profile sync failed; local copy is preserved.'
    return 'Profiles saved locally on this browser.'
}
