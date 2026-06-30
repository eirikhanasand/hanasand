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
        document.body.dataset.publicTiRoute = 'true'
        return () => {
            delete document.body.dataset.publicTiRoute
        }
    }, [])

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
    const victimObservations = useMemo(() => victimObservationsFor(result), [result])
    const actorIntel = useMemo(() => buildActorIntelligence(result, victimObservations), [result, victimObservations])
    const actionability = useMemo(() => buildTiActionability(result, actorIntel, victimObservations), [result, actorIntel, victimObservations])
    const actorArtifacts = useMemo(() => buildActorArtifacts(result, actorIntel, victimObservations, actionability), [result, actorIntel, victimObservations, actionability])
    const workItems = useMemo(() => analystWorkItemsFor(result, victimObservations, sourceUrlById, actionability), [result, victimObservations, sourceUrlById, actionability])
    const watchlist = useMemo(() => watchlistRelevanceFor(result, victimObservations, sources, actorIntel, actionability), [result, victimObservations, sources, actorIntel, actionability])
    const [selectedId, setSelectedId] = useState(workItems[0]?.id ?? '')
    const [selectedArtifactId, setSelectedArtifactId] = useState(actorArtifacts[0]?.id ?? '')
    const [localDecisions, setLocalDecisions] = useState<Record<string, LocalDecision>>({})
    const [relevanceMarks, setRelevanceMarks] = useState<Record<string, LocalRelevanceMark>>({})
    const [stagedHandoffs, setStagedHandoffs] = useState<Record<string, StagedHandoff>>({})
    const [notes, setNotes] = useState<Record<string, string>>({})
    const selected = workItems.find(item => item.id === selectedId) ?? workItems[0]
    const selectedArtifact = actorArtifacts.find(item => item.id === selectedArtifactId) ?? actorArtifacts[0]
    const selectedArtifactHandoffs = selectedArtifact ? buildActorArtifactHandoffs(result, selectedArtifact, actionability) : null
    const selectedDecision = selected ? localDecisions[selected.id] : undefined
    const selectedRelevance = selected ? relevanceMarks[selected.id] : undefined
    const selectedNote = selected ? notes[selected.id] ?? '' : ''
    const alertPacket = selected ? alertPacketFor(result, selected, watchlist) : null
    const reviewHandoff = selected && alertPacket ? selectedReviewHandoffFor(result, selected, watchlist, alertPacket, actionability, selectedDecision, selectedRelevance, selectedNote) : null
    const selectedSourceDrilldown = selected ? selectedSourceDrilldownFor(result, selected, actionability, actorIntel) : null
    const selectedCaseDraft = selected && alertPacket && selectedSourceDrilldown ? selectedCaseDraftFor(result, selected, watchlist, alertPacket, actionability, selectedSourceDrilldown, selectedRelevance, selectedNote) : null
    const selectedCaseActionTrail = selected ? selectedCaseActionTrailFor(result, selected, actionability, reviewHandoff, selectedCaseDraft, selectedDecision, selectedRelevance, selectedNote) : null
    const selectedWatchlistPlan = selected ? selectedWatchlistPlanFor(result, selected, actionability, watchlist, selectedRelevance) : null
    const selectedAlertPlan = selected ? selectedAlertActionPlanFor(result, selected, actionability, watchlist, selectedCaseDraft, selectedRelevance) : null
    const selectedEnrichmentTriage = selected ? selectedEnrichmentTriageFor(result, selected, actionability, selectedSourceDrilldown) : null
    const selectedCaseOwnership = selected ? selectedCaseOwnershipFor(result, selected, actionability, selectedCaseDraft, selectedCaseActionTrail) : null
    const selectedCaseCreateRequest = selected ? selectedCaseCreateRequestFor(result, selected, actionability, selectedCaseDraft, selectedCaseOwnership, selectedSourceDrilldown) : null
    const selectedDeliveryPlan = selected ? selectedDeliveryReadinessPlanFor(result, selected, actionability, selectedAlertPlan, selectedCaseOwnership) : null
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
    const relevanceEvents = Object.entries(relevanceMarks).map(([id, mark]) => {
        const item = workItems.find(entry => entry.id === id)
        return {
            id: `${id}-${mark.markedAt}`,
            at: mark.markedAt ?? result.generatedAt,
            label: `${relevanceLabel(mark.state)}${item ? `: ${item.title}` : ''}`,
            detail: mark.rationale || 'No relevance rationale recorded.',
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

    function stageSelectedHandoff() {
        if (!selected || !reviewHandoff || !selectedSourceDrilldown || !selectedCaseDraft) return
        const staged = stagedHandoffFor(result, selected, reviewHandoff, selectedSourceDrilldown, selectedCaseDraft, selectedRelevance)
        setStagedHandoffs(current => ({ ...current, [staged.id]: staged }))
    }

    return (
        <div className='grid gap-6'>
            <section data-ti-workspace='true' className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-sm'>
                <div className='grid gap-3 border-b border-[#e8edf5] bg-white p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                    <div className='min-w-0'>
                        <div className='flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center'>
                            <h1 className='min-w-0 max-w-full wrap-break-word text-2xl font-semibold text-[#171a21] md:text-3xl'>{humanizeSlug(result.query)}</h1>
                            {result.status ? (
                                <span className='max-w-full wrap-break-word rounded-lg border border-[#b8c5ff] bg-[#eef3ff] px-2 py-1 text-xs font-semibold uppercase leading-5 text-[#3056d3]'>
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
                        <div className='p-2 lg:max-h-[40rem] lg:overflow-y-auto'>
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
                                            {item.priority ? <span>{item.priority.score}/100 priority</span> : null}
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
                                    actionability={actionability}
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

                                    {selected.priority ? <EvidencePriorityPanel priority={selected.priority} /> : null}
                                    {selectedSourceDrilldown ? <SelectedSourceDrilldownPanel drilldown={selectedSourceDrilldown} /> : null}

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

                                <section className='grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
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
                        <EnrichmentTasksPanel tasks={enrichmentTasks} intake={actionability.sourceEnrichmentIntake} />
                        <SourceHealthPanel queue={actionability.sourceHealthQueue} intake={actionability.sourceEnrichmentIntake} coverage={actionability.actorEnrichmentCoverage} consumerReadiness={actionability.actorEnrichmentConsumerReadiness} payload={actionability.exportPayloads.enrichment} />

                        <div data-ti-actions='true'>
                            <ActionPanel
                                note={selectedNote}
                                decision={selectedDecision}
                                relevance={selectedRelevance}
                                reviewHandoff={reviewHandoff}
                                caseDraft={selectedCaseDraft}
                                caseActionTrail={selectedCaseActionTrail}
                                caseOwnership={selectedCaseOwnership}
                                caseCreateRequest={selectedCaseCreateRequest}
                                watchlistPlan={selectedWatchlistPlan}
                                alertPlan={selectedAlertPlan}
                                deliveryPlan={selectedDeliveryPlan}
                                enrichmentTriage={selectedEnrichmentTriage}
                                onNoteChange={value => selected && setNotes(current => ({ ...current, [selected.id]: value }))}
                                onDecision={applyDecision}
                                onRelevance={state => selected && setRelevanceMarks(current => ({ ...current, [selected.id]: relevanceMarkFor(state, selected, watchlist, actionability, selectedNote) }))}
                                onStage={stageSelectedHandoff}
                            />
                        </div>
                        <StagedHandoffQueuePanel
                            items={Object.values(stagedHandoffs)}
                            onClear={() => setStagedHandoffs({})}
                        />

                        <Panel title='Evidence Timeline' description='Evidence timestamps plus analyst decisions made in this browser session.' icon={<Clock3 className='h-4 w-4' />}>
                            <div className='grid gap-3'>
                                {[...timelineFor(result, selected), ...sessionEvents, ...relevanceEvents].slice(0, 8).map(event => (
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
                        {result.analystLoop?.sourceActivationWorkflow.required ? <SourceActivationPanel activation={result.analystLoop.sourceActivationWorkflow} /> : null}
                    </aside>
                </div>
            </section>

            <section className='grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
                <Panel title='Watchlist Relevance' description='Company, domain, vendor, brand, product, or portfolio matches from actor claims, leak posts, advisories, or monitored pages.' icon={<Building2 className='h-4 w-4' />}>
                    <WatchlistWorkflowPanel watchlist={watchlist} actionability={actionability} query={result.query} />
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
    priority?: TiActionabilityModel['evidencePriority'][number]
}

type LocalDecision = {
    status: 'reviewing' | 'assigned' | 'escalated' | 'suppressed' | 'closed' | 'reopened'
    reason: string
    decidedAt: string
}

type LocalRelevanceMark = {
    state: 'customer_relevant' | 'context_only' | 'needs_source' | 'not_relevant'
    rationale: string
    watchTerms: string[]
    caseIntent: 'case_candidate' | 'watchlist_context' | 'source_review' | 'no_case'
    markedAt: string
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

type SelectedReviewHandoff = {
    schemaVersion: 'ti.public_actor.selected_review_handoff.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItem: Pick<AnalystWorkItem, 'id' | 'kind' | 'severity' | 'title' | 'timestamp' | 'source' | 'provenance' | 'confidence' | 'href' | 'evidence' | 'nextActions'>
    localReview: {
        status: LocalDecision['status'] | 'not_recorded'
        rationale: string
        decidedAt?: string
    }
    localRelevance: {
        state: LocalRelevanceMark['state'] | 'not_marked'
        rationale: string
        watchTerms: string[]
        caseIntent: LocalRelevanceMark['caseIntent'] | 'not_set'
        markedAt?: string
    }
    watchlist: {
        terms: string[]
        matchedTerms: string[]
        organizations: string[]
    }
    caseHandoff: {
        ready: boolean
        endpoint: string
        backedRoute?: string
        missing: string[]
    }
    alertHandoff: {
        ready: boolean
        endpoint: string
        backedRoute?: string
        missing: string[]
    }
    evidenceBasis: string[]
    blockers: string[]
}

type SelectedSourceDrilldown = {
    schemaVersion: 'ti.public_actor.selected_source_drilldown.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItem: Pick<AnalystWorkItem, 'id' | 'kind' | 'title' | 'timestamp' | 'source' | 'provenance' | 'confidence' | 'href'>
    rows: SelectedSourceDrilldownRow[]
    alertHandoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
    }
    caseHandoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
    }
    blockers: string[]
}

type SelectedSourceDrilldownRow = {
    rowId: string
    sourceName: string
    sourceId?: string
    provenance: string
    href?: string
    captureId?: string
    reportDate?: string
    confidence?: number
    state: 'ready' | 'needs_capture' | 'needs_source'
    ownerLane: 'source' | 'public-ti' | 'alert' | 'case'
    route: string
    missing: string[]
    handoff: string
}

type SelectedCaseDraft = {
    schemaVersion: 'ti.public_actor.selected_case_draft.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    caseIntent: LocalRelevanceMark['caseIntent'] | 'not_set'
    ready: boolean
    endpoint: string
    route?: string
    missing: string[]
    watchTerms: string[]
    sourceRows: Array<Pick<SelectedSourceDrilldownRow, 'sourceName' | 'sourceId' | 'provenance' | 'captureId' | 'reportDate' | 'confidence' | 'state' | 'missing'>>
    body: Record<string, unknown>
}

type SelectedCaseCreateRequest = {
    schemaVersion: 'ti.public_actor.selected_case_create_request.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    ready: boolean
    state: 'ready' | 'review' | 'blocked'
    route: string
    nextAction: string
    request: {
        method: 'POST'
        path: string
        body: Record<string, unknown>
    }
    sourceRows: Array<{
        sourceName: string
        sourceId?: string
        provenance: string
        captureId?: string
        reportDate?: string
        confidence?: number
        state: SelectedSourceDrilldownRow['state']
        missing: string[]
    }>
    refs: {
        alertIds: string[]
        captureIds: string[]
        casePaths: string[]
        sourceIds: string[]
        watchTerms: string[]
    }
    blockers: string[]
    consumerStage?: {
        state: string
        request?: string
        missing: string[]
    }
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

type SelectedCaseOwnershipPlan = {
    schemaVersion: 'ti.public_actor.selected_case_ownership.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    state: 'ready' | 'review' | 'blocked'
    route: string
    nextAction: string
    owner: {
        lane: string
        label: string
    }
    summary: {
        caseCandidates: number
        replayReady: number
        relatedAlerts: number
        relatedCases: number
        captures: number
        blockers: number
    }
    caseReviewItems: Array<{
        id: string
        evidenceRowId: string
        title: string
        priority: CaseReviewIntakeItem['priority']
        state: CaseReviewIntakeItem['state']
        route: string
        alertIds: string[]
        casePaths: string[]
        captureIds: string[]
        sourceIds: string[]
        watchlistTerms: string[]
        reasons: string[]
        recommendedAction: CaseReviewIntakeItem['recommendedAction']
        nextAction: string
        blockers: string[]
    }>
    replayRows: Array<{
        id: string
        evidenceRowId: string
        ready: boolean
        state: TiActionabilityModel['caseReplayReadiness']['rows'][number]['state']
        exportRoute?: string
        caseId?: string
        alertIds: string[]
        captureIds: string[]
        sourceIds: string[]
        blockerCodes: string[]
    }>
    related: {
        alerts: Array<{
            id: string
            status?: string
            casePath?: string
            captureIds: string[]
            recommendedRoute?: string
        }>
        cases: Array<{
            id: string
            path?: string
            status?: string
            title?: string
        }>
    }
    sourceRefs: {
        alertIds: string[]
        captureIds: string[]
        casePaths: string[]
        sourceIds: string[]
    }
    consumerStage?: {
        id: string
        state: string
        request?: string
        blockers: string[]
    }
    blockers: string[]
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

type SelectedDeliveryReadinessPlan = {
    schemaVersion: 'ti.public_actor.selected_delivery_readiness.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    state: 'ready' | 'review' | 'blocked'
    route: string
    nextAction: string
    summary: {
        alerts: number
        captures: number
        destinations: number
        caseRoutes: number
        blockers: number
    }
    alerts: Array<{
        id: string
        title: string
        status: string
        ready: boolean
        casePath?: string
        captureIds: string[]
        destinationIds: string[]
        blockers: string[]
        recommendedRoute?: string
    }>
    handoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
        request?: string
    }
    sourceRefs: {
        alertIds: string[]
        captureIds: string[]
        destinationIds: string[]
        casePaths: string[]
        sourceIds: string[]
    }
    blockers: string[]
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

type CaseActionTrailPayload = {
    schemaVersion: 'ti.public_actor.case_action_trail.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    events: CaseActionTrailEvent[]
    summary: {
        total: number
        ready: number
        blocked: number
        sessionLocal: boolean
        replayable: boolean
    }
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

type CaseActionTrailEvent = {
    id: string
    at: string
    label: string
    detail: string
    state: 'ready' | 'review' | 'blocked' | 'local'
    route?: string
    blockers: string[]
    replayExportRoute?: string
    evidenceRowId?: string
    provenance: {
        sourceIds: string[]
        captureIds: string[]
        alertIds: string[]
        caseId?: string
        confidence?: number
        reportDate?: string
        source?: string
    }
}

type SelectedAlertActionPlan = {
    schemaVersion: 'ti.public_actor.selected_alert_action_plan.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    state: TiActionabilityModel['alertGenerationReadiness']['state']
    ready: boolean
    route: string
    sourceRoute: string
    nextAction: string
    readiness: Pick<TiActionabilityModel['alertGenerationReadiness'], 'schemaVersion' | 'readyForCustomerDelivery' | 'candidateCount' | 'matchedCandidateCount' | 'captureRefCount' | 'generationEvidenceWindowReady' | 'latestEvidenceAt' | 'provenance'>
    watchlist: {
        terms: string[]
        matchedTerms: string[]
        organizations: string[]
    }
    sourceRefs: {
        sourceIds: string[]
        captureIds: string[]
        alertIds: string[]
        sourceFamilies: string[]
    }
    blockers: TiActionabilityModel['alertGenerationReadiness']['blockers']
    handoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
    }
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

type SelectedWatchlistPlan = {
    schemaVersion: 'ti.public_actor.selected_watchlist_plan.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    state: TiActionabilityModel['watchlistRelevance']['state']
    ready: boolean
    route: string
    nextAction: string
    terms: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        matched: boolean
        notes: string
    }>
    relevanceRows: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        fit: 'matched' | 'near' | 'blocked'
        alertable: boolean
        route: string
        evidenceRefs: string[]
        sourceFamilies: string[]
        blockers: string[]
        nextAction: string
    }>
    intersections: Array<{
        intersectionId: string
        kind: WatchlistIntersectionRow['kind']
        value: string
        state: WatchlistIntersectionRow['state']
        route: string
        organizationId?: string
        watchlistId?: string
        watchlistItemId?: string
        alertIds: string[]
        casePaths: string[]
        captureIds: string[]
        sourceEvidenceRefs: string[]
        recommendedAction: WatchlistIntersectionRow['recommendedAction']
        blockers: WatchlistIntersectionRow['blockers']
    }>
    sourceRefs: {
        sourceIds: string[]
        captureIds: string[]
        alertIds: string[]
        casePaths: string[]
    }
    blockers: string[]
    handoff: {
        ready: boolean
        route: string
        blocked: boolean
        missing: string[]
    }
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

type SelectedEnrichmentTriage = {
    schemaVersion: 'ti.public_actor.selected_enrichment_triage.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    route: string
    state: 'ready' | 'review' | 'blocked'
    summary: {
        sourceRows: number
        intakeItems: number
        blockers: number
        sourceRequests: number
        captures: number
    }
    rows: Array<{
        id: string
        sourceName: string
        sourceFamily: string
        state: SourceHealthRow['state']
        route: string
        sourceId?: string
        sourceRequestId?: string
        captureId?: string
        requestedFields: string[]
        nextAction: string
        matchingIntakeItemIds: string[]
        blockers: string[]
        evidence: {
            provenance: string
            timestamp: string
            confidence?: number
            parserStatus?: string
        }
    }>
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

type StagedHandoff = {
    schemaVersion: 'ti.public_actor.staged_handoff.v1'
    source: 'public-ti'
    sessionLocal: true
    id: string
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    relevanceState: LocalRelevanceMark['state'] | 'not_marked'
    caseIntent: LocalRelevanceMark['caseIntent'] | 'not_set'
    ready: boolean
    blockers: string[]
    reviewHandoff: SelectedReviewHandoff
    sourceDrilldown: SelectedSourceDrilldown
    caseDraft: SelectedCaseDraft
}

type EnrichmentTask = {
    title: string
    status: 'ready' | 'needs_api' | 'needs_review' | 'watch'
    detail: string
    route?: string
    sourceFamily?: string
    requestedFields?: string[]
    ownerLane?: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
}

type SourceHealthRow = TiActionabilityModel['sourceHealthQueue']['rows'][number]
type WatchlistIntersectionRow = TiActionabilityModel['orgRelevance']['watchlistIntersections'][number]
type CaseReviewIntakeItem = TiActionabilityModel['caseReviewIntake']['items'][number]

function ActorIntelligenceDossier({ actor, actionability, result, artifacts, selectedArtifactId, onSelectArtifact }: {
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
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

            <FreshnessGatePanel actor={actor} actionability={actionability} query={result.query} />

            <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                <DossierList title='Motivation' values={actor.motivation} />
                <DossierList title='Tooling' values={actor.malwareTools} artifactKind='tool' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <DossierList title='Campaigns' values={actor.campaigns} artifactKind='campaign' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <DossierList title='Indicators' values={actor.indicators} />
                <DossierList title='Targeting' values={actor.targetSectors} />
                <DossierList title='Geographies' values={actor.geographies} artifactKind='country' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <DossierList title='Infrastructure' values={actor.infrastructure} artifactKind='infrastructure' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <TechniqueCoveragePanel techniques={actor.techniqueCoverage} />
                <CampaignTimelinePanel timeline={actor.campaignTimeline} />
            </div>

            <div className='mt-4 grid gap-3 xl:grid-cols-3'>
                <EvidencePanel title='Confidence reasoning'>
                    {actor.confidenceReasoning.map(item => <li key={item}>{item}</li>)}
                </EvidencePanel>
                <SourceCoveragePanel coverage={actor.sourceCoverage} />
                <StructuredProvenancePanel rows={actor.provenanceRows} actor={actor} actionability={actionability} query={result.query} />
            </div>
        </section>
    )
}

function FreshnessGatePanel({ actor, actionability, query }: { actor: TiActorIntelligenceProfile; actionability: TiActionabilityModel; query: string }) {
    const sourceBlockers = actionability.readiness.blockers.filter(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
    const workflowBlockers = actionability.readiness.blockers.filter(blocker => blocker.ownerLane === 'org' || blocker.ownerLane === 'alert' || blocker.ownerLane === 'case' || blocker.ownerLane === 'webhook' || blocker.ownerLane === 'entitlement')
    const sourceState: DecisionStep['status'] = actor.freshness.stale || sourceBlockers.length || actor.sourceCoverage.missing.length ? 'review' : 'ready'
    const handoffState: DecisionStep['status'] = actionability.readiness.state === 'ready' ? 'ready' : workflowBlockers.length ? 'blocked' : 'review'
    const nextOwner = actionability.readiness.blockers[0]?.ownerLane ?? (actor.sourceCoverage.missing.length ? 'source' : undefined)
    const summary = actor.freshness.stale
        ? actor.freshness.reason
        : sourceState === 'review'
            ? 'Evidence dates are usable, but source coverage still needs capture or provenance references before stronger handoff.'
            : 'Evidence dates and source coverage are current enough for review.'
    const rows = [
        { label: 'Newest evidence', value: actor.sourceCoverage.latestReportDate ? formatDate(actor.sourceCoverage.latestReportDate) : 'Not dated' },
        { label: 'Generated', value: formatDate(actor.freshness.generatedAt) },
        { label: 'Source rows', value: String(actor.sourceCoverage.totalRows) },
        { label: 'Capture rows', value: String(actor.sourceCoverage.captureRows) },
    ]

    return (
        <div data-ti-freshness-gate='true' className='mt-4 min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Freshness gate</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {summary}
                    </p>
                </div>
                <div className='flex flex-wrap items-center gap-1.5'>
                    <span className={decisionStepStatusClass(sourceState)}>sources {decisionStepStatusLabel(sourceState)}</span>
                    <span className={decisionStepStatusClass(handoffState)}>handoff {decisionStepStatusLabel(handoffState)}</span>
                    <span data-ti-freshness-review-export='true' className='inline-flex'>
                        <CopyPayloadButton label='Freshness review' payload={freshnessReviewPayloadFor(actor, actionability, query, { sourceState, handoffState })} />
                    </span>
                </div>
            </div>
            <div className='mt-3 grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4'>
                {rows.map(row => (
                    <div key={row.label} className='min-w-0 rounded-md border border-[#e4e9f1] bg-white p-2 dark:border-[#2a3547] dark:bg-[#0f1621]'>
                        <p className='text-[11px] font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>{row.label}</p>
                        <p className='mt-1 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{row.value}</p>
                    </div>
                ))}
            </div>
            <div className='mt-3 grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
                <div className='min-w-0 rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                    <p className='text-[11px] font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Source blockers</p>
                    <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {sourceBlockers.length ? sourceBlockers.slice(0, 3).map(blocker => (
                            <li key={`${blocker.code}-${blocker.field}`} className='wrap-break-word'>{readinessOwnerLabel(blocker.ownerLane)}: {displayRequirementText(blocker.handoff)}</li>
                        )) : actor.sourceCoverage.missing.length ? actor.sourceCoverage.missing.slice(0, 3).map(item => (
                            <li key={item} className='wrap-break-word'>Source collection: attach {coverageMissingLabel(item)}.</li>
                        )) : <li>Source evidence is sufficient for review.</li>}
                    </ul>
                </div>
                <div className='min-w-0 rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                    <p className='text-[11px] font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Handoff blockers</p>
                    <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {workflowBlockers.length ? workflowBlockers.slice(0, 3).map(blocker => (
                            <li key={`${blocker.code}-${blocker.field}`} className='wrap-break-word'>{readinessOwnerLabel(blocker.ownerLane)}: {displayRequirementText(blocker.handoff)}</li>
                        )) : <li>Required handoff identifiers are present.</li>}
                    </ul>
                </div>
            </div>
            <p className='mt-3 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                {nextOwner ? `Next owner: ${readinessOwnerLabel(nextOwner)}.` : 'Next owner: none returned.'}
            </p>
        </div>
    )
}

function freshnessReviewPayloadFor(
    actor: TiActorIntelligenceProfile,
    actionability: TiActionabilityModel,
    query: string,
    state: { sourceState: DecisionStep['status']; handoffState: DecisionStep['status'] },
) {
    const sourceBlockers = actionability.readiness.blockers.filter(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
    const workflowBlockers = actionability.readiness.blockers.filter(blocker => blocker.ownerLane === 'org' || blocker.ownerLane === 'alert' || blocker.ownerLane === 'case' || blocker.ownerLane === 'webhook' || blocker.ownerLane === 'entitlement')
    const requestedFields = unique([
        ...actor.sourceCoverage.missing,
        ...actionability.sourceHealthQueue.rows.flatMap(row => row.requestedFields),
        ...actionability.sourceEnrichmentIntake.items.flatMap(item => item.requestedFields),
    ])
    return {
        schemaVersion: 'ti.public_actor.freshness_review.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        generatedAt: actor.freshness.generatedAt,
        actor: {
            actorClass: actor.actorClass,
            confidence: actor.confidence,
            firstSeen: actor.firstSeen,
            lastSeen: actor.lastSeen,
        },
        freshness: actor.freshness,
        state,
        sourceCoverage: actor.sourceCoverage,
        provenanceRows: actor.provenanceRows,
        sourceHealthQueue: {
            schemaVersion: actionability.sourceHealthQueue.schemaVersion,
            rows: actionability.sourceHealthQueue.rows,
        },
        sourceEnrichmentIntake: {
            schemaVersion: actionability.sourceEnrichmentIntake.schemaVersion,
            route: actionability.sourceEnrichmentIntake.route,
            summary: actionability.sourceEnrichmentIntake.summary,
            items: actionability.sourceEnrichmentIntake.items,
        },
        requestedFields,
        relatedWorkflow: {
            watchlist: {
                state: actionability.watchlistRelevance.state,
                terms: actionability.watchlistRelevance.terms,
                matches: actionability.watchlistRelevance.matches,
                blockers: actionability.watchlistRelevance.blockers,
            },
            alerts: actionability.relatedAlerts,
            cases: actionability.relatedCases,
            caseReviewIntake: actionability.caseReviewIntake,
        },
        blockers: {
            source: sourceBlockers,
            workflow: workflowBlockers,
        },
        handoffRoutes: {
            sourceEnrichment: actionability.sourceEnrichmentIntake.route,
            watchlist: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            alertRebuild: actionability.createAlertHandoff.backedRoute || actionability.createAlertHandoff.endpoint,
            caseReview: actionability.caseHandoff.backedRoute || actionability.caseHandoff.endpoint,
        },
    }
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

function StructuredProvenancePanel({ rows, actor, actionability, query }: { rows: TiActorIntelligenceProfile['provenanceRows']; actor: TiActorIntelligenceProfile; actionability: TiActionabilityModel; query: string }) {
    return (
        <div className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Source provenance</p>
            <div className='mt-2 grid gap-2'>
                {rows.length ? rows.slice(0, 6).map(row => {
                    const href = linkFromText(row.provenance)
                    return (
                        <div key={`${row.sourceName}-${row.provenance}`} data-ti-provenance-artifact-export='true' className='rounded-lg border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{row.sourceName}</p>
                                <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                    <span className='shrink-0 text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{row.reportDate ? formatDate(row.reportDate) : row.captureId ? `capture ${row.captureId}` : `${Math.round((row.confidence ?? 0) * 100)}%`}</span>
                                    <CopyPayloadButton label='Provenance artifact' payload={provenanceArtifactPayloadFor(row, actor, actionability, query)} />
                                    {href ? (
                                        <a href={href} target='_blank' rel='noopener noreferrer' className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                                            <ExternalLink className='h-3.5 w-3.5' />
                                            Open
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                            <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{row.provenance}</p>
                            <p className='mt-1 text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{row.shownBecause}</p>
                        </div>
                    )
                }) : <p className='text-sm text-[#667085] dark:text-[#9aa8bd]'>No structured provenance rows returned.</p>}
            </div>
        </div>
    )
}

function provenanceArtifactPayloadFor(row: TiActorIntelligenceProfile['provenanceRows'][number], actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel, query: string) {
    const sourceHealthRows = actionability.sourceHealthQueue.rows.filter(item =>
        (row.sourceId ? item.sourceId === row.sourceId : false)
        || (row.captureId ? item.captureId === row.captureId : false)
        || (row.sourceRequestId ? item.sourceRequestId === row.sourceRequestId : false)
        || item.provenance === row.provenance
        || item.sourceName === row.sourceName
    )
    const sourceHealthRowIds = new Set(sourceHealthRows.map(item => item.id))
    const sourceEnrichmentItems = actionability.sourceEnrichmentIntake.items.filter(item =>
        sourceHealthRowIds.has(item.sourceHealthRowId)
        || (row.sourceId ? item.sourceId === row.sourceId : false)
        || (row.captureId ? item.captureId === row.captureId : false)
        || (row.sourceRequestId ? item.sourceRequestId === row.sourceRequestId : false)
        || item.evidence.provenance === row.provenance
    )
    const evidencePriority = actionability.evidencePriority.filter(item =>
        (row.sourceId ? item.sourceIds.includes(row.sourceId) : false)
        || (row.captureId ? item.captureIds.includes(row.captureId) : false)
        || item.reasons.some(reason => reason.includes(row.sourceName) || reason.includes(row.provenance))
    )
    const watchlistIntersections = actionability.orgRelevance.watchlistIntersections.filter(item =>
        item.sourceEvidenceRefs.some(ref => ref === row.sourceId || ref === row.captureId || row.provenance.includes(ref) || row.sourceName.includes(ref))
    )
    return {
        schemaVersion: 'ti.public_actor.provenance_artifact.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        generatedAt: actionability.sourceHealthQueue.generatedAt,
        actor: {
            actorClass: actor.actorClass,
            confidence: actor.confidence,
            freshness: actor.freshness,
        },
        provenance: row,
        sourceHealthRows,
        sourceEnrichmentIntake: {
            schemaVersion: actionability.sourceEnrichmentIntake.schemaVersion,
            route: actionability.sourceEnrichmentIntake.route,
            matchingItems: sourceEnrichmentItems,
        },
        evidencePriority,
        watchlistIntersections,
        relatedWorkflow: {
            alerts: actionability.relatedAlerts.filter(item => evidencePriority.some(priority => priority.alertIds.includes(item.id))),
            cases: actionability.relatedCases.filter(item => {
                const path = item.path
                return Boolean(path && evidencePriority.some(priority => priority.casePaths.includes(path)))
            }),
            caseReviewIntake: actionability.caseReviewIntake.items.filter(item =>
                evidencePriority.some(priority => item.evidenceRowId === priority.rowId)
                || (row.sourceId ? item.sourceIds.includes(row.sourceId) : false)
                || (row.captureId ? item.captureIds.includes(row.captureId) : false)
            ),
        },
        handoffRoutes: {
            sourceEnrichment: actionability.sourceEnrichmentIntake.route,
            watchlist: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            alertRebuild: actionability.createAlertHandoff.backedRoute || actionability.createAlertHandoff.endpoint,
            caseReview: actionability.caseHandoff.backedRoute || actionability.caseHandoff.endpoint,
        },
    }
}

function SourceCoveragePanel({ coverage }: { coverage: TiActorIntelligenceProfile['sourceCoverage'] }) {
    const metrics = [
        { label: 'Source rows', value: String(coverage.totalRows) },
        { label: 'Dated rows', value: String(coverage.datedRows) },
        { label: 'Captures', value: String(coverage.captureRows) },
        { label: 'Latest', value: coverage.latestReportDate ? formatDate(coverage.latestReportDate) : 'Not dated' },
    ]
    return (
        <div data-ti-source-coverage='true' className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Source coverage</p>
                    <p className='mt-1 text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {coverage.stale ? 'Refresh source coverage before alert-ready handoff.' : 'Evidence dates and source references meet freshness policy.'}
                    </p>
                </div>
                <span className={coverage.stale ? 'rounded-md bg-[#fff4d6] px-2 py-1 text-[11px] font-semibold text-[#8a5a00] dark:bg-[#2b220d] dark:text-[#ffd77a]' : 'rounded-md bg-[#e9f8ef] px-2 py-1 text-[11px] font-semibold text-[#147a3b] dark:bg-[#12281b] dark:text-[#83d9a1]'}>
                    {coverage.stale ? 'review' : 'ready'}
                </span>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                {metrics.map(metric => (
                    <div key={metric.label} className='min-w-0 rounded-md border border-[#e4e9f1] bg-white p-2 dark:border-[#2a3547] dark:bg-[#0f1621]'>
                        <p className='text-[11px] font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>{metric.label}</p>
                        <p className='mt-1 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{metric.value}</p>
                    </div>
                ))}
            </div>
            <div className='mt-3 flex flex-wrap gap-1.5'>
                {coverage.sourceFamilies.length ? coverage.sourceFamilies.map(item => (
                    <span key={item.family} className='rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
                        {formatLabel(item.family)} · {item.count}
                    </span>
                )) : <span className='text-xs text-[#667085] dark:text-[#9aa8bd]'>No source families returned.</span>}
            </div>
            {coverage.missing.length ? (
                <div className='mt-3 rounded-md border border-[#fff0c2] bg-[#fffdf2] p-2 text-xs leading-5 text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'>
                    Needs {coverage.missing.map(coverageMissingLabel).join(', ')}.
                </div>
            ) : null}
        </div>
    )
}

function TechniqueCoveragePanel({ techniques }: { techniques: TiActorIntelligenceProfile['techniqueCoverage'] }) {
    return (
        <div data-ti-technique-coverage='true' className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Techniques</p>
                    <p className='mt-1 text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {techniques.length ? `${techniques.length} mapped technique${techniques.length === 1 ? '' : 's'} with source coverage.` : 'No mapped technique rows returned.'}
                    </p>
                </div>
                <span className={techniques.some(item => item.freshness === 'ready') ? decisionStepStatusClass('ready') : decisionStepStatusClass(techniques.length ? 'review' : 'blocked')}>
                    {techniques.some(item => item.freshness === 'ready') ? 'ready' : techniques.length ? 'review' : 'blocked'}
                </span>
            </div>
            <div className='mt-2 grid gap-2'>
                {techniques.length ? techniques.slice(0, 4).map(item => {
                    const payload = techniqueCoveragePayloadFor(item)
                    return (
                        <div key={`${item.attackId ?? item.name}-${item.tactic}`} data-ti-technique-coverage-export='true' className='rounded-lg border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{item.name}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{item.tactic} · {Math.round(item.confidence * 100)}%</p>
                                </div>
                                <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:shrink-0'>
                                    <span className={sourceHealthChipClass(item.freshness)}>{item.freshness}</span>
                                    {item.attackId ? <TechniqueBadge attackId={item.attackId} name={item.name} tactic={item.tactic} detail={item.detail} /> : null}
                                    <CopyPayloadButton label='Technique coverage' payload={payload} />
                                </div>
                            </div>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{item.detail}</p>
                            <div className='mt-2 grid gap-1 border-t border-[#eef1f5] pt-2 dark:border-[#273244]'>
                                <p className='wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                                    {item.sourceIds.length ? `${item.sourceIds.length} source reference${item.sourceIds.length === 1 ? '' : 's'}` : 'Source reference needed'} · {item.captureIds.length ? `${item.captureIds.length} capture reference${item.captureIds.length === 1 ? '' : 's'}` : 'capture needed'} · {item.missing.length ? `needs ${item.missing.map(coverageMissingLabel).join(', ')}` : 'case context ready'}
                                </p>
                                {item.provenanceRefs[0] ? <p className='break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{item.provenanceRefs[0]}</p> : null}
                            </div>
                        </div>
                    )
                }) : <p className='text-xs text-[#667085] dark:text-[#9aa8bd]'>Queue technique enrichment before detection or case routing.</p>}
            </div>
        </div>
    )
}

function techniqueCoveragePayloadFor(item: TiActorIntelligenceProfile['techniqueCoverage'][number]) {
    const missing = item.missing.length ? item.missing : [
        item.sourceIds.length ? '' : 'sourceIds',
        item.captureIds.length ? '' : 'captureId',
        item.attackId ? '' : 'attackId',
        item.provenanceRefs.length ? '' : 'provenanceRefs',
    ].filter(Boolean)
    return {
        schemaVersion: 'ti.public_actor.technique_coverage.v1',
        attackId: item.attackId,
        name: item.name,
        tactic: item.tactic,
        detail: item.detail,
        confidence: item.confidence,
        freshness: item.freshness,
        sourceIds: item.sourceIds,
        captureIds: item.captureIds,
        provenanceRefs: item.provenanceRefs,
        route: missing.length ? '/dashboard/ti/enrichment' : '/dashboard/ti/workbench',
        recommendedAction: missing.length ? 'queue_enrichment' : 'attach_to_case_review',
        blockedBy: missing.map(field => ({
            ownerLane: /capture|source|provenance/i.test(field) ? 'source' : 'public-ti',
            field,
            reason: `Attach ${coverageMissingLabel(field)} before using this technique row for case or detection review.`,
        })),
    }
}

function CampaignTimelinePanel({ timeline }: { timeline: TiActorIntelligenceProfile['campaignTimeline'] }) {
    return (
        <div data-ti-campaign-timeline='true' className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Activity timeline</p>
                    <p className='mt-1 text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {timeline.length ? `${timeline.length} dated campaign or activity row${timeline.length === 1 ? '' : 's'} with provenance.` : 'No dated campaign rows returned.'}
                    </p>
                </div>
                <span className={timeline.some(item => item.freshness === 'ready') ? decisionStepStatusClass('ready') : decisionStepStatusClass(timeline.length ? 'review' : 'blocked')}>
                    {timeline.some(item => item.freshness === 'ready') ? 'ready' : timeline.length ? 'review' : 'blocked'}
                </span>
            </div>
            <div className='mt-2 grid gap-2'>
                {timeline.length ? timeline.slice(0, 4).map(item => {
                    const payload = campaignActivityPayloadFor(item)
                    return (
                        <div key={`${item.firstReportedAt}-${item.title}`} data-ti-campaign-activity-export='true' className='rounded-lg border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{item.title}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                        {item.affectedSectors.slice(0, 2).join(', ') || 'Sector not returned'} · {item.countries.slice(0, 2).join(', ') || 'Country not returned'} · {Math.round(item.confidence * 100)}%
                                    </p>
                                </div>
                                <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:shrink-0'>
                                    <span className={sourceHealthChipClass(item.freshness)}>{formatDate(item.firstReportedAt)}</span>
                                    <CopyPayloadButton label='Campaign activity' payload={payload} />
                                </div>
                            </div>
                            <div className='mt-2 grid gap-1 border-t border-[#eef1f5] pt-2 dark:border-[#273244]'>
                                <p className='wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                                    {item.sourceIds.length ? `${item.sourceIds.length} source reference${item.sourceIds.length === 1 ? '' : 's'}` : 'source reference needed'} · {item.provenanceRefs.length ? `${item.provenanceRefs.length} provenance reference${item.provenanceRefs.length === 1 ? '' : 's'}` : 'provenance needed'} · {item.missing.length ? `needs ${item.missing.map(coverageMissingLabel).join(', ')}` : 'case context ready'}
                                </p>
                                {item.provenanceRefs[0] ? <p className='break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{item.provenanceRefs[0]}</p> : null}
                            </div>
                        </div>
                    )
                }) : <p className='text-xs text-[#667085] dark:text-[#9aa8bd]'>Queue campaign enrichment before trend or case review.</p>}
            </div>
        </div>
    )
}

function campaignActivityPayloadFor(item: TiActorIntelligenceProfile['campaignTimeline'][number]) {
    const missing = item.missing.length ? item.missing : [
        item.sourceIds.length ? '' : 'sourceIds',
        item.provenanceRefs.length ? '' : 'provenanceRefs',
        Date.parse(item.firstReportedAt) || /\b(19|20)\d{2}\b/.test(item.firstReportedAt) ? '' : 'firstReportedAt',
    ].filter(Boolean)
    return {
        schemaVersion: 'ti.public_actor.campaign_activity.v1',
        title: item.title,
        firstReportedAt: item.firstReportedAt,
        confidence: item.confidence,
        freshness: item.freshness,
        affectedSectors: item.affectedSectors,
        countries: item.countries,
        sourceIds: item.sourceIds,
        provenanceRefs: item.provenanceRefs,
        route: missing.length ? '/dashboard/ti/enrichment' : '/dashboard/ti/workbench',
        recommendedAction: missing.length ? 'queue_enrichment' : 'attach_to_case_review',
        blockedBy: missing.map(field => ({
            ownerLane: /source|provenance/i.test(field) ? 'source' : 'public-ti',
            field,
            reason: `Attach ${coverageMissingLabel(field)} before using this activity row for case review.`,
        })),
    }
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
            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3'>
                {artifacts.map(artifact => {
                    const active = artifact.id === selectedArtifactId
                    return (
                        <button
                            key={artifact.id}
                            type='button'
                            onClick={() => onSelectArtifact(artifact.id)}
                            className={`min-w-0 rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-[#b8c5ff] ${active ? 'border-[#3056d3] bg-[#eef3ff]' : 'border-[#dfe5ee] bg-[#fbfcfe] hover:bg-white'}`}
                        >
                            <span className='block wrap-break-word text-xs font-semibold text-[#171a21]'>{artifact.label}</span>
                            <span className='mt-1 block wrap-break-word text-[11px] text-[#667085]'>{formatLabel(artifact.kind)} · {artifact.readiness.label}</span>
                        </button>
                    )
                })}
            </div>
        </section>
    )
}

function ActorArtifactWorkbench({ artifact, handoffs }: { artifact: ActorArtifact; handoffs: ActorArtifactHandoffs }) {
    const bridge = handoffs.authBridge
    const selectedArtifactPayload = selectedArtifactPayloadFor(artifact, handoffs)
    const payloadRows = [
        { id: 'watchlist', label: 'Watchlist package', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist], route: bridge.links.watchlist.href, blocked: handoffs.watchlist.blocked, detail: handoffs.watchlist.missing.length ? handoffMissingLabel(handoffs.watchlist.missing) : `${artifact.watchlistTerms.length} artifact term${artifact.watchlistTerms.length === 1 ? '' : 's'}` },
        { id: 'alert', label: 'Alert rebuild', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild], route: bridge.links.alertRebuild.href, blocked: handoffs.alertRebuild.blocked, detail: handoffs.alertRebuild.missing.length ? handoffMissingLabel(handoffs.alertRebuild.missing) : 'Ready to rebuild from this selected artifact.' },
        { id: 'case', label: 'Case package', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case], route: bridge.links.case.href, blocked: handoffs.case.blocked, detail: handoffs.case.missing.length ? handoffMissingLabel(handoffs.case.missing) : 'Ready to open with this selected artifact.' },
        { id: 'enrichment', label: 'Enrichment item', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.enrichment], route: bridge.links.enrichment.href, blocked: handoffs.enrichment.blocked, detail: handoffs.enrichment.missing.length ? handoffMissingLabel(handoffs.enrichment.missing) : `${artifact.enrichmentTasks.length} enrichment task${artifact.enrichmentTasks.length === 1 ? '' : 's'}` },
    ]
    const workflowRows = payloadRows.map(row => ({
        ...row,
        readiness: row.payload.actionReadiness.find(item => item.action === row.payload.action),
        missing: row.payload.missing,
        endpoint: row.payload.selectedPayload.endpoint ?? row.payload.selectedPayload.backedRoute ?? row.route,
    }))

    return (
        <section data-ti-selected-artifact='true' className='max-w-full overflow-hidden rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-3 sm:p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#3056d3]'>Selected Intelligence</p>
                    <h2 className='mt-1 wrap-break-word text-xl font-semibold text-[#171a21]'>{artifact.label}</h2>
                    <p className='mt-1 text-sm leading-6 text-[#596170]'>{formatLabel(artifact.kind)} · {artifact.subtitle}</p>
                </div>
                <div data-ti-selected-artifact-export='true' className='grid w-full min-w-0 basis-full gap-2 sm:min-w-72 lg:w-auto lg:basis-auto'>
                    <div className='grid grid-cols-3 gap-2 text-center text-xs'>
                        <EvidenceMetric label='Freshness' value={formatDate(artifact.freshness)} />
                        <EvidenceMetric label='Confidence' value={`${Math.round(artifact.confidence * 100)}%`} />
                        <EvidenceMetric label='Readiness' value={artifact.readiness.label} />
                    </div>
                    <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 lg:justify-end'>
                        <span className={sourceHealthChipClass(artifact.readiness.state === 'ready_for_org_handoff' ? 'ready' : artifact.readiness.state === 'needs_source' || artifact.readiness.state === 'needs_watchlist_term' ? 'blocked' : 'review')}>{formatLabel(artifact.readiness.state)}</span>
                        <CopyPayloadButton label='Selected artifact' payload={selectedArtifactPayload} />
                    </div>
                </div>
            </div>
            <div className='mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]'>
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
                <div className='grid min-w-0 max-w-full content-start gap-2 overflow-hidden'>
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
                        <div data-ti-artifact-source-requests='true' className='mt-3 grid min-w-0 w-full max-w-[calc(100vw-7rem)] gap-2 overflow-hidden sm:max-w-full'>
                            <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Source requests</p>
                            {bridge.payload.sourceRequests.length ? bridge.payload.sourceRequests.slice(0, 3).map(request => (
                                <div key={`${request.sourceName}-${request.provenance}-${request.captureId ?? 'missing'}`} className='min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                                    <div className='flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'>
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{request.sourceName}</p>
                                        <span className={sourceRequestCaptureClass(Boolean(request.captureId))}>
                                            {request.captureId ? 'capture attached' : 'capture needed'}
                                        </span>
                                    </div>
                                    <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{request.captureId ?? request.provenance}</p>
                                    {request.missing.length || typeof request.confidence === 'number' ? (
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                            {[typeof request.confidence === 'number' ? `${Math.round(request.confidence * 100)}% confidence` : '', ...request.missing].filter(Boolean).join(' · ')}
                                        </p>
                                    ) : null}
                                    <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                        <span className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
                                            {sourceRequestFamilyLabel(request.sourceFamily ?? 'source_capture')}
                                        </span>
                                        <span className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
                                            {sourceRequestRouteLabel(request.route ?? '/dashboard/ti/enrichment')}
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <p className='rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-2 text-xs leading-5 text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'>No source request rows returned for this artifact.</p>
                            )}
                        </div>
                        {bridge.missing.length ? (
                            <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-[#8a5a00]'>
                                {bridge.missing.slice(0, 4).map(item => <li key={item}>{displayRequirementText(item)}</li>)}
                            </ul>
                        ) : null}
                        {bridge.payload.evidenceRefs ? (
                            <div data-ti-artifact-reference-summary='true' className='mt-3 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                                <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Reference summary</p>
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {artifactReferenceChips(bridge.payload.evidenceRefs).map(item => (
                                        <span key={item.label} className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
                                            {item.value} {item.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                    {payloadRows.map(row => (
                        <PayloadHandoffRow key={row.id} label={row.label} detail={row.detail} payload={row.payload} route={row.route} blocked={row.blocked} />
                    ))}
                    <CopyPayloadButton label='console handoff bundle' payload={bridge} />
                </div>
            </div>
            <div data-ti-artifact-workflow-readiness='true' className='mt-4 rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Selected handoff readiness</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                            Selected artifact handoff state for watchlist, alert, case, and enrichment work.
                        </p>
                    </div>
                    <span className={workflowRows.every(row => !row.blocked) ? decisionStepStatusClass('ready') : decisionStepStatusClass('review')}>
                        {workflowRows.filter(row => !row.blocked).length}/{workflowRows.length} ready
                    </span>
                </div>
                <div className='mt-3 grid gap-2 md:grid-cols-2'>
                    {workflowRows.map(row => (
                        <div key={`workflow-${row.id}`} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{row.label}</p>
                                <span className={row.blocked ? decisionStepStatusClass('blocked') : decisionStepStatusClass('ready')}>
                                    {row.blocked ? 'blocked' : 'ready'}
                                </span>
                            </div>
                            <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{row.endpoint}</p>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                {row.readiness?.missing.length ? displayRequirementList(row.readiness.missing.slice(0, 2)) : row.missing.length ? displayRequirementList(row.missing.slice(0, 2)) : 'Required artifact context is present.'}
                            </p>
                            {row.readiness ? (
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    <span className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
                                        {actionOwnerLabel(row.readiness.ownerLane)}
                                    </span>
                                    <span className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
                                        {row.readiness.sourceRequestCount} source request{row.readiness.sourceRequestCount === 1 ? '' : 's'}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function selectedArtifactPayloadFor(artifact: ActorArtifact, handoffs: ActorArtifactHandoffs) {
    const bridge = handoffs.authBridge
    const actionReadiness = Object.values(bridge.payloads).flatMap(payload => payload.actionReadiness.filter(row => row.selected))
    return {
        schemaVersion: 'ti.public_actor.selected_artifact.v1',
        artifact: bridge.payload.artifact,
        readiness: {
            state: artifact.readiness.state,
            label: artifact.readiness.label,
            blockers: artifact.readiness.blockers,
            actions: actionReadiness,
            orgRequired: bridge.orgRequired,
            sourceRequired: bridge.sourceRequired,
            stale: bridge.stale,
            missing: bridge.missing,
        },
        evidenceRefs: bridge.payload.evidenceRefs,
        sourceRequests: bridge.payload.sourceRequests,
        handoffLinks: bridge.links,
        handoffRoutes: {
            watchlist: handoffs.watchlist.backedRoute,
            alertRebuild: handoffs.alertRebuild.backedRoute,
            case: handoffs.case.backedRoute,
            enrichment: handoffs.enrichment.backedRoute,
        },
        selectedPayloads: {
            watchlist: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist].selectedPayload,
            alertRebuild: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild].selectedPayload,
            case: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case].selectedPayload,
            enrichment: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.enrichment].selectedPayload,
        },
    }
}

function EvidencePriorityPanel({ priority }: { priority: NonNullable<AnalystWorkItem['priority']> }) {
    const ids = [
        ...priority.sourceIds.slice(0, 3).map(id => `source ${id}`),
        ...priority.captureIds.slice(0, 2).map(id => `capture ${id}`),
        ...priority.alertIds.slice(0, 2).map(id => `alert ${id}`),
    ]
    return (
        <div data-ti-evidence-priority='true' className='mt-4 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Evidence priority</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{priority.nextAction}</p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(priority.state)}>{decisionStepStatusLabel(priority.state)}</span>
                    <span className='rounded-md bg-[#eef3ff] px-2 py-1 text-[11px] font-semibold text-[#3056d3] dark:bg-[#17244a] dark:text-[#9ab3ff]'>{priority.score}/100</span>
                    <CopyPayloadButton label='Evidence priority' payload={priority} />
                </div>
            </div>
            <div className='mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]'>
                <EvidencePanel title='Priority basis'>
                    {priority.reasons.map(reason => <li key={reason}>{reason}</li>)}
                </EvidencePanel>
                <div className='min-w-0 rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Backed references</p>
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                        {ids.length ? ids.map(id => (
                            <span key={id} className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-[#f8fafc] px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#131c29] dark:text-[#d8e2f2]'>{id}</span>
                        )) : <span className='text-xs text-[#667085] dark:text-[#9aa8bd]'>No backed IDs attached.</span>}
                    </div>
                    {priority.blockers.length ? (
                        <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>
                            {priority.blockers.slice(0, 3).map(blocker => <li key={`${blocker.code}-${blocker.field}`}>{displayRequirementText(blocker.detail)}</li>)}
                        </ul>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function SelectedSourceDrilldownPanel({ drilldown }: { drilldown: SelectedSourceDrilldown }) {
    const readyRows = drilldown.rows.filter(row => row.state === 'ready').length
    const state: DecisionStep['status'] = readyRows === drilldown.rows.length && drilldown.rows.length ? 'ready' : drilldown.rows.length ? 'review' : 'blocked'
    return (
        <div data-ti-selected-source-drilldown='true' className='mt-4 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Source drilldown</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        Source rows, capture status, and handoff blockers for the selected queue item.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(state)}>{readyRows}/{drilldown.rows.length} ready</span>
                    <CopyPayloadButton label='Source drilldown' payload={drilldown} />
                </div>
            </div>

            <div className='mt-3 grid min-w-0 gap-2 md:grid-cols-2'>
                {drilldown.rows.length ? drilldown.rows.slice(0, 4).map(row => (
                    <div key={row.rowId} className='min-w-0 rounded-lg border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                    {[row.sourceId ? `source ${row.sourceId}` : '', row.reportDate ? formatDate(row.reportDate) : '', typeof row.confidence === 'number' ? `${Math.round(row.confidence * 100)}%` : ''].filter(Boolean).join(' · ') || 'Source metadata incomplete'}
                                </p>
                            </div>
                            <span className={row.state === 'ready' ? decisionStepStatusClass('ready') : row.state === 'needs_capture' ? decisionStepStatusClass('review') : decisionStepStatusClass('blocked')}>
                                {row.state === 'ready' ? 'ready' : row.state === 'needs_capture' ? 'capture needed' : 'source needed'}
                            </span>
                        </div>
                        <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{row.captureId ? `capture ${row.captureId}` : row.provenance}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{displayRequirementText(row.handoff)}</p>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            <span className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-[#fbfcfe] px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#131c29] dark:text-[#d8e2f2]'>
                                {readinessOwnerLabel(row.ownerLane === 'public-ti' ? 'public-ti' : row.ownerLane)}
                            </span>
                            <span className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-[#fbfcfe] px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#131c29] dark:text-[#d8e2f2]'>
                                {sourceRequestRouteLabel(row.route)}
                            </span>
                            <CopyPayloadButton label='Source evidence request' payload={sourceEvidenceRequestPayloadFor(row, drilldown)} />
                            {row.href ? (
                                <a href={row.href} target='_blank' rel='noopener noreferrer' className='inline-flex min-h-7 max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[#d8dee9] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                                    <ExternalLink className='h-3 w-3' />
                                    Open source
                                </a>
                            ) : null}
                        </div>
                        {row.missing.length ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(row.missing.slice(0, 2))}</p>
                        ) : null}
                    </div>
                )) : (
                    <div className='rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-3 text-xs leading-5 text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'>
                        No source rows are attached to this queue item yet.
                    </div>
                )}
            </div>

            <div className='mt-3 grid gap-2 md:grid-cols-2'>
                <SourceDrilldownHandoff label='Alert handoff' ready={drilldown.alertHandoff.ready} endpoint={drilldown.alertHandoff.route || drilldown.alertHandoff.endpoint} missing={drilldown.alertHandoff.missing} />
                <SourceDrilldownHandoff label='Case handoff' ready={drilldown.caseHandoff.ready} endpoint={drilldown.caseHandoff.route || drilldown.caseHandoff.endpoint} missing={drilldown.caseHandoff.missing} />
            </div>
            {drilldown.blockers.length ? (
                <p className='mt-3 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(drilldown.blockers.slice(0, 3))}</p>
            ) : null}
        </div>
    )
}

function sourceEvidenceRequestPayloadFor(row: SelectedSourceDrilldownRow, drilldown: SelectedSourceDrilldown) {
    return {
        schemaVersion: 'ti.public_actor.source_evidence_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: drilldown.query,
        generatedAt: drilldown.generatedAt,
        selectedItemId: drilldown.selectedItem.id,
        selectedItemTitle: drilldown.selectedItem.title,
        rowId: row.rowId,
        sourceName: row.sourceName,
        sourceId: row.sourceId,
        provenance: row.provenance,
        href: row.href,
        captureId: row.captureId,
        reportDate: row.reportDate,
        confidence: row.confidence,
        state: row.state,
        ownerLane: row.ownerLane,
        route: row.route,
        missing: row.missing,
        handoff: row.handoff,
    }
}

function watchlistTermRequestPayloadFor(term: string, watchlist: WatchlistRelevance, actionability: TiActionabilityModel, query: string) {
    const parsed = watchlistTermParts(term)
    const matchingTerms = actionability.watchlistRelevance.terms.filter(item =>
        item.value.toLowerCase() === parsed.value.toLowerCase()
        || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase()
    )
    const matchingIntersections = actionability.orgRelevance.watchlistIntersections.filter(item =>
        item.value.toLowerCase() === parsed.value.toLowerCase()
        || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase()
    )
    const sourceEvidenceRefs = unique(matchingIntersections.flatMap(item => item.sourceEvidenceRefs))
    const sourceHealthRows = actionability.sourceHealthQueue.rows.filter(row =>
        sourceEvidenceRefs.some(ref => row.provenance.includes(ref) || row.sourceName.includes(ref) || row.sourceId === ref)
        || actionability.orgRelevance.sourceCoverage.some(source =>
            source.sourceName === row.sourceName
            && (source.sourceFamily === row.sourceFamily || source.provenance === row.provenance)
        )
    )
    const sourceIntakeItems = actionability.sourceEnrichmentIntake.items.filter(item =>
        sourceHealthRows.some(row => row.id === item.sourceHealthRowId)
        || item.requestedFields.some(field => /sourceProvenance|captureId|sourceRequestId/i.test(field))
    )
    const watchlistAction = actionability.actionPayloads.payloads.watchlistAdd
    return {
        schemaVersion: 'ti.public_actor.watchlist_term_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        kind: parsed.kind,
        value: parsed.value,
        route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
        blocked: actionability.exportPayloads.watchlist.blocked,
        missing: actionability.exportPayloads.watchlist.missing,
        matched: matchingTerms.some(item => item.matched) || matchingIntersections.length > 0,
        matchedOrganizations: unique([
            ...watchlist.organizations,
            ...matchingIntersections.map(item => item.organizationId).filter((value): value is string => Boolean(value)),
        ]).slice(0, 12),
        watchlistItemIds: unique(matchingIntersections.map(item => item.watchlistItemId).filter((value): value is string => Boolean(value))),
        alertIds: unique(matchingIntersections.flatMap(item => item.alertIds)),
        casePaths: unique(matchingIntersections.flatMap(item => item.casePaths)),
        sourceEvidenceRefs,
        provenance: actionability.exportPayloads.watchlist.provenance,
        sourceIntake: {
            schemaVersion: 'ti.public_actor.watchlist_source_intake.v1',
            route: actionability.sourceEnrichmentIntake.route,
            candidateTerm: {
                kind: parsed.kind,
                value: parsed.value,
                matched: matchingTerms.some(item => item.matched) || matchingIntersections.length > 0,
            },
            actionReadiness: {
                ready: watchlistAction.ready,
                unavailable: watchlistAction.unavailable,
                route: watchlistAction.route,
                backedRoute: watchlistAction.backedRoute,
                blockedBy: watchlistAction.blockedBy,
            },
            sourceCoverage: actionability.orgRelevance.sourceCoverage.filter(source =>
                sourceEvidenceRefs.some(ref => source.provenance.includes(ref) || source.sourceName.includes(ref) || source.sourceId === ref)
            ),
            sourceHealthRows,
            enrichmentItems: sourceIntakeItems,
            requestedFields: unique(sourceIntakeItems.flatMap(item => item.requestedFields)),
        },
    }
}

function watchlistTermParts(term: string): { kind: 'company' | 'domain' | 'vendor'; value: string } {
    const [kind, ...rest] = term.split(':')
    const value = rest.join(':').trim()
    if (value && (kind === 'company' || kind === 'domain' || kind === 'vendor')) return { kind, value }
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(term.trim())) return { kind: 'domain', value: term.trim() }
    return { kind: 'company', value: term.trim() }
}

function SourceDrilldownHandoff({ label, ready, endpoint, missing }: { label: string; ready: boolean; endpoint: string; missing: string[] }) {
    return (
        <div className='min-w-0 rounded-lg border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{label}</p>
                    <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{endpoint}</p>
                </div>
                <span className={ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{ready ? 'ready' : 'blocked'}</span>
            </div>
            <p className={ready ? 'mt-1 text-[11px] leading-5 text-[#147a3b] dark:text-[#83d9a1]' : 'mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'}>
                {ready ? 'Required source and routing context is present.' : displayRequirementList(missing.slice(0, 2)) || 'Required source and routing context is not attached.'}
            </p>
        </div>
    )
}

function analystWorkItemsFor(result: TiSearchResponse, victimObservations: ReturnType<typeof victimObservationsFor>, sourceUrlById: Map<string, string | undefined>, actionability: TiActionabilityModel): AnalystWorkItem[] {
    const priorityByRow = new Map(actionability.evidencePriority.map(priority => [priority.rowId, priority]))
    const activityItems: AnalystWorkItem[] = result.recentActivity.map((item, index) => {
        const href = item.url || item.sourceIds.map(id => sourceUrlById.get(id)).find(Boolean)
        const exposure = item.victimName || item.claimType === 'victim_claim' || /victim|leak|claim|stolen|exfiltrat|credential/i.test(`${item.title} ${item.detail}`)
        const id = `activity-${index}-${item.date}-${item.title}`.toLowerCase()
        const priority = priorityByRow.get(id)
        return {
            id,
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
            priority,
        }
    })

    const victimItems: AnalystWorkItem[] = victimObservations.map((item, index) => {
        const id = `victim-${index}-${item.victim}`.toLowerCase()
        return {
            id,
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
            priority: priorityByRow.get(id),
        }
    })

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
    if (items.length) return items.sort((a, b) => (b.priority?.score ?? 0) - (a.priority?.score ?? 0) || severityWeight(b.severity) - severityWeight(a.severity) || b.confidence - a.confidence)

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
        priority: priorityByRow.get('collection-searching'),
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

function WatchlistWorkflowPanel({ watchlist, actionability, query }: { watchlist: WatchlistRelevance; actionability: TiActionabilityModel; query: string }) {
    const terms = watchlist.terms.slice(0, 8)
    const matched = new Set(watchlist.matchedTerms.map(value => value.toLowerCase()))
    const blocked = actionability.exportPayloads.watchlist.blocked

    if (!terms.length) {
        return (
            <div data-ti-watchlist-term-requests='true' className='rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-3 text-xs leading-5 text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'>
                No customer-relevant watchlist term is attached yet. Use actor aliases, targets, source domains, campaigns, or tooling only after they are returned with provenance.
            </div>
        )
    }

    return (
        <div data-ti-watchlist-term-requests='true' className='grid min-w-0 gap-2'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='wrap-break-word text-sm font-semibold text-[#171a21] dark:text-[#eef4ff]'>{terms.length} candidate term{terms.length === 1 ? '' : 's'} for monitoring</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{watchlist.rationale}</p>
                </div>
                <span className={blocked ? decisionStepStatusClass('blocked') : actionability.watchlistRelevance.matches.length ? decisionStepStatusClass('ready') : decisionStepStatusClass('review')}>
                    {blocked ? 'blocked' : actionability.watchlistRelevance.matches.length ? 'ready' : 'review'}
                </span>
            </div>
            {terms.map(term => {
                const parsed = watchlistTermParts(term)
                const isMatched = matched.has(term.toLowerCase())
                    || actionability.watchlistRelevance.terms.some(item => item.matched && item.value.toLowerCase() === parsed.value.toLowerCase())
                return (
                    <div key={term} className='min-w-0 rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{parsed.kind}: {parsed.value}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                    {isMatched ? 'Persisted organization watchlist match returned.' : 'Candidate term requires authenticated organization review before monitoring.'}
                                </p>
                            </div>
                            <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                <span className={sourceHealthChipClass(isMatched ? 'ready' : blocked ? 'blocked' : 'review')}>{isMatched ? 'matched' : blocked ? 'blocked' : 'candidate'}</span>
                                <CopyPayloadButton label='Watchlist term request' payload={watchlistTermRequestPayloadFor(term, watchlist, actionability, query)} />
                            </div>
                        </div>
                    </div>
                )
            })}
            {actionability.watchlistRelevance.blockers.length ? (
                <p className='wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(actionability.watchlistRelevance.blockers.slice(0, 2))}</p>
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

function HandoffEvidenceMatrix({ actionability }: { actionability: TiActionabilityModel }) {
    const rows = [
        {
            id: 'watchlist',
            label: 'Watchlist',
            state: actionability.actionPayloads.payloads.watchlistAdd.ready,
            route: actionability.actionPayloads.payloads.watchlistAdd.backedRoute ?? actionability.actionPayloads.payloads.watchlistAdd.route,
            ids: [
                ...actionability.readiness.backedIds.organizationIds.slice(0, 2).map(id => `org ${id}`),
                ...actionability.readiness.backedIds.watchlistItemIds.slice(0, 2).map(id => `item ${id}`),
            ],
            provenance: actionability.actionPayloads.payloads.watchlistAdd.provenance,
            blocker: actionability.actionPayloads.payloads.watchlistAdd.blockedBy[0],
            missing: actionability.actionPayloads.payloads.watchlistAdd.blockedBy.map(blocker => blocker.handoff),
        },
        {
            id: 'alert',
            label: 'Alert rebuild',
            state: actionability.createAlertHandoff.ready,
            route: actionability.createAlertHandoff.backedRoute || actionability.createAlertHandoff.endpoint,
            ids: actionability.readiness.backedIds.alertIds.slice(0, 3).map(id => `alert ${id}`),
            provenance: actionability.actionPayloads.payloads.analystHandoffBundle.provenance,
            blocker: actionability.actionPayloads.payloads.analystHandoffBundle.blockedBy.find(blocker => blocker.ownerLane === 'alert'),
            missing: actionability.createAlertHandoff.missing,
        },
        {
            id: 'case',
            label: 'Case',
            state: actionability.caseHandoff.ready,
            route: actionability.caseHandoff.backedRoute || actionability.caseHandoff.endpoint,
            ids: [
                ...actionability.readiness.backedIds.caseIds.slice(0, 2).map(id => `case ${id}`),
                ...actionability.readiness.backedIds.casePaths.slice(0, 1),
            ],
            provenance: actionability.actionPayloads.payloads.caseHandoff.provenance,
            blocker: actionability.actionPayloads.payloads.caseHandoff.blockedBy[0],
            missing: actionability.caseHandoff.missing,
        },
        {
            id: 'delivery',
            label: 'Delivery',
            state: actionability.webhookDeliveryHandoff.ready,
            route: actionability.webhookDeliveryHandoff.backedRoute || actionability.webhookDeliveryHandoff.endpoint,
            ids: actionability.readiness.backedIds.webhookDestinationIds.slice(0, 3).map(id => `destination ${id}`),
            provenance: actionability.actionPayloads.payloads.webhookDelivery.provenance,
            blocker: actionability.actionPayloads.payloads.webhookDelivery.blockedBy[0],
            missing: actionability.webhookDeliveryHandoff.missing,
        },
        {
            id: 'source',
            label: 'Source enrichment',
            state: actionability.actionPayloads.payloads.sourceEnrichment.ready,
            route: actionability.actionPayloads.payloads.sourceEnrichment.backedRoute ?? actionability.actionPayloads.payloads.sourceEnrichment.route,
            ids: actionability.readiness.backedIds.captureIds.slice(0, 3).map(id => `capture ${id}`),
            provenance: actionability.actionPayloads.payloads.sourceEnrichment.provenance,
            blocker: actionability.actionPayloads.payloads.sourceEnrichment.blockedBy.find(blocker => blocker.ownerLane === 'source') ?? actionability.actionPayloads.payloads.sourceEnrichment.blockedBy[0],
            missing: actionability.actionPayloads.payloads.sourceEnrichment.blockedBy.map(blocker => blocker.handoff),
        },
    ]
    const readyCount = rows.filter(row => row.state).length

    return (
        <div data-ti-handoff-evidence-matrix='true' className='min-w-0 rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Handoff evidence</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {readyCount} of {rows.length} handoffs have backed IDs, route, and provenance ready for authenticated review.
                    </p>
                </div>
                <span className={readyCount === rows.length ? decisionStepStatusClass('ready') : readyCount ? decisionStepStatusClass('review') : decisionStepStatusClass('blocked')}>
                    {readyCount}/{rows.length} ready
                </span>
            </div>
            <div className='mt-3 grid min-w-0 gap-2'>
                {rows.map(row => (
                    <div key={row.id} className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{row.label}</p>
                                <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{row.route}</p>
                            </div>
                            <span className={row.state ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                {row.state ? 'ready' : 'blocked'}
                            </span>
                        </div>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            {row.ids.length ? row.ids.map(id => (
                                <span key={id} className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>{id}</span>
                            )) : <span className='rounded-md border border-[#fff0c2] bg-[#fffdf2] px-2 py-1 text-[11px] font-semibold text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'>ID needed</span>}
                            {row.provenance.slice(0, 2).map(item => (
                                <span key={`${row.id}-source-${item.sourceName}-${item.provenance}`} className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>{item.sourceName}</span>
                            ))}
                            {row.provenance.filter(item => item.captureId).slice(0, 2).map(item => (
                                <span key={`${row.id}-capture-${item.captureId}`} className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>capture {item.captureId}</span>
                            ))}
                        </div>
                        {row.blocker ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{readinessOwnerLabel(row.blocker.ownerLane)}: {displayRequirementText(row.blocker.handoff)}</p>
                        ) : row.missing.length ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(row.missing.slice(0, 2))}</p>
                        ) : (
                            <p className='mt-2 text-[11px] leading-5 text-[#147a3b] dark:text-[#83d9a1]'>Required identifiers and provenance are present.</p>
                        )}
                    </div>
                ))}
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
            <div className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3'>
                <DecisionFlow steps={decisionSteps} disposition={actionability.alertDisposition} shouldAlert={actionability.shouldAlert} rationale={actionability.rationale} />
                <HandoffEvidenceMatrix actionability={actionability} />
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

                <div className='grid min-w-0 gap-2'>
                    <Link href='/dashboard/dwm' className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                        <ExternalLink className='h-3.5 w-3.5' />
                        Open console
                    </Link>
                    {casePath ? (
                        <a href={casePath} className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                            <ExternalLink className='h-3.5 w-3.5' />
                            Open related case
                        </a>
                    ) : (
                        <button type='button' disabled title={displayRequirementList(actionability.handoffs.caseBlockers)} className='inline-flex min-h-9 w-fit max-w-full cursor-not-allowed items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-lg border border-[#d8dee9] bg-[#f2f4f7] px-3 py-2 text-xs font-semibold text-[#98a2b3] dark:border-[#314057] dark:bg-[#172131] dark:text-[#77869a]'>
                            <ClipboardList className='h-3.5 w-3.5' />
                            Create case
                        </button>
                    )}
                </div>

                {!casePath && actionability.handoffs.casePayload ? (
                    <PayloadHandoffRow
                        label='Case handoff'
                        detail={actionability.caseHandoff.blocked ? `Blocked until ${displayRequirementList(actionability.caseHandoff.missing.slice(0, 2))}.` : 'Case request is prepared for authenticated review.'}
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

type RelatedRecordRow = {
    id: string
    label: string
    meta: string
    route?: string
    kind: 'Alert' | 'Case'
    recordId: string
}

function RelatedRecordsPanel({ actionability, query }: { actionability: TiActionabilityModel; query: string }) {
    const caseIntake = actionability.caseReviewIntake
    const records: RelatedRecordRow[] = [
        ...actionability.relatedAlerts.map(alert => ({
            id: `alert:${alert.id}`,
            label: alert.title || alert.id,
            meta: [alert.id, alert.status, alert.severity].filter(Boolean).join(' · '),
            route: alert.casePath || alert.recommendedRoute,
            kind: 'Alert' as const,
            recordId: alert.id,
        })),
        ...actionability.relatedCases.map(item => ({
            id: `case:${item.id}`,
            label: item.title || item.id,
            meta: [item.id, item.status, item.priority].filter(Boolean).join(' · '),
            route: item.path,
            kind: 'Case' as const,
            recordId: item.id,
        })),
    ]

    return (
        <div className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Related alerts/cases</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {records.length} linked record{records.length === 1 ? '' : 's'} · {actionability.caseReplayReadiness.summary.ready} replay-ready · {actionability.webhookDeliveryHandoff.ready ? 'delivery ready' : 'delivery blocked'}
                    </p>
                </div>
                <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span data-ti-case-replay-readiness='true' className='inline-flex'>
                        <CopyPayloadButton label='Case replay readiness' payload={actionability.caseReplayReadiness} />
                    </span>
                    <CopyPayloadButton label='Related alerts and cases' payload={{ alerts: actionability.relatedAlerts, cases: actionability.relatedCases, caseReplayReadiness: actionability.caseReplayReadiness, blockers: actionability.readiness.blockers }} />
                </div>
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
                                <div data-ti-related-record-export='true' className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                    {record.route ? (
                                        <a href={record.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                                            <ExternalLink className='h-3.5 w-3.5' />
                                            Open
                                        </a>
                                    ) : null}
                                    <CopyPayloadButton label='Related record' payload={relatedRecordHandoffPayloadFor(record, actionability, query)} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className='mt-3 rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-3 dark:border-[#5a4316] dark:bg-[#231b0c]'>
                    <div data-ti-case-review-intake='true' className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                        <div className='min-w-0'>
                            <p className='text-xs font-semibold uppercase text-[#8a5a00]'>Case review intake</p>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-[#8a5a00]'>
                                {caseIntake.summary.total} candidate{caseIntake.summary.total === 1 ? '' : 's'} for {query} · {actionability.caseReplayReadiness.summary.ready} replay-ready · {caseIntake.summary.captures} capture{caseIntake.summary.captures === 1 ? '' : 's'}
                            </p>
                        </div>
                        <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                            <CopyPayloadButton label='Case replay readiness' payload={actionability.caseReplayReadiness} />
                            <CopyPayloadButton label='Case review intake' payload={caseIntake} />
                        </div>
                    </div>
                    <div className='mt-2 grid min-w-0 gap-2'>
                        {caseIntake.items.slice(0, 3).map(item => (
                            <div key={item.id} className='rounded-md border border-[#ffe6a3] bg-white/70 p-2 dark:border-[#5a4316] dark:bg-[#1a1409]'>
                                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='wrap-break-word text-xs font-semibold text-[#8a5a00] dark:text-[#ffd77a]'>{item.title}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>
                                            {formatLabel(item.recommendedAction)} · {item.reasons.length} reason{item.reasons.length === 1 ? '' : 's'} · {item.blockedBy.length} blocker{item.blockedBy.length === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                    <span className={sourceHealthChipClass(item.state === 'ready' ? 'ready' : item.state === 'blocked' ? 'blocked' : 'review')}>{decisionStepStatusLabel(item.state)}</span>
                                </div>
                                <div className='mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                                    <p className='min-w-0 break-all font-mono text-[11px] text-[#8a5a00] dark:text-[#ffd77a]'>{item.casePaths[0] || item.route}</p>
                                    <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                        <CopyPayloadButton label='Replay export' payload={caseReplayCandidatePayloadFor(item, actionability)} />
                                        <CopyPayloadButton label='Case candidate' payload={caseReviewCandidatePayloadFor(item, query)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className='mt-2 wrap-break-word text-xs leading-5 text-[#8a5a00]'>No alert or case ID is attached yet; rebuild alerts after saving a matching watchlist term or attach capture evidence before case creation.</p>
                </div>
            )}
        </div>
    )
}

function relatedRecordHandoffPayloadFor(record: RelatedRecordRow, actionability: TiActionabilityModel, query: string) {
    const alert = record.kind === 'Alert' ? actionability.relatedAlerts.find(item => item.id === record.recordId) : undefined
    const relatedCase = record.kind === 'Case' ? actionability.relatedCases.find(item => item.id === record.recordId) : undefined
    const matchingCaseItems = actionability.caseReviewIntake.items.filter(item =>
        item.alertIds.includes(record.recordId)
        || item.casePaths.includes(record.route ?? '')
        || (alert?.casePath ? item.casePaths.includes(alert.casePath) : false)
        || (relatedCase?.path ? item.casePaths.includes(relatedCase.path) : false)
    )
    const deliveryBlockers = alert?.deliveryReadinessContext?.blockerCodes ?? []
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        row.alertIds.includes(record.recordId)
        || row.caseId === record.recordId
        || row.provenance.casePaths.includes(record.route ?? '')
    )
    return {
        schemaVersion: 'ti.public_actor.related_record_handoff.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        record: {
            id: record.recordId,
            kind: record.kind.toLowerCase(),
            label: record.label,
            meta: record.meta,
            route: record.route,
        },
        alert,
        case: relatedCase,
        caseReviewIntake: matchingCaseItems,
        caseReplayReadiness: {
            schemaVersion: actionability.caseReplayReadiness.schemaVersion,
            routeTemplate: actionability.caseReplayReadiness.routeTemplate,
            rows: replayRows,
            safeOutput: actionability.caseReplayReadiness.safeOutput,
        },
        sourceProvenance: actionability.sourceProvenance,
        readiness: {
            publicTi: actionability.readiness,
            consumer: actionability.consumerReadiness,
            delivery: alert?.deliveryReadinessContext,
            blockers: [
                ...actionability.readiness.blockers,
                ...deliveryBlockers.map(code => ({
                    schemaVersion: 'ti.public_actor.readiness_blocker.v1' as const,
                    code,
                    category: 'webhook' as const,
                    ownerLane: 'webhook' as const,
                    field: `relatedAlerts.${record.recordId}.deliveryReadinessContext`,
                    detail: `Delivery readiness blocker: ${code}.`,
                    route: '/dashboard/dwm',
                    handoff: 'Resolve delivery readiness before sending or replaying this alert.',
                    source: 'delivery_readiness' as const,
                })),
            ],
        },
        handoffRoutes: {
            alertRebuild: actionability.createAlertHandoff.backedRoute,
            case: record.route || actionability.caseHandoff.backedRoute,
            sourceEnrichment: actionability.exportPayloads.enrichment.backedRoute,
            webhookDelivery: actionability.webhookDeliveryHandoff.backedRoute,
        },
    }
}

function caseReplayCandidatePayloadFor(item: CaseReviewIntakeItem, actionability: TiActionabilityModel) {
    const replayRow = actionability.caseReplayReadiness.rows.find(row => row.caseReviewIntakeItemId === item.id)
    return {
        schemaVersion: 'ti.public_actor.case_replay_candidate_export.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: actionability.caseReplayReadiness.query,
        generatedAt: actionability.caseReplayReadiness.generatedAt,
        routeTemplate: actionability.caseReplayReadiness.routeTemplate,
        candidate: item,
        replayReadiness: replayRow,
        safeOutput: actionability.caseReplayReadiness.safeOutput,
    }
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
            <div data-ti-org-actor-identity='true' className='mt-3 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Actor identity</p>
                        <p className='mt-1 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{proof.actorIdentity.canonicalName} · {proof.actorIdentity.actorClass}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                            {proof.actorIdentity.aliases.length ? `${proof.actorIdentity.aliases.slice(0, 4).join(', ')}` : 'Aliases not attached'} · {proof.actorIdentity.sectors.length} sector{proof.actorIdentity.sectors.length === 1 ? '' : 's'} · {proof.actorIdentity.regions.length} region{proof.actorIdentity.regions.length === 1 ? '' : 's'}
                        </p>
                    </div>
                    <span className={proof.enrichmentGaps.some(gap => gap.code.startsWith('missing_actor') || gap.code.startsWith('missing_target')) ? decisionStepStatusClass('review') : decisionStepStatusClass('ready')}>
                        {proof.enrichmentGaps.some(gap => gap.code.startsWith('missing_actor') || gap.code.startsWith('missing_target')) ? 'Review' : 'Ready'}
                    </span>
                </div>
                <div className='mt-2 flex flex-wrap gap-1.5'>
                    {[...proof.actorIdentity.sectors.slice(0, 4), ...proof.actorIdentity.regions.slice(0, 4)].map(value => (
                        <span key={value} className='max-w-full wrap-break-word rounded-md bg-[#eef3ff] px-2 py-1 text-[11px] font-semibold text-[#3056d3] dark:bg-[#16213a] dark:text-[#9db4ff]'>{value}</span>
                    ))}
                </div>
            </div>
            <div data-ti-org-source-coverage='true' className='mt-3 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Source coverage</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                            {proof.sourceCoverage.length} source{proof.sourceCoverage.length === 1 ? '' : 's'} · {proof.sourceCoverage.filter(source => source.status === 'capture_ready').length} capture-ready · {proof.sourceCoverage.filter(source => source.status === 'missing_capture').length} missing capture
                        </p>
                    </div>
                    <span className={proof.sourceCoverage.some(source => source.status === 'missing_capture') || !proof.sourceCoverage.length ? decisionStepStatusClass('blocked') : decisionStepStatusClass('ready')}>
                        {proof.sourceCoverage.some(source => source.status === 'missing_capture') || !proof.sourceCoverage.length ? 'Blocked' : 'Ready'}
                    </span>
                </div>
                <div className='mt-2 grid gap-2'>
                    {proof.sourceCoverage.length ? proof.sourceCoverage.slice(0, 3).map(source => (
                        <div key={`${source.sourceId ?? source.sourceName}-${source.provenance}`} className='rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{source.sourceName}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                        {formatLabel(source.sourceFamily)} · {formatLabel(source.status)}{source.lastCollectedAt ? ` · ${formatDate(source.lastCollectedAt)}` : ''}
                                    </p>
                                    <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{source.captureId ? `capture ${source.captureId}` : source.provenance}</p>
                                </div>
                                {typeof source.confidence === 'number' ? <span className='shrink-0 text-[11px] font-semibold text-[#667085] dark:text-[#9aa8bd]'>{Math.round(source.confidence * 100)}%</span> : null}
                            </div>
                        </div>
                    )) : (
                        <p className='rounded-md border border-[#fff0c2] bg-[#fffdf2] p-2 text-xs leading-5 text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c]'>No source coverage row is attached to this actor result.</p>
                    )}
                </div>
            </div>
            <div data-ti-watchlist-intersections='true' className='mt-3 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Watchlist intersections</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                            {proof.watchlistIntersections.length} intersection{proof.watchlistIntersections.length === 1 ? '' : 's'} · {proof.watchlistIntersections.filter(item => item.alertIds.length).length} with alerts · {proof.watchlistIntersections.filter(item => item.casePaths.length).length} with cases
                        </p>
                    </div>
                    <span className={proof.watchlistIntersections.some(item => item.state === 'ready') ? decisionStepStatusClass('ready') : decisionStepStatusClass(proof.watchlistIntersections.length ? 'review' : 'blocked')}>
                        {proof.watchlistIntersections.some(item => item.state === 'ready') ? 'ready' : proof.watchlistIntersections.length ? 'review' : 'blocked'}
                    </span>
                </div>
                <div className='mt-2 grid gap-2'>
                    {proof.watchlistIntersections.length ? proof.watchlistIntersections.slice(0, 4).map(item => (
                        <div key={item.intersectionId} className='rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{item.kind}: {item.value}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                        {watchlistIntersectionActionLabel(item.recommendedAction)} · {item.organizationId ? `org ${item.organizationId}` : 'organization needed'} · {item.watchlistItemId ? `watchlist item ${item.watchlistItemId}` : 'watchlist item needed'}
                                    </p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                                        {item.sourceFamilies.map(formatLabel).join(', ') || 'source family needed'} · {item.captureIds.length ? `${item.captureIds.length} capture${item.captureIds.length === 1 ? '' : 's'}` : 'capture needed'} · {item.alertIds.length ? `${item.alertIds.length} alert${item.alertIds.length === 1 ? '' : 's'}` : 'alert needed'}
                                    </p>
                                    {item.blockers.length ? <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementText(item.blockers[0].handoff)}</p> : null}
                                </div>
                                <span className={decisionStepStatusClass(item.state)}>{decisionStepStatusLabel(item.state)}</span>
                            </div>
                            <div className='mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                                <p className='min-w-0 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{item.casePath || item.route}</p>
                                <CopyPayloadButton label='Watchlist intersection' payload={watchlistIntersectionPayloadFor(item)} />
                            </div>
                        </div>
                    )) : (
                        <p className='rounded-md border border-[#fff0c2] bg-[#fffdf2] p-2 text-xs leading-5 text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c]'>No organization watchlist intersection is attached yet.</p>
                    )}
                </div>
            </div>
            {proof.enrichmentGaps.length ? (
                <div data-ti-org-enrichment-gaps='true' className='mt-3 rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-2 dark:border-[#5a4316] dark:bg-[#231b0c]'>
                    <p className='text-xs font-semibold uppercase text-[#8a5a00]'>Enrichment needed</p>
                    <div className='mt-2 grid gap-2'>
                        {proof.enrichmentGaps.slice(0, 4).map(gap => (
                            <div key={`${gap.code}-${gap.field}`} className='rounded-md border border-[#ffe6a3] bg-white/70 p-2 dark:border-[#5a4316] dark:bg-[#1a1409]'>
                                <div className='flex flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='wrap-break-word text-xs font-semibold text-[#8a5a00]'>{formatLabel(gap.code)}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{displayRequirementText(gap.detail)}</p>
                                    </div>
                                    <span className='shrink-0 rounded-md bg-[#fff4cc] px-2 py-1 text-[11px] font-semibold text-[#8a5a00] dark:bg-[#33270d]'>{readinessOwnerLabel(gap.ownerLane)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
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
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{displayRequirementText(row.label)}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{displayRequirementText(row.action)} · {formatLabel(row.sourceFamily)} · {readinessOwnerLabel(row.ownerLane)}</p>
                                        <p data-ti-org-row-evidence='true' className='mt-1 wrap-break-word text-[11px] leading-5 text-[#475467] dark:text-[#c3cee0]'>
                                            {evidenceMeta.length ? evidenceMeta.join(' · ') : 'Evidence metadata pending'} · {row.evidence.summary}
                                        </p>
                                        <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{row.route}</p>
                                        {row.alertId || row.watchlistItemId || row.captureIds.length ? (
                                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                                                {[row.alertId ? `alert ${row.alertId}` : '', row.watchlistItemId ? `watchlist item ${row.watchlistItemId}` : '', row.captureIds.length ? `${row.captureIds.length} capture${row.captureIds.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')}
                                            </p>
                                        ) : null}
                                        {rowBlocker ? <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{displayRequirementText(rowBlocker.handoff)}</p> : null}
                                    </div>
                                    <span className={decisionStepStatusClass(row.state)}>{decisionStepStatusLabel(row.state)}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : null}
            {firstBlocker ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{readinessOwnerLabel(firstBlocker.ownerLane)}: {displayRequirementText(firstBlocker.handoff)}</p>
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
        <div data-public-ti-action-exports='true' className='min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Action exports</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>Validated request bodies for authenticated review. Copying does not change customer state.</p>
                </div>
                <CopyPayloadButton label='Action exports' payload={actionability.actionPayloads} />
            </div>
            <div className='mt-3 grid gap-2'>
                {payloads.map(payload => {
                    const primaryBlocker = payload.blockedBy[0]
                    const summaryLines = actionPayloadSummaryLines(payload, actionability)
                    return (
                        <div key={payload.kind} className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <div className='flex min-w-0 flex-wrap items-center gap-2'>
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{payload.label}</p>
                                        <span className={payload.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                            {payload.ready ? 'Ready' : 'Unavailable'}
                                        </span>
                                    </div>
                                    <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{payload.route}</p>
                                    {summaryLines.length ? (
                                        <div data-ti-action-export-summary='true' className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                            {summaryLines.map(line => (
                                                <span key={`${payload.kind}-${line}`} className={sourceHealthChipClass(payload.ready ? 'ready' : primaryBlocker ? 'blocked' : 'review')}>
                                                    {line}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                    {primaryBlocker ? (
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{readinessOwnerLabel(primaryBlocker.ownerLane)}: {displayRequirementText(primaryBlocker.handoff)}</p>
                                    ) : (
                                        <p className='mt-1 text-[11px] leading-5 text-[#147a3b]'>Required IDs and provenance are present.</p>
                                    )}
                                </div>
                                <div className='flex min-w-0 w-full flex-wrap items-center justify-start gap-1.5 sm:w-auto sm:justify-end sm:shrink-0'>
                                    {payload.backedRoute ? (
                                        <a href={payload.backedRoute} className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
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

function actionPayloadSummaryLines(
    payload: TiActionabilityModel['actionPayloads']['payloads'][keyof TiActionabilityModel['actionPayloads']['payloads']],
    actionability: TiActionabilityModel,
) {
    if (payload.kind === 'watchlist_add') {
        return [
            `${actionability.watchlistRelevance.terms.length} watchlist term${actionability.watchlistRelevance.terms.length === 1 ? '' : 's'}`,
            `${actionability.watchlistRelevance.matches.length} org match${actionability.watchlistRelevance.matches.length === 1 ? '' : 'es'}`,
            `${payload.blockedBy.length} blocker${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'case_handoff') {
        return [
            `${actionability.caseReviewIntake.summary.total} case candidate${actionability.caseReviewIntake.summary.total === 1 ? '' : 's'}`,
            `${actionability.caseReviewIntake.summary.alerts} alert${actionability.caseReviewIntake.summary.alerts === 1 ? '' : 's'}`,
            `${actionability.caseReviewIntake.summary.captures} capture${actionability.caseReviewIntake.summary.captures === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} blocker${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'webhook_delivery') {
        return [
            `${actionability.readiness.backedIds.webhookDestinationIds.length} destination${actionability.readiness.backedIds.webhookDestinationIds.length === 1 ? '' : 's'}`,
            `${actionability.readiness.backedIds.captureIds.length} capture${actionability.readiness.backedIds.captureIds.length === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} blocker${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'analyst_handoff_bundle') {
        return [
            `${actionability.consumerReadiness.stages.length} workflow stage${actionability.consumerReadiness.stages.length === 1 ? '' : 's'}`,
            `${actionability.alertGenerationReadiness.candidateCount} alert candidate${actionability.alertGenerationReadiness.candidateCount === 1 ? '' : 's'}`,
            actionability.alertGenerationReadiness.generationEvidenceWindowReady ? 'evidence window ready' : 'evidence window pending',
            `${actionability.readiness.backedIds.alertIds.length} alert${actionability.readiness.backedIds.alertIds.length === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} blocker${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    return [
        `${actionability.sourceEnrichmentIntake.summary.total} intake item${actionability.sourceEnrichmentIntake.summary.total === 1 ? '' : 's'}`,
        `${actionability.sourceEnrichmentIntake.summary.sourceRequests} source request${actionability.sourceEnrichmentIntake.summary.sourceRequests === 1 ? '' : 's'}`,
        `${actionability.sourceEnrichmentIntake.summary.captures} capture${actionability.sourceEnrichmentIntake.summary.captures === 1 ? '' : 's'}`,
        `${payload.blockedBy.length} blocker${payload.blockedBy.length === 1 ? '' : 's'}`,
    ]
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
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-[#8a5a00]'>{displayRequirementText(blocker.detail)}</p>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{displayRequirementText(blocker.handoff)}</p>
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
        <div data-ti-consumer-readiness='true' className='rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
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
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {stage.request ? (
                                        <span className='max-w-full break-all rounded-md border border-[#dfe5ee] bg-white px-2 py-1 font-mono text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
                                            {stage.request.method} {stage.request.path}
                                        </span>
                                    ) : null}
                                    <span className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
                                        {stage.payload.provenance.length} provenance row{stage.payload.provenance.length === 1 ? '' : 's'}
                                    </span>
                                    {stage.missing.length ? (
                                        <span className='max-w-full wrap-break-word rounded-md border border-[#fff0c2] bg-[#fffdf2] px-2 py-1 text-[11px] font-semibold text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'>
                                            {stage.missing.length} blocker{stage.missing.length === 1 ? '' : 's'}
                                        </span>
                                    ) : null}
                                </div>
                                <div data-ti-consumer-field-readiness='true' className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {consumerRequestFields(stage).map(field => (
                                        <span key={`${stage.id}-${field.label}`} className={consumerFieldClass(field.state)}>
                                            {field.label}: {field.value}
                                        </span>
                                    ))}
                                </div>
                                {stage.missing.length ? (
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{displayRequirementList(stage.missing.slice(0, 2))}</p>
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

type ConsumerRequestField = {
    label: string
    value: string
    state: DecisionStep['status']
}

function consumerRequestFields(stage: TiActionabilityModel['consumerReadiness']['stages'][number]): ConsumerRequestField[] {
    const body = stage.request?.body ?? {}
    const specs: Record<TiActionabilityModel['consumerReadiness']['stages'][number]['id'], Array<{ key: string; label: string; required: boolean }>> = {
        publicTi: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'terms', label: 'Terms', required: true },
        ],
        orgWatchlist: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'watchlistId', label: 'Watchlist', required: true },
            { key: 'watchlistItemIds', label: 'Items', required: true },
        ],
        caseHandoff: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'alertId', label: 'Alert', required: true },
            { key: 'captureIds', label: 'Captures', required: true },
            { key: 'casePath', label: 'Case path', required: false },
        ],
        webhookTrigger: [
            { key: 'organizationId', label: 'Org', required: true },
            { key: 'alertId', label: 'Alert', required: true },
            { key: 'webhookDestinationIds', label: 'Destination', required: true },
            { key: 'captureIds', label: 'Captures', required: true },
            { key: 'idempotencyKey', label: 'Idempotency', required: true },
        ],
        enrichment: [
            { key: 'tasks', label: 'Tasks', required: true },
            { key: 'sources', label: 'Sources', required: false },
        ],
    }

    return specs[stage.id]
        .map(spec => {
            const value = readRequestField(body[spec.key])
            return {
                label: spec.label,
                value: value ?? 'needed',
                state: value ? 'ready' as const : spec.required ? 'blocked' as const : 'review' as const,
            }
        })
        .filter(field => field.state !== 'review' || field.value !== 'needed')
}

function readRequestField(value: unknown) {
    if (Array.isArray(value)) return value.length ? `${value.length}` : ''
    if (typeof value === 'string') return value.trim() ? value : ''
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
    if (typeof value === 'boolean') return value ? 'yes' : 'no'
    if (value && typeof value === 'object') return Object.keys(value).length ? 'set' : ''
    return ''
}

function consumerFieldClass(state: DecisionStep['status']) {
    if (state === 'ready') return 'max-w-full wrap-break-word rounded-md border border-[#d6eadf] bg-[#f1fbf5] px-2 py-1 text-[11px] font-semibold text-[#147a3b] dark:border-[#214833] dark:bg-[#102218] dark:text-[#83d9a1]'
    if (state === 'review') return 'max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'
    return 'max-w-full wrap-break-word rounded-md border border-[#fff0c2] bg-[#fffdf2] px-2 py-1 text-[11px] font-semibold text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'
}

function sourceHealthChipClass(state: SourceHealthRow['state']) {
    if (state === 'ready') return 'max-w-full wrap-break-word rounded-md border border-[#d6eadf] bg-[#f1fbf5] px-2 py-1 text-[11px] font-semibold text-[#147a3b] dark:border-[#214833] dark:bg-[#102218] dark:text-[#83d9a1]'
    if (state === 'review') return 'max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'
    return 'max-w-full wrap-break-word rounded-md border border-[#fff0c2] bg-[#fffdf2] px-2 py-1 text-[11px] font-semibold text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'
}

function sourceHealthEvidenceLabel(row: SourceHealthRow) {
    if (row.captureId) return `capture ${row.captureId}`
    const hasFieldPath = row.provenance.includes('[') || row.provenance.includes(']') || /sourceProvenance|relatedAlerts|handoffs|actorIntelligence/i.test(row.provenance)
    if (hasFieldPath) {
        return `${formatLabel(row.sourceFamily)} evidence request`
    }
    return row.provenance
}

function sourceHealthFieldLabel(value: string) {
    if (/captureId/i.test(value)) return 'capture ID'
    if (/sourceRequestId/i.test(value)) return 'source request ID'
    if (/reportDate|lastSeen|firstReportedAt/i.test(value)) return 'report date'
    if (/sourceId/i.test(value)) return 'source ID'
    if (/provenance|sourceUrl|url/i.test(value)) return 'source reference'
    if (/relatedAlerts.*id|alertId/i.test(value)) return 'alert ID'
    if (/casePath|caseId/i.test(value)) return 'case route'
    if (/webhookDestination/i.test(value)) return 'webhook destination'
    if (/organizationId|tenantId/i.test(value)) return 'organization scope'
    if (/watchlistItem|watchlistId/i.test(value)) return 'watchlist item'
    if (/endpoint|route/i.test(value)) return 'workflow route'
    return formatLabel(value.replace(/\[\]/g, '').replace(/\./g, ' '))
}

function handoffMissingLabel(values: string[]) {
    return unique(values.map(value => {
        if (/sourceProvenance|capture|source request|source URL|source hash|url/i.test(value)) return sourceHealthFieldLabel(value)
        if (/organization|org|tenant/i.test(value)) return 'organization scope'
        if (/watchlist/i.test(value)) return 'watchlist item'
        if (/alert/i.test(value)) return 'alert ID'
        if (/case/i.test(value)) return 'case route'
        if (/webhook|destination/i.test(value)) return 'webhook destination'
        if (/fresh|stale|after/i.test(value)) return 'fresh source evidence'
        return value
    })).join('; ')
}

function displayRequirementText(value: string) {
    return value
        .replace(/TiSearchResponse\.actorIntelligence\.malwareTools\/campaigns/gi, 'actor tooling and campaign fields')
        .replace(/actorIntelligence\.structuredProvenance\[\]\.reportDate/gi, 'source report date')
        .replace(/sourceProvenance\[\]\.sourceRequestId/gi, 'source request ID')
        .replace(/sourceProvenance\[\]\.captureId/gi, 'capture ID')
        .replace(/sourceProvenance\[\]\.sourceId/gi, 'source ID')
        .replace(/sourceProvenance\[\]\.provenance/gi, 'source reference')
        .replace(/relatedAlerts\[\]\.casePath/gi, 'alert case route')
        .replace(/relatedAlerts\[\]\.id/gi, 'alert ID')
        .replace(/relatedCases\[\]\.path/gi, 'case route')
        .replace(/handoffs\.alertRebuild\.endpoint/gi, 'alert rebuild route')
        .replace(/sourceProvenance\[\]/gi, 'source evidence')
        .replace(/actorIntelligence\./gi, 'actor intelligence ')
        .replace(/handoffs\./gi, '')
        .replace(/relatedAlerts\[\]/gi, 'related alerts')
}

function displayRequirementList(values: string[]) {
    return unique(values.map(displayRequirementText)).join('; ')
}

function sourceRequestCaptureClass(ready: boolean) {
    return ready
        ? 'max-w-full wrap-break-word rounded-md bg-[#e9f8ef] px-1.5 py-0.5 text-[10px] font-semibold text-[#147a3b] dark:bg-[#102218] dark:text-[#83d9a1]'
        : 'max-w-full wrap-break-word rounded-md bg-[#fff1f0] px-1.5 py-0.5 text-[10px] font-semibold text-[#b42318] dark:bg-[#2b1716] dark:text-[#ffaaa3]'
}

function sourceRequestFamilyLabel(value: string) {
    if (value === 'source_capture') return 'source capture'
    return formatLabel(value)
}

function sourceRequestRouteLabel(value: string) {
    if (value === '/dashboard/ti/enrichment') return 'source queue'
    return 'review route'
}

function actionOwnerLabel(value: string) {
    if (value === 'org') return 'watchlist'
    if (value === 'alert') return 'alerting'
    if (value === 'case') return 'casework'
    if (value === 'source') return 'source review'
    return 'review'
}

function artifactReferenceChips(refs: NonNullable<ActorArtifactHandoffs['authBridge']['payload']['evidenceRefs']>) {
    return [
        { label: 'captures', value: refs.captureIds.length },
        { label: 'alerts', value: refs.alertIds.length },
        { label: 'cases', value: refs.casePaths.length },
        { label: 'watch terms', value: refs.watchlistTerms.length },
        { label: 'sources', value: refs.sourceNames.length },
    ].filter(item => item.value > 0)
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
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00]'>{displayRequirementList(step.missing.slice(0, 2))}</p>
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
        <div className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <div className='flex min-w-0 flex-wrap items-center gap-2'>
                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{label}</p>
                        <span className={blocked ? 'rounded-md bg-[#fff4d6] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a5a00]' : 'rounded-md bg-[#e9f8ef] px-1.5 py-0.5 text-[10px] font-semibold text-[#147a3b]'}>
                            {blocked ? 'blocked' : 'ready'}
                        </span>
                    </div>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{detail}</p>
                </div>
                <div className='flex min-w-0 w-full flex-wrap items-center justify-start gap-1.5 sm:w-auto sm:justify-end sm:shrink-0'>
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
    const resetTimerRef = useRef<number | null>(null)

    useEffect(() => {
        return () => {
            if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
        }
    }, [])

    function resetLater(delay: number) {
        if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = window.setTimeout(() => {
            resetTimerRef.current = null
            setState('idle')
        }, delay)
    }

    async function copyPayload() {
        const text = JSON.stringify(payload, null, 2)
        try {
            await navigator.clipboard.writeText(text)
            setState('copied')
            resetLater(1800)
        } catch {
            setState('failed')
            resetLater(2200)
        }
    }

    return (
        <button type='button' onClick={copyPayload} className='inline-flex min-h-8 min-w-16 max-w-full items-center justify-center gap-1.5 justify-self-start whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]' aria-label={`Copy ${label} payload`}>
            {state === 'copied' ? <CheckCircle2 className='h-3.5 w-3.5 text-[#147a3b]' /> : <Copy className='h-3.5 w-3.5' />}
            {state === 'copied' ? 'Copied' : state === 'failed' ? 'Unavailable' : 'Copy'}
        </button>
    )
}

function EnrichmentTasksPanel({ tasks, intake }: { tasks: EnrichmentTask[]; intake: TiActionabilityModel['sourceEnrichmentIntake'] }) {
    return (
        <Panel title='Collection Gaps' description='Source, capture, and data work required before this result can support stronger alerts.' icon={<Database className='h-4 w-4' />}>
            <div className='mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <p className='wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                    <span className='font-semibold text-[#344054] dark:text-[#d8e2f2]'>Source enrichment intake</span> · {intake.summary.total} intake item{intake.summary.total === 1 ? '' : 's'} · {intake.summary.sourceRequests} source request{intake.summary.sourceRequests === 1 ? '' : 's'} · {intake.summary.captures} capture{intake.summary.captures === 1 ? '' : 's'}
                </p>
                <CopyPayloadButton label='Source enrichment intake' payload={intake} />
            </div>
            <div data-ti-collection-gap-intake='true' className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2'>
                {tasks.map(task => {
                    const payload = collectionGapTaskPayloadFor(task, intake)
                    return (
                        <div key={task.title} data-ti-collection-gap-task-export='true' className='min-w-0 max-w-full overflow-hidden rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{task.title}</p>
                                <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                    <span className={`${taskStatusClass(task.status)} shrink-0 whitespace-nowrap`}>{taskStatusLabel(task.status)}</span>
                                    <CopyPayloadButton label='Collection gap task' payload={payload} />
                                </div>
                            </div>
                            {(task.route || task.sourceFamily || task.requestedFields?.length || task.ownerLane) ? (
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {task.sourceFamily ? <span className={sourceHealthChipClass('review')}>{formatLabel(task.sourceFamily)}</span> : null}
                                    {task.ownerLane ? <span className={sourceHealthChipClass(task.status === 'needs_api' ? 'blocked' : 'review')}>{readinessOwnerLabel(task.ownerLane)}</span> : null}
                                    {task.route ? <span className={sourceHealthChipClass('review')}>{sourceRequestRouteLabel(task.route)}</span> : null}
                                    {task.requestedFields?.slice(0, 3).map(field => (
                                        <span key={`${task.title}-${field}`} className={sourceHealthChipClass('blocked')}>{sourceHealthFieldLabel(field)}</span>
                                    ))}
                                </div>
                            ) : null}
                            <p className='mt-2 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{task.detail}</p>
                        </div>
                    )
                })}
            </div>
        </Panel>
    )
}

function collectionGapTaskPayloadFor(task: EnrichmentTask, intake: TiActionabilityModel['sourceEnrichmentIntake']) {
    const requestedFields = task.requestedFields ?? []
    const matchingItems = intake.items.filter(item =>
        item.route === task.route
        || item.ownerLane === task.ownerLane
        || item.sourceFamily === task.sourceFamily
        || item.requestedFields.some(field => requestedFields.includes(field))
    )
    return {
        schemaVersion: 'ti.public_actor.collection_gap_task.v1',
        source: 'public-ti',
        sessionLocal: true,
        title: task.title,
        status: task.status,
        detail: task.detail,
        sourceFamily: task.sourceFamily,
        route: task.route,
        ownerLane: task.ownerLane,
        requestedFields,
        intakeRoute: intake.route,
        intakeItems: matchingItems,
        summary: {
            matchingItems: matchingItems.length,
            sourceRequests: matchingItems.filter(item => Boolean(item.sourceRequestId)).length,
            captures: matchingItems.filter(item => Boolean(item.captureId)).length,
            blockers: matchingItems.reduce((count, item) => count + item.blockedBy.length, 0),
        },
    }
}

function SourceHealthPanel({ queue, intake, coverage, consumerReadiness, payload }: { queue: TiActionabilityModel['sourceHealthQueue']; intake: TiActionabilityModel['sourceEnrichmentIntake']; coverage: TiActionabilityModel['actorEnrichmentCoverage']; consumerReadiness: TiActionabilityModel['actorEnrichmentConsumerReadiness']; payload: TiActionabilityModel['exportPayloads']['enrichment'] }) {
    const rows = queue.rows

    return (
        <Panel title='Source Health' description='Source family, timestamp, parser status, and enrichment route for source-backed review.' icon={<Database className='h-4 w-4' />}>
            <div data-ti-source-health-queue='true' className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3'>
                <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                    <p className='wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        {queue.summary.total} source row{queue.summary.total === 1 ? '' : 's'} · {coverage.summary.coveredFieldCount}/{coverage.summary.fieldCount} covered · {coverage.summary.retryableFieldCount} retry
                    </p>
                    <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                        <span data-ti-enrichment-coverage-export='true' className='inline-flex'>
                            <CopyPayloadButton label='Coverage review' payload={coverage} />
                        </span>
                        <span data-ti-enrichment-consumer-readiness='true' className='inline-flex'>
                            <CopyPayloadButton label='Consumer readiness' payload={consumerReadiness} />
                        </span>
                        <CopyPayloadButton label='Source health queue' payload={{ ...queue, sourceEnrichmentIntake: intake, actorEnrichmentCoverage: coverage, actorEnrichmentConsumerReadiness: consumerReadiness, enrichmentPayload: payload }} />
                    </div>
                </div>
                <div data-ti-source-consumer-readiness='true' className='grid min-w-0 gap-2 sm:grid-cols-3'>
                    {consumerReadiness.rows.map(row => (
                        <div key={row.consumer} className='min-w-0 rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{actorEnrichmentConsumerLabel(row.consumer)}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                        {row.coverageCounts.covered} covered · {row.coverageCounts.alertable} alert-ready · {row.blockerCodes.length} blocker{row.blockerCodes.length === 1 ? '' : 's'}
                                    </p>
                                </div>
                                <span className={sourceHealthChipClass(actorEnrichmentConsumerState(row.state))}>{formatLabel(row.state)}</span>
                            </div>
                            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                {row.sourceFamilies.slice(0, 3).map(family => (
                                    <span key={family} className={sourceHealthChipClass('review')}>{formatLabel(family)}</span>
                                ))}
                                {row.retry.retryable ? <span className={sourceHealthChipClass('blocked')}>retry queued</span> : null}
                            </div>
                            <p className='mt-2 break-all font-mono text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>{row.route}</p>
                        </div>
                    ))}
                </div>
                {rows.length ? rows.slice(0, 5).map(row => (
                    <div key={row.id} className='min-w-0 rounded-lg border border-[#eef1f5] bg-white p-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                    {formatLabel(row.sourceFamily)} · {formatDate(row.timestamp)} · {row.parserStatus}
                                </p>
                                <p className='mt-1 break-all font-mono text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                                    {sourceHealthEvidenceLabel(row)}
                                </p>
                            </div>
                            <span className={decisionStepStatusClass(row.state)}>{decisionStepStatusLabel(row.state)}</span>
                        </div>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            {row.sourceId ? <span className={sourceHealthChipClass('review')}>source {row.sourceId}</span> : null}
                            {row.sourceRequestId ? <span className={sourceHealthChipClass('review')}>request {row.sourceRequestId}</span> : null}
                            <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? 'capture linked' : 'capture needed'}</span>
                            {typeof row.confidence === 'number' ? <span className={sourceHealthChipClass('review')}>{Math.round(row.confidence * 100)}% confidence</span> : null}
                            <span className={sourceHealthChipClass(row.ownerLane === 'source' ? 'blocked' : row.state)}>{readinessOwnerLabel(row.ownerLane)}</span>
                        </div>
                        {row.requestedFields.length ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>Needs: {row.requestedFields.slice(0, 4).map(sourceHealthFieldLabel).join(', ')}</p>
                        ) : null}
                        <div className='mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                            <p className='min-w-0 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>{row.nextAction}</p>
                            <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                <span data-ti-source-refresh-export='true' className='inline-flex'>
                                    <CopyPayloadButton label='Enrichment request' payload={sourceRefreshPayloadFor(row, queue, intake, payload)} />
                                </span>
                                <a href={row.route} className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131]'>
                                    <ExternalLink className='h-3.5 w-3.5' />
                                    Open
                                </a>
                            </div>
                        </div>
                    </div>
                )) : (
                    <p className='rounded-lg border border-[#fff0c2] bg-[#fffdf2] p-3 text-xs leading-5 text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'>No source health row is attached yet. Queue source enrichment before routing this actor to customer workflows.</p>
                )}
            </div>
        </Panel>
    )
}

function actorEnrichmentConsumerLabel(consumer: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['consumer']) {
    if (consumer === 'publicTI') return 'Actor page'
    if (consumer === 'alertGeneration') return 'Alert generation'
    return 'Source operations'
}

function actorEnrichmentConsumerState(state: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['state']) {
    if (state === 'ready') return 'ready'
    if (state === 'action_required') return 'review'
    return 'blocked'
}

function sourceRefreshPayloadFor(
    row: SourceHealthRow,
    queue: TiActionabilityModel['sourceHealthQueue'],
    intake: TiActionabilityModel['sourceEnrichmentIntake'],
    payload: TiActionabilityModel['exportPayloads']['enrichment'],
) {
    const matchingIntakeItems = intake.items.filter(item =>
        item.sourceHealthRowId === row.id
        || item.sourceRequestId === row.sourceRequestId
        || item.sourceId === row.sourceId
        || item.captureId === row.captureId
        || item.requestedFields.some(field => row.requestedFields.includes(field))
    )
    return {
        schemaVersion: 'ti.public_actor.source_refresh_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: queue.query,
        generatedAt: queue.generatedAt,
        rowId: row.id,
        sourceName: row.sourceName,
        sourceFamily: row.sourceFamily,
        state: row.state,
        route: row.route,
        ownerLane: row.ownerLane,
        sourceId: row.sourceId,
        sourceRequestId: row.sourceRequestId,
        captureId: row.captureId,
        requestedFields: row.requestedFields,
        evidence: {
            provenance: row.provenance,
            timestamp: row.timestamp,
            confidence: row.confidence,
            parserStatus: row.parserStatus,
        },
        blockers: row.requestedFields.map(field => ({
            code: 'missing_field',
            field,
            label: sourceHealthFieldLabel(field),
        })),
        queueSummary: queue.summary,
        sourceEnrichmentIntake: {
            schemaVersion: intake.schemaVersion,
            route: intake.route,
            summary: intake.summary,
            matchingItems: matchingIntakeItems,
        },
        enrichmentPayload: payload,
        handoff: {
            route: row.route || intake.route,
            ready: row.state === 'ready',
            blocked: row.state === 'blocked' || row.requestedFields.length > 0,
            matchingIntakeItems: matchingIntakeItems.length,
            sourceRequests: matchingIntakeItems.filter(item => Boolean(item.sourceRequestId)).length,
            captures: matchingIntakeItems.filter(item => Boolean(item.captureId)).length,
        },
        recommendedAction: row.captureId ? 'inspect_capture' : row.sourceRequestId ? 'track_source_request' : 'queue_enrichment',
        nextAction: row.nextAction,
    }
}

function watchlistIntersectionPayloadFor(row: WatchlistIntersectionRow) {
    return {
        schemaVersion: 'ti.public_actor.watchlist_intersection_request.v1',
        intersectionId: row.intersectionId,
        kind: row.kind,
        value: row.value,
        state: row.state,
        route: row.route,
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        watchlistId: row.watchlistId,
        watchlistItemId: row.watchlistItemId,
        alertIds: row.alertIds,
        caseIds: row.caseIds,
        casePaths: row.casePaths,
        captureIds: row.captureIds,
        webhookDestinationIds: row.webhookDestinationIds,
        sourceEvidenceRefs: row.sourceEvidenceRefs,
        sourceFamilies: row.sourceFamilies,
        recommendedAction: row.recommendedAction,
        blockers: row.blockers,
    }
}

function caseReviewCandidatePayloadFor(row: CaseReviewIntakeItem, query: string) {
    return {
        schemaVersion: 'ti.public_actor.case_review_candidate.v1',
        query,
        candidateId: row.id,
        evidenceRowId: row.evidenceRowId,
        title: row.title,
        score: row.score,
        priority: row.priority,
        state: row.state,
        route: row.route,
        alertIds: row.alertIds,
        casePaths: row.casePaths,
        captureIds: row.captureIds,
        sourceIds: row.sourceIds,
        watchlistTerms: row.watchlistTerms,
        reasons: row.reasons,
        blockers: row.blockedBy,
        recommendedAction: row.recommendedAction,
        nextAction: row.nextAction,
    }
}

function ActionPanel({ note, decision, relevance, reviewHandoff, caseDraft, caseActionTrail, caseOwnership, caseCreateRequest, watchlistPlan, alertPlan, deliveryPlan, enrichmentTriage, onNoteChange, onDecision, onRelevance, onStage }: {
    note: string
    decision?: LocalDecision
    relevance?: LocalRelevanceMark
    reviewHandoff: SelectedReviewHandoff | null
    caseDraft: SelectedCaseDraft | null
    caseActionTrail: CaseActionTrailPayload | null
    caseOwnership: SelectedCaseOwnershipPlan | null
    caseCreateRequest: SelectedCaseCreateRequest | null
    watchlistPlan: SelectedWatchlistPlan | null
    alertPlan: SelectedAlertActionPlan | null
    deliveryPlan: SelectedDeliveryReadinessPlan | null
    enrichmentTriage: SelectedEnrichmentTriage | null
    onNoteChange: (value: string) => void
    onDecision: (status: LocalDecision['status']) => void
    onRelevance: (state: LocalRelevanceMark['state']) => void
    onStage: () => void
}) {
    const readyForCase = Boolean(reviewHandoff?.caseHandoff.ready)
    const readyForAlert = Boolean(reviewHandoff?.alertHandoff.ready)
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
                <div data-ti-local-relevance='true' className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
                    <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                        <div className='min-w-0'>
                            <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Relevance mark</p>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                Session-local mark for watchlist, source review, or case preparation.
                            </p>
                        </div>
                        <span className={relevance ? decisionStepStatusClass(relevance.state === 'not_relevant' ? 'blocked' : relevance.state === 'needs_source' ? 'review' : 'ready') : decisionStepStatusClass('review')}>
                            {relevance ? relevanceLabel(relevance.state) : 'unmarked'}
                        </span>
                    </div>
                    {relevance ? (
                        <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                            {relevance.rationale} {relevance.watchTerms.length ? `Terms: ${relevance.watchTerms.slice(0, 3).join(', ')}.` : ''}
                        </p>
                    ) : null}
                    <div className='mt-3 grid grid-cols-2 gap-2'>
                        <ActionButton icon={<BellRing className='h-3.5 w-3.5' />} onClick={() => onRelevance('customer_relevant')}>Customer</ActionButton>
                        <ActionButton icon={<ClipboardList className='h-3.5 w-3.5' />} onClick={() => onRelevance('context_only')}>Context</ActionButton>
                        <ActionButton icon={<Database className='h-3.5 w-3.5' />} onClick={() => onRelevance('needs_source')}>Source</ActionButton>
                        <ActionButton icon={<XCircle className='h-3.5 w-3.5' />} onClick={() => onRelevance('not_relevant')}>Not relevant</ActionButton>
                    </div>
                </div>
                {caseDraft ? <SelectedCaseDraftPanel draft={caseDraft} /> : null}
                {caseOwnership ? <SelectedCaseOwnershipPanel plan={caseOwnership} /> : null}
                {caseCreateRequest ? <SelectedCaseCreateRequestPanel request={caseCreateRequest} /> : null}
                {watchlistPlan ? <SelectedWatchlistPlanPanel plan={watchlistPlan} /> : null}
                {alertPlan ? <SelectedAlertActionPlanPanel plan={alertPlan} /> : null}
                {deliveryPlan ? <SelectedDeliveryReadinessPanel plan={deliveryPlan} /> : null}
                {enrichmentTriage ? <SelectedEnrichmentTriagePanel triage={enrichmentTriage} /> : null}
                {caseActionTrail ? <CaseActionTrailPanel trail={caseActionTrail} /> : null}
                <button
                    type='button'
                    onClick={onStage}
                    disabled={!reviewHandoff || !caseDraft}
                    className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131] dark:disabled:bg-[#172131] dark:disabled:text-[#77869a]'
                >
                    <ClipboardList className='h-3.5 w-3.5' />
                    Stage handoff
                </button>
                {reviewHandoff ? (
                    <div data-ti-selected-review-handoff='true' className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Selected review package</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                    Copyable evidence, rationale, and handoff state for authenticated case review. This does not save public-page notes.
                                </p>
                            </div>
                            <CopyPayloadButton label='Selected review package' payload={reviewHandoff} />
                        </div>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            <span className={readyForAlert ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                alert {readyForAlert ? 'ready' : 'blocked'}
                            </span>
                            <span className={readyForCase ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                case {readyForCase ? 'ready' : 'blocked'}
                            </span>
                            <span className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
                                {reviewHandoff.evidenceBasis.length} evidence rows
                            </span>
                        </div>
                        {reviewHandoff.blockers.length ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(reviewHandoff.blockers.slice(0, 2))}</p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </Panel>
    )
}

function SelectedCaseOwnershipPanel({ plan }: { plan: SelectedCaseOwnershipPlan }) {
    return (
        <div data-ti-selected-case-ownership='true' className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Case ownership</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        Selected evidence mapped to case candidates, replay readiness, and owner blockers.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(plan.state)}>{decisionStepStatusLabel(plan.state)}</span>
                    <CopyPayloadButton label='Case ownership' payload={plan} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Candidates' value={`${plan.summary.caseCandidates}`} />
                <EvidenceMetric label='Replay ready' value={`${plan.summary.replayReady}`} />
                <EvidenceMetric label='Alerts' value={`${plan.summary.relatedAlerts}`} />
                <EvidenceMetric label='Captures' value={`${plan.summary.captures}`} />
            </div>
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                <span className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
                    owner {plan.owner.label}
                </span>
                {plan.consumerStage ? (
                    <span className={decisionStepStatusClass(plan.consumerStage.state === 'ready' ? 'ready' : plan.consumerStage.state === 'blocked' ? 'blocked' : 'review')}>
                        case stage {plan.consumerStage.state}
                    </span>
                ) : null}
            </div>
            <p className='mt-2 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{plan.route}</p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{plan.nextAction}</p>
            <div className='mt-2 grid gap-2'>
                {plan.caseReviewItems.slice(0, 3).map(item => (
                    <div key={item.id} className='rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-[#344054] dark:text-[#d8e2f2]'>{item.title}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                                    {formatLabel(item.priority)} · {formatLabel(item.recommendedAction)} · {item.sourceIds.length} source ref{item.sourceIds.length === 1 ? '' : 's'}
                                </p>
                            </div>
                            <span className={decisionStepStatusClass(item.state)}>{decisionStepStatusLabel(item.state)}</span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{item.nextAction}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                            {item.alertIds.length ? `Alerts ${item.alertIds.slice(0, 2).join(', ')}` : 'Alert ID pending'}
                            {item.casePaths.length ? ` · cases ${item.casePaths.slice(0, 2).join(', ')}` : ''}
                            {item.captureIds.length ? ` · captures ${item.captureIds.slice(0, 2).join(', ')}` : ''}
                        </p>
                        {item.blockers.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(item.blockers.slice(0, 3))}</p>
                        ) : null}
                    </div>
                ))}
            </div>
            {plan.replayRows.length ? (
                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                    {plan.replayRows.slice(0, 3).map(row => (
                        <span key={row.id} className={sourceHealthChipClass(row.ready ? 'ready' : 'blocked')}>
                            {row.caseId ? `case ${row.caseId}` : row.blockerCodes.slice(0, 2).join(', ') || 'case route pending'}
                        </span>
                    ))}
                </div>
            ) : null}
            {plan.blockers.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(plan.blockers.slice(0, 4))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-[#147a3b] dark:text-[#83d9a1]'>Case route, alert, capture, and source references are ready for authenticated review.</p>
            )}
        </div>
    )
}

function SelectedCaseCreateRequestPanel({ request }: { request: SelectedCaseCreateRequest }) {
    return (
        <div data-ti-selected-case-create-request='true' className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Case create request</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        Selected evidence shaped for authenticated case creation with provenance and blockers attached.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(request.state)}>{decisionStepStatusLabel(request.state)}</span>
                    <CopyPayloadButton label='Case create request' payload={request} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Alerts' value={`${request.refs.alertIds.length}`} />
                <EvidenceMetric label='Captures' value={`${request.refs.captureIds.length}`} />
                <EvidenceMetric label='Sources' value={`${request.sourceRows.length}`} />
                <EvidenceMetric label='Terms' value={`${request.refs.watchTerms.length}`} />
            </div>
            <p className='mt-2 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{request.request.method} {request.request.path}</p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{request.nextAction}</p>
            {request.sourceRows.length ? (
                <div className='mt-2 grid gap-2'>
                    {request.sourceRows.slice(0, 3).map(row => (
                        <div key={`${row.sourceId ?? row.sourceName}:${row.provenance}:${row.captureId ?? 'pending'}`} className='rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-[#344054] dark:text-[#d8e2f2]'>{row.sourceName}{row.sourceId ? ` · source ${row.sourceId}` : ''}</p>
                                    <p className='mt-1 break-all font-mono text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>{row.provenance}</p>
                                </div>
                                <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? `capture ${row.captureId}` : 'capture needed'}</span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                {row.reportDate ? formatDate(row.reportDate) : 'report date pending'}{typeof row.confidence === 'number' ? ` · ${Math.round(row.confidence * 100)}% confidence` : ''}{row.missing.length ? ` · needs ${handoffMissingLabel(row.missing)}` : ''}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {request.refs.alertIds.slice(0, 3).map(id => <span key={id} className={sourceHealthChipClass('ready')}>alert {id}</span>)}
                {request.refs.casePaths.slice(0, 2).map(path => <span key={path} className={sourceHealthChipClass('ready')}>{path}</span>)}
                {request.consumerStage?.request ? <span className={sourceHealthChipClass(request.ready ? 'ready' : 'blocked')}>{request.consumerStage.request}</span> : null}
            </div>
            {request.blockers.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(request.blockers.slice(0, 4))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-[#147a3b] dark:text-[#83d9a1]'>Case creation has the selected evidence, alert, capture, source, and watchlist refs required for authenticated review.</p>
            )}
        </div>
    )
}

function SelectedWatchlistPlanPanel({ plan }: { plan: SelectedWatchlistPlan }) {
    const status: DecisionStep['status'] = plan.ready ? 'ready' : plan.blockers.length || plan.state === 'missing_terms' ? 'blocked' : 'review'
    return (
        <div data-ti-selected-watchlist-plan='true' className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Watchlist plan</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        Selected evidence mapped to watchlist terms, organization intersections, and source refs.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(status)}>{decisionStepStatusLabel(status)}</span>
                    <CopyPayloadButton label='Watchlist plan' payload={plan} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Terms' value={`${plan.terms.length}`} />
                <EvidenceMetric label='Matches' value={`${plan.relevanceRows.filter(item => item.fit === 'matched').length}`} />
                <EvidenceMetric label='Alerts' value={`${plan.sourceRefs.alertIds.length}`} />
                <EvidenceMetric label='Captures' value={`${plan.sourceRefs.captureIds.length}`} />
            </div>
            <p className='mt-2 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{plan.route}</p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{plan.nextAction}</p>
            <div className='mt-2 grid gap-2'>
                {plan.terms.slice(0, 3).map(term => (
                    <div key={`${term.kind}:${term.value}`} className='rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-[#344054] dark:text-[#d8e2f2]'>{term.kind}: {term.value}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>{term.notes}</p>
                            </div>
                            <span className={sourceHealthChipClass(term.matched ? 'ready' : plan.blockers.length ? 'blocked' : 'review')}>
                                {term.matched ? 'matched' : plan.blockers.length ? 'blocked' : 'candidate'}
                            </span>
                        </div>
                    </div>
                ))}
                {!plan.terms.length ? <p className='rounded-md border border-[#fff0c2] bg-[#fffdf2] p-2 text-[11px] leading-5 text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'>No watchlist terms are attached to this selected evidence.</p> : null}
            </div>
            {plan.relevanceRows.length ? (
                <div data-ti-selected-watchlist-relevance='true' className='mt-2 grid gap-2'>
                    {plan.relevanceRows.slice(0, 3).map(row => (
                        <div key={`${row.kind}:${row.value}:${row.fit}`} className='rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-[#344054] dark:text-[#d8e2f2]'>{row.kind}: {row.value}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                                        {row.alertable ? 'Alert-ready' : 'Needs review'} · {row.evidenceRefs.length} evidence ref{row.evidenceRefs.length === 1 ? '' : 's'} · {row.sourceFamilies.map(formatLabel).join(', ') || 'source family pending'}
                                    </p>
                                </div>
                                <span className={sourceHealthChipClass(row.fit === 'matched' ? 'ready' : row.fit === 'blocked' ? 'blocked' : 'review')}>
                                    {row.fit === 'matched' ? 'matched' : row.fit === 'near' ? 'near match' : 'blocked'}
                                </span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{row.nextAction}</p>
                            {row.blockers.length ? (
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(row.blockers.slice(0, 3))}</p>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

function SelectedEnrichmentTriagePanel({ triage }: { triage: SelectedEnrichmentTriage }) {
    return (
        <div data-ti-selected-enrichment-triage='true' className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Enrichment triage</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        Selected evidence mapped to source health, intake items, and capture/source-request blockers.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(triage.state)}>{decisionStepStatusLabel(triage.state)}</span>
                    <CopyPayloadButton label='Enrichment triage' payload={triage} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Sources' value={`${triage.summary.sourceRows}`} />
                <EvidenceMetric label='Intake' value={`${triage.summary.intakeItems}`} />
                <EvidenceMetric label='Requests' value={`${triage.summary.sourceRequests}`} />
                <EvidenceMetric label='Captures' value={`${triage.summary.captures}`} />
            </div>
            <p className='mt-2 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{triage.route}</p>
            <div className='mt-2 grid gap-2'>
                {triage.rows.slice(0, 3).map(row => (
                    <div key={row.id} className='rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-[#344054] dark:text-[#d8e2f2]'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>{formatLabel(row.sourceFamily)} · {row.matchingIntakeItemIds.length} intake item{row.matchingIntakeItemIds.length === 1 ? '' : 's'}</p>
                            </div>
                            <span className={sourceHealthChipClass(row.state)}>{row.state}</span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{row.nextAction}</p>
                        {row.requestedFields.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>Needs {row.requestedFields.map(sourceHealthFieldLabel).slice(0, 3).join(', ')}.</p>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    )
}

function SelectedAlertActionPlanPanel({ plan }: { plan: SelectedAlertActionPlan }) {
    const status = plan.ready ? 'ready' : plan.state === 'review' ? 'review' : 'blocked'
    return (
        <div data-ti-selected-alert-action-plan='true' className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Alert action plan</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        Selected evidence mapped to watchlist terms, source refs, and alert rebuild readiness.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(status)}>{decisionStepStatusLabel(status)}</span>
                    <CopyPayloadButton label='Alert action plan' payload={plan} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Candidates' value={`${plan.readiness.candidateCount}`} />
                <EvidenceMetric label='Matches' value={`${plan.readiness.matchedCandidateCount}`} />
                <EvidenceMetric label='Captures' value={`${plan.sourceRefs.captureIds.length}`} />
                <EvidenceMetric label='Evidence window' value={plan.readiness.generationEvidenceWindowReady ? 'Ready' : 'Pending'} />
            </div>
            <p className='mt-2 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{plan.handoff.route || plan.route}</p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{plan.nextAction}</p>
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {plan.watchlist.terms.slice(0, 4).map(term => (
                    <span key={term} className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>{term}</span>
                ))}
                {!plan.watchlist.terms.length ? <span className='text-[11px] text-[#667085] dark:text-[#9aa8bd]'>No watch terms attached.</span> : null}
            </div>
            {plan.blockers.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(plan.blockers.slice(0, 3).map(blocker => blocker.detail))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-[#147a3b] dark:text-[#83d9a1]'>Alert rebuild has the required watchlist, capture, and source context.</p>
            )}
        </div>
    )
}

function SelectedDeliveryReadinessPanel({ plan }: { plan: SelectedDeliveryReadinessPlan }) {
    return (
        <div data-ti-selected-delivery-readiness='true' className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Delivery readiness</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        Selected evidence mapped to alert, capture, destination, and case route readiness.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(plan.state)}>{decisionStepStatusLabel(plan.state)}</span>
                    <CopyPayloadButton label='Delivery readiness' payload={plan} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Alerts' value={`${plan.summary.alerts}`} />
                <EvidenceMetric label='Captures' value={`${plan.summary.captures}`} />
                <EvidenceMetric label='Destinations' value={`${plan.summary.destinations}`} />
                <EvidenceMetric label='Case routes' value={`${plan.summary.caseRoutes}`} />
            </div>
            <p className='mt-2 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{plan.handoff.route || plan.route}</p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{plan.nextAction}</p>
            <div className='mt-2 grid gap-2'>
                {plan.alerts.slice(0, 3).map(alert => (
                    <div key={alert.id} className='rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-[#344054] dark:text-[#d8e2f2]'>{alert.title}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                                    alert {alert.id} · {formatLabel(alert.status)}
                                </p>
                            </div>
                            <span className={sourceHealthChipClass(alert.ready ? 'ready' : 'blocked')}>{alert.ready ? 'ready' : 'blocked'}</span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                            {alert.captureIds.length ? `${alert.captureIds.length} capture${alert.captureIds.length === 1 ? '' : 's'}` : 'Capture needed'}
                            {alert.destinationIds.length ? ` · ${alert.destinationIds.length} destination${alert.destinationIds.length === 1 ? '' : 's'}` : ' · destination needed'}
                            {alert.casePath ? ` · ${alert.casePath}` : ' · case route pending'}
                        </p>
                        {alert.blockers.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(alert.blockers.slice(0, 3))}</p>
                        ) : null}
                    </div>
                ))}
                {!plan.alerts.length ? (
                    <p className='rounded-md border border-[#fff0c2] bg-[#fffdf2] p-2 text-[11px] leading-5 text-[#8a5a00] dark:border-[#5a4316] dark:bg-[#231b0c] dark:text-[#ffd77a]'>No related alert is attached to the selected evidence yet.</p>
                ) : null}
            </div>
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {plan.sourceRefs.destinationIds.slice(0, 3).map(id => (
                    <span key={id} className={sourceHealthChipClass('ready')}>destination {id}</span>
                ))}
                {plan.handoff.request ? <span className={sourceHealthChipClass(plan.handoff.ready ? 'ready' : 'blocked')}>{plan.handoff.request}</span> : null}
            </div>
            {plan.blockers.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(plan.blockers.slice(0, 4))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-[#147a3b] dark:text-[#83d9a1]'>Alert, capture, destination, and case route refs are ready for authenticated dry-run delivery.</p>
            )}
        </div>
    )
}

function CaseActionTrailPanel({ trail }: { trail: CaseActionTrailPayload }) {
    return (
        <div data-ti-case-action-trail='true' className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Case action trail</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        Metadata-only trail for local decisions, selected evidence, and case replay readiness.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={trail.summary.replayable ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                        {trail.summary.replayable ? 'replay ready' : 'replay blocked'}
                    </span>
                    <CopyPayloadButton label='Case action trail' payload={trail} />
                </div>
            </div>
            <div className='mt-3 grid gap-2'>
                {trail.events.slice(0, 4).map(event => (
                    <div key={event.id} className='rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-[#344054] dark:text-[#d8e2f2]'>{event.label}</p>
                                <p className='mt-1 text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{formatDate(event.at)}</p>
                            </div>
                            <span className={decisionStepStatusClass(event.state === 'local' ? 'review' : event.state)}>{event.state === 'local' ? 'local' : event.state}</span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{event.detail}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                            {event.provenance.sourceIds.length ? `Sources ${event.provenance.sourceIds.slice(0, 3).join(', ')}` : 'Source link pending'}
                            {event.provenance.captureIds.length ? ` · captures ${event.provenance.captureIds.slice(0, 3).join(', ')}` : ''}
                            {event.provenance.alertIds.length ? ` · alerts ${event.provenance.alertIds.slice(0, 3).join(', ')}` : ''}
                        </p>
                        {event.blockers.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(event.blockers.slice(0, 3))}</p>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    )
}

function SelectedCaseDraftPanel({ draft }: { draft: SelectedCaseDraft }) {
    return (
        <div data-ti-selected-case-draft='true' className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 dark:border-[#273244] dark:bg-[#131c29]'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Case draft</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                        Session-local draft for authenticated case review.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={draft.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{draft.ready ? 'ready' : 'blocked'}</span>
                    <CopyPayloadButton label='Case draft' payload={draft} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Intent' value={formatLabel(draft.caseIntent)} />
                <EvidenceMetric label='Sources' value={`${draft.sourceRows.length} row${draft.sourceRows.length === 1 ? '' : 's'}`} />
            </div>
            <p className='mt-2 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>{draft.route || draft.endpoint}</p>
            {draft.sourceRows.length ? (
                <div data-ti-selected-case-provenance='true' className='mt-2 grid min-w-0 gap-2'>
                    {draft.sourceRows.slice(0, 3).map(row => (
                        <div key={`${row.sourceId ?? row.sourceName}:${row.provenance}:${row.captureId ?? 'missing'}`} className='rounded-md border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-[#344054] dark:text-[#d8e2f2]'>{row.sourceName}{row.sourceId ? ` · source ${row.sourceId}` : ''}</p>
                                    <p className='mt-1 break-all font-mono text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>{row.provenance}</p>
                                </div>
                                <span className={sourceHealthChipClass(row.state === 'ready' ? 'ready' : row.state === 'needs_capture' ? 'blocked' : 'review')}>
                                    {row.captureId ? `capture ${row.captureId}` : 'capture needed'}
                                </span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                {typeof row.confidence === 'number' ? `${Math.round(row.confidence * 100)}% confidence` : 'confidence pending'}{row.missing.length ? ` · needs ${handoffMissingLabel(row.missing)}` : ''}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {draft.watchTerms.slice(0, 4).map(term => (
                    <span key={term} className='max-w-full wrap-break-word rounded-md border border-[#dfe5ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] dark:border-[#2a3547] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>{term}</span>
                ))}
                {!draft.watchTerms.length ? <span className='text-[11px] text-[#667085] dark:text-[#9aa8bd]'>No watch terms attached.</span> : null}
            </div>
            {draft.missing.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(draft.missing.slice(0, 3))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-[#147a3b] dark:text-[#83d9a1]'>Required case identifiers and evidence context are present.</p>
            )}
        </div>
    )
}

function StagedHandoffQueuePanel({ items, onClear }: { items: StagedHandoff[]; onClear: () => void }) {
    const readyCount = items.filter(item => item.ready).length
    const bundle = {
        schemaVersion: 'ti.public_actor.staged_handoff_bundle.v1',
        source: 'public-ti',
        sessionLocal: true,
        generatedAt: new Date().toISOString(),
        count: items.length,
        readyCount,
        items,
    }
    return (
        <Panel title='Staged Handoffs' description='Session-local queue for selected review, source, and case drafts. Nothing is saved until opened in the authenticated console.' icon={<ClipboardList className='h-4 w-4' />}>
            <div data-ti-staged-handoff-queue='true' className='grid gap-3'>
                <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                            {items.length ? `${items.length} staged handoff${items.length === 1 ? '' : 's'} · ${readyCount} ready` : 'No handoffs staged in this browser session.'}
                        </p>
                    </div>
                    <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                        <CopyPayloadButton label='Staged handoff queue' payload={bundle} />
                        <button
                            type='button'
                            onClick={onClear}
                            disabled={!items.length}
                            className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] dark:border-[#314057] dark:bg-[#0f1621] dark:text-[#d8e2f2] dark:hover:bg-[#172131] dark:disabled:bg-[#172131] dark:disabled:text-[#77869a]'
                        >
                            Clear
                        </button>
                    </div>
                </div>
                {items.length ? (
                    <div className='grid gap-2'>
                        {items.slice(0, 4).map(item => (
                            <div key={item.id} className='rounded-lg border border-[#eef1f5] bg-white p-2 dark:border-[#273244] dark:bg-[#0f1621]'>
                                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{item.title}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                                            {formatLabel(item.caseIntent)} · {relevanceLabelForStaged(item.relevanceState)} · {item.sourceDrilldown.rows.length} source row{item.sourceDrilldown.rows.length === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                    <span className={item.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{item.ready ? 'ready' : 'blocked'}</span>
                                </div>
                                <div data-ti-staged-handoff-readiness='true' className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {stagedReadinessChips(item).map(chip => (
                                        <span key={chip.label} className={sourceHealthChipClass(chip.ready ? 'ready' : 'blocked')}>{chip.label}: {chip.value}</span>
                                    ))}
                                </div>
                                {item.blockers.length ? (
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#8a5a00] dark:text-[#ffd77a]'>{displayRequirementList(item.blockers.slice(0, 2))}</p>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </Panel>
    )
}

function stagedReadinessChips(item: StagedHandoff) {
    const sourceMissing = unique(item.sourceDrilldown.rows.flatMap(row => row.missing))
    return [
        { label: 'review', value: item.reviewHandoff.blockers.length ? `${item.reviewHandoff.blockers.length} blocker${item.reviewHandoff.blockers.length === 1 ? '' : 's'}` : 'ready', ready: item.reviewHandoff.blockers.length === 0 },
        { label: 'source', value: sourceMissing.length ? `${sourceMissing.length} missing` : `${item.sourceDrilldown.rows.length} row${item.sourceDrilldown.rows.length === 1 ? '' : 's'}`, ready: sourceMissing.length === 0 },
        { label: 'case', value: item.caseDraft.missing.length ? `${item.caseDraft.missing.length} missing` : item.caseDraft.route ? 'route ready' : 'draft ready', ready: item.caseDraft.missing.length === 0 },
    ]
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
            <p className='text-xs leading-5 text-[#667085]'>
                Source basis: {item.source} · {formatDate(item.reportDate)} · {Math.round(item.confidence * 100)}% confidence{item.sourceIds.length ? ` · ${item.sourceIds.map(sourceId => `source ${sourceId}`).join(', ')}` : ''}
            </p>
            {item.provenanceRefs.length ? (
                <p className='wrap-break-word text-[11px] leading-5 text-[#667085]'>Provenance: {item.provenanceRefs.slice(0, 2).join(' · ')}</p>
            ) : null}
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
    const caseCandidates = input.actionability.caseReviewIntake.summary.total
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
        { label: 'Related alerts/cases', value: relatedRecords ? `${relatedRecords} linked` : `${caseCandidates} candidate${caseCandidates === 1 ? '' : 's'}`, state: relatedRecords ? 'ready' : caseCandidates ? 'review' : 'blocked' },
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

function selectedReviewHandoffFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    watchlist: WatchlistRelevance,
    alertPacket: AlertPacket,
    actionability: TiActionabilityModel,
    decision: LocalDecision | undefined,
    relevance: LocalRelevanceMark | undefined,
    note: string
): SelectedReviewHandoff {
    const rationale = note.trim() || decision?.reason || 'No session rationale recorded.'
    return {
        schemaVersion: 'ti.public_actor.selected_review_handoff.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItem: {
            id: selected.id,
            kind: selected.kind,
            severity: selected.severity,
            title: selected.title,
            timestamp: selected.timestamp,
            source: selected.source,
            provenance: selected.provenance,
            confidence: selected.confidence,
            href: selected.href,
            evidence: selected.evidence,
            nextActions: selected.nextActions,
        },
        localReview: {
            status: decision?.status ?? 'not_recorded',
            rationale,
            decidedAt: decision?.decidedAt,
        },
        localRelevance: {
            state: relevance?.state ?? 'not_marked',
            rationale: relevance?.rationale ?? 'No session relevance mark recorded.',
            watchTerms: relevance?.watchTerms ?? [],
            caseIntent: relevance?.caseIntent ?? 'not_set',
            markedAt: relevance?.markedAt,
        },
        watchlist: {
            terms: alertPacket.watchTerms,
            matchedTerms: watchlist.matchedTerms,
            organizations: watchlist.organizations,
        },
        caseHandoff: {
            ready: actionability.caseHandoff.ready,
            endpoint: actionability.caseHandoff.endpoint,
            backedRoute: actionability.caseHandoff.backedRoute,
            missing: actionability.caseHandoff.missing,
        },
        alertHandoff: {
            ready: actionability.createAlertHandoff.ready,
            endpoint: actionability.createAlertHandoff.endpoint,
            backedRoute: actionability.createAlertHandoff.backedRoute,
            missing: actionability.createAlertHandoff.missing,
        },
        evidenceBasis: alertPacket.evidenceBasis,
        blockers: alertPacket.blockedUntil,
    }
}

function selectedCaseDraftFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    watchlist: WatchlistRelevance,
    alertPacket: AlertPacket,
    actionability: TiActionabilityModel,
    drilldown: SelectedSourceDrilldown,
    relevance: LocalRelevanceMark | undefined,
    note: string
): SelectedCaseDraft {
    const sourceRows = drilldown.rows.map(row => ({
        sourceName: row.sourceName,
        sourceId: row.sourceId,
        provenance: row.provenance,
        captureId: row.captureId,
        reportDate: row.reportDate,
        confidence: row.confidence,
        state: row.state,
        missing: row.missing,
    }))
    const sourceMissing = unique(drilldown.rows.flatMap(row => row.missing))
    const watchTerms = unique([
        ...(relevance?.watchTerms ?? []),
        ...alertPacket.watchTerms,
        ...watchlist.matchedTerms,
    ]).slice(0, 10)
    const missing = unique([
        ...actionability.caseHandoff.missing,
        ...sourceMissing,
        ...(watchTerms.length ? [] : ['Watchlist term or customer relevance mark is required before case review.']),
        ...(relevance?.state === 'not_relevant' ? ['Selected evidence is marked not relevant for current case work.'] : []),
    ]).slice(0, 8)
    const caseIntent = relevance?.caseIntent ?? (selected.kind === 'exposure' ? 'case_candidate' : 'watchlist_context')
    const titlePrefix = caseIntent === 'case_candidate' ? 'Case review' : caseIntent === 'source_review' ? 'Source review' : 'Actor context'
    const body = {
        title: `${titlePrefix}: ${selected.title}`.slice(0, 180),
        query: result.query,
        selectedItemId: selected.id,
        priority: selected.severity,
        rationale: note.trim() || relevance?.rationale || alertPacket.customerValue,
        caseIntent,
        watchTerms,
        evidence: selected.evidence,
        sourceRows,
        alertId: actionability.readiness.backedIds.alertIds[0],
        captureIds: unique(sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value))),
        provenance: drilldown.rows.map(row => ({ sourceName: row.sourceName, sourceId: row.sourceId, provenance: row.provenance, captureId: row.captureId, reportDate: row.reportDate, confidence: row.confidence })),
        requiredBeforePost: missing,
    }

    return {
        schemaVersion: 'ti.public_actor.selected_case_draft.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItemId: selected.id,
        title: body.title,
        priority: selected.severity,
        caseIntent,
        ready: actionability.caseHandoff.ready && missing.length === 0,
        endpoint: actionability.caseHandoff.endpoint,
        route: actionability.caseHandoff.backedRoute,
        missing,
        watchTerms,
        sourceRows,
        body,
    }
}

function selectedCaseCreateRequestFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    caseDraft: SelectedCaseDraft | null,
    caseOwnership: SelectedCaseOwnershipPlan | null,
    drilldown: SelectedSourceDrilldown | null
): SelectedCaseCreateRequest {
    const caseStage = actionability.consumerReadiness.stages.find(stage => stage.id === 'caseHandoff')
    const caseAction = actionability.actionPayloads.payloads.caseHandoff
    const sourceRows = (caseDraft?.sourceRows.length ? caseDraft.sourceRows : drilldown?.rows ?? []).map(row => ({
        sourceName: row.sourceName,
        sourceId: row.sourceId,
        provenance: row.provenance,
        captureId: row.captureId,
        reportDate: row.reportDate,
        confidence: row.confidence,
        state: row.state,
        missing: row.missing,
    }))
    const alertIds = unique([
        ...actionability.readiness.backedIds.alertIds,
        ...(caseOwnership?.sourceRefs.alertIds ?? []),
        ...readStringArray(caseAction.body.alertId),
    ])
    const captureIds = unique([
        ...actionability.readiness.backedIds.captureIds,
        ...(caseOwnership?.sourceRefs.captureIds ?? []),
        ...sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)),
        ...readStringArray(caseAction.body.captureIds),
    ])
    const casePaths = unique([
        ...actionability.readiness.backedIds.casePaths,
        ...(caseOwnership?.sourceRefs.casePaths ?? []),
        ...(caseDraft?.route ? [caseDraft.route] : []),
    ])
    const sourceIds = unique([
        ...(caseOwnership?.sourceRefs.sourceIds ?? []),
        ...sourceRows.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
    ])
    const watchTerms = unique([
        ...(caseDraft?.watchTerms ?? []),
        ...readStringArray(caseAction.body.watchTerms),
        ...readStringArray(caseAction.body.terms),
    ])
    const blockers = unique([
        ...(caseDraft?.missing ?? []),
        ...caseAction.blockedBy.map(blocker => blocker.detail),
        ...(caseStage?.missing ?? []),
        ...(caseStage && caseStage.state === 'blocked' ? [caseStage.detail] : []),
        ...(sourceRows.length ? [] : ['Source provenance is required before case creation review.']),
        ...(alertIds.length ? [] : ['Alert ID is required before case creation review.']),
        ...(captureIds.length ? [] : ['Capture evidence is required before case creation review.']),
    ]).slice(0, 10)
    const requestBody = {
        ...caseAction.body,
        ...(caseDraft?.body ?? {}),
        query: result.query,
        selectedItemId: selected.id,
        selectedItemTitle: selected.title,
        sourceRows,
        alertIds,
        captureIds,
        casePaths,
        sourceIds,
        watchTerms,
        noMutation: true,
    }
    const ready = Boolean(caseDraft?.ready)
        && caseAction.ready
        && caseStage?.state === 'ready'
        && sourceRows.length > 0
        && alertIds.length > 0
        && captureIds.length > 0
        && blockers.length === 0
    const state: SelectedCaseCreateRequest['state'] = ready ? 'ready' : blockers.length ? 'blocked' : 'review'
    const route = caseDraft?.route || caseAction.backedRoute || caseAction.route || actionability.caseHandoff.endpoint
    return {
        schemaVersion: 'ti.public_actor.selected_case_create_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        ready,
        state,
        route,
        nextAction: ready
            ? 'Open the authenticated case workflow with the selected evidence and provenance attached.'
            : blockers.length ? `Resolve ${displayRequirementList(blockers.slice(0, 2))} before case creation review.` : 'Review the selected evidence before opening the authenticated case workflow.',
        request: {
            method: 'POST',
            path: caseStage?.request?.path ?? actionability.caseHandoff.endpoint,
            body: requestBody,
        },
        sourceRows,
        refs: {
            alertIds,
            captureIds,
            casePaths,
            sourceIds,
            watchTerms,
        },
        blockers,
        consumerStage: caseStage ? {
            state: caseStage.state,
            request: caseStage.request ? `${caseStage.request.method} ${caseStage.request.path}` : undefined,
            missing: caseStage.missing,
        } : undefined,
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

function selectedCaseActionTrailFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    reviewHandoff: SelectedReviewHandoff | null,
    caseDraft: SelectedCaseDraft | null,
    decision: LocalDecision | undefined,
    relevance: LocalRelevanceMark | undefined,
    note: string
): CaseActionTrailPayload {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        row.evidenceRowId === selected.priority?.rowId
        || row.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId))
        || row.alertIds.some(alertId => actionability.readiness.backedIds.alertIds.includes(alertId))
    )
    const activeReplayRows = replayRows.length ? replayRows : actionability.caseReplayReadiness.rows.slice(0, 2)
    const caseRoute = caseDraft?.route || reviewHandoff?.caseHandoff.backedRoute
    const now = new Date().toISOString()
    const baseProvenance = {
        sourceIds: selectedSourceIds,
        captureIds: unique(caseDraft?.sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)) ?? []),
        alertIds: actionability.readiness.backedIds.alertIds,
        confidence: selected.confidence,
        reportDate: selected.timestamp,
        source: selected.source,
    }
    const events: CaseActionTrailEvent[] = [
        {
            id: `selected:${selected.id}`,
            at: selected.timestamp || result.generatedAt,
            label: 'Selected evidence',
            detail: selected.subtitle,
            state: 'review',
            route: selected.href,
            blockers: [],
            evidenceRowId: selected.priority?.rowId,
            provenance: baseProvenance,
        },
        {
            id: `case-handoff:${selected.id}`,
            at: result.generatedAt,
            label: caseDraft?.ready ? 'Case handoff ready' : 'Case handoff blocked',
            detail: caseDraft?.ready
                ? 'Selected evidence has the required case route, source context, and watch terms for authenticated review.'
                : 'Case review needs the missing identifiers or source context listed below before persistence.',
            state: caseDraft?.ready ? 'ready' : 'blocked',
            route: caseRoute,
            blockers: unique([...(caseDraft?.missing ?? []), ...(reviewHandoff?.blockers ?? [])]).slice(0, 8),
            evidenceRowId: selected.priority?.rowId,
            provenance: {
                ...baseProvenance,
                caseId: caseRoute ? publicTiCaseIdFromPath(caseRoute) : undefined,
            },
        },
        ...(decision ? [{
            id: `decision:${selected.id}:${decision.decidedAt}`,
            at: decision.decidedAt,
            label: decisionLabel(decision.status),
            detail: `${decision.reason}${note.trim() && note.trim() !== decision.reason ? ` Note: ${note.trim()}` : ''}`,
            state: 'local' as const,
            route: caseRoute,
            blockers: caseDraft?.missing ?? [],
            evidenceRowId: selected.priority?.rowId,
            provenance: baseProvenance,
        }] : []),
        ...(relevance ? [{
            id: `relevance:${selected.id}:${relevance.markedAt}`,
            at: relevance.markedAt,
            label: relevanceLabel(relevance.state),
            detail: relevance.rationale,
            state: relevance.state === 'not_relevant' ? 'blocked' as const : relevance.state === 'needs_source' ? 'review' as const : 'ready' as const,
            route: caseRoute,
            blockers: relevance.state === 'needs_source' ? ['Source review required before case handoff.'] : relevance.state === 'not_relevant' ? ['Selected evidence marked not relevant for current customer work.'] : [],
            evidenceRowId: selected.priority?.rowId,
            provenance: {
                ...baseProvenance,
                caseId: caseRoute ? publicTiCaseIdFromPath(caseRoute) : undefined,
            },
        }] : []),
        ...activeReplayRows.slice(0, 3).map(row => ({
            id: `replay:${row.id}`,
            at: result.generatedAt,
            label: row.ready ? 'Replay export ready' : 'Replay export blocked',
            detail: row.ready
                ? 'Replay request has case, alert, capture, and source references.'
                : `Replay request needs ${displayRequirementList(row.blockerCodes)}.`,
            state: row.ready ? 'ready' as const : 'blocked' as const,
            route: row.exportRoute,
            blockers: row.blockedBy.map(blocker => blocker.detail),
            replayExportRoute: row.exportRoute,
            evidenceRowId: row.evidenceRowId,
            provenance: {
                sourceIds: row.sourceIds,
                captureIds: row.captureIds,
                alertIds: row.alertIds,
                caseId: row.caseId,
            },
        })),
    ]
    const ready = events.filter(event => event.state === 'ready').length
    const blocked = events.filter(event => event.state === 'blocked').length
    return {
        schemaVersion: 'ti.public_actor.case_action_trail.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: now,
        selectedItemId: selected.id,
        title: selected.title,
        events,
        summary: {
            total: events.length,
            ready,
            blocked,
            sessionLocal: true,
            replayable: activeReplayRows.some(row => row.ready),
        },
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

function selectedCaseOwnershipFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    caseDraft: SelectedCaseDraft | null,
    caseActionTrail: CaseActionTrailPayload | null
): SelectedCaseOwnershipPlan {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCasePaths = selected.priority?.casePaths ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedRowId = selected.priority?.rowId
    const text = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const caseItems = actionability.caseReviewIntake.items.filter(item =>
        item.evidenceRowId === selectedRowId
        || item.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId) || text.includes(sourceId.toLowerCase()))
        || item.alertIds.some(alertId => selectedAlertIds.includes(alertId) || text.includes(alertId.toLowerCase()))
        || item.casePaths.some(path => selectedCasePaths.includes(path) || text.includes(path.toLowerCase()))
        || item.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || text.includes(captureId.toLowerCase()))
    )
    const activeCaseItems = caseItems.length ? caseItems : actionability.caseReviewIntake.items.slice(0, 3)
    const activeItemIds = new Set(activeCaseItems.map(item => item.id))
    const activeEvidenceIds = new Set(activeCaseItems.map(item => item.evidenceRowId))
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        activeItemIds.has(row.caseReviewIntakeItemId)
        || activeEvidenceIds.has(row.evidenceRowId)
        || row.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId))
        || row.alertIds.some(alertId => selectedAlertIds.includes(alertId))
        || row.captureIds.some(captureId => selectedCaptureIds.includes(captureId))
    )
    const activeReplayRows = replayRows.length ? replayRows : actionability.caseReplayReadiness.rows.slice(0, 3)
    const itemAlertIds = unique(activeCaseItems.flatMap(item => item.alertIds))
    const itemCasePaths = unique(activeCaseItems.flatMap(item => item.casePaths))
    const relatedAlerts = actionability.relatedAlerts.filter(alert =>
        itemAlertIds.includes(alert.id)
        || Boolean(alert.casePath && itemCasePaths.includes(alert.casePath))
        || (alert.captureIds ?? []).some(captureId => selectedCaptureIds.includes(captureId))
    )
    const relatedCases = actionability.relatedCases.filter(item =>
        itemCasePaths.includes(item.path ?? '')
        || activeReplayRows.some(row => row.caseId === item.id)
    )
    const caseStage = actionability.consumerReadiness.stages.find(stage => stage.id === 'caseHandoff')
    const blockerDetails = unique([
        ...(caseDraft?.missing ?? []),
        ...activeCaseItems.flatMap(item => item.blockedBy.map(blocker => blocker.detail)),
        ...activeReplayRows.flatMap(row => row.blockedBy.map(blocker => blocker.detail)),
        ...(caseActionTrail?.events.flatMap(event => event.blockers) ?? []),
        ...(caseStage?.missing ?? []),
        ...(caseStage && caseStage.state === 'blocked' ? [caseStage.detail] : []),
    ]).slice(0, 10)
    const firstOwnerLane = activeCaseItems.flatMap(item => item.blockedBy.map(blocker => blocker.ownerLane))[0]
        ?? activeReplayRows.flatMap(row => row.blockedBy.map(blocker => blocker.ownerLane))[0]
        ?? actionability.actionPayloads.payloads.caseHandoff.blockedBy[0]?.ownerLane
        ?? (caseStage?.state === 'blocked' ? 'case' : 'case')
    const ready = Boolean(caseDraft?.ready)
        && activeReplayRows.some(row => row.ready)
        && (caseStage?.state === 'ready' || actionability.actionPayloads.payloads.caseHandoff.ready)
        && blockerDetails.length === 0
    const state: SelectedCaseOwnershipPlan['state'] = ready ? 'ready' : blockerDetails.length || activeCaseItems.some(item => item.state === 'blocked') ? 'blocked' : 'review'
    const route = caseDraft?.route
        || caseStage?.request?.path
        || actionability.actionPayloads.payloads.caseHandoff.backedRoute
        || actionability.actionPayloads.payloads.caseHandoff.route
        || actionability.caseHandoff.backedRoute
        || actionability.caseHandoff.endpoint

    return {
        schemaVersion: 'ti.public_actor.selected_case_ownership.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        state,
        route,
        nextAction: ready
            ? 'Open the authenticated case workflow with this selected evidence and replay-ready references.'
            : blockerDetails.length ? `Resolve ${displayRequirementList(blockerDetails.slice(0, 2))} before assigning this evidence to a case.` : 'Review the selected case candidate and choose the authenticated owner.',
        owner: {
            lane: firstOwnerLane,
            label: actionOwnerLabel(firstOwnerLane),
        },
        summary: {
            caseCandidates: activeCaseItems.length,
            replayReady: activeReplayRows.filter(row => row.ready).length,
            relatedAlerts: relatedAlerts.length,
            relatedCases: relatedCases.length,
            captures: unique([...activeCaseItems.flatMap(item => item.captureIds), ...activeReplayRows.flatMap(row => row.captureIds)]).length,
            blockers: blockerDetails.length,
        },
        caseReviewItems: activeCaseItems.slice(0, 4).map(item => ({
            id: item.id,
            evidenceRowId: item.evidenceRowId,
            title: item.title,
            priority: item.priority,
            state: item.state,
            route: item.route,
            alertIds: item.alertIds,
            casePaths: item.casePaths,
            captureIds: item.captureIds,
            sourceIds: item.sourceIds,
            watchlistTerms: item.watchlistTerms,
            reasons: item.reasons,
            recommendedAction: item.recommendedAction,
            nextAction: item.nextAction,
            blockers: item.blockedBy.map(blocker => blocker.detail),
        })),
        replayRows: activeReplayRows.slice(0, 4).map(row => ({
            id: row.id,
            evidenceRowId: row.evidenceRowId,
            ready: row.ready,
            state: row.state,
            exportRoute: row.exportRoute,
            caseId: row.caseId,
            alertIds: row.alertIds,
            captureIds: row.captureIds,
            sourceIds: row.sourceIds,
            blockerCodes: row.blockerCodes,
        })),
        related: {
            alerts: relatedAlerts.slice(0, 4).map(alert => ({
                id: alert.id,
                status: alert.status,
                casePath: alert.casePath,
                captureIds: alert.captureIds ?? [],
                recommendedRoute: alert.recommendedRoute,
            })),
            cases: relatedCases.slice(0, 4).map(item => ({
                id: item.id,
                path: item.path,
                status: item.status,
                title: item.title,
            })),
        },
        sourceRefs: {
            alertIds: unique([...itemAlertIds, ...activeReplayRows.flatMap(row => row.alertIds)]),
            captureIds: unique([...activeCaseItems.flatMap(item => item.captureIds), ...activeReplayRows.flatMap(row => row.captureIds)]),
            casePaths: unique([...itemCasePaths, ...relatedCases.map(item => item.path).filter((value): value is string => Boolean(value))]),
            sourceIds: unique([...selectedSourceIds, ...activeCaseItems.flatMap(item => item.sourceIds), ...activeReplayRows.flatMap(row => row.sourceIds)]),
        },
        consumerStage: caseStage ? {
            id: caseStage.id,
            state: caseStage.state,
            request: caseStage.request ? `${caseStage.request.method} ${caseStage.request.path}` : undefined,
            blockers: caseStage.missing,
        } : undefined,
        blockers: blockerDetails,
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

function selectedWatchlistPlanFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    watchlist: WatchlistRelevance,
    relevance: LocalRelevanceMark | undefined
): SelectedWatchlistPlan {
    const selectedText = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const candidateTerms = uniqueBy([
        ...actionability.watchlistRelevance.terms,
        ...watchlist.terms.map(term => {
            const parsed = watchlistTermParts(term)
            return { kind: parsed.kind, value: parsed.value, notes: watchlist.rationale, matched: watchlist.matchedTerms.some(match => match.toLowerCase() === term.toLowerCase()) }
        }),
        ...(relevance?.watchTerms ?? []).map(term => {
            const parsed = watchlistTermParts(term)
            return { kind: parsed.kind, value: parsed.value, notes: relevance?.rationale ?? 'Session relevance mark.', matched: false }
        }),
    ], term => `${term.kind}:${term.value.toLowerCase()}`).filter(term =>
        selectedText.includes(term.value.toLowerCase())
        || actionability.orgRelevance.candidateTerms.some(candidate => candidate.kind === term.kind && candidate.value.toLowerCase() === term.value.toLowerCase())
    )
    const selectedTerms = candidateTerms.length ? candidateTerms : actionability.watchlistRelevance.terms.slice(0, 4)
    const selectedValues = new Set(selectedTerms.map(term => `${term.kind}:${term.value.toLowerCase()}`))
    const intersections = actionability.orgRelevance.watchlistIntersections.filter(item =>
        selectedValues.has(`${item.kind}:${item.value.toLowerCase()}`)
        || item.sourceEvidenceRefs.some(ref => selectedSourceIds.includes(ref) || selectedText.includes(ref.toLowerCase()))
    )
    const relevantIntersections = intersections.length ? intersections : actionability.orgRelevance.watchlistIntersections.slice(0, 3)
    const selectedTermKeys = new Set(selectedTerms.map(term => `${term.kind}:${term.value.toLowerCase()}`))
    const selectedEvidenceRefs = unique([
        ...selectedSourceIds,
        ...(selected.priority?.captureIds ?? []),
        selected.source,
        selected.provenance,
    ].filter(Boolean))
    const relevanceCandidates = uniqueBy([
        ...actionability.orgRelevance.candidateTerms.filter(term =>
            selectedTermKeys.has(`${term.kind}:${term.value.toLowerCase()}`)
            || term.sourceEvidenceRefs.some(ref => selectedEvidenceRefs.some(selectedRef => selectedRef.toLowerCase() === ref.toLowerCase() || selectedText.includes(ref.toLowerCase())))
            || selectedText.includes(term.value.toLowerCase())
        ),
        ...selectedTerms.map(term => ({
            kind: term.kind,
            value: term.value,
            notes: term.notes,
            matched: term.matched,
            sourceEvidenceRefs: actionability.orgRelevance.sourceEvidence
                .filter(source => source.supportsTerms.some(value => value.toLowerCase() === term.value.toLowerCase()))
                .flatMap(source => [source.sourceId, source.captureId, source.provenance].filter((value): value is string => Boolean(value))),
        })),
    ], term => `${term.kind}:${term.value.toLowerCase()}`).slice(0, 6)
    const relevanceRows = relevanceCandidates.map(term => {
        const matchingIntersection = relevantIntersections.find(item => item.kind === term.kind && item.value.toLowerCase() === term.value.toLowerCase())
            ?? actionability.orgRelevance.watchlistIntersections.find(item => item.kind === term.kind && item.value.toLowerCase() === term.value.toLowerCase())
        const sourceEvidence = actionability.orgRelevance.sourceEvidence.filter(source =>
            term.sourceEvidenceRefs.some(ref => ref === source.sourceId || ref === source.captureId || ref === source.provenance)
            || source.supportsTerms.some(value => value.toLowerCase() === term.value.toLowerCase())
        )
        const blockersForTerm = unique([
            ...(matchingIntersection?.blockers.map(blocker => blocker.handoff) ?? []),
            ...(!term.matched ? actionability.watchlistRelevance.blockers : []),
            ...(sourceEvidence.some(source => source.captureId) ? [] : ['Capture evidence is required before alert rebuild.']),
        ]).slice(0, 6)
        const alertable = Boolean(matchingIntersection?.alertIds.length && matchingIntersection.captureIds.length && !blockersForTerm.length)
        return {
            kind: term.kind,
            value: term.value,
            fit: term.matched ? 'matched' as const : blockersForTerm.length ? 'blocked' as const : 'near' as const,
            alertable,
            route: matchingIntersection?.route ?? actionability.exportPayloads.watchlist.backedRoute ?? actionability.exportPayloads.watchlist.route,
            evidenceRefs: unique([
                ...term.sourceEvidenceRefs,
                ...(matchingIntersection?.sourceEvidenceRefs ?? []),
                ...sourceEvidence.flatMap(source => [source.sourceId, source.captureId, source.provenance].filter((value): value is string => Boolean(value))),
            ]).slice(0, 8),
            sourceFamilies: unique(sourceEvidence.flatMap(source => source.sourceFamily ? [source.sourceFamily] : [])).slice(0, 4),
            blockers: blockersForTerm,
            nextAction: alertable
                ? 'Rebuild alert review from the persisted watchlist item and selected source evidence.'
                : blockersForTerm.length ? `Resolve ${displayRequirementList(blockersForTerm.slice(0, 2))} before alert rebuild.` : 'Review this candidate against the organization watchlist before alert rebuild.',
        }
    })
    const blockers = unique([
        ...actionability.watchlistRelevance.blockers,
        ...actionability.exportPayloads.watchlist.missing,
        ...relevantIntersections.flatMap(item => item.blockers.map(blocker => blocker.handoff)),
    ]).slice(0, 8)
    const ready = actionability.actionPayloads.payloads.watchlistAdd.ready && relevantIntersections.some(item => item.state === 'ready')
    return {
        schemaVersion: 'ti.public_actor.selected_watchlist_plan.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItemId: selected.id,
        title: selected.title,
        state: actionability.watchlistRelevance.state,
        ready,
        route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
        nextAction: ready
            ? 'Open the authenticated watchlist workflow with the selected evidence and persisted item refs.'
            : blockers.length ? `Resolve ${displayRequirementList(blockers.slice(0, 2))} before monitoring this evidence.` : 'Review the candidate term and persist it to an organization watchlist.',
        terms: selectedTerms.map(term => ({
            kind: term.kind,
            value: term.value,
            matched: term.matched || relevantIntersections.some(item => item.kind === term.kind && item.value.toLowerCase() === term.value.toLowerCase()),
            notes: term.notes,
        })),
        relevanceRows,
        intersections: relevantIntersections.map(item => ({
            intersectionId: item.intersectionId,
            kind: item.kind,
            value: item.value,
            state: item.state,
            route: item.route,
            organizationId: item.organizationId,
            watchlistId: item.watchlistId,
            watchlistItemId: item.watchlistItemId,
            alertIds: item.alertIds,
            casePaths: item.casePaths,
            captureIds: item.captureIds,
            sourceEvidenceRefs: item.sourceEvidenceRefs,
            recommendedAction: item.recommendedAction,
            blockers: item.blockers,
        })),
        sourceRefs: {
            sourceIds: unique([...selectedSourceIds, ...actionability.sourceProvenance.map(row => row.sourceId).filter((value): value is string => Boolean(value))]),
            captureIds: unique(relevantIntersections.flatMap(item => item.captureIds)),
            alertIds: unique(relevantIntersections.flatMap(item => item.alertIds)),
            casePaths: unique(relevantIntersections.flatMap(item => item.casePaths)),
        },
        blockers,
        handoff: {
            ready,
            route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            blocked: actionability.exportPayloads.watchlist.blocked,
            missing: actionability.exportPayloads.watchlist.missing,
        },
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

function selectedAlertActionPlanFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    watchlist: WatchlistRelevance,
    caseDraft: SelectedCaseDraft | null,
    relevance: LocalRelevanceMark | undefined
): SelectedAlertActionPlan {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const watchTerms = unique([
        ...watchlist.terms,
        ...actionability.watchlistRelevance.terms.map(term => `${term.kind}: ${term.value}`),
        ...(relevance?.watchTerms ?? []),
    ]).slice(0, 12)
    const captureIds = unique([
        ...actionability.readiness.backedIds.captureIds,
        ...(caseDraft?.sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)) ?? []),
    ])
    const sourceFamilies = unique([
        ...actionability.alertGenerationReadiness.generationEvidenceWindowSourceFamilies,
        ...actionability.sourceHealthQueue.rows.map(row => row.sourceFamily),
    ]).slice(0, 8)
    const missing = unique([
        ...actionability.createAlertHandoff.missing,
        ...actionability.alertGenerationReadiness.blockers.map(blocker => blocker.detail),
    ]).slice(0, 8)
    return {
        schemaVersion: 'ti.public_actor.selected_alert_action_plan.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        state: actionability.alertGenerationReadiness.state,
        ready: actionability.createAlertHandoff.ready && actionability.alertGenerationReadiness.readyForCustomerDelivery,
        route: actionability.alertGenerationReadiness.route,
        sourceRoute: actionability.alertGenerationReadiness.sourceRoute,
        nextAction: missing.length
            ? `Resolve ${displayRequirementList(missing.slice(0, 2))} before alert rebuild.`
            : 'Open the authenticated alert workflow with the selected evidence and watchlist context.',
        readiness: {
            schemaVersion: actionability.alertGenerationReadiness.schemaVersion,
            readyForCustomerDelivery: actionability.alertGenerationReadiness.readyForCustomerDelivery,
            candidateCount: actionability.alertGenerationReadiness.candidateCount,
            matchedCandidateCount: actionability.alertGenerationReadiness.matchedCandidateCount,
            captureRefCount: actionability.alertGenerationReadiness.captureRefCount,
            generationEvidenceWindowReady: actionability.alertGenerationReadiness.generationEvidenceWindowReady,
            latestEvidenceAt: actionability.alertGenerationReadiness.latestEvidenceAt,
            provenance: actionability.alertGenerationReadiness.provenance,
        },
        watchlist: {
            terms: watchTerms,
            matchedTerms: watchlist.matchedTerms,
            organizations: watchlist.organizations,
        },
        sourceRefs: {
            sourceIds: unique([...selectedSourceIds, ...actionability.sourceProvenance.map(row => row.sourceId).filter((value): value is string => Boolean(value))]),
            captureIds,
            alertIds: actionability.readiness.backedIds.alertIds,
            sourceFamilies,
        },
        blockers: actionability.alertGenerationReadiness.blockers,
        handoff: {
            ready: actionability.createAlertHandoff.ready,
            endpoint: actionability.createAlertHandoff.endpoint,
            route: actionability.createAlertHandoff.backedRoute,
            missing,
        },
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

function selectedDeliveryReadinessPlanFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    alertPlan: SelectedAlertActionPlan | null,
    caseOwnership: SelectedCaseOwnershipPlan | null
): SelectedDeliveryReadinessPlan {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedCasePaths = selected.priority?.casePaths ?? []
    const text = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const matchedAlerts = actionability.relatedAlerts.filter(alert =>
        selectedAlertIds.includes(alert.id)
        || text.includes(alert.id.toLowerCase())
        || (alert.captureIds ?? []).some(captureId => selectedCaptureIds.includes(captureId) || text.includes(captureId.toLowerCase()))
        || Boolean(alert.casePath && (selectedCasePaths.includes(alert.casePath) || text.includes(alert.casePath.toLowerCase())))
        || alertPlan?.sourceRefs.alertIds.includes(alert.id)
        || caseOwnership?.sourceRefs.alertIds.includes(alert.id)
    )
    const activeAlerts = matchedAlerts.length ? matchedAlerts : actionability.relatedAlerts.slice(0, 3)
    const deliveryStage = actionability.consumerReadiness.stages.find(stage => stage.id === 'webhookTrigger')
    const alertRows = activeAlerts.map(alert => {
        const context = alert.deliveryReadinessContext
        const captureIds = unique([...(alert.captureIds ?? []), ...(context?.selectedCaptureIds ?? [])])
        const destinationIds = unique([...(alert.webhookDestinationIds ?? []), ...(context?.webhookDestinationIds ?? [])])
        const blockers = unique([
            ...(context?.blockerCodes ?? []).map(deliveryBlockerLabel),
            ...(captureIds.length ? [] : ['Capture evidence is required before delivery review.']),
            ...(destinationIds.length ? [] : ['Active webhook destination is required before delivery review.']),
            ...(alert.casePath || context?.casePath ? [] : ['Case route is required before delivery review.']),
        ]).slice(0, 8)
        return {
            id: alert.id,
            title: alert.title,
            status: alert.status,
            ready: Boolean(context?.ready) && blockers.length === 0,
            casePath: alert.casePath ?? context?.casePath,
            captureIds,
            destinationIds,
            blockers,
            recommendedRoute: alert.recommendedRoute,
        }
    })
    const sourceRefs = {
        alertIds: unique([...activeAlerts.map(alert => alert.id), ...(alertPlan?.sourceRefs.alertIds ?? [])]),
        captureIds: unique([
            ...activeAlerts.flatMap(alert => [...(alert.captureIds ?? []), ...(alert.deliveryReadinessContext?.selectedCaptureIds ?? [])]),
            ...(alertPlan?.sourceRefs.captureIds ?? []),
        ]),
        destinationIds: unique([
            ...actionability.readiness.backedIds.webhookDestinationIds,
            ...activeAlerts.flatMap(alert => [...(alert.webhookDestinationIds ?? []), ...(alert.deliveryReadinessContext?.webhookDestinationIds ?? [])]),
        ]),
        casePaths: unique([
            ...activeAlerts.flatMap(alert => [alert.casePath, alert.deliveryReadinessContext?.casePath]),
            ...(caseOwnership?.sourceRefs.casePaths ?? []),
        ].filter((value): value is string => Boolean(value))),
        sourceIds: unique([
            ...selectedSourceIds,
            ...actionability.sourceProvenance.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
        ]),
    }
    const blockers = unique([
        ...actionability.webhookDeliveryHandoff.missing,
        ...actionability.actionPayloads.payloads.webhookDelivery.blockedBy.map(blocker => blocker.detail),
        ...alertRows.flatMap(alert => alert.blockers),
        ...(deliveryStage?.missing ?? []),
        ...(deliveryStage && deliveryStage.state === 'blocked' ? [deliveryStage.detail] : []),
    ]).slice(0, 10)
    const ready = actionability.webhookDeliveryHandoff.ready
        && actionability.actionPayloads.payloads.webhookDelivery.ready
        && deliveryStage?.state === 'ready'
        && alertRows.some(alert => alert.ready)
        && sourceRefs.destinationIds.length > 0
        && blockers.length === 0
    const state: SelectedDeliveryReadinessPlan['state'] = ready ? 'ready' : blockers.length || alertRows.some(alert => !alert.ready) ? 'blocked' : 'review'
    const route = actionability.webhookDeliveryHandoff.backedRoute
        || actionability.actionPayloads.payloads.webhookDelivery.backedRoute
        || actionability.webhookDeliveryHandoff.endpoint
    return {
        schemaVersion: 'ti.public_actor.selected_delivery_readiness.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        state,
        route,
        nextAction: ready
            ? 'Open the authenticated delivery workflow with this alert, capture, destination, and case route context.'
            : blockers.length ? `Resolve ${displayRequirementList(blockers.slice(0, 2))} before delivery review.` : 'Review the selected alert and choose an authenticated destination.',
        summary: {
            alerts: alertRows.length,
            captures: sourceRefs.captureIds.length,
            destinations: sourceRefs.destinationIds.length,
            caseRoutes: sourceRefs.casePaths.length,
            blockers: blockers.length,
        },
        alerts: alertRows,
        handoff: {
            ready,
            endpoint: actionability.webhookDeliveryHandoff.endpoint,
            route,
            missing: actionability.webhookDeliveryHandoff.missing,
            request: deliveryStage?.request ? `${deliveryStage.request.method} ${deliveryStage.request.path}` : undefined,
        },
        sourceRefs,
        blockers,
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

function deliveryBlockerLabel(value: string) {
    if (value === 'missing_capture_evidence') return 'Capture evidence is required before delivery review.'
    if (value === 'case_route_unavailable') return 'Case route is required before delivery review.'
    if (value === 'delivery_disabled') return 'Active destination is required before delivery review.'
    if (value === 'entitlement_denied') return 'Organization entitlement must allow delivery review.'
    return formatLabel(value)
}

function selectedEnrichmentTriageFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    drilldown: SelectedSourceDrilldown | null
): SelectedEnrichmentTriage {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const drilldownSourceIds = drilldown?.rows.map(row => row.sourceId).filter((value): value is string => Boolean(value)) ?? []
    const sourceIds = unique([...selectedSourceIds, ...drilldownSourceIds])
    const rows = actionability.sourceHealthQueue.rows.filter(row =>
        (row.sourceId ? sourceIds.includes(row.sourceId) : false)
        || (row.captureId ? selected.evidence.some(line => line.includes(row.captureId ?? '')) : false)
        || selected.source.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.provenance.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const selectedRows = rows.length ? rows : actionability.sourceHealthQueue.rows.slice(0, 3)
    const selectedRowIds = new Set(selectedRows.map(row => row.id))
    const selectedRequestIds = new Set(selectedRows.map(row => row.sourceRequestId).filter(Boolean))
    const selectedCaptureIds = new Set(selectedRows.map(row => row.captureId).filter(Boolean))
    const selectedIntakeItems = actionability.sourceEnrichmentIntake.items.filter(item =>
        selectedRowIds.has(item.sourceHealthRowId)
        || (item.sourceRequestId ? selectedRequestIds.has(item.sourceRequestId) : false)
        || (item.captureId ? selectedCaptureIds.has(item.captureId) : false)
        || (item.sourceId ? sourceIds.includes(item.sourceId) : false)
    )
    const triageRows = selectedRows.map(row => {
        const matchingIntakeItems = selectedIntakeItems.filter(item =>
            item.sourceHealthRowId === row.id
            || item.sourceRequestId === row.sourceRequestId
            || item.sourceId === row.sourceId
            || item.captureId === row.captureId
        )
        return {
            id: row.id,
            sourceName: row.sourceName,
            sourceFamily: row.sourceFamily,
            state: row.state,
            route: row.route,
            sourceId: row.sourceId,
            sourceRequestId: row.sourceRequestId,
            captureId: row.captureId,
            requestedFields: row.requestedFields,
            nextAction: row.nextAction,
            matchingIntakeItemIds: matchingIntakeItems.map(item => item.id),
            blockers: matchingIntakeItems.flatMap(item => item.blockedBy.map(blocker => blocker.detail)),
            evidence: {
                provenance: row.provenance,
                timestamp: row.timestamp,
                confidence: row.confidence,
                parserStatus: row.parserStatus,
            },
        }
    })
    const blockers = triageRows.reduce((count, row) => count + row.requestedFields.length + row.blockers.length, 0)
    const state: SelectedEnrichmentTriage['state'] = triageRows.some(row => row.state === 'blocked') || blockers ? 'blocked' : triageRows.some(row => row.state === 'review') ? 'review' : 'ready'
    return {
        schemaVersion: 'ti.public_actor.selected_enrichment_triage.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: actionability.sourceEnrichmentIntake.generatedAt,
        selectedItemId: selected.id,
        title: selected.title,
        route: actionability.sourceEnrichmentIntake.route,
        state,
        summary: {
            sourceRows: triageRows.length,
            intakeItems: selectedIntakeItems.length,
            blockers,
            sourceRequests: selectedIntakeItems.filter(item => Boolean(item.sourceRequestId)).length,
            captures: selectedIntakeItems.filter(item => Boolean(item.captureId)).length,
        },
        rows: triageRows,
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

function publicTiCaseIdFromPath(path?: string) {
    if (!path) return undefined
    const match = path.match(/\/cases\/([^/?#]+)/)
    return match?.[1]
}

function stagedHandoffFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    reviewHandoff: SelectedReviewHandoff,
    sourceDrilldown: SelectedSourceDrilldown,
    caseDraft: SelectedCaseDraft,
    relevance: LocalRelevanceMark | undefined
): StagedHandoff {
    const blockers = unique([
        ...reviewHandoff.blockers,
        ...sourceDrilldown.blockers,
        ...caseDraft.missing,
    ]).slice(0, 10)
    return {
        schemaVersion: 'ti.public_actor.staged_handoff.v1',
        source: 'public-ti',
        sessionLocal: true,
        id: `staged:${selected.id}:${Date.now()}`,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        relevanceState: relevance?.state ?? 'not_marked',
        caseIntent: relevance?.caseIntent ?? caseDraft.caseIntent,
        ready: caseDraft.ready && blockers.length === 0,
        blockers,
        reviewHandoff,
        sourceDrilldown,
        caseDraft,
    }
}

function selectedSourceDrilldownFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    actor: TiActorIntelligenceProfile
): SelectedSourceDrilldown {
    const sourceById = new Map(result.sources.map(source => [source.id, source]))
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedSources = selectedSourceIds
        .map(sourceId => sourceById.get(sourceId))
        .filter((source): source is TiSearchResponse['sources'][number] => Boolean(source))
    const actorRows = actor.provenanceRows.filter(row =>
        selectedSourceIds.includes(row.sourceId ?? '')
        || selected.source.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.provenance.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const sourceRows = actionability.sourceProvenance.filter(row =>
        selectedSourceIds.includes(row.sourceId ?? '')
        || selected.source.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const clusterRows = actionability.sourceClusters.filter(row =>
        selected.provenance.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const candidates: SelectedSourceDrilldownRow[] = [
        ...selectedSources.map(source => drilldownRow({
            sourceId: source.id,
            sourceName: source.name,
            provenance: source.url || source.provenance || selected.provenance,
            href: source.url || linkFromText(source.provenance),
            confidence: selected.confidence,
            handoff: 'Open the returned source and attach capture evidence before case replay if no capture ID is present.',
        })),
        ...actorRows.map(row => drilldownRow({
            sourceId: row.sourceId,
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            reportDate: row.reportDate,
            confidence: row.confidence,
            handoff: row.shownBecause,
        })),
        ...sourceRows.map(row => drilldownRow({
            sourceId: row.sourceId,
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            confidence: row.confidence,
            handoff: row.captureId ? `Use capture ${row.captureId} as replayable case evidence.` : `Attach capture ID or source hash for ${row.sourceName} before case replay.`,
        })),
        ...clusterRows.map(row => drilldownRow({
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            confidence: row.confidence,
            handoff: row.enrichmentTask,
        })),
    ]
    if (!candidates.length) {
        candidates.push(drilldownRow({
            sourceName: selected.source || 'Source collection',
            provenance: selected.href || selected.provenance || selected.source,
            href: selected.href,
            confidence: selected.confidence,
            handoff: 'Attach source ID, provenance URL, capture ID, or source hash before this queue item can support stronger handoff.',
        }))
    }
    const rows = uniqueBy(candidates, row => `${row.sourceId ?? row.sourceName}:${row.provenance}:${row.captureId ?? ''}`).slice(0, 6)
    const blockers = unique([
        ...rows.flatMap(row => row.missing),
        ...actionability.readiness.blockers
            .filter(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
            .map(blocker => blocker.handoff),
    ]).slice(0, 6)

    return {
        schemaVersion: 'ti.public_actor.selected_source_drilldown.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItem: {
            id: selected.id,
            kind: selected.kind,
            title: selected.title,
            timestamp: selected.timestamp,
            source: selected.source,
            provenance: selected.provenance,
            confidence: selected.confidence,
            href: selected.href,
        },
        rows,
        alertHandoff: {
            ready: actionability.createAlertHandoff.ready,
            endpoint: actionability.createAlertHandoff.endpoint,
            route: actionability.createAlertHandoff.backedRoute,
            missing: actionability.createAlertHandoff.missing,
        },
        caseHandoff: {
            ready: actionability.caseHandoff.ready,
            endpoint: actionability.caseHandoff.endpoint,
            route: actionability.caseHandoff.backedRoute,
            missing: actionability.caseHandoff.missing,
        },
        blockers,
    }
}

function drilldownRow(input: {
    sourceId?: string
    sourceName: string
    provenance: string
    href?: string
    captureId?: string
    reportDate?: string
    confidence?: number
    handoff: string
}): SelectedSourceDrilldownRow {
    const hasSource = Boolean(input.sourceId || input.provenance || input.href)
    const state: SelectedSourceDrilldownRow['state'] = input.captureId ? 'ready' : hasSource ? 'needs_capture' : 'needs_source'
    const missing = [
        hasSource ? '' : 'Source ID or provenance URL is required.',
        input.captureId ? '' : 'Capture ID or source hash is required before replayable case evidence.',
    ].filter(Boolean)
    const provenance = input.provenance || input.href || input.sourceName
    return {
        rowId: `source-drilldown:${input.sourceId ?? input.sourceName}:${provenance}:${input.captureId ?? 'missing-capture'}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        sourceName: input.sourceName,
        sourceId: input.sourceId,
        provenance,
        href: input.href,
        captureId: input.captureId,
        reportDate: input.reportDate,
        confidence: input.confidence,
        state,
        ownerLane: state === 'ready' ? 'case' : state === 'needs_capture' ? 'source' : 'public-ti',
        route: state === 'ready' ? '/v1/cases' : '/dashboard/ti/enrichment',
        missing,
        handoff: input.handoff,
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
        detail: `${gap.detail} Source family: ${formatLabel(gap.sourceFamily)}. Needs: ${gap.requestedFields.map(sourceHealthFieldLabel).join(', ')}. Route: ${sourceRequestRouteLabel(gap.route)}.`,
        route: gap.route,
        sourceFamily: gap.sourceFamily,
        requestedFields: gap.requestedFields,
        ownerLane: gap.sourceFamily === 'alert' ? 'alert' : gap.sourceFamily === 'case' ? 'case' : gap.sourceFamily === 'watchlist' ? 'org' : 'source',
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

function relevanceMarkFor(
    state: LocalRelevanceMark['state'],
    selected: AnalystWorkItem,
    watchlist: WatchlistRelevance,
    actionability: TiActionabilityModel,
    note: string
): LocalRelevanceMark {
    const watchTerms = unique([
        ...watchlist.matchedTerms,
        ...watchlist.terms,
        ...actionability.watchlistRelevance.terms.map(term => `${term.kind}: ${term.value}`),
    ]).slice(0, 8)
    const sourceBlocked = actionability.readiness.blockers.some(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
    const caseIntent: LocalRelevanceMark['caseIntent'] = state === 'not_relevant'
        ? 'no_case'
        : state === 'needs_source' || sourceBlocked
            ? 'source_review'
            : state === 'customer_relevant' && (selected.kind === 'exposure' || actionability.caseHandoff.ready || actionability.createAlertHandoff.ready)
                ? 'case_candidate'
                : 'watchlist_context'
    const defaultRationale = state === 'customer_relevant'
        ? 'Marked for customer relevance review from selected evidence and watchlist context.'
        : state === 'context_only'
            ? 'Marked as actor context for watchlist and detection enrichment.'
            : state === 'needs_source'
                ? 'Marked for source or capture enrichment before customer-facing action.'
                : 'Marked as not relevant for current watchlist or case work.'
    return {
        state,
        rationale: note.trim() || defaultRationale,
        watchTerms,
        caseIntent,
        markedAt: new Date().toISOString(),
    }
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

function readStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(item => readStringArray(item))
    if (typeof value === 'string' && value.trim()) return [value.trim()]
    if (value && typeof value === 'object' && 'value' in value) return readStringArray((value as { value?: unknown }).value)
    return []
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
    const seen = new Set<string>()
    return values.filter(value => {
        const key = keyFor(value)
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

function relevanceLabel(status: LocalRelevanceMark['state']) {
    if (status === 'customer_relevant') return 'customer'
    if (status === 'context_only') return 'context'
    if (status === 'needs_source') return 'source review'
    return 'not relevant'
}

function relevanceLabelForStaged(status: StagedHandoff['relevanceState']) {
    if (status === 'not_marked') return 'unmarked'
    return relevanceLabel(status)
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
        <section className='min-w-0 border border-[#dfe5ee] bg-white p-4 dark:border-[#263244] dark:bg-[#101722]'>
            <div className='mb-2 flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-[#171a21] dark:text-[#eef4ff]'>
                <span className='text-[#3056d3] dark:text-[#9ab3ff]'>{icon}</span>
                <span className='min-w-0 wrap-break-word'>{title}</span>
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

function SourceActivationPanel({ activation }: { activation: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow'] }) {
    const blockedCount = activation.actions.filter(action => action.execution === 'blocked').length
    const approvalCount = activation.actions.filter(action => action.execution === 'human_approval_required').length
    const state: DecisionStep['status'] = blockedCount ? 'blocked' : approvalCount || activation.dryRunOnly ? 'review' : 'ready'
    return (
        <Panel title='Source Activation' description='Source actions returned by collection policy. Public TI can stage review, but source changes require authenticated approval.' icon={<ShieldAlert className='h-4 w-4' />}>
            <div data-ti-source-activation='true' className='grid min-w-0 gap-3'>
                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-[#667085] dark:text-[#9aa8bd]'>Activation state</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b7c2d4]'>
                            {activation.dryRunOnly ? 'Actions are review-only until a console user approves source changes.' : 'Returned source actions are ready for authenticated review.'}
                        </p>
                    </div>
                    <span className={decisionStepStatusClass(state)}>{decisionStepStatusLabel(state)}</span>
                </div>
                <div className='grid min-w-0 gap-2'>
                    {activation.actions.map(action => (
                        <div key={`${action.action}-${action.sourceId ?? 'none'}-${action.execution}`} className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-2 dark:border-[#273244] dark:bg-[#131c29]'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-xs font-semibold text-[#171a21] dark:text-[#eef4ff]'>{sourceActivationActionLabel(action.action)}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-[#596170] dark:text-[#b7c2d4]'>{action.reason}</p>
                                </div>
                                <span className={sourceActivationExecutionClass(action.execution)}>{sourceActivationExecutionLabel(action.execution)}</span>
                            </div>
                            {action.sourceId ? <p className='mt-1 break-all font-mono text-[11px] text-[#667085] dark:text-[#9aa8bd]'>source {action.sourceId}</p> : null}
                        </div>
                    ))}
                </div>
            </div>
        </Panel>
    )
}

function InfoTip({ label }: { label: string }) {
    return (
        <span className='group relative inline-flex'>
            <span
                tabIndex={0}
                aria-label={label}
                className='inline-flex h-6 w-6 cursor-help items-center justify-center rounded-full text-[#667085] transition hover:bg-[#eef3ff] hover:text-[#3056d3] focus:outline-none focus:ring-2 focus:ring-[#b8c5ff] dark:text-[#9aa8bd] dark:hover:bg-[#182235] dark:hover:text-[#d8e2f2]'
            >
                <HelpCircle className='h-3.5 w-3.5' />
            </span>
            <span className='pointer-events-none absolute left-1/2 top-7 z-20 hidden w-72 -translate-x-1/2 rounded-lg border border-[#dfe5ee] bg-white p-3 text-left text-xs font-medium leading-5 text-[#404957] shadow-xl group-hover:block group-focus-within:block dark:border-[#273244] dark:bg-[#0f1621] dark:text-[#d8e2f2]'>
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
        <span className={`inline-flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs ${dark ? 'border-[#263244] bg-[#101722] text-[#d8deea]' : 'border-[#dfe5ee] bg-[#f8fafc] text-[#667085]'}`}>
            <span className={`shrink-0 ${dark ? 'text-[#b8c5ff]' : 'text-[#3056d3]'}`}>{icon}</span>
            <span className='shrink-0'>{label}</span>
            <span className={`min-w-0 wrap-break-word font-semibold ${dark ? 'text-white' : 'text-[#171a21]'}`}>{value}</span>
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
                aria-label={point ? `${point.label}: ${point.role === 'operator' ? 'reported operator origin' : 'reported victim or targeting observation'}` : undefined}
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
        <div className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-[#f8fafc] dark:border-[#273244] dark:bg-[#0f1621]'>
            <div className='flex items-center justify-between gap-3 border-b border-[#e8edf5] px-4 py-3 dark:border-[#273244]'>
                <div>
                    <h2 className='text-sm font-semibold text-[#171a21] dark:text-[#eef4ff]'>Country Context</h2>
                    <p className='mt-0.5 text-xs text-[#667085] dark:text-[#9aa8bd]'>Source-backed country coverage for operator attribution and targeting observations.</p>
                </div>
                <span className='rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#3056d3] dark:bg-[#131c29] dark:text-[#9eb3ff]'>{hasPoints ? `${geo.points.length} countries` : 'Country data pending'}</span>
            </div>
            <div className='relative min-h-96 overflow-hidden bg-[#f7f9fc] dark:bg-[#0b111a]'>
                <div className='absolute left-3 top-3 z-20 rounded-lg border border-[#dfe5ee] bg-white/90 px-3 py-1.5 text-xs text-[#596170] shadow-sm backdrop-blur dark:border-[#273244] dark:bg-[#101826]/90 dark:text-[#b7c2d4]'>
                    <span className='inline-flex items-center gap-2'>
                        <Move className='h-3.5 w-3.5' />
                        Drag to pan · wheel to zoom
                    </span>
                </div>
                <div className='absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-lg border border-[#dfe5ee] bg-white/90 p-1 shadow-sm backdrop-blur dark:border-[#273244] dark:bg-[#101826]/90'>
                    <MapZoomButton label='−' onClick={() => setViewBox((current) => zoomViewBox(current, 1.18, MAP_WIDTH / 2, MAP_HEIGHT / 2))} />
                    <MapZoomButton label='Reset' wide onClick={() => setViewBox(INITIAL_VIEWBOX)} />
                    <MapZoomButton label='+' onClick={() => setViewBox((current) => zoomViewBox(current, 0.84, MAP_WIDTH / 2, MAP_HEIGHT / 2))} />
                </div>
                <svg
                    viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                    role='img'
                    aria-label={`Country-level actor map for ${humanizeSlug(result.query)}`}
                    className='relative z-10 h-96 w-full cursor-grab bg-white active:cursor-grabbing dark:bg-[#0b111a]'
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
                                    className='fill-[#171a21] text-[10px] font-bold dark:fill-[#eef4ff]'
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
                    <div className='absolute inset-3 grid place-items-center rounded-lg bg-white/80 px-4 text-center text-sm font-medium text-[#667085] dark:bg-[#101826]/85 dark:text-[#b7c2d4]'>
                        Country mapping will appear when this profile has country-level target or origin observations.
                    </div>
                ) : null}
            </div>
            {hasPoints ? (
                <div className='grid gap-3 border-t border-[#e8edf5] bg-white px-4 py-3 dark:border-[#273244] dark:bg-[#0f1621]'>
                    <div className='flex flex-wrap gap-3 text-xs'>
                        <span className='inline-flex items-center gap-1.5 text-[#667085] dark:text-[#9aa8bd]'><span className='h-2.5 w-2.5 rounded-full bg-[#7c3aed]' />Operator attribution</span>
                        <span className='inline-flex items-center gap-1.5 text-[#667085] dark:text-[#9aa8bd]'><span className='h-2.5 w-2.5 rounded-full bg-[#d92d20]' />Victim or targeting observation</span>
                        <span className='inline-flex items-center gap-1.5 text-[#667085] dark:text-[#9aa8bd]'><span className='h-2.5 w-2.5 rounded-full border border-[#b7c2d4]' />Country-level source coverage</span>
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
    const payload = geographyContextPayloadFor(point, handoff)
    const routeLabel = handoff?.watchlistTerm ? 'Watchlist review' : 'Source enrichment'
    return (
        <div
            data-ti-geo-context-actions='true'
            className={`rounded-lg border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-[#b8c5ff] ${active ? 'border-[#3056d3] bg-[#eef3ff] dark:border-[#5269d8] dark:bg-[#172449]' : 'border-[#eef1f5] bg-[#fbfcfe] hover:border-[#d8dee9] hover:bg-white dark:border-[#273244] dark:bg-[#131c29] dark:hover:border-[#314057] dark:hover:bg-[#172131]'}`}
        >
            <button type='button' onClick={onFocus} className='grid w-full min-w-0 gap-1 text-left focus:outline-none'>
                <span className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                    <span className='min-w-0 wrap-break-word font-semibold text-[#171a21] dark:text-[#eef4ff]'>{point.label}</span>
                    <span className={point.role === 'operator' ? 'whitespace-nowrap text-[#7c3aed] dark:text-[#b89cff]' : 'whitespace-nowrap text-[#b42318] dark:text-[#ffb4aa]'}>{point.role === 'operator' ? 'operator attribution' : `${point.count} observation${point.count === 1 ? '' : 's'}`}</span>
                </span>
            </button>
            <p className='mt-1 leading-5 text-[#667085] dark:text-[#9aa8bd]'>{point.detail}</p>
            {handoff ? (
                <div className='mt-2 rounded-md border border-[#dfe5ee] bg-white px-2 py-1.5 dark:border-[#273244] dark:bg-[#0f1621]'>
                    <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                        <div className='min-w-0'>
                            <p className='font-semibold text-[#344054] dark:text-[#d8e2f2]'>{handoff.watchlistTerm ? `${handoff.watchlistTerm.kind}: ${handoff.watchlistTerm.value}` : 'Enrichment task'}</p>
                            <p className='mt-1 leading-5 text-[#667085] dark:text-[#9aa8bd]'>{handoff.watchlistTerm?.reason ?? handoff.enrichmentTask}</p>
                        </div>
                        <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:shrink-0'>
                            <span className={sourceHealthChipClass(handoff.watchlistTerm ? 'ready' : 'review')}>{routeLabel}</span>
                            <CopyPayloadButton label='Geography context' payload={payload} />
                        </div>
                    </div>
                    {handoff.evidenceRows.length ? (
                        <div data-ti-geo-provenance='true' className='mt-2 grid gap-1 border-t border-[#eef1f5] pt-2'>
                            {handoff.evidenceRows.slice(0, 2).map(row => (
                                <p key={`${point.code}-${row.victim}-${row.reportDate}`} className='wrap-break-word text-[11px] leading-5 text-[#667085] dark:text-[#9aa8bd]'>
                                    {row.victim} · {formatDate(row.reportDate)} · {Math.round(row.confidence * 100)}% · {row.sourceIds.length ? row.sourceIds.map(sourceId => `source ${sourceId}`).join(', ') : row.source}
                                </p>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}

function geographyContextPayloadFor(point: ReturnType<typeof actorGeoProfile>['points'][number], handoff?: TiActionabilityModel['geographyHandoffs'][number]) {
    return {
        schemaVersion: 'ti.public_actor.geography_context.v1',
        country: {
            code: point.code,
            name: point.label,
            role: point.role,
            observationCount: point.count,
            basis: 'country_source_coverage',
        },
        action: handoff?.watchlistTerm ? 'review_watchlist_term' : 'queue_source_enrichment',
        watchlistTerm: handoff?.watchlistTerm ?? null,
        enrichmentTask: handoff?.enrichmentTask ?? `Attach source evidence before routing ${point.label} into monitoring.`,
        provenanceSummary: handoff?.provenanceSummary ?? point.detail,
        evidence: handoff?.evidenceRows.map(row => ({
            victim: row.victim,
            source: row.source,
            sourceIds: row.sourceIds,
            provenanceRefs: row.provenanceRefs,
            reportDate: row.reportDate,
            confidence: row.confidence,
        })) ?? [],
        route: handoff?.watchlistTerm ? '/dashboard/ti/watchlists' : '/dashboard/ti/enrichment',
        blockedBy: handoff ? [] : [{
            ownerLane: 'source',
            reason: 'Country row needs source evidence before it can be routed.',
        }],
    }
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

function coverageMissingLabel(value: string) {
    if (value.includes('captureId')) return 'capture references'
    if (value.includes('reportDate')) return 'report dates'
    if (value.includes('sourceId')) return 'source identifiers'
    if (value.includes('structuredProvenance')) return 'structured provenance'
    if (value.includes('datedActivityRow')) return 'dated activity rows'
    if (value.includes('provenanceRefs')) return 'provenance references'
    return formatLabel(value)
}

function watchlistIntersectionActionLabel(value: TiActionabilityModel['orgRelevance']['watchlistIntersections'][number]['recommendedAction']) {
    if (value === 'open_watchlist_item') return 'Open saved watchlist item'
    if (value === 'persist_watchlist_item') return 'Save watchlist item'
    if (value === 'rebuild_alerts') return 'Rebuild related alerts'
    if (value === 'open_case') return 'Open related case'
    return 'Attach source evidence'
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

function sourceActivationActionLabel(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['action']) {
    if (value === 'request_approval') return 'Request approval'
    if (value === 'restore_source') return 'Restore source'
    if (value === 'enable_metadata_only_queue') return 'Enable metadata-only queue'
    return 'Keep blocked'
}

function sourceActivationExecutionLabel(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['execution']) {
    if (value === 'human_approval_required') return 'approval required'
    if (value === 'dry_run') return 'review only'
    return 'blocked'
}

function sourceActivationExecutionClass(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['execution']) {
    if (value === 'dry_run') return decisionStepStatusClass('review')
    if (value === 'human_approval_required') return decisionStepStatusClass('review')
    return decisionStepStatusClass('blocked')
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
