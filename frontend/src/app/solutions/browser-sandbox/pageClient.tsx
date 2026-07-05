'use client'

import { Check, Clipboard, Globe2, Play, Plus, RotateCcw, ShieldCheck, Square, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import config from '@/config'

type SessionState = 'prompt' | 'connecting' | 'live' | 'ended'
type SocketState = 'closed' | 'connecting' | 'open' | 'error'
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

const storageKey = 'hanasand:browser-sandbox:profiles:v1'
const profileApiPath = '/api/backend/browser-sandbox/profiles'
const brokerBaseUrl = process.env.NEXT_PUBLIC_BROWSER_SANDBOX_WS || `${config.url.api_client_wss}/ws/browser-sandbox`
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

export default function BrowserSandboxPageClient() {
    const [target, setTarget] = useState('')
    const [sessionState, setSessionState] = useState<SessionState>('prompt')
    const [socketState, setSocketState] = useState<SocketState>('closed')
    const [profiles, setProfiles] = useState<SandboxProfile[]>(defaultProfiles)
    const [selectedProfileId, setSelectedProfileId] = useState(defaultProfiles[0].id)
    const [captures, setCaptures] = useState<Capture[]>([])
    const [activeImage, setActiveImage] = useState<string | null>(null)
    const [activeUrl, setActiveUrl] = useState('')
    const [events, setEvents] = useState<string[]>(['Sandbox ready.'])
    const [customProfileName, setCustomProfileName] = useState('')
    const [customToolName, setCustomToolName] = useState('')
    const [customToolUrl, setCustomToolUrl] = useState('')
    const [profilesLoaded, setProfilesLoaded] = useState(false)
    const [profileSyncEnabled, setProfileSyncEnabled] = useState(false)
    const [profileSyncState, setProfileSyncState] = useState<'local' | 'loading' | 'synced' | 'saving' | 'error'>('loading')
    const socketRef = useRef<WebSocket | null>(null)

    const normalizedTarget = useMemo(() => normalizeTarget(target), [target])
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

    useEffect(() => () => {
        socketRef.current?.close()
        socketRef.current = null
    }, [])

    const startRun = useCallback(() => {
        const url = normalizeTarget(target)
        if (!url) return
        const id = sessionId()
        const socket = new WebSocket(brokerUrlForSession(brokerBaseUrl, id))
        socketRef.current?.close()
        socketRef.current = socket
        setCaptures([])
        setActiveImage(null)
        setActiveUrl(url)
        setSessionState('connecting')
        setSocketState('connecting')
        pushEvent(`Launching isolated browser for ${url}.`)

        socket.onopen = () => {
            setSocketState('open')
            socket.send(JSON.stringify({
                type: 'start',
                sessionId: id,
                network: 'regular',
                target: url,
                durationMinutes: 15,
                profileTools: selectedProfile.tools,
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
                setSessionState('live')
                pushEvent('Regular-web sandbox is live.')
                return
            }
            if (payload.type === 'frame' && typeof payload.image === 'string') {
                const image = `data:image/jpeg;base64,${payload.image}`
                setActiveImage(image)
                const urlValue = String(payload.url || url)
                setActiveUrl(urlValue)
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
                if (payload.url) setActiveUrl(String(payload.url))
                pushEvent(String(payload.message || payload.state || 'Browser status updated.'))
                return
            }
            if (payload.type === 'navigation_error' || payload.type === 'error') {
                pushEvent(String(payload.message || 'Sandbox navigation failed.'))
            }
        }
    }, [pushEvent, selectedProfile.tools, target])

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
        pushEvent('Sandbox reset.')
    }, [pushEvent])

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
                            <h1 className='text-3xl font-semibold tracking-normal text-ui-text md:text-5xl'>Regular Website Sandbox</h1>
                            <p className='mx-auto max-w-2xl text-base leading-7 text-ui-muted'>
                                Open an untrusted regular-web URL in a remote browser, capture URL changes as screenshots, and run saved investigation profiles for SOC triage context.
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
                            <p className='text-xs font-semibold uppercase text-ui-primary'>Regular website sandbox</p>
                            <h1 className='truncate text-lg font-semibold text-ui-text'>{activeUrl || normalizedTarget}</h1>
                        </div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <StatusPill label='Session' value={sessionState} good={sessionState === 'live'} />
                            <StatusPill label='Broker' value={socketState} good={socketState === 'open'} />
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
                        <div className='grid min-h-0 place-items-center bg-ui-canvas p-2'>
                            {activeImage ? (
                                <img src={activeImage} alt='Live regular website sandbox frame' className='max-h-full w-full rounded-md object-contain' />
                            ) : (
                                <div className='grid max-w-md gap-2 text-center'>
                                    <ShieldCheck className='mx-auto h-8 w-8 text-ui-primary' />
                                    <p className='text-lg font-semibold text-ui-text'>{sessionState === 'connecting' ? 'Launching isolated browser' : 'Waiting for first frame'}</p>
                                    <p className='text-sm leading-6 text-ui-muted'>The browser runs remotely; screenshots appear when navigation or redirects update the active tab.</p>
                                </div>
                            )}
                        </div>
                    </section>
                    <aside className='grid min-h-0 gap-4 xl:grid-rows-[auto_minmax(0,1fr)_auto]'>
                        <AnalystSummary summary={summary} />
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
                        {capture.evidence?.textExcerpt ? <p className='line-clamp-3 text-xs leading-5 text-ui-muted'>{capture.evidence.textExcerpt}</p> : null}
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
    const toolNames = toolCaptures.map(capture => capture.label).join(', ') || 'none yet'
    const toolAnalyses = toolCaptures.map(capture => capture.toolAnalysis).filter(Boolean) as SandboxToolAnalysis[]
    const virusTotal = toolAnalyses.find(item => item.toolKind === 'virustotal')
    const urlquery = toolAnalyses.find(item => item.toolKind === 'urlquery')
    const suspiciousCaptures = captures.filter(capture => capture.evidence?.verdict === 'suspicious')
    const obfuscatedScripts = captures.flatMap(capture => capture.evidence?.obfuscatedScripts || [])
    const deobfuscationTasks = captures.flatMap(capture => capture.evidence?.deobfuscationTasks || [])
    const webcrackLoads = captures.flatMap(capture => capture.webcrackLoad ? [capture.webcrackLoad] : [])
    const webcrackLoaded = webcrackLoads.filter(load => load.loaded).length
    const comments = captures.flatMap(capture => capture.evidence?.comments || []).slice(0, 4)
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
    const narrative = pageCaptures.length
        ? `The sandbox loaded ${target || 'the submitted URL'} and captured ${pageCaptures.length} browser state${pageCaptures.length === 1 ? '' : 's'}${redirected ? ' across at least one URL change' : ''}. Profile "${profile.name}" produced tool context from ${toolNames}. ${toolAnalyses.length ? toolAnalyses.flatMap(item => item.extractedSignals || []).join('; ') || 'External tools loaded but did not expose a parsed detection count yet.' : 'External tool detections are still pending.'} ${suspiciousCaptures.length ? `The rendered evidence is suspicious: ${suspiciousCaptures.flatMap(capture => capture.evidence?.reasons || []).slice(0, 3).join('; ')}.` : 'The rendered evidence is not conclusive yet.'} ${threatNarrative} ${comments.length ? `Community or page comments observed: ${comments.join(' ')}` : 'No community comments were extracted from the loaded pages yet.'}`
        : `The sandbox is preparing ${target || 'the submitted URL'}. Profile "${profile.name}" will capture external tool context for ${toolNames || 'selected tools'} when available.`

    return {
        narrative,
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
            { label: 'Highest confidence', value: confidence ? `${confidence}%` : 'unknown' },
            { label: 'Copyable indicators', value: String(allIndicators.length) },
        ],
    }
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
