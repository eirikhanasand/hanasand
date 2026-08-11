'use client'

import type { SyntheticEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, DatabaseZap, Gauge, PlayCircle, RefreshCcw, RotateCcw, Search, Workflow } from 'lucide-react'

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
    decisions: Record<string, { status: string; reason: string; at: string }>
}

const defaultQuery = ''

export default function TiScraperControlClient() {
    const [query, setQuery] = useState(defaultQuery)
    const [snapshot, setSnapshot] = useState<ControlSnapshot | null>(null)
    const [selectedWorkId, setSelectedWorkId] = useState('')
    const [loading, setLoading] = useState(true)
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [actionResult, setActionResult] = useState<ActionResult | null>(null)
    const [error, setError] = useState('')
    const [localControl, setLocalControl] = useState<LocalControl>({ decisions: {} })

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
    const endpointRows = Object.entries(snapshot?.endpoints ?? {})
    const queueCount = numberFrom(snapshot?.frontier?.queued) ?? numberFrom(snapshot?.resources?.queue?.queued) ?? frontierTasks.length
    const healthyEndpoints = endpointRows.filter(([, state]) => state.ok).length
    const sourceGrowth = sourceGrowthKpis(snapshot, sources)
    const scheduler = schedulerKpis(snapshot)

    async function runAction(action: 'run_query' | 'scheduler_run_now' | 'scheduler_pause' | 'scheduler_resume' | 'public_channel_status' | 'request_source' | 'request_restricted_source' | 'create_watchlist' | 'rebuild_alerts') {
        setBusyAction(action)
        setActionResult(null)
        try {
            const response = await fetch('/api/ti/scraper/control', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(actionBody(action, query, selectedSource, { sourceTarget: '', watchTerms: '' })),
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


    function submit(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const clean = query.trim() || defaultQuery
        setQuery(clean)
        void load(clean)
    }

    function applySessionDecision(status: string) {
        if (!selected) return
        setLocalControl(current => ({
            ...current,
            decisions: {
                ...current.decisions,
                [selected.id]: {
                    status,
                    reason: defaultDecisionReason(status),
                    at: new Date().toISOString(),
                },
            },
        }))
    }

    const sourceCount = scheduler.totalSources || sources.length
    const serviceReady = Boolean(snapshot?.ok && snapshot.baseConfigured !== false && !error)
    const hasFailures = endpointRows.some(([, state]) => !state.ok)
    const statusTitle = loading && !snapshot ? 'Connecting' : error || !serviceReady ? 'Unavailable' : hasFailures ? 'Needs attention' : queueCount ? 'Work queued' : 'Running normally'
    const statusBody = statusTitle === 'Running normally' ? 'The scheduler is collecting sources automatically.' : statusTitle === 'Work queued' ? `${queueCount} collection item(s) need attention.` : statusTitle === 'Needs attention' ? 'One or more collection checks need attention.' : 'The collection service did not return a usable status.'

    return (
        <div className='source-ops-workbench grid gap-3'>
            {actionResult ? <Notice tone={actionResult.ok ? 'ok' : 'bad'} title={actionResult.ok ? 'Action completed' : 'Action failed'} body={actionSummary(actionResult)} /> : null}

            <section className='rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                        <p className='text-xs font-semibold uppercase tracking-wide text-ui-primary'>Step 1 · System status</p>
                        <h2 className='mt-1 text-xl font-semibold text-ui-text'>{statusTitle}</h2>
                        <p className='mt-1 text-sm text-ui-muted'>{statusBody}</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <ActionButton compact busy={busyAction === 'scheduler_run_now'} icon={<PlayCircle className='h-4 w-4' />} onClick={() => runAction('scheduler_run_now')}>Run due</ActionButton>
                        <button type='button' onClick={() => void load(query)} className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-ui-border bg-ui-raised px-3 py-1.5 text-xs font-semibold text-ui-text hover:bg-ui-panel'>
                            <RefreshCcw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
                        </button>
                    </div>
                </div>
                <div className='mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5'>
                    <MiniMetric label='Active sources' value={String(scheduler.activeSources || sourceCount)} />
                    <MiniMetric label='Pending work' value={String(queueCount)} />
                    <MiniMetric label="Today's coverage" value={coverageLabel(scheduler.dailyCovered, scheduler.dailySources)} />
                    <MiniMetric label='Latest run' value={scheduler.lastRunStatus || 'No run recorded'} />
                    <MiniMetric label='Alerts' value={String(sourceGrowth.alertsGenerated)} />
                </div>
            </section>

            {error || (!loading && !serviceReady) ? (
                <section className='grid gap-2 rounded-lg border border-ui-danger/35 bg-ui-danger/10 p-5 text-center'>
                    <AlertTriangle className='mx-auto h-7 w-7 text-ui-danger' />
                    <h2 className='text-lg font-semibold text-ui-text'>Collection unavailable</h2>
                    <p className='text-sm text-ui-muted'>{error || 'The source service is not ready. No empty or guessed data is shown.'}</p>
                    <button type='button' onClick={() => void load(query)} className='mx-auto inline-flex min-h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text hover:bg-ui-panel'><RefreshCcw className='h-4 w-4' /> Retry</button>
                </section>
            ) : loading && !snapshot ? (
                <div className='grid min-h-32 place-items-center rounded-lg border border-ui-border bg-ui-panel text-sm text-ui-muted'><RefreshCcw className='mr-2 inline h-4 w-4 animate-spin' /> Loading collection status…</div>
            ) : (
                <section className='grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]'>
                    <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <div>
                                <p className='text-xs font-semibold uppercase tracking-wide text-ui-primary'>Step 2 · Next actions</p>
                                <h2 className='mt-1 text-lg font-semibold text-ui-text'>{workItems.length ? `${workItems.length} item${workItems.length === 1 ? '' : 's'} queued` : 'No action required'}</h2>
                            </div>
                            <form onSubmit={submit} className='flex min-w-0 gap-1.5'>
                                <label className='relative min-w-0'>
                                    <Search className='pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-primary' />
                                    <input value={query} onChange={event => setQuery(event.target.value)} className='h-8 w-full rounded-md border border-ui-border bg-ui-canvas pl-8 pr-2 text-xs text-ui-text outline-none focus:border-ui-primary' placeholder='Filter' />
                                </label>
                                <button type='submit' className='rounded-md border border-ui-border bg-ui-raised px-2 text-xs font-semibold text-ui-text'>Go</button>
                            </form>
                        </div>
                        <div className='mt-3 grid max-h-[32rem] gap-1.5 overflow-auto'>
                            {workItems.slice(0, 8).map(item => {
                                const active = selected?.id === item.id
                                const decision = localControl.decisions[item.id]
                                return <button key={item.id} type='button' onClick={() => setSelectedWorkId(item.id)} className={`grid gap-1 rounded-md border p-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${active ? 'border-ui-primary bg-ui-raised' : 'border-ui-border bg-ui-canvas hover:bg-ui-raised'}`}>
                                    <div className='flex items-center justify-between gap-2'><span className={severityClass(item.severity)}>{item.severity}</span><span className='text-[11px] text-ui-muted'>{decision?.status || 'Open'}</span></div>
                                    <span className='text-sm font-semibold text-ui-text'>{item.title}</span>
                                    <span className='line-clamp-2 text-xs leading-5 text-ui-muted'>{item.subtitle}</span>
                                </button>
                            })}
                            {!workItems.length ? <div className='grid place-items-center rounded-md border border-dashed border-ui-border p-8 text-center'><CheckCircle2 className='h-7 w-7 text-ui-success' /><p className='mt-2 text-sm font-semibold text-ui-text'>Collection is running automatically</p><p className='mt-1 text-xs text-ui-muted'>New failures, overdue sources, and useful output are listed in this queue.</p></div> : null}
                        </div>
                    </div>

                    <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                        <p className='text-xs font-semibold uppercase tracking-wide text-ui-primary'>Step 3 · Selected action</p>
                        {selected ? <>
                            <div className='mt-2 flex flex-wrap items-start justify-between gap-2'><div><h2 className='text-lg font-semibold text-ui-text'>{selected.title}</h2><p className='mt-1 text-sm text-ui-muted'>{selected.subtitle}</p></div><span className={severityClass(selected.severity)}>{selected.severity}</span></div>
                            <div className='mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>{selected.evidence.slice(0, 6).map(item => <Info key={item.label} label={item.label} value={item.value} />)}</div>
                            <div className='mt-3 rounded-md border border-ui-border bg-ui-canvas p-3'><p className='text-xs font-semibold uppercase text-ui-muted'>What happens next</p><ol className='mt-2 grid gap-1.5'>{selected.nextActions.slice(0, 3).map((action, index) => <li key={action} className='flex gap-2 text-sm text-ui-text'><span className='font-semibold text-ui-primary'>{index + 1}.</span>{action}</li>)}</ol></div>
                            <div className='mt-3 flex flex-wrap gap-2'><ActionButton compact busy={busyAction === 'scheduler_run_now'} icon={<PlayCircle className='h-4 w-4' />} onClick={() => runAction('scheduler_run_now')}>Run due sources</ActionButton><ActionButton compact busy={busyAction === 'rebuild_alerts'} icon={<RefreshCcw className='h-4 w-4' />} onClick={() => runAction('rebuild_alerts')}>Rebuild alerts</ActionButton><button type='button' onClick={() => applySessionDecision('retry requested')} className='inline-flex min-h-8 items-center gap-1.5 rounded-md border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text'><RotateCcw className='h-4 w-4' /> Mark retry</button></div>
                        </> : <div className='grid min-h-48 place-items-center text-center text-sm text-ui-muted'>Select an action to see the evidence and available controls.</div>}
                    </div>
                </section>
            )}

            <section className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'><div><p className='text-xs font-semibold uppercase tracking-wide text-ui-primary'>Collection coverage</p><h2 className='mt-1 text-lg font-semibold text-ui-text'>What is being collected</h2></div><Link href='/dashboard/ti/sources' className='text-sm font-semibold text-ui-primary underline underline-offset-4'>Open source inventory</Link></div>
                <div className='mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4'><Info label='Active sources' value={String(scheduler.activeSources || sourceCount)} /><Info label='Last useful output' value={String(scheduler.usefulSources)} /><Info label='Degraded sources' value={String(sourceGrowth.failingSources)} /><Info label='Customer alerts' value={String(sourceGrowth.alertsGenerated)} /></div>
            </section>

            <details className='group rounded-lg border border-ui-border bg-ui-panel' data-ti-control-telemetry-disclosure>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-ui-text [&::-webkit-details-marker]:hidden'>Technical health <span className='text-xs font-medium text-ui-muted'>{healthyEndpoints}/{Math.max(endpointRows.length, 1)} checks healthy <ChevronDown className='inline h-4 w-4 transition group-open:rotate-180' /></span></summary>
                <div className='grid gap-3 border-t border-ui-border p-3'><div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'><Metric title='Scraper' value={snapshot?.health ? 'Reachable' : loading ? 'Loading' : 'Unavailable'} detail={`${healthyEndpoints}/${Math.max(endpointRows.length, 1)} checks healthy`} icon={<Gauge className='h-4 w-4' />} tone={snapshot?.health ? 'ok' : 'bad'} /><Metric title='Scheduler' value={scheduler.lastRunStatus || 'Ready'} detail={scheduler.nextRunAt ? `Next run ${formatTime(scheduler.nextRunAt)}` : 'Automatic collection enabled'} icon={<Workflow className='h-4 w-4' />} tone='ok' /><Metric title='Parser' value={scheduler.aiStatus} detail={scheduler.aiDetail} icon={<DatabaseZap className='h-4 w-4' />} tone={scheduler.aiReady ? 'ok' : 'warn'} /><Metric title='Alerts' value={String(sourceGrowth.alertsGenerated)} detail={`${sourceGrowth.watchlistMatches} matches`} icon={<Clock3 className='h-4 w-4' />} tone={sourceGrowth.alertsGenerated ? 'ok' : 'hold'} /></div><div className='grid gap-2 md:grid-cols-2'>{endpointRows.map(([name, state]) => <div key={name} className='flex items-center justify-between rounded-md border border-ui-border bg-ui-canvas px-3 py-2 text-xs'><span className='font-semibold text-ui-text'>{name}</span><span className={state.ok ? 'text-ui-success' : 'text-ui-danger'}>{state.ok ? 'Healthy' : state.error || `HTTP ${state.status}`}</span></div>)}</div></div>
            </details>
        </div>
    )

}

function actionBody(action: 'run_query' | 'scheduler_run_now' | 'scheduler_pause' | 'scheduler_resume' | 'public_channel_status' | 'request_source' | 'request_restricted_source' | 'create_watchlist' | 'rebuild_alerts', query: string, source: SourceRow | undefined, input: { sourceTarget: string; watchTerms: string }) {
    if (action === 'request_source') {
        return { action, query, target: input.sourceTarget, sourceType: 'telegram_channel', activate: false }
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
            discoveredAt: stringValue(task.discoveredAt) || stringValue(task.createdAt) || '',
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
    const generatedAt = snapshot?.generatedAt ? formatTime(snapshot.generatedAt) : 'Time unavailable'
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
            queue: 'Collection queue',
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
            queue: 'Source review',
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
            subtitle: 'Collection tasks are waiting; they will be processed by the scheduler.',
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
            nextActions: ['Add a safe public Telegram candidate.', 'Request sensitive actor/onion coverage.', 'Run the scheduler before promotion.'],
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
            subtitle: 'Collection queue, source review, restricted review, and service checks are clear.',
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
        activeSources: numberFrom(coverage.activeSourceCount) ?? 0,
        checkedSources: numberFrom(coverage.checkedSourceCount) ?? 0,
        successfulSources: numberFrom(coverage.successfulSourceCount) ?? 0,
        usefulSources: numberFrom(coverage.usefulSourceCount) ?? 0,
        captureProducingSources: numberFrom(coverage.captureProducingSourceCount) ?? 0,
        recentlySeenSources: numberFrom(coverage.recentlySeenSourceCount) ?? 0,
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

function coverageLabel(covered: number, total: number) {
    return total > 0 ? `${covered}/${total}` : '—'
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
    return result.ok ? 'The scraper responded.' : 'The action did not complete.'
}

function defaultDecisionReason(status: string) {
    if (status.includes('retry')) return 'Retry requested from collection.'
    if (status.includes('promoted')) return 'Promoted for review from collection.'
    if (status.includes('suppressed')) return 'Suppressed locally pending persistent workflow support.'
    return 'Updated from collection.'
}

function formatTime(value?: string) {
    if (!value) return 'Time unavailable'
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
