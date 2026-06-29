'use client'

import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Clock3, DatabaseZap, FileSearch, Gauge, GitBranch, History, ListChecks, PauseCircle, PlayCircle, RefreshCcw, RotateCcw, Search, SlidersHorizontal, UserRound, Workflow, XCircle } from 'lucide-react'

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
    canary?: Record<string, unknown>
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
    const sourceNeedsReview = sources.filter(source => source.status !== 'active').length
    const healthyEndpoints = endpointRows.filter(([, state]) => state.ok).length
    const sourceGrowth = sourceGrowthKpis(snapshot, sources)
    const selectedNote = selected ? localControl.notes[selected.id] ?? '' : ''
    const selectedDecision = selected ? localControl.decisions[selected.id] : undefined

    async function runAction(action: 'run_query' | 'source_apply_plan' | 'canary_run' | 'public_channel_status' | 'request_source' | 'request_restricted_source' | 'create_watchlist' | 'rebuild_alerts') {
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

    function submit(event: FormEvent<HTMLFormElement>) {
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
        <div className='source-ops-workbench grid gap-4'>
            {error ? <Notice tone='bad' title='Scraper control unavailable' body={error} /> : null}
            {actionResult ? <Notice tone={actionResult.ok ? 'ok' : 'bad'} title={actionResult.ok ? 'Action completed' : 'Action failed'} body={actionSummary(actionResult)} /> : null}
            {!snapshot?.baseConfigured && !loading ? <Notice tone='bad' title='Backend not configured' body='Set TI_SCRAPER_API_BASE for live scraper control. The workbench still labels session-local actions honestly instead of pretending they persisted.' /> : null}

            <section className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-sm dark:border-[#22334d] dark:bg-[#0f172a]'>
                <div className='grid border-b border-[#dfe5ee] bg-[#171a21] p-4 text-white dark:border-[#22334d] xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end'>
                    <div className='min-w-0'>
                        <p className='text-[10px] font-semibold uppercase text-[#9db4ff]'>Source operations</p>
                        <h2 className='mt-1 text-xl font-semibold'>Collection queue and source readiness</h2>
                        <p className='mt-1 max-w-4xl text-sm leading-6 text-[#d8deea]'>Current runs, source posture, evidence quality, and alert readiness for the selected query.</p>
                    </div>
                    <form onSubmit={submit} className='mt-3 grid gap-2 sm:grid-cols-[minmax(0,22rem)_auto] xl:mt-0'>
                        <label className='relative block'>
                            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9db4ff]' />
                            <input
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                className='h-10 w-full rounded-lg border border-[#2a3d5c] bg-[#1f2f49] pl-9 pr-3 text-sm font-medium text-white outline-none transition placeholder:text-[#aeb8ca] focus:border-[#9db4ff] focus:ring-2 focus:ring-[#9db4ff]/30'
                                placeholder='Actor, company, domain, CVE...'
                            />
                        </label>
                        <button type='submit' className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-[#171a21] transition hover:bg-[#eef3ff]'>
                            {loading ? <RefreshCcw className='h-4 w-4 animate-spin' /> : <Search className='h-4 w-4' />}
                            Refresh
                        </button>
                    </form>
                </div>

                <div className='grid min-h-[760px] xl:grid-cols-[360px_minmax(0,1fr)_360px]'>
                    <aside className='border-b border-[#dfe5ee] bg-[#f8fafc] dark:border-[#22334d] xl:border-b-0 xl:border-r'>
                        <div className='grid gap-3 border-b border-[#dfe5ee] p-4 dark:border-[#22334d]'>
                            <div className='grid grid-cols-4 gap-2 text-center'>
                                <MiniMetric label='Queue' value={String(queueCount)} />
                                <MiniMetric label='Tasks' value={String(frontierTasks.length)} />
                                <MiniMetric label='Review' value={String(sourceNeedsReview)} />
                                <MiniMetric label='Alerts' value={String(sourceGrowth.alertsGenerated)} />
                            </div>
                            <div className='grid gap-2 sm:grid-cols-2 2xl:grid-cols-5'>
                                <ActionButton compact busy={busyAction === 'run_query'} icon={<PlayCircle className='h-4 w-4' />} onClick={() => runAction('run_query')}>Run</ActionButton>
                                <ActionButton compact busy={busyAction === 'source_apply_plan'} icon={<FileSearch className='h-4 w-4' />} onClick={() => runAction('source_apply_plan')}>Plan</ActionButton>
                                <ActionButton compact busy={busyAction === 'canary_run'} icon={<Activity className='h-4 w-4' />} onClick={() => runAction('canary_run')}>Canary</ActionButton>
                                <ActionButton compact busy={busyAction === 'enrichment_run'} icon={<ListChecks className='h-4 w-4' />} onClick={runEnrichment}>Enrich</ActionButton>
                                <ActionButton compact busy={busyAction === 'rebuild_alerts'} icon={<RefreshCcw className='h-4 w-4' />} onClick={() => runAction('rebuild_alerts')}>Alerts</ActionButton>
                            </div>
                        </div>
                        <div className='max-h-[650px] overflow-auto p-2'>
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
                                        className={`grid w-full gap-2 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#b8c5ff] ${active ? 'border-[#3056d3] bg-white shadow-sm' : 'border-transparent hover:border-[#d8dee9] hover:bg-white'}`}
                                    >
                                        <div className='flex items-center justify-between gap-2'>
                                            <span className={severityClass(item.severity)}>{item.severity}</span>
                                            <span className='text-[11px] font-semibold text-[#667085]'>{item.queue}</span>
                                        </div>
                                        <span className='text-sm font-semibold leading-5 text-[#171a21]'>{item.title}</span>
                                        <span className='line-clamp-2 text-xs leading-5 text-[#596170]'>{item.subtitle}</span>
                                        <span className='flex flex-wrap gap-2 text-[11px] text-[#667085]'>
                                            <span>{decision?.status || item.status}</span>
                                            <span>{item.timestamp}</span>
                                        </span>
                                    </button>
                                )
                            })}
                            {!workItems.length ? <p className='rounded-lg border border-dashed border-[#cfd8e6] bg-white p-4 text-sm text-[#596170]'>No scraper work items are visible yet.</p> : null}
                        </div>
                    </aside>

                    <main className='min-w-0 p-4'>
                        {selected ? (
                            <div className='grid gap-4'>
                                <section className='rounded-lg border border-[#dfe5ee] bg-white p-4'>
                                    <div className='flex flex-wrap items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <span className={severityClass(selected.severity)}>{selected.severity}</span>
                                                <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'>{selected.kind.replaceAll('_', ' ')}</span>
                                                <span className='rounded-full bg-[#f4f7ff] px-2 py-0.5 text-xs font-semibold text-[#475467]'>{selectedDecision?.status || selected.status}</span>
                                            </div>
                                            <h2 className='mt-3 wrap-break-word text-2xl font-semibold text-[#171a21]'>{selected.title}</h2>
                                            <p className='mt-2 text-sm leading-6 text-[#596170]'>{selected.subtitle}</p>
                                        </div>
                                        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] px-3 py-2 text-xs text-[#667085]'>
                                            <p className='font-semibold text-[#171a21]'>{selected.queue}</p>
                                            <p className='mt-1'>{selected.timestamp}</p>
                                        </div>
                                    </div>

                                    <div className='mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3'>
                                        {selected.evidence.map(item => <Info key={item.label} label={item.label} value={item.value} />)}
                                    </div>
                                </section>

                                <section className='grid gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]'>
                                    <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 dark:border-[#2a3d5c] dark:bg-[#111827]'>
                                        <div className='flex items-center gap-2 text-sm font-semibold text-[#171a21] dark:text-[#d8deea]'>
                                            <FileSearch className='h-4 w-4 text-[#3056d3]' />
                                            Evidence and provenance
                                        </div>
                                        <div className='mt-3 grid gap-3'>
                                            <EvidenceLine title='Intelligence output' body={publicImpactFor(selected, snapshot?.query || query)} />
                                            <EvidenceLine title='Source record' body={provenanceFor(selected, selectedSource)} />
                                            <EvidenceLine title='Quality gate' body={qualitySummary(snapshot)} />
                                            <EvidenceLine title='Policy boundary' body={policySummary(selected, selectedSource, snapshot)} />
                                        </div>
                                    </div>

                                    <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 dark:border-[#2a3d5c] dark:bg-[#111827]'>
                                        <div className='flex items-center gap-2 text-sm font-semibold text-[#171a21] dark:text-[#d8deea]'>
                                            <SlidersHorizontal className='h-4 w-4 text-[#3056d3]' />
                                            Actions
                                        </div>
                                        <div className='mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1'>
                                            <ActionButton busy={busyAction === 'run_query'} icon={<PlayCircle className='h-4 w-4' />} onClick={() => runAction('run_query')}>Queue run</ActionButton>
                                            <ActionButton busy={busyAction === 'source_apply_plan'} icon={<FileSearch className='h-4 w-4' />} onClick={() => runAction('source_apply_plan')}>Preview source changes</ActionButton>
                                            <ActionButton busy={busyAction === 'public_channel_status'} icon={<RefreshCcw className='h-4 w-4' />} onClick={() => runAction('public_channel_status')}>Check channels</ActionButton>
                                            <ActionButton busy={busyAction === 'rebuild_alerts'} icon={<Activity className='h-4 w-4' />} onClick={() => runAction('rebuild_alerts')}>Rebuild alerts</ActionButton>
                                            <ActionButton icon={<PauseCircle className='h-4 w-4' />} onClick={() => selectedSource && toggleLocalPause(selectedSource.id)}>
                                                {selectedSource && localControl.sourcePaused[selectedSource.id] ? 'Resume source' : 'Pause source'}
                                            </ActionButton>
                                            <ActionButton icon={<RotateCcw className='h-4 w-4' />} onClick={() => applySessionDecision('retry requested')}>Mark retry</ActionButton>
                                            <ActionButton icon={<CheckCircle2 className='h-4 w-4' />} onClick={() => applySessionDecision('promoted for review')}>Send to review</ActionButton>
                                            <ActionButton icon={<XCircle className='h-4 w-4' />} onClick={() => applySessionDecision('suppressed in session')}>Suppress</ActionButton>
                                        </div>
                                        <div className='mt-3 grid gap-2 text-xs text-[#667085] lg:grid-cols-2 2xl:grid-cols-1'>
                                            <Info label='API actions' value='run, canary, channel check, enrich, source request, watchlist, alert rebuild, source plan' />
                                            <Info label='Local actions' value='pause, retry, review, suppress, notes' />
                                        </div>
                                    </div>
                                </section>

                                <section className='rounded-lg border border-[#dfe5ee] bg-white p-4 dark:border-[#2a3d5c] dark:bg-[#111827]'>
                                    <div className='flex items-center gap-2 text-sm font-semibold text-[#171a21] dark:text-[#d8deea]'>
                                        <Workflow className='h-4 w-4 text-[#3056d3]' />
                                        Next work
                                    </div>
                                    <div className='mt-3 grid gap-3 md:grid-cols-3'>
                                        {selected.nextActions.map((action, index) => (
                                            <div key={action} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 dark:border-[#2a3d5c] dark:bg-[#0f172a]'>
                                                <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#8795ad]'>Step {index + 1}</p>
                                                <p className='mt-2 text-sm leading-6 text-[#344054] dark:text-[#d8deea]'>{action}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <div className='grid min-h-96 place-items-center rounded-lg border border-dashed border-[#d8dee9] bg-white p-8 text-center text-sm text-[#667085] dark:border-[#2a3d5c] dark:bg-[#111827] dark:text-[#aab6ca]'>Waiting for scraper state.</div>
                        )}
                    </main>

                    <aside className='border-t border-[#dfe5ee] bg-[#fbfcfe] p-4 dark:border-[#22334d] xl:border-l xl:border-t-0'>
                        <div className='grid gap-4'>
                            <SidePanel title='Analyst note' icon={<UserRound className='h-4 w-4' />}>
                                <textarea
                                    value={selected ? selectedNote : ''}
                                    onChange={event => selected && updateNote(selected.id, event.target.value)}
                                    placeholder='Decision rationale, owner, false-positive reason, parser issue, next run condition...'
                                    className='min-h-28 rounded-lg border border-[#d8dee9] bg-white p-3 text-sm text-[#171a21] outline-none focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                                />
                                <p>Notes are session-local until TI case ownership persistence is added.</p>
                            </SidePanel>

                            <SidePanel title='Selected source' icon={<DatabaseZap className='h-4 w-4' />}>
                                {selectedSource ? (
                                    <div className='grid gap-2'>
                                        <Info label='Name' value={selectedSource.name} />
                                        <Info label='Status' value={localControl.sourcePaused[selectedSource.id] ? 'session paused' : selectedSource.status} />
                                        <Info label='Risk' value={selectedSource.risk} />
                                        <Info label='Trust' value={`${Math.round(selectedSource.trustScore * 100)}%`} />
                                        <p className='break-all text-xs leading-5 text-[#596170]'>{selectedSource.url || 'No URL returned.'}</p>
                                        <p className='text-xs leading-5 text-[#596170]'>{selectedSource.legalNotes || 'No legal notes returned.'}</p>
                                    </div>
                                ) : <p>No source selected.</p>}
                            </SidePanel>

                            <SidePanel title='Coverage and alerts' icon={<GitBranch className='h-4 w-4' />}>
                                <div className='grid grid-cols-2 gap-2'>
                                    <Info label='Candidates' value={String(sourceGrowth.candidates)} />
                                    <Info label='Active Telegram' value={String(sourceGrowth.activeTelegram)} />
                                    <Info label='Darkweb/onion' value={String(sourceGrowth.activeDarkweb)} />
                                    <Info label='Matches' value={String(sourceGrowth.watchlistMatches)} />
                                    <Info label='Alerts' value={String(sourceGrowth.alertsGenerated)} />
                                    <Info label='Deliveries' value={String(sourceGrowth.webhookDeliveries)} />
                                </div>
                                <label className='grid gap-1'>
                                    <span className='text-xs font-semibold uppercase text-[#667085]'>Public Telegram candidate</span>
                                    <input
                                        value={sourceTarget}
                                        onChange={event => setSourceTarget(event.target.value)}
                                        className='h-9 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm text-[#171a21] outline-none focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                                        placeholder='@channel or https://t.me/channel'
                                    />
                                </label>
                                <div className='grid gap-2 sm:grid-cols-2'>
                                    <ActionButton compact busy={busyAction === 'request_source'} icon={<PlayCircle className='h-4 w-4' />} onClick={() => runAction('request_source')}>Add Telegram</ActionButton>
                                    <ActionButton compact busy={busyAction === 'request_restricted_source'} icon={<DatabaseZap className='h-4 w-4' />} onClick={() => runAction('request_restricted_source')}>Request metadata</ActionButton>
                                </div>
                                <label className='grid gap-1'>
                                    <span className='text-xs font-semibold uppercase text-[#667085] dark:text-[#8795ad]'>Organization watch terms</span>
                                    <textarea
                                        value={watchTerms}
                                        onChange={event => setWatchTerms(event.target.value)}
                                        className='min-h-20 rounded-lg border border-[#d8dee9] bg-white p-2 text-sm text-[#171a21] outline-none focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                                        placeholder='company.com, vendor, product, brand'
                                    />
                                </label>
                                <div className='grid gap-2 sm:grid-cols-2'>
                                    <ActionButton compact busy={busyAction === 'create_watchlist'} icon={<ListChecks className='h-4 w-4' />} onClick={() => runAction('create_watchlist')}>Save watchlist</ActionButton>
                                    <ActionButton compact busy={busyAction === 'rebuild_alerts'} icon={<RefreshCcw className='h-4 w-4' />} onClick={() => runAction('rebuild_alerts')}>Rebuild alerts</ActionButton>
                                </div>
                                <p>Organization-scoped source actions require explicit membership, watchlist ownership, and alert delivery isolation from the source API.</p>
                            </SidePanel>

                            <SidePanel title='Audit and History' icon={<History className='h-4 w-4' />}>
                                <div className='grid gap-3'>
                                    {timeline.map(item => (
                                        <div key={item.id} className='border-l-2 border-[#d8dee9] pl-3 dark:border-[#2a3d5c]'>
                                            <p className='text-xs font-semibold text-[#171a21]'>{item.title}</p>
                                            <p className='mt-1 text-[11px] text-[#667085]'>{item.at}</p>
                                            <p className='mt-1 text-xs leading-5 text-[#596170]'>{item.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </SidePanel>
                        </div>
                    </aside>
                </div>
            </section>

            <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Scraper' value={snapshot?.health ? 'Reachable' : loading ? 'Loading' : 'Unavailable'} detail={`${healthyEndpoints}/${Math.max(endpointRows.length, 1)} endpoints healthy`} icon={<Gauge className='h-4 w-4' />} tone={snapshot?.health ? 'ok' : 'bad'} />
                <Metric title='Queue' value={String(queueCount)} detail='frontier tasks visible to workers' icon={<Workflow className='h-4 w-4' />} tone={queueCount > 200 ? 'warn' : 'ok'} />
                <Metric title='Active Telegram' value={String(sourceGrowth.activeTelegram)} detail='public source coverage' icon={<UserRound className='h-4 w-4' />} tone={sourceGrowth.activeTelegram ? 'ok' : 'warn'} />
                <Metric title='Darkweb/onion' value={String(sourceGrowth.activeDarkweb)} detail={`${sourceGrowth.candidates} candidates total`} icon={<DatabaseZap className='h-4 w-4' />} tone={sourceGrowth.activeDarkweb ? 'ok' : 'warn'} />
                <Metric title='Alerts' value={String(sourceGrowth.alertsGenerated)} detail={`${sourceGrowth.watchlistMatches} matches, ${sourceGrowth.webhookDeliveries} deliveries`} icon={<Clock3 className='h-4 w-4' />} tone={sourceGrowth.alertsGenerated ? 'ok' : 'hold'} />
            </section>

            <section className='grid gap-4 xl:grid-cols-[1fr_0.9fr]'>
                <Panel title='Endpoint Backbone' icon={<GitBranch className='h-4 w-4' />}>
                    <div className='grid gap-2 md:grid-cols-2'>
                        {endpointRows.map(([name, state]) => (
                            <div key={name} className='flex items-center justify-between gap-3 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] px-3 py-2 text-xs'>
                                <span className='font-semibold text-[#171a21]'>{name}</span>
                                <span className={state.ok ? 'text-[#147a3b]' : 'text-[#b42318]'}>{state.ok ? `HTTP ${state.status}` : state.error || `HTTP ${state.status}`}</span>
                            </div>
                        ))}
                        {!endpointRows.length ? <p className='text-sm text-[#596170]'>No endpoint checks available.</p> : null}
                    </div>
                </Panel>
                <Panel title='Public Page Feed' icon={<FileSearch className='h-4 w-4' />}>
                    <div className='grid gap-2 md:grid-cols-2'>
                        <Info label='Run input' value='/v1/intel/runs' />
                        <Info label='Queue state' value={`${queueCount} frontier tasks`} />
                        <Info label='Quality gate' value={qualitySummary(snapshot)} />
                        <Info label='Public output' value={`safe source-backed context for /ti/${query}`} />
                    </div>
                </Panel>
            </section>
        </div>
    )

}

function actionBody(action: 'run_query' | 'source_apply_plan' | 'canary_run' | 'public_channel_status' | 'request_source' | 'request_restricted_source' | 'create_watchlist' | 'rebuild_alerts', query: string, source: SourceRow | undefined, input: { sourceTarget: string; watchTerms: string }) {
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
            type: stringValue(record.type) || stringValue(metadata.sourceFamily) || 'unknown',
            status: stringValue(record.status) || 'unknown',
            risk: stringValue(record.risk) || 'unknown',
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
            anchorText: stringValue(task.anchorText) || stringValue(task.query) || 'Queued task',
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
            id: 'scraper-unavailable',
            kind: 'platform',
            title: 'Connect scraper backend',
            subtitle: snapshot.error.message,
            queue: 'Platform',
            severity: 'critical',
            status: 'blocked',
            timestamp: generatedAt,
            evidence: [{ label: 'Missing', value: 'TI_SCRAPER_API_BASE or scraper response' }],
            nextActions: ['Configure TI_SCRAPER_API_BASE.', 'Verify /v1/health.', 'Reload source operations.'],
        })
    }

    for (const task of tasks.slice(0, 10)) {
        const source = sources.find(item => item.id === task.sourceId)
        items.push({
            id: `task-${task.id}`,
            kind: 'frontier_task',
            title: task.anchorText || `Frontier task ${task.id}`,
            subtitle: task.url || `Queued for ${source?.name || task.sourceId || 'unknown source'}.`,
            queue: 'Run queue',
            severity: task.score > 0.8 ? 'high' : 'medium',
            status: 'queued',
            timestamp: formatTime(task.discoveredAt),
            sourceId: task.sourceId,
            task,
            evidence: [
                { label: 'Task ID', value: task.id },
                { label: 'Source', value: source?.name || task.sourceId || 'unknown' },
                { label: 'Fairness key', value: task.fairnessKey },
                { label: 'Score', value: task.score ? `${Math.round(task.score * 100)}%` : 'not scored' },
                { label: 'URL', value: task.url || 'not returned' },
                { label: 'Discovered', value: formatTime(task.discoveredAt) },
            ],
            nextActions: ['Let the worker lease this task or run the query again if stale.', 'Check source policy before increasing concurrency.', 'Promote only after capture, dedupe, and quality gates pass.'],
        })
    }

    for (const source of sources.filter(source => source.status !== 'active').slice(0, 8)) {
        items.push({
            id: `source-review-${source.id}`,
            kind: 'source',
            sourceId: source.id,
            title: `Review ${source.name}`,
            subtitle: `${source.status} source with ${source.risk} risk. Dry-run source changes before promotion, quarantine, or legal-note refresh.`,
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
            nextActions: ['Run a source apply-plan dry run.', 'Confirm legal notes and metadata-only boundaries.', 'Promote safe sources or quarantine low-value/noisy sources.'],
        })
    }

    const queued = numberFrom(snapshot?.frontier?.queued) ?? tasks.length
    if (queued > 0 && tasks.length === 0) {
        items.push({
            id: 'frontier-queue',
            kind: 'run',
            title: `${queued} queued frontier tasks`,
            subtitle: 'Queue pressure exists, but task details were not returned by the current frontier endpoint.',
            queue: 'Scheduler',
            severity: queued > 200 ? 'high' : 'medium',
            status: 'queued',
            timestamp: generatedAt,
            evidence: [{ label: 'Queued', value: String(queued) }, { label: 'Endpoint', value: '/v1/frontier' }],
            nextActions: ['Check resource snapshot.', 'Avoid adding broad searches until queue age is healthy.', 'Run canary only if worker pressure is acceptable.'],
        })
    }

    const restrictedStatus = asRecord(snapshot?.restricted?.status)
    const restrictedQueue = numberFrom(restrictedStatus.reviewQueueCount) ?? numberFrom(restrictedStatus.metadataReviewCount) ?? 0
    if (restrictedQueue > 0) {
        items.push({
            id: 'restricted-review',
            kind: 'policy',
            title: `${restrictedQueue} restricted metadata reviews`,
            subtitle: 'Metadata-only records require review without opening raw leaked files, credentials, or unsafe targets.',
            queue: 'Policy',
            severity: 'high',
            status: 'review',
            timestamp: generatedAt,
            evidence: [{ label: 'Review count', value: String(restrictedQueue) }, { label: 'Endpoint', value: '/v1/restricted-metadata/status' }],
            nextActions: ['Review metadata only.', 'Block raw payload paths.', 'Promote only redacted source timing, hashes, and safe excerpts.'],
        })
    }

    const growth = sourceGrowthKpis(snapshot, sources)
    if (growth.activeTelegram === 0 || growth.activeDarkweb === 0) {
        items.push({
            id: 'source-growth-gap',
            kind: 'source',
            title: 'Grow monitored source coverage',
            subtitle: `${growth.activeTelegram} active Telegram source(s), ${growth.activeDarkweb} active darkweb/onion metadata source(s). Add safe public channels or request metadata-only restricted coverage.`,
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
            nextActions: ['Add a safe public Telegram candidate.', 'Request restricted metadata-only coverage for actor/onion sources.', 'Run canary and source apply-plan before promotion.'],
        })
    }

    if (growth.watchlists === 0 || growth.alertsGenerated === 0) {
        items.push({
            id: 'alert-generation-gap',
            kind: 'quality',
            title: 'Create watchlist and rebuild alerts',
            subtitle: `${growth.watchlists} watchlist(s), ${growth.watchlistMatches} match(es), ${growth.alertsGenerated} persisted alert(s), ${growth.webhookDeliveries} webhook deliver${growth.webhookDeliveries === 1 ? 'y' : 'ies'}.`,
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
            title: `${endpointFailures.length} scraper endpoint failures`,
            subtitle: endpointFailures.map(([name]) => name).join(', '),
            queue: 'Platform',
            severity: endpointFailures.some(([, state]) => state.status >= 500 || state.status === 0) ? 'high' : 'medium',
            status: 'degraded',
            timestamp: generatedAt,
            evidence: endpointFailures.slice(0, 6).map(([name, state]) => ({ label: name, value: state.error || `HTTP ${state.status}` })),
            nextActions: ['Check scraper container health.', 'Verify route inventory and deployment drift.', 'Keep public promotion on hold until endpoint probes are green.'],
        })
    }

    if (!items.length && snapshot?.ok) {
        items.push({
            id: 'steady-state',
            kind: 'quality',
            title: 'Pipeline steady',
            subtitle: 'No queue pressure, source-review, restricted-review, or endpoint-failure items surfaced by the current endpoint set.',
            queue: 'Monitoring',
            severity: 'low',
            status: 'steady',
            timestamp: generatedAt,
            evidence: [{ label: 'Query', value: snapshot.query || defaultQuery }, { label: 'Sources', value: String(sources.length) }],
            nextActions: ['Run a targeted canary.', 'Refresh actor enrichment.', 'Inspect public-page quality for the selected query.'],
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
        items.unshift({ id: 'action', title: actionResult.ok ? 'API action returned' : 'API action failed', at: 'This session', body: actionSummary(actionResult) })
    }
    if (snapshot?.generatedAt) {
        items.push({ id: 'snapshot', title: 'Control snapshot loaded', at: formatTime(snapshot.generatedAt), body: `${Object.keys(snapshot.endpoints ?? {}).length} scraper endpoints were probed.` })
    }
    if (snapshot?.query) {
        items.push({ id: 'query', title: 'Query context selected', at: formatTime(snapshot.generatedAt), body: `${snapshot.query} is used for quality, public-channel, restricted metadata, and run actions.` })
    }
    return items.length ? items : [{ id: 'empty', title: 'Waiting for scraper state', at: 'Now', body: 'Load the control page once TI_SCRAPER_API_BASE is configured.' }]
}

function publicImpactFor(item: WorkItem, query: string) {
    if (item.kind === 'frontier_task') return `If this task captures relevant evidence for ${query}, it can become a source-backed activity row after dedupe, redaction, and quality gating.`
    if (item.kind === 'source') return `This source can expand or degrade ${query} coverage. Changes should go through dry-run apply plans so public actor pages do not inherit noisy or unsafe evidence.`
    if (item.kind === 'policy') return `Restricted metadata can support review state, hashes, timing, actor/victim fields, and safe excerpts, but it should not expose raw leaked data on /ti/${encodeURIComponent(query)}.`
    if (item.kind === 'platform') return 'Endpoint failures can force the public page into searching/partial states even when sources exist.'
    return `This item affects whether /ti/${encodeURIComponent(query)} has current collection evidence, freshness, and provenance.`
}

function provenanceFor(item: WorkItem, source?: SourceRow) {
    if (item.task) return `Task ${item.task.id}, source ${source?.name || item.task.sourceId || 'unknown'}, fairness ${item.task.fairnessKey}, discovered ${formatTime(item.task.discoveredAt)}.`
    if (source) return `Source ${source.id}, ${source.type}, status ${source.status}, risk ${source.risk}, trust ${Math.round(source.trustScore * 100)}%.`
    return 'No source or task provenance returned for the selected item.'
}

function qualitySummary(snapshot: ControlSnapshot | null) {
    const quality = asRecord(snapshot?.quality)
    const nested = asRecord(quality.quality)
    const publicWarningText = stringArray(nested.publicWarningText).join(', ')
    const state = stringValue(nested.status) || stringValue(quality.status)
    if (state || publicWarningText) return `${state || 'quality returned'}${publicWarningText ? `: ${publicWarningText}` : ''}`
    return 'Quality endpoint returned no explicit gate summary for this query.'
}

function policySummary(item: WorkItem, source: SourceRow | undefined, snapshot: ControlSnapshot | null) {
    if (item.kind === 'policy' || source?.risk === 'restricted') return 'Restricted paths stay metadata-only: no raw leaked files, credential values, private access, CAPTCHA bypass, actor interaction, or payload redistribution.'
    const restricted = asRecord(snapshot?.restricted?.status)
    const status = stringValue(restricted.state) || stringValue(restricted.status)
    return status ? `Restricted metadata state: ${status}.` : 'No restricted metadata blocker was returned for the selected query.'
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
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 dark:border-[#2a3d5c] dark:bg-[#0f172a]'>
            <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#8795ad]'>{title}</p>
            <p className='mt-2 text-sm leading-6 text-[#344054] dark:text-[#d8deea]'>{body}</p>
        </div>
    )
}

function Metric({ title, value, detail, icon, tone }: { title: string; value: string; detail: string; icon: ReactNode; tone: 'ok' | 'warn' | 'bad' | 'hold' }) {
    const className = tone === 'ok' ? 'text-[#147a3b]' : tone === 'warn' ? 'text-[#b45309]' : tone === 'bad' ? 'text-[#b42318]' : 'text-[#3056d3]'
    return (
        <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#2a3d5c] dark:bg-[#111827]'>
            <div className={`flex items-center justify-between ${className}`}>
                <p className='text-xs font-semibold uppercase'>{title}</p>
                {icon}
            </div>
            <p className='mt-3 text-xl font-semibold text-[#171a21] dark:text-[#d8deea]'>{value}</p>
            <p className='mt-1 text-sm leading-5 text-[#596170] dark:text-[#aab6ca]'>{detail}</p>
        </div>
    )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className='rounded-lg border border-[#dfe5ee] bg-white px-2 py-2 dark:border-[#2a3d5c] dark:bg-[#111827]'>
            <p className='text-[10px] font-semibold uppercase text-[#667085] dark:text-[#8795ad]'>{label}</p>
            <p className='mt-1 text-sm font-semibold text-[#171a21] dark:text-[#d8deea]'>{value}</p>
        </div>
    )
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 dark:border-[#2a3d5c] dark:bg-[#0f172a]'>
            <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#8795ad]'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold leading-5 text-[#171a21] dark:text-[#d8deea]'>{value || 'unknown'}</p>
        </div>
    )
}

function SidePanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
    return (
        <section className='rounded-lg border border-[#e0e5ed] bg-white p-4 dark:border-[#2a3d5c] dark:bg-[#111827]'>
            <div className='flex items-center gap-2 text-sm font-semibold text-[#171a21] dark:text-[#d8deea]'>
                <span className='text-[#3056d3]'>{icon}</span>
                {title}
            </div>
            <div className='mt-3 grid gap-2 text-xs leading-5 text-[#596170] dark:text-[#aab6ca]'>{children}</div>
        </section>
    )
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
    return (
        <section className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm dark:border-[#2a3d5c] dark:bg-[#111827]'>
            <div className='mb-3 flex items-center gap-2 text-sm font-semibold text-[#171a21] dark:text-[#d8deea]'>
                <span className='text-[#3056d3]'>{icon}</span>
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
            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white text-center text-sm font-semibold leading-tight text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#2a3d5c] dark:bg-[#111827] dark:text-[#d8deea] dark:hover:bg-[#172033] ${compact ? 'min-h-8 min-w-32 px-2 py-1.5 text-xs' : 'min-h-10 min-w-44 px-3 py-2'}`}
        >
            <span className='shrink-0'>{busy ? <RefreshCcw className='h-4 w-4 animate-spin' /> : icon}</span>
            <span className='min-w-0 wrap-break-word whitespace-normal sm:whitespace-nowrap'>{children}</span>
        </button>
    )
}

function Notice({ tone, title, body }: { tone: 'ok' | 'bad'; title: string; body: string }) {
    const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle
    const className = tone === 'ok' ? 'border-[#d6e9de] bg-[#f4fbf7] text-[#147a3b]' : 'border-[#fde2d6] bg-[#fff7f3] text-[#9a3412]'
    return (
        <div className={`grid gap-1 rounded-lg border p-3 text-sm ${className}`}>
            <p className='flex items-center gap-2 font-semibold'><Icon className='h-4 w-4' />{title}</p>
            <p className='leading-6'>{body}</p>
        </div>
    )
}

function severityClass(severity: WorkItem['severity']) {
    if (severity === 'critical') return 'rounded-full bg-[#fee4e2] px-2 py-0.5 text-[11px] font-semibold text-[#b42318]'
    if (severity === 'high') return 'rounded-full bg-[#fff0eb] px-2 py-0.5 text-[11px] font-semibold text-[#c2410c]'
    if (severity === 'medium') return 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]'
    return 'rounded-full bg-[#f4fbf7] px-2 py-0.5 text-[11px] font-semibold text-[#147a3b]'
}

function actionSummary(result: ActionResult) {
    if (typeof result.error === 'string') return result.error
    if (result.error?.message) return result.error.message
    const payload = asRecord(result.payload)
    const run = asRecord(payload.run)
    if (run.id) return `Run ${String(run.id)} returned with ${String(run.taskCount ?? 'unknown')} task(s).`
    if (Array.isArray(payload.warmed)) return `Enrichment warmed ${payload.warmed.length} actor profile(s).`
    if (payload.applyPlan || payload.contract) return 'Source plan returned. Review affected sources before applying changes.'
    return result.ok ? 'The scraper/API returned a response.' : 'The action did not complete.'
}

function defaultDecisionReason(status: string) {
    if (status.includes('retry')) return 'Retry requested from source operations.'
    if (status.includes('promoted')) return 'Promoted for analyst review from source operations.'
    if (status.includes('suppressed')) return 'Suppressed locally pending persistent workflow support.'
    return 'Updated from source operations.'
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
