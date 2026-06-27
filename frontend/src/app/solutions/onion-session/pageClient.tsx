'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, CheckCircle2, Clock3, Copy, Globe2, KeyRound, Monitor, Network, Play, Power, RadioTower, RotateCcw, ShieldCheck, Square, Terminal, Wifi, XCircle } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'

type SessionState = 'idle' | 'connecting' | 'live' | 'ended'

const networkItems: Array<{
    key: string
    title: string
    detail: string
    status: string
    icon: LucideIcon
}> = [
    { key: 'tor', title: 'Onion', detail: 'Short-span Tor workspace', status: 'Ready', icon: Network },
    { key: 'i2p', title: 'I2P', detail: 'Hidden-service expansion', status: 'Next', icon: RadioTower },
    { key: 'freenet', title: 'Freenet', detail: 'Public-data research mode', status: 'Next', icon: Globe2 },
    { key: 'ipfs', title: 'IPFS/libp2p', detail: 'Distributed source watch', status: 'Next', icon: Wifi },
]

const sessionLengths = [10, 15, 30, 60]

const buyerMetrics = [
    { label: 'Session window', value: '10-60m', detail: 'Auto-expiring review sessions' },
    { label: 'Default handling', value: 'Metadata', detail: 'No raw leaked files in workflow' },
    { label: 'Output', value: 'Packet', detail: 'Source, notes, route, timestamps' },
]

const operationalWorkflows = [
    { title: 'Source validation', detail: 'Open a new onion mirror, capture source state, and decide whether it belongs in monitoring.', icon: ShieldCheck },
    { title: 'Evidence-safe review', detail: 'Keep analysts in a remote viewport with screenshots, hashes, notes, and raw-content controls.', icon: Monitor },
    { title: 'Alert handoff', detail: 'Turn a session into a DWM alert packet, ticket, or webhook event without copying stolen material.', icon: Copy },
]

const buyerFit = [
    'Validate actor-page and leak-site claims before customer escalation.',
    'Review source changes from a short-lived remote browser instead of local analyst machines.',
    'Attach session notes, route state, capture mode, and source timing to downstream alerts.',
]

function formatTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0')
    return `${minutes}:${seconds}`
}

function normalizeTarget(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return 'http://sample-intel-source.onion'
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `http://${trimmed}`
}

function targetHost(value: string) {
    try {
        return new URL(normalizeTarget(value)).host || 'sample-intel-source.onion'
    } catch {
        return value.replace(/^https?:\/\//i, '').split('/')[0] || 'sample-intel-source.onion'
    }
}

function targetPath(value: string) {
    try {
        const parsed = new URL(normalizeTarget(value))
        return parsed.pathname === '/' ? '/claims' : parsed.pathname
    } catch {
        return '/claims'
    }
}

export default function OnionSessionPageClient() {
    const [activeNetwork, setActiveNetwork] = useState('tor')
    const [target, setTarget] = useState('http://sample-intel-source.onion')
    const [sessionMinutes, setSessionMinutes] = useState(15)
    const [sessionState, setSessionState] = useState<SessionState>('idle')
    const [remainingSeconds, setRemainingSeconds] = useState(sessionMinutes * 60)
    const [readOnly, setReadOnly] = useState(true)
    const [freshCircuit, setFreshCircuit] = useState(true)
    const [notes, setNotes] = useState('Watchlist: company, vendor, domain\nEvidence mode: metadata and source trace only')
    const [sessionId, setSessionId] = useState('pending')
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (sessionState === 'idle' || sessionState === 'ended') {
            setRemainingSeconds(sessionMinutes * 60)
        }
    }, [sessionMinutes, sessionState])

    useEffect(() => {
        if (sessionState !== 'live') return

        const interval = window.setInterval(() => {
            setRemainingSeconds((current) => {
                if (current <= 1) {
                    window.clearInterval(interval)
                    setSessionState('ended')
                    return 0
                }
                return current - 1
            })
        }, 1000)

        return () => window.clearInterval(interval)
    }, [sessionState])

    const activeSession = sessionState === 'connecting' || sessionState === 'live'
    const progress = Math.max(0, Math.min(100, (remainingSeconds / (sessionMinutes * 60)) * 100))
    const normalizedTarget = useMemo(() => normalizeTarget(target), [target])
    const host = useMemo(() => targetHost(target), [target])
    const path = useMemo(() => targetPath(target), [target])

    const eventLog = useMemo(() => {
        const base = [
            'Workspace policy loaded',
            `${readOnly ? 'Read-only' : 'Interactive'} browser mode selected`,
            freshCircuit ? 'Fresh circuit required for session start' : 'Session may reuse live circuit',
        ]

        if (sessionState === 'connecting') return [...base, `Dialing ${activeNetwork.toUpperCase()} broker`, `Target queued: ${normalizedTarget}`]
        if (sessionState === 'live') return [...base, 'Connection broker ready', `Remote viewport rendered for ${normalizedTarget}`, 'Metadata capture armed']
        if (sessionState === 'ended') return [...base, 'Session closed', 'Evidence packet ready for review']
        return [...base, 'Waiting for session start']
    }, [activeNetwork, freshCircuit, normalizedTarget, readOnly, sessionState])

    const startSession = () => {
        const id = `os-${Date.now().toString(36)}`
        setSessionId(id)
        setCopied(false)
        setTarget(normalizedTarget)
        setRemainingSeconds(sessionMinutes * 60)
        setSessionState('connecting')
        window.setTimeout(() => setSessionState('live'), 850)
    }

    const endSession = () => {
        setSessionState('ended')
        setRemainingSeconds(0)
    }

    const resetSession = () => {
        setSessionState('idle')
        setCopied(false)
        setSessionId('pending')
        setRemainingSeconds(sessionMinutes * 60)
    }

    const copyPacket = async () => {
        const packet = JSON.stringify({
            session_id: sessionId,
            network: activeNetwork,
            target: normalizedTarget,
            duration_minutes: sessionMinutes,
            read_only: readOnly,
            fresh_circuit: freshCircuit,
            state: sessionState,
            notes,
        }, null, 2)

        await navigator.clipboard.writeText(packet)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
    }

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#f6f8fb] text-[#171a21] dark:bg-[#0b111a] dark:text-[#f5f7fb]'>
            <section className='border-b border-[#dfe5ee] bg-white dark:border-[#243044] dark:bg-[#0e1520]'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-8 md:py-16'>
                    <div className='grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center'>
                        <div className='grid gap-4'>
                            <p className='text-sm font-semibold uppercase text-[#3056d3]'>Onion Session Workspace</p>
                            <h1 className='text-4xl font-semibold tracking-normal text-[#111318] md:text-6xl dark:text-[#f5f7fb]'>Controlled onion review without moving raw material onto analyst machines.</h1>
                            <p className='max-w-3xl text-lg leading-8 text-[#596170] dark:text-[#a8b3c5]'>
                                Open a short-lived remote session, validate a source, capture metadata and notes, then hand off an evidence packet to monitoring, vendor-risk, or incident response.
                            </p>
                            <div className='flex flex-wrap gap-3'>
                                <a href='#workspace' className='inline-flex h-11 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                                    Open workspace
                                    <ArrowRight className='h-4 w-4' />
                                </a>
                                <Link href='/contact?intent=onion-session' className='inline-flex h-11 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#171a21] transition hover:border-[#bdc7d5] dark:border-[#2b3a52] dark:bg-[#111927] dark:text-[#eef3fb]'>
                                    Talk coverage
                                </Link>
                                <Link href='/solutions/dwm' className='inline-flex h-11 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#171a21] transition hover:border-[#bdc7d5] dark:border-[#2b3a52] dark:bg-[#111927] dark:text-[#eef3fb]'>
                                    Monitoring alerts
                                </Link>
                            </div>
                            <div className='grid gap-3 border-t border-[#edf1f6] pt-5 dark:border-[#26344a] sm:grid-cols-3'>
                                {buyerMetrics.map(metric => (
                                    <div key={metric.label}>
                                        <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#a8b3c5]'>{metric.label}</p>
                                        <p className='mt-1 text-lg font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{metric.value}</p>
                                        <p className='mt-1 text-xs leading-5 text-[#667085] dark:text-[#a8b3c5]'>{metric.detail}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className='grid gap-3 rounded-lg border border-[#dfe5ee] bg-[#101722] p-4 text-white shadow-[0_22px_70px_rgba(24,32,52,0.18)]'>
                            <div className='flex items-center justify-between gap-3 border-b border-white/10 pb-3'>
                                <div className='flex items-center gap-2'>
                                    <span className='grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-[#9fc0ff]'>
                                        <Monitor className='h-4.5 w-4.5' />
                                    </span>
                                    <div>
                                        <p className='text-sm font-semibold'>Session desk</p>
                                        <p className='text-xs text-[#aab6c8]'>Isolated viewport broker</p>
                                    </div>
                                </div>
                                <span className='rounded-full border border-[#2b8f5a]/40 bg-[#123824] px-2.5 py-1 text-xs font-semibold text-[#8ee5ad]'>{sessionState === 'live' ? 'Live' : sessionState}</span>
                            </div>
                            <div className='grid grid-cols-3 gap-3 text-sm'>
                                <div className='rounded-lg border border-white/10 bg-white/6 p-3'>
                                    <p className='text-xs text-[#aab6c8]'>Timer</p>
                                    <p className='mt-1 font-mono text-xl text-white'>{formatTime(remainingSeconds)}</p>
                                </div>
                                <div className='rounded-lg border border-white/10 bg-white/6 p-3'>
                                    <p className='text-xs text-[#aab6c8]'>Circuit</p>
                                    <p className='mt-1 font-semibold text-white'>{freshCircuit ? 'Fresh' : 'Reusable'}</p>
                                </div>
                                <div className='rounded-lg border border-white/10 bg-white/6 p-3'>
                                    <p className='text-xs text-[#aab6c8]'>Mode</p>
                                    <p className='mt-1 font-semibold text-white'>{readOnly ? 'Read-only' : 'Interactive'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className='border-b border-[#dfe5ee] bg-[#f8fafc] dark:border-[#243044] dark:bg-[#0b111a]'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8 lg:grid-cols-[0.75fr_1.25fr]'>
                    <div className='grid content-start gap-3'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Operational workflow</p>
                        <h2 className='text-3xl font-semibold text-[#171a21] dark:text-[#f5f7fb]'>A browser-shaped control plane for sensitive source checks.</h2>
                        <div className='mt-3 grid gap-2'>
                            {buyerFit.map(item => (
                                <div key={item} className='flex items-start gap-2 text-sm leading-6 text-[#3d4656] dark:text-[#d9e2f2]'>
                                    <CheckCircle2 className='mt-1 h-4 w-4 shrink-0 text-[#147a3b]' />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className='grid gap-4 md:grid-cols-3'>
                        {operationalWorkflows.map(item => {
                            const Icon = item.icon
                            return (
                                <article key={item.title} className='grid gap-4 rounded-lg border border-[#e0e5ed] bg-white p-5 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
                                    <span className='grid h-11 w-11 place-items-center rounded-lg border border-[#dfe6f1] bg-[#f7f9fc] text-[#3056d3] dark:border-[#2b3a52] dark:bg-[#172234]'>
                                        <Icon className='h-5 w-5' />
                                    </span>
                                    <div className='grid gap-2'>
                                        <h3 className='text-lg font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{item.title}</h3>
                                        <p className='text-sm leading-6 text-[#596170] dark:text-[#a8b3c5]'>{item.detail}</p>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section id='workspace' className='border-b border-[#dfe5ee] bg-[#f6f8fb] dark:border-[#243044] dark:bg-[#0b111a]'>
                <div className='mx-auto grid max-w-7xl gap-5 px-4 py-8 md:px-8 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]'>
                    <aside className='grid content-start gap-4'>
                        <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
                            <h2 className='text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>Networks</h2>
                            <div className='mt-3 grid gap-2'>
                                {networkItems.map((item) => {
                                    const Icon = item.icon
                                    const selected = activeNetwork === item.key
                                    const enabled = item.key === 'tor'
                                    return (
                                        <button
                                            key={item.key}
                                            type='button'
                                            onClick={() => enabled && setActiveNetwork(item.key)}
                                            className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-lg border p-3 text-left transition ${selected ? 'border-[#3056d3] bg-[#eef3ff] dark:bg-[#172b55]' : 'border-[#e3e8f0] bg-white hover:border-[#cbd5e1] dark:border-[#2b3a52] dark:bg-[#0e1520] dark:hover:border-[#40516b]'} ${enabled ? '' : 'opacity-75'}`}
                                            aria-pressed={selected}
                                        >
                                            <span className={`grid h-10 w-10 place-items-center rounded-lg ${selected ? 'bg-white text-[#3056d3]' : 'bg-[#f7f9fc] text-[#667085]'}`}>
                                                <Icon className='h-4.5 w-4.5' />
                                            </span>
                                            <span className='min-w-0'>
                                                <span className='block text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{item.title}</span>
                                                <span className='block truncate text-xs text-[#667085] dark:text-[#a8b3c5]'>{item.detail}</span>
                                            </span>
                                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${enabled ? 'bg-[#e8f7ee] text-[#147a3b]' : 'bg-[#f1f3f6] text-[#697386]'}`}>{item.status}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
                            <h2 className='text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>Session policy</h2>
                            <div className='mt-4 grid gap-4'>
                                <label className='grid gap-1.5'>
                                    <span className='text-xs font-semibold uppercase text-[#667085]'>Target</span>
                                    <input
                                        value={target}
                                        onChange={(event) => setTarget(event.target.value)}
                                        className='h-11 rounded-lg border border-[#d8dee9] bg-white px-3 font-mono text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-3 focus:ring-[#3056d3]/12 dark:border-[#2b3a52] dark:bg-[#0e1520] dark:text-[#eef3fb]'
                                    />
                                </label>
                                <button
                                    type='button'
                                    onClick={() => setTarget('http://sample-intel-source.onion/claims')}
                                    className='inline-flex h-10 items-center justify-center rounded-lg border border-[#dfe5ee] bg-[#f8fafc] px-3 text-sm font-semibold text-[#3d4656] transition hover:border-[#bdc7d5] dark:border-[#2b3a52] dark:bg-[#0e1520] dark:text-[#d9e2f2]'
                                >
                                    Load sample onion page
                                </button>
                                <div className='grid gap-2'>
                                    <span className='text-xs font-semibold uppercase text-[#667085]'>Session length</span>
                                    <div className='grid grid-cols-4 gap-2'>
                                        {sessionLengths.map((minutes) => (
                                            <button
                                                key={minutes}
                                                type='button'
                                                onClick={() => setSessionMinutes(minutes)}
                                                className={`h-10 rounded-lg border text-sm font-semibold transition ${sessionMinutes === minutes ? 'border-[#3056d3] bg-[#eef3ff] text-[#3056d3]' : 'border-[#dfe5ee] bg-white text-[#3d4656] hover:border-[#bdc7d5]'}`}
                                            >
                                                {minutes}m
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <label className='flex items-center justify-between gap-3 rounded-lg border border-[#e3e8f0] px-3 py-2.5 dark:border-[#2b3a52]'>
                                    <span className='text-sm font-medium text-[#3d4656] dark:text-[#d9e2f2]'>Read-only viewport</span>
                                    <input type='checkbox' checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} className='h-5 w-5 accent-[#3056d3]' />
                                </label>
                                <label className='flex items-center justify-between gap-3 rounded-lg border border-[#e3e8f0] px-3 py-2.5 dark:border-[#2b3a52]'>
                                    <span className='text-sm font-medium text-[#3d4656] dark:text-[#d9e2f2]'>Fresh circuit</span>
                                    <input type='checkbox' checked={freshCircuit} onChange={(event) => setFreshCircuit(event.target.checked)} className='h-5 w-5 accent-[#3056d3]' />
                                </label>
                            </div>
                        </div>
                    </aside>

                    <section className='min-w-0 overflow-hidden rounded-lg border border-[#d9e1ec] bg-white shadow-[0_20px_70px_rgba(26,35,55,0.12)] dark:border-[#273345] dark:bg-[#111927]'>
                        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf4] bg-[#f8fafc] px-4 py-3 dark:border-[#273345] dark:bg-[#0e1520]'>
                            <div className='flex min-w-0 items-center gap-2'>
                                <span className='grid h-9 w-9 place-items-center rounded-lg border border-[#dfe6f1] bg-white text-[#3056d3] dark:border-[#2b3a52] dark:bg-[#172234]'>
                                    <Terminal className='h-4.5 w-4.5' />
                                </span>
                                <div className='min-w-0'>
                                    <p className='truncate text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{normalizedTarget}</p>
                                    <p className='text-xs text-[#667085] dark:text-[#a8b3c5]'>Session {sessionId}</p>
                                </div>
                            </div>
                            <div className='flex flex-wrap items-center gap-2'>
                                {sessionState === 'live' ? (
                                    <button type='button' onClick={endSession} className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#f0c8c8] bg-[#fff5f5] px-3 text-sm font-semibold text-[#b42318] transition hover:border-[#d92d20]'>
                                        <Square className='h-4 w-4' />
                                        End
                                    </button>
                                ) : (
                                    <button type='button' onClick={startSession} disabled={sessionState === 'connecting'} className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-wait disabled:opacity-70'>
                                        <Play className='h-4 w-4' />
                                        Start
                                    </button>
                                )}
                                <button type='button' onClick={resetSession} className='grid h-10 w-10 place-items-center rounded-lg border border-[#dfe5ee] bg-white text-[#3d4656] transition hover:border-[#bdc7d5] dark:border-[#2b3a52] dark:bg-[#111927] dark:text-[#d9e2f2]' aria-label='Reset session'>
                                    <RotateCcw className='h-4 w-4' />
                                </button>
                            </div>
                        </div>

                        <div className='grid min-h-[32rem] grid-rows-[auto_1fr_auto] bg-[#111827]'>
                            <div className='flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#0d1420] px-3 py-2'>
                                <span className='h-3 w-3 rounded-full bg-[#ff5f57]' />
                                <span className='h-3 w-3 rounded-full bg-[#febc2e]' />
                                <span className='h-3 w-3 rounded-full bg-[#28c840]' />
                                <div className='ml-2 min-w-0 flex-1 rounded-md border border-white/10 bg-white/8 px-3 py-1.5 font-mono text-xs text-[#dbe5f4]'>
                                    {normalizedTarget}
                                </div>
                                <span className='inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs font-semibold text-[#b9c5d6]'>
                                    <Clock3 className='h-3.5 w-3.5' />
                                    {formatTime(remainingSeconds)}
                                </span>
                            </div>

                            <div className='min-h-0 p-4'>
                                {sessionState === 'live' ? (
                                    <OnionBrowserPreview host={host} path={path} readOnly={readOnly} freshCircuit={freshCircuit} />
                                ) : (
                                    <div className='grid min-h-[27rem] place-items-center'>
                                        <div className='grid w-full max-w-3xl gap-4 rounded-lg border border-white/10 bg-[#172033] p-5 text-center shadow-[0_18px_60px_rgba(0,0,0,0.25)]'>
                                            <div className='mx-auto grid h-16 w-16 place-items-center rounded-lg border border-[#4368df]/40 bg-[#1f2d4a] text-[#9fc0ff]'>
                                                {sessionState === 'ended' ? <XCircle className='h-7 w-7' /> : <Power className='h-7 w-7' />}
                                            </div>
                                            <div className='grid gap-1'>
                                                <h2 className='text-2xl font-semibold text-white'>
                                                    {sessionState === 'connecting' ? 'Opening isolated workspace' : sessionState === 'ended' ? 'Session closed' : 'Workspace ready'}
                                                </h2>
                                                <p className='mx-auto max-w-xl text-sm leading-6 text-[#aab6c8]'>
                                                    The browser shell, policy controls, and evidence packet are prepared before broker attachment.
                                                </p>
                                            </div>
                                            <div className='grid gap-3 md:grid-cols-3'>
                                                <div className='rounded-lg border border-white/10 bg-white/6 p-3 text-left'>
                                                    <p className='text-xs text-[#aab6c8]'>Route health</p>
                                                    <p className='mt-1 text-sm font-semibold text-white'>{activeSession ? 'Broker online' : 'Standby'}</p>
                                                </div>
                                                <div className='rounded-lg border border-white/10 bg-white/6 p-3 text-left'>
                                                    <p className='text-xs text-[#aab6c8]'>Capture</p>
                                                    <p className='mt-1 text-sm font-semibold text-white'>Metadata only</p>
                                                </div>
                                                <div className='rounded-lg border border-white/10 bg-white/6 p-3 text-left'>
                                                    <p className='text-xs text-[#aab6c8]'>Next networks</p>
                                                    <p className='mt-1 text-sm font-semibold text-white'>I2P, Freenet, IPFS</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className='border-t border-white/10 bg-[#0d1420] px-4 py-3'>
                                <div className='h-2 overflow-hidden rounded-full bg-white/10'>
                                    <div className='h-full rounded-full bg-[#8ee5ad] transition-all duration-500' style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside className='grid content-start gap-4'>
                        <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
                            <div className='flex items-center justify-between gap-3'>
                                <h2 className='text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>Evidence packet</h2>
                                <button type='button' onClick={copyPacket} className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#dfe5ee] px-2.5 text-xs font-semibold text-[#3d4656] transition hover:border-[#bdc7d5] dark:border-[#2b3a52] dark:text-[#d9e2f2]'>
                                    <Copy className='h-3.5 w-3.5' />
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <div className='mt-3 grid gap-2 text-sm'>
                                <div className='flex items-center justify-between border-b border-[#eef1f5] py-2'>
                                    <span className='text-[#667085] dark:text-[#a8b3c5]'>Source</span>
                                    <span className='font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{activeNetwork}</span>
                                </div>
                                <div className='flex items-center justify-between border-b border-[#eef1f5] py-2'>
                                    <span className='text-[#667085] dark:text-[#a8b3c5]'>Window</span>
                                    <span className='font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{sessionMinutes} min</span>
                                </div>
                                <div className='flex items-center justify-between border-b border-[#eef1f5] py-2'>
                                    <span className='text-[#667085] dark:text-[#a8b3c5]'>Handling</span>
                                    <span className='font-semibold text-[#171a21] dark:text-[#f5f7fb]'>Metadata</span>
                                </div>
                            </div>
                        </div>

                        <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
                            <h2 className='text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>Event log</h2>
                            <div className='mt-3 grid gap-2'>
                                {eventLog.map((entry, index) => (
                                    <div key={`${entry}-${index}`} className='grid grid-cols-[1.5rem_1fr] gap-2 text-sm'>
                                        <span className='mt-1 h-2 w-2 rounded-full bg-[#3056d3]' />
                                        <span className='leading-6 text-[#3d4656] dark:text-[#d9e2f2]'>{entry}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#273345] dark:bg-[#111927]'>
                            <div className='flex items-center gap-2'>
                                <KeyRound className='h-4 w-4 text-[#3056d3]' />
                                <h2 className='text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>Analyst notes</h2>
                            </div>
                            <textarea
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                className='mt-3 min-h-36 w-full resize-none rounded-lg border border-[#d8dee9] bg-white p-3 text-sm leading-6 text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-3 focus:ring-[#3056d3]/12 dark:border-[#2b3a52] dark:bg-[#0e1520] dark:text-[#eef3fb]'
                            />
                        </div>
                    </aside>
                </div>
            </section>

            <section className='bg-white dark:bg-[#0e1520]'>
                <div className='mx-auto grid max-w-7xl gap-5 px-4 py-12 md:px-8 lg:grid-cols-[0.8fr_1.2fr]'>
                    <div className='grid content-start gap-3'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Product fit</p>
                        <h2 className='text-3xl font-semibold text-[#171a21] dark:text-[#f5f7fb]'>Built for owned collection, not scraped-row bloat.</h2>
                    </div>
                    <div className='grid gap-4 md:grid-cols-3'>
                        {[
                            { title: 'Source tracking', detail: 'Every session starts from a target, source policy, network, and handling mode.', icon: ShieldCheck },
                            { title: 'Webhook handoff', detail: 'Session packets can feed customer workflows without storing raw leaked material.', icon: Copy },
                            { title: 'Network expansion', detail: 'The same workspace model can attach I2P, Freenet, IPFS, and other large P2P sources.', icon: Network },
                        ].map((item) => {
                            const Icon = item.icon
                            return (
                                <article key={item.title} className='grid gap-3 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4 dark:border-[#273345] dark:bg-[#111927]'>
                                    <span className='grid h-10 w-10 place-items-center rounded-lg border border-[#dfe6f1] bg-white text-[#3056d3] dark:border-[#2b3a52] dark:bg-[#172234]'>
                                        <Icon className='h-4.5 w-4.5' />
                                    </span>
                                    <h3 className='text-base font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{item.title}</h3>
                                    <p className='text-sm leading-6 text-[#596170] dark:text-[#a8b3c5]'>{item.detail}</p>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className='border-t border-[#dfe5ee] bg-[#f8fafc] dark:border-[#243044] dark:bg-[#0b111a]'>
                <div className='mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-8'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Buying path</p>
                        <h2 className='mt-2 text-3xl font-semibold text-[#171a21] dark:text-[#f5f7fb]'>Bundle onion sessions with monitoring when source validation matters.</h2>
                        <p className='mt-2 max-w-3xl text-sm leading-6 text-[#596170] dark:text-[#a8b3c5]'>Use the workspace for source review and DWM for continuous alerts. Pricing starts from the same monitoring tiers as the rest of the product.</p>
                    </div>
                    <div className='flex flex-wrap gap-3'>
                        <Link href='/pricing' className='inline-flex h-11 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#171a21] transition hover:border-[#bdc7d5] dark:border-[#2b3a52] dark:bg-[#111927] dark:text-[#eef3fb]'>
                            View pricing
                        </Link>
                        <Link href='/contact?intent=onion-session' className='inline-flex h-11 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                            Contact sales
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    )
}

function OnionBrowserPreview({ host, path, readOnly, freshCircuit }: { host: string; path: string; readOnly: boolean; freshCircuit: boolean }) {
    const rows = [
        { actor: 'Black Harbor', company: 'Northwind Components', claim: 'supplier records mentioned', seen: '2 min ago', state: 'watchlist' },
        { actor: 'Night Ledger', company: 'Acme Payments', claim: 'contract archive claim', seen: '11 min ago', state: 'review' },
        { actor: 'Vanta Ridge', company: 'Contoso Health', claim: 'new listing metadata', seen: '18 min ago', state: 'new' },
    ]

    return (
        <div className='min-h-[27rem] overflow-hidden rounded-lg border border-[#29364b] bg-[#e8edf4] shadow-[0_18px_60px_rgba(0,0,0,0.24)] dark:bg-[#0f1724]'>
            <div className='flex items-center justify-between gap-3 border-b border-[#cbd5e1] bg-[#f8fafc] px-3 py-2 text-[#1f2937] dark:border-[#2b3a52] dark:bg-[#111927] dark:text-[#f5f7fb]'>
                <div className='flex min-w-0 items-center gap-2'>
                    <span className='grid h-8 w-8 place-items-center rounded-md bg-[#111827] text-[#8ee5ad]'>
                        <CheckCircle2 className='h-4 w-4' />
                    </span>
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold'>{host}</p>
                        <p className='truncate font-mono text-[11px] text-[#64748b] dark:text-[#a8b3c5]'>{path}</p>
                    </div>
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                    <span className='rounded-full border border-[#bbf7d0] bg-[#ecfdf3] px-2 py-1 text-[11px] font-semibold text-[#147a3b]'>{freshCircuit ? 'fresh circuit' : 'live circuit'}</span>
                    <span className='rounded-full border border-[#dbe2ea] bg-white px-2 py-1 text-[11px] font-semibold text-[#475467] dark:border-[#3a4a63] dark:bg-[#172234] dark:text-[#d9e2f2]'>{readOnly ? 'read-only' : 'interactive'}</span>
                </div>
            </div>

            <div className='grid gap-4 bg-[#f8fafc] p-4 text-[#111827] dark:bg-[#0f1724] dark:text-[#f5f7fb]'>
                <header className='grid gap-3 border-b border-[#dbe2ea] pb-4 dark:border-[#2b3a52] md:grid-cols-[1fr_auto] md:items-end'>
                    <div>
                        <p className='text-xs font-semibold uppercase text-[#3056d3]'>Onion source preview</p>
                        <h3 className='mt-1 text-2xl font-semibold tracking-normal text-[#111827] dark:text-[#f5f7fb]'>Claims and source metadata</h3>
                        <p className='mt-2 max-w-2xl text-sm leading-6 text-[#475467] dark:text-[#a8b3c5]'>Rendered inside the isolated session viewport with raw-content handling disabled.</p>
                    </div>
                    <div className='grid grid-cols-3 gap-2 text-center text-xs'>
                        <span className='rounded-lg border border-[#dbe2ea] bg-white px-3 py-2 text-[#475467] dark:border-[#2b3a52] dark:bg-[#111927] dark:text-[#a8b3c5]'><strong className='block text-base text-[#111827] dark:text-[#f5f7fb]'>3</strong>matches</span>
                        <span className='rounded-lg border border-[#dbe2ea] bg-white px-3 py-2 text-[#475467] dark:border-[#2b3a52] dark:bg-[#111927] dark:text-[#a8b3c5]'><strong className='block text-base text-[#111827] dark:text-[#f5f7fb]'>12m</strong>freshest</span>
                        <span className='rounded-lg border border-[#dbe2ea] bg-white px-3 py-2 text-[#475467] dark:border-[#2b3a52] dark:bg-[#111927] dark:text-[#a8b3c5]'><strong className='block text-base text-[#111827] dark:text-[#f5f7fb]'>0</strong>files</span>
                    </div>
                </header>

                <div className='overflow-x-auto rounded-lg border border-[#dbe2ea] bg-white dark:border-[#2b3a52] dark:bg-[#111927]'>
                    <div className='min-w-[48rem]'>
                        <div className='grid grid-cols-[7.5rem_minmax(10rem,1fr)_9rem_6rem_6rem] gap-3 border-b border-[#e5eaf1] bg-[#f1f5f9] px-3 py-2 text-[11px] font-semibold uppercase text-[#64748b] dark:border-[#2b3a52] dark:bg-[#172234] dark:text-[#a8b3c5]'>
                            <span>Actor</span>
                            <span>Company</span>
                            <span>Claim</span>
                            <span>Seen</span>
                            <span className='text-right'>State</span>
                        </div>
                        <div className='divide-y divide-[#eef2f7] dark:divide-[#26344a]'>
                            {rows.map((row) => (
                                <div key={`${row.actor}-${row.company}`} className='grid grid-cols-[7.5rem_minmax(10rem,1fr)_9rem_6rem_6rem] items-center gap-3 px-3 py-3 text-sm'>
                                    <span className='truncate font-semibold text-[#111827] dark:text-[#f5f7fb]'>{row.actor}</span>
                                    <span className='truncate text-[#344054] dark:text-[#d9e2f2]'>{row.company}</span>
                                    <span className='truncate text-[#475467] dark:text-[#a8b3c5]'>{row.claim}</span>
                                    <span className='truncate font-mono text-xs text-[#64748b] dark:text-[#a8b3c5]'>{row.seen}</span>
                                    <span className='justify-self-end rounded-full bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{row.state}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className='grid gap-3 md:grid-cols-3'>
                    <div className='rounded-lg border border-[#dbe2ea] bg-white p-3 dark:border-[#2b3a52] dark:bg-[#111927]'>
                        <p className='text-xs font-semibold uppercase text-[#64748b] dark:text-[#a8b3c5]'>Source URL</p>
                        <p className='mt-1 truncate font-mono text-sm text-[#111827] dark:text-[#f5f7fb]'>{host}{path}</p>
                    </div>
                    <div className='rounded-lg border border-[#dbe2ea] bg-white p-3 dark:border-[#2b3a52] dark:bg-[#111927]'>
                        <p className='text-xs font-semibold uppercase text-[#64748b] dark:text-[#a8b3c5]'>Capture mode</p>
                        <p className='mt-1 text-sm font-semibold text-[#111827] dark:text-[#f5f7fb]'>Metadata and screenshots</p>
                    </div>
                    <div className='rounded-lg border border-[#dbe2ea] bg-white p-3 dark:border-[#2b3a52] dark:bg-[#111927]'>
                        <p className='text-xs font-semibold uppercase text-[#64748b] dark:text-[#a8b3c5]'>Customer output</p>
                        <p className='mt-1 text-sm font-semibold text-[#111827] dark:text-[#f5f7fb]'>Alert-ready event</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
