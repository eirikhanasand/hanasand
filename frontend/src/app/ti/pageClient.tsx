'use client'

import searchThreatIntel, { TiOperationalStatus, TiSearchResponse } from '@/utils/ti/search'
import { Activity, AlertTriangle, Clock3, Database, ExternalLink, Gauge, GitBranch, Globe2, ListChecks, Radar, RefreshCw, Search, ShieldCheck, Target, TimerReset, Waypoints } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'

export default function TiPageClient({ initialResult }: { initialResult: TiSearchResponse | null }) {
    const [query, setQuery] = useState(initialResult?.query ?? '')
    const [result, setResult] = useState<TiSearchResponse | null>(initialResult)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!result?.refreshAfterSeconds || result.status === 'ready') return
        const expectedQuery = result.query
        const timer = window.setTimeout(async () => {
            const next = await searchThreatIntel(expectedQuery)
            if (next) {
                setResult(next)
                setQuery(next.query)
            }
        }, Math.max(5, result.refreshAfterSeconds) * 1000)

        return () => window.clearTimeout(timer)
    }, [result])

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const clean = query.trim()
        if (!clean || busy) return

        setBusy(true)
        setError('')
        setResult(searchingResult(clean))
        try {
            const next = await searchThreatIntel(clean)
            if (!next) {
                setError('The TI service did not return results.')
                return
            }
            setResult(next)
        } finally {
            setBusy(false)
        }
    }

    const visible = result

    return (
        <div className='mx-auto grid w-full max-w-7xl gap-6'>
            <form onSubmit={submit} className='grid gap-3 border-b border-white/10 pb-5'>
                <div className='flex flex-col gap-3 md:flex-row md:items-end'>
                    <label className='grid flex-1 gap-2'>
                        <span className='text-xs font-semibold uppercase text-bright/40'>Threat intelligence search</span>
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder='Actor, ransomware group, CVE, malware...'
                            className='h-12 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-bright outline-none transition placeholder:text-bright/25 focus:border-[#6bc9d8]/60 focus:bg-white/[0.065]'
                        />
                    </label>
                    <button
                        type='submit'
                        disabled={busy || query.trim().length === 0}
                        className='inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-bright px-5 text-sm font-semibold text-background transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-bright/35'
                    >
                        <Search className='h-4 w-4' />
                        {busy ? 'Searching' : 'Search'}
                    </button>
                </div>
                {error ? <p className='text-sm text-red-300'>{error}</p> : null}
            </form>

            {visible ? <Results result={visible} /> : <EmptyState />}
        </div>
    )
}

function Results({ result }: { result: TiSearchResponse }) {
    const sourceUrlById = new Map(result.sources.map(source => [source.id, source.url || linkFromText(source.provenance)]))
    return (
        <div className='grid gap-6'>
            <section className='grid gap-4 border-b border-white/10 pb-6 lg:grid-cols-[1.25fr_0.75fr]'>
                <div className='grid gap-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <h1 className='text-3xl font-semibold text-bright md:text-4xl'>{result.query}</h1>
                        <span className='rounded-md border border-white/10 bg-white/[0.045] px-2 py-1 text-xs font-medium uppercase text-bright/55'>
                            {result.mode}
                        </span>
                        {result.status ? (
                            <span className='rounded-md border border-[#6bc9d8]/25 bg-[#6bc9d8]/10 px-2 py-1 text-xs font-medium uppercase text-[#9fe8f1]'>
                                {result.status}
                            </span>
                        ) : null}
                    </div>
                    <p className='max-w-4xl text-sm leading-6 text-bright/62'>{result.summary}</p>
                    <div className='flex flex-wrap gap-2'>
                        {result.aliases.map(alias => (
                            <span key={alias} className='rounded-md bg-white/[0.055] px-2 py-1 text-xs text-bright/62'>{alias}</span>
                        ))}
                    </div>
                </div>
                <div className='grid gap-2 text-sm'>
                    <Metric icon={<ShieldCheck className='h-4 w-4' />} label='Confidence' value={`${Math.round(result.confidence * 100)}%`} />
                    <Metric icon={<Activity className='h-4 w-4' />} label='Updated' value={formatDate(result.generatedAt || result.lastSeen)} />
                    <Metric icon={<Database className='h-4 w-4' />} label='Sources' value={`${result.sources.length}`} />
                    {result.runId ? <Metric icon={<Radar className='h-4 w-4' />} label='Run' value={result.runId} /> : null}
                </div>
            </section>

            <OperationalStatusPanel result={result} />

            <section className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
                <Panel title='Recent Activity' icon={<Radar className='h-4 w-4' />}>
                    {result.recentActivity.length ? result.recentActivity.map(item => {
                        const href = item.url || item.sourceIds.map(id => sourceUrlById.get(id)).find(Boolean)
                        return (
                            <EvidenceBox key={`${item.date}-${item.title}`} href={href}>
                                <div className='flex items-center justify-between gap-3'>
                                    <h2 className='text-sm font-semibold text-bright/82'>{item.title}</h2>
                                    <span className='text-xs text-bright/38'>{item.date}</span>
                                </div>
                                <p className='text-sm leading-6 text-bright/55'>{item.detail}</p>
                                <p className='inline-flex items-center gap-1 text-xs text-bright/35'>Confidence {Math.round(item.confidence * 100)}% · {item.sourceIds.join(', ')}{href ? <ExternalLink className='h-3 w-3 text-[#6bc9d8]' /> : null}</p>
                            </EvidenceBox>
                        )}) : <EmptyLine text={result.status === 'searching' ? 'Searching' : 'No activity returned yet.'} />}
                </Panel>

                <Panel title='Targeting' icon={<Target className='h-4 w-4' />}>
                    {result.targets.length ? result.targets.map(item => (
                        <div key={item.sector} className='grid gap-1 border-b border-white/8 py-3 last:border-b-0'>
                            <h2 className='text-sm font-semibold text-bright/82'>{item.sector}</h2>
                            <p className='text-xs text-bright/38'>{item.regions.join(', ')}</p>
                            <p className='text-sm leading-6 text-bright/55'>{item.rationale}</p>
                        </div>
                    )) : <EmptyLine text='No targeting returned yet.' />}
                </Panel>
            </section>

            <section className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
                <Panel title='Observed Tradecraft' icon={<Waypoints className='h-4 w-4' />}>
                    {result.ttps.map(item => (
                        <div key={`${item.attackId}-${item.name}`} className='grid gap-1 border-b border-white/8 py-3 last:border-b-0'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <h2 className='text-sm font-semibold text-bright/82'>{item.name}</h2>
                                {item.attackId ? <span className='text-xs text-[#6bc9d8]'>{item.attackId}</span> : null}
                            </div>
                            <p className='text-xs text-bright/38'>{item.tactic}</p>
                            <p className='text-sm leading-6 text-bright/55'>{item.detail}</p>
                        </div>
                    ))}
                </Panel>

                <Panel title='Datasets And Coverage' icon={<Globe2 className='h-4 w-4' />}>
                    {result.datasets.map(item => (
                        <EvidenceBox key={`${item.type}-${item.name}`} href={item.url}>
                            <div className='flex items-center justify-between gap-3'>
                                <h2 className='text-sm font-semibold text-bright/82'>{item.name}</h2>
                                <span className='text-xs text-bright/38'>{item.status}</span>
                            </div>
                            <p className='text-sm leading-6 text-bright/55'>{item.coverage}</p>
                        </EvidenceBox>
                    ))}
                </Panel>
            </section>

            <section className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
                <Panel title='Provenance' icon={<ExternalLink className='h-4 w-4' />}>
                    {result.sources.map(source => {
                        const href = source.url || linkFromText(source.provenance)
                        return (
                            <EvidenceBox key={source.id} href={href}>
                                <h2 className='inline-flex items-center gap-1 text-sm font-semibold text-bright/82'>{source.name}{href ? <ExternalLink className='h-3 w-3 text-[#6bc9d8]' /> : null}</h2>
                                <p className='text-xs text-bright/38'>{source.id} · {source.type}</p>
                                <p className='text-sm leading-6 text-bright/55'>{source.provenance}</p>
                            </EvidenceBox>
                        )})}
                </Panel>

                <Panel title='Notes' icon={<ShieldCheck className='h-4 w-4' />}>
                    {result.notes.map(note => (
                        <p key={note} className='border-b border-white/8 py-3 text-sm leading-6 text-bright/55 last:border-b-0'>{note}</p>
                    ))}
                </Panel>
            </section>
        </div>
    )
}

function EvidenceBox({ href, children }: { href?: string; children: React.ReactNode }) {
    const className = `grid gap-1 border-b border-white/8 py-3 last:border-b-0 ${href ? 'rounded-md px-2 transition hover:border-[#6bc9d8]/20 hover:bg-[#6bc9d8]/5 focus:outline-none focus:ring-1 focus:ring-[#6bc9d8]/35' : ''}`
    if (!href) return <div className={className}>{children}</div>
    return (
        <a href={href} target='_blank' rel='noreferrer' className={className} title={href}>
            {children}
        </a>
    )
}

function EmptyState() {
    return (
        <section className='grid min-h-[48vh] place-items-center border border-white/10 bg-white/[0.025] px-5 py-10 text-center'>
            <div className='grid max-w-xl gap-3'>
                <Radar className='mx-auto h-8 w-8 text-[#6bc9d8]' />
                <h1 className='text-2xl font-semibold text-bright'>Search threat intelligence</h1>
                <p className='text-sm leading-6 text-bright/52'>Enter an actor, ransomware group, CVE, malware family, sector, or victim name.</p>
            </div>
        </section>
    )
}

function searchingResult(query: string): TiSearchResponse {
    const now = new Date().toISOString()
    return {
        query,
        generatedAt: now,
        mode: 'live_search',
        status: 'searching',
        refreshAfterSeconds: 3,
        summary: 'Searching',
        confidence: 0.2,
        lastSeen: now,
        aliases: [],
        recentActivity: [],
        targets: [],
        ttps: [],
        datasets: [],
        sources: [],
        notes: [],
        operationalStatus: {
            state: 'searching',
            headline: 'Submitting this search to the live TI scheduler.',
            queue: {
                selectedTasks: 0,
                queuedTasks: 0,
                leasedTasks: 0,
                reviewTasks: 0,
                maxAgeSeconds: 0,
                p95AgeSeconds: 0,
                nextPollSeconds: 3,
                backpressureState: 'submitting',
                cursorContinuity: 'pending'
            },
            workers: {
                leaseState: 'waiting for scheduler',
                retryDebt: 0,
                deadLetters: 0,
                backoffState: 'clear',
                concurrency: 'waiting for scheduler telemetry',
                fairness: 'pending'
            },
            budgets: [],
            fairness: {
                ok: true,
                worstShare: 0
            },
            aging: [
                { label: 'Oldest queued task', seconds: 0, tone: 'ok' },
                { label: 'p95 queued age', seconds: 0, tone: 'ok' }
            ],
            controls: [],
            notes: [
                'Queue, leases, retries, and budget lanes will appear as soon as the scraper returns scheduler state.'
            ]
        }
    }
}

function formatDate(value: string) {
    if (!value) return 'Now'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
    return parsed.toISOString().slice(0, 10)
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className='border border-white/10 bg-white/[0.025] p-4'>
            <div className='mb-2 flex items-center gap-2 text-sm font-semibold text-bright/82'>
                <span className='text-[#6bc9d8]'>{icon}</span>
                {title}
            </div>
            {children}
        </section>
    )
}

function OperationalStatusPanel({ result }: { result: TiSearchResponse }) {
    const status = result.operationalStatus
    if (!status) return null

    return (
        <section className='grid gap-4 border border-white/10 bg-white/[0.025] p-4'>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div className='grid gap-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold uppercase outline ${statusToneClass(status.state)}`}>
                            {status.state === 'blocked' || status.state === 'degraded' ? <AlertTriangle className='h-3.5 w-3.5' /> : <Gauge className='h-3.5 w-3.5' />}
                            {status.state.replaceAll('_', ' ')}
                        </span>
                        <h2 className='text-base font-semibold text-bright/88'>Scraper workload</h2>
                    </div>
                    <p className='max-w-4xl text-sm leading-6 text-bright/58'>{status.headline}</p>
                </div>
                <div className='flex flex-wrap gap-2 text-xs text-bright/45 lg:justify-end'>
                    {status.queue.nextPollSeconds !== undefined ? <span className='rounded-md border border-white/10 px-2 py-1'>poll {status.queue.nextPollSeconds}s</span> : null}
                    {status.queue.cursorContinuity ? <span className='rounded-md border border-white/10 px-2 py-1'>{formatLabel(status.queue.cursorContinuity)}</span> : null}
                    {status.queue.backpressureState ? <span className='rounded-md border border-white/10 px-2 py-1'>{formatLabel(status.queue.backpressureState)}</span> : null}
                </div>
            </div>

            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <OperationalMetric icon={<ListChecks className='h-4 w-4' />} label='Queue' value={`${status.queue.queuedTasks} queued`} detail={`${status.queue.selectedTasks} selected · ${status.queue.reviewTasks} review`} />
                <OperationalMetric icon={<Activity className='h-4 w-4' />} label='Leases' value={`${status.queue.leasedTasks} leased`} detail={status.workers.leaseState} />
                <OperationalMetric icon={<RefreshCw className='h-4 w-4' />} label='Retry/backoff' value={`${status.workers.retryDebt} retry debt`} detail={status.workers.backoffState} />
                <OperationalMetric icon={<AlertTriangle className='h-4 w-4' />} label='Dead letters' value={`${status.workers.deadLetters}`} detail={status.workers.deadLetters ? 'operator attention' : 'clear'} />
            </div>

            <div className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
                <div className='grid gap-3'>
                    <h3 className='text-sm font-semibold text-bright/78'>Budget lanes</h3>
                    {status.budgets.length ? (
                        <div className='grid gap-2'>
                            {status.budgets.slice(0, 6).map((budget) => (
                                <BudgetLane key={budget.workClass} budget={budget} />
                            ))}
                        </div>
                    ) : (
                        <p className='rounded-md border border-white/8 bg-black/15 p-3 text-sm text-bright/42'>Waiting for scheduler budget lanes.</p>
                    )}
                </div>

                <div className='grid gap-3'>
                    <h3 className='text-sm font-semibold text-bright/78'>Fairness and aging</h3>
                    <div className='grid gap-2'>
                        <OperationalRow icon={<GitBranch className='h-4 w-4' />} label='Per-source fairness' value={status.workers.fairness} detail={status.fairness.worstGroup ? `${status.fairness.worstGroup} · ${formatPercent(status.fairness.worstShare)}` : formatPercent(status.fairness.worstShare)} tone={status.fairness.ok ? 'ok' : 'bad'} />
                        <OperationalRow icon={<Clock3 className='h-4 w-4' />} label='Oldest queued' value={formatDuration(status.queue.maxAgeSeconds)} detail='max age' tone={toneFromAging(status.aging[0]?.tone)} />
                        <OperationalRow icon={<TimerReset className='h-4 w-4' />} label='p95 queue age' value={formatDuration(status.queue.p95AgeSeconds)} detail='aging pressure' tone={toneFromAging(status.aging[1]?.tone)} />
                        <OperationalRow icon={<Gauge className='h-4 w-4' />} label='Concurrency' value={status.workers.concurrency} detail={status.workers.memoryPressure !== undefined ? `memory ${formatPercent(status.workers.memoryPressure)}` : 'worker budget'} tone='ok' />
                    </div>
                </div>
            </div>

            {status.controls.length ? (
                <div className='grid gap-3'>
                    <h3 className='text-sm font-semibold text-bright/78'>Canary controls</h3>
                    <div className='grid gap-2 lg:grid-cols-2'>
                        {status.controls.slice(0, 4).map((control) => (
                            <div key={`${control.scenario ?? 'control'}-${control.action}`} className='rounded-md border border-white/8 bg-black/15 p-3'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div>
                                        <p className='text-sm font-semibold text-bright/82'>{formatLabel(control.action)}</p>
                                        <p className='mt-1 text-xs text-bright/42'>{control.scenario ? formatLabel(control.scenario) : 'scheduler control'}</p>
                                    </div>
                                    <span className='shrink-0 rounded-md bg-white/[0.055] px-2 py-1 text-xs text-bright/52'>
                                        q {signed(control.queueDelta)} · w {signed(control.workerDelta)}
                                    </span>
                                </div>
                                <p className='mt-2 text-xs leading-5 text-bright/48'>{control.rollback}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className='grid gap-2'>
                {status.notes.slice(0, 4).map((note) => (
                    <p key={note} className='text-xs leading-5 text-bright/42'>{note}</p>
                ))}
            </div>
        </section>
    )
}

function OperationalMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
    return (
        <div className='rounded-md border border-white/10 bg-black/15 p-3'>
            <div className='flex items-center justify-between gap-3 text-bright/38'>
                <span className='inline-flex items-center gap-2 text-xs font-medium uppercase'>{icon}{label}</span>
            </div>
            <p className='mt-2 text-xl font-semibold text-bright/88'>{value}</p>
            <p className='mt-1 text-xs text-bright/42'>{detail}</p>
        </div>
    )
}

function BudgetLane({ budget }: { budget: TiOperationalStatus['budgets'][number] }) {
    const used = Math.min(1, (budget.queued + budget.leased) / Math.max(1, budget.budgetSlots))
    const tone = budget.action === 'accept' ? 'ok' : budget.action === 'pause_noisy_source' ? 'bad' : 'watch'

    return (
        <div className='rounded-md border border-white/8 bg-black/15 p-3'>
            <div className='flex items-start justify-between gap-3'>
                <div>
                    <p className='text-sm font-semibold text-bright/82'>{formatLabel(budget.workClass)}</p>
                    <p className='mt-1 text-xs text-bright/42'>{budget.queued} queued · {budget.leased} leased · {budget.retryDebt} retries</p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-xs ${rowToneClass(tone)}`}>{formatLabel(budget.action)}</span>
            </div>
            <div className='mt-3 h-1.5 overflow-hidden rounded-full bg-white/8'>
                <div className={`h-full rounded-full ${tone === 'bad' ? 'bg-red-300/70' : tone === 'watch' ? 'bg-amber-300/70' : 'bg-[#6bc9d8]/80'}`} style={{ width: `${Math.round(used * 100)}%` }} />
            </div>
            <p className='mt-2 text-xs text-bright/38'>{budget.budgetSlots} slots · oldest {formatDuration(budget.maxAgeSeconds)}</p>
        </div>
    )
}

function OperationalRow({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: 'ok' | 'watch' | 'bad' }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-md border border-white/8 bg-black/15 p-3'>
            <div className='min-w-0'>
                <p className='inline-flex items-center gap-2 text-xs font-medium uppercase text-bright/38'>{icon}{label}</p>
                <p className='mt-1 truncate text-sm font-semibold text-bright/82'>{value}</p>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-1 text-xs ${rowToneClass(tone)}`}>{detail}</span>
        </div>
    )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className='flex items-center justify-between gap-4 border border-white/10 bg-white/[0.025] px-3 py-2'>
            <span className='inline-flex items-center gap-2 text-bright/48'>{icon}{label}</span>
            <span className='font-semibold text-bright/80'>{value}</span>
        </div>
    )
}

function EmptyLine({ text }: { text: string }) {
    return <p className='py-3 text-sm text-bright/42'>{text}</p>
}

function statusToneClass(state: TiOperationalStatus['state']) {
    if (state === 'blocked') return 'bg-red-400/10 text-red-100/80 outline-red-300/20'
    if (state === 'degraded') return 'bg-amber-300/10 text-amber-100/80 outline-amber-200/20'
    if (state === 'queued' || state === 'searching') return 'bg-[#6bc9d8]/10 text-[#9fe8f1] outline-[#6bc9d8]/25'
    return 'bg-emerald-300/10 text-emerald-100/80 outline-emerald-200/20'
}

function rowToneClass(tone: 'ok' | 'watch' | 'bad') {
    if (tone === 'bad') return 'bg-red-400/10 text-red-100/75'
    if (tone === 'watch') return 'bg-amber-300/10 text-amber-100/75'
    return 'bg-emerald-300/10 text-emerald-100/75'
}

function toneFromAging(tone?: 'ok' | 'watch' | 'bad'): 'ok' | 'watch' | 'bad' {
    return tone ?? 'ok'
}

function formatLabel(value: string) {
    return value.replaceAll('_', ' ')
}

function formatPercent(value: number) {
    return `${Math.round(value * 100)}%`
}

function formatDuration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
}

function signed(value: number) {
    if (value > 0) return `+${value}`
    return `${value}`
}

function linkFromText(value: string) {
    const match = value.match(/\bhttps?:\/\/[^\s<>"']+/i)
    if (!match) return undefined
    try {
        const url = new URL(match[0])
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
    } catch {
        return undefined
    }
    return undefined
}
