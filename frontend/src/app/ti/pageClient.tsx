'use client'

import searchThreatIntel, { TiSearchResponse } from '@/utils/ti/search'
import { actorGeoProfile, countryFromValue, victimObservationsFor } from '@/utils/ti/actorProfile'
import { buildActorIntelligence, type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { buildTiActionability, type TiActionabilityModel } from '@/utils/ti/actionability'
import { PUBLIC_TI_HANDOFF_ACTIONS, buildActorArtifactHandoffs, buildActorArtifacts, nextActorArtifactId, type ActorArtifact, type ActorArtifactHandoffs, type ActorArtifactKind } from '@/utils/ti/actorWorkbench'
import { countryCentroids } from '@/utils/monitoring/geo'
import { clampViewBox, getCountryFocusView, INITIAL_VIEWBOX, MAP_HEIGHT, MAP_WIDTH, project, type ViewBox, zoomViewBox } from '@/utils/monitoring/liveTrafficMap'
import mapData from '@parent/public/world.json'
import { Activity, BellRing, Building2, CheckCircle2, ClipboardList, Clock3, Copy, Database, ExternalLink, Eye, Globe2, HelpCircle, Inbox, Move, Radar, Search, Send, ShieldAlert, ShieldCheck, Target, UserPlus, Waypoints, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
    const actorArtifacts = useMemo(() => buildActorArtifacts(result, actorIntel, victimObservations, actionability), [result, actorIntel, victimObservations, actionability])
    const workItems = useMemo(() => analystWorkItemsFor(result, victimObservations, sourceUrlById), [result, victimObservations, sourceUrlById])
    const watchlist = useMemo(() => watchlistRelevanceFor(result, victimObservations, sources, actorIntel, actionability), [result, victimObservations, sources, actorIntel, actionability])
    const [selectedId, setSelectedId] = useState(workItems[0]?.id ?? '')
    const [selectedArtifactId, setSelectedArtifactId] = useState(actorArtifacts[0]?.id ?? '')
    const [localDecisions, setLocalDecisions] = useState<Record<string, LocalDecision>>({})
    const [notes, setNotes] = useState<Record<string, string>>({})
    const selected = workItems.find(item => item.id === selectedId) ?? workItems[0]
    const selectedArtifact = actorArtifacts.find(item => item.id === selectedArtifactId) ?? actorArtifacts[0]
    const selectedArtifactHandoffs = selectedArtifact ? buildActorArtifactHandoffs(result, selectedArtifact, actionability) : null
    const selectedDecision = selected ? localDecisions[selected.id] : undefined
    const selectedNote = selected ? notes[selected.id] ?? '' : ''
    const alertPacket = selected ? alertPacketFor(result, selected, watchlist) : null
    const enrichmentTasks = enrichmentTasksFor(result, selected, watchlist, sources, actorIntel, actionability)
    const readyHandoffCount = actionability.consumerReadiness.stages.filter(stage => stage.state === 'ready').length
    const totalHandoffCount = actionability.consumerReadiness.stages.length
    const openGapCount = actionability.enrichmentGapQueue.length
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
        { icon: <Activity className='h-3.5 w-3.5' />, label: 'Last seen', value: formatDate(result.lastSeen || result.generatedAt) },
        { icon: <Inbox className='h-3.5 w-3.5' />, label: 'Queue', value: `${queueCounts.open} open` },
        { icon: <BellRing className='h-3.5 w-3.5' />, label: 'Handoff', value: `${readyHandoffCount}/${totalHandoffCount} ready` },
        { icon: <Database className='h-3.5 w-3.5' />, label: 'Gaps', value: `${openGapCount} open` },
    ]
    const sectionOverview = sectionOverviewFor({ result, actorIntel, actionability, workItems, victimObservations, watchlist })

    useEffect(() => {
        if (!workItems.length) return
        if (!workItems.some(item => item.id === selectedId)) setSelectedId(workItems[0]?.id ?? '')
    }, [selectedId, workItems])

    useEffect(() => {
        if (!actorArtifacts.length) return
        if (!actorArtifacts.some(item => item.id === selectedArtifactId)) setSelectedArtifactId(actorArtifacts[0]?.id ?? '')
    }, [actorArtifacts, selectedArtifactId])

    function selectArtifactBy(kind: ActorArtifactKind, value: string) {
        const normalized = value.toLowerCase()
        const artifact = actorArtifacts.find(item => item.kind === kind && item.label.toLowerCase() === normalized)
            ?? actorArtifacts.find(item => item.kind === kind && item.id.endsWith(normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')))
        if (artifact) setSelectedArtifactId(artifact.id)
    }

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
                    <div className='grid grid-cols-2 gap-2 sm:grid-cols-5 lg:min-w-[40rem]'>
                        {profileStats.map(item => (
                            <ProfileStat key={item.label} icon={item.icon} label={item.label} value={item.value} />
                        ))}
                    </div>
                    <SectionOverviewRail items={sectionOverview} />
                </div>

                <div className='grid min-h-[44rem] min-w-0 lg:grid-cols-[320px_minmax(0,1fr)_340px]'>
                    <aside data-ti-queue='true' className='order-2 min-w-0 border-b border-[#e8edf5] bg-[#fbfcfe] lg:order-none lg:border-b-0 lg:border-r'>
                        <div className='border-b border-[#e8edf5] p-4'>
                            <div className='flex items-center justify-between gap-3'>
                                <div>
                                    <h2 className='text-sm font-semibold text-[#171a21]'>Activity</h2>
                                    <p className='mt-1 text-xs text-[#667085]'>Evidence ordered by severity, confidence, and recency.</p>
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
                            <div className='grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden'>
                                <ActorIntelligenceDossier
                                    actor={actorIntel}
                                    result={result}
                                    artifacts={actorArtifacts}
                                    selectedArtifactId={selectedArtifact?.id}
                                    onSelectArtifact={setSelectedArtifactId}
                                />
                                {actorArtifacts.length ? (
                                    <ArtifactNavigator
                                        artifacts={actorArtifacts}
                                        selectedArtifactId={selectedArtifact?.id}
                                        onSelectArtifact={setSelectedArtifactId}
                                    />
                                ) : null}
                                {selectedArtifact && selectedArtifactHandoffs ? (
                                    <ActorArtifactWorkbench artifact={selectedArtifact} handoffs={selectedArtifactHandoffs} />
                                ) : null}

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
                                    <Panel title='Targeting' description='Country, victim, sector, timeframe, incident, and source basis for the selected actor/query.' icon={<Target className='h-4 w-4' />}>
                                        {victimObservations.length ? victimObservations.map(item => (
                                            <VictimObservationRow key={`${item.victim}-${item.timeframe}`} item={item} />
                                        )) : <EmptyLine text='No country-level victim or target observations returned yet.' />}
                                    </Panel>

                                    <Panel title='Infrastructure and Tradecraft' description='Reported infrastructure patterns and techniques, usually mapped to ATT&CK where available.' icon={<Waypoints className='h-4 w-4' />}>
                                        {actorIntel.infrastructure.length ? (
                                            <div className='mb-3 flex flex-wrap gap-1.5'>
                                                {actorIntel.infrastructure.slice(0, 8).map(item => (
                                                    <span key={item} className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-[#f8fafc] px-2 py-1 text-xs font-semibold text-[#344054]'>{item}</span>
                                                ))}
                                            </div>
                                        ) : <EmptyLine text='No infrastructure rows returned yet.' />}
                                        {result.ttps.length ? result.ttps.map(item => (
                                            <div key={`${item.attackId}-${item.name}`} className='grid gap-1 border-b border-[#eef1f5] py-3 last:border-b-0'>
                                                <div className='flex flex-wrap items-center gap-2'>
                                                    <button
                                                        type='button'
                                                        onClick={() => selectArtifactBy('technique', item.attackId ? `${item.attackId} ${item.name}` : item.name)}
                                                        className='text-left text-sm font-semibold text-[#171a21] transition hover:text-[#3056d3] focus:outline-none focus:ring-2 focus:ring-[#b8c5ff]'
                                                    >
                                                        {item.name}
                                                    </button>
                                                    {item.attackId ? <TechniqueBadge attackId={item.attackId} name={item.name} tactic={item.tactic} detail={item.detail} /> : null}
                                                </div>
                                                <p className='text-xs text-[#667085]'>{item.tactic} · {Math.round(item.confidence * 100)}% confidence</p>
                                                <p className='text-sm leading-6 text-[#596170]'>{item.detail}</p>
                                            </div>
                                        )) : <EmptyLine text='No tradecraft returned yet.' />}
                                    </Panel>
                                </section>

                                <ThreatActorMap result={result} actionability={actionability} onSelectCountry={(country) => selectArtifactBy('country', country)} />
                            </div>
                        ) : (
                            <div className='grid min-h-96 place-items-center rounded-lg border border-dashed border-[#d8dee9] bg-white p-8 text-center text-sm text-[#667085]'>Search is still building an analyst queue.</div>
                        )}
                    </main>

                    <aside className='order-3 grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] content-start gap-4 overflow-hidden border-t border-[#e8edf5] bg-[#fbfcfe] p-4 lg:order-none lg:border-l lg:border-t-0'>
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

                        <Panel title='Evidence Timeline' description='Evidence timestamps plus analyst decisions made in this browser session.' icon={<Clock3 className='h-4 w-4' />}>
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

                        <Panel title='Collection Gaps' description='Source families and missing fields that need collection or enrichment before stronger handoff.' icon={<Database className='h-4 w-4' />}>
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
                <Panel title='Watchlist Relevance' description='Company, domain, vendor, brand, product, or portfolio matches from actor claims, leak posts, advisories, or monitored pages.' icon={<Building2 className='h-4 w-4' />}>
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

                <Panel title='Sources' description='Data families checked for this result, including actor profiles, victim claims, public advisories, and watched company or supplier terms.' icon={<Globe2 className='h-4 w-4' />}>
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
    matchedTerms: string[]
    organizations: string[]
    sectors: string[]
    countries: string[]
    domains: string[]
    rationale: string
}

type SectionOverviewItem = {
    label: 'Overview' | 'Activity' | 'Targeting' | 'Infrastructure' | 'Sources' | 'Evidence' | 'Watchlist relevance' | 'Related alerts/cases' | 'Collection gaps' | 'Actions'
    value: string
    state: 'ready' | 'review' | 'blocked'
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

function ActorIntelligenceDossier({ actor, result, artifacts, selectedArtifactId, onSelectArtifact }: {
    actor: TiActorIntelligenceProfile
    result: TiSearchResponse
    artifacts: ActorArtifact[]
    selectedArtifactId?: string
    onSelectArtifact: (artifactId: string) => void
}) {
    const confidence = Math.round(actor.confidence * 100)
    const artifactByLookup = new Map(artifacts.map(artifact => [`${artifact.kind}:${artifact.label.toLowerCase()}`, artifact]))
    return (
        <section data-ti-actor-dossier='true' className='w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-[#dfe5ee] bg-white p-4 dark:border-[#263244] dark:bg-[#101722]'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='w-full min-w-0 lg:flex-1 lg:basis-64'>
                    <p className='text-xs font-semibold uppercase text-[#3056d3] dark:text-[#9ab3ff]'>Overview</p>
                    <h2 className='mt-1 wrap-break-word text-xl font-semibold text-[#171a21] dark:text-[#eef4ff]'>{actor.actorClass}</h2>
                    <p className='mt-2 text-sm leading-6 text-[#596170] dark:text-[#b7c2d4]'>{actor.attribution}</p>
                </div>
                <div className='grid w-full min-w-0 basis-full grid-cols-2 gap-2 text-center text-xs sm:min-w-52 md:grid-cols-4 lg:w-auto lg:basis-auto'>
                    <EvidenceMetric label='First seen' value={actor.firstSeen} />
                    <EvidenceMetric label='Last seen' value={formatDate(actor.lastSeen || result.lastSeen)} />
                    <EvidenceMetric label='Confidence' value={`${confidence}%`} />
                    <EvidenceMetric label='Freshness' value={actor.freshness.stale ? 'Needs refresh' : 'Current'} />
                </div>
            </div>

            <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                <DossierList title='Motivation' values={actor.motivation} />
                <DossierList title='Tooling' values={actor.malwareTools} artifactKind='tool' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <DossierList title='Campaigns' values={actor.campaigns} artifactKind='campaign' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <DossierList title='Indicators' values={actor.indicators} />
                <DossierList title='Targeting' values={actor.targetSectors} />
                <DossierList title='Geographies' values={actor.geographies} artifactKind='country' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <DossierList title='Infrastructure' values={actor.infrastructure} artifactKind='infrastructure' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
            </div>

            <div className='mt-4 grid gap-3 xl:grid-cols-2'>
                <EvidencePanel title='Confidence reasoning'>
                    {actor.confidenceReasoning.map(item => <li key={item}>{item}</li>)}
                </EvidencePanel>
                <StructuredProvenancePanel rows={actor.provenanceRows} />
            </div>
        </section>
    )
}

function SectionOverviewRail({ items }: { items: SectionOverviewItem[] }) {
    return (
        <div data-ti-section-rail='true' className='grid min-w-0 gap-1.5 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-5'>
            {items.map(item => (
                <div key={item.label} className='min-w-0 rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] px-2.5 py-2 dark:border-[#273244] dark:bg-[#131c29]'>
                    <div className='flex flex-wrap items-center justify-between gap-1.5'>
                        <p className='min-w-0 wrap-break-word text-[11px] font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>{item.label}</p>
                        <span className={decisionStepStatusClass(item.state)}>{decisionStepStatusLabel(item.state)}</span>
                    </div>
                    <p className='mt-1 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{item.value}</p>
                </div>
            ))}
        </div>
    )
}

function StructuredProvenancePanel({ rows }: { rows: TiActorIntelligenceProfile['provenanceRows'] }) {
    return (
        <div className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Source provenance</p>
            <div className='mt-2 grid gap-2'>
                {rows.length ? rows.slice(0, 6).map(row => (
                    <div key={`${row.sourceName}-${row.provenance}`} className='rounded-lg border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{row.sourceName}</p>
                            <span className='shrink-0 text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{row.reportDate ? formatDate(row.reportDate) : row.captureId ? `capture ${row.captureId}` : `${Math.round((row.confidence ?? 0) * 100)}%`}</span>
                        </div>
                        <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{row.provenance}</p>
                        <p className='mt-1 text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{row.shownBecause}</p>
                    </div>
                )) : <p className='text-sm text-[#667085] dark:text-[#9aa8bd]'>No structured provenance rows returned.</p>}
            </div>
        </div>
    )
}

function DossierList({ title, values, artifactKind, artifactByLookup, selectedArtifactId, onSelectArtifact }: {
    title: string
    values: string[]
    artifactKind?: ActorArtifactKind
    artifactByLookup?: Map<string, ActorArtifact>
    selectedArtifactId?: string
    onSelectArtifact?: (artifactId: string) => void
}) {
    return (
        <div className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>{title}</p>
            <div className='mt-2 grid grid-cols-1 gap-1.5 sm:flex sm:flex-wrap'>
                {values.length ? values.slice(0, 8).map(value => {
                    const artifact = artifactKind ? artifactByLookup?.get(`${artifactKind}:${value.toLowerCase()}`) : undefined
                    if (!artifact || !onSelectArtifact) {
                        return <span key={value} className='w-full max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-xs font-semibold text-[#344054] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] sm:w-auto'>{value}</span>
                    }
                    const active = artifact.id === selectedArtifactId
                    return (
                        <button
                            key={value}
                            type='button'
                            onClick={() => onSelectArtifact(artifact.id)}
                            className={`w-full max-w-full wrap-break-word rounded-md border px-2 py-1 text-left text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#b8c5ff] sm:w-auto ${active ? 'border-[#3056d3] bg-[#eef3ff] text-[#3056d3] dark:border-[#9ab3ff] dark:bg-[#172646] dark:text-[#b8c8ff]' : 'border-[#dfe5ee] bg-white text-[#344054] hover:border-[#b8c5ff] hover:bg-[#f8fafc] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:border-[#4a68a8] dark:hover:bg-[#172131]'}`}
                        >
                            {value}
                        </button>
                    )
                }) : <span className='text-xs text-[#667085] dark:text-[#9aa8bd]'>Not returned</span>}
            </div>
        </div>
    )
}

function ArtifactNavigator({ artifacts, selectedArtifactId, onSelectArtifact }: { artifacts: ActorArtifact[]; selectedArtifactId?: string; onSelectArtifact: (artifactId: string) => void }) {
    function move(direction: 'next' | 'previous' | 'first' | 'last') {
        const next = nextActorArtifactId(artifacts, selectedArtifactId, direction)
        if (next) onSelectArtifact(next)
    }

    return (
        <section
            data-ti-artifact-nav='true'
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    event.preventDefault()
                    move('next')
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    event.preventDefault()
                    move('previous')
                } else if (event.key === 'Home') {
                    event.preventDefault()
                    move('first')
                } else if (event.key === 'End') {
                    event.preventDefault()
                    move('last')
                }
            }}
            className='rounded-lg border border-[#dfe5ee] bg-white p-3 focus:outline-none focus:ring-2 focus:ring-[#b8c5ff]'
        >
            <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
                <p className='text-xs font-semibold uppercase text-[#667085]'>Artifact queue</p>
                <p className='text-[11px] text-[#667085]'>Arrow keys, Home, and End move selection.</p>
            </div>
            <div className='flex gap-2 overflow-x-auto pb-1'>
                {artifacts.map(artifact => {
                    const active = artifact.id === selectedArtifactId
                    return (
                        <button
                            key={artifact.id}
                            type='button'
                            onClick={() => onSelectArtifact(artifact.id)}
                            className={`shrink-0 rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-[#b8c5ff] ${active ? 'border-[#3056d3] bg-[#eef3ff]' : 'border-[#dfe5ee] bg-[#fbfcfe] hover:bg-white'}`}
                        >
                            <span className='block text-xs font-semibold text-[#171a21]'>{artifact.label}</span>
                            <span className='mt-1 block text-[11px] text-[#667085]'>{formatLabel(artifact.kind)} · {artifact.readiness.label}</span>
                        </button>
                    )
                })}
            </div>
        </section>
    )
}

function ActorArtifactWorkbench({ artifact, handoffs }: { artifact: ActorArtifact; handoffs: ActorArtifactHandoffs }) {
    const bridge = handoffs.authBridge
    const payloadRows = [
        { id: 'watchlist', label: 'Watchlist package', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist], route: bridge.links.watchlist.href, blocked: handoffs.watchlist.blocked, detail: handoffs.watchlist.missing.length ? handoffs.watchlist.missing.join('; ') : `${artifact.watchlistTerms.length} artifact term${artifact.watchlistTerms.length === 1 ? '' : 's'}` },
        { id: 'alert', label: 'Alert rebuild', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild], route: bridge.links.alertRebuild.href, blocked: handoffs.alertRebuild.blocked, detail: handoffs.alertRebuild.missing.length ? handoffs.alertRebuild.missing.join('; ') : 'Ready to rebuild from this selected artifact.' },
        { id: 'case', label: 'Case package', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case], route: bridge.links.case.href, blocked: handoffs.case.blocked, detail: handoffs.case.missing.length ? handoffs.case.missing.join('; ') : 'Ready to open with this selected artifact.' },
        { id: 'enrichment', label: 'Enrichment item', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.enrichment], route: bridge.links.enrichment.href, blocked: handoffs.enrichment.blocked, detail: handoffs.enrichment.missing.length ? handoffs.enrichment.missing.join('; ') : `${artifact.enrichmentTasks.length} enrichment task${artifact.enrichmentTasks.length === 1 ? '' : 's'}` },
    ]

    return (
        <section data-ti-selected-artifact='true' className='rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#3056d3]'>Selected Intelligence</p>
                    <h2 className='mt-1 wrap-break-word text-xl font-semibold text-[#171a21]'>{artifact.label}</h2>
                    <p className='mt-1 text-sm leading-6 text-[#596170]'>{formatLabel(artifact.kind)} · {artifact.subtitle}</p>
                </div>
                <div className='grid w-full min-w-0 basis-full grid-cols-3 gap-2 text-center text-xs sm:min-w-72 lg:w-auto lg:basis-auto'>
                    <EvidenceMetric label='Freshness' value={formatDate(artifact.freshness)} />
                    <EvidenceMetric label='Confidence' value={`${Math.round(artifact.confidence * 100)}%`} />
                    <EvidenceMetric label='Readiness' value={artifact.readiness.label} />
                </div>
            </div>
            <div className='mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]'>
                <div className='grid gap-3 md:grid-cols-2'>
                    <EvidencePanel title='Evidence'>
                        {artifact.evidence.length ? artifact.evidence.slice(0, 6).map(line => <li key={line}>{line}</li>) : <li>No evidence text is attached to this artifact.</li>}
                    </EvidencePanel>
                    <EvidencePanel title='Provenance'>
                        {artifact.provenance.length ? artifact.provenance.slice(0, 6).map(line => <li key={line}>{line}</li>) : <li>Source provenance is missing for this artifact.</li>}
                    </EvidencePanel>
                    <EvidencePanel title='Watchlist relevance'>
                        {artifact.watchlistTerms.length ? artifact.watchlistTerms.map(term => <li key={`${term.kind}-${term.value}`}>{term.kind}: {term.value}. {term.notes}</li>) : <li>No customer watchlist term is attached to this artifact.</li>}
                    </EvidencePanel>
                    <EvidencePanel title='Enrichment gaps'>
                        {artifact.enrichmentTasks.length ? artifact.enrichmentTasks.map(task => <li key={task}>{task}</li>) : <li>No enrichment gap is attached to this artifact.</li>}
                    </EvidencePanel>
                </div>
                <div className='grid content-start gap-2'>
                    <div className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Console handoff</p>
                        <p className='mt-2 text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                            This view prepares links and payloads for organization-scoped review. Saving watchlists, rebuilding alerts, creating cases, and queueing enrichment require console access.
                        </p>
                        <div className='mt-2 flex flex-wrap gap-1.5'>
                            <span className={bridge.orgRequired ? 'rounded-md bg-[#fff4d6] px-2 py-1 text-[11px] font-semibold text-[#8a5a00]' : 'rounded-md bg-[#e9f8ef] px-2 py-1 text-[11px] font-semibold text-[#147a3b]'}>
                                {bridge.orgRequired ? 'org required' : 'org scoped'}
                            </span>
                            <span className={bridge.sourceRequired ? 'rounded-md bg-[#fff4d6] px-2 py-1 text-[11px] font-semibold text-[#8a5a00]' : 'rounded-md bg-[#e9f8ef] px-2 py-1 text-[11px] font-semibold text-[#147a3b]'}>
                                {bridge.sourceRequired ? 'source required' : 'source attached'}
                            </span>
                            <span className={bridge.stale ? 'rounded-md bg-[#fff1f0] px-2 py-1 text-[11px] font-semibold text-[#b42318]' : 'rounded-md bg-[#e9f8ef] px-2 py-1 text-[11px] font-semibold text-[#147a3b]'}>
                                {bridge.stale ? 'stale' : 'fresh enough'}
                            </span>
                        </div>
                        {bridge.missing.length ? (
                            <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-[#8a5a00]'>
                                {bridge.missing.slice(0, 4).map(item => <li key={item}>{item}</li>)}
                            </ul>
                        ) : null}
                    </div>
                    {payloadRows.map(row => (
                        <PayloadHandoffRow key={row.id} label={row.label} detail={row.detail} payload={row.payload} route={row.route} blocked={row.blocked} />
                    ))}
                    <CopyPayloadButton label='console handoff bundle' payload={bridge} />
                </div>
            </div>
        </section>
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
            provenance: item.publisherCount ? `${item.publisherCount} publisher${item.publisherCount === 1 ? '' : 's'}` : 'Activity result',
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
        source: 'TI search service',
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
            <div className='mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <WatchlistBlock title='Matched watchlists' values={watchlist.matchedTerms} />
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
        <Panel title='Evidence' description='Customer-facing alert ingredients derived from the selected finding and returned profile data. Delivery stays in the authenticated console.' icon={<BellRing className='h-4 w-4' />}>
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
    const decisionSteps = decisionStepsFor(actionability)

    return (
        <Panel title='Actions' description='Readiness for watchlists, alerts, cases, delivery, and source collection.' icon={<ShieldCheck className='h-4 w-4' />}>
            <div className='grid gap-3'>
                <DecisionFlow steps={decisionSteps} disposition={actionability.alertDisposition} shouldAlert={actionability.shouldAlert} rationale={actionability.rationale} />
                <ConsumerReadinessPanel actionability={actionability} />
                <ReadinessBlockersPanel actionability={actionability} />
                <ActionPayloadsPanel actionability={actionability} />

                <OrgRelevancePanel actionability={actionability} />

                <div className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Geography</p>
                    <div className='mt-2 grid gap-2'>
                        {actionability.geographyHandoffs.slice(0, 4).map(item => (
                            <div key={`${item.role}-${item.code}`} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{item.country}</p>
                                    <span className='shrink-0 text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{item.role === 'operator' ? 'attribution' : `${item.observationCount} observation${item.observationCount === 1 ? '' : 's'}`}</span>
                                </div>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{item.watchlistTerm ? `${item.watchlistTerm.kind}: ${item.watchlistTerm.value}` : item.enrichmentTask}</p>
                            </div>
                        ))}
                        {!actionability.geographyHandoffs.length ? <p className='text-xs text-[#667085] dark:text-[#9aa8bd]'>No country-level routing rows returned.</p> : null}
                    </div>
                </div>

                <div className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Sources</p>
                    <div className='mt-2 grid gap-2'>
                        {actionability.sourceClusters.slice(0, 4).map(item => (
                            <div key={`${item.sourceName}-${item.provenance}`} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{item.sourceName}</p>
                                    <span className={item.captureId ? 'shrink-0 text-[11px] text-[#147a3b]' : 'shrink-0 text-[11px] text-[#8a5a00]'}>{item.captureId ? 'capture attached' : 'capture needed'}</span>
                                </div>
                                <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{item.provenance}</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{item.watchlistTerm ? `${item.watchlistTerm.kind}: ${item.watchlistTerm.value}` : item.enrichmentTask}</p>
                            </div>
                        ))}
                        {!actionability.sourceClusters.length ? <p className='text-xs text-[#667085] dark:text-[#9aa8bd]'>No source provenance rows returned.</p> : null}
                    </div>
                </div>

                <div className='grid gap-2'>
                    <Link href='/dashboard/dwm' className='inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                        <ExternalLink className='h-3.5 w-3.5' />
                        Open console
                    </Link>
                    {casePath ? (
                        <a href={casePath} className='inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                            <ExternalLink className='h-3.5 w-3.5' />
                            Open related case
                        </a>
                    ) : (
                        <button type='button' disabled title={actionability.handoffs.caseBlockers.join('; ')} className='inline-flex min-h-9 cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-[#f2f4f7] px-3 py-2 text-xs font-semibold text-[#98a2b3] dark:border-[#314057] dark:bg-[#172131] dark:text-[#77869a]'>
                            <ClipboardList className='h-3.5 w-3.5' />
                            Create case
                        </button>
                    )}
                </div>

                {!casePath && actionability.handoffs.casePayload ? (
                    <PayloadHandoffRow
                        label='Case handoff'
                        detail={actionability.caseHandoff.blocked ? `Blocked until ${actionability.caseHandoff.missing.slice(0, 2).join('; ')}.` : 'Case request is prepared for authenticated review.'}
                        payload={actionability.exportPayloads.case.body}
                        route={actionability.caseHandoff.backedRoute}
                        blocked={actionability.caseHandoff.blocked}
                    />
                ) : null}

                <RelatedRecordsPanel actionability={actionability} query={query} />
            </div>
        </Panel>
    )
}

function RelatedRecordsPanel({ actionability, query }: { actionability: TiActionabilityModel; query: string }) {
    const records = [
        ...actionability.relatedAlerts.map(alert => ({
            id: `alert:${alert.id}`,
            label: alert.title || alert.id,
            meta: [alert.id, alert.status, alert.severity].filter(Boolean).join(' · '),
            route: alert.casePath || alert.recommendedRoute,
            kind: 'Alert',
        })),
        ...actionability.relatedCases.map(item => ({
            id: `case:${item.id}`,
            label: item.title || item.id,
            meta: [item.id, item.status, item.priority].filter(Boolean).join(' · '),
            route: item.path,
            kind: 'Case',
        })),
    ]

    return (
        <div className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Related alerts/cases</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {records.length} linked record{records.length === 1 ? '' : 's'} · {actionability.sourceProvenance.length} provenance row{actionability.sourceProvenance.length === 1 ? '' : 's'} · {actionability.webhookDeliveryHandoff.ready ? 'delivery ready' : 'delivery blocked'}
                    </p>
                </div>
                <CopyPayloadButton label='Related alerts and cases' payload={{ alerts: actionability.relatedAlerts, cases: actionability.relatedCases, blockers: actionability.readiness.blockers }} />
            </div>
            {records.length ? (
                <div className='mt-3 grid gap-2'>
                    {records.slice(0, 4).map(record => (
                        <div key={record.id} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{record.kind}: {record.label}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{record.meta}</p>
                                </div>
                                {record.route ? (
                                    <a href={record.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                                        <ExternalLink className='h-3.5 w-3.5' />
                                        Open
                                    </a>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className='mt-3 rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-3 dark:border-[#5a4316] dark:bg-[#231b0c]'>
                    <p className='text-xs font-semibold uppercase text-[#8a5a00]'>Blocked</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#8a5a00]'>No alert or case ID is attached to {query}; rebuild alerts after saving a matching watchlist term.</p>
                </div>
            )}
        </div>
    )
}

function OrgRelevancePanel({ actionability }: { actionability: TiActionabilityModel }) {
    const proof = actionability.orgRelevance
    const firstBlocker = proof.blockers[0]
    const affectedEntities = [
        ...proof.affectedEntities.vendors.slice(0, 3),
        ...proof.affectedEntities.domains.slice(0, 3),
        ...proof.affectedEntities.regions.slice(0, 3),
    ]
    return (
        <div data-ti-org-relevance='true' className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Watchlist relevance</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {proof.organizationRefs.length} organization match{proof.organizationRefs.length === 1 ? '' : 'es'} · {proof.candidateTerms.length} candidate term{proof.candidateTerms.length === 1 ? '' : 's'} · {proof.sourceEvidence.length} source row{proof.sourceEvidence.length === 1 ? '' : 's'} · {proof.freshness.stale ? 'refresh needed' : 'freshness accepted'}
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(proof.state)}>{decisionStepStatusLabel(proof.state)}</span>
                    <CopyPayloadButton label='Watchlist relevance' payload={proof} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Last seen' value={formatDate(proof.freshness.lastSeen)} />
                <EvidenceMetric label='Freshness' value={proof.freshness.stale ? proof.freshness.reason : 'Current enough for review'} />
            </div>
            {affectedEntities.length ? (
                <div className='mt-3 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Affected context</p>
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                        {affectedEntities.map(entity => (
                            <span key={`${entity.kind}-${entity.value}`} className={entity.matched ? 'max-w-full wrap-break-word rounded-md bg-[#e9f8ef] px-2 py-1 text-[11px] font-semibold text-[#147a3b]' : 'max-w-full wrap-break-word rounded-md bg-[#eef3ff] px-2 py-1 text-[11px] font-semibold text-[#3056d3]'}>
                                {entity.kind}: {entity.value}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}
            <div className='mt-3 grid gap-2'>
                {proof.candidateTerms.length ? proof.candidateTerms.slice(0, 4).map(term => (
                    <div key={`${term.kind}-${term.value}`} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                        <div className='flex flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{term.kind}: {term.value}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{term.notes || `${term.sourceEvidenceRefs.length} source reference${term.sourceEvidenceRefs.length === 1 ? '' : 's'} attached.`}</p>
                            </div>
                            <span className={term.matched ? decisionStepStatusClass('ready') : decisionStepStatusClass('review')}>{term.matched ? 'matched' : 'candidate'}</span>
                        </div>
                    </div>
                )) : (
                    <p className='rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-3 text-xs leading-5 text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c]'>No source-backed watchlist term is attached yet.</p>
                )}
            </div>
            {proof.handoffRows.length ? (
                <div className='mt-3 grid gap-2'>
                    {proof.handoffRows.slice(0, 6).map(row => {
                        const rowBlocker = row.blockers[0]
                        const evidenceMeta = [
                            row.evidence.sourceName,
                            row.evidence.reportDate ? formatDate(row.evidence.reportDate) : '',
                            typeof row.evidence.confidence === 'number' ? `${Math.round(row.evidence.confidence * 100)}% confidence` : '',
                            row.evidence.sourceId ? `source ${row.evidence.sourceId}` : '',
                            row.evidence.captureId ? `capture ${row.evidence.captureId}` : '',
                        ].filter(Boolean)
                        return (
                            <div key={row.rowId} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                                <div className='flex flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{row.label}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{row.action} · {formatLabel(row.sourceFamily)} · {readinessOwnerLabel(row.ownerLane)}</p>
                                        <p data-ti-org-row-evidence='true' className='mt-1 wrap-break-word text-[11px] leading-5 text-[#475467] dark:text-[#c3cee0]'>
                                            {evidenceMeta.length ? evidenceMeta.join(' · ') : 'Evidence metadata pending'} · {row.evidence.summary}
                                        </p>
                                        <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{row.route}</p>
                                        {row.alertId || row.watchlistItemId || row.captureIds.length ? (
                                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                                                {[row.alertId ? `alert ${row.alertId}` : '', row.watchlistItemId ? `watchlist item ${row.watchlistItemId}` : '', row.captureIds.length ? `${row.captureIds.length} capture${row.captureIds.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')}
                                            </p>
                                        ) : null}
                                        {rowBlocker ? <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{rowBlocker.handoff}</p> : null}
                                    </div>
                                    <span className={decisionStepStatusClass(row.state)}>{decisionStepStatusLabel(row.state)}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : null}
            {firstBlocker ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{readinessOwnerLabel(firstBlocker.ownerLane)}: {firstBlocker.handoff}</p>
            ) : null}
        </div>
    )
}

function ActionPayloadsPanel({ actionability }: { actionability: TiActionabilityModel }) {
    const payloads = [
        actionability.actionPayloads.payloads.watchlistAdd,
        actionability.actionPayloads.payloads.caseHandoff,
        actionability.actionPayloads.payloads.webhookDelivery,
        actionability.actionPayloads.payloads.analystHandoffBundle,
        actionability.actionPayloads.payloads.sourceEnrichment,
    ]

    return (
        <div data-public-ti-action-exports='true' className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Action exports</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>Validated request bodies for authenticated review. Copying does not change customer state.</p>
                </div>
                <CopyPayloadButton label='Action exports' payload={actionability.actionPayloads} />
            </div>
            <div className='mt-3 grid gap-2'>
                {payloads.map(payload => {
                    const primaryBlocker = payload.blockedBy[0]
                    return (
                        <div key={payload.kind} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{payload.label}</p>
                                        <span className={payload.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                            {payload.ready ? 'Ready' : 'Unavailable'}
                                        </span>
                                    </div>
                                    <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{payload.route}</p>
                                    {primaryBlocker ? (
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{readinessOwnerLabel(primaryBlocker.ownerLane)}: {primaryBlocker.handoff}</p>
                                    ) : (
                                        <p className='mt-1 text-[11px] leading-5 text-[#147a3b]'>Required IDs and provenance are present.</p>
                                    )}
                                </div>
                                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                    {payload.backedRoute ? (
                                        <a href={payload.backedRoute} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                                            <ExternalLink className='h-3.5 w-3.5' />
                                            Open
                                        </a>
                                    ) : null}
                                    <CopyPayloadButton label={payload.label} payload={payload} />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function ReadinessBlockersPanel({ actionability }: { actionability: TiActionabilityModel }) {
    const ids = actionability.readiness.backedIds
    const backedRows = [
        { label: 'Orgs', value: ids.organizationIds.length },
        { label: 'Watchlists', value: ids.watchlistItemIds.length || ids.watchlistIds.length },
        { label: 'Alerts', value: ids.alertIds.length },
        { label: 'Captures', value: ids.captureIds.length },
        { label: 'Destinations', value: ids.webhookDestinationIds.length },
    ]
    return (
        <div className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Readiness</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>Backed IDs, blockers, and next handoff owner for this result.</p>
                </div>
                <span className={actionability.readiness.state === 'ready' ? decisionStepStatusClass('ready') : actionability.readiness.state === 'blocked' ? decisionStepStatusClass('blocked') : decisionStepStatusClass('review')}>
                    {formatLabel(actionability.readiness.state)}
                </span>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3'>
                {backedRows.map(row => (
                    <div key={row.label} className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                        <p className='text-[11px] font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>{row.label}</p>
                        <p className='mt-1 text-sm font-semibold text-[#171a21] dark:text-[#eef4ff]'>{row.value}</p>
                    </div>
                ))}
            </div>
            {actionability.readiness.blockers.length ? (
                <div className='mt-3 grid gap-2'>
                    {actionability.readiness.blockers.slice(0, 5).map(blocker => (
                        <div key={`${blocker.code}-${blocker.field}`} className='rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-2 dark:border-[#5a4316] dark:bg-[#231b0c]'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#8a5a00]'>{readinessOwnerLabel(blocker.ownerLane)}</p>
                                <span className='shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#8a5a00] dark:bg-[#2b210e]'>{formatLabel(blocker.code)}</span>
                            </div>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-[#8a5a00]'>{blocker.detail}</p>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{blocker.handoff}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className='mt-3 text-xs leading-5 text-[#147a3b]'>No blocking readiness issues returned.</p>
            )}
        </div>
    )
}

function ConsumerReadinessPanel({ actionability }: { actionability: TiActionabilityModel }) {
    const readyStages = actionability.consumerReadiness.stages.filter(stage => stage.state === 'ready').length
    return (
        <div className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Handoff readiness</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {readyStages} of {actionability.consumerReadiness.stages.length} stages ready for console work.
                    </p>
                </div>
                <CopyPayloadButton label='Handoff readiness' payload={actionability.consumerReadiness.bundlePreview} />
            </div>
            <div className='mt-3 grid gap-2'>
                {actionability.consumerReadiness.stages.map(stage => (
                    <div key={stage.id} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                        <div className='flex flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{stage.label}</p>
                                    <span className={decisionStepStatusClass(stage.state)}>{decisionStepStatusLabel(stage.state)}</span>
                                </div>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{stage.detail}</p>
                                {stage.missing.length ? (
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{stage.missing.slice(0, 2).join('; ')}</p>
                                ) : null}
                            </div>
                            <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                {stage.route ? (
                                    <a href={stage.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                                        <ExternalLink className='h-3.5 w-3.5' />
                                        Open
                                    </a>
                                ) : null}
                                <CopyPayloadButton label={`${stage.label} request`} payload={stage.request ?? stage.payload} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

type DecisionStep = {
    id: string
    label: string
    status: 'ready' | 'review' | 'blocked'
    detail: string
    payload: unknown
    route?: string
    missing: string[]
}

function DecisionFlow({ steps, disposition, shouldAlert, rationale }: { steps: DecisionStep[]; disposition: TiActionabilityModel['alertDisposition']; shouldAlert: boolean; rationale: string }) {
    return (
        <div className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Decision flow</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{rationale}</p>
                </div>
                <span className={shouldAlert ? 'shrink-0 rounded-lg bg-[#e9f8ef] px-2 py-1 text-[11px] font-semibold text-[#147a3b]' : 'shrink-0 rounded-lg bg-[#fff4d6] px-2 py-1 text-[11px] font-semibold text-[#8a5a00]'}>
                    {formatLabel(disposition)}
                </span>
            </div>
            <div className='mt-3 grid gap-2'>
                {steps.map(step => (
                    <div key={step.id} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                        <div className='flex flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{step.label}</p>
                                    <span className={decisionStepStatusClass(step.status)}>{decisionStepStatusLabel(step.status)}</span>
                                </div>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{step.detail}</p>
                                {step.missing.length ? (
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{step.missing.slice(0, 2).join('; ')}</p>
                                ) : null}
                            </div>
                            <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                {step.route ? (
                                    <a href={step.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                                        <ExternalLink className='h-3.5 w-3.5' />
                                        Open
                                    </a>
                                ) : null}
                                <CopyPayloadButton label={step.label} payload={step.payload} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function decisionStepsFor(actionability: TiActionabilityModel): DecisionStep[] {
    const sourceGap = actionability.enrichmentGapQueue.find(gap => gap.sourceFamily === 'source_capture')
    const sourceMissing = sourceGap ? sourceGap.requestedFields : []
    const hasSourceProvenance = actionability.sourceProvenance.length > 0
    const sourceStatus: DecisionStep['status'] = !hasSourceProvenance ? 'blocked' : sourceMissing.length ? 'review' : 'ready'
    const enrichmentWorkCount = actionability.enrichmentGapQueue.length + actionability.sourceClusters.length
    return [
        {
            id: 'source-review',
            label: 'Review sources',
            status: sourceStatus,
            detail: hasSourceProvenance
                ? `${actionability.sourceProvenance.length} provenance row${actionability.sourceProvenance.length === 1 ? '' : 's'} returned; ${sourceMissing.length ? 'capture metadata still needed' : 'source basis is attached'}.`
                : 'No provenance row is attached to this actor result.',
            payload: actionability.exportPayloads.enrichment,
            route: sourceGap?.route ?? actionability.exportPayloads.enrichment.backedRoute,
            missing: sourceMissing,
        },
        {
            id: 'watchlist',
            label: 'Prepare watchlist',
            status: actionability.watchlistRelevance.blockers.length ? 'blocked' : actionability.watchlistRelevance.matches.length ? 'ready' : 'review',
            detail: actionability.watchlistRelevance.terms.length
                ? `${actionability.watchlistRelevance.terms.length} candidate term${actionability.watchlistRelevance.terms.length === 1 ? '' : 's'}; ${actionability.watchlistRelevance.matches.length} org match${actionability.watchlistRelevance.matches.length === 1 ? '' : 'es'} returned.`
                : 'No watchlist term is attached to this result.',
            payload: actionability.exportPayloads.watchlist,
            route: actionability.exportPayloads.watchlist.backedRoute,
            missing: actionability.watchlistRelevance.blockers,
        },
        {
            id: 'alert-rebuild',
            label: 'Rebuild alerts',
            status: actionability.createAlertHandoff.blocked ? 'blocked' : 'ready',
            detail: actionability.createAlertHandoff.blocked ? 'Alert rebuild needs watchlist or org context.' : 'Ready to rebuild from matched watchlist terms.',
            payload: actionability.createAlertHandoff,
            route: actionability.createAlertHandoff.backedRoute,
            missing: actionability.createAlertHandoff.missing,
        },
        {
            id: 'case',
            label: 'Open case',
            status: actionability.caseHandoff.blocked ? 'blocked' : 'ready',
            detail: actionability.caseHandoff.blocked ? 'Case creation needs an alert ID and org-scoped context.' : 'Ready to open from related alert context.',
            payload: actionability.caseHandoff,
            route: actionability.caseHandoff.backedRoute,
            missing: actionability.caseHandoff.missing,
        },
        {
            id: 'webhook-delivery',
            label: 'Deliver webhook',
            status: actionability.webhookDeliveryHandoff.blocked ? 'blocked' : 'ready',
            detail: actionability.webhookDeliveryHandoff.blocked ? 'Delivery needs alert, capture, and destination context.' : 'Dry-run delivery can be prepared from alert and destination context.',
            payload: actionability.webhookDeliveryHandoff,
            route: actionability.webhookDeliveryHandoff.backedRoute,
            missing: actionability.webhookDeliveryHandoff.missing,
        },
        {
            id: 'enrichment',
            label: 'Queue enrichment',
            status: actionability.exportPayloads.enrichment.blocked ? 'blocked' : enrichmentWorkCount ? 'review' : 'ready',
            detail: `${enrichmentWorkCount} source or enrichment work item${enrichmentWorkCount === 1 ? '' : 's'} available.`,
            payload: actionability.exportPayloads.enrichment,
            route: actionability.exportPayloads.enrichment.backedRoute,
            missing: actionability.exportPayloads.enrichment.missing,
        },
    ]
}

function PayloadHandoffRow({ label, detail, payload, route, blocked }: { label: string; detail: string; payload: unknown; route?: string; blocked: boolean }) {
    return (
        <div className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{label}</p>
                        <span className={blocked ? 'rounded-md bg-[#fff4d6] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a5a00]' : 'rounded-md bg-[#e9f8ef] px-1.5 py-0.5 text-[10px] font-semibold text-[#147a3b]'}>
                            {blocked ? 'blocked' : 'ready'}
                        </span>
                    </div>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{detail}</p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    {route ? (
                        <a href={route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                            <ExternalLink className='h-3.5 w-3.5' />
                            Open
                        </a>
                    ) : null}
                    <CopyPayloadButton label={label} payload={payload} />
                </div>
            </div>
        </div>
    )
}

function CopyPayloadButton({ label, payload }: { label: string; payload: unknown }) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

    async function copyPayload() {
        const text = JSON.stringify(payload, null, 2)
        try {
            await navigator.clipboard.writeText(text)
            setState('copied')
            window.setTimeout(() => setState('idle'), 1800)
        } catch {
            setState('failed')
            window.setTimeout(() => setState('idle'), 2200)
        }
    }

    return (
        <button type='button' onClick={copyPayload} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]' aria-label={`Copy ${label} payload`}>
            {state === 'copied' ? <CheckCircle2 className='h-3.5 w-3.5 text-[#147a3b]' /> : <Copy className='h-3.5 w-3.5' />}
            {state === 'copied' ? 'Copied' : state === 'failed' ? 'Unavailable' : 'Copy'}
        </button>
    )
}

function EnrichmentTasksPanel({ tasks }: { tasks: EnrichmentTask[] }) {
    return (
        <Panel title='Collection Gaps' description='Source, capture, and data work required before this result can support stronger alerts.' icon={<Database className='h-4 w-4' />}>
            <div className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2'>
                {tasks.map(task => (
                    <div key={task.title} className='min-w-0 max-w-full overflow-hidden rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <div className='flex flex-wrap items-start justify-between gap-2'>
                            <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{task.title}</p>
                            <span className={`${taskStatusClass(task.status)} shrink-0 whitespace-nowrap`}>{taskStatusLabel(task.status)}</span>
                        </div>
                        <p className='mt-2 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{task.detail}</p>
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
        <Panel title='Session Notes' description='These controls are local to this browser session. Use them for scratch triage only; persisted ownership, delivery, and audit history live in the authenticated console.' icon={<ClipboardList className='h-4 w-4' />}>
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
        <button type='button' onClick={onClick} className='inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
            {icon}
            {children}
        </button>
    )
}

function EvidencePanel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>{title}</p>
            <ul className='mt-2 grid list-disc gap-1 pl-4 text-sm leading-6 text-[#596170] dark:text-[#b7c2d4]'>
                {children}
            </ul>
        </div>
    )
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-[#171a21] dark:text-[#eef4ff]'>{value || 'Not stated'}</p>
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

function sectionOverviewFor(input: {
    result: TiSearchResponse
    actorIntel: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    workItems: AnalystWorkItem[]
    victimObservations: ReturnType<typeof victimObservationsFor>
    watchlist: WatchlistRelevance
}): SectionOverviewItem[] {
    const relatedRecords = input.actionability.relatedAlerts.length + input.actionability.relatedCases.length
    const readyActions = Object.values(input.actionability.actionPayloads.payloads).filter(payload => payload.ready).length
    const sourceRows = input.actorIntel.provenanceRows.length || input.actionability.sourceProvenance.length || input.result.sources.length
    return [
        { label: 'Overview', value: `${Math.round(input.actorIntel.confidence * 100)}% confidence`, state: input.actorIntel.provenanceRows.length ? 'ready' : 'blocked' },
        { label: 'Activity', value: `${input.workItems.length} item${input.workItems.length === 1 ? '' : 's'}`, state: input.workItems.length ? 'ready' : 'review' },
        { label: 'Targeting', value: `${input.victimObservations.length || input.actorIntel.targetSectors.length} row${(input.victimObservations.length || input.actorIntel.targetSectors.length) === 1 ? '' : 's'}`, state: input.victimObservations.length || input.actorIntel.targetSectors.length ? 'ready' : 'review' },
        { label: 'Infrastructure', value: `${input.actorIntel.infrastructure.length} pattern${input.actorIntel.infrastructure.length === 1 ? '' : 's'}`, state: input.actorIntel.infrastructure.length ? 'ready' : 'review' },
        { label: 'Sources', value: `${sourceRows} provenance row${sourceRows === 1 ? '' : 's'}`, state: sourceRows ? 'ready' : 'blocked' },
        { label: 'Evidence', value: `${input.workItems.filter(item => item.evidence.length).length} supported`, state: input.workItems.some(item => item.evidence.length) ? 'ready' : 'blocked' },
        { label: 'Watchlist relevance', value: input.actionability.orgRelevance.organizationRefs.length ? `${input.actionability.orgRelevance.organizationRefs.length} matched` : `${input.actionability.orgRelevance.candidateTerms.length} candidate${input.actionability.orgRelevance.candidateTerms.length === 1 ? '' : 's'}`, state: input.actionability.orgRelevance.state },
        { label: 'Related alerts/cases', value: `${relatedRecords} linked`, state: relatedRecords ? 'ready' : 'blocked' },
        { label: 'Collection gaps', value: `${input.actionability.enrichmentGapQueue.length} open`, state: input.actionability.enrichmentGapQueue.length ? 'review' : 'ready' },
        { label: 'Actions', value: `${readyActions}/5 ready`, state: readyActions === 5 ? 'ready' : readyActions ? 'review' : 'blocked' },
    ]
}

function watchlistRelevanceFor(result: TiSearchResponse, victimObservations: ReturnType<typeof victimObservationsFor>, sources: TiSearchResponse['sources'], actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel): WatchlistRelevance {
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
    const matchedTerms = actionability.watchlistRelevance.terms.filter(term => term.matched).map(term => `${term.kind}: ${term.value}`)

    return {
        terms,
        matchedTerms,
        organizations,
        sectors,
        countries,
        domains,
        rationale: matchedTerms.length
            ? `${matchedTerms.length} organization watchlist match${matchedTerms.length === 1 ? '' : 'es'} returned for this query.`
            : organizations.length
                ? 'Candidate watchlist inputs are present; no persisted organization watchlist match was returned yet.'
                : 'Candidate actor, alias, sector, country, campaign, tool, and source-domain terms are present only when returned by the profile or source rows.',
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
    const actionabilityTasks: EnrichmentTask[] = actionability.enrichmentGapQueue.map(gap => ({
        title: gap.title,
        status: gap.severity === 'high' ? 'needs_api' : 'needs_review',
        detail: `${gap.detail} Route: ${gap.route}. Source family: ${formatLabel(gap.sourceFamily)}. Required fields: ${gap.requestedFields.join(', ')}. Dependency: ${gap.dependency}.`,
    }))
    return [
        ...actionabilityTasks,
        {
            title: 'Complete actor enrichment profile',
            status: hasActorCore ? 'ready' : 'needs_api',
            detail: hasActorCore
                ? `Actor profile includes ${actor.malwareTools.length} tools, ${actor.campaigns.length} campaigns, and ${actor.infrastructure.length} infrastructure patterns for alert enrichment.`
                : 'Missing tooling, campaigns, infrastructure, confidence reasoning, or source provenance from actor enrichment.',
        },
        {
            title: 'Persist alert review decision',
            status: 'needs_api',
            detail: 'Scratch notes are session-local. Persisted review needs selected finding ID, review state, owner, rationale, and delivery hold/release state in the authenticated case workflow.',
        },
        {
            title: 'Attach source capture provenance',
            status: hasSourceUrls ? 'ready' : 'needs_api',
            detail: hasSourceUrls
                ? 'Returned sources include URL/provenance references that can be opened or mapped into console evidence.'
                : 'The result needs source URLs, capture IDs, or redacted source hashes for every queue item before analyst trust is strong.',
        },
        {
            title: 'Map actor to customer watchlists',
            status: hasOrganizations ? 'watch' : 'needs_api',
            detail: hasOrganizations
                ? `Candidate watched objects include ${watchlist.organizations.slice(0, 3).join(', ')}.`
                : 'No persisted organization/domain relevance was returned for this public result.',
        },
        {
            title: 'Promote evidence to case queue',
            status: hasReviewInbox ? 'ready' : selected?.kind === 'exposure' || hasActivity ? 'needs_review' : 'needs_api',
            detail: hasReviewInbox
                ? 'The response includes metadata review inbox items that can feed authenticated case work.'
                : 'No stable related case id is attached; this page can export a handoff payload but cannot persist the case from public context.',
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
    if (status === 'needs_api') return 'source gap'
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

function decisionStepStatusLabel(status: DecisionStep['status']) {
    if (status === 'ready') return 'ready'
    if (status === 'review') return 'review'
    return 'blocked'
}

function decisionStepStatusClass(status: DecisionStep['status']) {
    if (status === 'ready') return 'shrink-0 rounded-md bg-[#e9f8ef] px-1.5 py-0.5 text-[10px] font-semibold text-[#147a3b]'
    if (status === 'review') return 'shrink-0 rounded-md bg-[#fff4d6] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a5a00]'
    return 'shrink-0 rounded-md bg-[#fff1f0] px-1.5 py-0.5 text-[10px] font-semibold text-[#b42318]'
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

function readinessOwnerLabel(owner: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']) {
    if (owner === 'public-ti') return 'Public TI'
    if (owner === 'org') return 'Organization'
    if (owner === 'alert') return 'Alert workflow'
    if (owner === 'case') return 'Case workflow'
    if (owner === 'webhook') return 'Webhook delivery'
    if (owner === 'entitlement') return 'Entitlement'
    return 'Source collection'
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
        <section className='border border-[#dfe5ee] bg-white p-4 dark:border-[#263244] dark:bg-[#101722]'>
            <div className='mb-2 flex items-center gap-2 text-sm font-semibold text-[#171a21] dark:text-[#eef4ff]'>
                <span className='text-[#3056d3] dark:text-[#9ab3ff]'>{icon}</span>
                <span>{title}</span>
                {description ? <InfoTip label={description} /> : null}
            </div>
            {children}
        </section>
    )
}

function CoverageStrategyPanel({ sources }: { sources: NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture'] }) {
    return (
        <Panel title='Source Coverage' description='How the result is assembled: public indexes can seed coverage, direct monitored pages provide freshness, and advisories add vulnerability context.' icon={<Database className='h-4 w-4' />}>
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
        <Panel title='Source Records' description='Named sources used for this result. Public visitors see a limited set; customer console access can show additional source links and internal capture details.' icon={<ExternalLink className='h-4 w-4' />}>
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
        <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs ${dark ? 'border-[#263244] bg-[#101722] text-[#d8deea]' : 'border-[#dfe5ee] bg-[#f8fafc] text-[#667085]'}`}>
            <span className={dark ? 'text-[#b8c5ff]' : 'text-[#3056d3]'}>{icon}</span>
            <span>{label}</span>
            <span className={`truncate font-semibold ${dark ? 'text-white' : 'text-[#171a21]'}`}>{value}</span>
        </span>
    )
}

function ThreatActorMap({ result, actionability, onSelectCountry }: { result: TiSearchResponse; actionability: TiActionabilityModel; onSelectCountry?: (country: string) => void }) {
    const geo = actorGeoProfile(result)
    const hasPoints = geo.points.length > 0
    const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEWBOX)
    const [selectedCode, setSelectedCode] = useState(geo.points[0]?.code ?? '')
    const dragRef = useRef<{ x: number, y: number, viewBox: ViewBox } | null>(null)
    const pointByCode = useMemo(() => new Map(geo.points.map(point => [point.code, point])), [geo.points])
    const selectedPoint = geo.points.find(point => point.code === selectedCode) ?? geo.points[0]
    const focusCountry = useCallback((code: string) => {
        const coords = countryCentroids[code]
        setSelectedCode(code)
        const point = geo.points.find(item => item.code === code)
        if (point) onSelectCountry?.(point.label)
        if (coords) setViewBox(getCountryFocusView(coords))
    }, [geo.points, onSelectCountry])
    const mapPaths = useMemo(() => mapData.features.map((feature, index) => {
        let d = ''
        const code = countryCodeForMapFeature(feature.properties?.name)
        const point = code ? pointByCode.get(code) : undefined
        const active = Boolean(point && selectedPoint?.code === point.code)
        const fillClass = point
            ? point.role === 'operator'
                ? active ? 'fill-[#6d28d9]' : 'fill-[#8b5cf6]'
                : active ? 'fill-[#b42318]' : 'fill-[#f04438]'
            : 'fill-[#e9eff7]'
        const strokeClass = point ? 'stroke-white stroke-[0.9]' : 'stroke-[#c9d5e6] stroke-[0.55]'

        function drawRing(ring: number[][]) {
            return ring.reduce((path, point, pointIndex) => {
                const [x, y] = project([point[1], point[0]])
                return `${path}${pointIndex === 0 ? 'M' : 'L'} ${x} ${y} `
            }, '') + 'Z '
        }

        if (feature.geometry.type === 'Polygon') {
            ;(feature.geometry.coordinates as number[][][]).forEach((ring) => {
                d += drawRing(ring)
            })
        } else if (feature.geometry.type === 'MultiPolygon') {
            ;(feature.geometry.coordinates as number[][][][]).forEach((polygon) => {
                polygon.forEach((ring) => {
                    d += drawRing(ring)
                })
            })
        }

        return (
            <path
                key={`${feature.properties?.name || 'country'}-${index}`}
                d={d}
                role={point ? 'button' : undefined}
                tabIndex={point ? 0 : undefined}
                aria-label={point ? `${point.label}: ${point.role === 'operator' ? 'reported operator origin' : 'reported victim or target country'}` : undefined}
                onClick={point ? () => focusCountry(point.code) : undefined}
                onKeyDown={point ? (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    focusCountry(point.code)
                } : undefined}
                className={`${fillClass} ${strokeClass} transition-colors ${point ? 'cursor-pointer hover:brightness-105 focus:outline-none' : 'hover:fill-[#dce7f5]'}`}
                opacity={point ? active ? '0.92' : '0.68' : '1'}
            />
        )
    }), [focusCountry, pointByCode, selectedPoint?.code])

    useEffect(() => {
        if (!geo.points.length) return
        if (!geo.points.some(point => point.code === selectedCode)) {
            setSelectedCode(geo.points[0]?.code ?? '')
        }
    }, [geo.points, selectedCode])

    return (
        <div className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-[#f8fafc]'>
            <div className='flex items-center justify-between gap-3 border-b border-[#e8edf5] px-4 py-3'>
                <div>
                    <h2 className='text-sm font-semibold text-[#171a21]'>Country-Level Actor Map</h2>
                    <p className='mt-0.5 text-xs text-[#667085]'>GeoJSON-backed country view of reported operator origin and countries with victim or targeting observations.</p>
                </div>
                <span className='rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#3056d3]'>{hasPoints ? `${geo.points.length} countries` : 'Country data pending'}</span>
            </div>
            <div className='relative min-h-96 overflow-hidden bg-[#f7f9fc]'>
                <div className='absolute left-3 top-3 z-20 rounded-lg border border-[#dfe5ee] bg-white/90 px-3 py-1.5 text-xs text-[#596170] shadow-sm backdrop-blur'>
                    <span className='inline-flex items-center gap-2'>
                        <Move className='h-3.5 w-3.5' />
                        Drag to pan · wheel to zoom
                    </span>
                </div>
                <div className='absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-lg border border-[#dfe5ee] bg-white/90 p-1 shadow-sm backdrop-blur'>
                    <MapZoomButton label='−' onClick={() => setViewBox((current) => zoomViewBox(current, 1.18, MAP_WIDTH / 2, MAP_HEIGHT / 2))} />
                    <MapZoomButton label='Reset' wide onClick={() => setViewBox(INITIAL_VIEWBOX)} />
                    <MapZoomButton label='+' onClick={() => setViewBox((current) => zoomViewBox(current, 0.84, MAP_WIDTH / 2, MAP_HEIGHT / 2))} />
                </div>
                <svg
                    viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                    role='img'
                    aria-label={`Country-level actor map for ${humanizeSlug(result.query)}`}
                    className='relative z-10 h-96 w-full cursor-grab bg-white active:cursor-grabbing'
                    onMouseDown={(event) => {
                        dragRef.current = { x: event.clientX, y: event.clientY, viewBox }
                    }}
                    onMouseMove={(event) => {
                        if (!dragRef.current) return
                        const scaleX = dragRef.current.viewBox.width / MAP_WIDTH
                        const scaleY = dragRef.current.viewBox.height / MAP_HEIGHT
                        setViewBox(clampViewBox({
                            ...dragRef.current.viewBox,
                            x: dragRef.current.viewBox.x - ((event.clientX - dragRef.current.x) * scaleX),
                            y: dragRef.current.viewBox.y - ((event.clientY - dragRef.current.y) * scaleY),
                        }))
                    }}
                    onMouseUp={() => { dragRef.current = null }}
                    onMouseLeave={() => { dragRef.current = null }}
                    onWheel={(event) => {
                        event.preventDefault()
                        const rect = event.currentTarget.getBoundingClientRect()
                        const px = ((event.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x
                        const py = ((event.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y
                        setViewBox((current) => zoomViewBox(current, event.deltaY > 0 ? 1.12 : 0.88, px, py))
                    }}
                >
                    <rect x='0' y='0' width={MAP_WIDTH} height={MAP_HEIGHT} fill='#ffffff' />
                    <g className='opacity-95'>{mapPaths}</g>
                    {geo.flows.map(flow => {
                        const from = countryCentroids[flow.from.code]
                        const to = countryCentroids[flow.to.code]
                        if (!from || !to) return null
                        const [x1, y1] = project(from)
                        const [x2, y2] = project(to)
                        const dx = x2 - x1
                        const dy = y2 - y1
                        const distance = Math.sqrt((dx * dx) + (dy * dy))
                        const cx = (x1 + x2) / 2
                        const cy = (y1 + y2) / 2 - (distance * 0.22)
                        return (
                            <path
                                key={`${flow.from.code}-${flow.to.code}`}
                                d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                                fill='none'
                                stroke='#d92d20'
                                strokeDasharray='5 5'
                                strokeWidth='1.8'
                                opacity='0.45'
                            />
                        )
                    })}
                    {geo.points.map(point => {
                        const coords = countryCentroids[point.code]
                        if (!coords) return null
                        const [x, y] = project(coords)
                        const active = selectedPoint?.code === point.code
                        const color = point.role === 'operator' ? '#7c3aed' : '#d92d20'
                        const radius = point.role === 'operator' ? 5 : 4 + Math.min(5, point.count * 1.5)
                        return (
                            <g key={`${point.role}-${point.code}`} onClick={() => focusCountry(point.code)} className='cursor-pointer'>
                                <circle cx={x} cy={y} r={radius + 9} fill={color} opacity={active ? '0.16' : '0.08'} />
                                <circle cx={x} cy={y} r={radius} fill={color} opacity='0.92' stroke='#ffffff' strokeWidth='1.5' />
                                <circle cx={x} cy={y} r='2' fill='#ffffff' />
                                <text
                                    x={x}
                                    y={y - radius - 7}
                                    textAnchor='middle'
                                    className='fill-[#171a21] text-[10px] font-bold'
                                    stroke='#ffffff'
                                    strokeWidth='3'
                                    paintOrder='stroke'
                                >
                                    {point.code}
                                </text>
                            </g>
                        )
                    })}
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
                            <MapPointActionRow
                                key={`${point.role}-row-${point.code}`}
                                point={point}
                                active={selectedPoint?.code === point.code}
                                handoff={actionability.geographyHandoffs.find(item => item.code === point.code && item.role === point.role) ?? actionability.geographyHandoffs.find(item => item.code === point.code)}
                                onFocus={() => focusCountry(point.code)}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function countryCodeForMapFeature(name: string | undefined) {
    if (!name) return null
    const normalized = name.trim().toLowerCase()
    const mapped = mapFeatureNameToCode[normalized]
    if (mapped) return mapped
    const country = countryFromValue(normalized)
    return country?.code ?? null
}

const mapFeatureNameToCode: Record<string, string> = {
    england: 'GB',
    russia: 'RU',
    usa: 'US',
}

function MapPointActionRow({ point, active, handoff, onFocus }: { point: ReturnType<typeof actorGeoProfile>['points'][number]; active: boolean; handoff?: TiActionabilityModel['geographyHandoffs'][number]; onFocus: () => void }) {
    return (
        <button
            type='button'
            onClick={onFocus}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-[#b8c5ff] ${active ? 'border-[#3056d3] bg-[#eef3ff]' : 'border-[#eef1f5] bg-[#fbfcfe] hover:border-[#d8dee9] hover:bg-white'}`}
        >
            <div className='flex items-center justify-between gap-3'>
                <span className='font-semibold text-[#171a21]'>{point.label}</span>
                <span className={point.role === 'operator' ? 'text-[#7c3aed]' : 'text-[#b42318]'}>{point.role === 'operator' ? 'operator origin' : `${point.count} observation${point.count === 1 ? '' : 's'}`}</span>
            </div>
            <p className='mt-1 leading-5 text-[#667085]'>{point.detail}</p>
            {handoff ? (
                <div className='mt-2 rounded-md border border-[#dfe5ee] bg-white px-2 py-1.5'>
                    <p className='font-semibold text-[#344054]'>{handoff.watchlistTerm ? `${handoff.watchlistTerm.kind}: ${handoff.watchlistTerm.value}` : 'Enrichment task'}</p>
                    <p className='mt-1 leading-5 text-[#667085]'>{handoff.watchlistTerm?.reason ?? handoff.enrichmentTask}</p>
                </div>
            ) : null}
        </button>
    )
}

function MapZoomButton({ label, onClick, wide = false }: { label: string; onClick: () => void; wide?: boolean }) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`rounded-md border border-[#d8dee9] bg-white px-2.5 py-1 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#b8c5ff] ${wide ? 'min-w-16' : 'min-w-8'}`}
        >
            {label}
        </button>
    )
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
