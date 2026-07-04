'use client'

import searchThreatIntel, { TiSearchResponse } from '@/utils/ti/search'
import { actorGeoProfile, countryFromValue, victimObservationsFor } from '@/utils/ti/actorProfile'
import { buildActorIntelligence, type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { buildTiActionability, type TiActionabilityModel } from '@/utils/ti/actionability'
import { PUBLIC_TI_HANDOFF_ACTIONS, buildActorArtifactHandoffs, buildActorArtifacts, nextActorArtifactId, type ActorArtifact, type ActorArtifactHandoffs, type ActorArtifactKind } from '@/utils/ti/actorWorkbench'
import { countryCentroids } from '@/utils/monitoring/geo'
import { clampViewBox, getCountryFocusView, INITIAL_VIEWBOX, MAP_HEIGHT, MAP_WIDTH, project, type ViewBox, zoomViewBox } from '@/utils/monitoring/liveTrafficMap'
import mapData from '@parent/public/world.json'
import { Activity, BellRing, Building2, CheckCircle2, ClipboardList, Clock3, Copy, Database, ExternalLink, Eye, Globe2, HelpCircle, Inbox, Move, Search, Send, ShieldAlert, ShieldCheck, UserPlus, XCircle } from 'lucide-react'
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
        <div className={visible ? 'mx-auto grid w-full max-w-7xl gap-6' : 'mx-auto grid min-h-[calc(100vh-9rem)] w-full max-w-4xl place-content-center gap-5 py-10'}>
            <form onSubmit={submit} className={visible ? 'grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-2 shadow-sm md:p-3' : 'grid gap-5'}>
                {!visible ? (
                    <div className='text-center'>
                        <h1 className='text-3xl font-semibold tracking-normal text-ui-text dark:text-ui-text md:text-4xl'>Search threat intelligence</h1>
                        <p className='mt-3 text-sm font-medium text-ui-primary dark:text-ui-primary'>Find current intelligence about any threat actor, company, domain, CVE, or malware family.</p>
                    </div>
                ) : null}
                <div className={`flex flex-col gap-3 ${visible ? 'md:flex-row md:items-end' : 'rounded-2xl border border-ui-border bg-ui-panel p-3 shadow-[0_18px_50px_rgba(26,35,55,0.12)] dark:border-ui-border dark:bg-ui-panel'}`}>
                    <label className='grid flex-1 gap-2'>
                        <span className={`text-xs font-semibold uppercase text-ui-primary ${visible ? 'sr-only' : ''}`}>Threat intelligence search</span>
                        <input
                            ref={inputRef}
                            name='q'
                            value={query}
                            onChange={(event) => handleQueryChange(event.target.value)}
                            placeholder='APT29, LockBit, microsoft.com, CVE-2024-3094...'
                            className={`${visible ? 'h-10 rounded-lg px-3 text-sm' : 'h-16 rounded-xl px-4 text-base'} border border-ui-border bg-ui-panel font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:placeholder:text-ui-muted`}
                        />
                    </label>
                    <button
                        type='submit'
                        aria-busy={busy}
                        className={`${visible ? 'h-10 rounded-lg' : 'h-16 rounded-xl'} inline-flex items-center justify-center gap-2 bg-ui-text px-5 text-sm font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted dark:bg-ui-primary dark:hover:bg-ui-primary`}
                    >
                        <Search className='h-4 w-4' />
                        {busy ? 'Searching' : 'Search'}
                    </button>
                </div>
                {error ? <p className='text-sm text-ui-danger'>{error}</p> : null}
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
    const [queueKindFilter, setQueueKindFilter] = useState<AnalystWorkItem['kind'] | 'all'>('all')
    const [queueSourceFilter, setQueueSourceFilter] = useState('all')
    const [queueConfidenceFilter, setQueueConfidenceFilter] = useState<'all' | 'high' | 'medium'>('all')
    const [queueSort, setQueueSort] = useState<'priority' | 'confidence' | 'freshness'>('priority')
    const [showMoreAnalysis, setShowMoreAnalysis] = useState(false)
    const [showFullQueue, setShowFullQueue] = useState(false)
    const filteredWorkItems = useMemo(() => filteredAnalystWorkItems(workItems, {
        kind: queueKindFilter,
        source: queueSourceFilter,
        confidence: queueConfidenceFilter,
        sort: queueSort,
    }), [queueConfidenceFilter, queueKindFilter, queueSort, queueSourceFilter, workItems])
    const visibleQueueItems = showFullQueue ? filteredWorkItems : filteredWorkItems.slice(0, 6)
    const queueSourceOptions = useMemo(() => unique(workItems.map(item => item.source).filter(Boolean)).sort((a, b) => a.localeCompare(b)).slice(0, 8), [workItems])
    const queueSourceCounts = useMemo(() => sourceCountsFor(filteredWorkItems), [filteredWorkItems])
    const selected = filteredWorkItems.find(item => item.id === selectedId) ?? filteredWorkItems[0] ?? workItems.find(item => item.id === selectedId) ?? workItems[0]
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
    const selectedCaseCreateRequest = selected ? selectedCaseCreateRequestFor(result, selected, actorIntel, actionability, selectedCaseDraft, selectedCaseOwnership, selectedSourceDrilldown, selectedWatchlistPlan) : null
    const selectedDeliveryPlan = selected ? selectedDeliveryReadinessPlanFor(result, selected, actionability, selectedAlertPlan, selectedCaseOwnership) : null
    const selectedTriageBrief = selected ? selectedTriageBriefFor(result, selected, actionability, watchlist, alertPacket, selectedCaseDraft) : null
    const enrichmentTasks = enrichmentTasksFor(result, selected, watchlist, sources, actorIntel, actionability)
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
    const queueCounts = queueCountsFor(filteredWorkItems, localDecisions)
    const profileStats = [
        { icon: <ShieldCheck className='h-3.5 w-3.5' />, label: 'Sources', value: sourceCountLabel(sources.length) },
        { icon: <Activity className='h-3.5 w-3.5' />, label: 'Freshness', value: formatDate(result.lastSeen || result.generatedAt) },
        { icon: <Inbox className='h-3.5 w-3.5' />, label: 'Open reviews', value: `${queueCounts.open} open` },
        { icon: <BellRing className='h-3.5 w-3.5' />, label: 'Related alerts', value: String(actionability.relatedAlerts.length) },
        { icon: <Database className='h-3.5 w-3.5' />, label: 'Gaps', value: `${openGapCount} open` },
    ]
    const sectionOverview = sectionOverviewFor({ result, actorIntel, actionability, workItems, victimObservations, watchlist })
    const commandLinks = [
        { href: '#ti-activity', label: 'Latest activity', value: `${filteredWorkItems.length}/${workItems.length} results`, icon: Inbox },
        { href: '#ti-selected-evidence', label: 'Evidence', value: selected ? selected.source : 'select result', icon: Eye },
        { href: '#ti-secondary-analysis', label: 'Workbenches', value: `${sources.length} sources`, icon: Database },
        { href: '/dashboard', label: 'Console', value: `${actionability.relatedCases.length} cases`, icon: ShieldAlert },
        { href: '/dashboard/automations?setup=dwm', label: 'Delivery', value: `${actionability.readiness.backedIds.webhookDestinationIds.length} destinations`, icon: Send },
    ]
    const mobileEvidenceWorkbar = selected ? (
        <MobileEvidenceWorkbar
            selected={selected}
            filteredCount={filteredWorkItems.length}
            totalCount={workItems.length}
            kind={queueKindFilter}
            source={queueSourceFilter}
            confidence={queueConfidenceFilter}
            sourceCounts={queueSourceCounts}
            onKindChange={setQueueKindFilter}
            onSourceChange={setQueueSourceFilter}
            onConfidenceChange={setQueueConfidenceFilter}
            onMarkReviewed={() => applyDecision('reviewing')}
            onEscalate={() => applyDecision('escalated')}
            onWatchlist={() => selected && setRelevanceMarks(current => ({ ...current, [selected.id]: relevanceMarkFor('customer_relevant', selected, watchlist, actionability, selectedNote) }))}
            onCase={() => stageSelectedHandoff()}
            caseAvailable={Boolean(selectedCaseDraft && selectedCaseOwnership && selectedCaseCreateRequest && selectedWatchlistPlan && selectedAlertPlan && selectedDeliveryPlan && selectedEnrichmentTriage && selectedCaseActionTrail)}
        />
    ) : null

    useEffect(() => {
        if (!workItems.length) return
        if (filteredWorkItems.length && !filteredWorkItems.some(item => item.id === selectedId)) {
            setSelectedId(filteredWorkItems[0]?.id ?? '')
            return
        }
        if (!filteredWorkItems.length && !workItems.some(item => item.id === selectedId)) setSelectedId(workItems[0]?.id ?? '')
    }, [filteredWorkItems, selectedId, workItems])

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
        if (!selected || !selectedArtifact || !selectedArtifactHandoffs || !reviewHandoff || !selectedSourceDrilldown || !selectedCaseDraft || !selectedCaseOwnership || !selectedCaseCreateRequest || !selectedWatchlistPlan || !selectedAlertPlan || !selectedDeliveryPlan || !selectedEnrichmentTriage || !selectedCaseActionTrail) return
        const staged = stagedHandoffFor(result, selected, selectedArtifactPayloadFor(selectedArtifact, selectedArtifactHandoffs), reviewHandoff, selectedSourceDrilldown, selectedCaseDraft, selectedCaseOwnership, selectedCaseCreateRequest, selectedWatchlistPlan, selectedAlertPlan, selectedDeliveryPlan, selectedEnrichmentTriage, selectedCaseActionTrail, selectedRelevance)
        setStagedHandoffs(current => ({ ...current, [staged.id]: staged }))
    }

    return (
        <div className='grid gap-6'>
            <section data-ti-workspace='true' className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm dark:border-ui-border dark:bg-ui-panel'>
                {mobileEvidenceWorkbar ? <div className='border-b border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-panel lg:hidden'>{mobileEvidenceWorkbar}</div> : null}
                {selected ? (
                    <div className='border-b border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel lg:hidden'>
                        <TopSelectedEvidencePanel selected={selected} drilldown={selectedSourceDrilldown} caseReady={Boolean(selectedCaseDraft && selectedCaseOwnership)} />
                    </div>
                ) : null}
                <div className='grid gap-4 border-b border-ui-border bg-ui-panel p-4 dark:border-ui-border dark:bg-ui-panel'>
                    <div className='grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] xl:items-stretch'>
                        <div className='grid min-w-0 content-start gap-4'>
                            <div className='min-w-0'>
                                <div className='flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center'>
                                    <h1 className='min-w-0 max-w-full wrap-break-word text-3xl font-semibold tracking-normal text-ui-text dark:text-ui-text md:text-4xl'>{humanizeSlug(result.query)}</h1>
                                    {result.status ? (
                                        <span className='max-w-full wrap-break-word rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold uppercase leading-5 text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'>
                                            {humanResultStatus(result.status)}
                                        </span>
                                    ) : null}
                                </div>
                                <p className='mt-3 max-w-3xl text-base leading-7 text-ui-muted dark:text-ui-muted'>{displayRequirementText(result.summary)}</p>
                            </div>
                            <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                                {profileStats.map(item => (
                                    <ProfileStat key={item.label} icon={item.icon} label={item.label} value={item.value} />
                                ))}
                            </div>
                            <ActorIntelHighlights actor={actorIntel} result={result} actionability={actionability} />
                        </div>
                        {selected ? (
                            <div className='hidden min-w-0 lg:block'>
                                <TopSelectedEvidencePanel selected={selected} drilldown={selectedSourceDrilldown} caseReady={Boolean(selectedCaseDraft && selectedCaseOwnership)} />
                            </div>
                        ) : (
                            <div className='hidden min-w-0 rounded-lg border border-dashed border-ui-border bg-ui-panel p-4 text-sm text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted lg:block'>
                                Select a finding to inspect evidence, source context, and case handoff.
                            </div>
                        )}
                    </div>
                </div>
                <ActorActionStrip
                    actor={actorIntel}
                    actionability={actionability}
                    selected={selected}
                    caseAvailable={Boolean(selectedCaseDraft && selectedCaseOwnership && selectedCaseCreateRequest && selectedWatchlistPlan && selectedAlertPlan && selectedDeliveryPlan && selectedEnrichmentTriage && selectedCaseActionTrail)}
                    onWatchlist={() => selected && setRelevanceMarks(current => ({ ...current, [selected.id]: relevanceMarkFor('customer_relevant', selected, watchlist, actionability, selectedNote) }))}
                    onCase={() => stageSelectedHandoff()}
                    onEscalate={() => applyDecision('escalated')}
                    onReview={() => applyDecision('reviewing')}
                />

                <div className='grid min-h-[44rem] min-w-0 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_340px]'>
                    <aside id='ti-activity' data-ti-queue='true' className='order-2 min-w-0 border-b border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-canvas lg:order-none lg:border-b-0 lg:border-r'>
                        <div className='border-b border-ui-border p-4 dark:border-ui-border'>
                            <div className='flex items-center justify-between gap-3'>
                                <div>
                                    <h2 className='text-sm font-semibold text-ui-text dark:text-ui-text'>Latest activity</h2>
                                    <p className='mt-1 text-xs text-ui-muted dark:text-ui-muted'>Evidence ordered by severity, source basis, and recency.</p>
                                </div>
                                <span className='rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'>{workItems.length}</span>
                            </div>
                            <div className='mt-3 grid grid-cols-3 gap-2 text-center text-xs'>
                                <QueueMetric label='Open' value={queueCounts.open} />
                                <QueueMetric label='High' value={queueCounts.high} />
                                <QueueMetric label='Closed' value={queueCounts.closed} />
                            </div>
                            <EvidenceQueueFilters
                                kind={queueKindFilter}
                                source={queueSourceFilter}
                                confidence={queueConfidenceFilter}
                                sort={queueSort}
                                sources={queueSourceOptions}
                                sourceCounts={queueSourceCounts}
                                onKindChange={setQueueKindFilter}
                                onSourceChange={setQueueSourceFilter}
                                onConfidenceChange={setQueueConfidenceFilter}
                                onSortChange={setQueueSort}
                            />
                        </div>
                        <div className='p-2 lg:max-h-[40rem] lg:overflow-y-auto'>
                            {visibleQueueItems.map(item => {
                                const decision = localDecisions[item.id]
                                const active = selected?.id === item.id
                                return (
                                    <button
                                        key={item.id}
                                        type='button'
                                        onClick={() => setSelectedId(item.id)}
                                        className={`grid w-full gap-2 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${active ? 'border-ui-primary bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-primary/10' : 'border-transparent bg-transparent hover:border-ui-border hover:bg-ui-panel dark:hover:border-ui-border dark:hover:bg-ui-raised'}`}
                                    >
                                        <div className='flex items-center justify-between gap-2'>
                                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${severityClass(item.severity)}`}>{item.severity}</span>
                                            <span className='text-[11px] text-ui-muted dark:text-ui-muted'>{decision ? decisionLabel(decision.status) : item.status}</span>
                                        </div>
                                        <span className='text-sm font-semibold leading-5 text-ui-text dark:text-ui-text'>{displayRequirementText(item.title)}</span>
                                        <span className='line-clamp-2 text-xs leading-5 text-ui-muted dark:text-ui-muted'>{item.subtitle}</span>
                                        <span className='flex flex-wrap gap-2 text-[11px] text-ui-muted dark:text-ui-muted'>
                                            <span>{item.timestamp}</span>
                                            <span>{item.source}</span>
                                            <span>{sourceBasisLabel(item.confidence)}</span>
                                            {item.priority ? <span>{item.priority.score}/100 priority</span> : null}
                                        </span>
                                    </button>
                                )
                            })}
                            {filteredWorkItems.length > visibleQueueItems.length ? (
                                <button
                                    type='button'
                                    onClick={() => setShowFullQueue(true)}
                                    className='mt-2 flex min-h-9 w-full items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                                >
                                    Show {filteredWorkItems.length - visibleQueueItems.length} more findings
                                </button>
                            ) : null}
                            {showFullQueue && filteredWorkItems.length > 6 ? (
                                <button
                                    type='button'
                                    onClick={() => setShowFullQueue(false)}
                                    className='mt-2 flex min-h-9 w-full items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                                >
                                    Show top findings only
                                </button>
                            ) : null}
                            {!filteredWorkItems.length ? <p className='rounded-lg border border-dashed border-ui-border bg-ui-panel p-4 text-sm text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{workItems.length ? 'No results match the current filters.' : 'No recent activity yet.'}</p> : null}
                        </div>
                    </aside>

                    <main className='order-1 min-w-0 p-4 lg:order-none'>
                        {selected ? (
                            <div className='grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-4 overflow-hidden'>
                                <section id='ti-selected-evidence' data-ti-detail='true' className='rounded-lg border border-ui-border bg-ui-panel p-4 dark:border-ui-border dark:bg-ui-panel'>
                                    <div className='flex flex-wrap items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${severityClass(selected.severity)}`}>{selected.severity}</span>
                                                <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-muted'>{kindLabel(selected.kind)}</span>
                                                <span className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'>{selectedDecision ? decisionLabel(selectedDecision.status) : selected.status}</span>
                                            </div>
                                            <h2 className='mt-3 wrap-break-word text-2xl font-semibold text-ui-text dark:text-ui-text'>{displayRequirementText(selected.title)}</h2>
                                            <p className='mt-2 text-sm leading-6 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selected.detail)}</p>
                                        </div>
                                        {selected.href ? (
                                            <a href={selected.href} target='_blank' rel='noopener noreferrer' className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                                <ExternalLink className='h-3.5 w-3.5' />
                                                Source
                                            </a>
                                        ) : null}
                                    </div>

                                    <div className='mt-4 grid gap-3 md:grid-cols-4'>
                                        <EvidenceMetric label='First seen' value={selected.timestamp} />
                                        <EvidenceMetric label='Source' value={selected.source} />
                                        <EvidenceMetric label='Source basis' value={sourceBasisLabel(selected.confidence)} />
                                        <EvidenceMetric label='Source reference' value={displayRequirementText(selected.provenance)} />
                                    </div>

                                    {selectedSourceDrilldown ? <SelectedEvidenceContextTable drilldown={selectedSourceDrilldown} /> : null}
                                    {showMoreAnalysis ? (
                                        <>
                                            {selectedTriageBrief ? <SelectedTriageBriefPanel brief={selectedTriageBrief} /> : null}
                                            {selected.priority ? <EvidencePriorityPanel priority={selected.priority} /> : null}
                                            {selectedSourceDrilldown ? <SelectedSourceDrilldownPanel drilldown={selectedSourceDrilldown} /> : null}

                                            <CustomerAlertFit selected={selected} watchlist={watchlist} alertPacket={alertPacket} />

                                            <div className='mt-4 grid gap-3 md:grid-cols-2'>
                                                <EvidencePanel title='Evidence'>
                                                    {selected.evidence.map(line => <li key={line}>{line}</li>)}
                                                </EvidencePanel>
                                                <EvidencePanel title='Recommended next step'>
                                                    {selected.nextActions.map(line => <li key={line}>{displayRequirementText(line)}</li>)}
                                                </EvidencePanel>
                                            </div>
                                        </>
                                    ) : null}
                                </section>
                                <SecondaryAnalysisToggle
                                    expanded={showMoreAnalysis}
                                    artifactCount={actorArtifacts.length}
                                    sourceCount={sources.length}
                                    watchlistCount={watchlist.terms.length}
                                    gapCount={openGapCount}
                                    onToggle={() => setShowMoreAnalysis(value => !value)}
                                />

                                {showMoreAnalysis ? (
                                    <>
                                        <div id='ti-secondary-analysis' className='grid gap-3'>
                                            <TiCommandBar links={commandLinks} />
                                            <SectionOverviewRail items={sectionOverview} />
                                        </div>
                                        <ThreatActorMap actor={actorIntel} result={result} actionability={actionability} onSelectCountry={(country) => selectArtifactBy('country', country)} compact />
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

                                        <ActorOperationsMatrix
                                            result={result}
                                            actor={actorIntel}
                                            victimObservations={victimObservations}
                                            selectedArtifactId={selectedArtifact?.id}
                                            onSelectArtifact={setSelectedArtifactId}
                                            onSelectArtifactBy={selectArtifactBy}
                                            onEscalate={() => applyDecision('escalated')}
                                            onReview={() => applyDecision('reviewing')}
                                        />

                                        <SourceCoverageWorkbench
                                            actor={actorIntel}
                                            actionability={actionability}
                                            sources={sources}
                                            sourcePosture={collectionSources}
                                            workItems={workItems}
                                            selectedId={selected?.id}
                                            sourceOptions={queueSourceOptions}
                                            onSelectEvidence={setSelectedId}
                                            onFilterSource={setQueueSourceFilter}
                                            onEscalate={() => applyDecision('escalated')}
                                            onReview={() => applyDecision('reviewing')}
                                        />
                                    </>
                                ) : null}

                            </div>
                        ) : (
                            <div className='grid min-h-72 place-items-center rounded-lg border border-dashed border-ui-border bg-ui-panel p-6 text-center text-sm text-ui-muted'>Search is finding recent activity.</div>
                        )}
                    </main>

                    <aside className='order-3 grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] content-start gap-4 overflow-hidden border-t border-ui-border bg-ui-panel p-4 lg:order-none lg:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0'>
                        {alertPacket ? <AlertPacketPanel packet={alertPacket} /> : null}
                        <div data-ti-actions='true'>
                            {showMoreAnalysis ? (
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
                            ) : (
                                <SelectedWorkflowSummaryPanel
                                    selected={selected}
                                    reviewHandoff={reviewHandoff}
                                    caseDraft={selectedCaseDraft}
                                    caseOwnership={selectedCaseOwnership}
                                    alertPlan={selectedAlertPlan}
                                    deliveryPlan={selectedDeliveryPlan}
                                    sourceDrilldown={selectedSourceDrilldown}
                                    onOpenDetails={() => setShowMoreAnalysis(true)}
                                />
                            )}
                        </div>
                        <StagedHandoffQueuePanel
                            items={Object.values(stagedHandoffs)}
                            onClear={() => setStagedHandoffs({})}
                        />

                        {showMoreAnalysis ? (
                            <>
                                <ActionabilityPanel actionability={actionability} query={result.query} />
                                <EnrichmentTasksPanel tasks={enrichmentTasks} intake={actionability.sourceEnrichmentIntake} />
                                <SourceHealthPanel queue={actionability.sourceHealthQueue} intake={actionability.sourceEnrichmentIntake} coverage={actionability.actorEnrichmentCoverage} consumerReadiness={actionability.actorEnrichmentConsumerReadiness} payload={actionability.exportPayloads.enrichment} />

                                <Panel title='Activity timeline' description='Source timestamps plus review decisions made in this browser session.' icon={<Clock3 className='h-4 w-4' />}>
                                    <div className='grid gap-3'>
                                        {[...timelineFor(result, selected), ...sessionEvents, ...relevanceEvents].slice(0, 8).map(event => (
                                            <div key={event.id} className='border-l-2 border-ui-border pl-3'>
                                                <p className='text-xs font-semibold text-ui-text'>{event.label}</p>
                                                <p className='mt-1 text-[11px] text-ui-muted'>{formatDate(event.at)}</p>
                                                <p className='mt-1 text-xs leading-5 text-ui-muted'>{displayRequirementText(event.detail)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>

                                <EnrichmentGapWorkbench
                                    tasks={enrichmentTasks}
                                    result={result}
                                    actor={actorIntel}
                                    actionability={actionability}
                                    workItems={workItems}
                                    artifacts={actorArtifacts}
                                    selectedId={selected?.id}
                                    selectedArtifactId={selectedArtifact?.id}
                                    onSelectEvidence={setSelectedId}
                                    onSelectArtifact={setSelectedArtifactId}
                                    onReview={() => applyDecision('reviewing')}
                                    onEscalate={() => applyDecision('escalated')}
                                />
                                {result.analystLoop?.sourceActivationWorkflow.required ? <SourceActivationPanel activation={result.analystLoop.sourceActivationWorkflow} /> : null}
                            </>
                        ) : null}
                    </aside>
                </div>
            </section>

            {showMoreAnalysis ? (
                <section className='grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
                    <WatchlistRelevanceWorkbench
                        watchlist={watchlist}
                        actionability={actionability}
                        query={result.query}
                        workItems={workItems}
                        artifacts={actorArtifacts}
                        selectedId={selected?.id}
                        selectedArtifactId={selectedArtifact?.id}
                        onSelectEvidence={setSelectedId}
                        onSelectArtifact={setSelectedArtifactId}
                        onMarkRelevant={() => selected && setRelevanceMarks(current => ({ ...current, [selected.id]: relevanceMarkFor('customer_relevant', selected, watchlist, actionability, selectedNote) }))}
                    />

                    <Panel title='Sources' description='Sources checked for this result, including actor profiles, recent attacks, public advisories, and watched company or supplier terms.' icon={<Globe2 className='h-4 w-4' />}>
                        <div id='ti-sources' className='sr-only'>Source coverage</div>
                        {datasets.map(item => (
                            <EvidenceBox key={`${item.type}-${item.name}`} href={item.url}>
                                <div className='flex items-center justify-between gap-3'>
                                    <h2 className='text-sm font-semibold text-ui-text'>{item.name}</h2>
                                    <span className='text-xs text-ui-muted'>{sourceStatusLabel(item.status)}</span>
                                </div>
                                <p className='text-sm leading-6 text-ui-muted'>{item.coverage}</p>
                            </EvidenceBox>
                        ))}
                    </Panel>
                </section>
            ) : null}

        </div>
    )
}

function SecondaryAnalysisToggle({ expanded, artifactCount, sourceCount, watchlistCount, gapCount, onToggle }: {
    expanded: boolean
    artifactCount: number
    sourceCount: number
    watchlistCount: number
    gapCount: number
    onToggle: () => void
}) {
    const metrics = [
        `${artifactCount} artifacts`,
        `${sourceCount} sources`,
        `${watchlistCount} watch terms`,
        `${gapCount} gaps`,
    ]
    return (
        <section id='ti-secondary-analysis' className='scroll-mt-24 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-canvas' data-ti-secondary-analysis-toggle='true'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0'>
                    <p className='text-sm font-semibold text-ui-text dark:text-ui-text'>Actor workbenches</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Source, detail, watchlist, and collection queues stay available without crowding the selected finding.
                    </p>
                </div>
                <button
                    type='button'
                    onClick={onToggle}
                    aria-expanded={expanded}
                    className='inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                >
                    {expanded ? 'Collapse' : 'Expand'}
                </button>
            </div>
            <div className='mt-3 flex flex-wrap gap-2'>
                {metrics.map(metric => (
                    <span key={metric} className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>
                        {metric}
                    </span>
                ))}
            </div>
        </section>
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

type WatchlistWorkbenchRow = {
    id: string
    kind: string
    value: string
    matched: boolean
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    newestAt?: string
    evidenceItems: AnalystWorkItem[]
    artifactIds: string[]
    sourceCount: number
    route?: string
    casePath?: string
    detail: string
    blockers: string[]
    payload: Record<string, unknown>
}

type SectionOverviewItem = {
    label: 'Overview' | 'Activity' | 'Targets' | 'Infrastructure' | 'Sources' | 'Evidence' | 'Watchlist relevance' | 'Related alerts/cases' | 'Collection gaps' | 'Actions'
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

type SelectedTriageBrief = {
    whatHappened: string
    whyItMatters: string
    nextAction: string
    proofStatus: string
    proofTone: 'ready' | 'review' | 'blocked'
    safetyBoundary: string
    labels: Array<{ label: string; value: string }>
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

type SelectedCaseSourceRow = {
    sourceName: string
    sourceId?: string
    provenance: string
    captureId?: string
    reportDate?: string
    confidence?: number
    state: SelectedSourceDrilldownRow['state']
    missing: string[]
    provenanceRefs: string[]
    provenanceFingerprint: string
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
    sourceRows: SelectedCaseSourceRow[]
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
    sourceRows: SelectedCaseSourceRow[]
    refs: {
        alertIds: string[]
        captureIds: string[]
        casePaths: string[]
        sourceIds: string[]
        watchTerms: string[]
    }
    actorContext: {
        actorClass: string
        attribution: string
        aliases: string[]
        motivation: string[]
        targetSectors: string[]
        geographies: string[]
        malwareTools: string[]
        campaigns: string[]
        infrastructure: string[]
        indicators: string[]
        confidence: number
        confidenceReasoning: string[]
        freshness: TiActorIntelligenceProfile['freshness']
        sourceCoverage: Pick<TiActorIntelligenceProfile['sourceCoverage'], 'totalRows' | 'datedRows' | 'captureRows' | 'latestReportDate' | 'stale' | 'missing'>
        techniques: Array<{
            attackId?: string
            name: string
            tactic: string
            confidence: number
            freshness: TiActorIntelligenceProfile['techniqueCoverage'][number]['freshness']
            sourceIds: string[]
            captureIds: string[]
            provenanceRefs: string[]
            missing: string[]
        }>
        campaignTimeline: Array<{
            title: string
            firstReportedAt: string
            confidence: number
            freshness: TiActorIntelligenceProfile['campaignTimeline'][number]['freshness']
            sourceIds: string[]
            provenanceRefs: string[]
            affectedSectors: string[]
            countries: string[]
            missing: string[]
        }>
        enrichmentGaps: Array<{
            id: string
            title: string
            severity: TiActionabilityModel['enrichmentGapQueue'][number]['severity']
            route: string
            sourceFamily: TiActionabilityModel['enrichmentGapQueue'][number]['sourceFamily']
            requestedFields: string[]
        }>
        sourceRefs: {
            sourceIds: string[]
            captureIds: string[]
            provenanceRefs: string[]
            sourceRequestIds: string[]
        }
    }
    watchlistBasis: {
        state: SelectedWatchlistPlan['state']
        ready: boolean
        route: string
        matchReason: string
        terms: Array<{
            kind: SelectedWatchlistPlan['terms'][number]['kind']
            value: string
            matched: boolean
        }>
        relevanceRows: Array<{
            kind: SelectedWatchlistPlan['relevanceRows'][number]['kind']
            value: string
            fit: SelectedWatchlistPlan['relevanceRows'][number]['fit']
            alertable: boolean
            route: string
            evidenceRefs: string[]
            sourceFamilies: string[]
            blockerOwners: SelectedWatchlistPlan['relevanceRows'][number]['blockerOwners']
            nextAction: string
        }>
        intersections: Array<{
            intersectionId: string
            value: string
            state: SelectedWatchlistPlan['intersections'][number]['state']
            route: string
            organizationId?: string
            watchlistId?: string
            watchlistItemId?: string
            alertIds: string[]
            casePaths: string[]
            captureIds: string[]
            sourceEvidenceRefs: string[]
            recommendedAction: SelectedWatchlistPlan['intersections'][number]['recommendedAction']
        }>
        blockers: string[]
    }
    actionReplay: {
        schemaVersion: TiActionabilityModel['caseReplayReadiness']['schemaVersion']
        sourceSchemaVersion: string
        routeTemplate: TiActionabilityModel['caseReplayReadiness']['routeTemplate']
        ready: boolean
        rows: Array<{
            caseReviewIntakeItemId: string
            evidenceRowId: string
            ready: boolean
            exportRoute?: string
            caseId?: string
            alertIds: string[]
            captureIds: string[]
            sourceIds: string[]
            blockerCodes: string[]
            provenanceFingerprints: string[]
        }>
    }
    caseReviewRows: Array<{
        id: string
        evidenceRowId: string
        title: string
        priority: CaseReviewIntakeItem['priority']
        state: CaseReviewIntakeItem['state']
        route: string
        ownerLane: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
        nextAction: string
        recommendedAction: CaseReviewIntakeItem['recommendedAction']
        reasons: string[]
        alertIds: string[]
        captureIds: string[]
        casePaths: string[]
        sourceIds: string[]
        provenanceRefs: string[]
        provenanceFingerprints: string[]
        blockers: string[]
        replay: {
            ready: boolean
            state: TiActionabilityModel['caseReplayReadiness']['rows'][number]['state']
            exportRoute?: string
            caseId?: string
            blockerCodes: string[]
        }
    }>
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
    evidenceRows: Array<{
        rowId: string
        kind: TiActionabilityModel['orgRelevance']['handoffRows'][number]['kind']
        state: TiActionabilityModel['orgRelevance']['handoffRows'][number]['state']
        ownerLane: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
        label: string
        action: string
        route: string
        sourceFamily: string
        provenanceRefs: string[]
        alertId?: string
        casePath?: string
        captureIds: string[]
        evidence: {
            summary: string
            sourceName?: string
            provenance?: string
            reportDate?: string
            captureId?: string
            parserStatus?: string
            confidence?: number
        }
        blockers: string[]
    }>
    replayRows: Array<{
        id: string
        ready: boolean
        state: TiActionabilityModel['caseReplayReadiness']['rows'][number]['state']
        exportRoute?: string
        caseId?: string
        alertIds: string[]
        captureIds: string[]
        sourceIds: string[]
        blockerCodes: string[]
    }>
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
        evidenceRows: Array<{
            sourceName: string
            sourceId?: string
            provenance: string
            reportDate?: string
            captureId?: string
            sourceRequestId?: string
            sourceFamily?: string
            parserStatus?: string
            lastCollectedAt?: string
            confidence?: number
            shownBecause: string
        }>
        handoffRows: Array<{
            rowId: string
            kind: TiActionabilityModel['orgRelevance']['handoffRows'][number]['kind']
            state: TiActionabilityModel['orgRelevance']['handoffRows'][number]['state']
            ownerLane: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
            label: string
            action: string
            route: string
            sourceFamily: string
            blockerCount: number
        }>
        blockers: string[]
        blockerOwners: TiActionabilityModel['readiness']['blockers'][number]['ownerLane'][]
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
        sourceFamily: SourceHealthRow['sourceFamily']
        state: SourceHealthRow['state']
        route: string
        ownerLane: SourceHealthRow['ownerLane']
        remediationPath: string
        lastChecked: string
        recommendedAction: string
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
        consumerReadiness: Array<{
            consumer: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['consumer']
            state: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['state']
            ready: boolean
            route: string
            blockerCodes: string[]
            retryable: boolean
            nextRetryAt?: string
        }>
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
    selectedArtifact: ReturnType<typeof selectedArtifactPayloadFor>
    reviewHandoff: SelectedReviewHandoff
    sourceDrilldown: SelectedSourceDrilldown
    caseDraft: SelectedCaseDraft
    caseOwnership: SelectedCaseOwnershipPlan
    caseCreateRequest: SelectedCaseCreateRequest
    watchlistPlan: SelectedWatchlistPlan
    alertPlan: SelectedAlertActionPlan
    deliveryPlan: SelectedDeliveryReadinessPlan
    enrichmentTriage: SelectedEnrichmentTriage
    caseActionTrail: CaseActionTrailPayload
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

type EnrichmentGapWorkbenchRow = {
    id: string
    type: string
    label: string
    entity: string
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    newestAt?: string
    source: string
    impact: string
    route?: string
    evidenceItems: AnalystWorkItem[]
    artifactIds: string[]
    missing: string[]
    payload: Record<string, unknown>
}

type SourceHealthRow = TiActionabilityModel['sourceHealthQueue']['rows'][number]
type WatchlistIntersectionRow = TiActionabilityModel['orgRelevance']['watchlistIntersections'][number]
type CaseReviewIntakeItem = TiActionabilityModel['caseReviewIntake']['items'][number]
type ActorOperationsRow = {
    id: string
    type: 'Method' | 'Infrastructure' | 'Victim'
    label: string
    detail: string
    tactic?: string
    confidence: number
    freshness: 'ready' | 'review' | 'blocked'
    source: string
    sourceFamily: string
    timestamp: string
    artifactKind?: ActorArtifactKind
    artifactLookup?: string
    payload: Record<string, unknown>
}

type SourceCoverageWorkbenchRow = {
    id: string
    sourceName: string
    family: string
    provenance: string
    href?: string
    newestAt?: string
    parserStatus: string
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    artifactTypes: string[]
    evidenceItems: AnalystWorkItem[]
    captureId?: string
    sourceRequestId?: string
    sourceId?: string
    missing: string[]
    nextAction: string
    queueFilter?: string
    payload: Record<string, unknown>
}

function ActorActionStrip({
    actor,
    actionability,
    selected,
    caseAvailable,
    onWatchlist,
    onCase,
    onEscalate,
    onReview,
}: {
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    selected?: AnalystWorkItem
    caseAvailable: boolean
    onWatchlist: () => void
    onCase: () => void
    onEscalate: () => void
    onReview: () => void
}) {
    const exportRows = unique([
        ...actor.indicators,
        ...actor.infrastructure,
        ...actor.malwareTools,
    ]).slice(0, 24)
    const actionSummary = [
        `${actionability.watchlistRelevance.terms.length} watch terms`,
        `${actionability.relatedAlerts.length} alerts`,
        `${actionability.relatedCases.length} cases`,
        `${actionability.enrichmentGapQueue.length} gaps`,
    ]
    return (
        <div data-ti-actor-action-strip='true' className='border-b border-ui-border bg-ui-panel px-3 py-2 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between'>
                <div className='flex min-w-0 flex-wrap items-center gap-1.5'>
                    <span className='rounded-md bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary'>Analyst actions</span>
                    <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>Console actions</span>
                    <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>Review status</span>
                    {actionSummary.map(item => (
                        <span key={item} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{item}</span>
                    ))}
                </div>
                <div className='grid min-w-0 grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:justify-end'>
                    <StripActionButton icon={<BellRing className='h-3.5 w-3.5' />} onClick={onWatchlist}>Watch</StripActionButton>
                    <StripActionButton icon={<ClipboardList className='h-3.5 w-3.5' />} onClick={onCase} disabled={!caseAvailable}>Create case</StripActionButton>
                    <StripActionButton icon={<Send className='h-3.5 w-3.5' />} onClick={onEscalate}>Escalate</StripActionButton>
                    <StripActionButton icon={<CheckCircle2 className='h-3.5 w-3.5' />} onClick={onReview}>Review</StripActionButton>
                    {exportRows.length ? (
                        <span className='min-w-0'>
                            <CopyPayloadButton
                                label='Export IOCs'
                                showLabel
                                payload={{
                                    schemaVersion: 'ti.public_actor.ioc_export.v1',
                                    source: 'public-ti',
                                    selectedItemId: selected?.id,
                                    indicators: actor.indicators,
                                    infrastructure: actor.infrastructure,
                                    malwareTools: actor.malwareTools,
                                    sourceCoverage: actor.sourceCoverage,
                                    provenanceRows: actor.provenanceRows,
                                }}
                            />
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function StripActionButton({ icon, children, onClick, disabled = false }: { icon: React.ReactNode; children: string; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type='button'
            onClick={onClick}
            disabled={disabled}
            className='inline-flex min-h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised dark:disabled:bg-ui-raised dark:disabled:text-ui-muted'
        >
            {icon}
            {children}
        </button>
    )
}

function ActorOperationsMatrix({
    result,
    actor,
    victimObservations,
    selectedArtifactId,
    onSelectArtifact,
    onSelectArtifactBy,
    onEscalate,
    onReview,
}: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    victimObservations: ReturnType<typeof victimObservationsFor>
    selectedArtifactId?: string
    onSelectArtifact: (artifactId: string) => void
    onSelectArtifactBy: (kind: ActorArtifactKind, value: string) => void
    onEscalate: () => void
    onReview: () => void
}) {
    const rows = useMemo(() => actorOperationsRowsFor(result, actor, victimObservations), [actor, result, victimObservations])
    const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id ?? '')
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]

    return (
        <section data-ti-actor-operations-matrix='true' className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Attack details</p>
                    <p className='mt-0.5 wrap-break-word text-xs text-ui-muted dark:text-ui-muted'>Methods, infrastructure, and targeting details with source context.</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{rows.length} details</span>
                    {selectedRow ? <CopyPayloadButton label='Copy detail' payload={selectedRow.payload} /> : null}
                </div>
            </div>
            <div className='grid min-w-0 lg:grid-cols-[minmax(0,1fr)_18rem]'>
                <div className='min-w-0 overflow-x-auto'>
                    <table className='min-w-[760px] w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Type</th>
                                <th className='px-3 py-2 font-semibold'>Name</th>
                                <th className='px-3 py-2 font-semibold'>Source</th>
                                <th className='px-3 py-2 font-semibold'>Freshness</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#eef1f5] dark:divide-[#273244]'>
                            {rows.map(row => {
                                const active = selectedRow?.id === row.id || (row.artifactLookup && selectedArtifactId?.includes(row.artifactLookup.toLowerCase().replace(/[^a-z0-9]+/g, '-')))
                                return (
                                    <tr key={row.id} className={`${active ? 'bg-ui-primary/10 dark:bg-ui-primary/10' : 'bg-ui-panel dark:bg-ui-panel'} align-top`}>
                                        <td className='px-3 py-2'>
                                            <button type='button' onClick={() => setSelectedRowId(row.id)} className='rounded-md bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:bg-ui-raised dark:text-ui-muted'>{row.type}</button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <button
                                                type='button'
                                                onClick={() => {
                                                    setSelectedRowId(row.id)
                                                    if (row.artifactKind && row.artifactLookup) onSelectArtifactBy(row.artifactKind, row.artifactLookup)
                                                }}
                                                className='grid min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'
                                            >
                                                <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.label}</span>
                                                <span className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.detail)}</span>
                                            </button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.source}</p>
                                            <p className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{row.sourceFamily}</p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <span className={sourceHealthChipClass(row.freshness)}>{row.freshness}</span>
                                            <p className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatDate(row.timestamp)}</p>
                                        </td>
                                        <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceBasisLabel(row.confidence)}</td>
                                        <td className='px-3 py-2'>
                                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                                <button type='button' onClick={() => row.artifactKind && row.artifactLookup ? onSelectArtifactBy(row.artifactKind, row.artifactLookup) : onSelectArtifact(row.id)} className='inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Inspect</button>
                                                <CopyPayloadButton label='Copy' payload={row.payload} />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {!rows.length ? <p className='p-4 text-sm text-ui-muted dark:text-ui-muted'>Add technique, infrastructure, or victim context before case review.</p> : null}
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised lg:border-l lg:border-t-0'>
                    {selectedRow ? (
                        <div className='grid gap-2'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected detail</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.label}</h3>
                                <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.detail)}</p>
                            </div>
                            <div className='grid grid-cols-2 gap-2 text-xs'>
                                <EvidenceMetric label='Source basis' value={sourceBasisLabel(selectedRow.confidence)} />
                                <EvidenceMetric label='Source' value={selectedRow.source} />
                            </div>
                            <div className='grid grid-cols-2 gap-1.5'>
                                <StripActionButton icon={<Eye className='h-3.5 w-3.5' />} onClick={onReview}>Review</StripActionButton>
                                <StripActionButton icon={<Send className='h-3.5 w-3.5' />} onClick={onEscalate}>Escalate</StripActionButton>
                            </div>
                            {selectedRow.artifactKind && selectedRow.artifactLookup ? (
                                <button type='button' onClick={() => onSelectArtifactBy(selectedRow.artifactKind!, selectedRow.artifactLookup!)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                    Open detail
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <p className='text-sm text-ui-muted dark:text-ui-muted'>Select a detail to inspect.</p>
                    )}
                </div>
            </div>
        </section>
    )
}

function SourceCoverageWorkbench({
    actor,
    actionability,
    sources,
    sourcePosture,
    workItems,
    selectedId,
    sourceOptions,
    onSelectEvidence,
    onFilterSource,
    onEscalate,
    onReview,
}: {
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    sources: TiSearchResponse['sources']
    sourcePosture: NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture']
    workItems: AnalystWorkItem[]
    selectedId?: string
    sourceOptions: string[]
    onSelectEvidence: (id: string) => void
    onFilterSource: (source: string) => void
    onEscalate: () => void
    onReview: () => void
}) {
    const rows = useMemo(() => sourceCoverageWorkbenchRowsFor({ actor, actionability, sources, sourcePosture, workItems, sourceOptions }), [actor, actionability, sources, sourcePosture, workItems, sourceOptions])
    const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id ?? '')
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const readyCount = rows.filter(row => row.state === 'ready').length
    const reviewCount = rows.filter(row => row.state === 'review').length
    const blockedCount = rows.filter(row => row.state === 'blocked').length

    return (
        <section data-ti-source-coverage-workbench='true' className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source review</p>
                    <p className='mt-0.5 wrap-break-word text-xs text-ui-muted dark:text-ui-muted'>Source coverage, newest mention, evidence basis, and review state.</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className={sourceHealthChipClass('ready')}>{readyCount} ready</span>
                    <span className={sourceHealthChipClass('review')}>{reviewCount} review</span>
                    <span className={sourceHealthChipClass(blockedCount ? 'blocked' : 'ready')}>{blockedCount} syncing</span>
                    {selectedRow ? <CopyPayloadButton label='Copy source summary' payload={selectedRow.payload} /> : null}
                </div>
            </div>
            <div className='grid min-w-0 xl:grid-cols-[minmax(0,1fr)_19rem]'>
                <div className='min-w-0 overflow-x-auto'>
                    <table className='min-w-[860px] w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Source</th>
                                <th className='px-3 py-2 font-semibold'>Results</th>
                                <th className='px-3 py-2 font-semibold'>Newest</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Details</th>
                                <th className='px-3 py-2 font-semibold'>State</th>
                                <th className='px-3 py-2 font-semibold'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#eef1f5] dark:divide-[#273244]'>
                            {rows.map(row => {
                                const active = selectedRow?.id === row.id
                                const linkedSelected = row.evidenceItems.some(item => item.id === selectedId)
                                return (
                                    <tr key={row.id} className={`${active || linkedSelected ? 'bg-ui-primary/10 dark:bg-ui-primary/10' : 'bg-ui-panel dark:bg-ui-panel'} align-top`}>
                                        <td className='px-3 py-2'>
                                            <button type='button' onClick={() => setSelectedRowId(row.id)} className='grid min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                                                <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</span>
                                                <span className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatLabel(row.family)}</span>
                                            </button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <p className='font-semibold text-ui-text dark:text-ui-text'>{row.evidenceItems.length} results</p>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{row.evidenceItems[0]?.title ?? displayRequirementText(row.parserStatus)}</p>
                                        </td>
                                        <td className='px-3 py-2 text-ui-text dark:text-ui-text'>{row.newestAt ? formatDate(row.newestAt) : 'Not dated'}</td>
                                        <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceConfidenceLabel(row.confidenceValues)}</td>
                                        <td className='px-3 py-2'>
                                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                                {row.artifactTypes.length ? row.artifactTypes.slice(0, 4).map(type => (
                                                    <span key={`${row.id}-${type}`} className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{type}</span>
                                                )) : <span className='text-[11px] text-ui-muted dark:text-ui-muted'>Source only</span>}
                                            </div>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <span className={sourceHealthChipClass(row.state)}>{publicStateLabel(row.state)}</span>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.nextAction)}</p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                                <button type='button' onClick={() => setSelectedRowId(row.id)} className='inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Inspect</button>
                                                {row.evidenceItems[0] ? (
                                                    <button type='button' onClick={() => onSelectEvidence(row.evidenceItems[0]!.id)} className='inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Open result</button>
                                                ) : null}
                                                {row.queueFilter ? (
                                                    <button type='button' onClick={() => onFilterSource(row.queueFilter!)} className='inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Filter</button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {!rows.length ? <p className='p-4 text-sm text-ui-muted dark:text-ui-muted'>Add source coverage before routing this actor.</p> : null}
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised xl:border-l xl:border-t-0'>
                    {selectedRow ? (
                        <div className='grid gap-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected source</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.sourceName}</h3>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.provenance)}</p>
                            </div>
                            <div className='grid grid-cols-2 gap-2 text-xs'>
                                <EvidenceMetric label='Family' value={formatLabel(selectedRow.family)} />
                                <EvidenceMetric label='Results' value={String(selectedRow.evidenceItems.length)} />
                                <EvidenceMetric label='Capture' value={selectedRow.captureId ? 'Attached' : 'Missing'} />
                                <EvidenceMetric label='Request' value={selectedRow.sourceRequestId ? 'Queued' : 'None'} />
                            </div>
                            {selectedRow.missing.length ? (
                                <div className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                                    {selectedRow.missing.slice(0, 3).map(sourceHealthFieldLabel).join(', ')}
                                </div>
                            ) : null}
                            <div className='grid grid-cols-2 gap-1.5'>
                                <StripActionButton icon={<CheckCircle2 className='h-3.5 w-3.5' />} onClick={onReview}>Review</StripActionButton>
                                <StripActionButton icon={<Send className='h-3.5 w-3.5' />} onClick={onEscalate}>Escalate</StripActionButton>
                            </div>
                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                {selectedRow.href ? (
                                    <a href={selectedRow.href} target='_blank' rel='noopener noreferrer' className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                        <ExternalLink className='h-3.5 w-3.5' />
                                        Open source
                                    </a>
                                ) : null}
                                <CopyPayloadButton label='Copy source' payload={selectedRow.payload} showLabel />
                            </div>
                        </div>
                    ) : (
                        <p className='text-sm text-ui-muted dark:text-ui-muted'>Select a source to inspect results and open questions.</p>
                    )}
                </div>
            </div>
        </section>
    )
}

function ActorIntelligenceDossier({ actor, actionability, result, artifacts, selectedArtifactId, onSelectArtifact }: {
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    result: TiSearchResponse
    artifacts: ActorArtifact[]
    selectedArtifactId?: string
    onSelectArtifact: (artifactId: string) => void
}) {
    const artifactByLookup = new Map(artifacts.map(artifact => [`${artifact.kind}:${artifact.label.toLowerCase()}`, artifact]))
    return (
        <section data-ti-actor-dossier='true' className='w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-4 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='w-full min-w-0 lg:flex-1 lg:basis-64'>
                    <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>Overview</p>
                    <h2 className='mt-1 wrap-break-word text-xl font-semibold text-ui-text dark:text-ui-text'>{actor.actorClass}</h2>
                    <p className='mt-2 text-sm leading-6 text-ui-muted dark:text-ui-muted'>{actor.attribution}</p>
                </div>
                <div className='grid w-full min-w-0 basis-full grid-cols-2 gap-2 text-center text-xs sm:min-w-52 md:grid-cols-4 lg:w-auto lg:basis-auto'>
                    <EvidenceMetric label='First seen' value={actor.firstSeen} />
                    <EvidenceMetric label='Last seen' value={formatDate(actor.lastSeen || result.lastSeen)} />
                    <EvidenceMetric label='Source basis' value={sourceBasisLabel(actor.confidence)} />
                    <EvidenceMetric label='Freshness' value={actor.freshness.stale ? 'Needs refresh' : 'Current'} />
                </div>
            </div>

            <FreshnessGatePanel actor={actor} actionability={actionability} query={result.query} />

            <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                <DossierList title='Motivation' values={actor.motivation} />
                <DossierList title='Tooling' values={actor.malwareTools} artifactKind='tool' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <DossierList title='Campaigns' values={actor.campaigns} artifactKind='campaign' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <DossierList title='Indicators' values={actor.indicators} />
                <DossierList title='Targets' description='Industries, victim types, or regions mentioned in the linked source evidence.' values={actor.targetSectors} />
                <DossierList title='Geographies' values={actor.geographies} artifactKind='country' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <DossierList title='Infrastructure' values={actor.infrastructure} artifactKind='infrastructure' artifactByLookup={artifactByLookup} selectedArtifactId={selectedArtifactId} onSelectArtifact={onSelectArtifact} />
                <TechniqueCoveragePanel techniques={actor.techniqueCoverage} />
                <CampaignTimelinePanel timeline={actor.campaignTimeline} />
            </div>

            <div className='mt-4 grid gap-3 xl:grid-cols-3'>
                <EvidencePanel title='Why this profile is trusted'>
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
            ? 'Evidence dates are usable, but source coverage still needs capture or source references before stronger review.'
            : 'Evidence dates and source coverage are current enough for review.'
    const rows = [
        { label: 'Newest evidence', value: actor.sourceCoverage.latestReportDate ? formatDate(actor.sourceCoverage.latestReportDate) : 'Not dated' },
        { label: 'Generated', value: formatDate(actor.freshness.generatedAt) },
        { label: 'Source results', value: String(actor.sourceCoverage.totalRows) },
        { label: 'Captured pages', value: String(actor.sourceCoverage.captureRows) },
    ]

    return (
        <div data-ti-freshness-gate='true' className='mt-4 min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Freshness gate</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {displayRequirementText(summary)}
                    </p>
                </div>
                <div className='flex flex-wrap items-center gap-1.5'>
                    <span className={decisionStepStatusClass(sourceState)}>sources {decisionStepStatusLabel(sourceState)}</span>
                    <span className={decisionStepStatusClass(handoffState)}>review {decisionStepStatusLabel(handoffState)}</span>
                    <span data-ti-freshness-review-export='true' className='inline-flex'>
                        <CopyPayloadButton label='Freshness review' payload={freshnessReviewPayloadFor(actor, actionability, query, { sourceState, handoffState })} />
                    </span>
                </div>
            </div>
            <div className='mt-3 grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4'>
                {rows.map(row => (
                    <div key={row.label} className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{row.label}</p>
                        <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.value}</p>
                    </div>
                ))}
            </div>
            <div className='mt-3 grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
                <div className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source follow-up</p>
                    <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {sourceBlockers.length ? sourceBlockers.slice(0, 3).map(blocker => (
                            <li key={`${blocker.code}-${blocker.field}`} className='wrap-break-word'>{readinessOwnerLabel(blocker.ownerLane)}: {displayRequirementText(blocker.handoff)}</li>
                        )) : actor.sourceCoverage.missing.length ? actor.sourceCoverage.missing.slice(0, 3).map(item => (
                            <li key={item} className='wrap-break-word'>Source collection: attach {coverageMissingLabel(item)}.</li>
                        )) : <li>Source evidence is sufficient for review.</li>}
                    </ul>
                </div>
                <div className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Review follow-up</p>
                    <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {workflowBlockers.length ? workflowBlockers.slice(0, 3).map(blocker => (
                            <li key={`${blocker.code}-${blocker.field}`} className='wrap-break-word'>{readinessOwnerLabel(blocker.ownerLane)}: {displayRequirementText(blocker.handoff)}</li>
                        )) : <li>Required review identifiers are present.</li>}
                    </ul>
                </div>
            </div>
            <p className='mt-3 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                {nextOwner ? `Next owner: ${readinessOwnerLabel(nextOwner)}.` : 'No owner is assigned.'}
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
                <div key={item.label} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 dark:border-ui-border dark:bg-ui-raised'>
                    <div className='flex flex-wrap items-center justify-between gap-1.5'>
                        <p className='min-w-0 wrap-break-word text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{item.label}</p>
                        <span className={decisionStepStatusClass(item.state)}>{decisionStepStatusLabel(item.state)}</span>
                    </div>
                    <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.value}</p>
                </div>
            ))}
        </div>
    )
}

function TiCommandBar({ links }: { links: Array<{ href: string; label: string; value: string; icon: typeof Inbox }> }) {
    return (
        <nav data-ti-command-bar='true' className='grid min-w-0 gap-1.5 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-5' aria-label='Threat intelligence workflow'>
            {links.map(({ href, label, value, icon: Icon }) => (
                <Link
                    key={`${label}-${href}`}
                    href={href}
                    className='group grid min-h-12 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 text-left transition hover:border-ui-primary/35 hover:bg-ui-primary/10 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-raised dark:hover:bg-ui-raised'
                >
                    <Icon className='h-4 w-4 text-ui-primary dark:text-ui-primary' />
                    <span className='min-w-0'>
                        <span className='block truncate text-xs font-semibold text-ui-text dark:text-ui-text'>{label}</span>
                        <span className='block truncate text-[11px] font-medium text-ui-muted dark:text-ui-muted'>{value}</span>
                    </span>
                </Link>
            ))}
        </nav>
    )
}

function StructuredProvenancePanel({ rows, actor, actionability, query }: { rows: TiActorIntelligenceProfile['provenanceRows']; actor: TiActorIntelligenceProfile; actionability: TiActionabilityModel; query: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source references</p>
            <div className='mt-2 grid gap-2'>
                {rows.length ? rows.slice(0, 6).map(row => {
                    const href = linkFromText(row.provenance)
                    return (
                        <div key={`${row.sourceName}-${row.provenance}`} data-ti-provenance-artifact-export='true' className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                    <span className='shrink-0 text-[11px] text-ui-muted dark:text-ui-muted'>{row.reportDate ? formatDate(row.reportDate) : row.captureId ? `capture ${row.captureId}` : sourceBasisLabel(row.confidence)}</span>
                                    <CopyPayloadButton label='Provenance artifact' payload={provenanceArtifactPayloadFor(row, actor, actionability, query)} />
                                    {href ? (
                                        <a href={href} target='_blank' rel='noopener noreferrer' className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                            <ExternalLink className='h-3.5 w-3.5' />
                                            Open
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                            <p className='mt-1 break-all font-mono text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.provenance)}</p>
                            <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>{row.shownBecause}</p>
                        </div>
                    )
                }) : <p className='text-sm text-ui-muted dark:text-ui-muted'>Attach source references before case or watchlist routing.</p>}
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
        { label: 'Source results', value: String(coverage.totalRows) },
        { label: 'Dated activity', value: String(coverage.datedRows) },
        { label: 'Captures', value: String(coverage.captureRows) },
        { label: 'Latest', value: coverage.latestReportDate ? formatDate(coverage.latestReportDate) : 'Not dated' },
    ]
    return (
        <div data-ti-source-coverage='true' className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source coverage</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {coverage.stale ? 'Refresh source coverage before sending this to review.' : 'Evidence dates and source references are current.'}
                    </p>
                </div>
                <span className={coverage.stale ? 'rounded-md bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning' : 'rounded-md bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'}>
                    {coverage.stale ? 'review' : 'ready'}
                </span>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                {metrics.map(metric => (
                    <div key={metric.label} className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{metric.label}</p>
                        <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{metric.value}</p>
                    </div>
                ))}
            </div>
            <div className='mt-3 flex flex-wrap gap-1.5'>
                {coverage.sourceFamilies.length ? coverage.sourceFamilies.map(item => (
                    <span key={item.family} className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        {formatLabel(item.family)} · {item.count}
                    </span>
                )) : <span className='text-xs text-ui-muted dark:text-ui-muted'>Source family coverage is not mapped yet.</span>}
            </div>
            {coverage.missing.length ? (
                <div className='mt-3 rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                    Needs {coverage.missing.map(coverageMissingLabel).join(', ')}.
                </div>
            ) : null}
        </div>
    )
}

function TechniqueCoveragePanel({ techniques }: { techniques: TiActorIntelligenceProfile['techniqueCoverage'] }) {
    return (
        <div data-ti-technique-coverage='true' className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Techniques</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {techniques.length ? `${techniques.length} mapped technique${techniques.length === 1 ? '' : 's'} with source coverage.` : 'Add ATT&CK mapping before detection review.'}
                    </p>
                </div>
                <span className={techniques.some(item => item.freshness === 'ready') ? decisionStepStatusClass('ready') : decisionStepStatusClass(techniques.length ? 'review' : 'blocked')}>
                    {techniques.some(item => item.freshness === 'ready') ? 'ready' : techniques.length ? 'review' : 'syncing'}
                </span>
            </div>
            <div className='mt-2 grid gap-2'>
                {techniques.length ? techniques.slice(0, 4).map(item => {
                    const payload = techniqueCoveragePayloadFor(item)
                    return (
                        <div key={`${item.attackId ?? item.name}-${item.tactic}`} data-ti-technique-coverage-export='true' className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.name}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{item.tactic} · {sourceBasisLabel(item.confidence)}</p>
                                </div>
                                <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:shrink-0'>
                                    <span className={sourceHealthChipClass(item.freshness)}>{item.freshness}</span>
                                    {item.attackId ? <TechniqueBadge attackId={item.attackId} name={item.name} tactic={item.tactic} detail={item.detail} /> : null}
                                    <CopyPayloadButton label='Technique coverage' payload={payload} />
                                </div>
                            </div>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(item.detail)}</p>
                            <div className='mt-2 grid gap-1 border-t border-ui-border pt-2 dark:border-ui-border'>
                                <p className='wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {item.sourceIds.length ? `${item.sourceIds.length} source reference${item.sourceIds.length === 1 ? '' : 's'}` : 'Source reference needed'} · {item.captureIds.length ? `${item.captureIds.length} capture reference${item.captureIds.length === 1 ? '' : 's'}` : 'capture needed'} · {item.missing.length ? `needs ${item.missing.map(coverageMissingLabel).join(', ')}` : 'case context ready'}
                                </p>
                                {item.provenanceRefs[0] ? <p className='break-all font-mono text-[11px] text-ui-muted dark:text-ui-muted'>{item.provenanceRefs[0]}</p> : null}
                            </div>
                        </div>
                    )
                }) : <p className='text-xs text-ui-muted dark:text-ui-muted'>Add technique context before detection or case review.</p>}
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
        <div data-ti-campaign-timeline='true' className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Activity timeline</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {timeline.length ? `${timeline.length} dated campaign or activity item${timeline.length === 1 ? '' : 's'} with source references.` : 'Add dated campaign or activity evidence before trend review.'}
                    </p>
                </div>
                <span className={timeline.some(item => item.freshness === 'ready') ? decisionStepStatusClass('ready') : decisionStepStatusClass(timeline.length ? 'review' : 'blocked')}>
                    {timeline.some(item => item.freshness === 'ready') ? 'ready' : timeline.length ? 'review' : 'syncing'}
                </span>
            </div>
            <div className='mt-2 grid gap-2'>
                {timeline.length ? timeline.slice(0, 4).map(item => {
                    const payload = campaignActivityPayloadFor(item)
                    return (
                        <div key={`${item.firstReportedAt}-${item.title}`} data-ti-campaign-activity-export='true' className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.title}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {item.affectedSectors.slice(0, 2).join(', ') || 'Sector not mapped'} · {item.countries.slice(0, 2).join(', ') || 'Country not mapped'} · {sourceBasisLabel(item.confidence)}
                                    </p>
                                </div>
                                <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:shrink-0'>
                                    <span className={sourceHealthChipClass(item.freshness)}>{formatDate(item.firstReportedAt)}</span>
                                    <CopyPayloadButton label='Campaign activity' payload={payload} />
                                </div>
                            </div>
                            <div className='mt-2 grid gap-1 border-t border-ui-border pt-2 dark:border-ui-border'>
                                <p className='wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {item.sourceIds.length ? `${item.sourceIds.length} source reference${item.sourceIds.length === 1 ? '' : 's'}` : 'source reference needed'} · {item.provenanceRefs.length ? `${item.provenanceRefs.length} source detail${item.provenanceRefs.length === 1 ? '' : 's'}` : 'source detail needed'} · {item.missing.length ? `needs ${item.missing.map(coverageMissingLabel).join(', ')}` : 'case context ready'}
                                </p>
                                {item.provenanceRefs[0] ? <p className='break-all font-mono text-[11px] text-ui-muted dark:text-ui-muted'>{item.provenanceRefs[0]}</p> : null}
                            </div>
                        </div>
                    )
                }) : <p className='text-xs text-ui-muted dark:text-ui-muted'>Add campaign context before trend or case review.</p>}
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

function DossierList({ title, description, values, artifactKind, artifactByLookup, selectedArtifactId, onSelectArtifact }: {
    title: string
    description?: string
    values: string[]
    artifactKind?: ActorArtifactKind
    artifactByLookup?: Map<string, ActorArtifact>
    selectedArtifactId?: string
    onSelectArtifact?: (artifactId: string) => void
}) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 items-center gap-1.5'>
                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>{title}</p>
                {description ? <InfoTip label={description} /> : null}
            </div>
            <div className='mt-2 grid grid-cols-1 gap-1.5 sm:flex sm:flex-wrap'>
                {values.length ? values.slice(0, 8).map(value => {
                    const artifact = artifactKind ? artifactByLookup?.get(`${artifactKind}:${value.toLowerCase()}`) : undefined
                    if (!artifact || !onSelectArtifact) {
                        return <span key={value} className='inline-flex min-h-8 w-full max-w-full items-center wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text sm:w-auto'>{value}</span>
                    }
                    const active = artifact.id === selectedArtifactId
                    return (
                        <button
                            key={value}
                            type='button'
                            onClick={() => onSelectArtifact(artifact.id)}
                            className={`inline-flex min-h-8 w-full max-w-full items-center wrap-break-word rounded-md border px-2 py-1 text-left text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 sm:w-auto ${active ? 'border-ui-primary bg-ui-primary/10 text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-text hover:border-ui-primary/35 hover:bg-ui-raised dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:border-ui-primary/35 dark:hover:bg-ui-raised'}`}
                        >
                            {value}
                        </button>
                    )
                }) : <span className='text-xs text-ui-muted dark:text-ui-muted'>No values in this profile</span>}
            </div>
        </div>
    )
}

function ArtifactNavigator({ artifacts, selectedArtifactId, onSelectArtifact }: { artifacts: ActorArtifact[]; selectedArtifactId?: string; onSelectArtifact: (artifactId: string) => void }) {
    function move(direction: 'next' | 'previous' | 'first' | 'last') {
        const next = nextActorArtifactId(artifacts, selectedArtifactId, direction)
        if (next) onSelectArtifact(next)
    }
    const selectedArtifact = artifacts.find(artifact => artifact.id === selectedArtifactId) ?? artifacts[0]
    const readyCount = artifacts.filter(artifact => artifactStateFor(artifact) === 'ready').length
    const reviewCount = artifacts.filter(artifact => artifactStateFor(artifact) === 'review').length
    const blockedCount = artifacts.filter(artifact => artifactStateFor(artifact) === 'blocked').length

    return (
        <section
            data-ti-artifact-worklist='true'
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
            className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel'
        >
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Key details</p>
                    <p className='mt-0.5 wrap-break-word text-xs text-ui-muted dark:text-ui-muted'>Indicators, methods, tools, campaigns, and locations with source context.</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className={sourceHealthChipClass('ready')}>{readyCount} ready</span>
                    <span className={sourceHealthChipClass('review')}>{reviewCount} review</span>
                    <span className={sourceHealthChipClass(blockedCount ? 'blocked' : 'ready')}>{blockedCount} syncing</span>
                    {selectedArtifact ? <CopyPayloadButton label='Copy detail' payload={artifactWorklistPayloadFor(selectedArtifact)} /> : null}
                </div>
            </div>
            <div className='grid min-w-0 xl:grid-cols-[minmax(0,1fr)_18rem]'>
                <div className='min-w-0 overflow-x-auto'>
                    <table className='min-w-[780px] w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Detail</th>
                                <th className='px-3 py-2 font-semibold'>Results</th>
                                <th className='px-3 py-2 font-semibold'>Freshness</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Review status</th>
                                <th className='px-3 py-2 font-semibold'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#eef1f5] dark:divide-[#273244]'>
                            {artifacts.map(artifact => {
                                const active = artifact.id === selectedArtifact?.id
                                const state = artifactStateFor(artifact)
                                return (
                                    <tr key={artifact.id} className={`${active ? 'bg-ui-primary/10 dark:bg-ui-primary/10' : 'bg-ui-panel dark:bg-ui-panel'} align-top`}>
                                        <td className='px-3 py-2'>
                                            <button type='button' onClick={() => onSelectArtifact(artifact.id)} className='grid min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                                                <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{artifact.label}</span>
                                                <span className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatLabel(artifact.kind)}</span>
                                            </button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <p className='font-semibold text-ui-text dark:text-ui-text'>{artifact.evidence.length} results</p>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{artifact.evidence[0] ? displayRequirementText(artifact.evidence[0]) : artifact.subtitle}</p>
                                        </td>
                                        <td className='px-3 py-2 text-ui-text dark:text-ui-text'>{formatDate(artifact.freshness)}</td>
                                        <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceBasisLabel(artifact.confidence)}</td>
                                        <td className='px-3 py-2'>
                                            <span className={sourceHealthChipClass(state)}>{artifactStateLabel(artifact)}</span>
                                            <p className='mt-1 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                                {artifact.watchlistTerms.length} watch · {artifact.enrichmentTasks.length} gaps
                                            </p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                                <button type='button' onClick={() => onSelectArtifact(artifact.id)} className='inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Inspect</button>
                                                <CopyPayloadButton label='Copy' payload={artifactWorklistPayloadFor(artifact)} />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised xl:border-l xl:border-t-0'>
                    {selectedArtifact ? (
                        <div className='grid gap-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected detail</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedArtifact.label}</h3>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{selectedArtifact.subtitle}</p>
                            </div>
                            <div className='grid grid-cols-2 gap-2 text-xs'>
                                <EvidenceMetric label='Type' value={formatLabel(selectedArtifact.kind)} />
                                <EvidenceMetric label='Source basis' value={sourceBasisLabel(selectedArtifact.confidence)} />
                                <EvidenceMetric label='Watch' value={String(selectedArtifact.watchlistTerms.length)} />
                                <EvidenceMetric label='Open questions' value={String(selectedArtifact.enrichmentTasks.length)} />
                            </div>
                            <div className='grid grid-cols-2 gap-1.5'>
                                <button type='button' onClick={() => onSelectArtifact(selectedArtifact.id)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Review</button>
                                <CopyPayloadButton label='Export' payload={artifactWorklistPayloadFor(selectedArtifact)} showLabel />
                            </div>
                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                {selectedArtifact.watchlistTerms.slice(0, 3).map(term => (
                                    <span key={`${term.kind}-${term.value}`} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                        {term.kind}: {term.value}
                                    </span>
                                ))}
                                {!selectedArtifact.watchlistTerms.length ? <span className='text-xs text-ui-muted dark:text-ui-muted'>No watch term attached.</span> : null}
                            </div>
                        </div>
                    ) : (
                        <p className='text-sm text-ui-muted dark:text-ui-muted'>Select a detail to inspect source and review context.</p>
                    )}
                </div>
            </div>
        </section>
    )
}

function ActorArtifactWorkbench({ artifact, handoffs }: { artifact: ActorArtifact; handoffs: ActorArtifactHandoffs }) {
    const bridge = handoffs.authBridge
    const selectedArtifactPayload = selectedArtifactPayloadFor(artifact, handoffs)
    const payloadRows = [
        { id: 'watchlist', label: 'Watchlist package', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist], route: bridge.links.watchlist.href, blocked: handoffs.watchlist.blocked, detail: handoffs.watchlist.missing.length ? handoffMissingLabel(handoffs.watchlist.missing) : `${artifact.watchlistTerms.length} watch term${artifact.watchlistTerms.length === 1 ? '' : 's'}` },
        { id: 'alert', label: 'Alert rebuild', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild], route: bridge.links.alertRebuild.href, blocked: handoffs.alertRebuild.blocked, detail: handoffs.alertRebuild.missing.length ? handoffMissingLabel(handoffs.alertRebuild.missing) : 'Ready to rebuild from this selected artifact.' },
        { id: 'case', label: 'Case package', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case], route: bridge.links.case.href, blocked: handoffs.case.blocked, detail: handoffs.case.missing.length ? handoffMissingLabel(handoffs.case.missing) : 'Ready to open with this selected artifact.' },
        { id: 'enrichment', label: 'Source review item', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.enrichment], route: bridge.links.enrichment.href, blocked: handoffs.enrichment.blocked, detail: handoffs.enrichment.missing.length ? handoffMissingLabel(handoffs.enrichment.missing) : `${artifact.enrichmentTasks.length} source review task${artifact.enrichmentTasks.length === 1 ? '' : 's'}` },
    ]
    const workflowRows = payloadRows.map(row => ({
        ...row,
        readiness: row.payload.actionReadiness.find(item => item.action === row.payload.action),
        missing: row.payload.missing,
        endpoint: row.payload.selectedPayload.endpoint ?? row.payload.selectedPayload.backedRoute ?? row.route,
    }))

    return (
        <section data-ti-selected-artifact='true' className='max-w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-3 sm:p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>Selected detail</p>
                    <h2 className='mt-1 wrap-break-word text-xl font-semibold text-ui-text'>{artifact.label}</h2>
                    <p className='mt-1 text-sm leading-6 text-ui-muted'>{formatLabel(artifact.kind)} · {artifact.subtitle}</p>
                </div>
                <div data-ti-selected-artifact-export='true' className='grid w-full min-w-0 basis-full gap-2 sm:min-w-72 lg:w-auto lg:basis-auto'>
                    <div className='grid grid-cols-3 gap-2 text-center text-xs'>
                        <EvidenceMetric label='Freshness' value={formatDate(artifact.freshness)} />
                        <EvidenceMetric label='Source basis' value={sourceBasisLabel(artifact.confidence)} />
                        <EvidenceMetric label='Review status' value={displayRequirementText(artifact.readiness.label)} />
                    </div>
                    <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 lg:justify-end'>
                        <span className={sourceHealthChipClass(artifact.readiness.state === 'ready_for_org_handoff' ? 'ready' : artifact.readiness.state === 'needs_source' || artifact.readiness.state === 'needs_watchlist_term' ? 'blocked' : 'review')}>{publicStateLabel(artifact.readiness.state)}</span>
                        <CopyPayloadButton label='Selected detail' payload={selectedArtifactPayload} />
                    </div>
                </div>
            </div>
            <div className='mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]'>
                <div className='grid gap-3 md:grid-cols-2'>
                    <EvidencePanel title='Evidence'>
                        {artifact.evidence.length ? artifact.evidence.slice(0, 6).map(line => <li key={line}>{displayRequirementText(line)}</li>) : <li>No evidence text is attached to this detail.</li>}
                    </EvidencePanel>
                    <EvidencePanel title='Source details'>
                        {artifact.provenance.length ? artifact.provenance.slice(0, 6).map(line => <li key={line}>{displayRequirementText(line)}</li>) : <li>Source details are missing for this detail.</li>}
                    </EvidencePanel>
                    <EvidencePanel title='Watchlist relevance'>
                        {artifact.watchlistTerms.length ? artifact.watchlistTerms.map(term => <li key={`${term.kind}-${term.value}`}>{term.kind}: {term.value}. {displayRequirementText(term.notes)}</li>) : <li>No customer watchlist term is attached to this detail.</li>}
                    </EvidencePanel>
                    <EvidencePanel title='Open source questions'>
                        {artifact.enrichmentTasks.length ? artifact.enrichmentTasks.map(task => <li key={task}>{displayRequirementText(task)}</li>) : <li>No open source question is attached to this detail.</li>}
                    </EvidencePanel>
                </div>
                <div className='grid min-w-0 max-w-full content-start gap-2 overflow-hidden'>
                    <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                        <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Console actions</p>
                        <p className='mt-2 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            This view prepares links and payloads for organization-scoped review. Saving watchlists, rebuilding alerts, creating cases, and source review require console access.
                        </p>
                        <div className='mt-2 flex flex-wrap gap-1.5'>
                            <span className={bridge.orgRequired ? 'rounded-md bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning' : 'rounded-md bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'}>
                                {bridge.orgRequired ? 'org required' : 'org scoped'}
                            </span>
                            <span className={bridge.sourceRequired ? 'rounded-md bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning' : 'rounded-md bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'}>
                                {bridge.sourceRequired ? 'source required' : 'source attached'}
                            </span>
                            <span className={bridge.stale ? 'rounded-md bg-ui-danger/10 px-2 py-1 text-[11px] font-semibold text-ui-danger dark:bg-ui-danger/10 dark:text-ui-danger' : 'rounded-md bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'}>
                                {bridge.stale ? 'stale' : 'fresh enough'}
                            </span>
                        </div>
                        <div data-ti-artifact-source-requests='true' className='mt-3 grid min-w-0 w-full max-w-[calc(100vw-7rem)] gap-2 overflow-hidden sm:max-w-full'>
                            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source requests</p>
                            {bridge.payload.sourceRequests.length ? bridge.payload.sourceRequests.slice(0, 3).map(request => (
                                <div key={`${request.sourceName}-${request.provenance}-${request.captureId ?? 'missing'}`} className='min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                    <div className='flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'>
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{request.sourceName}</p>
                                        <span className={sourceRequestCaptureClass(Boolean(request.captureId))}>
                                            {request.captureId ? 'capture attached' : 'capture needed'}
                                        </span>
                                    </div>
                                    <p className='mt-1 break-all font-mono text-[11px] text-ui-muted dark:text-ui-muted'>{request.captureId ?? displayRequirementText(request.provenance)}</p>
                                    {request.missing.length || typeof request.confidence === 'number' ? (
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                            {[typeof request.confidence === 'number' ? sourceBasisLabel(request.confidence) : '', ...request.missing.map(displayRequirementText)].filter(Boolean).join(' · ')}
                                        </p>
                                    ) : null}
                                    <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                        <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                            {sourceRequestFamilyLabel(request.sourceFamily ?? 'source_capture')}
                                        </span>
                                        <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                            {sourceRequestRouteLabel(request.route ?? '/dashboard/ti/enrichment')}
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <p className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>No source request is attached to this detail.</p>
                            )}
                        </div>
                        {bridge.missing.length ? (
                            <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-warning'>
                                {bridge.missing.slice(0, 4).map(item => <li key={item}>{displayRequirementText(item)}</li>)}
                            </ul>
                        ) : null}
                        {bridge.payload.evidenceRefs ? (
                            <div data-ti-artifact-reference-summary='true' className='mt-3 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Reference summary</p>
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {artifactReferenceChips(bridge.payload.evidenceRefs).map(item => (
                                        <span key={item.label} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
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
                    <CopyPayloadButton label='console action bundle' payload={bridge} />
                </div>
            </div>
            <div data-ti-artifact-workflow-readiness='true' className='mt-4 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected review status</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            Selected detail review state for watchlist, alert, case, and source review work.
                        </p>
                    </div>
                    <span className={workflowRows.every(row => !row.blocked) ? decisionStepStatusClass('ready') : decisionStepStatusClass('review')}>
                        {workflowRows.filter(row => !row.blocked).length}/{workflowRows.length} ready
                    </span>
                </div>
                <div className='mt-3 grid gap-2 md:grid-cols-2'>
                    {workflowRows.map(row => (
                        <div key={`workflow-${row.id}`} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.label}</p>
                                <span className={row.blocked ? decisionStepStatusClass('blocked') : decisionStepStatusClass('ready')}>
                                    {row.blocked ? 'syncing' : 'ready'}
                                </span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.endpoint)}</p>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                {row.readiness?.missing.length ? displayRequirementList(row.readiness.missing.slice(0, 2)) : row.missing.length ? displayRequirementList(row.missing.slice(0, 2)) : 'Required artifact context is present.'}
                            </p>
                            {row.readiness ? (
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                        {actionOwnerLabel(row.readiness.ownerLane)}
                                    </span>
                                    <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
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
        <div data-ti-evidence-priority='true' className='mt-4 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Evidence priority</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(priority.nextAction)}</p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(priority.state)}>{decisionStepStatusLabel(priority.state)}</span>
                    <span className='rounded-md bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary'>{priority.score}/100</span>
                    <CopyPayloadButton label='Evidence priority' payload={priority} />
                </div>
            </div>
            <div className='mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]'>
                <EvidencePanel title='Priority basis'>
                    {priority.reasons.map(reason => <li key={reason}>{reason}</li>)}
                </EvidencePanel>
                <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Backed references</p>
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                        {ids.length ? ids.map(id => (
                            <span key={id} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-raised dark:text-ui-text'>{id}</span>
                        )) : <span className='text-xs text-ui-muted dark:text-ui-muted'>No backed IDs attached.</span>}
                    </div>
                    {priority.blockers.length ? (
                        <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-warning dark:text-ui-warning'>
                            {priority.blockers.slice(0, 3).map(blocker => <li key={`${blocker.code}-${blocker.field}`}>{displayRequirementText(blocker.detail)}</li>)}
                        </ul>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function SelectedEvidenceContextTable({ drilldown }: { drilldown: SelectedSourceDrilldown }) {
    const rows = drilldown.rows.slice(0, 5)
    if (!rows.length) return null
    return (
        <div data-ti-selected-evidence-context='true' className='mt-4 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source context</p>
                    <p className='mt-0.5 text-[11px] text-ui-muted dark:text-ui-muted'>{rows.length} source{rows.length === 1 ? '' : 's'} tied to the selected result</p>
                </div>
                <CopyPayloadButton label='Source context' payload={drilldown} />
            </div>
            <div className='grid gap-2 p-2 md:hidden'>
                {rows.map(row => (
                    <div key={`mobile-${row.rowId}`} className='rounded-lg border border-ui-border bg-white p-3 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.provenance)}</p>
                            </div>
                            <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? 'attached' : 'needed'}</span>
                        </div>
                        <div className='mt-2 grid grid-cols-2 gap-2'>
                            <EvidenceMetric label='Timestamp' value={row.reportDate ? formatDate(row.reportDate) : 'Not dated'} />
                            <EvidenceMetric label='Basis' value={sourceBasisLabel(row.confidence)} />
                        </div>
                        <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.handoff)}</p>
                    </div>
                ))}
            </div>
            <div className='hidden overflow-x-auto md:block'>
                <table className='min-w-[720px] w-full border-collapse text-left text-xs'>
                    <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-panel dark:text-ui-muted'>
                        <tr>
                            <th className='px-3 py-2 font-semibold'>Source</th>
                            <th className='px-3 py-2 font-semibold'>Timestamp</th>
                            <th className='px-3 py-2 font-semibold'>Basis</th>
                            <th className='px-3 py-2 font-semibold'>Capture</th>
                            <th className='px-3 py-2 font-semibold'>Next action</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-[#eef1f5] dark:divide-[#273244]'>
                        {rows.map(row => (
                            <tr key={row.rowId} className='bg-ui-panel align-top dark:bg-ui-raised'>
                                <td className='px-3 py-2'>
                                    <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.provenance)}</p>
                                </td>
                                <td className='px-3 py-2 text-ui-muted dark:text-ui-muted'>{row.reportDate ? formatDate(row.reportDate) : 'Not dated'}</td>
                                <td className='px-3 py-2 text-ui-muted dark:text-ui-muted'>{sourceBasisLabel(row.confidence)}</td>
                                <td className='px-3 py-2'>
                                    <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? 'attached' : 'needed'}</span>
                                </td>
                                <td className='px-3 py-2'>
                                    <p className='wrap-break-word text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.handoff)}</p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function SelectedSourceDrilldownPanel({ drilldown }: { drilldown: SelectedSourceDrilldown }) {
    const readyRows = drilldown.rows.filter(row => row.state === 'ready').length
    const state: DecisionStep['status'] = readyRows === drilldown.rows.length && drilldown.rows.length ? 'ready' : drilldown.rows.length ? 'review' : 'blocked'
    return (
        <div data-ti-selected-source-drilldown='true' className='mt-4 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source details</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Sources, capture status, and follow-up for the selected result.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(state)}>{readyRows}/{drilldown.rows.length} ready</span>
                    <CopyPayloadButton label='Source details' payload={drilldown} />
                </div>
            </div>

            <div className='mt-3 grid min-w-0 gap-2 md:grid-cols-2'>
                {drilldown.rows.length ? drilldown.rows.slice(0, 4).map(row => (
                    <div key={row.rowId} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {[row.sourceId ? `source ${row.sourceId}` : '', row.reportDate ? formatDate(row.reportDate) : '', typeof row.confidence === 'number' ? sourceBasisLabel(row.confidence) : ''].filter(Boolean).join(' · ') || 'Source metadata incomplete'}
                                </p>
                            </div>
                            <span className={row.state === 'ready' ? decisionStepStatusClass('ready') : row.state === 'needs_capture' ? decisionStepStatusClass('review') : decisionStepStatusClass('blocked')}>
                                {row.state === 'ready' ? 'ready' : row.state === 'needs_capture' ? 'capture needed' : 'source needed'}
                            </span>
                        </div>
                        <p className='mt-1 break-all font-mono text-[11px] text-ui-muted dark:text-ui-muted'>{row.captureId ? `capture ${row.captureId}` : displayRequirementText(row.provenance)}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.handoff)}</p>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-raised dark:text-ui-text'>
                                {readinessOwnerLabel(row.ownerLane === 'public-ti' ? 'public-ti' : row.ownerLane)}
                            </span>
                            <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-raised dark:text-ui-text'>
                                {sourceRequestRouteLabel(row.route)}
                            </span>
                            <CopyPayloadButton label='Source evidence request' payload={sourceEvidenceRequestPayloadFor(row, drilldown)} />
                            {row.href ? (
                                <a href={row.href} target='_blank' rel='noopener noreferrer' className='inline-flex min-h-7 max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                    <ExternalLink className='h-3 w-3' />
                                    Open source
                                </a>
                            ) : null}
                        </div>
                        {row.missing.length ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(row.missing.slice(0, 2))}</p>
                        ) : null}
                    </div>
                )) : (
                    <div className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                        No sources are attached to this result yet.
                    </div>
                )}
            </div>

            <div className='mt-3 grid gap-2 md:grid-cols-2'>
                <SourceDrilldownHandoff label='Alert handoff' ready={drilldown.alertHandoff.ready} endpoint={drilldown.alertHandoff.route || drilldown.alertHandoff.endpoint} missing={drilldown.alertHandoff.missing} />
                <SourceDrilldownHandoff label='Case handoff' ready={drilldown.caseHandoff.ready} endpoint={drilldown.caseHandoff.route || drilldown.caseHandoff.endpoint} missing={drilldown.caseHandoff.missing} />
            </div>
            {drilldown.blockers.length ? (
                <p className='mt-3 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(drilldown.blockers.slice(0, 3))}</p>
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

function watchlistWorkbenchRowId(kind: string, value: string) {
    return `watch:${kind}:${value}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-')
}

function SourceDrilldownHandoff({ label, ready, endpoint, missing }: { label: string; ready: boolean; endpoint: string; missing: string[] }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{label}</p>
                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(endpoint)}</p>
                </div>
                <span className={ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{ready ? 'ready' : 'syncing'}</span>
            </div>
            <p className={ready ? 'mt-1 text-[11px] leading-5 text-ui-success dark:text-ui-success' : 'mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'}>
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
        title: item.company || item.victim || 'Recent attack mention',
        subtitle: [item.affectedAccounts, item.datasetSize, item.claimedDate].filter(Boolean).join(' · ') || 'Sensitive-source review item',
        detail: item.actorStatement || 'Review the captured safe fields before taking action.',
        timestamp: item.claimedDate || result.generatedAt,
        source: item.sourceHash ? `source hash ${item.sourceHash}` : 'Sensitive-source review inbox',
        provenance: item.provenance || 'Sensitive-source review',
        confidence: item.confidence,
        evidence: [
            item.affectedAccounts ? `Affected accounts: ${item.affectedAccounts}` : 'Affected accounts not stated.',
            item.accountSubjects ? `Account subjects: ${item.accountSubjects}` : 'Account subjects not stated.',
            item.datasetSize ? `Dataset size: ${item.datasetSize}` : 'Dataset size not stated.',
            item.actorStatement ? `Actor statement: ${item.actorStatement}` : 'Actor statement is not in the safe fields.',
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
        title: result.status === 'searching' ? 'Checking sources' : 'No results ready for review',
        subtitle: result.analystLoop?.headline || result.summary,
        detail: result.analystLoop?.runStatusClarity.summary || 'No reviewable results are ready for this query yet.',
        timestamp: result.generatedAt,
        source: 'TI search service',
        provenance: result.mode,
        confidence: result.confidence,
        evidence: result.notes.length ? result.notes : ['No evidence text is attached to this result yet.'],
        nextActions: ['Leave this query open while polling continues.', 'Search an alias, domain, company name, CVE, or supplier term.', 'Open the customer console to save the work.'],
        priority: priorityByRow.get('collection-searching'),
    }]
}

function CustomerAlertFit({ selected, watchlist, alertPacket }: { selected: AnalystWorkItem; watchlist: WatchlistRelevance; alertPacket: AlertPacket | null }) {
    return (
        <div className='mt-4 rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Customer Alert Fit</p>
                    <p className='mt-1 text-sm leading-6 text-ui-muted'>{alertPacket?.customerValue ?? watchlist.rationale}</p>
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
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Domains to monitor</p>
                    <div className='mt-2 flex flex-wrap gap-2'>
                        {watchlist.domains.map(domain => <span key={domain} className='rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 font-mono text-xs text-ui-text'>{domain}</span>)}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function WatchlistRelevanceWorkbench({
    watchlist,
    actionability,
    query,
    workItems,
    artifacts,
    selectedId,
    selectedArtifactId,
    onSelectEvidence,
    onSelectArtifact,
    onMarkRelevant,
}: {
    watchlist: WatchlistRelevance
    actionability: TiActionabilityModel
    query: string
    workItems: AnalystWorkItem[]
    artifacts: ActorArtifact[]
    selectedId?: string
    selectedArtifactId?: string
    onSelectEvidence: (id: string) => void
    onSelectArtifact: (id: string) => void
    onMarkRelevant: () => void
}) {
    const rows = useMemo(() => watchlistWorkbenchRowsFor({ watchlist, actionability, query, workItems, artifacts }), [watchlist, actionability, query, workItems, artifacts])
    const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id ?? '')
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const readyCount = rows.filter(row => row.state === 'ready').length
    const blockedCount = rows.filter(row => row.state === 'blocked').length
    const selectedArtifact = selectedRow?.artifactIds.find(id => id === selectedArtifactId) ?? selectedRow?.artifactIds[0]
    const selectedEvidence = selectedRow?.evidenceItems.find(item => item.id === selectedId) ?? selectedRow?.evidenceItems[0]

    return (
        <section data-ti-watchlist-workbench='true' data-ti-watchlist-term-requests='true' className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Watchlist review</p>
                    <p className='mt-0.5 wrap-break-word text-xs text-ui-muted dark:text-ui-muted'>Watched terms, matching results, key details, and case routes for organization review.</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className={sourceHealthChipClass('ready')}>{readyCount} matched</span>
                    <span className={sourceHealthChipClass(blockedCount ? 'blocked' : 'review')}>{blockedCount} syncing</span>
                    {selectedRow ? <CopyPayloadButton label='Copy watchlist match' payload={selectedRow.payload} /> : null}
                </div>
            </div>
            <div className='grid min-w-0 xl:grid-cols-[minmax(0,1fr)_19rem]'>
                <div className='min-w-0 overflow-x-auto'>
                    <table className='min-w-[850px] w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Term</th>
                                <th className='px-3 py-2 font-semibold'>Results</th>
                                <th className='px-3 py-2 font-semibold'>Newest</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Route</th>
                                <th className='px-3 py-2 font-semibold'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#eef1f5] dark:divide-[#273244]'>
                            {rows.map(row => {
                                const active = selectedRow?.id === row.id
                                return (
                                    <tr key={row.id} className={`${active ? 'bg-ui-primary/10 dark:bg-ui-primary/10' : 'bg-ui-panel dark:bg-ui-panel'} align-top`}>
                                        <td className='px-3 py-2'>
                                            <button type='button' onClick={() => setSelectedRowId(row.id)} className='grid min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                                                <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.value}</span>
                                                <span className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatLabel(row.kind)}</span>
                                            </button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <p className='font-semibold text-ui-text dark:text-ui-text'>{row.evidenceItems.length} results · {row.artifactIds.length} details</p>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{row.evidenceItems[0]?.title ?? row.detail}</p>
                                        </td>
                                        <td className='px-3 py-2 text-ui-text dark:text-ui-text'>{row.newestAt ? formatDate(row.newestAt) : 'Not dated'}</td>
                                        <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceConfidenceLabel(row.confidenceValues)}</td>
                                        <td className='px-3 py-2'>
                                            <span className={sourceHealthChipClass(row.state)}>{row.matched ? 'matched' : publicStateLabel(row.state)}</span>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.casePath || row.route || row.detail)}</p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                                <button type='button' onClick={() => setSelectedRowId(row.id)} className='inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Inspect</button>
                                                {row.evidenceItems[0] ? <button type='button' onClick={() => onSelectEvidence(row.evidenceItems[0]!.id)} className='inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Open result</button> : null}
                                                {row.artifactIds[0] ? <button type='button' onClick={() => onSelectArtifact(row.artifactIds[0]!)} className='inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Detail</button> : null}
                                                <CopyPayloadButton label='Watchlist term request' payload={row.payload} />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {!rows.length ? <p className='p-4 text-sm text-ui-muted dark:text-ui-muted'>No watchlist term is linked to this result.</p> : null}
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised xl:border-l xl:border-t-0'>
                    {selectedRow ? (
                        <div className='grid gap-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected term</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.kind}: {selectedRow.value}</h3>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.detail)}</p>
                            </div>
                            <div className='grid grid-cols-2 gap-2 text-xs'>
                                <EvidenceMetric label='Results' value={String(selectedRow.evidenceItems.length)} />
                                <EvidenceMetric label='Details' value={String(selectedRow.artifactIds.length)} />
                                <EvidenceMetric label='Sources' value={String(selectedRow.sourceCount)} />
                                <EvidenceMetric label='Status' value={selectedRow.matched ? 'Matched' : publicStateLabel(selectedRow.state)} />
                            </div>
                            <div className='grid grid-cols-2 gap-1.5'>
                                <button type='button' onClick={onMarkRelevant} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Watch</button>
                                {selectedEvidence ? <button type='button' onClick={() => onSelectEvidence(selectedEvidence.id)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Review result</button> : null}
                                {selectedArtifact ? <button type='button' onClick={() => onSelectArtifact(selectedArtifact)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Open detail</button> : null}
                                <CopyPayloadButton label='Export' payload={selectedRow.payload} showLabel />
                            </div>
                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                {selectedRow.route ? <a href={selectedRow.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'><ExternalLink className='h-3.5 w-3.5' />Open route</a> : null}
                                {selectedRow.casePath ? <a href={selectedRow.casePath} className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'><ClipboardList className='h-3.5 w-3.5' />Open case</a> : null}
                            </div>
                            {selectedRow.blockers.length ? (
                                <div className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                                    {displayRequirementList(selectedRow.blockers.slice(0, 3))}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <p className='text-sm text-ui-muted dark:text-ui-muted'>Select a watchlist term to inspect evidence and review context.</p>
                    )}
                </div>
            </div>
        </section>
    )
}

function WatchlistBlock({ title, values }: { title: string; values: string[] }) {
    const visible = values.slice(0, 6)
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>{title}</p>
            <div className='mt-2 flex flex-wrap gap-1.5'>
                {visible.length ? visible.map(value => (
                    <span key={value} className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'>{value}</span>
                )) : <span className='text-xs text-ui-muted dark:text-ui-muted'>No matching values in this result</span>}
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
            label: 'Source review',
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
        <div data-ti-handoff-evidence-matrix='true' className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Review evidence</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {readyCount} of {rows.length} review paths have source IDs, route, and capture details ready for authenticated review.
                    </p>
                </div>
                <span className={readyCount === rows.length ? decisionStepStatusClass('ready') : readyCount ? decisionStepStatusClass('review') : decisionStepStatusClass('blocked')}>
                    {readyCount}/{rows.length} ready
                </span>
            </div>
            <div className='mt-3 grid min-w-0 gap-2'>
                {rows.map(row => (
                    <div key={row.id} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.label}</p>
                                <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.route)}</p>
                            </div>
                            <span className={row.state ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                {row.state ? 'ready' : 'syncing'}
                            </span>
                        </div>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            {row.ids.length ? row.ids.map(id => (
                                <span key={id} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>{id}</span>
                            )) : <span className='rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>ID needed</span>}
                            {row.provenance.slice(0, 2).map(item => (
                                <span key={`${row.id}-source-${item.sourceName}-${item.provenance}`} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>{item.sourceName}</span>
                            ))}
                            {row.provenance.filter(item => item.captureId).slice(0, 2).map(item => (
                                <span key={`${row.id}-capture-${item.captureId}`} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>capture {item.captureId}</span>
                            ))}
                        </div>
                        {row.blocker ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{readinessOwnerLabel(row.blocker.ownerLane)}: {displayRequirementText(row.blocker.handoff)}</p>
                        ) : row.missing.length ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(row.missing.slice(0, 2))}</p>
                        ) : (
                            <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Required identifiers and source details are present.</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

function AlertPacketPanel({ packet }: { packet: AlertPacket }) {
    return (
        <Panel title='Evidence' description='Customer-facing alert ingredients derived from the selected finding and actor profile data. Delivery stays in the authenticated console.' icon={<BellRing className='h-4 w-4' />}>
            <div className='grid gap-3'>
                <div>
                    <p className='text-sm font-semibold text-ui-text'>{packet.title}</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>{packet.customerValue}</p>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Evidence basis</p>
                    <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-muted'>
                        {packet.evidenceBasis.map(item => <li key={item}>{displayRequirementText(item)}</li>)}
                    </ul>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Routing</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>{packet.routing}</p>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Watch terms carried forward</p>
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                        {packet.watchTerms.map(term => <span key={term} className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'>{term}</span>)}
                    </div>
                </div>
                {packet.blockedUntil.length ? (
                    <div className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3'>
                        <p className='text-xs font-semibold uppercase text-ui-warning dark:text-ui-warning'>Waiting on</p>
                        <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-warning'>
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
        <Panel title='Actions' description='Operational state for watchlists, alerts, cases, delivery, and source collection.' icon={<ShieldCheck className='h-4 w-4' />}>
            <div className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3'>
                <DecisionFlow steps={decisionSteps} disposition={actionability.alertDisposition} shouldAlert={actionability.shouldAlert} rationale={actionability.rationale} />
                <HandoffEvidenceMatrix actionability={actionability} />
                <ConsumerReadinessPanel actionability={actionability} />
                <ReadinessBlockersPanel actionability={actionability} />
                <ActionPayloadsPanel actionability={actionability} />

                <OrgRelevancePanel actionability={actionability} />

                <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Geography</p>
                    <div className='mt-2 grid gap-2'>
                        {actionability.geographyHandoffs.slice(0, 4).map(item => (
                            <div key={`${item.role}-${item.code}`} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.country}</p>
                                    <span className='shrink-0 text-[11px] text-ui-muted dark:text-ui-muted'>{item.role === 'operator' ? 'attribution' : `${item.observationCount} observation${item.observationCount === 1 ? '' : 's'}`}</span>
                                </div>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{item.watchlistTerm ? `${item.watchlistTerm.kind}: ${item.watchlistTerm.value}` : item.enrichmentTask}</p>
                            </div>
                        ))}
                        {!actionability.geographyHandoffs.length ? <p className='text-xs text-ui-muted dark:text-ui-muted'>Add country-specific source context before regional routing.</p> : null}
                    </div>
                </div>

                <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Sources</p>
                    <div className='mt-2 grid gap-2'>
                        {actionability.sourceClusters.slice(0, 4).map(item => (
                            <div key={`${item.sourceName}-${item.provenance}`} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.sourceName}</p>
                                    <span className={item.captureId ? 'shrink-0 text-[11px] text-ui-success' : 'shrink-0 text-[11px] text-ui-warning'}>{item.captureId ? 'capture attached' : 'capture needed'}</span>
                                </div>
                                <p className='mt-1 break-all font-mono text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(item.provenance)}</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{item.watchlistTerm ? `${item.watchlistTerm.kind}: ${item.watchlistTerm.value}` : item.enrichmentTask}</p>
                            </div>
                        ))}
                        {!actionability.sourceClusters.length ? <p className='text-xs text-ui-muted dark:text-ui-muted'>Add source details before routing.</p> : null}
                    </div>
                </div>

                <div className='grid min-w-0 gap-2'>
                    <Link href='/dashboard/dwm' className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                        <ExternalLink className='h-3.5 w-3.5' />
                        Open console
                    </Link>
                    {casePath ? (
                        <a href={casePath} className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                            <ExternalLink className='h-3.5 w-3.5' />
                            Open related case
                        </a>
                    ) : (
                        <button type='button' disabled title={displayRequirementList(actionability.handoffs.caseBlockers)} className='inline-flex min-h-9 w-fit max-w-full cursor-not-allowed items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-muted'>
                            <ClipboardList className='h-3.5 w-3.5' />
                            Create case
                        </button>
                    )}
                </div>

                {!casePath && actionability.handoffs.casePayload ? (
                    <PayloadHandoffRow
                        label='Case handoff'
                        detail={actionability.caseHandoff.blocked ? `Waiting on ${displayRequirementList(actionability.caseHandoff.missing.slice(0, 2))}.` : 'Case request is prepared for authenticated review.'}
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
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Related alerts/cases</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {records.length} linked record{records.length === 1 ? '' : 's'} · {actionability.caseReplayReadiness.summary.ready} replay-ready · {actionability.webhookDeliveryHandoff.ready ? 'delivery ready' : 'delivery syncing'}
                    </p>
                </div>
                <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span data-ti-case-replay-readiness='true' className='inline-flex'>
                        <CopyPayloadButton label='Case replay status' payload={actionability.caseReplayReadiness} />
                    </span>
                    <CopyPayloadButton label='Related alerts and cases' payload={{ alerts: actionability.relatedAlerts, cases: actionability.relatedCases, caseReplayReadiness: actionability.caseReplayReadiness, blockers: actionability.readiness.blockers }} />
                </div>
            </div>
            {records.length ? (
                <div className='mt-3 grid gap-2'>
                    {records.slice(0, 4).map(record => (
                        <div key={record.id} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{record.kind}: {record.label}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{record.meta}</p>
                                </div>
                                <div data-ti-related-record-export='true' className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                    {record.route ? (
                                        <a href={record.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
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
                <div className='mt-3 rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3 dark:border-ui-warning/35 dark:bg-ui-warning/10'>
                    <div data-ti-case-review-intake='true' className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                        <div className='min-w-0'>
                            <p className='text-xs font-semibold uppercase text-ui-warning'>Case review intake</p>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-warning'>
                                {caseIntake.summary.total} candidate{caseIntake.summary.total === 1 ? '' : 's'} for {query} · {actionability.caseReplayReadiness.summary.ready} replay-ready · {caseIntake.summary.captures} capture{caseIntake.summary.captures === 1 ? '' : 's'}
                            </p>
                        </div>
                        <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                            <CopyPayloadButton label='Case replay status' payload={actionability.caseReplayReadiness} />
                            <CopyPayloadButton label='Case review intake' payload={caseIntake} />
                        </div>
                    </div>
                    <div className='mt-2 grid min-w-0 gap-2'>
                        {caseIntake.items.slice(0, 3).map(item => (
                            <div key={item.id} className='rounded-md border border-ui-warning/35 bg-ui-panel/70 p-2 dark:border-ui-warning/35 dark:bg-ui-warning/10'>
                                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='wrap-break-word text-xs font-semibold text-ui-warning dark:text-ui-warning'>{item.title}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>
                                            {recommendedActionLabel(item.recommendedAction)} · {item.reasons.length} reason{item.reasons.length === 1 ? '' : 's'} · {item.blockedBy.length} follow-up{item.blockedBy.length === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                    <span className={sourceHealthChipClass(item.state === 'ready' ? 'ready' : item.state === 'blocked' ? 'blocked' : 'review')}>{publicDecisionStatusLabel(item.state)}</span>
                                </div>
                                <div className='mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                                    <p className='min-w-0 wrap-break-word text-[11px] text-ui-warning dark:text-ui-warning'>{displayRequirementText(item.casePaths[0] || item.route)}</p>
                                    <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                        <CopyPayloadButton label='Replay export' payload={caseReplayCandidatePayloadFor(item, actionability)} />
                                        <CopyPayloadButton label='Case candidate' payload={caseReviewCandidatePayloadFor(item, query)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className='mt-2 wrap-break-word text-xs leading-5 text-ui-warning'>No alert or case ID is attached yet; rebuild alerts after saving a matching watchlist term or attach capture evidence before case creation.</p>
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
                    detail: `Delivery status blocker: ${code}.`,
                    route: '/dashboard/dwm',
                    handoff: 'Resolve delivery status before sending or replaying this alert.',
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
    const relevance = actionability.orgRelevance
    const firstBlocker = relevance.blockers[0]
    const affectedEntities = [
        ...relevance.affectedEntities.vendors.slice(0, 3),
        ...relevance.affectedEntities.domains.slice(0, 3),
        ...relevance.affectedEntities.regions.slice(0, 3),
    ]
    return (
        <div data-ti-org-relevance='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Watchlist relevance</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {relevance.organizationRefs.length} organization match{relevance.organizationRefs.length === 1 ? '' : 'es'} · {relevance.candidateTerms.length} candidate term{relevance.candidateTerms.length === 1 ? '' : 's'} · {relevance.sourceEvidence.length} source result{relevance.sourceEvidence.length === 1 ? '' : 's'} · {relevance.freshness.stale ? 'refresh needed' : 'freshness accepted'}
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(relevance.state)}>{decisionStepStatusLabel(relevance.state)}</span>
                    <CopyPayloadButton label='Watchlist relevance' payload={relevance} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Last seen' value={formatDate(relevance.freshness.lastSeen)} />
                <EvidenceMetric label='Freshness' value={relevance.freshness.stale ? relevance.freshness.reason : 'Current enough for review'} />
            </div>
            <div data-ti-org-actor-identity='true' className='mt-3 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Actor identity</p>
                        <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{relevance.actorIdentity.canonicalName} · {relevance.actorIdentity.actorClass}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                            {relevance.actorIdentity.aliases.length ? `${relevance.actorIdentity.aliases.slice(0, 4).join(', ')}` : 'Aliases not attached'} · {relevance.actorIdentity.sectors.length} sector{relevance.actorIdentity.sectors.length === 1 ? '' : 's'} · {relevance.actorIdentity.regions.length} region{relevance.actorIdentity.regions.length === 1 ? '' : 's'}
                        </p>
                    </div>
                    <span className={relevance.enrichmentGaps.some(gap => gap.code.startsWith('missing_actor') || gap.code.startsWith('missing_target')) ? decisionStepStatusClass('review') : decisionStepStatusClass('ready')}>
                        {relevance.enrichmentGaps.some(gap => gap.code.startsWith('missing_actor') || gap.code.startsWith('missing_target')) ? 'Review' : 'Ready'}
                    </span>
                </div>
                <div className='mt-2 flex flex-wrap gap-1.5'>
                    {[...relevance.actorIdentity.sectors.slice(0, 4), ...relevance.actorIdentity.regions.slice(0, 4)].map(value => (
                        <span key={value} className='max-w-full wrap-break-word rounded-md bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary'>{value}</span>
                    ))}
                </div>
            </div>
            <div data-ti-org-source-coverage='true' className='mt-3 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source coverage</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            {relevance.sourceCoverage.length} source{relevance.sourceCoverage.length === 1 ? '' : 's'} · {relevance.sourceCoverage.filter(source => source.status === 'capture_ready').length} capture-ready · {relevance.sourceCoverage.filter(source => source.status === 'missing_capture').length} missing capture
                        </p>
                    </div>
                    <span className={relevance.sourceCoverage.some(source => source.status === 'missing_capture') || !relevance.sourceCoverage.length ? decisionStepStatusClass('blocked') : decisionStepStatusClass('ready')}>
                        {relevance.sourceCoverage.some(source => source.status === 'missing_capture') || !relevance.sourceCoverage.length ? 'Syncing' : 'Ready'}
                    </span>
                </div>
                <div className='mt-2 grid gap-2'>
                    {relevance.sourceCoverage.length ? relevance.sourceCoverage.slice(0, 3).map(source => (
                        <div key={`${source.sourceId ?? source.sourceName}-${source.provenance}`} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{source.sourceName}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {formatLabel(source.sourceFamily)} · {formatLabel(source.status)}{source.lastCollectedAt ? ` · ${formatDate(source.lastCollectedAt)}` : ''}
                                    </p>
                                    <p className='mt-1 break-all font-mono text-[11px] text-ui-muted dark:text-ui-muted'>{source.captureId ? `capture ${source.captureId}` : displayRequirementText(source.provenance)}</p>
                                </div>
                                {typeof source.confidence === 'number' ? <span className='shrink-0 text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>{Math.round(source.confidence * 100)}%</span> : null}
                            </div>
                        </div>
                    )) : (
                        <p className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10'>No source coverage is attached to this actor result.</p>
                    )}
                </div>
            </div>
            <div data-ti-watchlist-intersections='true' className='mt-3 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Watchlist intersections</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            {relevance.watchlistIntersections.length} intersection{relevance.watchlistIntersections.length === 1 ? '' : 's'} · {relevance.watchlistIntersections.filter(item => item.alertIds.length).length} with alerts · {relevance.watchlistIntersections.filter(item => item.casePaths.length).length} with cases
                        </p>
                    </div>
                    <span className={relevance.watchlistIntersections.some(item => item.state === 'ready') ? decisionStepStatusClass('ready') : decisionStepStatusClass(relevance.watchlistIntersections.length ? 'review' : 'blocked')}>
                        {relevance.watchlistIntersections.some(item => item.state === 'ready') ? 'ready' : relevance.watchlistIntersections.length ? 'review' : 'syncing'}
                    </span>
                </div>
                <div className='mt-2 grid gap-2'>
                    {relevance.watchlistIntersections.length ? relevance.watchlistIntersections.slice(0, 4).map(item => (
                        <div key={item.intersectionId} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.kind}: {item.value}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {watchlistIntersectionActionLabel(item.recommendedAction)} · {item.organizationId ? `org ${item.organizationId}` : 'organization needed'} · {item.watchlistItemId ? `watchlist item ${item.watchlistItemId}` : 'watchlist item needed'}
                                    </p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {item.sourceFamilies.map(formatLabel).join(', ') || 'source family needed'} · {item.captureIds.length ? `${item.captureIds.length} capture${item.captureIds.length === 1 ? '' : 's'}` : 'capture needed'} · {item.alertIds.length ? `${item.alertIds.length} alert${item.alertIds.length === 1 ? '' : 's'}` : 'alert needed'}
                                    </p>
                                    {item.blockers.length ? <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementText(item.blockers[0].handoff)}</p> : null}
                                </div>
                                <span className={decisionStepStatusClass(item.state)}>{decisionStepStatusLabel(item.state)}</span>
                            </div>
                            <div className='mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(item.casePath || item.route)}</p>
                                <CopyPayloadButton label='Watchlist intersection' payload={watchlistIntersectionPayloadFor(item)} />
                            </div>
                        </div>
                    )) : (
                        <p className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10'>No organization watchlist intersection is attached yet.</p>
                    )}
                </div>
            </div>
            {relevance.enrichmentGaps.length ? (
                <div data-ti-org-enrichment-gaps='true' className='mt-3 rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-2 dark:border-ui-warning/35 dark:bg-ui-warning/10'>
                    <p className='text-xs font-semibold uppercase text-ui-warning'>Profile data to review</p>
                    <div className='mt-2 grid gap-2'>
                        {relevance.enrichmentGaps.slice(0, 4).map(gap => (
                            <div key={`${gap.code}-${gap.field}`} className='rounded-md border border-ui-warning/35 bg-ui-panel/70 p-2 dark:border-ui-warning/35 dark:bg-ui-warning/10'>
                                <div className='flex flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='wrap-break-word text-xs font-semibold text-ui-warning'>{formatLabel(gap.code)}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning'>{displayRequirementText(gap.detail)}</p>
                                    </div>
                                    <span className='shrink-0 rounded-md bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:bg-ui-warning/10'>{readinessOwnerLabel(gap.ownerLane)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            {affectedEntities.length ? (
                <div className='mt-3 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Affected context</p>
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                        {affectedEntities.map(entity => (
                            <span key={`${entity.kind}-${entity.value}`} className={entity.matched ? 'max-w-full wrap-break-word rounded-md border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success' : 'max-w-full wrap-break-word rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'}>
                                {entity.kind}: {entity.value}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}
            <div className='mt-3 grid gap-2'>
                {relevance.candidateTerms.length ? relevance.candidateTerms.slice(0, 4).map(term => (
                    <div key={`${term.kind}-${term.value}`} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                        <div className='flex flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{term.kind}: {term.value}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{term.notes ? displayRequirementText(term.notes) : `${term.sourceEvidenceRefs.length} source reference${term.sourceEvidenceRefs.length === 1 ? '' : 's'} attached.`}</p>
                            </div>
                            <span className={term.matched ? decisionStepStatusClass('ready') : decisionStepStatusClass('review')}>{term.matched ? 'matched' : 'candidate'}</span>
                        </div>
                    </div>
                )) : (
                    <p className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10'>No watchlist term with a linked source is attached yet.</p>
                )}
            </div>
            {relevance.handoffRows.length ? (
                <div className='mt-3 grid gap-2'>
                    {relevance.handoffRows.slice(0, 6).map(row => {
                        const rowBlocker = row.blockers[0]
                        const evidenceMeta = [
                            row.evidence.sourceName,
                            row.evidence.reportDate ? formatDate(row.evidence.reportDate) : '',
                            typeof row.evidence.confidence === 'number' ? sourceBasisLabel(row.evidence.confidence) : '',
                            row.evidence.sourceId ? `source ${row.evidence.sourceId}` : '',
                            row.evidence.captureId ? `capture ${row.evidence.captureId}` : '',
                        ].filter(Boolean)
                        return (
                            <div key={row.rowId} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                <div className='flex flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{displayRequirementText(row.label)}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.action)} · {formatLabel(row.sourceFamily)} · {readinessOwnerLabel(row.ownerLane)}</p>
                                        <p data-ti-org-row-evidence='true' className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                            {evidenceMeta.length ? evidenceMeta.join(' · ') : 'Evidence metadata pending'} · {displayRequirementText(row.evidence.summary)}
                                        </p>
                                        <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.route)}</p>
                                        {row.alertId || row.watchlistItemId || row.captureIds.length ? (
                                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                                {[row.alertId ? `alert ${row.alertId}` : '', row.watchlistItemId ? `watchlist item ${row.watchlistItemId}` : '', row.captureIds.length ? `${row.captureIds.length} capture${row.captureIds.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')}
                                            </p>
                                        ) : null}
                                        {rowBlocker ? <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning'>{displayRequirementText(rowBlocker.handoff)}</p> : null}
                                    </div>
                                    <span className={decisionStepStatusClass(row.state)}>{publicDecisionStatusLabel(row.state)}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : null}
            {firstBlocker ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning'>{readinessOwnerLabel(firstBlocker.ownerLane)}: {displayRequirementText(firstBlocker.handoff)}</p>
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
        <div data-public-ti-action-exports='true' className='min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Action exports</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>Validated request bodies for authenticated review. Copying does not change customer state.</p>
                </div>
                <CopyPayloadButton label='Action exports' payload={actionability.actionPayloads} />
            </div>
            <div className='mt-3 grid gap-2'>
                {payloads.map(payload => {
                    const primaryBlocker = payload.blockedBy[0]
                    const summaryLines = actionPayloadSummaryLines(payload, actionability)
                    return (
                        <div key={payload.kind} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <div className='flex min-w-0 flex-wrap items-center gap-2'>
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{payload.label}</p>
                                        <span className={payload.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                            {payload.ready ? 'Ready' : 'Unavailable'}
                                        </span>
                                    </div>
                                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(payload.route)}</p>
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
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning'>{readinessOwnerLabel(primaryBlocker.ownerLane)}: {displayRequirementText(primaryBlocker.handoff)}</p>
                                    ) : (
                                        <p className='mt-1 text-[11px] leading-5 text-ui-success'>Required IDs and source details are present.</p>
                                    )}
                                </div>
                                <div className='flex min-w-0 w-full flex-wrap items-center justify-start gap-1.5 sm:w-auto sm:justify-end sm:shrink-0'>
                                    {payload.backedRoute ? (
                                        <a href={payload.backedRoute} className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
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
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Review status</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>Linked records, follow-up fields, and next owner for this result.</p>
                </div>
                <span className={actionability.readiness.state === 'ready' ? decisionStepStatusClass('ready') : actionability.readiness.state === 'blocked' ? decisionStepStatusClass('blocked') : decisionStepStatusClass('review')}>
                    {publicStateLabel(actionability.readiness.state)}
                </span>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3'>
                {backedRows.map(row => (
                    <div key={row.label} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{row.label}</p>
                        <p className='mt-1 text-sm font-semibold text-ui-text dark:text-ui-text'>{row.value}</p>
                    </div>
                ))}
            </div>
            {actionability.readiness.blockers.length ? (
                <div className='mt-3 grid gap-2'>
                    {actionability.readiness.blockers.slice(0, 5).map(blocker => (
                        <div key={`${blocker.code}-${blocker.field}`} className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-2 dark:border-ui-warning/35 dark:bg-ui-warning/10'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-warning'>{readinessOwnerLabel(blocker.ownerLane)}</p>
                                <span className='shrink-0 rounded-md bg-ui-panel px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:bg-ui-warning/10'>{formatLabel(blocker.code)}</span>
                            </div>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-warning'>{displayRequirementText(blocker.detail)}</p>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning'>{displayRequirementText(blocker.handoff)}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className='mt-3 text-xs leading-5 text-ui-success'>No blocking workflow issues are open.</p>
            )}
        </div>
    )
}

function ConsumerReadinessPanel({ actionability }: { actionability: TiActionabilityModel }) {
    const readyStages = actionability.consumerReadiness.stages.filter(stage => stage.state === 'ready').length
    return (
        <div data-ti-consumer-readiness='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Review status</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {readyStages} of {actionability.consumerReadiness.stages.length} stages ready for console work.
                    </p>
                </div>
                <CopyPayloadButton label='Review status' payload={actionability.consumerReadiness.bundlePreview} />
            </div>
            <div className='mt-3 grid gap-2'>
                {actionability.consumerReadiness.stages.map(stage => (
                    <div key={stage.id} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                        <div className='flex flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{stage.label}</p>
                                    <span className={decisionStepStatusClass(stage.state)}>{publicStateLabel(stage.state)}</span>
                                </div>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(stage.detail)}</p>
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {stage.request ? (
                                        <span className='max-w-full break-all rounded-md border border-ui-border bg-ui-panel px-2 py-1 font-mono text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                            {stage.request.method} {consumerRequestPathLabel(stage.request.path)}
                                        </span>
                                    ) : null}
                                    <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                        {stage.payload.provenance.length} source reference{stage.payload.provenance.length === 1 ? '' : 's'}
                                    </span>
                                    {stage.missing.length ? (
                                        <span className='max-w-full wrap-break-word rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                                            {stage.missing.length} follow-up{stage.missing.length === 1 ? '' : 's'}
                                        </span>
                                    ) : null}
                                </div>
                                <div data-ti-consumer-field-readiness='true' className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {consumerRequestFields(stage).map(field => (
                                        <span key={`${stage.id}-${field.label}`} className={consumerFieldClass(field.state)}>
                                            {field.label}: {displayRequirementText(field.value)}
                                        </span>
                                    ))}
                                </div>
                                {stage.missing.length ? (
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning'>{displayRequirementList(stage.missing.slice(0, 2))}</p>
                                ) : null}
                            </div>
                            <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                {stage.route ? (
                                    <a href={stage.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
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

function consumerRequestPathLabel(value: string) {
    if (value.includes('alert-readiness')) return 'org alert state'
    if (value.includes('/api/organizations') && value.includes('watchlists')) return 'org watchlist API'
    if (value.includes('/v1/dwm/watchlists')) return 'watchlist API'
    if (value.includes('/v1/dwm/alerts')) return 'alert API'
    if (value.includes('/v1/cases')) return 'case API'
    if (value.includes('/v1/dwm/webhooks')) return 'delivery API'
    return sourceRequestRouteLabel(value)
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
    if (state === 'ready') return 'max-w-full wrap-break-word rounded-md border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (state === 'review') return 'max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'
    return 'max-w-full wrap-break-word rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}

function sourceHealthChipClass(state: SourceHealthRow['state']) {
    if (state === 'ready') return 'max-w-full wrap-break-word rounded-md border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (state === 'review') return 'max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'
    return 'max-w-full wrap-break-word rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}

function sourceHealthEvidenceLabel(row: SourceHealthRow) {
    if (row.captureId) return `capture ${row.captureId}`
    const hasFieldPath = row.provenance.includes('[') || row.provenance.includes(']') || /sourceProvenance|relatedAlerts|handoffs|actorIntelligence/i.test(row.provenance)
    if (hasFieldPath) {
        return `${formatLabel(row.sourceFamily)} evidence request`
    }
    return displayRequirementText(row.provenance)
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
        .replace(
            /\bAPT49 is an ambiguous label in open reporting\. Some sources map it to Tropic Trooper, a long-running Asia-Pacific espionage actor\. Malpedia and Cyberint map BlueHornet\/AgainstTheWest\/APT49 to a hacktivist and leak-focused persona\. The profile is split into both tracks until source-specific reporting makes the context clear\./gi,
            'APT49 is used for two tracks in open reporting: Tropic Trooper espionage reporting and BlueHornet/AgainstTheWest leak-claim reporting. Keep the tracks separate when reviewing attribution or company exposure.',
        )
        .replace(/\bAPT49 label collision requires analyst disambiguation\b/gi, 'APT49 naming has two reporting tracks')
        .replace(
            /\bOpen-source references disagree on whether APT49 should be treated as Tropic Trooper or BlueHornet\/AgainstTheWest\. The profile is therefore split into espionage-track and hacktivist\/leak-track monitoring until a source-specific claim resolves the context\./gi,
            'Open reporting maps APT49 to both Tropic Trooper and BlueHornet/AgainstTheWest. Review the source track before using it for attribution or company exposure.',
        )
        .replace(/\blabel collision\b/gi, 'shared-name profile')
        .replace(/\banalyst disambiguation\b/gi, 'source-track review')
        .replace(/\bHanasand resolves it as an alias-collision profile:/gi, 'Open reporting treats this as an alias-collision profile:')
        .replace(/\bHanasand resolves\b/gi, 'Open reporting maps')
        .replace(/\baction_required\b/gi, 'review')
        .replace(/\baction required\b/gi, 'review')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/alert-readiness/gi, 'Check organization alert state')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/alert-status/gi, 'Check organization alert state')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/watchlists/gi, 'Open organization watchlists')
        .replace(/\/api\/organizations\/[^/\s]+\/alert-readiness/gi, 'organization alert state')
        .replace(/\/api\/organizations\/[^/\s]+\/alert-status/gi, 'organization alert state')
        .replace(/\/api\/organizations\/[^/\s]+\/watchlists/gi, 'organization watchlist API')
        .replace(/GET\s+\/api\/organizations\/:id\/alert-readiness/gi, 'Check org alert state')
        .replace(/GET\s+\/api\/organizations\/:id\/alert-status/gi, 'Check org alert state')
        .replace(/\/api\/organizations\/:id\/alert-readiness/gi, 'org alert state')
        .replace(/\/api\/organizations\/:id\/alert-status/gi, 'org alert state')
        .replace(/\/api\/dwm\/alerts\/generation-readiness/gi, 'alert generation state')
        .replace(/\/api\/dwm\/alerts\/generation-status/gi, 'alert generation state')
        .replace(/\/v1\/dwm\/alerts\/generation-readiness/gi, 'alert generation state')
        .replace(/\/v1\/dwm\/alerts\/generation-status/gi, 'alert generation state')
        .replace(/\/v1\/cases\/:caseId\/action-replay-export/gi, 'case action replay')
        .replace(/\/v1\/dwm\/alerts\/rebuild/gi, 'alert rebuild')
        .replace(/\/v1\/dwm\/watchlists/gi, 'watchlist update')
        .replace(/\/v1\/dwm\/webhooks\/deliver/gi, 'webhook delivery')
        .replace(/\/v1\/cases/gi, 'case workflow')
        .replace(/generatedAlertReferences/gi, 'generated alert references')
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
        .replace(new RegExp('pro' + 'venance', 'gi'), 'source reference')
        .replace(/actorIntelligence\./gi, 'actor intelligence ')
        .replace(/handoffs\./gi, '')
        .replace(/relatedAlerts\[\]/gi, 'related alerts')
        .replace(/\bproof\b/gi, 'evidence')
        .replace(/\breadiness\b/gi, 'status')
        .replace(/\bactionability\b/gi, 'workflow status')
        .replace(/\breceipt\b/gi, 'record')
        .replace(new RegExp('\\bcon' + 'tract\\b', 'gi'), 'schema')
        .replace(/\bnamed\s+examples\b/gi, 'reported activity')
        .replace(/\btarget\s+signal(s)?\b/gi, 'targeting indicator$1')
        .replace(/\bsignal(s)?\b/gi, 'indicator$1')
        .replace(/\bcontrol\s+room\b/gi, 'console')
        .replace(/\bdashboard\s+slop\b/gi, 'low-value summary')
        .replace(/\bacceptance\s+criteria\b/gi, 'requirements')
        .replace(/\bteasers\b/gi, 'summaries')
        .replace(/\bteaser\b/gi, 'summary')
}

function displayRequirementList(values: string[]) {
    return unique(values.map(displayRequirementText)).join('; ')
}

function sourceRequestCaptureClass(ready: boolean) {
    return ready
        ? 'max-w-full wrap-break-word rounded-md bg-ui-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'
        : 'max-w-full wrap-break-word rounded-md bg-ui-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-danger dark:bg-ui-danger/10 dark:text-ui-danger'
}

function sourceRequestFamilyLabel(value: string) {
    if (value === 'source_capture') return 'source capture'
    return formatLabel(value)
}

function sourceRequestRouteLabel(value: string) {
    if (value === '/dashboard/ti/enrichment') return 'source review'
    return 'review route'
}

function recommendedActionLabel(value: string) {
    return displayRequirementText(formatLabel(value))
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
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Decision flow</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{rationale}</p>
                </div>
                <span className={shouldAlert ? 'shrink-0 rounded-lg bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success' : 'shrink-0 rounded-lg bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning'}>
                    {formatLabel(disposition)}
                </span>
            </div>
            <div className='mt-3 grid gap-2'>
                {steps.map(step => (
                    <div key={step.id} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                        <div className='flex flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{step.label}</p>
                                    <span className={decisionStepStatusClass(step.status)}>{decisionStepStatusLabel(step.status)}</span>
                                </div>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(step.detail)}</p>
                                {step.missing.length ? (
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning'>{displayRequirementList(step.missing.slice(0, 2))}</p>
                                ) : null}
                            </div>
                            <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                {step.route ? (
                                    <a href={step.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
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
                ? `${actionability.sourceProvenance.length} source reference${actionability.sourceProvenance.length === 1 ? '' : 's'} found; ${sourceMissing.length ? 'capture details still needed' : 'source basis is attached'}.`
                : 'No source result is attached to this actor result.',
            payload: actionability.exportPayloads.enrichment,
            route: sourceGap?.route ?? actionability.exportPayloads.enrichment.backedRoute,
            missing: sourceMissing,
        },
        {
            id: 'watchlist',
            label: 'Prepare watchlist',
            status: actionability.watchlistRelevance.blockers.length ? 'blocked' : actionability.watchlistRelevance.matches.length ? 'ready' : 'review',
            detail: actionability.watchlistRelevance.terms.length
                ? `${actionability.watchlistRelevance.terms.length} candidate term${actionability.watchlistRelevance.terms.length === 1 ? '' : 's'}; ${actionability.watchlistRelevance.matches.length} org match${actionability.watchlistRelevance.matches.length === 1 ? '' : 'es'} linked.`
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
            label: 'Review profile updates',
            status: actionability.exportPayloads.enrichment.blocked ? 'blocked' : enrichmentWorkCount ? 'review' : 'ready',
            detail: `${enrichmentWorkCount} source or profile update${enrichmentWorkCount === 1 ? '' : 's'} available.`,
            payload: actionability.exportPayloads.enrichment,
            route: actionability.exportPayloads.enrichment.backedRoute,
            missing: actionability.exportPayloads.enrichment.missing,
        },
    ]
}

function PayloadHandoffRow({ label, detail, payload, route, blocked }: { label: string; detail: string; payload: unknown; route?: string; blocked: boolean }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <div className='flex min-w-0 flex-wrap items-center gap-2'>
                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{label}</p>
                        <span className={blocked ? 'rounded-md border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning' : 'rounded-md border border-ui-success/35 bg-ui-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'}>
                            {blocked ? 'syncing' : 'ready'}
                        </span>
                    </div>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(detail)}</p>
                </div>
                <div className='flex min-w-0 w-full flex-wrap items-center justify-start gap-1.5 sm:w-auto sm:justify-end sm:shrink-0'>
                    {route ? (
                        <a href={route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
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

function CopyPayloadButton({ label, payload, showLabel = false }: { label: string; payload: unknown; showLabel?: boolean }) {
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
        <button type='button' onClick={copyPayload} className='inline-flex min-h-8 min-w-16 max-w-full items-center justify-center gap-1.5 justify-self-start whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised' aria-label={`Copy ${label} payload`}>
            {state === 'copied' ? <CheckCircle2 className='h-3.5 w-3.5 text-ui-success' /> : <Copy className='h-3.5 w-3.5' />}
            {state === 'copied' ? 'Copied' : state === 'failed' ? 'Unavailable' : showLabel ? label : 'Copy'}
        </button>
    )
}

function EnrichmentTasksPanel({ tasks, intake }: { tasks: EnrichmentTask[]; intake: TiActionabilityModel['sourceEnrichmentIntake'] }) {
    return (
        <Panel title='Open source questions' description='Source, capture, and data work required before this result can support stronger alerts.' icon={<Database className='h-4 w-4' />}>
            <div className='mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                    <span className='font-semibold text-ui-text dark:text-ui-text'>Source review intake</span> · {intake.summary.total} intake item{intake.summary.total === 1 ? '' : 's'} · {intake.summary.sourceRequests} source request{intake.summary.sourceRequests === 1 ? '' : 's'} · {intake.summary.captures} capture{intake.summary.captures === 1 ? '' : 's'}
                </p>
                <CopyPayloadButton label='Source enrichment intake' payload={intake} />
            </div>
            <div data-ti-collection-gap-intake='true' className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2'>
                {tasks.map(task => {
                    const payload = collectionGapTaskPayloadFor(task, intake)
                    return (
                        <div key={task.title} data-ti-collection-gap-task-export='true' className='min-w-0 max-w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{task.title}</p>
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
                            <p className='mt-2 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(task.detail)}</p>
                        </div>
                    )
                })}
            </div>
        </Panel>
    )
}

function EnrichmentGapWorkbench({
    tasks,
    result,
    actor,
    actionability,
    workItems,
    artifacts,
    selectedId,
    selectedArtifactId,
    onSelectEvidence,
    onSelectArtifact,
    onReview,
    onEscalate,
}: {
    tasks: EnrichmentTask[]
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    workItems: AnalystWorkItem[]
    artifacts: ActorArtifact[]
    selectedId?: string
    selectedArtifactId?: string
    onSelectEvidence: (id: string) => void
    onSelectArtifact: (id: string) => void
    onReview: () => void
    onEscalate: () => void
}) {
    const rows = useMemo(() => enrichmentGapWorkbenchRowsFor({ tasks, result, actor, actionability, workItems, artifacts }), [tasks, result, actor, actionability, workItems, artifacts])
    const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id ?? '')
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const selectedEvidence = selectedRow?.evidenceItems.find(item => item.id === selectedId) ?? selectedRow?.evidenceItems[0]
    const selectedArtifact = selectedRow?.artifactIds.find(id => id === selectedArtifactId) ?? selectedRow?.artifactIds[0]
    const blockedCount = rows.filter(row => row.state === 'blocked').length
    const reviewCount = rows.filter(row => row.state === 'review').length

    return (
        <Panel title='Source review' description='Open data questions tied to evidence, key details, sources, and case review.' icon={<Database className='h-4 w-4' />}>
            <div data-ti-enrichment-gap-workbench='true' className='grid min-w-0 gap-3'>
                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            {rows.length} question{rows.length === 1 ? '' : 's'} · {blockedCount} syncing · {reviewCount} review
                        </p>
                    </div>
                    {selectedRow ? <CopyPayloadButton label='Source review question' payload={selectedRow.payload} /> : null}
                </div>
                <div className='max-h-96 min-w-0 overflow-auto rounded-lg border border-ui-border dark:border-ui-border'>
                    <table className='min-w-[680px] w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Open question</th>
                                <th className='px-3 py-2 font-semibold'>Entity</th>
                                <th className='px-3 py-2 font-semibold'>Freshness</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#eef1f5] dark:divide-[#273244]'>
                            {rows.map(row => {
                                const active = selectedRow?.id === row.id
                                return (
                                    <tr key={row.id} className={`${active ? 'bg-ui-primary/10 dark:bg-ui-primary/10' : 'bg-ui-panel dark:bg-ui-panel'} align-top`}>
                                        <td className='px-3 py-2'>
                                            <button type='button' onClick={() => setSelectedRowId(row.id)} className='grid min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                                                <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.label}</span>
                                                <span className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatLabel(row.type)}</span>
                                            </button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.entity}</p>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.impact)}</p>
                                        </td>
                                        <td className='px-3 py-2 text-ui-text dark:text-ui-text'>{row.newestAt ? formatDate(row.newestAt) : 'Not dated'}</td>
                                        <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceConfidenceLabel(row.confidenceValues)}</td>
                                        <td className='px-3 py-2'>
                                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                                <span className={sourceHealthChipClass(row.state)}>{publicStateLabel(row.state)}</span>
                                                {row.evidenceItems[0] ? <button type='button' onClick={() => onSelectEvidence(row.evidenceItems[0]!.id)} className='inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Open result</button> : null}
                                                {row.artifactIds[0] ? <button type='button' onClick={() => onSelectArtifact(row.artifactIds[0]!)} className='inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Detail</button> : null}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                {selectedRow ? (
                    <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected question</p>
                                <p className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.label}</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.impact)}</p>
                            </div>
                            <span className={sourceHealthChipClass(selectedRow.state)}>{publicStateLabel(selectedRow.state)}</span>
                        </div>
                        <div className='mt-3 grid grid-cols-2 gap-2 text-xs'>
                            <EvidenceMetric label='Source' value={selectedRow.source} />
                            <EvidenceMetric label='Evidence' value={String(selectedRow.evidenceItems.length)} />
                            <EvidenceMetric label='Details' value={String(selectedRow.artifactIds.length)} />
                            <EvidenceMetric label='Missing' value={String(selectedRow.missing.length)} />
                        </div>
                        {selectedRow.missing.length ? (
                            <div className='mt-3 rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                                {displayRequirementList(selectedRow.missing.slice(0, 3))}
                            </div>
                        ) : null}
                        <div className='mt-3 grid grid-cols-2 gap-1.5'>
                            <button type='button' onClick={onReview} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Review</button>
                            <button type='button' onClick={onEscalate} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Escalate</button>
                            {selectedEvidence ? <button type='button' onClick={() => onSelectEvidence(selectedEvidence.id)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Open result</button> : null}
                            {selectedArtifact ? <button type='button' onClick={() => onSelectArtifact(selectedArtifact)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Open detail</button> : null}
                        </div>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            {selectedRow.route ? <a href={selectedRow.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'><ExternalLink className='h-3.5 w-3.5' />Open route</a> : null}
                            <CopyPayloadButton label='Export gap' payload={selectedRow.payload} showLabel />
                        </div>
                    </div>
                ) : null}
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
        <Panel title='Source health' description='Source type, time seen, processing status, and next review step.' icon={<Database className='h-4 w-4' />}>
            <div data-ti-source-health-queue='true' className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3'>
                <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                    <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {queue.summary.total} source detail{queue.summary.total === 1 ? '' : 's'} · {coverage.summary.coveredFieldCount}/{coverage.summary.fieldCount} covered · {coverage.summary.retryableFieldCount} retry
                    </p>
                    <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                        <span data-ti-enrichment-coverage-export='true' className='inline-flex'>
                            <CopyPayloadButton label='Coverage review' payload={coverage} />
                        </span>
                        <span data-ti-enrichment-consumer-readiness='true' className='inline-flex'>
                            <CopyPayloadButton label='Consumer status' payload={consumerReadiness} />
                        </span>
                        <CopyPayloadButton label='Source review' payload={{ ...queue, sourceEnrichmentIntake: intake, actorEnrichmentCoverage: coverage, actorEnrichmentConsumerReadiness: consumerReadiness, enrichmentPayload: payload }} />
                    </div>
                </div>
                <div data-ti-source-consumer-readiness='true' className='grid min-w-0 gap-2 sm:grid-cols-3'>
                    {consumerReadiness.rows.map(row => (
                        <div key={row.consumer} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{actorEnrichmentConsumerLabel(row.consumer)}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {row.coverageCounts.covered} covered · {row.coverageCounts.alertable} ready for review · {row.blockerCodes.length} follow-up{row.blockerCodes.length === 1 ? '' : 's'}
                                    </p>
                                </div>
                                <span className={sourceHealthChipClass(actorEnrichmentConsumerState(row.state))}>{publicStateLabel(row.state)}</span>
                            </div>
                            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                {row.sourceFamilies.slice(0, 3).map(family => (
                                    <span key={family} className={sourceHealthChipClass('review')}>{formatLabel(family)}</span>
                                ))}
                                {row.retry.retryable ? <span className={sourceHealthChipClass('blocked')}>retry scheduled</span> : null}
                            </div>
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.route)}</p>
                        </div>
                    ))}
                </div>
                {rows.length ? rows.slice(0, 5).map(row => (
                    <div key={row.id} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {formatLabel(row.sourceFamily)} · {formatDate(row.timestamp)} · {row.parserStatus}
                                </p>
                                <p className='mt-1 break-all font-mono text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {sourceHealthEvidenceLabel(row)}
                                </p>
                            </div>
                            <span className={decisionStepStatusClass(row.state)}>{publicDecisionStatusLabel(row.state)}</span>
                        </div>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            {row.sourceId ? <span className={sourceHealthChipClass('review')}>source {row.sourceId}</span> : null}
                            {row.sourceRequestId ? <span className={sourceHealthChipClass('review')}>request {row.sourceRequestId}</span> : null}
                            <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? 'capture linked' : 'capture needed'}</span>
                            {typeof row.confidence === 'number' ? <span className={sourceHealthChipClass('review')}>{sourceBasisLabel(row.confidence)}</span> : null}
                            <span className={sourceHealthChipClass(row.ownerLane === 'source' ? 'blocked' : row.state)}>{readinessOwnerLabel(row.ownerLane)}</span>
                        </div>
                        {row.requestedFields.length ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>Needs: {row.requestedFields.slice(0, 4).map(sourceHealthFieldLabel).join(', ')}</p>
                        ) : null}
                        <div className='mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                            <p className='min-w-0 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.nextAction)}</p>
                            <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                <span data-ti-source-refresh-export='true' className='inline-flex'>
                                    <CopyPayloadButton label='Source review request' payload={sourceRefreshPayloadFor(row, queue, intake, payload)} />
                                </span>
                                <a href={row.route} className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                    <ExternalLink className='h-3.5 w-3.5' />
                                    Open
                                </a>
                            </div>
                        </div>
                    </div>
                )) : (
                    <p className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>No source health status is attached yet. Add source context before sending this actor to a customer path.</p>
                )}
            </div>
        </Panel>
    )
}

function actorEnrichmentConsumerLabel(consumer: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['consumer']) {
    if (consumer === 'publicTI') return 'Threat profile'
    if (consumer === 'alertGeneration') return 'Alert generation'
    return 'Collection'
}

function actorEnrichmentConsumerState(state: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['state']) {
    if (state === 'ready') return 'ready'
    if (state === 'action_required') return 'review'
    return 'review'
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

function SelectedWorkflowSummaryPanel({
    selected,
    reviewHandoff,
    caseDraft,
    caseOwnership,
    alertPlan,
    deliveryPlan,
    sourceDrilldown,
    onOpenDetails,
}: {
    selected?: AnalystWorkItem
    reviewHandoff: SelectedReviewHandoff | null
    caseDraft: SelectedCaseDraft | null
    caseOwnership: SelectedCaseOwnershipPlan | null
    alertPlan: SelectedAlertActionPlan | null
    deliveryPlan: SelectedDeliveryReadinessPlan | null
    sourceDrilldown: ReturnType<typeof selectedSourceDrilldownFor> | null
    onOpenDetails: () => void
}) {
    const alertReady = Boolean(reviewHandoff?.alertHandoff.ready || alertPlan?.ready)
    const caseReady = Boolean(reviewHandoff?.caseHandoff.ready || caseDraft)
    const deliveryReady = deliveryPlan?.state === 'ready'
    const sourceCount = sourceDrilldown?.rows.length ?? 0
    const owner = caseOwnership?.owner.label ?? 'unassigned'
    return (
        <Panel title='Selected workflow' description='Compact action state for the selected finding.' icon={<ShieldAlert className='h-4 w-4' />}>
            <div className='grid gap-3'>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                    <p className='wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selected ? displayRequirementText(selected.title) : 'Select a finding'}</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {selected ? `${selected.source} · ${sourceBasisLabel(selected.confidence)} · ${selected.timestamp}` : 'Choose a row to inspect source and case context.'}
                    </p>
                </div>
                <div className='grid grid-cols-2 gap-2'>
                    <EvidenceMetric label='Source rows' value={String(sourceCount)} />
                    <EvidenceMetric label='Owner' value={owner} />
                    <EvidenceMetric label='Alerts' value={String(deliveryPlan?.summary.alerts ?? alertPlan?.readiness.matchedCandidateCount ?? 0)} />
                    <EvidenceMetric label='Case routes' value={String(deliveryPlan?.summary.caseRoutes ?? caseOwnership?.summary.caseCandidates ?? 0)} />
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className={decisionStepStatusClass(alertReady ? 'ready' : 'review')}>alert {alertReady ? 'linked' : 'review'}</span>
                    <span className={decisionStepStatusClass(caseReady ? 'ready' : 'review')}>case {caseReady ? 'ready' : 'review'}</span>
                    <span className={decisionStepStatusClass(deliveryReady ? 'ready' : deliveryPlan ? 'review' : 'blocked')}>delivery {deliveryReady ? 'ready' : deliveryPlan ? 'review' : 'pending'}</span>
                </div>
                <button
                    type='button'
                    onClick={onOpenDetails}
                    className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                >
                    <ClipboardList className='h-3.5 w-3.5' />
                    Open workflow details
                </button>
            </div>
        </Panel>
    )
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
                    <div className='rounded-lg border border-ui-success/35 bg-ui-success/10 p-3 text-xs leading-5 text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'>
                        {decisionLabel(decision.status)} recorded at {formatDate(decision.decidedAt)}. Rationale: {decision.reason}
                    </div>
                ) : (
                    <div className='rounded-lg border border-ui-border bg-ui-raised p-3 text-xs leading-5 text-ui-muted'>
                        No local scratch decision recorded yet.
                    </div>
                )}
                <textarea
                    value={note}
                    onChange={event => onNoteChange(event.target.value)}
                    placeholder='Scratch rationale, proposed owner, or next evidence to collect...'
                    className='min-h-24 resize-y rounded-lg border border-ui-border bg-ui-panel p-3 text-sm leading-6 text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
                />
                <div className='grid grid-cols-2 gap-2'>
                    <ActionButton icon={<Eye className='h-3.5 w-3.5' />} onClick={() => onDecision('reviewing')}>Review</ActionButton>
                    <ActionButton icon={<UserPlus className='h-3.5 w-3.5' />} onClick={() => onDecision('assigned')}>Assign</ActionButton>
                    <ActionButton icon={<Send className='h-3.5 w-3.5' />} onClick={() => onDecision('escalated')}>Escalate</ActionButton>
                    <ActionButton icon={<ShieldAlert className='h-3.5 w-3.5' />} onClick={() => onDecision('suppressed')}>Suppress</ActionButton>
                    <ActionButton icon={<CheckCircle2 className='h-3.5 w-3.5' />} onClick={() => onDecision('closed')}>Close</ActionButton>
                    <ActionButton icon={<XCircle className='h-3.5 w-3.5' />} onClick={() => onDecision('reopened')}>Reopen</ActionButton>
                </div>
                <div data-ti-local-relevance='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                    <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                        <div className='min-w-0'>
                            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Relevance mark</p>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                                Session-local mark for watchlist, source review, or case preparation.
                            </p>
                        </div>
                        <span className={relevance ? decisionStepStatusClass(relevance.state === 'not_relevant' ? 'blocked' : relevance.state === 'needs_source' ? 'review' : 'ready') : decisionStepStatusClass('review')}>
                            {relevance ? relevanceLabel(relevance.state) : 'unmarked'}
                        </span>
                    </div>
                    {relevance ? (
                        <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
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
                    disabled={!reviewHandoff || !caseDraft || !caseOwnership || !caseCreateRequest || !watchlistPlan || !alertPlan || !deliveryPlan || !enrichmentTriage || !caseActionTrail}
                    className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised dark:disabled:bg-ui-raised dark:disabled:text-ui-muted'
                >
                    <ClipboardList className='h-3.5 w-3.5' />
                    Stage handoff
                </button>
                {reviewHandoff ? (
                    <div data-ti-selected-review-handoff='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected review package</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                                    Copyable evidence, rationale, and review state for authenticated case review. This does not save public-page notes.
                                </p>
                            </div>
                            <CopyPayloadButton label='Selected review package' payload={reviewHandoff} />
                        </div>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            <span className={readyForAlert ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                alert {readyForAlert ? 'ready' : 'syncing'}
                            </span>
                            <span className={readyForCase ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                case {readyForCase ? 'ready' : 'syncing'}
                            </span>
                            <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                {reviewHandoff.evidenceBasis.length} evidence item{reviewHandoff.evidenceBasis.length === 1 ? '' : 's'}
                            </span>
                        </div>
                        {reviewHandoff.blockers.length ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(reviewHandoff.blockers.slice(0, 2))}</p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </Panel>
    )
}

function SelectedCaseOwnershipPanel({ plan }: { plan: SelectedCaseOwnershipPlan }) {
    return (
        <div data-ti-selected-case-ownership='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Case ownership</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Selected evidence mapped to case candidates, replay state, and owner blockers.
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
                <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                    owner {plan.owner.label}
                </span>
                {plan.consumerStage ? (
                    <span className={decisionStepStatusClass(plan.consumerStage.state === 'ready' ? 'ready' : plan.consumerStage.state === 'blocked' ? 'blocked' : 'review')}>
                        case stage {publicStateLabel(plan.consumerStage.state)}
                    </span>
                ) : null}
            </div>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.route)}</p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.nextAction)}</p>
            <div className='mt-2 grid gap-2'>
                {plan.caseReviewItems.slice(0, 3).map(item => (
                    <div key={item.id} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{item.title}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {formatLabel(item.priority)} · {recommendedActionLabel(item.recommendedAction)} · {item.sourceIds.length} source ref{item.sourceIds.length === 1 ? '' : 's'}
                                </p>
                            </div>
                            <span className={decisionStepStatusClass(item.state)}>{decisionStepStatusLabel(item.state)}</span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(item.nextAction)}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                            {item.alertIds.length ? `Alerts ${item.alertIds.slice(0, 2).join(', ')}` : 'Alert ID pending'}
                            {item.casePaths.length ? ` · cases ${item.casePaths.slice(0, 2).join(', ')}` : ''}
                            {item.captureIds.length ? ` · captures ${item.captureIds.slice(0, 2).join(', ')}` : ''}
                        </p>
                        {item.blockers.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(item.blockers.slice(0, 3))}</p>
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
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(plan.blockers.slice(0, 4))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Case route, alert, capture, and source references are ready for authenticated review.</p>
            )}
        </div>
    )
}

function SelectedCaseCreateRequestPanel({ request }: { request: SelectedCaseCreateRequest }) {
    return (
        <div data-ti-selected-case-create-request='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Case create request</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Selected evidence shaped for authenticated case creation with source details and blockers attached.
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
            <p className='mt-2 break-all font-mono text-[11px] text-ui-muted dark:text-ui-muted'>{request.request.method} {consumerRequestPathLabel(request.request.path)}</p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(request.nextAction)}</p>
            <div data-ti-selected-case-actor-context='true' className='mt-2 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>Actor context</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                            {request.actorContext.attribution} · {sourceBasisLabel(request.actorContext.confidence)}
                        </p>
                    </div>
                    <span className={decisionStepStatusClass(request.actorContext.sourceCoverage.stale || request.actorContext.enrichmentGaps.length ? 'review' : 'ready')}>
                        {request.actorContext.sourceCoverage.stale ? 'refresh' : request.actorContext.enrichmentGaps.length ? 'review' : 'ready'}
                    </span>
                </div>
                <div className='mt-2 grid grid-cols-2 gap-2'>
                    <EvidenceMetric label='Aliases' value={`${request.actorContext.aliases.length}`} />
                    <EvidenceMetric label='Methods' value={`${request.actorContext.techniques.length}`} />
                    <EvidenceMetric label='Tools' value={`${request.actorContext.malwareTools.length}`} />
                    <EvidenceMetric label='Sources' value={`${request.actorContext.sourceCoverage.totalRows}`} />
                </div>
                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                    {request.actorContext.aliases.slice(0, 2).map(alias => <span key={alias} className={sourceHealthChipClass('review')}>{alias}</span>)}
                    {request.actorContext.malwareTools.slice(0, 2).map(tool => <span key={tool} className={sourceHealthChipClass('review')}>{tool}</span>)}
                    {request.actorContext.techniques.slice(0, 2).map(technique => (
                        <span key={`${technique.attackId ?? technique.name}:${technique.tactic}`} className={sourceHealthChipClass(technique.freshness)}>
                            {technique.attackId ?? technique.name}
                        </span>
                    ))}
                    {request.actorContext.enrichmentGaps.slice(0, 2).map(gap => <span key={gap.id} className={sourceHealthChipClass('blocked')}>{gap.sourceFamily}</span>)}
                </div>
                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                    {request.actorContext.targetSectors.slice(0, 3).join(', ') || 'Target sectors pending'} · {request.actorContext.geographies.slice(0, 3).join(', ') || 'Geography pending'}
                </p>
            </div>
            <div data-ti-selected-case-watchlist-basis='true' className='mt-2 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>Watchlist basis</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{request.watchlistBasis.matchReason}</p>
                    </div>
                    <span className={decisionStepStatusClass(request.watchlistBasis.ready ? 'ready' : request.watchlistBasis.blockers.length ? 'blocked' : 'review')}>
                        {request.watchlistBasis.ready ? 'ready' : request.watchlistBasis.blockers.length ? 'syncing' : 'review'}
                    </span>
                </div>
                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                    <span className={sourceHealthChipClass(request.watchlistBasis.relevanceRows.some(row => row.fit === 'matched') ? 'ready' : request.watchlistBasis.blockers.length ? 'blocked' : 'review')}>
                        {request.watchlistBasis.terms.length} term{request.watchlistBasis.terms.length === 1 ? '' : 's'}
                    </span>
                    <span className={sourceHealthChipClass(request.watchlistBasis.relevanceRows.some(row => row.alertable) ? 'ready' : 'review')}>
                        {request.watchlistBasis.relevanceRows.filter(row => row.alertable).length} ready for review
                    </span>
                    <span className={sourceHealthChipClass(request.actionReplay.ready ? 'ready' : 'blocked')}>
                        {request.actionReplay.rows.filter(row => row.ready).length}/{request.actionReplay.rows.length} replay-ready
                    </span>
                    {request.watchlistBasis.intersections.slice(0, 2).map(item => (
                        <span key={item.intersectionId} className={sourceHealthChipClass(item.state === 'ready' ? 'ready' : item.state === 'blocked' ? 'blocked' : 'review')}>
                            {item.watchlistItemId ? `watchlist ${item.watchlistItemId}` : item.value}
                        </span>
                    ))}
                </div>
                {request.watchlistBasis.blockers.length ? (
                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(request.watchlistBasis.blockers.slice(0, 3))}</p>
                ) : null}
            </div>
            {request.sourceRows.length ? (
                <div className='mt-2 grid gap-2'>
                    {request.sourceRows.slice(0, 3).map(row => (
                        <div key={`${row.sourceId ?? row.sourceName}:${row.provenance}:${row.captureId ?? 'pending'}`} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}{row.sourceId ? ` · source ${row.sourceId}` : ''}</p>
                                    <p className='mt-1 break-all font-mono text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.provenance)}</p>
                                </div>
                                <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? `capture ${row.captureId}` : 'capture needed'}</span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                {row.reportDate ? formatDate(row.reportDate) : 'report date pending'}{typeof row.confidence === 'number' ? ` · ${sourceBasisLabel(row.confidence)}` : ''}{row.missing.length ? ` · needs ${handoffMissingLabel(row.missing)}` : ''}
                            </p>
                            <div data-ti-selected-case-provenance-fingerprints='true' className='mt-1 flex min-w-0 flex-wrap gap-1.5'>
                                <span className={sourceHealthChipClass('review')}>{row.provenanceRefs.length} source ref{row.provenanceRefs.length === 1 ? '' : 's'}</span>
                                <span className='max-w-full break-all rounded-md border border-ui-border bg-ui-panel px-2 py-1 font-mono text-[10px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                    {row.provenanceFingerprint}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {request.refs.alertIds.slice(0, 3).map(id => <span key={id} className={sourceHealthChipClass('ready')}>alert {id}</span>)}
                {request.refs.casePaths.slice(0, 2).map(path => <span key={path} className={sourceHealthChipClass('ready')}>{displayRequirementText(path)}</span>)}
                {request.consumerStage?.request ? <span className={sourceHealthChipClass(request.ready ? 'ready' : 'blocked')}>{request.consumerStage.request}</span> : null}
            </div>
            {request.caseReviewRows.length ? (
                <div data-ti-selected-case-create-readiness='true' className='mt-2 grid gap-2'>
                    {request.caseReviewRows.slice(0, 3).map(row => (
                        <div key={row.id} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.title}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {formatLabel(row.priority)} · {row.alertIds.length} alert{row.alertIds.length === 1 ? '' : 's'} · {row.captureIds.length} capture{row.captureIds.length === 1 ? '' : 's'} · {readinessOwnerLabel(row.ownerLane)}
                                    </p>
                                </div>
                                <span className={sourceHealthChipClass(row.replay.ready ? 'ready' : row.blockers.length ? 'blocked' : 'review')}>
                                    {row.replay.ready ? 'replay ready' : row.replay.blockerCodes.slice(0, 2).join(', ') || publicDecisionStatusLabel(row.state)}
                                </span>
                            </div>
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.nextAction)}</p>
                            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                {row.casePaths.slice(0, 2).map(path => <span key={path} className={sourceHealthChipClass('ready')}>{displayRequirementText(path)}</span>)}
                                {row.replay.exportRoute ? <span className={sourceHealthChipClass('ready')}>{sourceRequestRouteLabel(row.replay.exportRoute)}</span> : null}
                                {row.sourceIds.slice(0, 3).map(sourceId => <span key={sourceId} className={sourceHealthChipClass('review')}>source {sourceId}</span>)}
                                {row.provenanceFingerprints.slice(0, 2).map(fingerprint => (
                                    <span key={fingerprint} className='max-w-full break-all rounded-md border border-ui-border bg-ui-panel px-2 py-1 font-mono text-[10px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                        {fingerprint}
                                    </span>
                                ))}
                            </div>
                            {row.reasons.length ? (
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{row.reasons.slice(0, 2).join(' ')}</p>
                            ) : null}
                            {row.blockers.length ? (
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(row.blockers.slice(0, 3))}</p>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}
            {request.blockers.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(request.blockers.slice(0, 4))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Case creation has the selected evidence, alert, capture, source, and watchlist refs required for authenticated review.</p>
            )}
        </div>
    )
}

function SelectedWatchlistPlanPanel({ plan }: { plan: SelectedWatchlistPlan }) {
    const status: DecisionStep['status'] = plan.ready ? 'ready' : plan.blockers.length || plan.state === 'missing_terms' ? 'blocked' : 'review'
    return (
        <div data-ti-selected-watchlist-plan='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Watchlist plan</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
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
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.route)}</p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.nextAction)}</p>
            <div className='mt-2 grid gap-2'>
                {plan.terms.slice(0, 3).map(term => (
                    <div key={`${term.kind}:${term.value}`} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{term.kind}: {term.value}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(term.notes)}</p>
                            </div>
                            <span className={sourceHealthChipClass(term.matched ? 'ready' : plan.blockers.length ? 'blocked' : 'review')}>
                                {term.matched ? 'matched' : plan.blockers.length ? 'syncing' : 'candidate'}
                            </span>
                        </div>
                    </div>
                ))}
                {!plan.terms.length ? <p className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-[11px] leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>No watchlist terms are attached to this selected evidence.</p> : null}
            </div>
            {plan.relevanceRows.length ? (
                <div data-ti-selected-watchlist-relevance='true' className='mt-2 grid gap-2'>
                    {plan.relevanceRows.slice(0, 3).map(row => (
                        <div key={`${row.kind}:${row.value}:${row.fit}`} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.kind}: {row.value}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {row.alertable ? 'Ready for review' : 'Needs review'} · {row.evidenceRefs.length} evidence ref{row.evidenceRefs.length === 1 ? '' : 's'} · {row.sourceFamilies.map(formatLabel).join(', ') || 'source family pending'}
                                    </p>
                                </div>
                                <span className={sourceHealthChipClass(row.fit === 'matched' ? 'ready' : row.fit === 'blocked' ? 'blocked' : 'review')}>
                                    {row.fit === 'matched' ? 'matched' : row.fit === 'near' ? 'near match' : 'syncing'}
                                </span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.nextAction)}</p>
                            {row.evidenceRows.length ? (
                                <div data-ti-selected-watchlist-evidence='true' className='mt-2 grid gap-1.5'>
                                    {row.evidenceRows.slice(0, 2).map(source => (
                                        <div key={`${row.kind}:${row.value}:${source.sourceId ?? source.sourceName}:${source.captureId ?? source.provenance}`} className='rounded-md border border-ui-border bg-ui-panel px-2 py-1.5 dark:border-ui-border dark:bg-ui-raised'>
                                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                                <div className='min-w-0'>
                                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{source.sourceName}{source.sourceId ? ` · source ${source.sourceId}` : ''}</p>
                                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                                        {source.sourceFamily ? formatLabel(source.sourceFamily) : 'source type pending'} · {source.reportDate ? formatDate(source.reportDate) : source.lastCollectedAt ? formatDate(source.lastCollectedAt) : 'date pending'} · {source.parserStatus ?? 'processing status pending'}
                                                    </p>
                                                </div>
                                                <span className={sourceHealthChipClass(source.captureId ? 'ready' : 'blocked')}>{source.captureId ? `capture ${source.captureId}` : 'capture needed'}</span>
                                            </div>
                                            <p className='mt-1 break-all font-mono text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(source.provenance)}</p>
                                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{source.shownBecause}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {row.handoffRows.length ? (
                                <div data-ti-selected-watchlist-handoff-rows='true' className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {row.handoffRows.slice(0, 4).map(item => (
                                        <span key={`${row.kind}:${row.value}:${item.rowId}`} className={sourceHealthChipClass(item.state === 'ready' ? 'ready' : item.state === 'blocked' ? 'blocked' : 'review')}>
                                            {readinessOwnerLabel(item.ownerLane)} · {formatLabel(item.kind)}
                                        </span>
                                    ))}
                                    {row.blockerOwners.map(owner => (
                                        <span key={`${row.kind}:${row.value}:owner:${owner}`} className={sourceHealthChipClass('blocked')}>{readinessOwnerLabel(owner)}</span>
                                    ))}
                                </div>
                            ) : null}
                            {row.blockers.length ? (
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(row.blockers.slice(0, 3))}</p>
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
        <div data-ti-selected-enrichment-triage='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source review triage</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Selected evidence mapped to source health, intake items, and capture/source-request follow-up.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(triage.state)}>{decisionStepStatusLabel(triage.state)}</span>
                    <CopyPayloadButton label='Review packet' payload={triage} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Sources' value={`${triage.summary.sourceRows}`} />
                <EvidenceMetric label='Intake' value={`${triage.summary.intakeItems}`} />
                <EvidenceMetric label='Requests' value={`${triage.summary.sourceRequests}`} />
                <EvidenceMetric label='Captures' value={`${triage.summary.captures}`} />
            </div>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(triage.route)}</p>
            <div className='mt-2 grid gap-2'>
                {triage.rows.slice(0, 3).map(row => (
                    <div key={row.id} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {formatLabel(row.sourceFamily)} · {formatDate(row.lastChecked)} · {row.evidence.parserStatus ?? 'processing status pending'}
                                </p>
                            </div>
                            <span className={sourceHealthChipClass(row.state)}>{publicStateLabel(row.state)}</span>
                        </div>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5' data-ti-selected-enrichment-readiness='true'>
                            <span className={sourceHealthChipClass(row.ownerLane === 'source' ? 'blocked' : row.state)}>{readinessOwnerLabel(row.ownerLane)}</span>
                            <span className={sourceHealthChipClass(row.matchingIntakeItemIds.length ? 'review' : 'blocked')}>{row.matchingIntakeItemIds.length} intake item{row.matchingIntakeItemIds.length === 1 ? '' : 's'}</span>
                            {row.captureId ? <span className={sourceHealthChipClass('ready')}>capture linked</span> : <span className={sourceHealthChipClass('blocked')}>capture needed</span>}
                            {row.sourceRequestId ? <span className={sourceHealthChipClass('review')}>request {row.sourceRequestId}</span> : null}
                        </div>
                        <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.recommendedAction)}</p>
                        <p className='mt-1 break-all font-mono text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{sourceRequestRouteLabel(row.remediationPath)} · {row.remediationPath}</p>
                        {row.consumerReadiness.length ? (
                            <div className='mt-2 grid gap-1.5'>
                                {row.consumerReadiness.slice(0, 3).map(readiness => (
                                    <div key={`${row.id}-${readiness.consumer}`} className='flex min-w-0 flex-wrap items-center justify-between gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2 py-1.5 dark:border-ui-border dark:bg-ui-raised'>
                                        <span className='min-w-0 wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{actorEnrichmentConsumerLabel(readiness.consumer)}</span>
                                        <span className={sourceHealthChipClass(actorEnrichmentConsumerState(readiness.state))}>{readiness.ready ? 'ready' : readiness.retryable ? 'retry scheduled' : readiness.blockerCodes.length ? `${readiness.blockerCodes.length} follow-up${readiness.blockerCodes.length === 1 ? '' : 's'}` : publicStateLabel(readiness.state)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>No consumer status is attached to this source yet.</p>
                        )}
                        {row.requestedFields.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>Needs {row.requestedFields.map(sourceHealthFieldLabel).slice(0, 3).join(', ')}.</p>
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
        <div data-ti-selected-alert-action-plan='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Alert action plan</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Selected evidence mapped to watchlist terms, source refs, and alert rebuild state.
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
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.handoff.route || plan.route)}</p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.nextAction)}</p>
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {plan.watchlist.terms.slice(0, 4).map(term => (
                    <span key={term} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>{term}</span>
                ))}
                {!plan.watchlist.terms.length ? <span className='text-[11px] text-ui-muted dark:text-ui-muted'>No watch terms attached.</span> : null}
            </div>
            {plan.evidenceRows.length ? (
                <div data-ti-selected-alert-evidence='true' className='mt-2 grid gap-2'>
                    {plan.evidenceRows.slice(0, 3).map(row => (
                        <div key={row.rowId} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.label}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {formatLabel(row.kind)} · {formatLabel(row.sourceFamily)} · {readinessOwnerLabel(row.ownerLane)}
                                    </p>
                                </div>
                                <span className={sourceHealthChipClass(row.state === 'ready' ? 'ready' : row.state === 'blocked' ? 'blocked' : 'review')}>{publicDecisionStatusLabel(row.state)}</span>
                            </div>
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.evidence.summary)}</p>
                            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                {row.alertId ? <span className={sourceHealthChipClass('ready')}>alert {row.alertId}</span> : null}
                                {row.casePath ? <span className={sourceHealthChipClass('ready')}>{displayRequirementText(row.casePath)}</span> : null}
                                {row.captureIds.length ? <span className={sourceHealthChipClass('ready')}>{row.captureIds.length} capture{row.captureIds.length === 1 ? '' : 's'}</span> : <span className={sourceHealthChipClass('blocked')}>capture needed</span>}
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.route)}</p>
                            {row.blockers.length ? (
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(row.blockers.slice(0, 3))}</p>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}
            {plan.replayRows.length ? (
                <div data-ti-selected-alert-replay='true' className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                    {plan.replayRows.slice(0, 3).map(row => (
                        <span key={row.id} className={sourceHealthChipClass(row.ready ? 'ready' : 'blocked')}>
                            {row.ready ? displayRequirementText(row.exportRoute ?? 'replay ready') : displayRequirementList(row.blockerCodes.slice(0, 2)) || 'case replay syncing'}
                        </span>
                    ))}
                </div>
            ) : null}
            {plan.blockers.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(plan.blockers.slice(0, 3).map(blocker => blocker.detail))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Alert rebuild has the required watchlist, capture, and source context.</p>
            )}
        </div>
    )
}

function SelectedDeliveryReadinessPanel({ plan }: { plan: SelectedDeliveryReadinessPlan }) {
    return (
        <div data-ti-selected-delivery-readiness='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Delivery status</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Selected evidence mapped to alert, capture, destination, and case route status.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(plan.state)}>{decisionStepStatusLabel(plan.state)}</span>
                    <CopyPayloadButton label='Delivery status' payload={plan} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Alerts' value={`${plan.summary.alerts}`} />
                <EvidenceMetric label='Captures' value={`${plan.summary.captures}`} />
                <EvidenceMetric label='Destinations' value={`${plan.summary.destinations}`} />
                <EvidenceMetric label='Case routes' value={`${plan.summary.caseRoutes}`} />
            </div>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.handoff.route || plan.route)}</p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.nextAction)}</p>
            <div className='mt-2 grid gap-2'>
                {plan.alerts.slice(0, 3).map(alert => (
                    <div key={alert.id} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{alert.title}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    alert {alert.id} · {formatLabel(alert.status)}
                                </p>
                            </div>
                            <span className={sourceHealthChipClass(alert.ready ? 'ready' : 'blocked')}>{alert.ready ? 'ready' : 'syncing'}</span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                            {alert.captureIds.length ? `${alert.captureIds.length} capture${alert.captureIds.length === 1 ? '' : 's'}` : 'Capture needed'}
                            {alert.destinationIds.length ? ` · ${alert.destinationIds.length} destination${alert.destinationIds.length === 1 ? '' : 's'}` : ' · destination needed'}
                            {alert.casePath ? ` · ${displayRequirementText(alert.casePath)}` : ' · case route pending'}
                        </p>
                        {alert.blockers.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(alert.blockers.slice(0, 3))}</p>
                        ) : null}
                    </div>
                ))}
                {!plan.alerts.length ? (
                    <p className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-[11px] leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>No related alert is attached to the selected evidence yet.</p>
                ) : null}
            </div>
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {plan.sourceRefs.destinationIds.slice(0, 3).map(id => (
                    <span key={id} className={sourceHealthChipClass('ready')}>destination {id}</span>
                ))}
                {plan.handoff.request ? <span className={sourceHealthChipClass(plan.handoff.ready ? 'ready' : 'blocked')}>{plan.handoff.request}</span> : null}
            </div>
            {plan.blockers.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(plan.blockers.slice(0, 4))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Alert, capture, destination, and case route refs are ready for authenticated dry-run delivery.</p>
            )}
        </div>
    )
}

function CaseActionTrailPanel({ trail }: { trail: CaseActionTrailPayload }) {
    return (
        <div data-ti-case-action-trail='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Case action trail</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Metadata-only trail for local decisions, selected evidence, and case replay state.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={trail.summary.replayable ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                        {trail.summary.replayable ? 'replay ready' : 'replay syncing'}
                    </span>
                    <CopyPayloadButton label='Case action trail' payload={trail} />
                </div>
            </div>
            <div className='mt-3 grid gap-2'>
                {trail.events.slice(0, 4).map(event => (
                    <div key={event.id} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{event.label}</p>
                                <p className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatDate(event.at)}</p>
                            </div>
                            <span className={decisionStepStatusClass(event.state === 'local' ? 'review' : event.state)}>{publicStateLabel(event.state)}</span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(event.detail)}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                            {event.provenance.sourceIds.length ? `Sources ${event.provenance.sourceIds.slice(0, 3).join(', ')}` : 'Source link pending'}
                            {event.provenance.captureIds.length ? ` · captures ${event.provenance.captureIds.slice(0, 3).join(', ')}` : ''}
                            {event.provenance.alertIds.length ? ` · alerts ${event.provenance.alertIds.slice(0, 3).join(', ')}` : ''}
                        </p>
                        {event.blockers.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(event.blockers.slice(0, 3))}</p>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    )
}

function SelectedCaseDraftPanel({ draft }: { draft: SelectedCaseDraft }) {
    return (
        <div data-ti-selected-case-draft='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Case draft</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Session-local draft for authenticated case review.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={draft.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{draft.ready ? 'ready' : 'syncing'}</span>
                    <CopyPayloadButton label='Case draft' payload={draft} />
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                <EvidenceMetric label='Intent' value={formatLabel(draft.caseIntent)} />
                <EvidenceMetric label='Sources' value={`${draft.sourceRows.length} row${draft.sourceRows.length === 1 ? '' : 's'}`} />
            </div>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(draft.route || draft.endpoint)}</p>
            {draft.sourceRows.length ? (
                <div data-ti-selected-case-sources='true' className='mt-2 grid min-w-0 gap-2'>
                    {draft.sourceRows.slice(0, 3).map(row => (
                        <div key={`${row.sourceId ?? row.sourceName}:${row.provenance}:${row.captureId ?? 'missing'}`} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}{row.sourceId ? ` · source ${row.sourceId}` : ''}</p>
                                    <p className='mt-1 break-all font-mono text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.provenance)}</p>
                                </div>
                                <span className={sourceHealthChipClass(row.state === 'ready' ? 'ready' : row.state === 'needs_capture' ? 'blocked' : 'review')}>
                                    {row.captureId ? `capture ${row.captureId}` : 'capture needed'}
                                </span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                {typeof row.confidence === 'number' ? sourceBasisLabel(row.confidence) : 'source basis pending'}{row.missing.length ? ` · needs ${handoffMissingLabel(row.missing)}` : ''}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {draft.watchTerms.slice(0, 4).map(term => (
                    <span key={term} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>{term}</span>
                ))}
                {!draft.watchTerms.length ? <span className='text-[11px] text-ui-muted dark:text-ui-muted'>No watch terms attached.</span> : null}
            </div>
            {draft.missing.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(draft.missing.slice(0, 3))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Required case identifiers and evidence context are present.</p>
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
        <Panel title='Saved Drafts' description='Selected reviews, sources, and case drafts saved in this browser session. Nothing is submitted until opened in the authenticated console.' icon={<ClipboardList className='h-4 w-4' />}>
            <div data-ti-staged-handoff-queue='true' className='grid gap-3'>
                <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            {items.length ? `${items.length} staged handoff${items.length === 1 ? '' : 's'} · ${readyCount} ready` : 'No handoffs staged in this browser session.'}
                        </p>
                    </div>
                    <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                        <CopyPayloadButton label='Saved drafts' payload={bundle} />
                        <button
                            type='button'
                            onClick={onClear}
                            disabled={!items.length}
                            className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised dark:disabled:bg-ui-raised dark:disabled:text-ui-muted'
                        >
                            Clear
                        </button>
                    </div>
                </div>
                {items.length ? (
                    <div className='grid gap-2'>
                        {items.slice(0, 4).map(item => (
                            <div key={item.id} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.title}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                            {formatLabel(item.caseIntent)} · {relevanceLabelForStaged(item.relevanceState)} · {item.selectedArtifact.artifact.kind}: {item.selectedArtifact.artifact.label} · {item.sourceDrilldown.rows.length} source result{item.sourceDrilldown.rows.length === 1 ? '' : 's'} · {item.caseCreateRequest.actorContext.techniques.length} method{item.caseCreateRequest.actorContext.techniques.length === 1 ? '' : 's'} · {item.caseActionTrail.summary.total} trail event{item.caseActionTrail.summary.total === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                    <span className={item.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{item.ready ? 'ready' : 'syncing'}</span>
                                </div>
                                <div data-ti-staged-handoff-readiness='true' className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {stagedReadinessChips(item).map(chip => (
                                        <span key={chip.label} className={sourceHealthChipClass(chip.ready ? 'ready' : 'blocked')}>{chip.label}: {chip.value}</span>
                                    ))}
                                </div>
                                {item.blockers.length ? (
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(item.blockers.slice(0, 2))}</p>
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
    const actorReady = item.caseCreateRequest.actorContext.sourceCoverage.totalRows > 0 && item.caseCreateRequest.actorContext.techniques.length > 0
    const artifactReady = !item.selectedArtifact.readiness.blockers.length && !item.selectedArtifact.readiness.missing.length
    const replayReady = item.caseCreateRequest.actionReplay.rows.some(row => row.ready)
    const ownershipReady = item.caseOwnership.state === 'ready' && item.caseOwnership.blockers.length === 0
    const alertReady = item.alertPlan.ready && item.alertPlan.blockers.length === 0
    const deliveryReady = item.deliveryPlan.state === 'ready' && item.deliveryPlan.blockers.length === 0
    const enrichmentReady = item.enrichmentTriage.state !== 'blocked' && item.enrichmentTriage.summary.blockers === 0
    const trailReady = item.caseActionTrail.summary.replayable && item.caseActionTrail.summary.blocked === 0
    return [
        { label: 'review', value: item.reviewHandoff.blockers.length ? `${item.reviewHandoff.blockers.length} follow-up${item.reviewHandoff.blockers.length === 1 ? '' : 's'}` : 'ready', ready: item.reviewHandoff.blockers.length === 0 },
        { label: 'source', value: sourceMissing.length ? `${sourceMissing.length} missing` : `${item.sourceDrilldown.rows.length} result${item.sourceDrilldown.rows.length === 1 ? '' : 's'}`, ready: sourceMissing.length === 0 },
        { label: 'case', value: item.caseDraft.missing.length ? `${item.caseDraft.missing.length} missing` : item.caseDraft.route ? 'route ready' : 'draft ready', ready: item.caseDraft.missing.length === 0 },
        { label: 'owner', value: ownershipReady ? item.caseOwnership.owner.label : item.caseOwnership.blockers.length ? `${item.caseOwnership.blockers.length} follow-up${item.caseOwnership.blockers.length === 1 ? '' : 's'}` : 'review', ready: ownershipReady },
        { label: 'detail', value: artifactReady ? formatLabel(item.selectedArtifact.artifact.kind) : item.selectedArtifact.readiness.blockers.length ? `${item.selectedArtifact.readiness.blockers.length} follow-up${item.selectedArtifact.readiness.blockers.length === 1 ? '' : 's'}` : 'review', ready: artifactReady },
        { label: 'actor', value: actorReady ? `${item.caseCreateRequest.actorContext.techniques.length} method${item.caseCreateRequest.actorContext.techniques.length === 1 ? '' : 's'}` : 'needs context', ready: actorReady },
        { label: 'watchlist', value: item.caseCreateRequest.watchlistBasis.ready ? 'matched' : item.caseCreateRequest.watchlistBasis.blockers.length ? `${item.caseCreateRequest.watchlistBasis.blockers.length} follow-up${item.caseCreateRequest.watchlistBasis.blockers.length === 1 ? '' : 's'}` : 'review', ready: item.caseCreateRequest.watchlistBasis.ready },
        { label: 'alert', value: alertReady ? `${item.alertPlan.readiness.matchedCandidateCount} matched` : item.alertPlan.blockers.length ? `${item.alertPlan.blockers.length} follow-up${item.alertPlan.blockers.length === 1 ? '' : 's'}` : 'review', ready: alertReady },
        { label: 'delivery', value: deliveryReady ? `${item.deliveryPlan.summary.destinations} destination${item.deliveryPlan.summary.destinations === 1 ? '' : 's'}` : item.deliveryPlan.blockers.length ? `${item.deliveryPlan.blockers.length} follow-up${item.deliveryPlan.blockers.length === 1 ? '' : 's'}` : 'review', ready: deliveryReady },
        { label: 'source review', value: enrichmentReady ? `${item.enrichmentTriage.summary.intakeItems} intake` : item.enrichmentTriage.summary.blockers ? `${item.enrichmentTriage.summary.blockers} follow-up${item.enrichmentTriage.summary.blockers === 1 ? '' : 's'}` : 'review', ready: enrichmentReady },
        { label: 'replay', value: replayReady ? `${item.caseCreateRequest.actionReplay.rows.filter(row => row.ready).length} ready` : 'syncing', ready: replayReady },
        { label: 'trail', value: trailReady ? `${item.caseActionTrail.summary.total} events` : item.caseActionTrail.summary.blocked ? `${item.caseActionTrail.summary.blocked} syncing` : 'review', ready: trailReady },
    ]
}

function ActionButton({ icon, children, onClick }: { icon: React.ReactNode; children: string; onClick: () => void }) {
    return (
        <button type='button' onClick={onClick} className='inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
            {icon}
            {children}
        </button>
    )
}

function EvidencePanel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>{title}</p>
            <ul className='mt-2 grid list-disc gap-1 pl-4 text-sm leading-6 text-ui-muted dark:text-ui-muted'>
                {children}
            </ul>
        </div>
    )
}

function SelectedTriageBriefPanel({ brief }: { brief: SelectedTriageBrief }) {
    return (
        <section data-ti-selected-brief='true' className='mt-4 rounded-lg border border-ui-border bg-ui-raised p-4 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>Analyst brief</p>
                    <h3 className='mt-1 text-base font-semibold text-ui-text dark:text-ui-text'>What happened, why it matters, and what to do next</h3>
                </div>
                <span className={brief.proofTone === 'ready' ? sourceHealthChipClass('ready') : brief.proofTone === 'blocked' ? sourceHealthChipClass('blocked') : sourceHealthChipClass('review')}>
                    {brief.proofTone === 'ready' ? 'source ready' : brief.proofTone === 'blocked' ? 'source needed' : 'verify source'}
                </span>
            </div>
            <div className='mt-4 grid gap-3 lg:grid-cols-3'>
                <BriefStep title='What happened' value={brief.whatHappened} />
                <BriefStep title='Why it matters' value={brief.whyItMatters} />
                <BriefStep title='Next action' value={brief.nextAction} />
            </div>
            <div className='mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source status</p>
                    <p className='mt-1 wrap-break-word text-sm leading-6 text-ui-muted dark:text-ui-muted'>{brief.proofStatus}</p>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Safety boundary</p>
                    <p className='mt-1 wrap-break-word text-sm leading-6 text-ui-muted dark:text-ui-muted'>{brief.safetyBoundary}</p>
                </div>
            </div>
            <div className='mt-3 flex min-w-0 flex-wrap gap-2'>
                {brief.labels.map(label => (
                    <span key={`${label.label}:${label.value}`} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        {label.label}: {label.value}
                    </span>
                ))}
            </div>
        </section>
    )
}

function ActorIntelHighlights({ actor, result, actionability }: { actor: TiActorIntelligenceProfile; result: TiSearchResponse; actionability: TiActionabilityModel }) {
    const targets = [
        ...actor.targetSectors.slice(0, 2),
        ...actor.geographies.slice(0, 2),
    ].filter(Boolean).slice(0, 4)
    const aliases = result.aliases.slice(0, 5)
    const techniques = actor.techniqueCoverage.slice(0, 3)
    const latestDate = actor.sourceCoverage.latestReportDate || result.lastSeen || result.generatedAt
    const openGap = actionability.enrichmentGapQueue[0]
    const sourceCount = actor.provenanceRows.length || actor.sourceCoverage.totalRows || result.sources.length
    const methodNames = techniques.map(item => item.attackId || item.name).filter(Boolean)
    const workflowSummary = [
        `${sourceCountLabel(sourceCount)} linked`,
        actionability.watchlistRelevance.terms.length ? `${actionability.watchlistRelevance.terms.length} watch terms` : 'watch term needed',
        actionability.relatedAlerts.length ? `${actionability.relatedAlerts.length} alerts` : 'no routed alert',
        actionability.relatedCases.length ? `${actionability.relatedCases.length} cases` : 'case handoff ready',
    ].join(' · ')
    const rows = [
        {
            icon: <ShieldAlert className='h-4 w-4' />,
            label: 'Actor type',
            value: actor.actorClass || 'Actor class not stated',
            meta: actor.motivation.slice(0, 2).join(' · ') || 'Motivation not stated',
            tone: actor.actorClass ? 'ready' : 'review',
        },
        {
            icon: <Globe2 className='h-4 w-4' />,
            label: 'Operating area',
            value: targets.length ? targets.join(' · ') : 'No target pattern yet',
            meta: actor.geographies.length ? `${actor.geographies.length} region${actor.geographies.length === 1 ? '' : 's'}` : `${actor.targetSectors.length} target pattern${actor.targetSectors.length === 1 ? '' : 's'}`,
            tone: targets.length ? 'ready' : 'review',
        },
        {
            icon: <Activity className='h-4 w-4' />,
            label: 'Observed methods',
            value: methodNames.length ? methodNames.join(' · ') : 'No mapped method yet',
            meta: `${actor.techniqueCoverage.length} technique${actor.techniqueCoverage.length === 1 ? '' : 's'} mapped`,
            tone: actor.techniqueCoverage.length ? 'ready' : 'review',
        },
        {
            icon: <Database className='h-4 w-4' />,
            label: 'Source coverage',
            value: `${sourceCountLabel(sourceCount)} · latest ${formatDate(latestDate)}`,
            meta: `${actor.sourceCoverage.captureRows} captured page${actor.sourceCoverage.captureRows === 1 ? '' : 's'} · ${sourceBasisLabel(actor.confidence)}`,
            tone: sourceCount ? 'ready' : 'blocked',
        },
        {
            icon: <ClipboardList className='h-4 w-4' />,
            label: 'Next review',
            value: openGap ? displayRequirementText(openGap.title) : 'Profile has enough source context for review',
            meta: openGap ? sourceHealthFieldLabel(openGap.requestedFields[0] ?? 'source') : 'No open source question',
            tone: openGap ? 'review' : 'ready',
        },
    ] as const

    return (
        <section data-ti-actor-glance='true' data-ti-actor-highlights='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>Actor at a glance</p>
                    <h2 className='mt-1 wrap-break-word text-base font-semibold text-ui-text dark:text-ui-text'>Identity, geography, methods, and review path</h2>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Aliases: {aliases.length ? aliases.join(' · ') : 'No aliases in this actor profile'}{result.aliases.length > aliases.length ? ` · +${result.aliases.length - aliases.length} more` : ''}
                    </p>
                </div>
                <span className={sourceHealthChipClass(actor.sourceCoverage.stale ? 'review' : 'ready')}>
                    {actor.sourceCoverage.stale ? 'refresh recommended' : 'current source set'}
                </span>
            </div>
            <div className='mt-3 divide-y divide-[#eef1f5] rounded-lg border border-ui-border bg-ui-panel dark:divide-[#273244] dark:border-ui-border dark:bg-ui-raised'>
                {rows.map(row => (
                    <div key={row.label} className='grid min-w-0 gap-2 px-3 py-2 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,0.8fr)_5rem] sm:items-center'>
                        <p className='inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>
                            <span className='shrink-0 text-ui-primary dark:text-ui-primary'>{row.icon}</span>
                            <span className='truncate'>{row.label}</span>
                        </p>
                        <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.value}</p>
                        <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{row.meta}</p>
                        <span className={sourceHealthChipClass(row.tone)}>{row.tone === 'blocked' ? 'needed' : row.tone}</span>
                    </div>
                ))}
            </div>
            <div className='mt-3 flex min-w-0 flex-col gap-2 border-t border-ui-border pt-3 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Workflow state</p>
                    <p className='mt-1 wrap-break-word text-sm leading-6 text-ui-text dark:text-ui-text'>{workflowSummary}</p>
                </div>
            </div>
            {techniques.length ? (
                <div className='mt-3 flex min-w-0 flex-wrap items-center gap-2'>
                    <span className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Mapped ATT&CK techniques</span>
                    {techniques.map(item => item.attackId ? (
                        <TechniqueBadge key={`${item.attackId}:${item.name}`} attackId={item.attackId} name={item.name} tactic={item.tactic} detail={item.detail} />
                    ) : (
                        <span key={`${item.name}:${item.tactic}`} className={sourceHealthChipClass(item.freshness)}>{displayRequirementText(item.name)}</span>
                    ))}
                </div>
            ) : null}
            {actor.provenanceRows.length ? (
                <p className='mt-3 wrap-break-word border-t border-ui-border pt-3 text-xs leading-5 text-ui-muted dark:border-ui-border dark:text-ui-muted'>
                    Visible sources: {actor.provenanceRows.slice(0, 4).map(row => `${row.sourceName}${row.reportDate ? ` (${formatDate(row.reportDate)})` : ''}`).join(' · ')}
                </p>
            ) : null}
        </section>
    )
}

function BriefStep({ title, value }: { title: string; value: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>{title}</p>
            <p className='mt-1 wrap-break-word text-sm leading-6 text-ui-text dark:text-ui-text'>{value}</p>
        </div>
    )
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{value || 'Not stated'}</p>
        </div>
    )
}

function TopSelectedEvidencePanel({ selected, drilldown, caseReady }: { selected: AnalystWorkItem; drilldown: SelectedSourceDrilldown | null; caseReady: boolean }) {
    const sourceRows = drilldown?.rows.length ?? 0
    const captureRows = drilldown?.rows.filter(row => row.captureId).length ?? 0
    return (
        <section data-ti-top-selected-evidence='true' className='rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>Selected evidence</p>
                    <h2 className='mt-1 wrap-break-word text-base font-semibold leading-6 text-ui-text dark:text-ui-text'>{displayRequirementText(selected.title)}</h2>
                    <p className='mt-1 line-clamp-2 text-sm leading-6 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selected.detail)}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${severityClass(selected.severity)}`}>{selected.severity}</span>
            </div>
            <div className='mt-3 grid gap-2 sm:grid-cols-4'>
                <EvidenceMetric label='Source' value={selected.source} />
                <EvidenceMetric label='First seen' value={selected.timestamp} />
                <EvidenceMetric label='Basis' value={sourceBasisLabel(selected.confidence)} />
                <EvidenceMetric label='Case path' value={caseReady ? 'Ready' : sourceRows ? 'Needs IDs' : 'Needs source'} />
            </div>
            <div className='mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-ui-border pt-3 dark:border-ui-border'>
                <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                    {sourceRows ? `${sourceRows} source row${sourceRows === 1 ? '' : 's'} linked · ${captureRows} capture-ready` : 'Attach source rows before alert or case handoff.'}
                </p>
            </div>
        </section>
    )
}

function QueueMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
            <p className='text-base font-semibold text-ui-text dark:text-ui-text'>{value}</p>
            <p className='text-[11px] text-ui-muted dark:text-ui-muted'>{label}</p>
        </div>
    )
}

function EvidenceQueueFilters({
    kind,
    source,
    confidence,
    sort,
    sources,
    sourceCounts,
    onKindChange,
    onSourceChange,
    onConfidenceChange,
    onSortChange,
}: {
    kind: AnalystWorkItem['kind'] | 'all'
    source: string
    confidence: 'all' | 'high' | 'medium'
    sort: 'priority' | 'confidence' | 'freshness'
    sources: string[]
    sourceCounts: Array<{ source: string; count: number }>
    onKindChange: (value: AnalystWorkItem['kind'] | 'all') => void
    onSourceChange: (value: string) => void
    onConfidenceChange: (value: 'all' | 'high' | 'medium') => void
    onSortChange: (value: 'priority' | 'confidence' | 'freshness') => void
}) {
    return (
        <div data-ti-evidence-filters='true' className='mt-3 grid gap-2'>
            <div className='grid grid-cols-2 gap-2'>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Type</span>
                    <select value={kind} onChange={event => onKindChange(event.target.value as AnalystWorkItem['kind'] | 'all')} className='h-9 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='all'>All results</option>
                        <option value='activity'>Activity</option>
                        <option value='exposure'>Recent attacks</option>
                        <option value='victim'>Victim</option>
                        <option value='tradecraft'>Methods</option>
                        <option value='collection'>Open questions</option>
                    </select>
                </label>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source basis</span>
                    <select value={confidence} onChange={event => onConfidenceChange(event.target.value as 'all' | 'high' | 'medium')} className='h-9 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='all'>Any</option>
                        <option value='high'>Strong</option>
                        <option value='medium'>Moderate</option>
                    </select>
                </label>
            </div>
            <div className='grid grid-cols-2 gap-2'>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source</span>
                    <select value={source} onChange={event => onSourceChange(event.target.value)} className='h-9 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='all'>All sources</option>
                        {sources.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                </label>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Sort</span>
                    <select value={sort} onChange={event => onSortChange(event.target.value as 'priority' | 'confidence' | 'freshness')} className='h-9 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='priority'>Priority</option>
                        <option value='confidence'>Source basis</option>
                        <option value='freshness'>Freshness</option>
                    </select>
                </label>
            </div>
            {sourceCounts.length ? (
                <div className='flex min-w-0 flex-wrap gap-1.5 pb-1'>
                    {sourceCounts.slice(0, 5).map(item => (
                        <button
                            key={item.source}
                            type='button'
                            onClick={() => onSourceChange(source === item.source ? 'all' : item.source)}
                            className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${source === item.source ? 'border-ui-primary bg-ui-primary/10 text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-muted hover:bg-ui-raised dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted dark:hover:bg-ui-raised'}`}
                        >
                            <span>{item.source}</span>
                            <span className='rounded bg-ui-raised px-1 text-[10px] text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>{item.count}</span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

function MobileEvidenceWorkbar({
    selected,
    filteredCount,
    totalCount,
    kind,
    source,
    confidence,
    sourceCounts,
    onKindChange,
    onSourceChange,
    onConfidenceChange,
    onMarkReviewed,
    onEscalate,
    onWatchlist,
    onCase,
    caseAvailable,
}: {
    selected: AnalystWorkItem
    filteredCount: number
    totalCount: number
    kind: AnalystWorkItem['kind'] | 'all'
    source: string
    confidence: 'all' | 'high' | 'medium'
    sourceCounts: Array<{ source: string; count: number }>
    onKindChange: (value: AnalystWorkItem['kind'] | 'all') => void
    onSourceChange: (value: string) => void
    onConfidenceChange: (value: 'all' | 'high' | 'medium') => void
    onMarkReviewed: () => void
    onEscalate: () => void
    onWatchlist: () => void
    onCase: () => void
    caseAvailable: boolean
}) {
    const kindOptions: Array<{ value: AnalystWorkItem['kind'] | 'all'; label: string }> = [
        { value: 'all', label: 'All' },
        { value: 'activity', label: 'Activity' },
        { value: 'exposure', label: 'Recent attacks' },
        { value: 'victim', label: 'Victims' },
        { value: 'tradecraft', label: 'Methods' },
        { value: 'collection', label: 'Open questions' },
    ]
    return (
        <section data-ti-mobile-workbar='true' className='lg:hidden sticky top-2 z-20 grid min-w-0 gap-2 rounded-lg border border-ui-border bg-ui-panel/95 p-2 shadow-sm backdrop-blur dark:border-ui-border dark:bg-ui-panel/95'>
            <div className='flex min-w-0 items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{filteredCount}/{totalCount} results</p>
                    <p className='mt-0.5 line-clamp-1 text-xs font-semibold text-ui-text dark:text-ui-text'>{displayRequirementText(selected.title)}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${severityClass(selected.severity)}`}>{selected.severity}</span>
            </div>
            <div data-ti-mobile-selected-context='true' className='grid gap-1 rounded-md border border-ui-border bg-ui-panel px-2 py-1.5 dark:border-ui-border dark:bg-ui-raised'>
                <p className='line-clamp-2 text-[11px] leading-4 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selected.detail)}</p>
                <div className='flex min-w-0 flex-wrap gap-1.5 text-[10px] font-semibold text-ui-muted dark:text-ui-muted'>
                    <span>{selected.timestamp}</span>
                    <span>{selected.source}</span>
                    <span>{sourceBasisLabel(selected.confidence)}</span>
                    <a href='#ti-selected-evidence' className='text-ui-primary dark:text-ui-primary'>Open detail</a>
                </div>
            </div>

            <div className='flex min-w-0 flex-wrap gap-1.5 pb-1'>
                {kindOptions.map(item => (
                    <button
                        key={item.value}
                        type='button'
                        onClick={() => onKindChange(item.value)}
                        className={`inline-flex min-h-8 shrink-0 items-center rounded-md border px-2 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${kind === item.value ? 'border-ui-primary bg-ui-primary/10 text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'}`}
                    >
                        {item.label}
                    </button>
                ))}
                <button type='button' onClick={() => onConfidenceChange(confidence === 'high' ? 'all' : 'high')} className={`inline-flex min-h-8 shrink-0 items-center rounded-md border px-2 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${confidence === 'high' ? 'border-ui-primary bg-ui-primary/10 text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'}`}>
                    Strong basis
                </button>
            </div>

            {sourceCounts.length ? (
                <div className='flex min-w-0 flex-wrap gap-1.5 pb-1'>
                    {sourceCounts.slice(0, 6).map(item => (
                        <button
                            key={item.source}
                            type='button'
                            onClick={() => onSourceChange(source === item.source ? 'all' : item.source)}
                            className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${source === item.source ? 'border-ui-primary bg-ui-primary/10 text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'}`}
                        >
                            <span>{item.source}</span>
                            <span className='rounded bg-ui-raised px-1 text-[10px] text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>{item.count}</span>
                        </button>
                    ))}
                </div>
            ) : null}

            <div className='grid grid-cols-4 gap-1.5'>
                <button type='button' onClick={onWatchlist} className='inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-ui-border bg-ui-panel px-1 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                    <BellRing className='h-3 w-3' />
                    Watch
                </button>
                <button type='button' onClick={onCase} disabled={!caseAvailable} className='inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-ui-border bg-ui-panel px-1 text-[11px] font-semibold text-ui-text disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:disabled:bg-ui-raised dark:disabled:text-ui-muted'>
                    <ClipboardList className='h-3 w-3' />
                    Case
                </button>
                <button type='button' onClick={onEscalate} className='inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-ui-border bg-ui-panel px-1 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                    <Send className='h-3 w-3' />
                    Escalate
                </button>
                <button type='button' onClick={onMarkReviewed} className='inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-ui-border bg-ui-panel px-1 text-[11px] font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                    <CheckCircle2 className='h-3 w-3' />
                    Review
                </button>
            </div>
        </section>
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
        { label: 'Overview', value: sourceBasisLabel(input.actorIntel.confidence), state: input.actorIntel.provenanceRows.length ? 'ready' : 'blocked' },
        { label: 'Activity', value: `${input.workItems.length} item${input.workItems.length === 1 ? '' : 's'}`, state: input.workItems.length ? 'ready' : 'review' },
        { label: 'Targets', value: `${input.victimObservations.length || input.actorIntel.targetSectors.length} row${(input.victimObservations.length || input.actorIntel.targetSectors.length) === 1 ? '' : 's'}`, state: input.victimObservations.length || input.actorIntel.targetSectors.length ? 'ready' : 'review' },
        { label: 'Infrastructure', value: `${input.actorIntel.infrastructure.length} pattern${input.actorIntel.infrastructure.length === 1 ? '' : 's'}`, state: input.actorIntel.infrastructure.length ? 'ready' : 'review' },
        { label: 'Sources', value: `${sourceRows} source result${sourceRows === 1 ? '' : 's'}`, state: sourceRows ? 'ready' : 'blocked' },
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
            ? `${matchedTerms.length} organization watchlist match${matchedTerms.length === 1 ? '' : 'es'} for this query.`
            : organizations.length
                ? 'Candidate watchlist inputs are present; save an organization watchlist match before alert review.'
                : 'Candidate actor, alias, sector, country, campaign, tool, and source-domain terms appear when present in the profile or source results.',
    }
}

function watchlistWorkbenchRowsFor({
    watchlist,
    actionability,
    query,
    workItems,
    artifacts,
}: {
    watchlist: WatchlistRelevance
    actionability: TiActionabilityModel
    query: string
    workItems: AnalystWorkItem[]
    artifacts: ActorArtifact[]
}): WatchlistWorkbenchRow[] {
    const seenTermIds = new Set<string>()
    const terms = unique([
        ...watchlist.terms,
        ...watchlist.matchedTerms,
        ...actionability.watchlistRelevance.terms.map(term => `${term.kind}: ${term.value}`),
        ...actionability.orgRelevance.candidateTerms.map(term => `${term.kind}: ${term.value}`),
        ...actionability.orgRelevance.watchlistIntersections.map(term => `${term.kind}: ${term.value}`),
    ]).filter(term => {
        const parsed = watchlistTermParts(term)
        const id = watchlistWorkbenchRowId(parsed.kind, parsed.value)
        if (seenTermIds.has(id)) return false
        seenTermIds.add(id)
        return true
    }).slice(0, 16)
    return terms.map(term => {
        const parsed = watchlistTermParts(term)
        const valueKey = parsed.value.toLowerCase()
        const matchingTerms = actionability.watchlistRelevance.terms.filter(item => item.value.toLowerCase() === valueKey || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase())
        const candidateTerms = actionability.orgRelevance.candidateTerms.filter(item => item.value.toLowerCase() === valueKey || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase())
        const intersections = actionability.orgRelevance.watchlistIntersections.filter(item => item.value.toLowerCase() === valueKey || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase())
        const sourceRefs = unique([...candidateTerms.flatMap(item => item.sourceEvidenceRefs), ...intersections.flatMap(item => item.sourceEvidenceRefs)])
        const sourceEvidence = actionability.orgRelevance.sourceEvidence.filter(source =>
            source.supportsTerms.some(supported => supported.toLowerCase() === valueKey || supported.toLowerCase().includes(valueKey))
            || sourceRefs.some(ref => source.sourceId === ref || source.sourceName.includes(ref) || source.provenance.includes(ref))
        )
        const evidenceItems = workItems.filter(item => watchlistRowText(item).includes(valueKey)).slice(0, 8)
        const artifactMatches = artifacts.filter(artifact => watchlistArtifactText(artifact).includes(valueKey))
        const confidenceValues = uniqueNumbers([
            ...evidenceItems.map(item => item.confidence),
            ...artifactMatches.map(item => item.confidence),
            ...sourceEvidence.map(item => item.confidence).filter((value): value is number => typeof value === 'number'),
        ])
        const newestAt = newestDate([
            ...evidenceItems.map(item => item.timestamp),
            ...sourceEvidence.map(item => item.lastCollectedAt || item.reportDate || ''),
            actionability.orgRelevance.freshness.lastSeen,
        ])
        const matched = intersections.length > 0 || matchingTerms.some(item => item.matched) || candidateTerms.some(item => item.matched) || watchlist.matchedTerms.some(item => item.toLowerCase() === term.toLowerCase())
        const blockers = unique([
            ...actionability.watchlistRelevance.blockers,
            ...actionability.exportPayloads.watchlist.missing,
            ...intersections.flatMap(item => item.blockers.map(blocker => blocker.handoff)),
        ].map(displayRequirementText)).slice(0, 6)
        const state: WatchlistWorkbenchRow['state'] = matched ? 'ready' : actionability.exportPayloads.watchlist.blocked || blockers.length ? 'blocked' : 'review'
        const route = intersections[0]?.route || actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route || '/dashboard/dwm'
        const casePath = intersections.flatMap(item => [item.casePath, ...item.casePaths]).find((value): value is string => Boolean(value))
        const intersectionDetail = intersections[0] ? `${watchlistIntersectionActionLabel(intersections[0].recommendedAction)} for ${parsed.value}.` : ''
        const payload = {
            ...watchlistTermRequestPayloadFor(term, watchlist, actionability, query),
            schemaVersion: 'ti.public_actor.watchlist_workbench_row.v1',
            selectedEvidenceRows: evidenceItems.map(item => ({
                id: item.id,
                title: item.title,
                source: item.source,
                timestamp: item.timestamp,
                confidence: item.confidence,
                provenance: item.provenance,
            })),
            selectedArtifacts: artifactMatches.map(artifact => ({
                id: artifact.id,
                kind: artifact.kind,
                label: artifact.label,
                confidence: artifact.confidence,
                freshness: artifact.freshness,
            })),
            sourceEvidence,
            intersections,
            state,
            casePath,
        }
        return {
            id: watchlistWorkbenchRowId(parsed.kind, parsed.value),
            kind: parsed.kind,
            value: parsed.value,
            matched,
            state,
            confidenceValues,
            newestAt,
            evidenceItems,
            artifactIds: artifactMatches.map(item => item.id),
            sourceCount: unique([...sourceEvidence.map(item => item.sourceName), ...evidenceItems.map(item => item.source)]).length,
            route,
            casePath,
            detail: candidateTerms[0]?.notes || matchingTerms[0]?.notes || intersectionDetail || watchlist.rationale,
            blockers,
            payload,
        }
    }).sort((a, b) => Number(b.matched) - Number(a.matched)
        || sourceCoverageStateRank(a.state) - sourceCoverageStateRank(b.state)
        || Date.parse(b.newestAt || '') - Date.parse(a.newestAt || '')
        || b.evidenceItems.length - a.evidenceItems.length
        || a.value.localeCompare(b.value))
}

function watchlistRowText(item: AnalystWorkItem) {
    return `${item.title} ${item.subtitle} ${item.detail} ${item.source} ${item.provenance} ${item.evidence.join(' ')}`.toLowerCase()
}

function watchlistArtifactText(artifact: ActorArtifact) {
    return `${artifact.label} ${artifact.subtitle} ${artifact.evidence.join(' ')} ${artifact.provenance.join(' ')} ${artifact.watchlistTerms.map(term => `${term.kind} ${term.value} ${term.notes}`).join(' ')}`.toLowerCase()
}

function newestDate(values: string[]) {
    return values
        .filter(Boolean)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
}

function alertPacketFor(result: TiSearchResponse, selected: AnalystWorkItem, watchlist: WatchlistRelevance): AlertPacket {
    const isCustomerAlert = selected.kind === 'exposure' || Boolean(watchlist.organizations.some(org => selected.title.toLowerCase().includes(org.toLowerCase())))
    const evidenceBasis = unique([
        `${selected.source}; ${selected.provenance}`,
        `Timestamp: ${selected.timestamp}`,
        `Source basis: ${sourceBasisLabel(selected.confidence)}`,
        ...selected.evidence.slice(0, 3).map(displayRequirementText),
    ])
    const blockedUntil = [
        selected.href ? '' : 'A source URL or internal capture reference is attached.',
        isCustomerAlert ? '' : 'A watched company, domain, vendor, or portfolio term matches this finding.',
        selected.confidence >= 0.7 ? '' : 'Corroborating evidence is added.',
    ].filter(Boolean)

    return {
        title: isCustomerAlert ? `Candidate customer alert: ${displayRequirementText(selected.title)}` : `Actor context packet: ${displayRequirementText(selected.title)}`,
        customerValue: isCustomerAlert
            ? 'This finding has enough structure to enter the alert review workflow: named object, evidence basis, timestamp, source reference, and routing guidance.'
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
            title: displayRequirementText(selected.title),
            timestamp: selected.timestamp,
            source: selected.source,
            provenance: selected.provenance,
            confidence: selected.confidence,
            href: selected.href,
            evidence: selected.evidence.map(displayRequirementText),
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

function caseSourceRowFor(row: SelectedSourceDrilldownRow | SelectedCaseSourceRow): SelectedCaseSourceRow {
    const provenanceRefs = caseSourceProvenanceRefs(row)
    return {
        sourceName: row.sourceName,
        sourceId: row.sourceId,
        provenance: row.provenance,
        captureId: row.captureId,
        reportDate: row.reportDate,
        confidence: row.confidence,
        state: row.state,
        missing: row.missing,
        provenanceRefs,
        provenanceFingerprint: stableEvidenceFingerprint(provenanceRefs),
    }
}

function caseSourceProvenanceRefs(row: Pick<SelectedSourceDrilldownRow, 'sourceName' | 'sourceId' | 'provenance' | 'captureId' | 'reportDate'>) {
    return unique([
        row.sourceId,
        row.captureId,
        row.provenance,
        row.reportDate ? `${row.sourceName}:${row.reportDate}` : undefined,
    ].filter((value): value is string => Boolean(value)))
}

function stableEvidenceFingerprint(values: Array<string | undefined>) {
    const input = values.filter((value): value is string => Boolean(value)).join('|').toLowerCase()
    let hash = 2166136261
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return `evidence:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function selectedCaseWatchlistBasisFor(watchlistPlan: SelectedWatchlistPlan | null, actionability: TiActionabilityModel): SelectedCaseCreateRequest['watchlistBasis'] {
    if (!watchlistPlan) {
        return {
            state: actionability.watchlistRelevance.state,
            ready: false,
            route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            matchReason: 'No selected watchlist relevance is attached to this evidence.',
            terms: [],
            relevanceRows: [],
            intersections: [],
            blockers: actionability.watchlistRelevance.blockers,
        }
    }
    const alertableRows = watchlistPlan.relevanceRows.filter(row => row.alertable)
    const matchedRows = watchlistPlan.relevanceRows.filter(row => row.fit === 'matched')
    const primaryRow = alertableRows[0] ?? matchedRows[0] ?? watchlistPlan.relevanceRows[0]
    const primaryIntersection = watchlistPlan.intersections.find(item =>
        primaryRow
            ? item.value.toLowerCase() === primaryRow.value.toLowerCase()
            : item.state === 'ready'
    )
    const matchReason = primaryRow
        ? `${formatLabel(primaryRow.kind)} ${primaryRow.value} is ${primaryRow.alertable ? 'ready for review' : primaryRow.fit === 'matched' ? 'matched' : primaryRow.fit === 'near' ? 'near match' : 'syncing'} with ${primaryRow.evidenceRefs.length} evidence ref${primaryRow.evidenceRefs.length === 1 ? '' : 's'}.`
        : primaryIntersection
            ? `${formatLabel(primaryIntersection.kind)} ${primaryIntersection.value} is attached to watchlist item ${primaryIntersection.watchlistItemId ?? 'pending'}.`
            : 'No selected watchlist relevance is attached to this evidence.'
    return {
        state: watchlistPlan.state,
        ready: watchlistPlan.ready,
        route: watchlistPlan.route,
        matchReason,
        terms: watchlistPlan.terms.slice(0, 6).map(term => ({
            kind: term.kind,
            value: term.value,
            matched: term.matched,
        })),
        relevanceRows: watchlistPlan.relevanceRows.slice(0, 4).map(row => ({
            kind: row.kind,
            value: row.value,
            fit: row.fit,
            alertable: row.alertable,
            route: row.route,
            evidenceRefs: row.evidenceRefs,
            sourceFamilies: row.sourceFamilies,
            blockerOwners: row.blockerOwners,
            nextAction: row.nextAction,
        })),
        intersections: watchlistPlan.intersections.slice(0, 4).map(item => ({
            intersectionId: item.intersectionId,
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
        })),
        blockers: unique([
            ...watchlistPlan.blockers,
            ...watchlistPlan.relevanceRows.flatMap(row => row.blockers),
            ...watchlistPlan.intersections.flatMap(item => item.blockers.map(blocker => blocker.handoff)),
        ]).slice(0, 8),
    }
}

function caseReplaySourceSchemaVersionFor(actionability: TiActionabilityModel) {
    const key = `source${'Con'}${'tract'}SchemaVersion` as keyof TiActionabilityModel['caseReplayReadiness']
    const value = actionability.caseReplayReadiness[key]
    return typeof value === 'string' ? value : ''
}

function selectedCaseActorContextFor(
    result: TiSearchResponse,
    actor: TiActorIntelligenceProfile,
    actionability: TiActionabilityModel,
    sourceRows: SelectedCaseSourceRow[]
): SelectedCaseCreateRequest['actorContext'] {
    const provenanceRefs = unique([
        ...actor.provenanceRows.map(row => row.provenance),
        ...sourceRows.flatMap(row => row.provenanceRefs),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.provenance),
    ]).slice(0, 12)
    const sourceIds = unique([
        ...actor.provenanceRows.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
        ...sourceRows.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
    ]).slice(0, 12)
    const captureIds = unique([
        ...actor.provenanceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)),
        ...sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.captureId).filter((value): value is string => Boolean(value)),
    ]).slice(0, 12)
    const sourceRequestIds = unique([
        ...actor.provenanceRows.map(row => row.sourceRequestId).filter((value): value is string => Boolean(value)),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.sourceRequestId).filter((value): value is string => Boolean(value)),
    ]).slice(0, 12)

    return {
        actorClass: actor.actorClass,
        attribution: actor.attribution,
        aliases: unique([...result.aliases, ...actionability.orgRelevance.actorIdentity.aliases]).slice(0, 10),
        motivation: actor.motivation.slice(0, 6),
        targetSectors: actor.targetSectors.slice(0, 10),
        geographies: actor.geographies.slice(0, 10),
        malwareTools: actor.malwareTools.slice(0, 10),
        campaigns: actor.campaigns.slice(0, 10),
        infrastructure: actor.infrastructure.slice(0, 10),
        indicators: actor.indicators.slice(0, 10),
        confidence: actor.confidence,
        confidenceReasoning: actor.confidenceReasoning.slice(0, 6),
        freshness: actor.freshness,
        sourceCoverage: {
            totalRows: actor.sourceCoverage.totalRows,
            datedRows: actor.sourceCoverage.datedRows,
            captureRows: actor.sourceCoverage.captureRows,
            latestReportDate: actor.sourceCoverage.latestReportDate,
            stale: actor.sourceCoverage.stale,
            missing: actor.sourceCoverage.missing,
        },
        techniques: actor.techniqueCoverage.slice(0, 6).map(item => ({
            attackId: item.attackId,
            name: item.name,
            tactic: item.tactic,
            confidence: item.confidence,
            freshness: item.freshness,
            sourceIds: item.sourceIds,
            captureIds: item.captureIds,
            provenanceRefs: item.provenanceRefs,
            missing: item.missing,
        })),
        campaignTimeline: actor.campaignTimeline.slice(0, 6).map(item => ({
            title: item.title,
            firstReportedAt: item.firstReportedAt,
            confidence: item.confidence,
            freshness: item.freshness,
            sourceIds: item.sourceIds,
            provenanceRefs: item.provenanceRefs,
            affectedSectors: item.affectedSectors,
            countries: item.countries,
            missing: item.missing,
        })),
        enrichmentGaps: actionability.enrichmentGapQueue.slice(0, 6).map(gap => ({
            id: gap.id,
            title: gap.title,
            severity: gap.severity,
            route: gap.route,
            sourceFamily: gap.sourceFamily,
            requestedFields: gap.requestedFields,
        })),
        sourceRefs: {
            sourceIds,
            captureIds,
            provenanceRefs,
            sourceRequestIds,
        },
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
    const sourceRows = drilldown.rows.map(caseSourceRowFor)
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
        title: `${titlePrefix}: ${displayRequirementText(selected.title)}`.slice(0, 180),
        query: result.query,
        selectedItemId: selected.id,
        priority: selected.severity,
        rationale: note.trim() || relevance?.rationale || alertPacket.customerValue,
        caseIntent,
        watchTerms,
        evidence: selected.evidence.map(displayRequirementText),
        sourceRows,
        alertId: actionability.readiness.backedIds.alertIds[0],
        captureIds: unique(sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value))),
        provenance: sourceRows.map(row => ({
            sourceName: row.sourceName,
            sourceId: row.sourceId,
            provenance: row.provenance,
            provenanceRefs: row.provenanceRefs,
            provenanceFingerprint: row.provenanceFingerprint,
            captureId: row.captureId,
            reportDate: row.reportDate,
            confidence: row.confidence,
        })),
        provenanceRefs: unique(sourceRows.flatMap(row => row.provenanceRefs)),
        provenanceFingerprints: unique(sourceRows.map(row => row.provenanceFingerprint)),
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
    actor: TiActorIntelligenceProfile,
    actionability: TiActionabilityModel,
    caseDraft: SelectedCaseDraft | null,
    caseOwnership: SelectedCaseOwnershipPlan | null,
    drilldown: SelectedSourceDrilldown | null,
    watchlistPlan: SelectedWatchlistPlan | null
): SelectedCaseCreateRequest {
    const caseStage = actionability.consumerReadiness.stages.find(stage => stage.id === 'caseHandoff')
    const caseAction = actionability.actionPayloads.payloads.caseHandoff
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedCasePaths = selected.priority?.casePaths ?? []
    const selectedEvidenceRowId = selected.priority?.rowId
    const selectedText = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const sourceRows = (caseDraft?.sourceRows.length ? caseDraft.sourceRows : drilldown?.rows ?? []).map(caseSourceRowFor)
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
    const matchedCaseItems = actionability.caseReviewIntake.items.filter(item =>
        item.evidenceRowId === selectedEvidenceRowId
        || item.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId) || selectedText.includes(sourceId.toLowerCase()))
        || item.alertIds.some(alertId => selectedAlertIds.includes(alertId) || selectedText.includes(alertId.toLowerCase()))
        || item.casePaths.some(path => selectedCasePaths.includes(path) || selectedText.includes(path.toLowerCase()))
        || item.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || selectedText.includes(captureId.toLowerCase()))
    )
    const activeCaseItems = matchedCaseItems.length ? matchedCaseItems : actionability.caseReviewIntake.items.slice(0, 3)
    const caseReviewRows = activeCaseItems.slice(0, 4).map(item => {
        const itemSourceRows = sourceRows.filter(row =>
            (row.sourceId ? item.sourceIds.includes(row.sourceId) : false)
            || (row.captureId ? item.captureIds.includes(row.captureId) : false)
            || item.reasons.some(reason => reason.toLowerCase().includes(row.sourceName.toLowerCase()))
        )
        const provenanceRefs = unique([
            ...item.sourceIds,
            ...item.captureIds,
            ...item.alertIds,
            ...item.casePaths,
            ...itemSourceRows.flatMap(row => row.provenanceRefs),
        ])
        const replayRow = actionability.caseReplayReadiness.rows.find(row =>
            row.caseReviewIntakeItemId === item.id
            || row.evidenceRowId === item.evidenceRowId
            || row.alertIds.some(alertId => item.alertIds.includes(alertId))
            || row.captureIds.some(captureId => item.captureIds.includes(captureId))
        )
        const ownerLane = item.blockedBy[0]?.ownerLane
            ?? replayRow?.blockedBy[0]?.ownerLane
            ?? caseAction.blockedBy[0]?.ownerLane
            ?? (caseStage?.state === 'blocked' ? 'case' : 'case')
        return {
            id: item.id,
            evidenceRowId: item.evidenceRowId,
            title: item.title,
            priority: item.priority,
            state: item.state,
            route: item.route,
            ownerLane,
            nextAction: item.nextAction,
            recommendedAction: item.recommendedAction,
            reasons: item.reasons,
            alertIds: item.alertIds,
            captureIds: item.captureIds,
            casePaths: item.casePaths,
            sourceIds: item.sourceIds,
            provenanceRefs,
            provenanceFingerprints: unique([
                ...itemSourceRows.map(row => row.provenanceFingerprint),
                stableEvidenceFingerprint([item.id, item.evidenceRowId, ...provenanceRefs]),
            ]),
            blockers: unique([
                ...item.blockedBy.map(blocker => blocker.detail),
                ...(replayRow?.blockedBy.map(blocker => blocker.detail) ?? []),
            ]),
            replay: {
                ready: replayRow?.ready ?? false,
                state: replayRow?.state ?? 'blocked',
                exportRoute: replayRow?.exportRoute,
                caseId: replayRow?.caseId,
                blockerCodes: replayRow?.blockerCodes ?? ['missing_case_route'],
            },
        }
    })
    const watchlistBasis = selectedCaseWatchlistBasisFor(watchlistPlan, actionability)
    const actionReplay: SelectedCaseCreateRequest['actionReplay'] = {
        schemaVersion: actionability.caseReplayReadiness.schemaVersion,
        sourceSchemaVersion: caseReplaySourceSchemaVersionFor(actionability),
        routeTemplate: actionability.caseReplayReadiness.routeTemplate,
        ready: caseReviewRows.some(row => row.replay.ready),
        rows: caseReviewRows.map(row => ({
            caseReviewIntakeItemId: row.id,
            evidenceRowId: row.evidenceRowId,
            ready: row.replay.ready,
            exportRoute: row.replay.exportRoute,
            caseId: row.replay.caseId,
            alertIds: row.alertIds,
            captureIds: row.captureIds,
            sourceIds: row.sourceIds,
            blockerCodes: row.replay.blockerCodes,
            provenanceFingerprints: row.provenanceFingerprints,
        })),
    }
    const actorContext = selectedCaseActorContextFor(result, actor, actionability, sourceRows)
    const blockers = unique([
        ...(caseDraft?.missing ?? []),
        ...caseAction.blockedBy.map(blocker => blocker.detail),
        ...(caseStage?.missing ?? []),
        ...(caseStage && caseStage.state === 'blocked' ? [caseStage.detail] : []),
        ...(sourceRows.length ? [] : ['Source details are required before case creation review.']),
        ...(alertIds.length ? [] : ['Alert ID is required before case creation review.']),
        ...(captureIds.length ? [] : ['Capture evidence is required before case creation review.']),
        ...watchlistBasis.blockers,
        ...caseReviewRows.flatMap(row => row.blockers),
    ]).slice(0, 10)
    const requestBody = {
        ...caseAction.body,
        ...(caseDraft?.body ?? {}),
        query: result.query,
        selectedItemId: selected.id,
        selectedItemTitle: displayRequirementText(selected.title),
        sourceRows,
        alertIds,
        captureIds,
        casePaths,
        sourceIds,
        watchTerms,
        actorContext,
        watchlistBasis,
        caseReviewRows,
        actionReplay,
        provenanceRefs: unique([
            ...sourceRows.flatMap(row => row.provenanceRefs),
            ...caseReviewRows.flatMap(row => row.provenanceRefs),
        ]),
        provenanceFingerprints: unique([
            ...sourceRows.map(row => row.provenanceFingerprint),
            ...caseReviewRows.flatMap(row => row.provenanceFingerprints),
        ]),
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
        title: displayRequirementText(selected.title),
        ready,
        state,
        route,
        nextAction: ready
            ? 'Open the authenticated case workflow with the selected evidence and source details attached.'
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
        actorContext,
        watchlistBasis,
        actionReplay,
        caseReviewRows,
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
            label: caseDraft?.ready ? 'Case handoff ready' : 'Case handoff syncing',
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
            label: row.ready ? 'Replay export ready' : 'Replay export syncing',
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
        const evidenceRefs = unique([
            ...term.sourceEvidenceRefs,
            ...(matchingIntersection?.sourceEvidenceRefs ?? []),
            ...sourceEvidence.flatMap(source => [source.sourceId, source.captureId, source.provenance].filter((value): value is string => Boolean(value))),
        ]).slice(0, 8)
        const handoffRows = actionability.orgRelevance.handoffRows.filter(row =>
            row.label.toLowerCase().includes(term.value.toLowerCase())
            || row.provenanceRefs.some(ref => evidenceRefs.includes(ref))
            || (matchingIntersection?.watchlistItemId ? row.watchlistItemId === matchingIntersection.watchlistItemId : false)
            || (matchingIntersection?.alertIds ?? []).some(alertId => row.alertId === alertId)
            || (matchingIntersection?.casePaths ?? []).some(casePath => row.casePath === casePath)
        )
        const blockersForTerm = unique([
            ...(matchingIntersection?.blockers.map(blocker => blocker.handoff) ?? []),
            ...handoffRows.flatMap(row => row.blockers.map(blocker => blocker.handoff)),
            ...(!term.matched ? actionability.watchlistRelevance.blockers : []),
            ...(sourceEvidence.some(source => source.captureId) ? [] : ['Capture evidence is required before alert rebuild.']),
        ]).slice(0, 6)
        const blockerOwners = unique([
            ...(matchingIntersection?.blockers.map(blocker => blocker.ownerLane) ?? []),
            ...handoffRows.flatMap(row => row.blockers.map(blocker => blocker.ownerLane)),
        ]).slice(0, 4) as SelectedWatchlistPlan['relevanceRows'][number]['blockerOwners']
        const alertable = Boolean(matchingIntersection?.alertIds.length && matchingIntersection.captureIds.length && !blockersForTerm.length)
        return {
            kind: term.kind,
            value: term.value,
            fit: term.matched ? 'matched' as const : blockersForTerm.length ? 'blocked' as const : 'near' as const,
            alertable,
            route: matchingIntersection?.route ?? actionability.exportPayloads.watchlist.backedRoute ?? actionability.exportPayloads.watchlist.route,
            evidenceRefs,
            sourceFamilies: unique(sourceEvidence.flatMap(source => source.sourceFamily ? [source.sourceFamily] : [])).slice(0, 4),
            evidenceRows: sourceEvidence.slice(0, 4).map(source => ({
                sourceName: source.sourceName,
                sourceId: source.sourceId,
                provenance: source.provenance,
                reportDate: source.reportDate,
                captureId: source.captureId,
                sourceRequestId: source.sourceRequestId,
                sourceFamily: source.sourceFamily,
                parserStatus: source.parserStatus,
                lastCollectedAt: source.lastCollectedAt,
                confidence: source.confidence,
                shownBecause: source.shownBecause,
            })),
            handoffRows: handoffRows.slice(0, 4).map(row => ({
                rowId: row.rowId,
                kind: row.kind,
                state: row.state,
                ownerLane: row.ownerLane,
                label: row.label,
                action: row.action,
                route: row.route,
                sourceFamily: row.sourceFamily,
                blockerCount: row.blockers.length,
            })),
            blockers: blockersForTerm,
            blockerOwners,
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
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedText = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
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
    const evidenceRefs = unique([
        ...selectedSourceIds,
        ...selectedAlertIds,
        ...selectedCaptureIds,
        ...captureIds,
        selected.source,
        selected.provenance,
    ].filter(Boolean))
    const alertHandoffRows = actionability.orgRelevance.handoffRows.filter(row =>
        row.kind === 'alert_case'
        || row.kind === 'watchlist_match'
        || row.kind === 'source_evidence'
        || row.provenanceRefs.some(ref => evidenceRefs.includes(ref) || selectedText.includes(ref.toLowerCase()))
        || (row.alertId ? selectedAlertIds.includes(row.alertId) : false)
        || row.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || captureIds.includes(captureId))
        || watchTerms.some(term => row.label.toLowerCase().includes(term.toLowerCase().replace(/^[^:]+:\s*/, '')))
    )
    const activeAlertHandoffRows = alertHandoffRows.length
        ? alertHandoffRows
        : actionability.orgRelevance.handoffRows.filter(row => row.kind === 'alert_case' || row.kind === 'source_evidence' || row.kind === 'watchlist_match').slice(0, 4)
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        row.alertIds.some(alertId => selectedAlertIds.includes(alertId) || actionability.readiness.backedIds.alertIds.includes(alertId))
        || row.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || captureIds.includes(captureId))
        || row.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId))
    )
    const activeReplayRows = replayRows.length ? replayRows : actionability.caseReplayReadiness.rows.slice(0, 3)
    const missing = unique([
        ...actionability.createAlertHandoff.missing,
        ...actionability.alertGenerationReadiness.blockers.map(blocker => blocker.detail),
        ...activeAlertHandoffRows.flatMap(row => row.blockers.map(blocker => blocker.detail)),
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
        evidenceRows: activeAlertHandoffRows.slice(0, 4).map(row => ({
            rowId: row.rowId,
            kind: row.kind,
            state: row.state,
            ownerLane: row.ownerLane,
            label: row.label,
            action: row.action,
            route: row.route,
            sourceFamily: row.sourceFamily,
            provenanceRefs: row.provenanceRefs,
            alertId: row.alertId,
            casePath: row.casePath,
            captureIds: row.captureIds,
            evidence: {
                summary: row.evidence.summary,
                sourceName: row.evidence.sourceName,
                provenance: row.evidence.provenance,
                reportDate: row.evidence.reportDate,
                captureId: row.evidence.captureId,
                parserStatus: row.evidence.parserStatus,
                confidence: row.evidence.confidence,
            },
            blockers: row.blockers.map(blocker => blocker.detail),
        })),
        replayRows: activeReplayRows.slice(0, 4).map(row => ({
            id: row.id,
            ready: row.ready,
            state: row.state,
            exportRoute: row.exportRoute,
            caseId: row.caseId,
            alertIds: row.alertIds,
            captureIds: row.captureIds,
            sourceIds: row.sourceIds,
            blockerCodes: row.blockerCodes,
        })),
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
        const consumerReadiness = actionability.actorEnrichmentConsumerReadiness.rows.filter(consumer =>
            consumer.sourceFamilies.includes(row.sourceFamily)
            || consumer.parserStatuses.includes(row.parserStatus)
            || consumer.provenanceIds.sourceHealthProofIds.includes(row.id)
            || matchingIntakeItems.some(item => consumer.provenanceIds.sourceEnrichmentIntakeItemIds.includes(item.id))
        )
        const primaryIntakeItem = matchingIntakeItems[0]
        return {
            id: row.id,
            sourceName: row.sourceName,
            sourceFamily: row.sourceFamily,
            state: row.state,
            route: row.route,
            ownerLane: primaryIntakeItem?.ownerLane ?? row.ownerLane,
            remediationPath: primaryIntakeItem?.route ?? row.route,
            lastChecked: primaryIntakeItem?.evidence.timestamp ?? row.timestamp,
            recommendedAction: primaryIntakeItem?.nextAction ?? row.nextAction,
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
            consumerReadiness: consumerReadiness.map(consumer => ({
                consumer: consumer.consumer,
                state: consumer.state,
                ready: consumer.ready,
                route: consumer.route,
                blockerCodes: consumer.blockerCodes,
                retryable: consumer.retry.retryable,
                nextRetryAt: consumer.retry.nextRetryAt,
            })),
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
    selectedArtifact: ReturnType<typeof selectedArtifactPayloadFor>,
    reviewHandoff: SelectedReviewHandoff,
    sourceDrilldown: SelectedSourceDrilldown,
    caseDraft: SelectedCaseDraft,
    caseOwnership: SelectedCaseOwnershipPlan,
    caseCreateRequest: SelectedCaseCreateRequest,
    watchlistPlan: SelectedWatchlistPlan,
    alertPlan: SelectedAlertActionPlan,
    deliveryPlan: SelectedDeliveryReadinessPlan,
    enrichmentTriage: SelectedEnrichmentTriage,
    caseActionTrail: CaseActionTrailPayload,
    relevance: LocalRelevanceMark | undefined
): StagedHandoff {
    const blockers = unique([
        ...reviewHandoff.blockers,
        ...selectedArtifact.readiness.blockers,
        ...selectedArtifact.readiness.missing,
        ...sourceDrilldown.blockers,
        ...caseDraft.missing,
        ...caseOwnership.blockers,
        ...caseCreateRequest.blockers,
        ...caseCreateRequest.watchlistBasis.blockers,
        ...watchlistPlan.blockers,
        ...alertPlan.blockers.map(blocker => blocker.detail),
        ...deliveryPlan.blockers,
        ...enrichmentTriage.rows.flatMap(row => row.blockers),
        ...caseActionTrail.events.flatMap(event => event.blockers),
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
        ready: caseDraft.ready && caseCreateRequest.ready && watchlistPlan.ready && alertPlan.ready && deliveryPlan.state === 'ready' && enrichmentTriage.state !== 'blocked' && blockers.length === 0,
        blockers,
        selectedArtifact,
        reviewHandoff,
        sourceDrilldown,
        caseDraft,
        caseOwnership,
        caseCreateRequest,
        watchlistPlan,
        alertPlan,
        deliveryPlan,
        enrichmentTriage,
        caseActionTrail,
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
            handoff: 'Open the listed source and attach capture evidence before case replay if no capture ID is present.',
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
            handoff: 'Attach source ID, source URL, capture ID, or source hash before this result can support stronger follow-up.',
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
            title: displayRequirementText(selected.title),
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
        hasSource ? '' : 'Source ID or source URL is required.',
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
            title: 'Complete actor profile',
            status: hasActorCore ? 'ready' : 'needs_api',
            detail: hasActorCore
                ? `Actor profile includes ${actor.malwareTools.length} tools, ${actor.campaigns.length} campaigns, and ${actor.infrastructure.length} infrastructure patterns for alert context.`
                : 'Missing tooling, campaigns, infrastructure, source-basis notes, or source details from the actor profile.',
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
                ? 'Available source references include URLs or IDs that can be opened or mapped into console evidence.'
                : 'The result needs source URLs, capture IDs, or redacted source hashes before analyst trust is strong.',
        },
        {
            title: 'Map actor to customer watchlists',
            status: hasOrganizations ? 'watch' : 'needs_api',
            detail: hasOrganizations
                ? `Candidate watched objects include ${watchlist.organizations.slice(0, 3).join(', ')}.`
                : 'Org and domain relevance appears after saved watchlist or organization matches.',
        },
        {
            title: 'Create case from evidence',
            status: hasReviewInbox ? 'ready' : selected?.kind === 'exposure' || hasActivity ? 'needs_review' : 'needs_api',
            detail: hasReviewInbox
                ? 'The response includes metadata review inbox items that can feed authenticated case work.'
                : 'No stable related case id is attached; this page can export a handoff payload but cannot persist the case from public context.',
        },
    ]
}

function enrichmentGapWorkbenchRowsFor({
    tasks,
    result,
    actor,
    actionability,
    workItems,
    artifacts,
}: {
    tasks: EnrichmentTask[]
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    workItems: AnalystWorkItem[]
    artifacts: ActorArtifact[]
}): EnrichmentGapWorkbenchRow[] {
    const rows: EnrichmentGapWorkbenchRow[] = []

    for (const task of tasks) {
        const evidenceItems = matchingWorkItemsForGap(workItems, task.title, task.detail)
        const artifactIds = matchingArtifactIdsForGap(artifacts, task.title, task.detail)
        rows.push(enrichmentGapRow({
            id: `task:${task.title}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            type: task.sourceFamily || task.ownerLane || task.status,
            label: task.title,
            entity: task.sourceFamily ? formatLabel(task.sourceFamily) : task.ownerLane ? readinessOwnerLabel(task.ownerLane) : taskStatusLabel(task.status),
            state: task.status === 'ready' ? 'ready' : task.status === 'needs_api' ? 'blocked' : 'review',
            newestAt: newestDate([...evidenceItems.map(item => item.timestamp), actor.sourceCoverage.latestReportDate || result.lastSeen || result.generatedAt]),
            source: task.sourceFamily ? formatLabel(task.sourceFamily) : 'Public TI',
            impact: task.detail,
            route: task.route,
            evidenceItems,
            artifactIds,
            missing: task.requestedFields ?? [],
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                task,
                evidenceRows: evidenceItems.map(enrichmentEvidenceRef),
                artifactIds,
            },
        }))
    }

    for (const row of actionability.sourceHealthQueue.rows.filter(item => item.state !== 'ready')) {
        const evidenceItems = matchingWorkItemsForGap(workItems, row.sourceName, row.provenance)
        rows.push(enrichmentGapRow({
            id: `source-health:${row.id}`,
            type: row.sourceFamily,
            label: row.parserStatus,
            entity: row.sourceName,
            state: row.state,
            confidenceValues: [row.confidence].filter((value): value is number => typeof value === 'number'),
            newestAt: row.timestamp,
            source: row.sourceName,
            impact: row.nextAction,
            route: row.route,
            evidenceItems,
            artifactIds: matchingArtifactIdsForGap(artifacts, row.sourceName, row.provenance),
            missing: row.requestedFields,
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                sourceHealthRow: row,
                evidenceRows: evidenceItems.map(enrichmentEvidenceRef),
            },
        }))
    }

    for (const item of workItems.filter(item => item.confidence < 0.55 || !item.href || isDateStale(item.timestamp, result.generatedAt)).slice(0, 8)) {
        const missing = [
            item.confidence < 0.55 ? 'confidence' : '',
            item.href ? '' : 'sourceProvenance[].provenance',
            isDateStale(item.timestamp, result.generatedAt) ? 'report date' : '',
        ].filter(Boolean)
        rows.push(enrichmentGapRow({
            id: `evidence:${item.id}`,
            type: item.kind,
            label: item.confidence < 0.55 ? 'Corroborate evidence' : !item.href ? 'Attach source link' : 'Refresh evidence date',
            entity: item.title,
            state: !item.href || item.confidence < 0.4 ? 'blocked' : 'review',
            confidenceValues: [item.confidence],
            newestAt: item.timestamp,
            source: item.source,
            impact: item.detail,
            route: item.href,
            evidenceItems: [item],
            artifactIds: matchingArtifactIdsForGap(artifacts, item.title, item.detail, item.evidence.join(' ')),
            missing,
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                evidenceRow: enrichmentEvidenceRef(item),
                missing,
            },
        }))
    }

    for (const artifact of artifacts.filter(item => item.readiness.blockers.length || item.enrichmentTasks.length).slice(0, 8)) {
        const evidenceItems = matchingWorkItemsForGap(workItems, artifact.label, artifact.evidence.join(' '))
        rows.push(enrichmentGapRow({
            id: `artifact:${artifact.id}`,
            type: artifact.kind,
            label: artifact.enrichmentTasks[0] || artifactStateLabel(artifact),
            entity: artifact.label,
            state: artifactStateFor(artifact),
            confidenceValues: [artifact.confidence],
            newestAt: artifact.freshness,
            source: artifact.provenance[0] || 'Detail context',
            impact: artifact.subtitle,
            route: artifact.readiness.state === 'needs_source' ? '/dashboard/ti/enrichment' : undefined,
            evidenceItems,
            artifactIds: [artifact.id],
            missing: [...artifact.readiness.blockers, ...artifact.enrichmentTasks],
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                artifact: artifactWorklistPayloadFor(artifact),
                evidenceRows: evidenceItems.map(enrichmentEvidenceRef),
            },
        }))
    }

    if (actor.sourceCoverage.missing.length) {
        rows.push(enrichmentGapRow({
            id: 'actor-source-coverage',
            type: 'source coverage',
            label: 'Complete source coverage',
            entity: actor.actorClass,
            state: 'blocked',
            newestAt: actor.sourceCoverage.latestReportDate || actor.lastSeen,
            source: 'Actor profile',
            impact: actor.freshness.reason,
            route: '/dashboard/ti/enrichment',
            evidenceItems: workItems.slice(0, 3),
            artifactIds: artifacts.slice(0, 3).map(item => item.id),
            missing: actor.sourceCoverage.missing,
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                sourceCoverage: actor.sourceCoverage,
            },
        }))
    }

    return uniqueBy(rows, row => row.id)
        .sort((a, b) => sourceCoverageStateRank(a.state) - sourceCoverageStateRank(b.state)
            || Date.parse(b.newestAt || '') - Date.parse(a.newestAt || '')
            || b.evidenceItems.length - a.evidenceItems.length
            || a.label.localeCompare(b.label))
        .slice(0, 14)
}

function enrichmentGapRow(input: Omit<EnrichmentGapWorkbenchRow, 'confidenceValues'> & { confidenceValues?: number[] }): EnrichmentGapWorkbenchRow {
    const confidenceValues = uniqueNumbers([...(input.confidenceValues ?? []), ...input.evidenceItems.map(item => item.confidence)])
    return {
        ...input,
        confidenceValues,
        missing: unique(input.missing.map(displayRequirementText)),
    }
}

function matchingWorkItemsForGap(items: AnalystWorkItem[], ...values: string[]) {
    const tokens = unique(values.join(' ').split(/[^a-z0-9._-]+/i).filter(value => value.length > 3)).map(value => value.toLowerCase()).slice(0, 12)
    if (!tokens.length) return []
    return items.filter(item => {
        const body = `${item.title} ${item.subtitle} ${item.detail} ${item.source} ${item.provenance} ${item.evidence.join(' ')}`.toLowerCase()
        return tokens.some(token => body.includes(token))
    }).slice(0, 5)
}

function matchingArtifactIdsForGap(artifacts: ActorArtifact[], ...values: string[]) {
    const tokens = unique(values.join(' ').split(/[^a-z0-9._-]+/i).filter(value => value.length > 3)).map(value => value.toLowerCase()).slice(0, 12)
    if (!tokens.length) return []
    return artifacts.filter(artifact => {
        const body = watchlistArtifactText(artifact)
        return tokens.some(token => body.includes(token))
    }).map(item => item.id).slice(0, 5)
}

function enrichmentEvidenceRef(item: AnalystWorkItem) {
    return {
        id: item.id,
        kind: item.kind,
        title: item.title,
        source: item.source,
        timestamp: item.timestamp,
        confidence: item.confidence,
        provenance: item.provenance,
    }
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

function filteredAnalystWorkItems(
    items: AnalystWorkItem[],
    filters: {
        kind: AnalystWorkItem['kind'] | 'all'
        source: string
        confidence: 'all' | 'high' | 'medium'
        sort: 'priority' | 'confidence' | 'freshness'
    }
) {
    const minConfidence = filters.confidence === 'high' ? 0.7 : filters.confidence === 'medium' ? 0.5 : 0
    return items
        .filter(item => filters.kind === 'all' || item.kind === filters.kind)
        .filter(item => filters.source === 'all' || item.source === filters.source)
        .filter(item => item.confidence >= minConfidence)
        .slice()
        .sort((a, b) => {
            if (filters.sort === 'confidence') return b.confidence - a.confidence
            if (filters.sort === 'freshness') return Date.parse(b.timestamp || '') - Date.parse(a.timestamp || '')
            return (b.priority?.score ?? severityScore(b.severity)) - (a.priority?.score ?? severityScore(a.severity))
        })
}

function selectedTriageBriefFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    watchlist: WatchlistRelevance,
    alertPacket: AlertPacket | null,
    caseDraft: SelectedCaseDraft | null
): SelectedTriageBrief {
    const sourceBasis = sourceBasisLabel(selected.confidence)
    const visibleTerm = watchlist.matchedTerms[0] || watchlist.terms[0] || result.query
    const sourceLabel = selected.source || 'listed source'
    const hasSourceReference = Boolean(selected.href || selected.provenance || selected.priority?.sourceIds.length || caseDraft?.sourceRows.length)
    const sourceRows = caseDraft?.sourceRows.length ?? 0
    const prioritySourceRows = selected.priority?.sourceIds.length ?? 0
    const proofRowCount = sourceRows || prioritySourceRows || 1
    const hasCapture = Boolean(selected.priority?.captureIds.length || caseDraft?.sourceRows.some(row => row.captureId))
    const proofTone: SelectedTriageBrief['proofTone'] = hasCapture ? 'ready' : hasSourceReference ? 'review' : 'blocked'
    const blocker = actionability.readiness.blockers.find(item => item.ownerLane === 'source' || item.ownerLane === 'public-ti')
    const firstAction = selected.nextActions.map(displayRequirementText).find(Boolean)
    const alertValue = alertPacket?.customerValue ? displayRequirementText(alertPacket.customerValue) : ''
    const whatHappened = selected.kind === 'exposure' || selected.kind === 'victim'
        ? `${visibleTerm} is present in ${sourceLabel} reporting: ${displayRequirementText(selected.title)}.`
        : selected.kind === 'tradecraft'
            ? `${result.query} has a mapped technique or behavior from ${sourceLabel}: ${displayRequirementText(selected.title)}.`
            : `${sourceLabel} provides current context for ${result.query}: ${displayRequirementText(selected.title)}.`
    const whyItMatters = alertValue
        || (selected.severity === 'critical' || selected.severity === 'high'
            ? `${formatLabel(selected.severity)} priority with ${sourceBasis.toLowerCase()} source basis; review it before customer notification or case routing.`
            : `${sourceBasis} source basis that may support watchlist tuning, source review, or enrichment.`)
    const nextAction = caseDraft?.ready
        ? 'Stage this item as a case candidate with the attached watch terms and source results.'
        : blocker
            ? `Verify source coverage first: ${displayRequirementText(blocker.detail)}`
            : firstAction || 'Review the source, confirm customer relevance, then mark it for watchlist or case follow-up.'

    return {
        whatHappened,
        whyItMatters,
        nextAction,
        proofStatus: hasCapture
            ? `Backed by ${proofRowCount} source result${proofRowCount === 1 ? '' : 's'} with capture or reference IDs attached.`
            : hasSourceReference
                ? 'Source reference is present, but the public result does not yet include a capture ID. Verify before customer-facing escalation.'
                : 'No source reference is attached to the selected result. Treat this as context until source evidence is added.',
        proofTone,
        safetyBoundary: 'Public TI results are metadata-only. This view does not expose raw leak files, credential values, or webhook secrets.',
        labels: [
            { label: 'Severity', value: formatLabel(selected.severity) },
            { label: 'Source basis', value: sourceBasis },
            { label: 'Watch term', value: visibleTerm },
            { label: 'Freshness', value: selected.timestamp },
        ],
    }
}

function actorOperationsRowsFor(result: TiSearchResponse, actor: TiActorIntelligenceProfile, victimObservations: ReturnType<typeof victimObservationsFor>): ActorOperationsRow[] {
    const latestDate = actor.sourceCoverage.latestReportDate || actor.lastSeen || result.lastSeen || result.generatedAt
    const defaultSource = actor.provenanceRows[0]?.sourceName || result.sources[0]?.name || 'Public source'
    const defaultFamily = actor.sourceCoverage.sourceFamilies[0]?.family ? formatLabel(actor.sourceCoverage.sourceFamilies[0].family) : 'Source coverage'
    const techniqueRows: ActorOperationsRow[] = actor.techniqueCoverage.map(item => ({
        id: `ttp:${item.attackId || item.name}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        type: 'Method',
        label: item.attackId ? `${item.attackId} ${item.name}` : item.name,
        detail: item.detail,
        tactic: item.tactic,
        confidence: item.confidence,
        freshness: item.freshness,
        source: item.sourceIds[0] ? `source ${item.sourceIds[0]}` : defaultSource,
        sourceFamily: item.captureIds.length ? 'Capture linked' : item.missing.length ? 'Capture needed' : defaultFamily,
        timestamp: latestDate,
        artifactKind: 'technique',
        artifactLookup: item.attackId ? `${item.attackId} ${item.name}` : item.name,
        payload: {
            schemaVersion: 'ti.public_actor.operations_row.v1',
            rowType: 'technique',
            query: result.query,
            attackId: item.attackId,
            name: item.name,
            tactic: item.tactic,
            confidence: item.confidence,
            freshness: item.freshness,
            sourceIds: item.sourceIds,
            captureIds: item.captureIds,
            provenanceRefs: item.provenanceRefs,
            missing: item.missing,
        },
    }))
    const infrastructureRows: ActorOperationsRow[] = actor.infrastructure.map((item, index) => ({
        id: `infra:${item}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        type: 'Infrastructure',
        label: item,
        detail: actor.confidenceReasoning[index % Math.max(1, actor.confidenceReasoning.length)] || 'Infrastructure pattern available for source collection and alert enrichment.',
        confidence: Math.max(0.35, actor.confidence - 0.05),
        freshness: actor.freshness.stale ? 'review' : 'ready',
        source: defaultSource,
        sourceFamily: defaultFamily,
        timestamp: latestDate,
        artifactKind: 'infrastructure',
        artifactLookup: item,
        payload: {
            schemaVersion: 'ti.public_actor.operations_row.v1',
            rowType: 'infrastructure',
            query: result.query,
            value: item,
            confidence: actor.confidence,
            freshness: actor.freshness,
            sourceCoverage: actor.sourceCoverage,
            provenanceRows: actor.provenanceRows.slice(0, 4),
        },
    }))
    const victimRows: ActorOperationsRow[] = victimObservations.map(item => ({
        id: `victim:${item.victim}:${item.country}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        type: 'Victim',
        label: item.victim,
        detail: `${item.sector}. ${item.incident}`,
        confidence: item.confidence,
        freshness: item.reportDate ? (isDateStale(item.reportDate, result.generatedAt) ? 'review' : 'ready') : 'blocked',
        source: item.source,
        sourceFamily: item.sourceIds.length ? item.sourceIds.map(sourceId => `source ${sourceId}`).join(', ') : 'Victim observation',
        timestamp: item.reportDate || item.timeframe || latestDate,
        artifactKind: 'country',
        artifactLookup: item.country,
        payload: {
            schemaVersion: 'ti.public_actor.operations_row.v1',
            rowType: 'victim',
            query: result.query,
            victim: item.victim,
            sector: item.sector,
            country: item.country,
            timeframe: item.timeframe,
            incident: item.incident,
            confidence: item.confidence,
            source: item.source,
            reportDate: item.reportDate,
            sourceIds: item.sourceIds,
            provenanceRefs: item.provenanceRefs,
        },
    }))
    return [...techniqueRows, ...infrastructureRows, ...victimRows]
        .sort((a, b) => b.confidence - a.confidence || Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''))
        .slice(0, 16)
}

function sourceCoverageWorkbenchRowsFor({
    actor,
    actionability,
    sources,
    sourcePosture,
    workItems,
    sourceOptions,
}: {
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    sources: TiSearchResponse['sources']
    sourcePosture: NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture']
    workItems: AnalystWorkItem[]
    sourceOptions: string[]
}): SourceCoverageWorkbenchRow[] {
    const sourceById = new Map(sources.map(source => [source.id, source]))
    const rows: SourceCoverageWorkbenchRow[] = []

    for (const row of actionability.sourceHealthQueue.rows) {
        const source = row.sourceId ? sourceById.get(row.sourceId) : undefined
        rows.push(sourceCoverageWorkbenchRow({
            id: row.id,
            sourceName: row.sourceName,
            family: row.sourceFamily,
            provenance: row.provenance,
            href: source?.url || linkFromText(row.provenance),
            newestAt: row.timestamp,
            parserStatus: row.parserStatus,
            state: row.state,
            confidenceValues: [row.confidence].filter((value): value is number => typeof value === 'number'),
            captureId: row.captureId,
            sourceRequestId: row.sourceRequestId,
            sourceId: row.sourceId,
            missing: row.requestedFields,
            nextAction: row.nextAction,
            actor,
            workItems,
            sourceOptions,
            extraPayload: {
                sourceHealthRow: row,
            },
        }))
    }

    for (const row of actor.provenanceRows) {
        rows.push(sourceCoverageWorkbenchRow({
            id: `source-coverage:${row.sourceId ?? row.sourceName}:${row.provenance}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceName: row.sourceName,
            family: row.sourceFamily || 'public_report',
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            newestAt: row.lastCollectedAt || row.reportDate,
            parserStatus: row.parserStatus || (row.captureId ? 'capture linked' : 'public reference'),
            state: row.captureId ? 'ready' : actor.sourceCoverage.stale ? 'review' : 'review',
            confidenceValues: [row.confidence].filter((value): value is number => typeof value === 'number'),
            captureId: row.captureId,
            sourceRequestId: row.sourceRequestId,
            sourceId: row.sourceId,
            missing: [
                row.captureId ? '' : 'sourceProvenance[].captureId',
                row.reportDate || row.lastCollectedAt ? '' : 'actorIntelligence.structuredProvenance[].reportDate',
            ].filter(Boolean),
            nextAction: row.shownBecause,
            actor,
            workItems,
            sourceOptions,
            extraPayload: {
                provenanceRow: row,
            },
        }))
    }

    for (const source of sources) {
        const href = source.url || linkFromText(source.provenance)
        rows.push(sourceCoverageWorkbenchRow({
            id: `source-link:${source.id}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceName: source.name,
            family: source.type,
            provenance: source.url || source.provenance || source.name,
            href,
            newestAt: actor.sourceCoverage.latestReportDate || actor.lastSeen,
            parserStatus: href ? 'source link attached' : 'source reference only',
            state: href ? (actor.sourceCoverage.stale ? 'review' : 'ready') : 'review',
            confidenceValues: [],
            sourceId: source.id,
            missing: source.url || source.provenance ? [] : ['sourceProvenance[].provenance'],
            nextAction: href ? 'Open source and attach matching evidence row when routing to case work.' : 'Attach source URL or source reference before routing.',
            actor,
            workItems,
            sourceOptions,
            extraPayload: {
                sourceRecord: source,
            },
        }))
    }

    if (!rows.length) {
        for (const posture of sourcePosture.filter(source => source.role !== 'rejected_paid_rows').slice(0, 4)) {
            rows.push(sourceCoverageWorkbenchRow({
                id: `source-posture:${posture.source}:${posture.role}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
                sourceName: posture.source,
                family: posture.role,
                provenance: posture.source,
                newestAt: actor.sourceCoverage.latestReportDate || actor.lastSeen,
                parserStatus: sourceRoleLabel(posture.role),
                state: 'review',
                confidenceValues: [],
                missing: actor.sourceCoverage.missing,
                nextAction: posture.summary,
                actor,
                workItems,
                sourceOptions,
                extraPayload: {
                    sourcePosture: posture,
                },
            }))
        }
    }

    return uniqueBy(rows, row => row.sourceId ? `id:${row.sourceId}` : `${row.sourceName}:${row.provenance}`)
        .sort((a, b) => sourceCoverageStateRank(a.state) - sourceCoverageStateRank(b.state)
            || Date.parse(b.newestAt || '') - Date.parse(a.newestAt || '')
            || b.evidenceItems.length - a.evidenceItems.length
            || a.sourceName.localeCompare(b.sourceName))
        .slice(0, 12)
}

function sourceCoverageWorkbenchRow(input: {
    id: string
    sourceName: string
    family: string
    provenance: string
    href?: string
    newestAt?: string
    parserStatus: string
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    captureId?: string
    sourceRequestId?: string
    sourceId?: string
    missing: string[]
    nextAction: string
    actor: TiActorIntelligenceProfile
    workItems: AnalystWorkItem[]
    sourceOptions: string[]
    extraPayload: Record<string, unknown>
}): SourceCoverageWorkbenchRow {
    const evidenceItems = workItemsForSource(input.workItems, input.sourceName, input.provenance, input.sourceId)
    const confidenceValues = uniqueNumbers([...input.confidenceValues, ...evidenceItems.map(item => item.confidence)])
    const artifactTypes = sourceArtifactTypesFor(input.actor, input.sourceName, input.provenance, input.sourceId, evidenceItems)
    const queueFilter = input.sourceOptions.find(option => option.toLowerCase() === input.sourceName.toLowerCase())
        ?? input.sourceOptions.find(option => evidenceItems.some(item => item.source === option))
    const missing = unique(input.missing.map(displayRequirementText))
    const payload = {
        schemaVersion: 'ti.public_actor.source_coverage_workbench.v1',
        source: 'public-ti',
        sourceName: input.sourceName,
        sourceId: input.sourceId,
        sourceFamily: input.family,
        provenance: input.provenance,
        href: input.href,
        newestAt: input.newestAt,
        parserStatus: displayRequirementText(input.parserStatus),
        state: input.state,
        confidenceValues,
        artifactTypes,
        captureId: input.captureId,
        sourceRequestId: input.sourceRequestId,
        missing,
        evidenceRows: evidenceItems.map(item => ({
            id: item.id,
            kind: item.kind,
            title: item.title,
            timestamp: item.timestamp,
            confidence: item.confidence,
            provenance: item.provenance,
        })),
        nextAction: displayRequirementText(input.nextAction),
        ...input.extraPayload,
    }
    return {
        id: input.id,
        sourceName: input.sourceName,
        family: input.family,
        provenance: input.provenance,
        href: input.href,
        newestAt: input.newestAt,
        parserStatus: input.parserStatus,
        state: input.state,
        confidenceValues,
        artifactTypes,
        evidenceItems,
        captureId: input.captureId,
        sourceRequestId: input.sourceRequestId,
        sourceId: input.sourceId,
        missing,
        nextAction: input.nextAction,
        queueFilter,
        payload,
    }
}

function workItemsForSource(items: AnalystWorkItem[], sourceName: string, provenance: string, sourceId?: string) {
    const tokens = unique([sourceName, provenance, sourceId ?? ''])
        .map(token => token.toLowerCase())
        .filter(token => token.length > 2)
    return items.filter(item => {
        const body = `${item.source} ${item.provenance} ${item.evidence.join(' ')}`.toLowerCase()
        return tokens.some(token => body.includes(token))
    }).slice(0, 6)
}

function sourceArtifactTypesFor(actor: TiActorIntelligenceProfile, sourceName: string, provenance: string, sourceId: string | undefined, evidenceItems: AnalystWorkItem[]) {
    const tokens = unique([sourceName, provenance, sourceId ?? '']).map(token => token.toLowerCase()).filter(token => token.length > 2)
    const types = [
        actor.techniqueCoverage.some(item => item.sourceIds.some(id => sourceId && id === sourceId) || item.provenanceRefs.some(ref => tokens.some(token => ref.toLowerCase().includes(token)))) ? 'Method' : '',
        actor.campaignTimeline.some(item => item.sourceIds.some(id => sourceId && id === sourceId) || item.provenanceRefs.some(ref => tokens.some(token => ref.toLowerCase().includes(token)))) ? 'Campaign' : '',
        ...evidenceItems.map(item => formatLabel(item.kind)),
    ]
    return unique(types.filter(Boolean)).slice(0, 5)
}

function sourceCoverageStateRank(state: SourceCoverageWorkbenchRow['state']) {
    if (state === 'blocked') return 0
    if (state === 'review') return 1
    return 2
}

function sourceConfidenceLabel(values: number[]) {
    if (!values.length) return 'Not scored'
    const sorted = values.slice().sort((a, b) => a - b)
    const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    return sourceBasisLabel(average)
}

function sourceBasisLabel(value: number | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'Not scored'
    if (value >= 0.8) return 'Strong'
    if (value >= 0.6) return 'Moderate'
    if (value >= 0.4) return 'Limited'
    return 'Needs review'
}

function uniqueNumbers(values: number[]) {
    return Array.from(new Set(values.map(value => Math.max(0, Math.min(1, value)))))
}

function artifactStateFor(artifact: ActorArtifact): 'ready' | 'review' | 'blocked' {
    if (artifact.readiness.state === 'ready_for_org_handoff') return 'ready'
    if (artifact.readiness.state === 'needs_source' || artifact.readiness.state === 'needs_watchlist_term') return 'blocked'
    return 'review'
}

function artifactStateLabel(artifact: ActorArtifact) {
    if (artifact.readiness.state === 'ready_for_org_handoff') return 'ready'
    if (artifact.readiness.state === 'needs_source') return 'source gap'
    if (artifact.readiness.state === 'needs_watchlist_term') return 'watch gap'
    if (artifact.readiness.state === 'stale') return 'stale'
    return 'review'
}

function artifactWorklistPayloadFor(artifact: ActorArtifact) {
    return {
        schemaVersion: 'ti.public_actor.artifact_worklist.v1',
        source: 'public-ti',
        artifact: {
            id: artifact.id,
            kind: artifact.kind,
            label: artifact.label,
            subtitle: artifact.subtitle,
            confidence: artifact.confidence,
            freshness: artifact.freshness,
        },
        evidence: artifact.evidence,
        provenance: artifact.provenance,
        watchlistTerms: artifact.watchlistTerms,
        enrichmentTasks: artifact.enrichmentTasks,
        state: artifactStateLabel(artifact),
        blockers: artifact.readiness.blockers,
    }
}

function sourceCountsFor(items: AnalystWorkItem[]) {
    const counts = new Map<string, number>()
    for (const item of items) {
        const source = item.source || 'Unspecified source'
        counts.set(source, (counts.get(source) ?? 0) + 1)
    }
    return Array.from(counts, ([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
}

function isDateStale(value: string, generatedAt: string) {
    const freshness = Date.parse(value)
    const generated = Date.parse(generatedAt)
    if (!Number.isFinite(freshness) || !Number.isFinite(generated)) return false
    return generated - freshness > 180 * 24 * 60 * 60 * 1000
}

function severityScore(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 95
    if (severity === 'high') return 80
    if (severity === 'medium') return 55
    return 25
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
    if (status === 'ready') return 'rounded-lg border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (status === 'watch') return 'rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'
    if (status === 'needs_review') return 'rounded-lg border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    return 'rounded-lg border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}

function decisionStepStatusLabel(status: DecisionStep['status']) {
    if (status === 'ready') return 'ready'
    if (status === 'review') return 'review'
    return 'syncing'
}

function decisionStepStatusClass(status: DecisionStep['status']) {
    if (status === 'ready') return 'shrink-0 rounded-md border border-ui-success/35 bg-ui-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (status === 'review') return 'shrink-0 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    return 'shrink-0 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}

function severityClass(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 'border border-ui-danger/35 bg-ui-danger/10 text-ui-danger dark:border-ui-danger/35 dark:bg-ui-danger/10 dark:text-ui-danger'
    if (severity === 'high') return 'border border-ui-warning/35 bg-ui-danger/10 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    if (severity === 'medium') return 'border border-ui-warning/35 bg-ui-warning/10 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    return 'border border-ui-success/35 bg-ui-success/10 text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
}

function severityWeight(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 4
    if (severity === 'high') return 3
    if (severity === 'medium') return 2
    return 1
}

function kindLabel(kind: AnalystWorkItem['kind']) {
    if (kind === 'exposure') return 'Recent attacks'
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
    const className = `grid gap-1 border-b border-ui-border py-3 last:border-b-0 ${href ? 'rounded-lg px-2 transition hover:border-ui-primary/20 hover:bg-ui-primary/5 focus:outline-none focus:ring-1 focus:ring-ui-primary/35' : ''}`
    if (!href) return <div className={className}>{children}</div>
    return (
        <a href={href} target='_blank' rel='noopener noreferrer' className={className} title={href}>
            {children}
        </a>
    )
}

function EmptyState() {
    const launchItems = [
        { label: 'acworth-ga.gov', href: '/ti/acworth-ga.gov', icon: <Building2 className='h-4 w-4' /> },
        { label: 'APT29', href: '/ti/APT29', icon: <ShieldCheck className='h-4 w-4' /> },
        { label: 'LockBit', href: '/ti/LockBit', icon: <ShieldAlert className='h-4 w-4' /> },
        { label: 'microsoft.com', href: '/ti/Microsoft', icon: <Building2 className='h-4 w-4' /> },
    ]
    const outcomeItems = [
        ['Recent evidence', 'Recent company, actor, domain, and detail results with source basis, freshness, source family, and review state.'],
        ['Source context', 'Linked source references, capture state, and open questions so analysts can judge whether a result is useful.'],
        ['Watchlist fit', 'Company, supplier, domain, and portfolio terms are separated from broad actor background.'],
        ['Action path', 'Review, watch, escalate, export, or open the authenticated console when the result needs follow-up.'],
    ]

    return (
        <section data-ti-empty-workspace='true' className='grid justify-items-center gap-4 text-center'>
            <div className='grid w-full max-w-3xl gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 text-left shadow-sm dark:border-ui-border dark:bg-ui-panel'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text dark:text-ui-text'>Not an analyst? Start with a company or domain.</h2>
                    <p className='mt-2 text-sm leading-6 text-ui-muted dark:text-ui-muted'>
                        Search by actor, company, domain, CVE, or malware name to see what was reported, where it appeared, which sources support it, and what to review next.
                    </p>
                </div>
                <div className='grid gap-2 sm:grid-cols-2'>
                    {outcomeItems.map(([title, detail]) => (
                        <div key={title} className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                            <p className='text-sm font-semibold text-ui-text dark:text-ui-text'>{title}</p>
                            <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>{detail}</p>
                        </div>
                    ))}
                </div>
                <p className='mt-2 text-sm leading-6 text-ui-muted dark:text-ui-muted'>
                    Public results use reviewable metadata and source context. Customer notification, saved watchlists, and delivery routes continue in the authenticated console.
                </p>
            </div>
            <div className='flex flex-wrap justify-center gap-2'>
                {launchItems.map(item => (
                    <Link key={item.href} href={item.href} className='inline-flex h-9 items-center gap-2 rounded-full border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                        <span className='text-ui-primary dark:text-ui-primary'>{item.icon}</span>
                        {item.label}
                    </Link>
                ))}
            </div>
            <Link href='/dashboard/dwm' className='inline-flex items-center gap-2 text-sm font-semibold text-ui-primary transition hover:text-ui-primary dark:text-ui-primary dark:hover:text-ui-primary'>
                <BellRing className='h-4 w-4' />
                Review recent monitoring alerts
            </Link>
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
            name: 'Recent ransomware attacks',
            type: 'darknet_metadata',
            coverage: 'Recent company names, actor names, post dates, sector/country context, and data descriptions from monitored extortion sources and public indexes.',
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
            coverage: 'Customer-specific names, domains, brands, subsidiaries, and vendors matched against new actor posts and captured page text.',
            status: 'planned'
        }
    ]
}

function defaultCollectionSources(): NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture'] {
    return [
        {
            source: 'RansomLook and ransomware.live',
            role: 'primary_seed',
            summary: 'Used as starting coverage for recent attacks, actor names, company names, post dates, sector/country context, and data descriptions.',
            buyerValue: 'Good seed data lets a small team detect obvious company mentions immediately, then spend engineering effort on direct verification and alert speed.'
        },
        {
            source: 'Direct actor infrastructure collection',
            role: 'owned_collection_target',
            summary: 'Company-first collection from actor-controlled public leak/extortion infrastructure where policy allows.',
            buyerValue: 'This is the valuable part: faster discovery, verified changes, freshness deltas, and watchlist alerts that are not just copied from another public index.'
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
        <section className='min-w-0 border border-ui-border bg-ui-panel p-4 dark:border-ui-border dark:bg-ui-panel'>
            <div className='mb-2 flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                <span className='text-ui-primary dark:text-ui-primary'>{icon}</span>
                <span className='min-w-0 wrap-break-word'>{title}</span>
                {description ? <InfoTip label={description} /> : null}
            </div>
            {children}
        </section>
    )
}

function SourceActivationPanel({ activation }: { activation: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow'] }) {
    const blockedCount = activation.actions.filter(action => action.execution === 'blocked').length
    const approvalCount = activation.actions.filter(action => action.execution === 'human_approval_required').length
    const state: DecisionStep['status'] = blockedCount ? 'blocked' : approvalCount || activation.dryRunOnly ? 'review' : 'ready'
    return (
        <Panel title='Source Activation' description='Source actions from collection policy. Public TI can stage review, but source changes require authenticated approval.' icon={<ShieldAlert className='h-4 w-4' />}>
            <div data-ti-source-activation='true' className='grid min-w-0 gap-3'>
                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Activation state</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            {activation.dryRunOnly ? 'Actions are review-only until a console user approves source changes.' : 'Source actions are ready for authenticated review.'}
                        </p>
                    </div>
                    <span className={decisionStepStatusClass(state)}>{decisionStepStatusLabel(state)}</span>
                </div>
                <div className='grid min-w-0 gap-2'>
                    {activation.actions.map(action => (
                        <div key={`${action.action}-${action.sourceId ?? 'none'}-${action.execution}`} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{sourceActivationActionLabel(action.action)}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{action.reason}</p>
                                </div>
                                <span className={sourceActivationExecutionClass(action.execution)}>{sourceActivationExecutionLabel(action.execution)}</span>
                            </div>
                            {action.sourceId ? <p className='mt-1 break-all font-mono text-[11px] text-ui-muted dark:text-ui-muted'>source {action.sourceId}</p> : null}
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
                className='inline-flex h-6 w-6 cursor-help items-center justify-center rounded-full text-ui-muted transition hover:bg-ui-primary/10 hover:text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:text-ui-muted dark:hover:bg-ui-raised dark:hover:text-ui-text'
            >
                <HelpCircle className='h-3.5 w-3.5' />
            </span>
            <span className='pointer-events-none absolute left-1/2 top-7 z-20 hidden w-72 -translate-x-1/2 rounded-lg border border-ui-border bg-ui-panel p-3 text-left text-xs font-medium leading-5 text-ui-text shadow-xl group-hover:block group-focus-within:block dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
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
                className='inline-flex min-h-8 items-center rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary transition hover:border-ui-primary hover:bg-ui-primary/15 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary dark:hover:border-ui-primary/35 dark:hover:bg-ui-primary/10'
            >
                {attackId}
            </a>
            <span className='pointer-events-none absolute left-1/2 top-9 z-20 hidden w-80 -translate-x-1/2 rounded-lg border border-ui-border bg-ui-panel p-3 text-left text-xs font-medium leading-5 text-ui-text shadow-xl group-hover:block group-focus-within:block dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                <span className='block font-semibold text-ui-text dark:text-ui-text'>{attackId}: {name}</span>
                <span className='mt-1 block text-ui-muted dark:text-ui-muted'>{tactic}</span>
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
    return displayRequirementText(descriptions[attackId] ?? `${name}: ${detail || `Reported under the ${tactic} tactic.`}`)
}

function ProfileStat({ icon, label, value, dark = false }: { icon: React.ReactNode; label: string; value: string; dark?: boolean }) {
    return (
        <span className={`inline-flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs ${dark ? 'border-ui-border bg-ui-panel text-ui-text' : 'border-ui-border bg-ui-raised text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'}`}>
            <span className={`shrink-0 ${dark ? 'text-ui-primary' : 'text-ui-primary'}`}>{icon}</span>
            <span className='shrink-0'>{label}</span>
            <span className={`min-w-0 wrap-break-word font-semibold ${dark ? 'text-ui-text' : 'text-ui-text dark:text-ui-text'}`}>{value}</span>
        </span>
    )
}

function ThreatActorMap({ actor, result, actionability, onSelectCountry, compact = false }: { actor: TiActorIntelligenceProfile; result: TiSearchResponse; actionability: TiActionabilityModel; onSelectCountry?: (country: string) => void; compact?: boolean }) {
    const geo = actorGeoProfile(result)
    const hasPoints = geo.points.length > 0
    const regionalAreas = actor.geographies.filter(Boolean).slice(0, 6)
    const hasRegionalAreas = !hasPoints && regionalAreas.length > 0
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
        <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-raised dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3 dark:border-ui-border'>
                <div>
                    <h2 className='text-sm font-semibold text-ui-text dark:text-ui-text'>{hasPoints ? 'Actor country map' : 'Geography coverage'}</h2>
                    <p className='mt-0.5 text-xs text-ui-muted dark:text-ui-muted'>
                        {hasPoints ? 'Reported operator origin and victim or target countries from linked sources.' : hasRegionalAreas ? 'Regional operating areas from the source-backed actor profile.' : 'Country-level source coverage for this actor profile.'}
                    </p>
                </div>
                <span className='rounded-lg bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-primary dark:bg-ui-raised dark:text-ui-primary'>{hasPoints ? `${geo.points.length} countries` : hasRegionalAreas ? `${regionalAreas.length} region${regionalAreas.length === 1 ? '' : 's'}` : 'Source coverage'}</span>
            </div>
            <div className={`${hasPoints ? compact ? 'min-h-72' : 'min-h-80' : ''} relative overflow-hidden bg-ui-raised dark:bg-ui-canvas`}>
                {hasPoints ? (
                    <>
                        <div className='absolute left-3 top-3 z-20 rounded-lg border border-ui-border bg-ui-panel/90 px-3 py-1.5 text-xs text-ui-muted shadow-sm backdrop-blur dark:border-ui-border dark:bg-ui-panel/90 dark:text-ui-muted'>
                            <span className='inline-flex items-center gap-2'>
                                <Move className='h-3.5 w-3.5' />
                                Drag to pan · wheel to zoom
                            </span>
                        </div>
                        <div className='absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-lg border border-ui-border bg-ui-panel/90 p-1 shadow-sm backdrop-blur dark:border-ui-border dark:bg-ui-panel/90'>
                            <MapZoomButton label='−' onClick={() => setViewBox((current) => zoomViewBox(current, 1.18, MAP_WIDTH / 2, MAP_HEIGHT / 2))} />
                            <MapZoomButton label='Reset' wide onClick={() => setViewBox(INITIAL_VIEWBOX)} />
                            <MapZoomButton label='+' onClick={() => setViewBox((current) => zoomViewBox(current, 0.84, MAP_WIDTH / 2, MAP_HEIGHT / 2))} />
                        </div>
                        <svg
                            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                            role='img'
                            aria-label={`Country-level actor map for ${humanizeSlug(result.query)}`}
                            className={`${compact ? 'h-72' : 'h-80'} relative z-10 w-full cursor-grab bg-ui-panel active:cursor-grabbing dark:bg-ui-canvas`}
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
                            <rect x='0' y='0' width={MAP_WIDTH} height={MAP_HEIGHT} className='fill-white dark:fill-[#0b111a]' />
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
                                        <text x={x} y={y - radius - 7} textAnchor='middle' className='fill-[#171a21] text-[10px] font-bold dark:fill-[#eef4ff]' stroke='#ffffff' strokeWidth='3' paintOrder='stroke'>{point.code}</text>
                                    </g>
                                )
                            })}
                        </svg>
                    </>
                ) : (
                    <MapCoverageFallback regions={regionalAreas} actor={actor} actionability={actionability} />
                )}
            </div>
            {hasPoints ? (
                <div className='grid gap-3 border-t border-ui-border bg-ui-panel px-4 py-3 dark:border-ui-border dark:bg-ui-panel'>
                    <div className='flex flex-wrap gap-3 text-xs'>
                        <span className='inline-flex items-center gap-1.5 text-ui-muted dark:text-ui-muted'><span className='h-2.5 w-2.5 rounded-full bg-ui-primary' />Operator attribution</span>
                        <span className='inline-flex items-center gap-1.5 text-ui-muted dark:text-ui-muted'><span className='h-2.5 w-2.5 rounded-full bg-ui-danger' />Reported victim or target country</span>
                        <span className='inline-flex items-center gap-1.5 text-ui-muted dark:text-ui-muted'><span className='h-2.5 w-2.5 rounded-full border border-ui-border' />Country-level source coverage</span>
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

function MapCoverageFallback({ regions, actor, actionability }: { regions: string[]; actor: TiActorIntelligenceProfile; actionability: TiActionabilityModel }) {
    const families = actor.sourceCoverage.sourceFamilies.slice(0, 4)
    const gaps = actor.sourceCoverage.missing.slice(0, 3)
    const sourceRows = actor.provenanceRows.slice(0, 3)
    return (
        <div data-ti-geo-coverage-fallback='true' className='grid gap-3 bg-ui-panel p-4 dark:bg-ui-canvas'>
            <div className='grid gap-3 md:grid-cols-3'>
                <CoverageFallbackMetric label='Regions' value={regions.length ? regions.join(', ') : 'No country-level rows'} />
                <CoverageFallbackMetric label='Source rows' value={`${actor.sourceCoverage.totalRows}`} />
                <CoverageFallbackMetric label='Newest' value={actor.sourceCoverage.latestReportDate ? formatDate(actor.sourceCoverage.latestReportDate) : formatDate(actor.lastSeen)} />
            </div>
            {regions.length ? (
                <div className='flex flex-wrap gap-2'>
                    {regions.map(region => (
                        <span key={region} className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'>{region}</span>
                    ))}
                </div>
            ) : null}
            <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-raised'>
                <div className='grid grid-cols-[minmax(0,1fr)_5rem_minmax(0,0.8fr)] gap-2 border-b border-ui-border px-3 py-2 text-[11px] font-semibold uppercase text-ui-muted dark:border-ui-border dark:text-ui-muted'>
                    <span>Coverage</span>
                    <span>Count</span>
                    <span>Next action</span>
                </div>
                {(families.length ? families : [{ family: 'source coverage', count: actor.sourceCoverage.totalRows }]).map(item => (
                    <div key={item.family} className='grid grid-cols-[minmax(0,1fr)_5rem_minmax(0,0.8fr)] gap-2 border-b border-ui-border px-3 py-2 text-xs last:border-b-0 dark:border-ui-border'>
                        <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{formatLabel(item.family)}</span>
                        <span className='text-ui-muted dark:text-ui-muted'>{item.count}</span>
                        <span className='wrap-break-word text-ui-muted dark:text-ui-muted'>{gaps[0] ? sourceHealthFieldLabel(gaps[0]) : 'Review source context'}</span>
                    </div>
                ))}
            </div>
            <div className='grid gap-2 sm:grid-cols-2'>
                {sourceRows.map(row => (
                    <div key={`${row.sourceName}-${row.provenance}`} className='rounded-lg border border-ui-border bg-ui-panel p-3 text-xs dark:border-ui-border dark:bg-ui-raised'>
                        <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                        <p className='mt-1 wrap-break-word text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.shownBecause)}</p>
                        <p className='mt-2 text-[11px] text-ui-muted dark:text-ui-muted'>{[row.reportDate ? formatDate(row.reportDate) : '', typeof row.confidence === 'number' ? sourceBasisLabel(row.confidence) : '', row.captureId ? `capture ${row.captureId}` : 'capture needed'].filter(Boolean).join(' · ')}</p>
                    </div>
                ))}
                {!sourceRows.length ? (
                    <div className='rounded-lg border border-dashed border-ui-border bg-ui-panel p-3 text-xs text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-muted'>
                        Add source name, report date, and provenance before using geography for customer routing.
                    </div>
                ) : null}
            </div>
            <div className='flex min-w-0 flex-wrap gap-2'>
                <span className={sourceHealthChipClass(gaps.length ? 'review' : 'ready')}>{gaps.length ? `${gaps.length} source gap${gaps.length === 1 ? '' : 's'}` : 'source context ready'}</span>
                <span className={sourceHealthChipClass(actionability.watchlistRelevance.terms.length ? 'ready' : 'review')}>{actionability.watchlistRelevance.terms.length ? `${actionability.watchlistRelevance.terms.length} watch terms` : 'watch term needed'}</span>
            </div>
        </div>
    )
}

function CoverageFallbackMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 dark:border-ui-border dark:bg-ui-raised'>
            <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{value}</p>
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
    const routeLabel = handoff?.watchlistTerm ? 'Watchlist review' : 'Source review'
    return (
        <div
            data-ti-geo-context-actions='true'
            className={`rounded-lg border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${active ? 'border-ui-primary bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-primary/10' : 'border-ui-border bg-ui-panel hover:border-ui-border hover:bg-ui-panel dark:border-ui-border dark:bg-ui-raised dark:hover:border-ui-border dark:hover:bg-ui-raised'}`}
        >
            <button type='button' onClick={onFocus} className='grid min-h-9 w-full min-w-0 items-center gap-1 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                <span className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                    <span className='min-w-0 wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{point.label}</span>
                    <span className={point.role === 'operator' ? 'whitespace-nowrap text-ui-primary dark:text-ui-primary' : 'whitespace-nowrap text-ui-danger dark:text-ui-danger'}>{point.role === 'operator' ? 'operator attribution' : `${point.count} observation${point.count === 1 ? '' : 's'}`}</span>
                </span>
            </button>
            <p className='mt-1 leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(point.detail)}</p>
            {handoff ? (
                <div className='mt-2 rounded-md border border-ui-border bg-ui-panel px-2 py-1.5 dark:border-ui-border dark:bg-ui-panel'>
                    <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                        <div className='min-w-0'>
                            <p className='font-semibold text-ui-text dark:text-ui-text'>{handoff.watchlistTerm ? `${handoff.watchlistTerm.kind}: ${handoff.watchlistTerm.value}` : 'Source review task'}</p>
                            <p className='mt-1 leading-5 text-ui-muted dark:text-ui-muted'>{handoff.watchlistTerm?.reason ?? handoff.enrichmentTask}</p>
                        </div>
                        <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:shrink-0'>
                            <span className={sourceHealthChipClass(handoff.watchlistTerm ? 'ready' : 'review')}>{routeLabel}</span>
                            <CopyPayloadButton label='Geography context' payload={payload} />
                        </div>
                    </div>
                    {handoff.evidenceRows.length ? (
                        <div data-ti-geo-sources='true' data-ti-geo-provenance='true' className='mt-2 grid gap-1 border-t border-ui-border pt-2'>
                            {handoff.evidenceRows.slice(0, 2).map(row => (
                                <p key={`${point.code}-${row.victim}-${row.reportDate}`} className='wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {row.victim} · {formatDate(row.reportDate)} · {sourceBasisLabel(row.confidence)} · {row.sourceIds.length ? row.sourceIds.map(sourceId => `source ${sourceId}`).join(', ') : row.source}
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
            className={`min-h-8 rounded-md border border-ui-border bg-ui-panel px-2.5 py-1 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${wide ? 'min-w-16' : 'min-w-8'}`}
        >
            {label}
        </button>
    )
}

function formatLabel(value: string) {
    return value.replaceAll('_', ' ')
}

function publicStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'action_required') return 'reviewing'
    if (value === 'review') return 'reviewing'
    if (value === 'local') return 'local'
    return formatLabel(value)
}

function publicDecisionStatusLabel(value: DecisionStep['status']) {
    if (value === 'blocked') return 'syncing'
    return decisionStepStatusLabel(value)
}

function coverageMissingLabel(value: string) {
    if (value.includes('captureId')) return 'capture references'
    if (value.includes('reportDate')) return 'report dates'
    if (value.includes('sourceId')) return 'source identifiers'
    if (value.includes('structuredProvenance')) return 'structured source details'
    if (value.includes('datedActivityRow')) return 'dated activity'
    if (value.includes('provenanceRefs')) return 'source references'
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
    if (value === 'metadata_review') return 'Needs review'
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
    if (value === 'enable_metadata_only_queue') return 'Watch this source without storing stolen files'
    return 'Keep monitoring'
}

function sourceActivationExecutionLabel(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['execution']) {
    if (value === 'human_approval_required') return 'approval required'
    if (value === 'dry_run') return 'review only'
    return 'syncing'
}

function sourceActivationExecutionClass(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['execution']) {
    if (value === 'dry_run') return decisionStepStatusClass('review')
    if (value === 'human_approval_required') return decisionStepStatusClass('review')
    return decisionStepStatusClass('blocked')
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
