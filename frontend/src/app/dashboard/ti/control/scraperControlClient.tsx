'use client'

import type { SyntheticEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, Clock3, DatabaseZap, FileSearch, Gauge, GitBranch, History, ListChecks, PauseCircle, PlayCircle, RefreshCcw, RotateCcw, Search, SlidersHorizontal, UserRound, Workflow, XCircle } from 'lucide-react'

type EndpointState = { ok: boolean; status: number; error?: string }
type ControlSnapshot = {
    ok: boolean
    generatedAt: string
    query?: string
    baseConfigured?: boolean
    error?: { code: string; message: string }
    endpoints?: Record<string, EndpointState>
    health?: Record<string, unknown>
    sources?: { sources?: unknown[] }
    frontier?: { queued?: number; tasks?: unknown[] }
    resources?: { queue?: Record<string, unknown>; workers?: unknown[] }
    productSlo?: Record<string, unknown>
    scheduler?: Record<string, unknown>
    exposureParser?: Record<string, unknown>
    quality?: Record<string, unknown>
    publicChannel?: Record<string, unknown>
    restricted?: Record<string, unknown>
    contracts?: Record<string, unknown>
    sourceInventory?: Record<string, unknown>
    sourcePacks?: Record<string, unknown>
    alerts?: { alerts?: unknown[] }
    watchlists?: { watchlists?: unknown[] }
    deliveries?: { deliveries?: unknown[] }
}

type ActionResult = {
    ok: boolean
    status?: number
    payload?: unknown
    error?: { code?: string; message?: string } | string
}

type SourceRow = {
    id: string
    name: string
    type: string
    status: string
    risk: string
    url: string
    trustScore: number
    tags: string[]
    crawlFrequencySeconds: number
    legalNotes: string
}

type FrontierTask = {
    id: string
    sourceId: string
    url: string
    discoveredAt: string
    anchorText: string
    fairnessKey: string
    score: number
}

type WorkItem = {
    id: string
    kind: 'run' | 'frontier_task' | 'source' | 'quality' | 'policy' | 'release' | 'platform'
    title: string
    subtitle: string
    queue: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    status: string
    timestamp: string
    sourceId?: string
    task?: FrontierTask
    evidence: Array<{ label: string; value: string }>
    nextActions: string[]
}

type LocalControl = {
    sourcePaused: Record<string, boolean>
    notes: Record<string, string>
    decisions: Record<string, { status: string; reason: string; at: string }>
}

const defaultQuery = 'watchlist terms'

export default function TiScraperControlClient() {
    const [query, setQuery] = useState(defaultQuery)
    const [snapshot, setSnapshot] = useState<ControlSnapshot | null>(null)
    const [selectedWorkId, setSelectedWorkId] = useState('')
    const [loading, setLoading] = useState(true)
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [actionResult, setActionResult] = useState<ActionResult | null>(null)
    const [error, setError] = useState('')
    const [localControl, setLocalControl] = useState<LocalControl>({ sourcePaused: {}, notes: {}, decisions: {} })
    const [sourceTarget, setSourceTarget] = useState('@threatintel')
    const [watchTerms, setWatchTerms] = useState('hanasand.com')

    async function load(nextQuery = query, silent = false) {
        if (!silent) setLoading(true)
        setError('')
        try {
            const response = await fetch(`/api/ti/scraper/control?q=${encodeURIComponent(nextQuery)}`, { cache: 'no-store' })
            const payload = await response.json() as ControlSnapshot
            setSnapshot(payload)
            const nextItems = workItemsFor(payload, sourcesFrom(payload), frontierTasksFrom(payload))
            setSelectedWorkId(current => current || nextItems[0]?.id || '')
            if (!response.ok) setError(payload.error?.message || response.statusText)
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : String(caught))
        } finally {
            if (!silent) setLoading(false)
        }
    }

    useEffect(() => {
        void load(defaultQuery)
        const interval = window.setInterval(() => void load(query, true), 15000)
        return () => window.clearInterval(interval)
    }, [])

    const sources = useMemo(() => sourcesFrom(snapshot), [snapshot])
    const frontierTasks = useMemo(() => frontierTasksFrom(snapshot), [snapshot])
    const workItems = useMemo(() => workItemsFor(snapshot, sources, frontierTasks), [snapshot, sources, frontierTasks])
    const selected = workItems.find(item => item.id === selectedWorkId) ?? workItems[0]
    const selectedSource = sources.find(source => source.id === selected?.sourceId) ?? sources[0]
    const timeline = useMemo(() => timelineFor(snapshot, actionResult, localControl.decisions), [snapshot, actionResult, localControl.decisions])
    const endpointRows = Object.entries(snapshot?.endpoints ?? {})
    const queueCount = numberFrom(snapshot?.frontier?.queued) ?? numberFrom(snapshot?.resources?.queue?.queued) ?? frontierTasks.length
    const healthyEndpoints = endpointRows.filter(([, state]) => state.ok).length
    const sourceGrowth = sourceGrowthKpis(snapshot, sources)
    const scheduler = schedulerKpis(snapshot)
    const selectedNote = selected ? localControl.notes[selected.id] ?? '' : ''
    const selectedDecision = selected ? localControl.decisions[selected.id] : undefined

    async function runAction(action: 'run_query' | 'source_apply_plan' | 'scheduler_run_now' | 'scheduler_pause' | 'scheduler_resume' | 'public_channel_status' | 'request_source' | 'request_restricted_source' | 'create_watchlist' | 'rebuild_alerts') {
        setBusyAction(action)
        setActionResult(null)
        try {
            const response = await fetch('/api/ti/scraper/control', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(actionBody(action, query, selectedSource, { sourceTarget, watchTerms })),
            })
            const payload = await response.json() as ActionResult
            setActionResult(payload)
            await load(query, true)
        } catch (caught) {
            setActionResult({ ok: false, error: caught instanceof Error ? caught.message : String(caught) })
        } finally {
            setBusyAction(null)
        }
    }

    async function runEnrichment() {
        setBusyAction('enrichment_run')
        setActionResult(null)
        try {
            const response = await fetch('/api/ti/enrichment/run', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ batchSize: 8 }),
            })
            const payload = await response.json() as ActionResult
            setActionResult({ ok: response.ok, status: response.status, payload })
        } catch (caught) {
            setActionResult({ ok: false, error: caught instanceof Error ? caught.message : String(caught) })
        } finally {
            setBusyAction(null)
        }
    }

    function submit(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const clean = query.trim() || defaultQuery
        setQuery(clean)
        void load(clean)
    }

    function updateNote(workItemId: string, note: string) {
        setLocalControl(current => ({
            ...current,
            notes: { ...current.notes, [workItemId]: note },
        }))
    }

    function applySessionDecision(status: string) {
        if (!selected) return
        setLocalControl(current => ({
            ...current,
            decisions: {
                ...current.decisions,
                [selected.id]: {
                    status,
                    reason: selectedNote || defaultDecisionReason(status),
                    at: new Date().toISOString(),
                },
            },
        }))
    }

    function toggleLocalPause(sourceId: string) {
        setLocalControl(current => ({
            ...current,
            sourcePaused: { ...current.sourcePaused, [sourceId]: !current.sourcePaused[sourceId] },
        }))
    }

    return (
        <div className='source-ops-workbench grid gap-2'>
            {error ? <Notice tone='bad' title='Scraper control needs attention' body={error} /> : null}
            {actionResult ? <Notice tone={actionResult.ok ? 'ok' : 'bad'} title={actionResult.ok ? 'Action completed' : 'Action failed'} body={actionSummary(actionResult)} /> : null}
            {!snapshot?.baseConfigured && !loading ? <Notice tone='bad' title='Source stream connecting' body='Connect the scraper so source leases, queue depth, and worker actions stay live here.' /> : null}

            <section className='overflow-hidden rounded-md border border-ui-border bg-ui-panel shadow-sm'>
                <div className='grid gap-2 border-b border-ui-border bg-ui-panel p-2 text-ui-text xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <MiniMetric label='Queue' value={String(queueCount)} />
                        <MiniMetric label='Daily' value={`${scheduler.dailyCovered}/${scheduler.dailySources}`} />
                        <MiniMetric label='Sources' value={String(scheduler.totalSources || sources.length)} />
                        <MiniMetric label='Qualified' value={`${scheduler.qualifyingSources}/6,100`} />
                        <MiniMetric label='Alerts' value={String(sourceGrowth.alertsGenerated)} />
                    </div>
                    <form onSubmit={submit} className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]'>
                        <label className='relative block'>
                            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-primary' />
                            <input
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                className='h-10 w-full rounded-lg border border-ui-border bg-ui-panel pl-9 pr-3 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/30'
                                placeholder='Actor, company, domain, CVE...'
                            />
                        </label>
                        <button type='submit' className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel'>
                            {loading ? <RefreshCcw className='h-4 w-4 animate-spin' /> : <Search className='h-4 w-4' />}
                            Refresh
                        </button>
                    </form>
                    <div className='grid gap-1.5'>
                        <ActionButton compact busy={busyAction === 'scheduler_run_now'} icon={<PlayCircle className='h-4 w-4' />} onClick={() => runAction('scheduler_run_now')}>Run due</ActionButton>
                    </div>
                </div>

                <div className='grid min-h-[440px] xl:grid-cols-[310px_minmax(0,1fr)_300px]'>
                    <aside className='border-b border-ui-border bg-ui-canvas xl:border-b-0 xl:border-r'>
                        <details className='border-b border-ui-border bg-ui-panel' data-ti-control-secondary-actions>
                            <summary className='flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-xs font-semibold text-ui-text outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/35 [&::-webkit-details-marker]:hidden'>
                                <span>Advanced source controls</span>
                                <span className='text-[11px] font-medium text-ui-muted'>daily, enrich, plan</span>
                            </summary>
                            <div className='grid grid-cols-2 gap-1.5 border-t border-ui-border p-2'>
                                <ActionButton compact busy={busyAction === 'scheduler_run_now'} icon={<Activity className='h-4 w-4' />} onClick={() => runAction('scheduler_run_now')}>Run due</ActionButton>
                                <ActionButton compact busy={busyAction === 'scheduler_pause'} icon={<PauseCircle className='h-4 w-4' />} onClick={() => runAction('scheduler_pause')}>Pause</ActionButton>
                                <ActionButton compact busy={busyAction === 'scheduler_resume'} icon={<PlayCircle className='h-4 w-4' />} onClick={() => runAction('scheduler_resume')}>Resume</ActionButton>
                                <ActionButton compact busy={busyAction === 'enrichment_run'} icon={<ListChecks className='h-4 w-4' />} onClick={runEnrichment}>Enrich</ActionButton>
                                <ActionButton compact busy={busyAction === 'source_apply_plan'} icon={<FileSearch className='h-4 w-4' />} onClick={() => runAction('source_apply_plan')}>Plan</ActionButton>
                                <ActionButton compact busy={busyAction === 'rebuild_alerts'} icon={<RefreshCcw className='h-4 w-4' />} onClick={() => runAction('rebuild_alerts')}>Alerts</ActionButton>
                            </div>
                        </details>
                        <div className='max-h-[calc(100vh-20rem)] overflow-auto p-1.5'>
                            {workItems.map(item => {
                                const active = selected?.id === item.id
                                const decision = localControl.decisions[item.id]
                                return (
                                    <button
                                        key={item.id}
                                        type='button'
                                        onClick={() => {
                                            setSelectedWorkId(item.id)
                                        }}
                                        className={`grid w-full gap-1 rounded-md border px-2 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${active ? 'border-ui-primary/35 bg-ui-panel shadow-sm' : 'border-transparent hover:border-ui-border hover:bg-ui-panel'}`}
                                    >
                                        <div className='flex items-center justify-between gap-2'>
                                            <span className={severityClass(item.severity)}>{item.severity}</span>
                                            <span className='text-[11px] font-semibold text-ui-muted'>{item.queue}</span>
                                        </div>
                                        <span className='truncate text-xs font-semibold text-ui-text'>{item.title}</span>
                                        <span className='line-clamp-1 text-[11px] leading-4 text-ui-muted'>{item.subtitle}</span>
                                        <span className='flex flex-wrap gap-2 text-[11px] text-ui-muted'>
                                            <span>{decision?.status || item.status}</span>
                                            <span>{item.timestamp}</span>
                                        </span>
                                    </button>
                                )
                            })}
                            {!workItems.length ? <p className='rounded-md border border-dashed border-ui-border bg-ui-panel p-3 text-sm text-ui-muted'>Live and clear. Leases, reviews, and worker issues stream in here.</p> : null}
                        </div>
                    </aside>

                    <main className='min-w-0 p-2'>
                        {selected ? (
                            <div className='grid gap-2'>
                                <section className='rounded-md border border-ui-border bg-ui-panel p-2.5'>
                                    <div className='flex flex-wrap items-start justify-between gap-2'>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <span className={severityClass(selected.severity)}>{selected.severity}</span>
                                                <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-primary'>{selected.kind.replaceAll('_', ' ')}</span>
                                                <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-muted'>{selectedDecision?.status || selected.status}</span>
                                            </div>
                                            <h2 className='mt-1.5 wrap-break-word text-lg font-semibold text-ui-text'>{selected.title}</h2>
                                            <p className='mt-0.5 line-clamp-2 text-xs leading-5 text-ui-muted'>{selected.subtitle}</p>
                                        </div>
                                        <div className='rounded-md border border-ui-border bg-ui-panel px-2.5 py-2 text-xs text-ui-muted'>
                                            <p className='font-semibold text-ui-text'>{selected.queue}</p>
                                            <p className='mt-1'>{selected.timestamp}</p>
                                        </div>
                                    </div>

                                    <div className='mt-2 grid gap-2 lg:grid-cols-2 2xl:grid-cols-3'>
                                        {selected.evidence.map(item => <Info key={item.label} label={item.label} value={item.value} />)}
                                    </div>
                                </section>

                                <section className='grid gap-2 2xl:grid-cols-[minmax(0,1fr)_19rem]'>
                                    <div className='rounded-md border border-ui-border bg-ui-panel p-2.5'>
                                        <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                                            <FileSearch className='h-4 w-4 text-ui-primary' />
                                            Source details
                                        </div>
                                        <div className='mt-2 grid gap-2'>
                                            <EvidenceLine title='Impact' body={publicImpactFor(selected, snapshot?.query || query)} />
                                            <EvidenceLine title='Source' body={provenanceFor(selected, selectedSource)} />
                                            <EvidenceLine title='Quality' body={qualitySummary(snapshot)} />
                                            <EvidenceLine title='Policy' body={policySummary(selected, selectedSource, snapshot)} />
                                        </div>
                                    </div>

                                    <div className='rounded-md border border-ui-border bg-ui-panel p-2.5'>
                                        <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                                            <SlidersHorizontal className='h-4 w-4 text-ui-primary' />
                                            Actions
                                        </div>
                                        <div className='mt-2 grid gap-1.5 sm:grid-cols-2 2xl:grid-cols-1'>
                                            <ActionButton busy={busyAction === 'scheduler_run_now'} icon={<PlayCircle className='h-4 w-4' />} onClick={() => runAction('scheduler_run_now')}>Run due sources</ActionButton>
                                            <ActionButton busy={busyAction === 'source_apply_plan'} icon={<FileSearch className='h-4 w-4' />} onClick={() => runAction('source_apply_plan')}>Preview plan</ActionButton>
                                            <ActionButton busy={busyAction === 'public_channel_status'} icon={<RefreshCcw className='h-4 w-4' />} onClick={() => runAction('public_channel_status')}>Channels</ActionButton>
                                            <ActionButton busy={busyAction === 'rebuild_alerts'} icon={<Activity className='h-4 w-4' />} onClick={() => runAction('rebuild_alerts')}>Rebuild alerts</ActionButton>
                                            <ActionButton icon={<PauseCircle className='h-4 w-4' />} onClick={() => selectedSource && toggleLocalPause(selectedSource.id)}>
                                                {selectedSource && localControl.sourcePaused[selectedSource.id] ? 'Resume source' : 'Pause source'}
                                            </ActionButton>
                                            <ActionButton icon={<RotateCcw className='h-4 w-4' />} onClick={() => applySessionDecision('retry requested')}>Mark retry</ActionButton>
                                            <ActionButton icon={<CheckCircle2 className='h-4 w-4' />} onClick={() => applySessionDecision('promoted for review')}>Send to review</ActionButton>
                                            <ActionButton icon={<XCircle className='h-4 w-4' />} onClick={() => applySessionDecision('suppressed in session')}>Suppress</ActionButton>
                                        </div>
                                    </div>
                                </section>

                                <section className='rounded-md border border-ui-border bg-ui-panel p-2.5'>
                                    <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                                        <Workflow className='h-4 w-4 text-ui-primary' />
                                        Next work
                                    </div>
                                    <div className='mt-2 grid gap-2 md:grid-cols-3'>
                                        {selected.nextActions.map((action, index) => (
                                            <div key={action} className='rounded-md border border-ui-border bg-ui-panel p-2'>
                                                <p className='text-[10px] font-semibold uppercase text-ui-muted'>Step {index + 1}</p>
                                                <p className='mt-1 text-xs leading-5 text-ui-text'>{action}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <div className='grid min-h-64 place-items-center rounded-md border border-dashed border-ui-border bg-ui-panel p-6 text-center text-sm text-ui-muted'>Connecting to the scraper feed. Worker checks and source leases refresh here.</div>
                        )}
                    </main>

                    <aside className='border-t border-ui-border bg-ui-canvas p-2 xl:border-l xl:border-t-0'>
                        <div className='grid gap-2'>
                            <SidePanel title='Decision' icon={<UserRound className='h-4 w-4' />}>
                                <textarea
                                    value={selected ? selectedNote : ''}
                                    onChange={event => selected && updateNote(selected.id, event.target.value)}
                                    placeholder='Owner, decision, retry condition...'
                                    className='min-h-20 rounded-md border border-ui-border bg-ui-panel p-2 text-xs text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/30'
                                />
                            </SidePanel>

                            <SidePanel title='Source' icon={<DatabaseZap className='h-4 w-4' />}>
                                {selectedSource ? (
                                    <div className='grid gap-2'>
                                        <Info label='Name' value={selectedSource.name} />
                                        <Info label='Status' value={localControl.sourcePaused[selectedSource.id] ? 'session paused' : operationalStateLabel(selectedSource.status)} />
                                        <Info label='Risk' value={selectedSource.risk} />
                                        <Info label='Trust' value={`${Math.round(selectedSource.trustScore * 100)}%`} />
                                        <p className='line-clamp-2 break-all text-xs leading-5 text-ui-muted'>{selectedSource.url || 'URL hidden by safety rules'}</p>
                                        <p className='line-clamp-2 text-xs leading-5 text-ui-muted'>{selectedSource.legalNotes || 'Safe-field rules enforced'}</p>
                                    </div>
                                ) : <p>Select a result or source row to inspect source detail.</p>}
                            </SidePanel>

                            <SidePanel title='Coverage' icon={<GitBranch className='h-4 w-4' />}>
                                <div className='grid grid-cols-2 gap-2'>
                                    <Info label='Candidates' value={String(sourceGrowth.candidates)} />
                                    <Info label='Daily covered' value={`${scheduler.dailyCovered}/${scheduler.dailySources}`} />
                                    <Info label='Qualified' value={`${scheduler.qualifyingSources}/6,100`} />
                                    <Info label='Clear web' value={`${scheduler.qualifyingClearWeb}/5,000`} />
                                    <Info label='Lawful Tor' value={`${scheduler.qualifyingDarkWeb}/1,000`} />
                                    <Info label='Public Telegram' value={`${scheduler.qualifyingTelegram}/100`} />
                                    <Info label='AI parser' value={scheduler.aiStatus} />
                                    <Info label='Active Telegram' value={String(sourceGrowth.activeTelegram)} />
                                    <Info label='Darkweb/onion' value={String(sourceGrowth.activeDarkweb)} />
                                    <Info label='Matches' value={String(sourceGrowth.watchlistMatches)} />
                                    <Info label='Alerts' value={String(sourceGrowth.alertsGenerated)} />
                                    <Info label='Deliveries' value={String(sourceGrowth.webhookDeliveries)} />
                                </div>
                                <label className='grid gap-1'>
                                    <span className='text-xs font-semibold uppercase text-ui-muted'>Public channel</span>
                                    <input
                                        value={sourceTarget}
                                        onChange={event => setSourceTarget(event.target.value)}
                                        className='h-9 rounded-md border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/30'
                                        placeholder='@channel or https://t.me/channel'
                                    />
                                </label>
                                <div className='grid gap-2 sm:grid-cols-2'>
                                    <ActionButton compact busy={busyAction === 'request_source'} icon={<PlayCircle className='h-4 w-4' />} onClick={() => runAction('request_source')}>Add Telegram</ActionButton>
                                    <ActionButton compact busy={busyAction === 'request_restricted_source'} icon={<DatabaseZap className='h-4 w-4' />} onClick={() => runAction('request_restricted_source')}>Request safe source</ActionButton>
                                </div>
                                <label className='grid gap-1'>
                                    <span className='text-xs font-semibold uppercase text-ui-muted'>Watch terms</span>
                                    <textarea
                                        value={watchTerms}
                                        onChange={event => setWatchTerms(event.target.value)}
                                        className='min-h-20 rounded-md border border-ui-border bg-ui-panel p-2 text-sm text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/30'
                                        placeholder='company.com, vendor, product, brand'
                                    />
                                </label>
                                <div className='grid gap-2 sm:grid-cols-2'>
                                    <ActionButton compact busy={busyAction === 'create_watchlist'} icon={<ListChecks className='h-4 w-4' />} onClick={() => runAction('create_watchlist')}>Save watchlist</ActionButton>
                                    <ActionButton compact busy={busyAction === 'rebuild_alerts'} icon={<RefreshCcw className='h-4 w-4' />} onClick={() => runAction('rebuild_alerts')}>Rebuild alerts</ActionButton>
                                </div>
                            </SidePanel>

                            <SidePanel title='Activity' icon={<History className='h-4 w-4' />}>
                                <div className='grid gap-2'>
                                    {timeline.slice(0, 5).map(item => (
                                        <div key={item.id} className='border-l-2 border-ui-border pl-3'>
                                            <p className='text-xs font-semibold text-ui-text'>{item.title}</p>
                                            <p className='mt-1 text-[11px] text-ui-muted'>{item.at}</p>
                                            <p className='mt-1 text-xs leading-5 text-ui-muted'>{item.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </SidePanel>
                        </div>
                    </aside>
                </div>
            </section>

            <details className='group overflow-hidden rounded-md border border-ui-border bg-ui-panel' data-ti-control-telemetry-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-3 py-2 text-sm font-semibold text-ui-text transition hover:bg-ui-raised sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span className='inline-flex items-center gap-2'>
                        <GitBranch className='h-4 w-4 text-ui-primary' />
                        Operations telemetry
                    </span>
                    <span className='inline-flex items-center gap-2 text-xs font-medium text-ui-muted'>
                        {healthyEndpoints}/{Math.max(endpointRows.length, 1)} checks healthy · {scheduler.dailyCovered}/{scheduler.dailySources} daily · {sourceGrowth.alertsGenerated} alerts
                        <ChevronDown className='h-4 w-4 transition group-open:rotate-180' />
                    </span>
                </summary>
                <div className='grid gap-2 border-t border-ui-border p-2' data-ti-control-telemetry-panels>
                    <section className='grid gap-2 sm:grid-cols-2 xl:grid-cols-5'>
                        <Metric title='Scraper' value={snapshot?.health ? 'Reachable' : loading ? 'Loading' : 'Connecting'} detail={`${healthyEndpoints}/${Math.max(endpointRows.length, 1)} checks healthy`} icon={<Gauge className='h-4 w-4' />} tone={snapshot?.health ? 'ok' : 'bad'} />
                        <Metric title='Queue' value={String(queueCount)} detail='frontier tasks visible to workers' icon={<Workflow className='h-4 w-4' />} tone={queueCount > 200 ? 'warn' : 'ok'} />
                        <Metric title='Daily coverage' value={`${scheduler.dailyCovered}/${scheduler.dailySources}`} detail={`${scheduler.dailyAttempted} attempted across retained executable sources`} icon={<UserRound className='h-4 w-4' />} tone={scheduler.dailySources && scheduler.dailyCovered < scheduler.dailySources ? 'warn' : 'ok'} />
                        <Metric title='AI parser' value={scheduler.aiStatus} detail={scheduler.aiDetail} icon={<DatabaseZap className='h-4 w-4' />} tone={scheduler.aiReady ? 'ok' : 'warn'} />
                        <Metric title='Alerts' value={String(sourceGrowth.alertsGenerated)} detail={`${sourceGrowth.watchlistMatches} matches, ${sourceGrowth.webhookDeliveries} deliveries`} icon={<Clock3 className='h-4 w-4' />} tone={sourceGrowth.alertsGenerated ? 'ok' : 'hold'} />
                    </section>

                    <section className='grid gap-2 xl:grid-cols-[1fr_0.9fr]'>
                        <Panel title='Endpoints' icon={<GitBranch className='h-4 w-4' />}>
                            <div className='grid gap-2 md:grid-cols-2'>
                                {endpointRows.map(([name, state]) => (
                                    <div key={name} className='flex items-center justify-between gap-3 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs'>
                                        <span className='font-semibold text-ui-text'>{name}</span>
                                        <span className={state.ok ? 'text-ui-success' : 'text-ui-danger'}>{state.ok ? `HTTP ${state.status}` : state.error || `HTTP ${state.status}`}</span>
                                    </div>
                                ))}
                                {!endpointRows.length ? <p className='text-sm text-ui-muted'>Live checks appear here when the scraper connects.</p> : null}
                            </div>
                        </Panel>
                        <Panel title='Output feed' icon={<FileSearch className='h-4 w-4' />}>
                            <div className='grid gap-2 md:grid-cols-2'>
                                <Info label='Runs' value={scheduler.lastRunStatus || 'collection feed'} />
                                <Info label='Queue' value={`${queueCount} frontier tasks`} />
                                <Info label='Quality' value={qualitySummary(snapshot)} />
                                <Info label='Next run' value={scheduler.nextRunAt ? formatTime(scheduler.nextRunAt) : 'checking'} />
                            </div>
                        </Panel>
                    </section>
                </div>
            </details>
        </div>
    )

}

function actionBody(action: 'run_query' | 'source_apply_plan' | 'scheduler_run_now' | 'scheduler_pause' | 'scheduler_resume' | 'public_channel_status' | 'request_source' | 'request_restricted_source' | 'create_watchlist' | 'rebuild_alerts', query: string, source: SourceRow | undefined, input: { sourceTarget: string; watchTerms: string }) {
    if (action === 'source_apply_plan') {
        return { action, query, sourceId: source?.id, actions: ['approve', 'quarantine', 'request_legal_notes', 'leave_unchanged'] }
    }
    if (action === 'request_source') {
        return { action, query, target: input.sourceTarget, sourceType: 'telegram_channel', activate: true }
    }
    if (action === 'request_restricted_source') {
        return { action: 'request_source', query, target: input.sourceTarget || query, sourceType: 'restricted_metadata', activate: false, approveMetadataOnly: false }
    }
    if (action === 'create_watchlist') {
        return {
            action,
            query,
            watchlistName: `${query} watchlist`,
            terms: input.watchTerms.split(/[,\n]/).map(term => term.trim()).filter(Boolean),
        }
    }
    return { action, query }
}

function sourcesFrom(snapshot: ControlSnapshot | null): SourceRow[] {
    const raw = Array.isArray(snapshot?.sources?.sources) ? snapshot.sources.sources : []
    return raw.map((item, index) => {
        const record = asRecord(item)
        const metadata = asRecord(record.metadata)
        return {
            id: stringValue(record.id) || `source_${index}`,
            name: stringValue(record.name) || stringValue(record.url) || `Source ${index + 1}`,
            type: stringValue(record.type) || stringValue(metadata.sourceFamily) || 'source family checking',
            status: stringValue(record.status) || 'status checking',
            risk: stringValue(record.risk) || 'risk checking',
            url: stringValue(record.url) || '',
            trustScore: numberFrom(record.trustScore) ?? 0,
            tags: stringArray(record.tags),
            crawlFrequencySeconds: numberFrom(record.crawlFrequencySeconds) ?? 0,
            legalNotes: stringValue(record.legalNotes) || '',
        }
    }).sort((a, b) => sourceWeight(b) - sourceWeight(a) || a.name.localeCompare(b.name))
}

function frontierTasksFrom(snapshot: ControlSnapshot | null): FrontierTask[] {
    const raw = Array.isArray(snapshot?.frontier?.tasks) ? snapshot.frontier.tasks : []
    return raw.slice(0, 40).map((item, index) => {
        const record = asRecord(item)
        const nestedTask = asRecord(record.task)
        const task = Object.keys(nestedTask).length ? nestedTask : record
        return {
            id: stringValue(task.id) || `frontier_${index}`,
            sourceId: stringValue(task.sourceId) || stringValue(asRecord(task.source).id),
            url: stringValue(task.url),
            discoveredAt: stringValue(task.discoveredAt) || stringValue(task.createdAt) || snapshot?.generatedAt || new Date().toISOString(),
            anchorText: stringValue(task.anchorText) || stringValue(task.query) || 'Queued source check',
            fairnessKey: stringValue(task.fairnessKey) || 'default',
            score: numberFrom(record.score) ?? numberFrom(task.score) ?? numberFrom(task.parentRelevance) ?? 0,
        }
    })
}

function sourceWeight(source: SourceRow) {
    return (source.status === 'active' ? 1 : 10) + (source.risk === 'restricted' ? 2 : 0) + source.trustScore
}

function workItemsFor(snapshot: ControlSnapshot | null, sources: SourceRow[], tasks: FrontierTask[]): WorkItem[] {
    const items: WorkItem[] = []
    const generatedAt = snapshot?.generatedAt ? formatTime(snapshot.generatedAt) : 'Now'
    if (snapshot?.error) {
        items.push({
            id: 'scraper-connecting',
            kind: 'platform',
            title: 'Connect scraper stream',
            subtitle: snapshot.error.message,
            queue: 'Platform',
            severity: 'critical',
            status: 'connecting',
            timestamp: generatedAt,
            evidence: [{ label: 'Connection', value: 'Scraper health stream' }],
            nextActions: ['Connect the scraper.', 'Verify health.', 'Reload collection.'],
        })
    }

    for (const task of tasks.slice(0, 10)) {
        const source = sources.find(item => item.id === task.sourceId)
        items.push({
            id: `task-${task.id}`,
            kind: 'frontier_task',
            title: task.anchorText || `Frontier task ${task.id}`,
            subtitle: task.url || `Queued for ${source?.name || task.sourceId || 'source'}.`,
            queue: 'Queue',
            severity: task.score > 0.8 ? 'high' : 'medium',
            status: 'queued',
            timestamp: formatTime(task.discoveredAt),
            sourceId: task.sourceId,
            task,
            evidence: [
                { label: 'Task ID', value: task.id },
                { label: 'Source', value: source?.name || task.sourceId || 'Source checking' },
                { label: 'Fairness key', value: task.fairnessKey },
                { label: 'Score', value: task.score ? `${Math.round(task.score * 100)}%` : 'not scored' },
                { label: 'URL', value: task.url || 'checking' },
                { label: 'Discovered', value: formatTime(task.discoveredAt) },
            ],
            nextActions: ['Let the worker take this task or run it now if it is late.', 'Check source safety before raising concurrency.', 'Promote after the capture is clean.'],
        })
    }

    for (const source of sources.filter(source => source.status !== 'active').slice(0, 8)) {
        items.push({
            id: `source-review-${source.id}`,
            kind: 'source',
            sourceId: source.id,
            title: `Review ${source.name}`,
            subtitle: `${source.status} source with ${source.risk} risk. Preview changes before promotion, quarantine, or legal-note refresh.`,
            queue: 'Source governance',
            severity: source.risk === 'restricted' ? 'high' : 'medium',
            status: source.status,
            timestamp: generatedAt,
            evidence: [
                { label: 'Source ID', value: source.id },
                { label: 'Type', value: source.type },
                { label: 'Risk', value: source.risk },
                { label: 'Trust', value: `${Math.round(source.trustScore * 100)}%` },
                { label: 'Cadence', value: source.crawlFrequencySeconds ? `${Math.round(source.crawlFrequencySeconds / 60)} min` : 'not set' },
                { label: 'Tags', value: source.tags.join(', ') || 'none' },
            ],
            nextActions: ['Preview source changes.', 'Confirm legal notes and safe fields.', 'Promote useful sources or quarantine noisy ones.'],
        })
    }

    const queued = numberFrom(snapshot?.frontier?.queued) ?? tasks.length
    if (queued > 0 && tasks.length === 0) {
        items.push({
            id: 'frontier-queue',
            kind: 'run',
            title: `${queued} queued frontier tasks`,
            subtitle: 'Queue pressure is building; worker rows stream in as they are leased.',
            queue: 'Scheduler',
            severity: queued > 200 ? 'high' : 'medium',
            status: 'queued',
            timestamp: generatedAt,
            evidence: [{ label: 'Queued', value: String(queued) }, { label: 'Stream', value: 'frontier' }],
            nextActions: ['Check resource feed.', 'Avoid adding broad searches until queue age is healthy.', 'Run due sources only if worker pressure is acceptable.'],
        })
    }

    const restrictedStatus = asRecord(snapshot?.restricted?.status)
    const restrictedQueue = numberFrom(restrictedStatus.reviewQueueCount) ?? numberFrom(restrictedStatus.metadataReviewCount) ?? 0
    if (restrictedQueue > 0) {
        items.push({
            id: 'restricted-review',
            kind: 'policy',
            title: `${restrictedQueue} sensitive-source reviews`,
            subtitle: 'Safe records need review without opening raw leaked files, credentials, or unsafe targets.',
            queue: 'Policy',
            severity: 'high',
            status: 'review',
            timestamp: generatedAt,
            evidence: [{ label: 'Review count', value: String(restrictedQueue) }, { label: 'Stream', value: 'sensitive-source review' }],
            nextActions: ['Review safe fields only.', 'Block raw payload paths.', 'Promote only redacted source timing, hashes, and safe excerpts.'],
        })
    }

    const growth = sourceGrowthKpis(snapshot, sources)
    if (growth.activeTelegram === 0 || growth.activeDarkweb === 0) {
        items.push({
            id: 'source-growth-gap',
            kind: 'source',
            title: 'Grow monitored source coverage',
            subtitle: `${growth.activeTelegram} Telegram source(s), ${growth.activeDarkweb} darkweb/onion source(s). Add public channels or request safe sensitive-source coverage.`,
            queue: 'Source growth',
            severity: growth.activeTelegram === 0 && growth.activeDarkweb === 0 ? 'high' : 'medium',
            status: 'needs_source_growth',
            timestamp: generatedAt,
            evidence: [
                { label: 'Candidates', value: String(growth.candidates) },
                { label: 'Active Telegram', value: String(growth.activeTelegram) },
                { label: 'Darkweb/onion', value: String(growth.activeDarkweb) },
                { label: 'Failing sources', value: String(growth.failingSources) },
            ],
            nextActions: ['Add a safe public Telegram candidate.', 'Request sensitive actor/onion coverage.', 'Run the daily scheduler and source apply-plan before promotion.'],
        })
    }

    if (growth.watchlists === 0 || growth.alertsGenerated === 0) {
        items.push({
            id: 'alert-generation-gap',
            kind: 'quality',
            title: 'Create watchlist and rebuild alerts',
            subtitle: `${growth.watchlists} watchlist(s), ${growth.watchlistMatches} match(es), ${growth.alertsGenerated} alert(s), ${growth.webhookDeliveries} delivery event(s).`,
            queue: 'Alert generation',
            severity: growth.watchlists === 0 ? 'high' : 'medium',
            status: growth.watchlists === 0 ? 'missing_watchlist' : 'needs_rebuild',
            timestamp: generatedAt,
            evidence: [
                { label: 'Watchlists', value: String(growth.watchlists) },
                { label: 'Matches', value: String(growth.watchlistMatches) },
                { label: 'Alerts', value: String(growth.alertsGenerated) },
                { label: 'Deliveries', value: String(growth.webhookDeliveries) },
            ],
            nextActions: ['Create an org/default watchlist from company/domain terms.', 'Rebuild alerts from watchlists and recent captures.', 'Check webhook deliveries before customer notification.'],
        })
    }

    const endpointFailures = Object.entries(snapshot?.endpoints ?? {}).filter(([, state]) => !state.ok)
    if (endpointFailures.length) {
        items.push({
            id: 'endpoint-failures',
            kind: 'platform',
            title: `${endpointFailures.length} scraper check failures`,
            subtitle: endpointFailures.map(([name]) => name).join(', '),
            queue: 'Platform',
            severity: endpointFailures.some(([, state]) => state.status >= 500 || state.status === 0) ? 'high' : 'medium',
            status: 'degraded',
            timestamp: generatedAt,
            evidence: endpointFailures.slice(0, 6).map(([name, state]) => ({ label: name, value: state.error || `HTTP ${state.status}` })),
            nextActions: ['Check scraper container health.', 'Verify route inventory and deploy state.', 'Hold promotion until checks are green.'],
        })
    }

    if (!items.length && snapshot?.ok) {
        items.push({
            id: 'steady-state',
            kind: 'quality',
            title: 'Operations steady',
            subtitle: 'Queue, source review, restricted review, and worker checks are clear.',
            queue: 'Monitoring',
            severity: 'low',
            status: 'steady',
            timestamp: generatedAt,
            evidence: [{ label: 'Query', value: snapshot.query || defaultQuery }, { label: 'Sources', value: String(sources.length) }],
            nextActions: ['Run due sources.', 'Refresh actor profiles.', 'Inspect public-page quality for the selected query.'],
        })
    }

    return items.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || a.queue.localeCompare(b.queue))
}

function timelineFor(snapshot: ControlSnapshot | null, actionResult: ActionResult | null, decisions: LocalControl['decisions']) {
    const items = Object.entries(decisions).map(([id, decision]) => ({
        id: `decision-${id}-${decision.at}`,
        title: `Session decision: ${decision.status}`,
        at: formatTime(decision.at),
        body: decision.reason,
    }))
    if (actionResult) {
        items.unshift({ id: 'action', title: actionResult.ok ? 'Action completed' : 'Action failed', at: 'This session', body: actionSummary(actionResult) })
    }
    if (snapshot?.generatedAt) {
        items.push({ id: 'snapshot', title: 'Control stream live', at: formatTime(snapshot.generatedAt), body: `${Object.keys(snapshot.endpoints ?? {}).length} scraper checks are being watched.` })
    }
    if (snapshot?.query) {
        items.push({ id: 'query', title: 'Query in operation', at: formatTime(snapshot.generatedAt), body: `${snapshot.query} is driving checks, sources, reviews, and runs.` })
    }
    return items.length ? items : [{ id: 'snapshot-pending', title: 'Connecting collection', at: 'Now', body: 'Health, source leases, and collection depth update here when the scraper responds.' }]
}

function publicImpactFor(item: WorkItem, query: string) {
    if (item.kind === 'frontier_task') return `Checking this source for ${query}. Clean captures move into activity and alerts.`
    if (item.kind === 'source') return `This source changes ${query} coverage. Preview changes before promotion.`
    if (item.kind === 'policy') return 'Safe metadata can move forward; raw leaked material stays out of the console.'
    if (item.kind === 'platform') return 'Worker check failures can slow source updates.'
    return `This item affects ${query} coverage and freshness.`
}

function provenanceFor(item: WorkItem, source?: SourceRow) {
    if (item.task) return `Task ${item.task.id}, source ${source?.name || item.task.sourceId || 'source checking'}, fairness ${item.task.fairnessKey}, discovered ${formatTime(item.task.discoveredAt)}.`
    if (source) return `Source ${source.id}, ${source.type}, status ${source.status}, risk ${source.risk}, trust ${Math.round(source.trustScore * 100)}%.`
    return 'Select a source or result to inspect provenance.'
}

function qualitySummary(snapshot: ControlSnapshot | null) {
    const quality = asRecord(snapshot?.quality)
    const nested = asRecord(quality.quality)
    const publicWarningText = stringArray(nested.publicWarningText).join(', ')
    const state = stringValue(nested.status) || stringValue(quality.status)
    if (state || publicWarningText) return `${state || 'checked'}${publicWarningText ? `: ${publicWarningText}` : ''}`
    return 'Checking quality.'
}

function policySummary(item: WorkItem, source: SourceRow | undefined, snapshot: ControlSnapshot | null) {
    if (item.kind === 'policy' || source?.risk === 'restricted') return 'Restricted sources stay safe-field only: no raw leaked files, credential values, private access, CAPTCHA bypass, actor interaction, or payload redistribution.'
    const restricted = asRecord(snapshot?.restricted?.status)
    const status = stringValue(restricted.state) || stringValue(restricted.status)
    return status ? `Sensitive-source state: ${status}.` : 'Sensitive-source rules are clear.'
}

function schedulerKpis(snapshot: ControlSnapshot | null) {
    const schedulerRoot = asRecord(snapshot?.scheduler)
    const scheduler = asRecord(schedulerRoot.scheduler)
    const coverage = asRecord(schedulerRoot.sourceCoverage)
    const qualification = asRecord(schedulerRoot.sourceQualification)
    const qualifyingCounts = asRecord(qualification.counts)
    const parser = asRecord(schedulerRoot.parser)
    const parserHealth = asRecord(snapshot?.exposureParser)
    const lastRun = asRecord(scheduler.lastRun)
    const healthStatus = stringValue(parserHealth.status)
    const aiConfigured = Boolean(parser.aiEndpointConfigured) || Boolean(parserHealth.endpoint)
    const aiReady = healthStatus === 'ready' || (aiConfigured && !healthStatus)
    const latency = numberFrom(parserHealth.latencyMs)
    const blocker = stringValue(parserHealth.blocker)
    const acceptedExposureCount = numberFrom(parser.acceptedExposureCount) ?? 0
    const reviewExposureCount = numberFrom(parser.reviewExposureCount) ?? 0
    return {
        totalSources: numberFrom(coverage.totalSourceCount) ?? 0,
        dailySources: numberFrom(coverage.dailySourceCount) ?? 0,
        dailyAttempted: numberFrom(coverage.dailyAttemptedCount) ?? 0,
        dailyCovered: numberFrom(coverage.dailyCoveredCount) ?? 0,
        qualifyingSources: numberFrom(qualifyingCounts.total) ?? numberFrom(coverage.qualifyingSourceCount) ?? 0,
        qualifyingClearWeb: numberFrom(qualifyingCounts.clearWeb) ?? numberFrom(coverage.qualifyingClearWebSourceCount) ?? 0,
        qualifyingDarkWeb: numberFrom(qualifyingCounts.lawfulDarkWeb) ?? numberFrom(coverage.qualifyingLawfulDarkWebSourceCount) ?? 0,
        qualifyingTelegram: numberFrom(qualifyingCounts.publicTelegram) ?? numberFrom(coverage.qualifyingPublicTelegramSourceCount) ?? 0,
        aiReady,
        aiStatus: aiReady ? 'Connected' : aiConfigured ? 'Needs setup' : 'Fallback',
        aiDetail: blocker || `${acceptedExposureCount} accepted, ${reviewExposureCount} review${latency !== undefined ? `, ${latency}ms` : ''}`,
        acceptedExposureCount,
        reviewExposureCount,
        nextRunAt: stringValue(scheduler.nextRunAt),
        lastRunStatus: stringValue(lastRun.status),
    }
}

function sourceGrowthKpis(snapshot: ControlSnapshot | null, sources: SourceRow[]) {
    const inventory = asRecord(snapshot?.sourceInventory)
    const counts = asRecord(inventory.counts)
    const alerts = Array.isArray(snapshot?.alerts?.alerts) ? snapshot.alerts.alerts : []
    const watchlists = Array.isArray(snapshot?.watchlists?.watchlists) ? snapshot.watchlists.watchlists : []
    const deliveries = Array.isArray(snapshot?.deliveries?.deliveries) ? snapshot.deliveries.deliveries : []
    const sourcePacks = asRecord(snapshot?.sourcePacks)
    const packCounts = asRecord(sourcePacks.counts)
    const active = (source: SourceRow) => ['active', 'approved', 'canary'].includes(source.status.toLowerCase())
    const telegramSources = sources.filter(source => /telegram/i.test(`${source.type} ${source.url} ${source.name}`))
    const darkwebSources = sources.filter(source => /dark|onion|metadata|actor_page|restricted/i.test(`${source.type} ${source.url} ${source.name} ${source.risk}`))
    return {
        candidates: numberFrom(counts.candidateCount) ?? numberFrom(packCounts.candidateCount) ?? sources.filter(source => source.status !== 'active').length,
        activeTelegram: numberFrom(counts.activeTelegram) ?? telegramSources.filter(active).length,
        activeDarkweb: numberFrom(counts.activeDarkwebMetadata) ?? numberFrom(counts.registeredDarkwebMetadata) ?? darkwebSources.filter(active).length,
        failingSources: numberFrom(counts.failingSources) ?? sources.filter(source => /fail|error|paused|quarantine/i.test(source.status)).length,
        capturesLastRun: numberFrom(counts.capturesLastRun) ?? numberFrom(asRecord(snapshot?.productSlo).captureCount) ?? 0,
        watchlists: watchlists.length,
        watchlistMatches: alerts.length || numberFrom(counts.watchlistMatches) || 0,
        alertsGenerated: alerts.length,
        webhookDeliveries: deliveries.length,
    }
}

function EvidenceLine({ title, body }: { title: string; body: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-panel p-2.5'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{title}</p>
            <p className='mt-1 line-clamp-3 text-xs leading-5 text-ui-text'>{body}</p>
        </div>
    )
}

function Metric({ title, value, detail, icon, tone }: { title: string; value: string; detail: string; icon: ReactNode; tone: 'ok' | 'warn' | 'bad' | 'hold' }) {
    const className = tone === 'ok' ? 'text-ui-success' : tone === 'warn' ? 'text-ui-warning' : tone === 'bad' ? 'text-ui-danger' : 'text-ui-primary'
    return (
        <div className='rounded-md border border-ui-border bg-ui-panel px-3 py-2.5 shadow-sm'>
            <div className={`flex items-center justify-between ${className}`}>
                <p className='text-[10px] font-semibold uppercase'>{title}</p>
                {icon}
            </div>
            <p className='mt-1.5 text-lg font-semibold text-ui-text'>{value}</p>
            <p className='mt-0.5 truncate text-xs text-ui-muted'>{detail}</p>
        </div>
    )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-canvas px-2 py-1.5'>
            <p className='text-[9px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-0.5 text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className='min-w-0 rounded-md border border-ui-border bg-ui-panel px-2.5 py-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-0.5 wrap-break-word text-xs font-semibold leading-5 text-ui-text'>{value || 'checking'}</p>
        </div>
    )
}

function SidePanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
    return (
        <section className='rounded-md border border-ui-border bg-ui-panel p-3'>
            <div className='flex items-center gap-2 text-xs font-semibold text-ui-text'>
                <span className='text-ui-primary'>{icon}</span>
                {title}
            </div>
            <div className='mt-2 grid gap-2 text-[11px] leading-5 text-ui-muted'>{children}</div>
        </section>
    )
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
    return (
        <section className='rounded-md border border-ui-border bg-ui-panel p-3 shadow-sm'>
            <div className='mb-2 flex items-center gap-2 text-sm font-semibold text-ui-text'>
                <span className='text-ui-primary'>{icon}</span>
                {title}
            </div>
            {children}
        </section>
    )
}

function ActionButton({ children, icon, busy, compact, onClick }: { children: ReactNode; icon: ReactNode; busy?: boolean; compact?: boolean; onClick: () => void | Promise<void> }) {
    return (
        <button
            type='button'
            disabled={busy}
            onClick={onClick}
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-ui-border bg-ui-panel text-center text-xs font-semibold leading-tight text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-ui-primary/40 ${compact ? 'min-h-8 min-w-0 px-2 py-1.5' : 'min-h-9 min-w-0 px-2.5 py-1.5'}`}
        >
            <span className='shrink-0'>{busy ? <RefreshCcw className='h-4 w-4 animate-spin' /> : icon}</span>
            <span className='min-w-0 wrap-break-word whitespace-normal sm:whitespace-nowrap'>{children}</span>
        </button>
    )
}

function Notice({ tone, title, body }: { tone: 'ok' | 'bad'; title: string; body: string }) {
    const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle
    const className = tone === 'ok' ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
    return (
        <div className={`grid gap-1 rounded-md border p-3 text-sm ${className}`}>
            <p className='flex items-center gap-2 font-semibold'><Icon className='h-4 w-4' />{title}</p>
            <p className='leading-6'>{body}</p>
        </div>
    )
}

function severityClass(severity: WorkItem['severity']) {
    if (severity === 'critical') return 'rounded-full border border-ui-danger/35 bg-ui-danger/10 px-2 py-0.5 text-[11px] font-semibold text-ui-danger'
    if (severity === 'high') return 'rounded-full border border-ui-danger/35 bg-ui-danger/10 px-2 py-0.5 text-[11px] font-semibold text-ui-danger'
    if (severity === 'medium') return 'rounded-full border border-ui-warning/35 bg-ui-warning/10 px-2 py-0.5 text-[11px] font-semibold text-ui-warning'
    return 'rounded-full border border-ui-success/35 bg-ui-success/10 px-2 py-0.5 text-[11px] font-semibold text-ui-success'
}

function actionSummary(result: ActionResult) {
    if (typeof result.error === 'string') return result.error
    if (result.error?.message) return result.error.message
    const payload = asRecord(result.payload)
    const run = asRecord(payload.run)
    if (run.id) return `Run ${String(run.id)} completed with ${String(run.taskCount ?? 'metering')} task(s).`
    if (Array.isArray(payload.warmed)) return `Enrichment warmed ${payload.warmed.length} actor profile(s).`
    if (payload.applyPlan || payload.contract) return 'Source plan is ready. Review affected sources before applying changes.'
    return result.ok ? 'The scraper responded.' : 'The action did not complete.'
}

function defaultDecisionReason(status: string) {
    if (status.includes('retry')) return 'Retry requested from collection.'
    if (status.includes('promoted')) return 'Promoted for review from collection.'
    if (status.includes('suppressed')) return 'Suppressed locally pending persistent workflow support.'
    return 'Updated from collection.'
}

function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'review') return 'reviewing'
    return value.replaceAll('_', ' ')
}

function formatTime(value?: string) {
    if (!value) return 'Now'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
    }).format(date)
}

function severityWeight(value: WorkItem['severity']) {
    return { critical: 4, high: 3, medium: 2, low: 1 }[value]
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function numberFrom(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}
