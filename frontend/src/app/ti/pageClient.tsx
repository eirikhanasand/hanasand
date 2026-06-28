'use client'

import searchThreatIntel, { TiSearchResponse } from '@/utils/ti/search'
import { actorGeoProfile, victimObservationsFor } from '@/utils/ti/actorProfile'
import { buildActorIntelligence, type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { buildTiActionability, type TiActionabilityModel } from '@/utils/ti/actionability'
import { Activity, BellRing, Building2, CheckCircle2, ClipboardList, Clock3, Database, ExternalLink, Eye, Globe2, HelpCircle, Inbox, Radar, Search, Send, ShieldAlert, ShieldCheck, Target, UserPlus, Waypoints, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { humanizeSlug } from '../seo'

export default function TiPageClient({ initialQuery, initialResult }: { initialQuery: string; initialResult: TiSearchResponse | null }) {
    const router = useRouter()
    const [query, setQuery] = useState(initialResult?.query ?? initialQuery)
    const [result, setResult] = useState<TiSearchResponse | null>(initialResult)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const activeQueryRef = useRef((initialResult?.query ?? initialQuery).trim().toLowerCase())
    const requestSeqRef = useRef(0)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        activeQueryRef.current = query.trim().toLowerCase()
    }, [query])

    useEffect(() => {
        const titleQuery = (result?.query || query).trim()
        if (!titleQuery) {
            document.title = 'Threat Intelligence Search | Hanasand'
            return
        }

        const label = humanizeSlug(titleQuery)
        document.title = `${label} Threat Intelligence | Hanasand`
        updateMetaDescription(`Search Hanasand monitoring context for ${label}: actor names, company mentions, domains, and recent claims.`)
        updateCanonical(`/ti/${encodeURIComponent(titleQuery)}`)
    }, [query, result?.query])

    useEffect(() => {
        const clean = initialQuery.trim()
        if (!clean || initialResult) return

        const cleanKey = clean.toLowerCase()
        const requestSeq = requestSeqRef.current + 1
        requestSeqRef.current = requestSeq
        activeQueryRef.current = cleanKey
        setBusy(true)
        setQuery(clean)
        setResult(searchingResult(clean))
        searchThreatIntel(clean)
            .then((next) => {
                if (requestSeqRef.current !== requestSeq || activeQueryRef.current !== cleanKey) return
                if (next) setResult(next)
            })
            .finally(() => {
                if (requestSeqRef.current === requestSeq) setBusy(false)
            })
    }, [initialQuery, initialResult])

    useEffect(() => {
        if (!result?.refreshAfterSeconds || result.status === 'ready') return
        const expectedQuery = result.query
        const expectedKey = expectedQuery.trim().toLowerCase()
        const timer = window.setTimeout(async () => {
            const next = await searchThreatIntel(expectedQuery)
            if (next && activeQueryRef.current === expectedKey) {
                setResult(next)
            }
        }, Math.max(3, result.refreshAfterSeconds) * 1000)

        return () => window.clearTimeout(timer)
    }, [result])

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const clean = String(form.get('q') ?? inputRef.current?.value ?? query).trim()
        if (!clean) return

        const requestSeq = requestSeqRef.current + 1
        requestSeqRef.current = requestSeq
        setBusy(true)
        setError('')
        setQuery(clean)
        const cleanKey = clean.toLowerCase()
        activeQueryRef.current = cleanKey
        router.push(`/ti/${encodeURIComponent(clean)}`)
        setResult(searchingResult(clean))
        try {
            const next = await searchThreatIntel(clean)
            if (requestSeqRef.current !== requestSeq || activeQueryRef.current !== cleanKey) return
            if (!next) {
                setError('The TI service did not return results.')
                return
            }
            setResult(next)
        } finally {
            if (requestSeqRef.current === requestSeq) setBusy(false)
        }
    }

    function handleQueryChange(value: string) {
        setQuery(value)
        const cleanKey = value.trim().toLowerCase()
        activeQueryRef.current = cleanKey
        if (!cleanKey) {
            setResult(null)
            return
        }
        if (result && result.query.trim().toLowerCase() !== cleanKey) {
            setResult(null)
        }
    }

    const visible = result

    return (
        <div className='mx-auto grid w-full max-w-7xl gap-6'>
            <form onSubmit={submit} className={`grid gap-3 rounded-lg border border-[#dfe5ee] bg-white shadow-sm ${visible ? 'p-2 md:p-3' : 'p-4 md:p-5'}`}>
                <div className='flex flex-col gap-3 md:flex-row md:items-end'>
                    <label className='grid flex-1 gap-2'>
                        <span className={`text-xs font-semibold uppercase text-[#3056d3] ${visible ? 'sr-only' : ''}`}>Threat intelligence search</span>
                        <input
                            ref={inputRef}
                            name='q'
                            value={query}
                            onChange={(event) => handleQueryChange(event.target.value)}
                            placeholder='Company, actor, domain, CVE, supplier...'
                            className={`${visible ? 'h-10' : 'h-12'} rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-medium text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]`}
                        />
                    </label>
                    <button
                        type='submit'
                        aria-busy={busy}
                        className={`${visible ? 'h-10' : 'h-12'} inline-flex items-center justify-center gap-2 rounded-lg bg-[#171a21] px-5 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-not-allowed disabled:bg-[#eef1f5] disabled:text-[#98a2b3]`}
                    >
                        <Search className='h-4 w-4' />
                        {busy ? 'Searching' : 'Search'}
                    </button>
                </div>
                {error ? <p className='text-sm text-red-600'>{error}</p> : null}
            </form>

            {visible ? <Results result={visible} /> : <EmptyState />}
        </div>
    )
}

function Results({ result }: { result: TiSearchResponse }) {
    const sourceUrlById = useMemo(() => new Map(result.sources.map(source => [source.id, source.url || linkFromText(source.provenance)])), [result.sources])
    const collectionSources = result.collectionStrategy?.sourcePosture ?? defaultCollectionSources()
    const datasets = (result.datasets.length ? result.datasets : defaultDatasets()).filter(item => !/planned|rejected|blocked/i.test(item.status))
    const sources = result.sources.length ? result.sources : defaultSourceLinks()
    const alertItems = alertItemsFor(result)
    const victimObservations = useMemo(() => victimObservationsFor(result), [result])
    const actorIntel = useMemo(() => buildActorIntelligence(result, victimObservations), [result, victimObservations])
    const actionability = useMemo(() => buildTiActionability(result, actorIntel, victimObservations), [result, actorIntel, victimObservations])
    const workItems = useMemo(() => analystWorkItemsFor(result, victimObservations, sourceUrlById), [result, victimObservations, sourceUrlById])
    const watchlist = useMemo(() => watchlistRelevanceFor(result, victimObservations, sources, actorIntel), [result, victimObservations, sources, actorIntel])
    const [selectedId, setSelectedId] = useState(workItems[0]?.id ?? '')
    const [localDecisions, setLocalDecisions] = useState<Record<string, LocalDecision>>({})
    const [notes, setNotes] = useState<Record<string, string>>({})
    const selected = workItems.find(item => item.id === selectedId) ?? workItems[0]
    const selectedDecision = selected ? localDecisions[selected.id] : undefined
    const selectedNote = selected ? notes[selected.id] ?? '' : ''
    const alertPacket = selected ? alertPacketFor(result, selected, watchlist) : null
    const enrichmentTasks = enrichmentTasksFor(result, selected, watchlist, sources, actorIntel, actionability)
    const sessionEvents = Object.entries(localDecisions).map(([id, decision]) => {
        const item = workItems.find(entry => entry.id === id)
        return {
            id: `${id}-${decision.decidedAt}`,
            at: decision.decidedAt ?? result.generatedAt,
            label: `${decisionLabel(decision.status)}${item ? `: ${item.title}` : ''}`,
            detail: decision.reason || 'No rationale recorded.',
        }
    })
    const queueCounts = queueCountsFor(workItems, localDecisions)
    const profileStats = [
        { icon: <ShieldCheck className='h-3.5 w-3.5' />, label: 'Sources', value: sourceCountLabel(result.sources.length) },
        { icon: <Activity className='h-3.5 w-3.5' />, label: 'Updated', value: formatDate(result.generatedAt || result.lastSeen) },
        { icon: <Inbox className='h-3.5 w-3.5' />, label: 'Queue', value: `${queueCounts.open} open` },
        { icon: <BellRing className='h-3.5 w-3.5' />, label: 'Mode', value: result.status === 'ready' || result.status === 'partial' ? 'Live' : 'Watching' },
    ]

    function applyDecision(status: LocalDecision['status']) {
        if (!selected) return
        const reason = selectedNote.trim() || defaultDecisionReason(status)
        setLocalDecisions(current => ({
            ...current,
            [selected.id]: {
                status,
                reason,
                decidedAt: new Date().toISOString(),
            },
        }))
    }

    return (
        <div className='grid gap-6'>
            <section data-ti-workspace='true' className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-sm'>
                <div className='grid gap-3 border-b border-[#e8edf5] bg-white p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                    <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <h1 className='wrap-break-word text-2xl font-semibold text-[#171a21] md:text-3xl'>{humanizeSlug(result.query)}</h1>
                            {result.status ? (
                                <span className='rounded-lg border border-[#b8c5ff] bg-[#eef3ff] px-2 py-1 text-xs font-semibold uppercase text-[#3056d3]'>
                                    {humanResultStatus(result.status)}
                                </span>
                            ) : null}
                        </div>
                        <p className='mt-1 line-clamp-2 max-w-5xl text-sm leading-6 text-[#596170]'>{result.summary}</p>
                        <div className='mt-2 flex flex-wrap gap-2'>
                            {result.aliases.map(alias => (
                                <span key={alias} className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] px-2 py-1 text-xs text-[#667085]'>{alias}</span>
                            ))}
                            {!result.aliases.length ? <span className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] px-2 py-1 text-xs text-[#667085]'>No aliases returned</span> : null}
                        </div>
                    </div>
                    <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[34rem]'>
                        {profileStats.map(item => (
                            <ProfileStat key={item.label} icon={item.icon} label={item.label} value={item.value} />
                        ))}
                    </div>
                </div>

                <div className='grid min-h-[44rem] lg:grid-cols-[320px_minmax(0,1fr)_340px]'>
                    <aside data-ti-queue='true' className='order-2 border-b border-[#e8edf5] bg-[#fbfcfe] lg:order-none lg:border-b-0 lg:border-r'>
                        <div className='border-b border-[#e8edf5] p-4'>
                            <div className='flex items-center justify-between gap-3'>
                                <div>
                                    <h2 className='text-sm font-semibold text-[#171a21]'>Priority Queue</h2>
                                    <p className='mt-1 text-xs text-[#667085]'>Session-local triage; API result data is live.</p>
                                </div>
                                <span className='rounded-lg bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{workItems.length}</span>
                            </div>
                            <div className='mt-3 grid grid-cols-3 gap-2 text-center text-xs'>
                                <QueueMetric label='Open' value={queueCounts.open} />
                                <QueueMetric label='High' value={queueCounts.high} />
                                <QueueMetric label='Closed' value={queueCounts.closed} />
                            </div>
                        </div>
                        <div className='max-h-[40rem] overflow-y-auto p-2'>
                            {workItems.map(item => {
                                const decision = localDecisions[item.id]
                                const active = selected?.id === item.id
                                return (
                                    <button
                                        key={item.id}
                                        type='button'
                                        onClick={() => setSelectedId(item.id)}
                                        className={`grid w-full gap-2 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#b8c5ff] ${active ? 'border-[#3056d3] bg-[#eef3ff]' : 'border-transparent bg-transparent hover:border-[#d8dee9] hover:bg-white'}`}
                                    >
                                        <div className='flex items-center justify-between gap-2'>
                                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${severityClass(item.severity)}`}>{item.severity}</span>
                                            <span className='text-[11px] text-[#667085]'>{decision ? decisionLabel(decision.status) : item.status}</span>
                                        </div>
                                        <span className='text-sm font-semibold leading-5 text-[#171a21]'>{item.title}</span>
                                        <span className='line-clamp-2 text-xs leading-5 text-[#667085]'>{item.subtitle}</span>
                                        <span className='flex flex-wrap gap-2 text-[11px] text-[#667085]'>
                                            <span>{item.timestamp}</span>
                                            <span>{Math.round(item.confidence * 100)}% confidence</span>
                                        </span>
                                    </button>
                                )
                            })}
                            {!workItems.length ? <p className='rounded-lg border border-dashed border-[#d8dee9] bg-white p-4 text-sm text-[#667085]'>No analyst work items returned yet.</p> : null}
                        </div>
                    </aside>

                    <main className='order-1 min-w-0 p-4 lg:order-none'>
                        {selected ? (
                            <div className='grid gap-4'>
                                <ActorIntelligenceDossier actor={actorIntel} result={result} />

                                <section data-ti-detail='true' className='rounded-lg border border-[#dfe5ee] bg-white p-4'>
                                    <div className='flex flex-wrap items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${severityClass(selected.severity)}`}>{selected.severity}</span>
                                                <span className='rounded-md bg-[#f2f4f7] px-2 py-1 text-xs font-semibold text-[#475467]'>{kindLabel(selected.kind)}</span>
                                                <span className='rounded-md bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{selectedDecision ? decisionLabel(selectedDecision.status) : selected.status}</span>
                                            </div>
                                            <h2 className='mt-3 wrap-break-word text-2xl font-semibold text-[#171a21]'>{selected.title}</h2>
                                            <p className='mt-2 text-sm leading-6 text-[#596170]'>{selected.detail}</p>
                                        </div>
                                        {selected.href ? (
                                            <a href={selected.href} target='_blank' rel='noopener noreferrer' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff]'>
                                                <ExternalLink className='h-3.5 w-3.5' />
                                                Source
                                            </a>
                                        ) : null}
                                    </div>

                                    <div className='mt-4 grid gap-3 md:grid-cols-4'>
                                        <EvidenceMetric label='First seen' value={selected.timestamp} />
                                        <EvidenceMetric label='Source' value={selected.source} />
                                        <EvidenceMetric label='Confidence' value={`${Math.round(selected.confidence * 100)}%`} />
                                        <EvidenceMetric label='Provenance' value={selected.provenance} />
                                    </div>

                                    <CustomerAlertFit selected={selected} watchlist={watchlist} alertPacket={alertPacket} />

                                    <div className='mt-4 grid gap-3 md:grid-cols-2'>
                                        <EvidencePanel title='Evidence'>
                                            {selected.evidence.map(line => <li key={line}>{line}</li>)}
                                        </EvidencePanel>
                                        <EvidencePanel title='Recommended Analyst Action'>
                                            {selected.nextActions.map(line => <li key={line}>{line}</li>)}
                                        </EvidencePanel>
                                    </div>
                                </section>

                                <section className='grid gap-4 xl:grid-cols-[1fr_1fr]'>
                                    <Panel title='Reported Victims and Targets' description='Country-level observations with the victim, sector, timeframe, incident, and source basis visible immediately.' icon={<Target className='h-4 w-4' />}>
                                        {victimObservations.length ? victimObservations.map(item => (
                                            <VictimObservationRow key={`${item.victim}-${item.timeframe}`} item={item} />
                                        )) : <EmptyLine text='No country-level victim or target observations returned yet.' />}
                                    </Panel>

                                    <Panel title='Observed Tradecraft' description='Reported tactics, techniques, and procedures, usually mapped to ATT&CK where available.' icon={<Waypoints className='h-4 w-4' />}>
                                        {result.ttps.length ? result.ttps.map(item => (
                                            <div key={`${item.attackId}-${item.name}`} className='grid gap-1 border-b border-[#eef1f5] py-3 last:border-b-0'>
                                                <div className='flex flex-wrap items-center gap-2'>
                                                    <h2 className='text-sm font-semibold text-[#171a21]'>{item.name}</h2>
                                                    {item.attackId ? <TechniqueBadge attackId={item.attackId} name={item.name} tactic={item.tactic} detail={item.detail} /> : null}
                                                </div>
                                                <p className='text-xs text-[#667085]'>{item.tactic} · {Math.round(item.confidence * 100)}% confidence</p>
                                                <p className='text-sm leading-6 text-[#596170]'>{item.detail}</p>
                                            </div>
                                        )) : <EmptyLine text='No tradecraft returned yet.' />}
                                    </Panel>
                                </section>

                                <ThreatActorMap result={result} />
                            </div>
                        ) : (
                            <div className='grid min-h-96 place-items-center rounded-lg border border-dashed border-[#d8dee9] bg-white p-8 text-center text-sm text-[#667085]'>Search is still building an analyst queue.</div>
                        )}
                    </main>

                    <aside className='order-3 grid content-start gap-4 border-t border-[#e8edf5] bg-[#fbfcfe] p-4 lg:order-none lg:border-l lg:border-t-0'>
                        {alertPacket ? <AlertPacketPanel packet={alertPacket} /> : null}
                        <ActionabilityPanel actionability={actionability} query={result.query} />
                        <EnrichmentTasksPanel tasks={enrichmentTasks} />

                        <div data-ti-actions='true'>
                            <ActionPanel
                                note={selectedNote}
                                decision={selectedDecision}
                                onNoteChange={value => selected && setNotes(current => ({ ...current, [selected.id]: value }))}
                                onDecision={applyDecision}
                            />
                        </div>

                        <Panel title='Timeline' description='API evidence timestamps plus analyst decisions made in this browser session.' icon={<Clock3 className='h-4 w-4' />}>
                            <div className='grid gap-3'>
                                {[...timelineFor(result, selected), ...sessionEvents].slice(0, 8).map(event => (
                                    <div key={event.id} className='border-l-2 border-[#d8dee9] pl-3'>
                                        <p className='text-xs font-semibold text-[#171a21]'>{event.label}</p>
                                        <p className='mt-1 text-[11px] text-[#667085]'>{formatDate(event.at)}</p>
                                        <p className='mt-1 text-xs leading-5 text-[#596170]'>{event.detail}</p>
                                    </div>
                                ))}
                            </div>
                        </Panel>

                        <Panel title='Collection Tasks' description='What the collection layer has checked or should check next for this profile.' icon={<Database className='h-4 w-4' />}>
                            <div className='grid gap-2'>
                                {(result.analystLoop?.nextSteps ?? defaultNextStepsFor(result)).map(step => (
                                    <div key={`${step.state}-${step.label}`} className='rounded-lg border border-[#eef1f5] bg-white p-3'>
                                        <div className='flex items-center justify-between gap-2'>
                                            <p className='text-xs font-semibold text-[#171a21]'>{step.label}</p>
                                            <span className={rowToneClass(step.tone)}>{formatLabel(step.state)}</span>
                                        </div>
                                        <p className='mt-2 text-xs leading-5 text-[#596170]'>{step.detail}</p>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    </aside>
                </div>
            </section>

            <section className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
                <Panel title='Company Exposure' description='Company, domain, vendor, brand, product, or portfolio matches from actor claims, leak posts, advisories, or monitored pages.' icon={<Building2 className='h-4 w-4' />}>
                    {alertItems.length ? alertItems.map(item => (
                        <div key={item.title} className='grid gap-1 border-b border-[#eef1f5] py-3 last:border-b-0'>
                            <div className='flex items-center justify-between gap-3'>
                                <h2 className='text-sm font-semibold text-[#171a21]'>{item.title}</h2>
                                <span className={`rounded-lg px-2 py-1 text-xs ${rowToneClass(item.tone)}`}>{item.state}</span>
                            </div>
                            <p className='text-sm leading-6 text-[#596170]'>{item.detail}</p>
                        </div>
                    )) : <EmptyLine text='No company, domain, vendor, or product matches returned yet.' />}
                </Panel>

                <Panel title='Monitoring Coverage' description='The data families checked for this result, such as actor profiles, victim claims, public advisories, and watched company or supplier terms.' icon={<Globe2 className='h-4 w-4' />}>
                    {datasets.map(item => (
                        <EvidenceBox key={`${item.type}-${item.name}`} href={item.url}>
                            <div className='flex items-center justify-between gap-3'>
                                <h2 className='text-sm font-semibold text-[#171a21]'>{item.name}</h2>
                                <span className='text-xs text-[#667085]'>{sourceStatusLabel(item.status)}</span>
                            </div>
                            <p className='text-sm leading-6 text-[#596170]'>{item.coverage}</p>
                        </EvidenceBox>
                    ))}
                </Panel>
            </section>

            <section className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
                <CoverageStrategyPanel sources={collectionSources} />
                <SourceLinksPanel sources={sources} />
            </section>
        </div>
    )
}

type AnalystWorkItem = {
    id: string
    kind: 'activity' | 'exposure' | 'victim' | 'tradecraft' | 'collection'
    severity: 'critical' | 'high' | 'medium' | 'low'
    status: string
    title: string
    subtitle: string
    detail: string
    timestamp: string
    source: string
    provenance: string
    confidence: number
    href?: string
    evidence: string[]
    nextActions: string[]
}

type LocalDecision = {
    status: 'reviewing' | 'assigned' | 'escalated' | 'suppressed' | 'closed' | 'reopened'
    reason: string
    decidedAt: string
}

type WatchlistRelevance = {
    terms: string[]
    organizations: string[]
    sectors: string[]
    countries: string[]
    domains: string[]
    rationale: string
}

type AlertPacket = {
    title: string
    customerValue: string
    watchTerms: string[]
    evidenceBasis: string[]
    routing: string
    blockedUntil: string[]
}

type EnrichmentTask = {
    title: string
    status: 'ready' | 'needs_api' | 'needs_review' | 'watch'
    detail: string
}

function ActorIntelligenceDossier({ actor, result }: { actor: TiActorIntelligenceProfile; result: TiSearchResponse }) {
    const confidence = Math.round(actor.confidence * 100)
    return (
        <section data-ti-actor-dossier='true' className='rounded-lg border border-[#dfe5ee] bg-white p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#3056d3]'>Actor Intelligence Dossier</p>
                    <h2 className='mt-1 wrap-break-word text-xl font-semibold text-[#171a21]'>{actor.actorClass}</h2>
                    <p className='mt-2 text-sm leading-6 text-[#596170]'>{actor.attribution}</p>
                </div>
                <div className='grid min-w-52 grid-cols-3 gap-2 text-center text-xs'>
                    <EvidenceMetric label='First seen' value={actor.firstSeen} />
                    <EvidenceMetric label='Last seen' value={actor.lastSeen || result.lastSeen} />
                    <EvidenceMetric label='Confidence' value={`${confidence}%`} />
                </div>
            </div>

            <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                <DossierList title='Motivation' values={actor.motivation} />
                <DossierList title='Malware and tools' values={actor.malwareTools} />
                <DossierList title='Campaigns' values={actor.campaigns} />
                <DossierList title='Target sectors' values={actor.targetSectors} />
                <DossierList title='Geographies' values={actor.geographies} />
                <DossierList title='Infrastructure' values={actor.infrastructure} />
            </div>

            <div className='mt-4 grid gap-3 xl:grid-cols-2'>
                <EvidencePanel title='Confidence reasoning'>
                    {actor.confidenceReasoning.map(item => <li key={item}>{item}</li>)}
                </EvidencePanel>
                <EvidencePanel title='Source provenance'>
                    {actor.sourceProvenance.map(item => <li key={item}>{item}</li>)}
                </EvidencePanel>
            </div>
        </section>
    )
}

function DossierList({ title, values }: { title: string; values: string[] }) {
    return (
        <div className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{title}</p>
            <div className='mt-2 flex flex-wrap gap-1.5'>
                {values.length ? values.slice(0, 8).map(value => (
                    <span key={value} className='rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-xs font-semibold text-[#344054]'>{value}</span>
                )) : <span className='text-xs text-[#667085]'>Not returned</span>}
            </div>
        </div>
    )
}

function analystWorkItemsFor(result: TiSearchResponse, victimObservations: ReturnType<typeof victimObservationsFor>, sourceUrlById: Map<string, string | undefined>): AnalystWorkItem[] {
    const activityItems: AnalystWorkItem[] = result.recentActivity.map((item, index) => {
        const href = item.url || item.sourceIds.map(id => sourceUrlById.get(id)).find(Boolean)
        const exposure = item.victimName || item.claimType === 'victim_claim' || /victim|leak|claim|stolen|exfiltrat|credential/i.test(`${item.title} ${item.detail}`)
        return {
            id: `activity-${index}-${item.date}-${item.title}`.toLowerCase(),
            kind: exposure ? 'exposure' : 'activity',
            severity: exposure ? 'high' : item.confidence >= 0.75 ? 'medium' : 'low',
            status: exposure ? 'needs review' : 'monitor',
            title: item.victimName || item.title,
            subtitle: item.impact || item.detail,
            detail: item.detail,
            timestamp: item.firstReportedAt || item.date || result.generatedAt,
            source: activitySourceLabel(item.sourceIds.length),
            provenance: item.publisherCount ? `${item.publisherCount} publisher${item.publisherCount === 1 ? '' : 's'}` : 'API activity result',
            confidence: item.confidence,
            href,
            evidence: [
                item.title,
                item.impact || item.detail,
                item.affectedSectors?.length ? `Affected sectors: ${item.affectedSectors.join(', ')}` : 'Affected sector not stated.',
                item.countries?.length ? `Countries: ${item.countries.join(', ')}` : 'Country not stated.',
            ],
            nextActions: exposure
                ? ['Review the source context before customer alerting.', 'Check whether the victim/domain is in a watched portfolio.', 'Escalate if the claim is fresh, corroborated, or customer-relevant.']
                : ['Review for relevance to the selected actor or company.', 'Open the source when available.', 'Close if it is duplicate background reporting.'],
        }
    })

    const victimItems: AnalystWorkItem[] = victimObservations.map((item, index) => ({
        id: `victim-${index}-${item.victim}`.toLowerCase(),
        kind: 'victim',
        severity: /microsoft|solarwinds|federal|government|diplomatic/i.test(`${item.victim} ${item.sector}`) ? 'high' : 'medium',
        status: 'profile evidence',
        title: item.victim,
        subtitle: `${item.country} · ${item.sector}`,
        detail: item.incident,
        timestamp: item.timeframe,
        source: item.source,
        provenance: 'Country-level actor profile evidence',
        confidence: 0.76,
        evidence: [
            `Country: ${item.country}`,
            `Sector: ${item.sector}`,
            `Timeframe: ${item.timeframe}`,
            item.incident,
        ],
        nextActions: ['Use as actor profile context, not as a current alert by itself.', 'Corroborate with source links before notifying a customer.', 'Keep broad regions and alliance buckets out of the country map.'],
    }))

    const tradecraftItems: AnalystWorkItem[] = result.ttps.slice(0, 4).map((item, index) => ({
        id: `ttp-${index}-${item.attackId || item.name}`.toLowerCase(),
        kind: 'tradecraft',
        severity: item.confidence >= 0.8 ? 'medium' : 'low',
        status: 'detection context',
        title: item.attackId ? `${item.attackId} ${item.name}` : item.name,
        subtitle: item.tactic,
        detail: item.detail,
        timestamp: result.lastSeen || result.generatedAt,
        source: 'Actor profile',
        provenance: item.attackId ? 'MITRE ATT&CK mapped profile field' : 'Profile tradecraft field',
        confidence: item.confidence,
        evidence: [item.tactic, item.detail],
        nextActions: ['Map to defensive detections or hunting queries.', 'Prioritize techniques that match current exposure or recent activity.', 'Close if this is generic background for the current shift.'],
    }))

    const reviewItems: AnalystWorkItem[] = result.analystLoop?.metadataReviewInbox.map((item, index) => ({
        id: `review-${item.id || index}`.toLowerCase(),
        kind: 'exposure',
        severity: item.allowedActions.includes('notify_company') ? 'critical' : 'high',
        status: item.status.replaceAll('_', ' '),
        title: item.company || item.victim || 'Exposure mention',
        subtitle: [item.affectedAccounts, item.datasetSize, item.claimedDate].filter(Boolean).join(' · ') || 'Metadata review item',
        detail: item.actorStatement || 'Review the captured metadata before taking action.',
        timestamp: item.claimedDate || result.generatedAt,
        source: item.sourceHash ? `source hash ${item.sourceHash}` : 'Metadata review inbox',
        provenance: item.provenance || 'Restricted metadata queue',
        confidence: item.confidence,
        evidence: [
            item.affectedAccounts ? `Affected accounts: ${item.affectedAccounts}` : 'Affected accounts not stated.',
            item.accountSubjects ? `Account subjects: ${item.accountSubjects}` : 'Account subjects not stated.',
            item.datasetSize ? `Dataset size: ${item.datasetSize}` : 'Dataset size not stated.',
            item.actorStatement ? `Actor statement: ${item.actorStatement}` : 'Actor statement not returned.',
        ],
        nextActions: item.allowedActions.map(action => formatLabel(action)),
    })) ?? []

    const items = [...reviewItems, ...activityItems, ...victimItems, ...tradecraftItems]
    if (items.length) return items.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || b.confidence - a.confidence)

    return [{
        id: 'collection-searching',
        kind: 'collection',
        severity: result.status === 'searching' || result.status === 'queued' ? 'medium' : 'low',
        status: humanResultStatus(result.status),
        title: result.status === 'searching' ? 'Collection running' : 'No actionable rows returned',
        subtitle: result.analystLoop?.headline || result.summary,
        detail: result.analystLoop?.runStatusClarity.summary || 'The collection layer has not returned analyst-reviewable rows for this query yet.',
        timestamp: result.generatedAt,
        source: 'TI search API',
        provenance: result.mode,
        confidence: result.confidence,
        evidence: result.notes.length ? result.notes : ['No evidence rows returned yet.'],
        nextActions: ['Leave this query open while polling continues.', 'Try an alias, domain, company name, CVE, or supplier term.', 'Open the customer console for persisted queue work.'],
    }]
}

function CustomerAlertFit({ selected, watchlist, alertPacket }: { selected: AnalystWorkItem; watchlist: WatchlistRelevance; alertPacket: AlertPacket | null }) {
    return (
        <div className='mt-4 rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-3'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>Customer Alert Fit</p>
                    <p className='mt-1 text-sm leading-6 text-[#596170]'>{alertPacket?.customerValue ?? watchlist.rationale}</p>
                </div>
                <span className={severityClass(selected.severity)}>{selected.kind === 'exposure' ? 'alert candidate' : 'context for watchlists'}</span>
            </div>
            <div className='mt-3 grid gap-3 md:grid-cols-3'>
                <WatchlistBlock title='Watch terms' values={watchlist.terms} />
                <WatchlistBlock title='Organizations' values={watchlist.organizations} />
                <WatchlistBlock title='Sectors / countries' values={[...watchlist.sectors.slice(0, 4), ...watchlist.countries.slice(0, 4)]} />
            </div>
            {watchlist.domains.length ? (
                <div className='mt-3'>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>Domains to monitor</p>
                    <div className='mt-2 flex flex-wrap gap-2'>
                        {watchlist.domains.map(domain => <span key={domain} className='rounded-full border border-[#d8dee9] bg-white px-2.5 py-1 font-mono text-xs text-[#344054]'>{domain}</span>)}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function WatchlistBlock({ title, values }: { title: string; values: string[] }) {
    const visible = values.slice(0, 6)
    return (
        <div className='min-w-0 rounded-lg border border-[#eef1f5] bg-white p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{title}</p>
            <div className='mt-2 flex flex-wrap gap-1.5'>
                {visible.length ? visible.map(value => (
                    <span key={value} className='rounded-md bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{value}</span>
                )) : <span className='text-xs text-[#667085]'>Not returned</span>}
            </div>
        </div>
    )
}

function AlertPacketPanel({ packet }: { packet: AlertPacket }) {
    return (
        <Panel title='Alert Packet' description='Customer-facing alert ingredients derived from the selected finding and returned profile data. Sending remains a console/API workflow.' icon={<BellRing className='h-4 w-4' />}>
            <div className='grid gap-3'>
                <div>
                    <p className='text-sm font-semibold text-[#171a21]'>{packet.title}</p>
                    <p className='mt-1 text-xs leading-5 text-[#596170]'>{packet.customerValue}</p>
                </div>
                <div className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3'>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>Evidence basis</p>
                    <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-[#596170]'>
                        {packet.evidenceBasis.map(item => <li key={item}>{item}</li>)}
                    </ul>
                </div>
                <div className='rounded-lg border border-[#eef1f5] bg-white p-3'>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>Routing</p>
                    <p className='mt-1 text-xs leading-5 text-[#596170]'>{packet.routing}</p>
                </div>
                <div className='rounded-lg border border-[#eef1f5] bg-white p-3'>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>Watch terms carried forward</p>
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                        {packet.watchTerms.map(term => <span key={term} className='rounded-md bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{term}</span>)}
                    </div>
                </div>
                {packet.blockedUntil.length ? (
                    <div className='rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-3'>
                        <p className='text-xs font-semibold uppercase text-[#8a5a00]'>Blocked until</p>
                        <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-[#8a5a00]'>
                            {packet.blockedUntil.map(item => <li key={item}>{item}</li>)}
                        </ul>
                    </div>
                ) : null}
            </div>
        </Panel>
    )
}

function ActionabilityPanel({ actionability, query }: { actionability: TiActionabilityModel; query: string }) {
    const casePath = actionability.relatedCases[0]?.path || actionability.relatedAlerts[0]?.casePath
    return (
        <Panel title='Workflow Handoff' description='Backed alert, watchlist, and case handoff state for this actor/query result.' icon={<ShieldCheck className='h-4 w-4' />}>
            <div className='grid gap-3'>
                <div className='rounded-lg border border-[#eef1f5] bg-white p-3'>
                    <div className='flex items-center justify-between gap-2'>
                        <p className='text-xs font-semibold uppercase text-[#667085]'>Alert decision</p>
                        <span className={actionability.shouldAlert ? 'rounded-lg bg-[#e9f8ef] px-2 py-1 text-[11px] font-semibold text-[#147a3b]' : 'rounded-lg bg-[#fff4d6] px-2 py-1 text-[11px] font-semibold text-[#8a5a00]'}>
                            {formatLabel(actionability.alertDisposition)}
                        </span>
                    </div>
                    <p className='mt-2 text-xs leading-5 text-[#596170]'>{actionability.rationale}</p>
                </div>

                <div className='rounded-lg border border-[#eef1f5] bg-white p-3'>
                    <div className='flex items-center justify-between gap-2'>
                        <p className='text-xs font-semibold uppercase text-[#667085]'>Watchlist handoff</p>
                        <span className={actionability.watchlist.state === 'backed_matches' ? 'rounded-lg bg-[#e9f8ef] px-2 py-1 text-[11px] font-semibold text-[#147a3b]' : 'rounded-lg bg-[#eef3ff] px-2 py-1 text-[11px] font-semibold text-[#3056d3]'}>
                            {formatLabel(actionability.watchlist.state)}
                        </span>
                    </div>
                    <p className='mt-2 font-mono text-[11px] text-[#667085]'>POST {actionability.watchlist.endpoint}</p>
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                        {actionability.watchlist.payloads.length ? actionability.watchlist.payloads.slice(0, 6).map(payload => (
                            <span key={`${payload.kind}-${payload.value}`} className='rounded-md bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{payload.kind}: {payload.value}</span>
                        )) : <span className='text-xs text-[#667085]'>No backed watchlist payload yet</span>}
                    </div>
                    {actionability.watchlist.blockers.length ? <BlockerList blockers={actionability.watchlist.blockers} /> : null}
                </div>

                <div className='grid gap-2'>
                    <a href='/dashboard/dwm' className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff]'>
                        <ExternalLink className='h-3.5 w-3.5' />
                        Open DWM workbench
                    </a>
                    {casePath ? (
                        <a href={casePath} className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff]'>
                            <ExternalLink className='h-3.5 w-3.5' />
                            Open related case
                        </a>
                    ) : (
                        <button type='button' disabled title={actionability.handoffs.caseBlockers.join('; ')} className='inline-flex h-9 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-[#f2f4f7] px-3 text-xs font-semibold text-[#98a2b3]'>
                            <ClipboardList className='h-3.5 w-3.5' />
                            Create backed case
                        </button>
                    )}
                </div>

                <div className='rounded-lg border border-[#eef1f5] bg-white p-3'>
                    <p className='text-xs font-semibold uppercase text-[#667085]'>Related backed objects</p>
                    <p className='mt-2 text-xs leading-5 text-[#596170]'>
                        {actionability.relatedAlerts.length} alert{actionability.relatedAlerts.length === 1 ? '' : 's'} · {actionability.relatedCases.length} case{actionability.relatedCases.length === 1 ? '' : 's'} · {actionability.sourceProvenance.length} provenance row{actionability.sourceProvenance.length === 1 ? '' : 's'}
                    </p>
                    {!actionability.relatedAlerts.length && !actionability.relatedCases.length ? (
                        <p className='mt-2 text-xs leading-5 text-[#8a5a00]'>No alert or case ID is attached to {query}; rebuild alerts after saving a matching watchlist term.</p>
                    ) : null}
                </div>
            </div>
        </Panel>
    )
}

function BlockerList({ blockers }: { blockers: string[] }) {
    return (
        <div className='mt-3 rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-3'>
            <p className='text-xs font-semibold uppercase text-[#8a5a00]'>Missing dependency</p>
            <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-[#8a5a00]'>
                {blockers.map(item => <li key={item}>{item}</li>)}
            </ul>
        </div>
    )
}

function EnrichmentTasksPanel({ tasks }: { tasks: EnrichmentTask[] }) {
    return (
        <Panel title='Source and Enrichment Tasks' description='Concrete collection or backend contract work needed for this actor/query to feed stronger alerts.' icon={<Database className='h-4 w-4' />}>
            <div className='grid gap-2'>
                {tasks.map(task => (
                    <div key={task.title} className='rounded-lg border border-[#eef1f5] bg-white p-3'>
                        <div className='flex items-center justify-between gap-2'>
                            <p className='text-xs font-semibold text-[#171a21]'>{task.title}</p>
                            <span className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</span>
                        </div>
                        <p className='mt-2 text-xs leading-5 text-[#596170]'>{task.detail}</p>
                    </div>
                ))}
            </div>
        </Panel>
    )
}

function ActionPanel({ note, decision, onNoteChange, onDecision }: {
    note: string
    decision?: LocalDecision
    onNoteChange: (value: string) => void
    onDecision: (status: LocalDecision['status']) => void
}) {
    return (
        <Panel title='Session Notes' description='These controls are local to this browser session. Use them for scratch triage only; persisted assignment, delivery, and audit logging live in the authenticated console/API workflow.' icon={<ClipboardList className='h-4 w-4' />}>
            <div className='grid gap-3'>
                {decision ? (
                    <div className='rounded-lg border border-[#d6e9de] bg-[#f4fbf7] p-3 text-xs leading-5 text-[#147a3b]'>
                        {decisionLabel(decision.status)} recorded at {formatDate(decision.decidedAt)}. Rationale: {decision.reason}
                    </div>
                ) : (
                    <div className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-3 text-xs leading-5 text-[#667085]'>
                        No local scratch decision recorded yet.
                    </div>
                )}
                <textarea
                    value={note}
                    onChange={event => onNoteChange(event.target.value)}
                    placeholder='Scratch rationale, proposed owner, or next evidence to collect...'
                    className='min-h-24 resize-y rounded-lg border border-[#d8dee9] bg-white p-3 text-sm leading-6 text-[#171a21] outline-none transition placeholder:text-[#98a2b3] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
                />
                <div className='grid grid-cols-2 gap-2'>
                    <ActionButton icon={<Eye className='h-3.5 w-3.5' />} onClick={() => onDecision('reviewing')}>Review</ActionButton>
                    <ActionButton icon={<UserPlus className='h-3.5 w-3.5' />} onClick={() => onDecision('assigned')}>Assign</ActionButton>
                    <ActionButton icon={<Send className='h-3.5 w-3.5' />} onClick={() => onDecision('escalated')}>Escalate</ActionButton>
                    <ActionButton icon={<ShieldAlert className='h-3.5 w-3.5' />} onClick={() => onDecision('suppressed')}>Suppress</ActionButton>
                    <ActionButton icon={<CheckCircle2 className='h-3.5 w-3.5' />} onClick={() => onDecision('closed')}>Close</ActionButton>
                    <ActionButton icon={<XCircle className='h-3.5 w-3.5' />} onClick={() => onDecision('reopened')}>Reopen</ActionButton>
                </div>
            </div>
        </Panel>
    )
}

function ActionButton({ icon, children, onClick }: { icon: React.ReactNode; children: string; onClick: () => void }) {
    return (
        <button type='button' onClick={onClick} className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-2 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff]'>
            {icon}
            {children}
        </button>
    )
}

function EvidencePanel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{title}</p>
            <ul className='mt-2 grid list-disc gap-1 pl-4 text-sm leading-6 text-[#596170]'>
                {children}
            </ul>
        </div>
    )
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-[#171a21]'>{value || 'Not stated'}</p>
        </div>
    )
}

function QueueMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-white p-2'>
            <p className='text-base font-semibold text-[#171a21]'>{value}</p>
            <p className='text-[11px] text-[#667085]'>{label}</p>
        </div>
    )
}

function VictimObservationRow({ item }: { item: ReturnType<typeof victimObservationsFor>[number] }) {
    return (
        <div className='grid gap-1 border-b border-[#eef1f5] py-3 last:border-b-0'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <h2 className='text-sm font-semibold text-[#171a21]'>{item.victim}</h2>
                <span className='rounded-md bg-[#fff1f0] px-2 py-1 text-xs font-semibold text-[#b42318]'>{item.country}</span>
            </div>
            <p className='text-xs text-[#667085]'>{item.sector} · {item.timeframe}</p>
            <p className='text-sm leading-6 text-[#596170]'>{item.incident}</p>
            <p className='text-xs text-[#667085]'>Source basis: {item.source}</p>
        </div>
    )
}

function timelineFor(result: TiSearchResponse, selected?: AnalystWorkItem) {
    const events = [
        {
            id: 'generated',
            at: result.generatedAt,
            label: 'Profile generated',
            detail: `${humanResultStatus(result.status)} result from ${result.mode}.`,
        },
        ...(selected ? [{
            id: `selected-${selected.id}`,
            at: selected.timestamp,
            label: 'Selected evidence',
            detail: selected.subtitle,
        }] : []),
        ...result.recentActivity.slice(0, 4).map((item, index) => ({
            id: `activity-${index}`,
            at: item.firstReportedAt || item.date || result.generatedAt,
            label: item.title,
            detail: item.detail,
        })),
    ]
    return events
}

function defaultNextStepsFor(result: TiSearchResponse): NonNullable<TiSearchResponse['analystLoop']>['nextSteps'] {
    if (result.status === 'searching' || result.status === 'queued') {
        return [{
            state: 'queued',
            label: 'Live collection in progress',
            detail: 'The page will poll for new evidence. Keep the result open or search an alias while the run continues.',
            tone: 'watch',
        }]
    }
    return [{
        state: 'ready',
        label: 'Review queue built',
        detail: 'Use the selected work item, evidence, notes, and decision actions to triage this result.',
        tone: 'ok',
    }]
}

function watchlistRelevanceFor(result: TiSearchResponse, victimObservations: ReturnType<typeof victimObservationsFor>, sources: TiSearchResponse['sources'], actor: TiActorIntelligenceProfile): WatchlistRelevance {
    const organizations = unique([
        ...victimObservations.map(item => item.victim),
        ...result.recentActivity.map(item => item.victimName).filter((value): value is string => Boolean(value)),
        ...(result.analystLoop?.metadataReviewInbox.flatMap(item => [item.company, item.victim]).filter((value): value is string => Boolean(value)) ?? []),
    ]).slice(0, 10)
    const sectors = unique([
        ...victimObservations.map(item => item.sector),
        ...result.targets.map(item => item.sector),
        ...result.recentActivity.flatMap(item => item.affectedSectors ?? []),
    ].filter(value => !/not stated/i.test(value))).slice(0, 10)
    const countries = unique([
        ...victimObservations.map(item => item.country),
        ...result.targets.flatMap(item => item.regions),
        ...result.recentActivity.flatMap(item => item.countries ?? []),
    ].filter(value => !/not stated/i.test(value))).slice(0, 10)
    const domains = unique(sources.map(source => source.url || linkFromText(source.provenance)).map(domainFromUrl).filter((value): value is string => Boolean(value))).slice(0, 8)
    const terms = unique([
        result.query,
        humanizeSlug(result.query),
        ...result.aliases,
        ...organizations,
        ...sectors,
        ...actor.campaigns.slice(0, 4),
        ...actor.malwareTools.slice(0, 4),
    ].filter(Boolean)).slice(0, 14)

    return {
        terms,
        organizations,
        sectors,
        countries,
        domains,
        rationale: organizations.length
            ? 'Use the actor, aliases, victim organizations, sectors, countries, campaigns, tools, and source domains as candidate watchlist inputs before creating customer alerts.'
            : 'Use the actor, aliases, sectors, countries, campaigns, tools, and source domains as candidate watchlist inputs; no named customer organization match was returned yet.',
    }
}

function alertPacketFor(result: TiSearchResponse, selected: AnalystWorkItem, watchlist: WatchlistRelevance): AlertPacket {
    const isCustomerAlert = selected.kind === 'exposure' || Boolean(watchlist.organizations.some(org => selected.title.toLowerCase().includes(org.toLowerCase())))
    const evidenceBasis = unique([
        `${selected.source}; ${selected.provenance}`,
        `Timestamp: ${selected.timestamp}`,
        `Confidence: ${Math.round(selected.confidence * 100)}%`,
        ...selected.evidence.slice(0, 3),
    ])
    const blockedUntil = [
        selected.href ? '' : 'A source URL or internal capture reference is attached.',
        isCustomerAlert ? '' : 'A watched company, domain, vendor, or portfolio term matches this finding.',
        selected.confidence >= 0.7 ? '' : 'Confidence is raised or corroborating evidence is added.',
    ].filter(Boolean)

    return {
        title: isCustomerAlert ? `Candidate customer alert: ${selected.title}` : `Actor context packet: ${selected.title}`,
        customerValue: isCustomerAlert
            ? 'This finding has enough structure to enter the alert review workflow: named object, evidence basis, timestamp, source/provenance, confidence, and routing guidance.'
            : 'This finding strengthens watchlist and detection context, but should not become a customer alert until it matches a watched organization, domain, vendor, or portfolio term.',
        watchTerms: watchlist.terms.slice(0, 8),
        evidenceBasis,
        routing: selected.kind === 'tradecraft'
            ? 'Route to detection/hunting enrichment before customer notification.'
            : selected.kind === 'victim' && !isCustomerAlert
                ? 'Route to actor-profile enrichment and watchlist expansion.'
                : 'Route to alert review, source verification, and customer delivery only after the console workflow persists it.',
        blockedUntil,
    }
}

function enrichmentTasksFor(result: TiSearchResponse, selected: AnalystWorkItem | undefined, watchlist: WatchlistRelevance, sources: TiSearchResponse['sources'], actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel): EnrichmentTask[] {
    const hasReviewInbox = Boolean(result.analystLoop?.metadataReviewInbox.length)
    const hasSourceUrls = sources.some(source => source.url || linkFromText(source.provenance))
    const hasOrganizations = watchlist.organizations.length > 0
    const hasActivity = result.recentActivity.length > 0
    const hasActorCore = actor.malwareTools.length > 0 && actor.campaigns.length > 0 && actor.infrastructure.length > 0
    const actionabilityTasks: EnrichmentTask[] = actionability.enrichmentGaps.map(gap => ({
        title: gap.title,
        status: gap.severity === 'high' ? 'needs_api' : 'needs_review',
        detail: `${gap.detail} Dependency: ${gap.dependency}.`,
    }))
    return [
        ...actionabilityTasks,
        {
            title: 'Complete actor enrichment profile',
            status: hasActorCore ? 'ready' : 'needs_api',
            detail: hasActorCore
                ? `Actor profile includes ${actor.malwareTools.length} tools, ${actor.campaigns.length} campaigns, and ${actor.infrastructure.length} infrastructure patterns for alert enrichment.`
                : 'Search responses should return malware/tools, campaigns, infrastructure, confidence reasoning, and source provenance so public actor pages are not dependent on frontend fallbacks.',
        },
        {
            title: 'Persist alert review decision',
            status: 'needs_api',
            detail: 'Public /ti pages only keep scratch notes locally. The backend contract should accept selected finding id, review state, owner, rationale, and delivery hold/release state.',
        },
        {
            title: 'Attach source capture provenance',
            status: hasSourceUrls ? 'ready' : 'needs_api',
            detail: hasSourceUrls
                ? 'Returned sources include URL/provenance references that can be opened or mapped into console evidence.'
                : 'The search response needs source URLs, capture ids, or redacted source hashes for every queue item before analyst trust is strong.',
        },
        {
            title: 'Map actor to customer watchlists',
            status: hasOrganizations ? 'watch' : 'needs_api',
            detail: hasOrganizations
                ? `Candidate watched objects include ${watchlist.organizations.slice(0, 3).join(', ')}.`
                : 'No watched organization/domain match is returned by the public API. Add a watchlist-match field to the search response for sellable alerts.',
        },
        {
            title: 'Promote evidence to case queue',
            status: hasReviewInbox ? 'ready' : selected?.kind === 'exposure' || hasActivity ? 'needs_review' : 'needs_api',
            detail: hasReviewInbox
                ? 'The response includes metadata review inbox items that can feed authenticated case work.'
                : 'The UI builds a local queue from returned profile/activity fields; the backend should return stable case ids for persisted work.',
        },
    ]
}

function queueCountsFor(items: AnalystWorkItem[], decisions: Record<string, LocalDecision>) {
    return items.reduce((counts, item) => {
        const decision = decisions[item.id]
        if (decision?.status === 'closed' || decision?.status === 'suppressed') counts.closed += 1
        else counts.open += 1
        if (item.severity === 'critical' || item.severity === 'high') counts.high += 1
        return counts
    }, { open: 0, high: 0, closed: 0 })
}

function unique(values: string[]) {
    const seen = new Set<string>()
    return values.map(value => value.trim()).filter(value => {
        const key = value.toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function domainFromUrl(value?: string) {
    if (!value) return null
    try {
        return new URL(value).hostname.replace(/^www\./, '')
    } catch {
        return null
    }
}

function taskStatusLabel(status: EnrichmentTask['status']) {
    if (status === 'needs_api') return 'backend contract'
    if (status === 'needs_review') return 'review'
    if (status === 'watch') return 'watchlist'
    return 'ready'
}

function taskStatusClass(status: EnrichmentTask['status']) {
    if (status === 'ready') return 'rounded-lg bg-[#e9f8ef] px-2 py-1 text-[11px] font-semibold text-[#147a3b]'
    if (status === 'watch') return 'rounded-lg bg-[#eef3ff] px-2 py-1 text-[11px] font-semibold text-[#3056d3]'
    if (status === 'needs_review') return 'rounded-lg bg-[#fff4d6] px-2 py-1 text-[11px] font-semibold text-[#8a5a00]'
    return 'rounded-lg bg-[#fff1f0] px-2 py-1 text-[11px] font-semibold text-[#b42318]'
}

function severityClass(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 'bg-[#fee4e2] text-[#b42318]'
    if (severity === 'high') return 'bg-[#fff1f0] text-[#c2410c]'
    if (severity === 'medium') return 'bg-[#fff4d6] text-[#8a5a00]'
    return 'bg-[#e9f8ef] text-[#147a3b]'
}

function severityWeight(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 4
    if (severity === 'high') return 3
    if (severity === 'medium') return 2
    return 1
}

function kindLabel(kind: AnalystWorkItem['kind']) {
    if (kind === 'exposure') return 'Exposure'
    if (kind === 'victim') return 'Victim context'
    if (kind === 'tradecraft') return 'Tradecraft'
    if (kind === 'collection') return 'Collection'
    return 'Activity'
}

function decisionLabel(status: LocalDecision['status']) {
    if (status === 'reviewing') return 'Reviewing'
    if (status === 'assigned') return 'Assigned'
    if (status === 'escalated') return 'Escalated'
    if (status === 'suppressed') return 'Suppressed'
    if (status === 'reopened') return 'Reopened'
    return 'Closed'
}

function defaultDecisionReason(status: LocalDecision['status']) {
    if (status === 'reviewing') return 'Review started in the public TI workspace.'
    if (status === 'assigned') return 'Assigned locally for follow-up.'
    if (status === 'escalated') return 'Escalated for customer or incident-response review.'
    if (status === 'suppressed') return 'Suppressed as low-value, duplicate, or false positive.'
    if (status === 'reopened') return 'Reopened for another look.'
    return 'Closed in the local TI workspace.'
}

function EvidenceBox({ href, children }: { href?: string; children: React.ReactNode }) {
    const className = `grid gap-1 border-b border-[#eef1f5] py-3 last:border-b-0 ${href ? 'rounded-lg px-2 transition hover:border-[#3056d3]/20 hover:bg-[#3056d3]/5 focus:outline-none focus:ring-1 focus:ring-[#3056d3]/35' : ''}`
    if (!href) return <div className={className}>{children}</div>
    return (
        <a href={href} target='_blank' rel='noopener noreferrer' className={className} title={href}>
            {children}
        </a>
    )
}

function EmptyState() {
    return (
        <section className='grid min-h-[48vh] place-items-center border border-[#dfe5ee] bg-white px-5 py-10 text-center'>
            <div className='grid max-w-xl gap-3'>
                <Radar className='mx-auto h-8 w-8 text-[#3056d3]' />
                <h1 className='text-2xl font-semibold text-[#171a21]'>Search company exposure and actor context</h1>
                <p className='text-sm leading-6 text-[#667085]'>Enter a company, vendor, domain, ransomware group, CVE, or actor name.</p>
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
        datasets: defaultDatasets(),
        sources: defaultSourceLinks(),
        notes: []
    }
}

function defaultDatasets(): TiSearchResponse['datasets'] {
    return [
        {
            name: 'Ransomware victim claims',
            type: 'darknet_metadata',
            coverage: 'Recent company names, actor names, claimed dates, sector/country context, and claimed-data descriptions from monitored extortion sources and public indexes.',
            status: 'available',
            url: 'https://ransomware.live/'
        },
        {
            name: 'Actor infrastructure monitoring',
            type: 'darknet_metadata',
            coverage: 'Company-first checks against actor-controlled public leak infrastructure so watched companies can be alerted when a new mention appears.',
            status: 'metadata_only'
        },
        {
            name: 'Vulnerability and exploitation context',
            type: 'clear_web',
            coverage: 'Recent NVD/CISA and public advisory context for CVEs, affected products, exploitation status, and actor-linked vulnerability activity.',
            status: 'available',
            url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'
        },
        {
            name: 'Company and supplier watchlists',
            type: 'vendor_report',
            coverage: 'Customer-specific names, domains, brands, subsidiaries, and vendors matched against new actor claims and captured page text.',
            status: 'planned'
        }
    ]
}

function defaultCollectionSources(): NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture'] {
    return [
        {
            source: 'RansomLook and ransomware.live',
            role: 'primary_seed',
            summary: 'Used as starting coverage for recent victim claims, actor names, company names, claimed dates, sector/country context, and claimed-data descriptions.',
            buyerValue: 'Good seed data lets a small team detect obvious company mentions immediately, then spend engineering effort on direct verification and alert speed.'
        },
        {
            source: 'Direct actor infrastructure collection',
            role: 'owned_collection_target',
            summary: 'Company-first collection from actor-controlled public leak/extortion infrastructure where policy allows.',
            buyerValue: 'This is the valuable part: faster discovery, verified claim changes, freshness deltas, and watchlist alerts that are not just copied from another public index.'
        },
        {
            source: 'Infostealer and credential-exposure records',
            role: 'owned_collection_target',
            summary: 'Company/domain exposure records routed through review without credential values, raw dumps, or unsafe redistribution.',
            buyerValue: 'Buyers care when their domain, vendor, executive, or portfolio company appears in fresh exposure records; the value is the alert and triage context, not dump access.'
        },
        {
            source: 'NVD, CISA KEV, and public advisories',
            role: 'corroboration',
            summary: 'Used for enrichment, prioritization, and vulnerability context around actor activity.',
            buyerValue: 'Public vulnerability data is not the product by itself, but it makes exposure alerts more actionable for security teams deciding what to patch or investigate first.'
        }
    ]
}

function defaultSourceLinks(): TiSearchResponse['sources'] {
    return [
        {
            id: 'ransomware-live',
            name: 'ransomware.live',
            type: 'victim_claim_seed',
            provenance: 'https://ransomware.live/',
            url: 'https://ransomware.live/'
        },
        {
            id: 'ransomlook',
            name: 'RansomLook',
            type: 'victim_claim_seed',
            provenance: 'https://www.ransomlook.io/',
            url: 'https://www.ransomlook.io/'
        },
        {
            id: 'cisa-kev',
            name: 'CISA Known Exploited Vulnerabilities',
            type: 'vulnerability_context',
            provenance: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
            url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'
        }
    ]
}

function formatDate(value: string) {
    if (!value) return 'Now'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
    return parsed.toISOString().slice(0, 10)
}

function Panel({ title, description, icon, children }: { title: string; description?: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className='border border-[#dfe5ee] bg-white p-4'>
            <div className='mb-2 flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                <span className='text-[#3056d3]'>{icon}</span>
                <span>{title}</span>
                {description ? <InfoTip label={description} /> : null}
            </div>
            {children}
        </section>
    )
}

function CoverageStrategyPanel({ sources }: { sources: NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture'] }) {
    return (
        <Panel title='Monitoring Mix' description='How the result is assembled: public indexes can seed coverage, direct monitored pages provide freshness, and advisories add vulnerability context.' icon={<Database className='h-4 w-4' />}>
            <div className='grid gap-3'>
                {sources.filter(source => source.role !== 'rejected_paid_rows').slice(0, 4).map(source => (
                    <div key={`${source.source}-${source.role}`} className='rounded-lg border border-[#eef1f5] bg-[#f8fafc] p-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <h3 className='text-sm font-semibold text-[#171a21]'>{source.source}</h3>
                            <span className='rounded-lg bg-[#f8fafc] px-2 py-1 text-xs text-[#667085]'>{sourceRoleLabel(source.role)}</span>
                        </div>
                        <p className='mt-2 text-sm leading-6 text-[#596170]'>{source.summary}</p>
                        <p className='mt-2 text-xs leading-5 text-[#667085]'>{source.buyerValue}</p>
                    </div>
                ))}
            </div>
        </Panel>
    )
}

function SourceLinksPanel({ sources }: { sources: TiSearchResponse['sources'] }) {
    const visibleSources = sources.slice(0, 5)
    const hiddenCount = Math.max(0, sources.length - visibleSources.length)
    return (
        <Panel title='Sources Used' description='Named sources used for this result. Public visitors see a limited set; customer console access can show additional source links and internal capture details.' icon={<ExternalLink className='h-4 w-4' />}>
            <div className='grid gap-1'>
                {visibleSources.map(source => {
                    const href = source.url || linkFromText(source.provenance)
                    return (
                        <EvidenceBox key={source.id} href={href}>
                            <h2 className='inline-flex items-center gap-1 text-sm font-semibold text-[#171a21]'>{source.name}{href ? <ExternalLink className='h-3 w-3 text-[#3056d3]' /> : null}</h2>
                            <p className='text-xs text-[#667085]'>{sourceTypeLabel(source.type)}</p>
                            <p className='text-sm leading-6 text-[#596170]'>{sourceDisplayText(source)}</p>
                        </EvidenceBox>
                    )
                })}
                {hiddenCount > 0 ? (
                    <div className='mt-2 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-3 text-sm leading-6 text-[#596170]'>
                        {hiddenCount} additional source{hiddenCount === 1 ? '' : 's'} available in the customer console.
                    </div>
                ) : null}
            </div>
        </Panel>
    )
}

function InfoTip({ label }: { label: string }) {
    return (
        <span className='group relative inline-flex'>
            <button
                type='button'
                aria-label={label}
                className='inline-flex h-6 w-6 items-center justify-center rounded-full text-[#667085] transition hover:bg-[#eef3ff] hover:text-[#3056d3] focus:outline-none focus:ring-2 focus:ring-[#b8c5ff]'
            >
                <HelpCircle className='h-3.5 w-3.5' />
            </button>
            <span className='pointer-events-none absolute left-1/2 top-7 z-20 hidden w-72 -translate-x-1/2 rounded-lg border border-[#dfe5ee] bg-white p-3 text-left text-xs font-medium leading-5 text-[#404957] shadow-xl group-hover:block group-focus-within:block'>
                {label}
            </span>
        </span>
    )
}

function TechniqueBadge({ attackId, name, tactic, detail }: { attackId: string; name: string; tactic: string; detail: string }) {
    const description = techniqueDescription(attackId, name, tactic, detail)
    return (
        <span className='group relative inline-flex'>
            <a
                href={`https://attack.mitre.org/techniques/${attackId.replace('.', '/')}/`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label={`${attackId}: ${description}`}
                className='rounded-md border border-[#b8c5ff] bg-[#eef3ff] px-1.5 py-0.5 text-xs font-semibold text-[#3056d3] transition hover:border-[#3056d3] hover:bg-[#e1e9ff] focus:outline-none focus:ring-2 focus:ring-[#b8c5ff]'
            >
                {attackId}
            </a>
            <span className='pointer-events-none absolute left-1/2 top-7 z-20 hidden w-80 -translate-x-1/2 rounded-lg border border-[#dfe5ee] bg-white p-3 text-left text-xs font-medium leading-5 text-[#404957] shadow-xl group-hover:block group-focus-within:block'>
                <span className='block font-semibold text-[#171a21]'>{attackId}: {name}</span>
                <span className='mt-1 block text-[#667085]'>{tactic}</span>
                <span className='mt-2 block'>{description}</span>
            </span>
        </span>
    )
}

function techniqueDescription(attackId: string, name: string, tactic: string, detail: string) {
    const descriptions: Record<string, string> = {
        'T1005': 'Data from Local System: collecting files or data from a compromised computer before staging, exfiltration, or further use.',
        'T1078': 'Valid Accounts: using legitimate user, service, or cloud accounts to access systems and avoid obvious intrusion paths.',
        'T1078.004': 'Valid Accounts: Cloud Accounts: using legitimate cloud account credentials to access cloud-hosted services and resources.',
        'T1102': 'Web Service: using an external web service as part of command-and-control or operational infrastructure.',
        'T1105': 'Ingress Tool Transfer: moving tools, malware, scripts, or payloads into a compromised environment.',
        'T1110': 'Brute Force: trying passwords, password hashes, or credential material to gain access to accounts.',
        'T1110.003': 'Password Spraying: trying a small number of common passwords across many accounts to avoid lockouts.',
        'T1114': 'Email Collection: collecting email messages or mail data from local systems, remote services, or cloud mailboxes.',
        'T1486': 'Data Encrypted for Impact: encrypting data on target systems to disrupt operations or support extortion.',
        'T1566': 'Phishing: sending deceptive messages to trick users into opening links, attachments, or giving up access.',
        'T1566.001': 'Spearphishing Attachment: sending targeted emails with malicious attachments to gain execution or access.',
        'T1567': 'Exfiltration Over Web Service: sending stolen data to a web service controlled by, or usable by, the actor.',
    }
    return descriptions[attackId] ?? `${name}: ${detail || `Reported under the ${tactic} tactic.`}`
}

function ProfileStat({ icon, label, value, dark = false }: { icon: React.ReactNode; label: string; value: string; dark?: boolean }) {
    return (
        <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs ${dark ? 'border-white/10 bg-white/10 text-[#d8deea]' : 'border-[#dfe5ee] bg-[#f8fafc] text-[#667085]'}`}>
            <span className={dark ? 'text-[#b8c5ff]' : 'text-[#3056d3]'}>{icon}</span>
            <span>{label}</span>
            <span className={`truncate font-semibold ${dark ? 'text-white' : 'text-[#171a21]'}`}>{value}</span>
        </span>
    )
}

function ThreatActorMap({ result }: { result: TiSearchResponse }) {
    const geo = actorGeoProfile(result)
    const hasPoints = geo.points.length > 0
    return (
        <div className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-[#f8fafc]'>
            <div className='flex items-center justify-between gap-3 border-b border-[#e8edf5] px-4 py-3'>
                <div>
                    <h2 className='text-sm font-semibold text-[#171a21]'>Country-Level Actor Map</h2>
                    <p className='mt-0.5 text-xs text-[#667085]'>Purple marks reported operator origin. Red marks countries with returned victim or targeting observations.</p>
                </div>
                <span className='rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#3056d3]'>{hasPoints ? `${geo.points.length} countries` : 'Country data pending'}</span>
            </div>
            <div className='relative bg-[#f7f9fc] p-3'>
                <svg viewBox='0 0 640 320' role='img' aria-label={`Country-level actor map for ${humanizeSlug(result.query)}`} className='h-72 w-full'>
                    <rect width='640' height='320' rx='18' fill='#ffffff' />
                    <WorldMapBase />
                    {geo.points.map(point => {
                        const color = point.role === 'operator' ? '#7c3aed' : '#d92d20'
                        const label = mapLabelPosition(point.code)
                        return (
                            <g key={`${point.role}-${point.code}`}>
                                <circle cx={point.x} cy={point.y} r='10' fill={color} opacity='0.12' />
                                <circle cx={point.x} cy={point.y} r='5.5' fill={color} opacity='0.94' />
                                <circle cx={point.x} cy={point.y} r='2' fill='#ffffff' />
                                <text
                                    x={point.x + label.dx}
                                    y={point.y + label.dy}
                                    textAnchor={label.anchor}
                                    fill='#171a21'
                                    stroke='#ffffff'
                                    strokeWidth='3'
                                    paintOrder='stroke'
                                    fontSize='10'
                                    fontWeight='700'
                                >
                                    {point.label}
                                </text>
                            </g>
                        )
                    })}
                    {geo.flows.map(flow => (
                        <path
                            key={`${flow.from.code}-${flow.to.code}`}
                            d={`M${flow.from.x} ${flow.from.y} C ${(flow.from.x + flow.to.x) / 2} ${Math.min(flow.from.y, flow.to.y) - 42}, ${(flow.from.x + flow.to.x) / 2} ${Math.min(flow.from.y, flow.to.y) - 42}, ${flow.to.x} ${flow.to.y}`}
                            fill='none'
                            stroke='#d92d20'
                            strokeDasharray='4 5'
                            strokeWidth='1.4'
                            opacity='0.36'
                        />
                    ))}
                </svg>
                {!hasPoints ? (
                    <div className='absolute inset-3 grid place-items-center rounded-lg bg-white/80 text-center text-sm font-medium text-[#667085]'>
                        Country mapping will appear when this profile has country-level target or origin observations.
                    </div>
                ) : null}
            </div>
            {hasPoints ? (
                <div className='grid gap-3 border-t border-[#e8edf5] bg-white px-4 py-3'>
                    <div className='flex flex-wrap gap-3 text-xs'>
                        <span className='inline-flex items-center gap-1.5 text-[#667085]'><span className='h-2.5 w-2.5 rounded-full bg-[#7c3aed]' />Reported operator origin</span>
                        <span className='inline-flex items-center gap-1.5 text-[#667085]'><span className='h-2.5 w-2.5 rounded-full bg-[#d92d20]' />Reported victim or target country</span>
                    </div>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        {geo.points.map(point => (
                            <div key={`${point.role}-row-${point.code}`} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] px-3 py-2 text-xs'>
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='font-semibold text-[#171a21]'>{point.label}</span>
                                    <span className={point.role === 'operator' ? 'text-[#7c3aed]' : 'text-[#b42318]'}>{point.role === 'operator' ? 'operator origin' : `${point.count} observation${point.count === 1 ? '' : 's'}`}</span>
                                </div>
                                <p className='mt-1 leading-5 text-[#667085]'>{point.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function WorldMapBase() {
    return (
        <g>
            <path d='M105 80 L155 66 L210 75 L240 102 L220 136 L165 151 L113 137 L82 111 Z' fill='#edf2f8' stroke='#d8e0eb' />
            <path d='M154 154 L197 166 L224 205 L210 257 L178 294 L145 273 L130 228 L139 186 Z' fill='#edf2f8' stroke='#d8e0eb' />
            <path d='M300 78 L342 62 L391 72 L420 98 L407 126 L357 132 L309 112 Z' fill='#edf2f8' stroke='#d8e0eb' />
            <path d='M353 132 L400 139 L432 178 L425 228 L394 272 L357 250 L335 198 Z' fill='#edf2f8' stroke='#d8e0eb' />
            <path d='M407 70 L485 57 L559 86 L597 127 L579 165 L512 174 L464 148 L420 124 Z' fill='#edf2f8' stroke='#d8e0eb' />
            <path d='M497 181 L548 189 L586 227 L573 269 L527 282 L488 251 Z' fill='#edf2f8' stroke='#d8e0eb' />
            <path d='M36 160 H604 M320 32 V288 M36 96 H604 M36 224 H604' stroke='#edf2f8' strokeWidth='1' />
            <path d='M31 48 H609 V292 H31 Z' fill='none' stroke='#edf2f8' />
            {countryShapes.map(shape => (
                <path key={shape.code} d={shape.d} fill='#dde6f2' stroke='#c7d2e2' strokeWidth='0.8' />
            ))}
        </g>
    )
}

const countryShapes = [
    { code: 'US', d: 'M111 111 L153 98 L186 115 L178 134 L139 139 L109 128 Z' },
    { code: 'CA', d: 'M92 72 L160 55 L207 72 L181 94 L129 95 L88 86 Z' },
    { code: 'GB', d: 'M300 84 L312 89 L309 102 L297 98 Z' },
    { code: 'NO', d: 'M328 61 L340 69 L335 85 L324 78 Z' },
    { code: 'DE', d: 'M321 101 L334 102 L336 116 L322 119 L315 110 Z' },
    { code: 'FR', d: 'M305 113 L322 116 L323 130 L311 138 L300 128 Z' },
    { code: 'RU', d: 'M360 62 L455 51 L552 79 L576 111 L535 129 L456 112 L388 103 Z' },
    { code: 'UA', d: 'M345 115 L369 116 L376 127 L350 130 Z' },
    { code: 'CN', d: 'M460 126 L508 122 L532 148 L508 170 L463 158 Z' },
    { code: 'JP', d: 'M543 126 L552 137 L548 151 L538 141 Z' },
    { code: 'IN', d: 'M448 151 L474 161 L466 196 L444 181 Z' },
    { code: 'AU', d: 'M500 229 L548 222 L575 246 L558 271 L510 266 Z' },
]

function mapLabelPosition(code: string): { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' } {
    const offsets: Record<string, { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }> = {
        GB: { dx: 0, dy: -17, anchor: 'middle' },
        DE: { dx: 12, dy: 15, anchor: 'start' },
        RU: { dx: 13, dy: -7, anchor: 'start' },
        US: { dx: 12, dy: -8, anchor: 'start' },
        FR: { dx: -12, dy: 16, anchor: 'end' },
        NL: { dx: -12, dy: -10, anchor: 'end' },
    }
    return offsets[code] ?? { dx: 9, dy: -7, anchor: 'start' }
}

function EmptyLine({ text }: { text: string }) {
    return <p className='py-3 text-sm text-[#667085]'>{text}</p>
}

function rowToneClass(tone: 'ok' | 'watch' | 'bad') {
    if (tone === 'bad') return 'bg-[#fee4e2] text-[#b42318]'
    if (tone === 'watch') return 'bg-[#fff4d6] text-[#8a5a00]'
    return 'bg-[#e9f8ef] text-[#147a3b]'
}

function formatLabel(value: string) {
    return value.replaceAll('_', ' ')
}

function humanResultStatus(value?: string) {
    if (!value) return 'Monitoring'
    if (value === 'metadata_review') return 'Review queue'
    if (value === 'needs_source_activation') return 'Connecting sources'
    if (value === 'blocked_unsafe_target') return 'Review required'
    if (value === 'ready') return 'Current profile'
    if (value === 'partial') return 'Updating'
    if (value === 'searching' || value === 'queued') return 'Searching'
    return formatLabel(value)
}

function sourceStatusLabel(value: string) {
    if (/metadata/i.test(value)) return 'Monitoring data'
    if (/available|ready|active/i.test(value)) return 'Included'
    if (/context/i.test(value)) return 'Context'
    return 'Included'
}

function sourceCountLabel(count: number) {
    if (count <= 0) return 'No sources'
    return `${Math.min(count, 5)} shown${count > 5 ? ` of ${count}` : ''}`
}

function activitySourceLabel(count: number) {
    if (count <= 0) return 'Source pending'
    return count === 1 ? '1 source' : `${count} sources`
}

function updateMetaDescription(content: string) {
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
    }
    meta.content = content
}

function updateCanonical(path: string) {
    const href = `${window.location.origin}${path}`
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.appendChild(canonical)
    }
    canonical.href = href
}

function sourceRoleLabel(value: string) {
    if (value === 'primary_seed') return 'Seed coverage'
    if (value === 'owned_collection_target') return 'Owned monitoring'
    if (value === 'corroboration') return 'Corroboration'
    if (value === 'context_only') return 'Context'
    return formatLabel(value)
}

function sourceTypeLabel(value: string) {
    if (/news/i.test(value)) return 'Recent reporting'
    if (/victim|claim|ransom/i.test(value)) return 'Victim claims'
    if (/vulnerab|cve|kev/i.test(value)) return 'Vulnerability context'
    if (/darknet|darkweb|actor/i.test(value)) return 'Actor-page records'
    return 'Source'
}

function sourceDisplayText(source: TiSearchResponse['sources'][number]) {
    const href = source.url || linkFromText(source.provenance)
    if (href) {
        try {
            const url = new URL(href)
            if (/news\.google\.com$/i.test(url.hostname)) return 'Linked report via Google News'
            return url.hostname.replace(/^www\./, '')
        } catch {
            return 'Open source'
        }
    }
    return readableSourceText(source.provenance)
}

function linkFromText(value?: string) {
    if (!value) return undefined
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

function readableSourceText(value?: string) {
    if (!value) return 'Source details available in the console'
    if (/^https?:\/\//i.test(value)) {
        try {
            return new URL(value).hostname.replace(/^www\./, '')
        } catch {
            return 'Open source'
        }
    }
    return value.replace(/^Scraper run [^;]+;\s*/i, '').replace(/^Live query text;\s*/i, '')
}

function alertItemsFor(result: TiSearchResponse) {
    const fromReview = result.analystLoop?.metadataReviewInbox.map(item => ({
        title: item.company || item.victim || 'Exposure mention',
        detail: [item.affectedAccounts, item.datasetSize, item.actorStatement].filter(Boolean).join(' · ') || 'Review the captured mention before customer alerting.',
        state: 'review',
        tone: 'watch' as const
    })) ?? []
    const fromActivity = result.recentActivity
        .filter(item => item.victimName || item.claimType === 'victim_claim' || /victim|leak|claim|stolen|exfiltrat/i.test(`${item.title} ${item.detail}`))
        .map(item => ({
            title: item.victimName || item.title,
            detail: item.impact || item.detail,
            state: 'matched',
            tone: 'ok' as const
        }))
    if (fromReview.length || fromActivity.length) return [...fromReview, ...fromActivity].slice(0, 5)
    if (result.status === 'searching' || result.status === 'queued') {
        return [{
            title: 'Watching for company matches',
            detail: 'The search is checking actor claims, public indexes, and captured page text for company, vendor, domain, and brand mentions.',
            state: 'watching',
            tone: 'watch' as const
        }]
    }
    return []
}
