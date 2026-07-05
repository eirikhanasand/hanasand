'use client'

import { Check, Clipboard, Globe2, Hourglass, Play, Plus, RotateCcw, ShieldCheck, Square, Trash2 } from 'lucide-react'
import { type KeyboardEvent, type MouseEvent, type ReactNode, type WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

type SessionState = 'prompt' | 'queued' | 'connecting' | 'live' | 'ended'
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
    title?: string
    capturedAt: string
    reason?: string
    image?: string | null
    frameWidth?: number
    frameHeight?: number
    error?: string
    evidence?: SandboxEvidence
    toolAnalysis?: SandboxToolAnalysis
    networkSummary?: SandboxNetworkSummary
    webcrackLoad?: SandboxWebCrackLoad
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
    statusCounts?: Record<string, number>
    redirectChain?: string[]
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
    title?: string
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
    scripts?: Array<{ id?: string; src?: string; inlineBytes?: number; obfuscationScore?: number; reasons?: string[]; sample?: string }>
    obfuscatedScripts?: Array<{ id?: string; src?: string; inlineBytes?: number; obfuscationScore?: number; reasons?: string[]; sample?: string }>
    threatAssociations?: SandboxThreatAssociation[]
    deobfuscationTasks?: Array<{
        scriptId?: string
        source?: string
        webcrackReady?: boolean
        sample?: string
        decodedPreview?: string
        decodedTransforms?: string[]
        indicators?: { domains?: string[]; ips?: string[]; urls?: string[] }
        threatAssociations?: SandboxThreatAssociation[]
        assessment?: string
        summary?: string
    }>
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

export default function BrowserPageClient() {
    const [target, setTarget] = useState('')
    const [network, setNetwork] = useState<BrowserNetwork>('regular')
    const [networkTouched, setNetworkTouched] = useState(false)
    const [sessionState, setSessionState] = useState<SessionState>('prompt')
    const [socketState, setSocketState] = useState<SocketState>('closed')
    const [profiles, setProfiles] = useState<SandboxProfile[]>(defaultProfiles)
    const [selectedProfileId, setSelectedProfileId] = useState(defaultProfiles[0].id)
    const [captures, setCaptures] = useState<Capture[]>([])
    const [activeImage, setActiveImage] = useState<string | null>(null)
    const [activeFrame, setActiveFrame] = useState<{ width: number; height: number }>({ width: 1280, height: 760 })
    const [activeUrl, setActiveUrl] = useState('')
    const [events, setEvents] = useState<string[]>(['Sandbox ready.'])
    const [customProfileName, setCustomProfileName] = useState('')
    const [customToolName, setCustomToolName] = useState('')
    const [customToolUrl, setCustomToolUrl] = useState('')
    const [profilesLoaded, setProfilesLoaded] = useState(false)
    const [profileSyncEnabled, setProfileSyncEnabled] = useState(false)
    const [profileSyncState, setProfileSyncState] = useState<'local' | 'loading' | 'synced' | 'saving' | 'error'>('loading')
    const [capacity, setCapacity] = useState<SandboxCapacity | null>(null)
    const [history, setHistory] = useState<BrowserRunHistory[]>([])
    const [quota, setQuota] = useState<BrowserQuota | null>(null)
    const socketRef = useRef<WebSocket | null>(null)
    const imageRef = useRef<HTMLImageElement | null>(null)

    const normalizedTarget = useMemo(() => normalizeTarget(target), [target])
    const inferredNetwork = useMemo(() => inferNetwork(normalizedTarget), [normalizedTarget])
    const selectedNetwork = networkTouched ? network : inferredNetwork
    const selectedProfile = useMemo(() => profiles.find(profile => profile.id === selectedProfileId) || profiles[0], [profiles, selectedProfileId])
    const summary = useMemo(() => buildAnalystSummary(normalizedTarget, captures, selectedProfile), [captures, normalizedTarget, selectedProfile])

    const pushEvent = useCallback((event: string) => {
        setEvents(current => [event, ...current].slice(0, 8))
    }, [])

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
        if (!networkTouched) setNetwork(inferredNetwork)
    }, [inferredNetwork, networkTouched])

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

    const startRun = useCallback((override?: { target?: string; network?: BrowserNetwork }) => {
        const url = normalizeTarget(override?.target ?? target)
        if (!url) return
        const id = sessionId()
        const socket = new WebSocket(brokerUrlForSession(brokerBaseUrl, id))
        const runNetwork = override?.network || selectedNetwork
        if (override?.target) setTarget(override.target)
        if (override?.network) {
            setNetwork(override.network)
            setNetworkTouched(true)
        }
        socketRef.current?.close()
        socketRef.current = socket
        setCaptures([])
        setActiveImage(null)
        setActiveUrl(url)
        setCapacity(null)
        setSessionState('connecting')
        setSocketState('connecting')
        pushEvent(`Launching isolated browser for ${url}.`)

        socket.onopen = () => {
            setSocketState('open')
            socket.send(JSON.stringify({
                type: 'start',
                sessionId: id,
                network: runNetwork,
                target: url,
                durationMinutes: 15,
                profileTools: selectedProfile.tools,
                clientId: getOrCreateBrowserClientId(),
                userId: getCookie('id') || undefined,
                sessionToken: getCookie('token') || undefined,
            }))
        }
        socket.onclose = () => {
            setSocketState('closed')
            setSessionState(current => current === 'connecting' ? 'ended' : current)
            pushEvent('Sandbox broker closed.')
        }
        socket.onerror = () => {
            setSocketState('error')
            pushEvent('Sandbox broker errored.')
        }
        socket.onmessage = (message) => {
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
                pushEvent(`${runNetwork === 'tor' ? 'Tor' : 'Regular'} browser is live.`)
                return
            }
            if (payload.type === 'frame' && typeof payload.image === 'string') {
                const image = `data:image/jpeg;base64,${payload.image}`
                setActiveImage(image)
                const urlValue = String(payload.url || url)
                const frameWidth = finiteNumber(payload.width) || 1280
                const frameHeight = finiteNumber(payload.height) || 760
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
                    evidence: evidenceValue(payload.evidence),
                    networkSummary: networkSummaryValue(payload.networkSummary),
                }))
                return
            }
            if (payload.type === 'tool_capture') {
                const image = typeof payload.image === 'string' ? `data:image/jpeg;base64,${payload.image}` : null
                setCaptures(current => addCapture(current, {
                    id: `tool-${payload.id || current.length}-${payload.capturedAt || Date.now()}`,
                    kind: 'tool',
                    label: stringValue(payload.name) || 'Profile tool',
                    url: stringValue(payload.url) || '',
                    title: stringValue(payload.title),
                    capturedAt: stringValue(payload.capturedAt) || new Date().toISOString(),
                    image,
                    error: stringValue(payload.error),
                    evidence: evidenceValue(payload.evidence),
                    toolAnalysis: toolAnalysisValue(payload.toolAnalysis),
                    webcrackLoad: webcrackLoadValue(payload.webcrackLoad),
                }))
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
                    setSessionState('ended')
                }
                if (payload.url) setActiveUrl(String(payload.url))
                pushEvent(String(payload.message || payload.state || 'Browser status updated.'))
                return
            }
            if (payload.type === 'console') {
                pushEvent(`Remote console: ${stringValue(payload.text)}`)
                return
            }
            if (payload.type === 'navigation_error' || payload.type === 'error') {
                pushEvent(String(payload.message || 'Sandbox navigation failed.'))
            }
        }
    }, [pushEvent, selectedNetwork, selectedProfile.tools, target])

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
        setActiveImage(null)
        setActiveUrl('')
        setCapacity(null)
        pushEvent('Sandbox reset.')
    }, [pushEvent])

    const selectNetwork = useCallback((value: BrowserNetwork) => {
        setNetworkTouched(true)
        setNetwork(value)
    }, [])

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

    const clickBrowserFrame = useCallback((event: MouseEvent<HTMLImageElement>) => {
        const point = browserPoint(event.clientX, event.clientY)
        if (!point) return
        sendBrowserInput({ type: 'click', ...point, button: 0 })
    }, [browserPoint, sendBrowserInput])

    const wheelBrowserFrame = useCallback((event: WheelEvent<HTMLImageElement>) => {
        const point = browserPoint(event.clientX, event.clientY)
        if (!point) return
        event.preventDefault()
        sendBrowserInput({ type: 'wheel', ...point, deltaX: event.deltaX, deltaY: event.deltaY })
    }, [browserPoint, sendBrowserInput])

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
                <section className='grid min-h-[calc(100vh-4.5rem)] place-items-center px-4 py-10'>
                    <div className='grid w-full max-w-3xl gap-6'>
                        <div className='grid gap-3 text-center'>
                            <div className='mx-auto grid h-12 w-12 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-primary'>
                                <Globe2 className='h-6 w-6' />
                            </div>
                            <h1 className='text-3xl font-semibold tracking-normal text-ui-text md:text-5xl'>Browser</h1>
                            <p className='mx-auto max-w-2xl text-base leading-7 text-ui-muted'>
                                Detonate an untrusted URL in a remote browser, auto-route onion targets through Tor, capture every redirect state, and run saved SOC profiles without exposing the analyst workstation.
                            </p>
                        </div>
                        <form
                            className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'
                            onSubmit={(event) => {
                                event.preventDefault()
                                startRun()
                            }}
                        >
                            <label className='text-sm font-semibold text-ui-text' htmlFor='sandbox-url'>URL to investigate</label>
                            <NetworkSegment network={selectedNetwork} inferred={inferredNetwork} onSelect={selectNetwork} />
                            <div className='grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]'>
                                <input
                                    id='sandbox-url'
                                    value={target}
                                    onChange={event => setTarget(event.target.value)}
                                    placeholder='https://example.com/suspicious-path'
                                    className='h-12 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 font-mono text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                                />
                                <button type='submit' disabled={!normalizedTarget} className='inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'>
                                    <Play className='h-4 w-4' />
                                    Start sandbox
                                </button>
                            </div>
                            <ProfilePicker profiles={profiles} selectedProfileId={selectedProfileId} onSelect={setSelectedProfileId} onDelete={deleteProfile} />
                            <div className='grid gap-2 rounded-md border border-ui-border bg-ui-raised p-3 text-xs text-ui-muted md:grid-cols-3'>
                                <span><strong className='text-ui-text'>10 active browsers by default</strong></span>
                                <span><strong className='text-ui-text'>Queued</strong> when capacity is full</span>
                                <span><strong className='text-ui-text'>Auto-routed</strong> by URL type</span>
                            </div>
                        </form>
                        <div className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <div>
                                    <h2 className='text-sm font-semibold text-ui-text'>Saved profiles</h2>
                                    <p className='mt-1 text-sm text-ui-muted'>Profiles run the selected URL through external triage surfaces in the remote sandbox context.</p>
                                    <p className='mt-1 text-xs text-ui-muted'>{profileSyncLabel(profileSyncState)}</p>
                                </div>
                                <div className='flex gap-2'>
                                    <input value={customProfileName} onChange={event => setCustomProfileName(event.target.value)} placeholder='Profile name' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none' />
                                    <button type='button' onClick={saveProfile} className='grid h-9 w-9 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary' aria-label='Save profile'>
                                        <Plus className='h-4 w-4' />
                                    </button>
                                </div>
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
                        <HistoryPanel history={history} quota={quota} onRerun={(run) => startRun({ target: run.target, network: run.network })} />
                    </div>
                </section>
            </main>
        )
    }

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='grid min-h-[calc(100vh-4.5rem)] grid-rows-[auto_minmax(0,1fr)]'>
                <header className='border-b border-ui-border bg-ui-panel px-4 py-3'>
                    <div className='mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-3'>
                        <div className='min-w-0'>
                            <p className='text-xs font-semibold uppercase text-ui-primary'>{selectedNetwork === 'tor' ? 'Tor browser' : 'Regular browser'}</p>
                            <h1 className='truncate text-lg font-semibold text-ui-text'>{activeUrl || normalizedTarget}</h1>
                        </div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <StatusPill label='Session' value={sessionState} good={sessionState === 'live'} />
                            <StatusPill label='Broker' value={socketState} good={socketState === 'open'} />
                            <StatusPill label='Network' value={selectedNetwork} good />
                            {capacity ? <StatusPill label='Capacity' value={capacity.queuePosition ? `${capacity.queuePosition}/${capacity.queuedSessions} queued` : `${capacity.activeSessions}/${capacity.maxSessions} active`} good={!capacity.queuePosition} /> : null}
                            <button type='button' onClick={stopRun} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-danger/35 bg-ui-danger/10 px-3 text-sm font-semibold text-ui-danger'>
                                <Square className='h-4 w-4' />
                                Stop
                            </button>
                            <button type='button' onClick={resetRun} className='grid h-9 w-9 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary' aria-label='New sandbox run'>
                                <RotateCcw className='h-4 w-4' />
                            </button>
                        </div>
                    </div>
                </header>
                <div className='mx-auto grid min-h-0 w-full max-w-[96rem] gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]'>
                    <section className='grid min-h-[34rem] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                        <div className='flex items-center gap-2 border-b border-ui-border bg-ui-raised px-3 py-2'>
                            <span className='h-3 w-3 rounded-full bg-ui-danger' />
                            <span className='h-3 w-3 rounded-full bg-ui-warning' />
                            <span className='h-3 w-3 rounded-full bg-ui-success' />
                            <div className='min-w-0 flex-1 truncate rounded-md border border-ui-border bg-ui-canvas px-3 py-2 font-mono text-xs text-ui-muted'>{activeUrl || normalizedTarget}</div>
                        </div>
                        <div
                            className='grid min-h-0 place-items-center bg-ui-canvas p-2 outline-none focus:ring-2 focus:ring-ui-primary/30'
                            tabIndex={0}
                            role='application'
                            aria-label='Interactive isolated browser viewport'
                            onKeyDown={keyBrowserFrame}
                        >
                            {activeImage ? (
                                <img
                                    ref={imageRef}
                                    src={activeImage}
                                    alt='Live browser sandbox frame'
                                    className='max-h-full w-full rounded-md object-contain'
                                    onClick={clickBrowserFrame}
                                    onWheel={wheelBrowserFrame}
                                />
                            ) : (
                                <div className='grid max-w-md gap-2 text-center'>
                                    <ShieldCheck className='mx-auto h-8 w-8 text-ui-primary' />
                                    <p className='text-lg font-semibold text-ui-text'>{sessionState === 'queued' ? 'Queued for sandbox capacity' : sessionState === 'connecting' ? 'Waiting for first browser frame' : 'No browser frame captured yet'}</p>
                                    <p className='text-sm leading-6 text-ui-muted'>{sessionState === 'queued' ? queueCopy(capacity) : 'The remote browser has not sent a screenshot yet. If this persists, rerun the URL or check the broker and provider status below.'}</p>
                                </div>
                            )}
                        </div>
                    </section>
                    <aside className='grid min-h-0 gap-4 xl:grid-rows-[auto_minmax(0,1fr)_auto]'>
                        <CapacityPanel capacity={capacity} sessionState={sessionState} />
                        <AnalystSummary summary={summary} />
                        <EvidenceWorkspace captures={captures} profile={selectedProfile} summary={summary} events={events} />
                        <CaptureTimeline captures={captures} />
                        <div className='rounded-lg border border-ui-border bg-ui-panel p-3 text-xs text-ui-muted'>
                            Latest event: {events[0]}
                        </div>
                    </aside>
                </div>
            </section>
        </main>
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
        <div className='flex flex-wrap gap-2'>
            {profiles.map(profile => {
                const selected = selectedProfileId === profile.id
                const locked = defaultProfiles.some(item => item.id === profile.id)
                return (
                    <span key={profile.id} className={`inline-flex min-h-9 items-center overflow-hidden rounded-md border transition ${selected ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-raised text-ui-text'}`}>
                        <button
                            type='button'
                            onClick={() => onSelect(profile.id)}
                            className='inline-flex min-h-9 items-center gap-2 px-3 text-sm font-semibold transition hover:bg-ui-primary/5'
                        >
                            {selected ? <Check className='h-4 w-4' /> : null}
                            {profile.name}
                            <span className='text-xs text-ui-muted'>{profile.tools.length} tools</span>
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

function NetworkSegment({ network, inferred, onSelect }: { network: BrowserNetwork; inferred: BrowserNetwork; onSelect: (network: BrowserNetwork) => void }) {
    return (
        <div className='grid gap-2 rounded-md border border-ui-border bg-ui-raised p-2'>
            <div className='inline-grid grid-cols-2 rounded-md border border-ui-border bg-ui-panel p-1' role='group' aria-label='Choose browser network'>
                {(['regular', 'tor'] as BrowserNetwork[]).map(item => (
                    <button
                        key={item}
                        type='button'
                        onClick={() => onSelect(item)}
                        className={`h-9 rounded px-3 text-sm font-semibold capitalize transition ${network === item ? 'bg-ui-primary text-ui-canvas' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}
                    >
                        {item === 'regular' ? 'Regular' : 'Tor'}
                    </button>
                ))}
            </div>
            <p className='text-xs text-ui-muted'>Auto-detected route: <span className='font-semibold text-ui-text'>{inferred === 'tor' ? 'Tor' : 'Regular'}</span>. Onion URLs default to Tor; normal web URLs default to Regular.</p>
        </div>
    )
}

function HistoryPanel({ history, quota, onRerun }: { history: BrowserRunHistory[]; quota: BrowserQuota | null; onRerun: (run: BrowserRunHistory) => void }) {
    const used = quota?.used ?? history.length
    const limit = quota?.limit ?? 3
    return (
        <section className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h2 className='text-sm font-semibold text-ui-text'>Recent browser runs</h2>
                    <p className='mt-1 text-xs text-ui-muted'>{quota ? `${used}/${limit} ${quota.plan} run${limit === 1 ? '' : 's'} used${quota.resetsAt ? ` · resets ${new Date(quota.resetsAt).toLocaleDateString()}` : ''}.` : 'Anonymous history is saved to this browser and synced when available.'}</p>
                </div>
                <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted'>{quota?.identityKind === 'user' ? 'account' : 'browser id'}</span>
            </div>
            <div className='grid gap-2'>
                {history.slice(0, 5).map(run => (
                    <div key={run.id} className='grid gap-2 rounded-md border border-ui-border bg-ui-raised p-2 text-xs md:grid-cols-[6rem_minmax(0,1fr)_auto_auto] md:items-center'>
                        <span className='font-semibold uppercase text-ui-primary'>{run.network}</span>
                        <span className='min-w-0 truncate font-mono text-ui-text'>{run.target}</span>
                        <span className='text-ui-muted'>{new Date(run.startedAt).toLocaleString()}</span>
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
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>{busy ? queueCopy(capacity) : `${active}/${max} browser slots are active across Regular and Tor. Overflow runs queue instead of failing silently.`}</p>
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

function AnalystSummary({ summary }: { summary: ReturnType<typeof buildAnalystSummary> }) {
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-start justify-between gap-3'>
                <div>
                    <h2 className='text-sm font-semibold uppercase text-ui-primary'>SOC analyst summary</h2>
                    <p className='mt-2 text-sm leading-6 text-ui-text'>{summary.narrative}</p>
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
                        <p className='mt-1 text-xs leading-5 text-ui-text'>{summary.brief.impact}</p>
                    </div>
                    <div className='rounded-md border border-ui-border bg-ui-panel p-2'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Recommended action</p>
                        <p className='mt-1 text-xs leading-5 text-ui-text'>{summary.brief.recommendedAction}</p>
                    </div>
                    <div className='rounded-md border border-ui-border bg-ui-panel p-2'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Freshness</p>
                        <p className='mt-1 text-xs leading-5 text-ui-text'>{summary.brief.freshness}</p>
                    </div>
                    <div className='rounded-md border border-ui-border bg-ui-panel p-2'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Next steps</p>
                        <ul className='mt-1 grid gap-1 text-xs leading-5 text-ui-text'>
                            {summary.brief.nextSteps.map(step => <li key={step}>{step}</li>)}
                        </ul>
                    </div>
                </div>
            </div>
            <div className='mt-3 grid gap-2 text-sm'>
                {summary.rows.map(row => (
                    <div key={row.label} className='flex justify-between gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2'>
                        <span className='text-ui-muted'>{row.label}</span>
                        <span className='font-semibold text-ui-text'>{row.value}</span>
                    </div>
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
    summary,
    events,
}: {
    captures: Capture[]
    profile: SandboxProfile
    summary: ReturnType<typeof buildAnalystSummary>
    events: string[]
}) {
    const pageCaptures = captures.filter(capture => capture.kind === 'page')
    const toolCaptures = captures.filter(capture => capture.kind === 'tool')
    const latestPage = pageCaptures[0]
    const latestNetwork = pageCaptures.find(capture => capture.networkSummary)?.networkSummary

    return (
        <section className='min-h-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
            <div className='border-b border-ui-border px-4 py-3'>
                <h2 className='text-sm font-semibold uppercase text-ui-primary'>Evidence workspace</h2>
                <p className='mt-1 text-xs text-ui-muted'>Source-attributed capture, provider, network, script, and indicator status.</p>
            </div>
            <div className='grid max-h-[42rem] gap-3 overflow-auto p-3'>
                <EvidencePanel title='Browser capture' status={latestPage ? 'Captured' : 'Awaiting frame'}>
                    {latestPage ? (
                        <div className='grid gap-2 text-xs text-ui-muted'>
                            <p className='font-mono text-ui-text'>{latestPage.url}</p>
                            <p>{latestPage.capturedAt}{latestPage.reason ? ` · ${latestPage.reason}` : ''}{latestPage.title ? ` · ${latestPage.title}` : ''}</p>
                            {cleanEvidenceExcerpt(latestPage.evidence?.textExcerpt) ? <p className='leading-5'>{cleanEvidenceExcerpt(latestPage.evidence?.textExcerpt)}</p> : null}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No browser screenshot has arrived. The run is not treated as successful until a frame, provider result, or explicit failure is visible here.</p>
                    )}
                </EvidencePanel>

                <div className='grid gap-3 md:grid-cols-3'>
                    {profile.tools.map(tool => {
                        const capture = toolCaptures.find(item => matchesTool(item, tool))
                        const analysis = capture?.toolAnalysis
                        return (
                            <EvidencePanel key={tool.id} title={tool.name} status={providerStatus(capture, analysis)}>
                                {capture ? (
                                    <div className='grid gap-1 text-xs text-ui-muted'>
                                        <p>{capture.capturedAt}</p>
                                        <p className='truncate font-mono text-ui-text'>{capture.url || tool.url}</p>
                                        {analysis?.vendorFlagged !== undefined ? <p>VirusTotal vendors: {analysis.vendorFlagged}/{analysis.vendorTotal || '?'}</p> : null}
                                        {analysis?.alertCount !== undefined ? <p>urlquery alerts: {analysis.alertCount}</p> : null}
                                        {analysis?.communityCommentCount !== undefined ? <p>Community comments: {analysis.communityCommentCount}</p> : null}
                                        {analysis?.verdict ? <p>Provider verdict: {analysis.verdict}</p> : <p>Result unavailable: no parsed provider verdict was returned.</p>}
                                        {capture.error ? <p>Error: {capture.error}</p> : null}
                                    </div>
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
                        <div className='grid gap-1 text-xs text-ui-muted'>
                            <p>{latestNetwork.requestCount || 0} requests · {latestNetwork.responseCount || 0} responses · {latestNetwork.failedCount || 0} blocked/failed</p>
                            {latestNetwork.domains?.length ? <p className='font-mono text-ui-text'>{latestNetwork.domains.slice(0, 8).join('\n')}</p> : null}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No request summary has been emitted by the browser broker yet.</p>
                    )}
                </EvidencePanel>

                <EvidencePanel title='Page captures' status={`${pageCaptures.length} frame${pageCaptures.length === 1 ? '' : 's'}`}>
                    {pageCaptures.length ? (
                        <div className='grid gap-2 text-xs text-ui-muted'>
                            {pageCaptures.slice(0, 6).map(capture => (
                                <div key={capture.id} className='rounded-md border border-ui-border bg-ui-panel p-2'>
                                    <p>{capture.capturedAt}{capture.reason ? ` · ${capture.reason}` : ''}</p>
                                    <p className='truncate font-mono text-ui-text'>{capture.url}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No page capture available yet.</p>
                    )}
                </EvidencePanel>

                <EvidencePanel title='Console / logs' status={`${events.length} event${events.length === 1 ? '' : 's'}`}>
                    <div className='grid gap-1 text-xs text-ui-muted'>
                        {events.slice(0, 6).map(event => <p key={event}>{event}</p>)}
                    </div>
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
                                <p className='mt-1 truncate font-mono text-xs text-ui-muted'>{capture.url || capture.error}</p>
                            </div>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted'>{capture.kind}</span>
                        </div>
                        {capture.image ? <img src={capture.image} alt={`${capture.label} screenshot`} className='rounded border border-ui-border' /> : null}
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

function addCapture(current: Capture[], next: Capture) {
    const last = current[0]
    if (last && last.kind === next.kind && last.url === next.url && last.image === next.image) return current
    return [next, ...current].slice(0, 24)
}

function captureLabel(reason: string) {
    if (reason === 'navigation') return 'Navigation capture'
    if (reason === 'domcontentloaded') return 'DOM-ready capture'
    if (reason === 'load') return 'Loaded-page capture'
    if (reason === 'initial_target') return 'Initial target capture'
    if (reason === 'interval') return 'Interval capture'
    return 'Page capture'
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
    ])
    const indicators = Array.from(new Set([...extracted, ...evidenceIndicators])).filter(indicator => !target.includes(indicator))
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
    const allIndicators = Array.from(new Set([...indicators, ...decodedIndicators, ...networkDomains])).filter(indicator => !target.includes(indicator))
    const deobfuscationSummary = deobfuscationTasks.find(task => task.summary)?.summary || 'No decoded malicious payload summary is available yet.'
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
    const threatNarrative = threatAssociations.length
        ? `Observed threat context in captured evidence: ${threatAssociations.slice(0, 4).map(item => `${item.name} (${item.category || 'context'}, ${item.confidence || 'low'})`).join('; ')}.`
        : 'No named actor, malware family, or tool label was extracted from the captured evidence yet.'
    const providerNarrative = toolAnalyses.length
        ? `Parsed provider evidence is available from ${toolAnalyses.map(item => item.toolKind || 'profile tool').join(', ')}.`
        : toolCaptures.length
            ? 'Profile tools produced captures, but no parsed provider verdict was returned.'
            : 'No external provider result has been parsed yet; provider panels show configured tools and blockers.'
    const narrative = pageCaptures.length
        ? `The sandbox loaded ${target || 'the submitted URL'} and captured ${pageCaptures.length} browser state${pageCaptures.length === 1 ? '' : 's'}${redirected ? ' across at least one URL change' : ''}. ${providerNarrative} ${suspiciousCaptures.length ? `Rendered evidence requires review: ${suspiciousCaptures.flatMap(capture => capture.evidence?.reasons || []).slice(0, 3).join('; ')}.` : 'Rendered page evidence is neutral or inconclusive.'} ${threatNarrative} ${comments.length ? `Source comments observed: ${comments.join(' ')}` : 'No community comments were extracted from provider or page evidence.'}`
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
        urlTimeline,
        deobfuscationTasks,
        deobfuscationSummary,
        webcrackLoaded,
        rows: [
            { label: 'Page captures', value: String(pageCaptures.length) },
            { label: 'Profile tools', value: `${toolCaptures.length}/${profile.tools.length}` },
            { label: 'VirusTotal vendors', value: virusTotal?.vendorFlagged !== undefined ? `${virusTotal.vendorFlagged}/${virusTotal.vendorTotal || '?'}` : 'unknown' },
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
    const mediumSignal = Boolean(input.redirected || input.obfuscatedScriptCount || input.threatAssociations.length)
    const verdict = highSignal
        ? 'Review required - detection source present'
        : mediumSignal
            ? 'Review required'
            : input.pageCaptureCount
                ? 'No malicious verdict from available evidence'
                : 'Insufficient external evidence'
    const impact = highSignal
        ? `External detections, suspicious rendered evidence, or decoded script indicators were observed for ${input.target || 'the submitted URL'}.`
        : mediumSignal
            ? 'The run contains redirect, obfuscation, threat-context, or blocked-request signals that need analyst review.'
            : input.pageCaptureCount
                ? 'Captured browser and tool evidence does not currently show a confirmed malicious chain.'
                : 'No browser evidence has been captured yet.'
    const recommendedAction = highSignal
        ? 'Open the evidence workspace, copy indicators, and create or update the alert with the observed route and sourced evidence.'
        : mediumSignal
            ? 'Review redirects, contacted domains, and WebCrack output before allowing user access.'
            : input.pageCaptureCount
                ? 'Record as no malicious verdict from available evidence unless new provider or network evidence appears.'
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
    const cleaned = value?.replace(/\s+/g, ' ').trim() || ''
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
    const toolId = tool.id.toLowerCase()
    const label = capture.label.toLowerCase()
    const kind = capture.toolAnalysis?.toolKind?.toLowerCase()
    return label.includes(toolId) || label.includes(tool.name.toLowerCase()) || kind === toolId
}

function providerStatus(capture?: Capture, analysis?: SandboxToolAnalysis) {
    if (!capture) return 'Unavailable'
    if (capture.error) return 'Provider error'
    if (analysis?.vendorFlagged !== undefined || analysis?.alertCount !== undefined || analysis?.verdict) return 'Result captured'
    return 'Result unavailable'
}

function extractIndicators(value: string) {
    const domains = value.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi) || []
    const ips = value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []
    return Array.from(new Set([...domains, ...ips].map(item => item.toLowerCase()))).slice(0, 80)
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
    }
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
        const url = typeof tool.url === 'string' ? tool.url.trim() : ''
        if (!id || !name || !/^https?:\/\//i.test(url)) return []
        return [{ id, name, url }]
    }).slice(0, 8)
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
