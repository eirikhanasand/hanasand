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
    deobfuscationTasks?: Array<{
        scriptId?: string
        source?: string
        webcrackReady?: boolean
        sample?: string
        decodedPreview?: string
        decodedTransforms?: string[]
        indicators?: { domains?: string[]; ips?: string[]; urls?: string[] }
        assessment?: string
        summary?: string
    }>
}

const storageKey = 'hanasand:browser-sandbox:profiles:v1'
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
    const [profilesLoaded, setProfilesLoaded] = useState(false)
    const socketRef = useRef<WebSocket | null>(null)

    const normalizedTarget = useMemo(() => normalizeTarget(target), [target])
    const selectedProfile = useMemo(() => profiles.find(profile => profile.id === selectedProfileId) || profiles[0], [profiles, selectedProfileId])
    const summary = useMemo(() => buildAnalystSummary(normalizedTarget, captures, selectedProfile), [captures, normalizedTarget, selectedProfile])

    const pushEvent = useCallback((event: string) => {
        setEvents(current => [event, ...current].slice(0, 8))
    }, [])

    useEffect(() => {
        try {
            const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]') as SandboxProfile[]
            if (Array.isArray(stored) && stored.length) {
                setProfiles(mergeProfiles(stored))
                setSelectedProfileId(stored[0]?.id || defaultProfiles[0].id)
            }
        } catch {
            setProfiles(defaultProfiles)
        } finally {
            setProfilesLoaded(true)
        }
    }, [])

    useEffect(() => {
        if (!profilesLoaded) return
        window.localStorage.setItem(storageKey, JSON.stringify(profiles.filter(profile => !defaultProfiles.some(item => item.id === profile.id))))
    }, [profiles, profilesLoaded])

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
                setCaptures(current => addCapture(current, {
                    id: `page-${payload.capturedAt || Date.now()}-${current.length}`,
                    kind: 'page',
                    label: payload.reason === 'navigation' ? 'Navigation capture' : 'Page capture',
                    url: urlValue,
                    title: stringValue(payload.title),
                    capturedAt: stringValue(payload.capturedAt) || new Date().toISOString(),
                    reason: stringValue(payload.reason),
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
        if (defaultProfiles.some(profile => profile.id === id)) return
        setProfiles(current => current.filter(profile => profile.id !== id))
        if (selectedProfileId === id) setSelectedProfileId(defaultProfiles[0].id)
    }, [selectedProfileId])

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
                                </div>
                                <div className='flex gap-2'>
                                    <input value={customProfileName} onChange={event => setCustomProfileName(event.target.value)} placeholder='Profile name' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none' />
                                    <button type='button' onClick={saveProfile} className='grid h-9 w-9 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary' aria-label='Save profile'>
                                        <Plus className='h-4 w-4' />
                                    </button>
                                </div>
                            </div>
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
            {summary.deobfuscationTasks.length ? (
                <div className='mt-3 rounded-md border border-ui-warning/30 bg-ui-warning/10 p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-warning'>WebCrack queue</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>{summary.deobfuscationTasks.length} script sample{summary.deobfuscationTasks.length === 1 ? '' : 's'} ready for deobfuscation review. {summary.deobfuscationSummary}</p>
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
    const narrative = pageCaptures.length
        ? `The sandbox loaded ${target || 'the submitted URL'} and captured ${pageCaptures.length} browser state${pageCaptures.length === 1 ? '' : 's'}${redirected ? ' across at least one URL change' : ''}. Profile "${profile.name}" produced tool context from ${toolNames}. ${toolAnalyses.length ? toolAnalyses.flatMap(item => item.extractedSignals || []).join('; ') || 'External tools loaded but did not expose a parsed detection count yet.' : 'External tool detections are still pending.'} ${suspiciousCaptures.length ? `The rendered evidence is suspicious: ${suspiciousCaptures.flatMap(capture => capture.evidence?.reasons || []).slice(0, 3).join('; ')}.` : 'The rendered evidence is not conclusive yet.'} ${comments.length ? `Community or page comments observed: ${comments.join(' ')}` : 'No community comments were extracted from the loaded pages yet.'}`
        : `The sandbox is preparing ${target || 'the submitted URL'}. Profile "${profile.name}" will capture external tool context for ${toolNames || 'selected tools'} when available.`

    return {
        narrative,
        indicators: allIndicators,
        deobfuscationTasks,
        deobfuscationSummary,
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
            { label: 'Obfuscated scripts', value: String(obfuscatedScripts.length) },
            { label: 'Highest confidence', value: confidence ? `${confidence}%` : 'unknown' },
            { label: 'Copyable indicators', value: String(allIndicators.length) },
        ],
    }
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

function mergeProfiles(input: SandboxProfile[]) {
    const merged = [...input, ...defaultProfiles]
    const seen = new Set<string>()
    return merged.filter(profile => {
        if (!profile?.id || seen.has(profile.id)) return false
        seen.add(profile.id)
        return true
    })
}
