'use client'

/* eslint-disable @typescript-eslint/no-unused-vars -- dormant TI workbench sections are unused while the simplified public result view ships. */

import searchThreatIntel, { evidenceTimestamp, TiSearchResponse } from '@/utils/ti/search'
import { actorGeoProfile, countryFromValue, victimObservationsFor } from '@/utils/ti/actorProfile'
import { buildActorIntelligence, type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { buildTiActionability, type TiActionabilityModel } from '@/utils/ti/actionability'
import { PUBLIC_TI_HANDOFF_ACTIONS, buildActorArtifactHandoffs, buildActorArtifacts, encodeHandoffPayload, nextActorArtifactId, type ActorArtifact, type ActorArtifactHandoffs, type ActorArtifactKind, type PublicTiHandoffPayload } from '@/utils/ti/actorWorkbench'
import { countryCentroids } from '@/utils/monitoring/geo'
import { clampViewBox, getCountryFocusView, INITIAL_VIEWBOX, MAP_HEIGHT, MAP_WIDTH, project, type ViewBox, zoomViewBox } from '@/utils/monitoring/liveTrafficMap'
import mapData from '@parent/public/world.json'
import { Activity, BellRing, Building2, CheckCircle2, ClipboardList, Clock3, Copy, Database, ExternalLink, Eye, Globe2, HelpCircle, Inbox, Move, Search, Send, ShieldAlert, ShieldCheck, UserPlus, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SyntheticEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { humanizeSlug } from '../seo'
import { ActorBusinessModelEvidence } from './businessModelEvidence'
import {
    actionOwnerLabel,
    activitySourceLabel,
    actorOperationsRowsFor,
    alertPacketFor,
    artifactStateFor,
    artifactStateLabel,
    artifactWorklistPayloadFor,
    assertionKindLabel,
    captureReferenceLabel,
    consumerRequestActionLabel,
    consumerRequestPathLabel,
    coverageMissingLabel,
    decisionLabel,
    decisionStepStatusClass,
    decisionStepStatusLabel,
    defaultDecisionReason,
    displayRequirementList,
    displayRequirementText,
    enrichmentGapWorkbenchRowsFor,
    filteredAnalystWorkItems,
    formatLabel,
    kindLabel,
    linkFromText,
    publicDecisionStatusLabel,
    publicStateLabel,
    readinessOwnerLabel,
    relevanceLabel,
    relevanceLabelForStaged,
    selectedAlertActionPlanFor,
    selectedArtifactPayloadFor,
    selectedCaseActionTrailFor,
    selectedCaseCreateRequestFor,
    selectedCaseDraftFor,
    selectedCaseOwnershipFor,
    selectedConsoleLinksFor,
    selectedDeliveryReadinessPlanFor,
    selectedEnrichmentTriageFor,
    selectedReviewHandoffFor,
    selectedSourceDrilldownFor,
    selectedTriageBriefFor,
    selectedWatchlistPlanFor,
    severityClass,
    severityWeight,
    sourceActivationActionLabel,
    sourceActivationExecutionClass,
    sourceActivationExecutionLabel,
    sourceBasisLabel,
    sourceConfidenceLabel,
    sourceCountLabel,
    sourceCountsFor,
    sourceCoverageWorkbenchRowsFor,
    sourceHealthFieldLabel,
    sourceReferenceCountLabel,
    sourceRequestRouteLabel,
    sourceStatusLabel,
    stagedHandoffFor,
    taskStatusClass,
    taskStatusLabel,
    unique,
    uniqueBy,
    watchlistIntersectionActionLabel,
    watchlistRelevanceFor,
    watchlistWorkbenchRowsFor,
    type AlertPacket,
    type AnalystWorkItem,
    type CaseActionTrailEvent,
    type CaseActionTrailPayload,
    type CaseReviewIntakeItem,
    type DecisionStep,
    type EnrichmentTask,
    type LocalDecision,
    type LocalRelevanceMark,
    type SectionOverviewItem,
    type SelectedAlertActionPlan,
    type SelectedCaseCreateRequest,
    type SelectedCaseDraft,
    type SelectedCaseOwnershipPlan,
    type SelectedDeliveryReadinessPlan,
    type SelectedEnrichmentTriage,
    type SelectedReviewHandoff,
    type SelectedSourceDrilldown,
    type SelectedSourceDrilldownRow,
    type SelectedTriageBrief,
    type SelectedWatchlistPlan,
    type SourceHealthRow,
    type StagedHandoff,
    type WatchlistIntersectionRow,
    type WatchlistRelevance,
} from './pageModel'

const TI_WORKBENCH_PREVIEW_ROWS = 1
const TI_EVIDENCE_QUEUE_PREVIEW_ROWS = 2
const TI_SELECTED_CONTEXT_ROWS = 2
const TI_SELECTED_CONTINUITY_REF_ROWS = 2
const TI_SELECTED_DETAIL_LIST_ROWS = 3
const TI_SELECTED_SOURCE_REQUEST_ROWS = 2
const TI_MOBILE_SOURCE_FILTER_OPTIONS = 5
const TI_ACTIVITY_TIMELINE_ROWS = 3
const TI_SOURCE_REFERENCE_ROWS = 2
const TI_DOSSIER_REASON_ROWS = 3
const TI_DOSSIER_SOURCE_FAMILY_ROWS = 3

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
                else setError('Threat intelligence search is temporarily unavailable.')
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
                setError('')
                setResult(next)
            } else if (activeQueryRef.current === expectedKey) {
                setError('Threat intelligence search is temporarily unavailable.')
            }
        }, Math.max(3, result.refreshAfterSeconds) * 1000)

        return () => window.clearTimeout(timer)
    }, [result])

    async function submit(event: SyntheticEvent<HTMLFormElement>) {
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
                setError('Threat intelligence search is temporarily unavailable.')
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
        <div className={visible ? 'mx-auto grid w-full max-w-7xl gap-6' : 'mx-auto grid min-h-[calc(100vh-9rem)] w-full max-w-[45rem] place-content-center gap-5 py-10'}>
            <form onSubmit={submit} className={visible ? 'grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-2 shadow-sm md:p-3' : 'grid gap-3'}>
                {!visible ? (
                    <div className='text-center'>
                        <h1 className='text-3xl font-semibold tracking-normal text-ui-text dark:text-ui-text md:text-4xl'>Search threat intelligence</h1>
                        <p className='mt-3 text-sm font-medium text-ui-primary dark:text-ui-primary'>Find current intelligence about any threat actor, company, domain, CVE, or malware family.</p>
                    </div>
                ) : null}
                <div className={`flex flex-col gap-3 ${visible ? 'md:flex-row md:items-end' : 'rounded-xl border border-ui-border bg-ui-panel p-3 shadow-[0_18px_50px_rgba(26,35,55,0.12)] dark:border-ui-border dark:bg-ui-panel'}`}>
                    <label className='grid flex-1 gap-2'>
                        <span className={`text-xs font-semibold uppercase text-ui-primary ${visible ? 'sr-only' : ''}`}>Threat intelligence search</span>
                        <input
                            ref={inputRef}
                            name='q'
                            value={query}
                            onChange={(event) => handleQueryChange(event.target.value)}
                            placeholder='APT29, LockBit, microsoft.com, CVE-2024-3094...'
                            className={`${visible ? 'h-10 rounded-lg px-3 text-sm' : 'h-12 rounded-lg px-4 text-base'} border border-ui-border bg-ui-panel font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:placeholder:text-ui-muted`}
                        />
                    </label>
                    <button
                        type='submit'
                        aria-busy={busy}
                        aria-label={busy ? 'Searching threat intelligence' : 'Search threat intelligence'}
                        className={`${visible ? 'h-10 min-w-24 rounded-lg' : 'h-11 min-w-28 rounded-lg'} inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:bg-ui-panel disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-text dark:hover:bg-ui-panel`}
                    >
                        <Search className='h-4 w-4' />
                        <span>{busy ? 'Searching' : 'Search'}</span>
                    </button>
                </div>
                {error ? <p className='text-sm text-ui-danger'>{error}</p> : null}
            </form>

            {visible ? <Results result={visible} error={error} /> : <EmptyState />}
        </div>
    )
}

function Results({ result, error }: { result: TiSearchResponse; error: string }) {
    const catalogIdentity = result.actorIdentity
    if (catalogIdentity?.catalogMatched && !catalogIdentity.activityEvidenceAvailable) {
        return <CatalogOnlyActorResult result={result} identity={catalogIdentity} error={error} />
    }
    return <EvidenceResults result={result} error={error} />
}

function CatalogOnlyActorResult({ result, identity, error }: { result: TiSearchResponse; identity: NonNullable<TiSearchResponse['actorIdentity']>; error: string }) {
    const candidate = !identity.ambiguous && identity.candidates.length === 1 ? identity.candidates[0] : undefined
    const title = candidate?.canonicalName ?? humanizeSlug(result.query)
    const source = candidate?.catalogId === 'mitre-attack-enterprise' ? 'MITRE Enterprise ATT&CK' : candidate?.catalogId === 'ransomware-live-current-operations' ? 'Ransomware.live' : 'the actor catalog'
    return (
        <section data-ti-catalog-only='true' className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <div>
                <h1 className='wrap-break-word text-3xl font-semibold tracking-normal text-ui-text dark:text-ui-text md:text-4xl'>{title}</h1>
                <p className='mt-3 max-w-3xl text-sm leading-6 text-ui-muted dark:text-ui-muted'>
                    {identity.ambiguous ? 'This label maps to multiple current catalog identities.' : `Current catalog identity from ${source}${candidate?.catalogVersion ? ` ${candidate.catalogVersion}` : ''}.`}
                </p>
            </div>
            <ActorIdentityPanel identity={identity} />
            <ActorBusinessModelEvidence model={result.actorIntelligence?.businessModel} sources={result.sources} caseStudies={result.actorCaseStudies} state={error ? 'error' : 'ready'} error={error} />
        </section>
    )
}

function EvidenceResults({ result, error }: { result: TiSearchResponse; error: string }) {
    const sourceUrlById = useMemo(() => new Map(result.sources.map(source => [source.id, source.url || linkFromText(source.provenance)])), [result.sources])
    const sources = result.sources
    const actorQuery = result.queryKind === 'actor'
    const catalogIdentity = result.actorIdentity
    const victimObservations = useMemo(() => victimObservationsFor(result), [result])
    const actorIntel = useMemo(() => buildActorIntelligence(result, victimObservations), [result, victimObservations])
    const actionability = useMemo(() => buildTiActionability(result, actorIntel, victimObservations), [result, actorIntel, victimObservations])
    const actorArtifacts = useMemo(() => buildActorArtifacts(result, actorIntel, victimObservations, actionability), [result, actorIntel, victimObservations, actionability])
    const workItems = useMemo(() => analystWorkItemsFor(result, victimObservations, sourceUrlById, actionability), [result, victimObservations, sourceUrlById, actionability])
    const recentItems = useMemo(() => workItems.filter(item => item.kind === 'activity' || item.kind === 'exposure'), [workItems])
    const watchlist = useMemo(() => watchlistRelevanceFor(result, victimObservations, sources, actorIntel, actionability), [result, victimObservations, sources, actorIntel, actionability])
    const [selectedId, setSelectedId] = useState(recentItems[0]?.id ?? '')
    const [selectedArtifactId, setSelectedArtifactId] = useState(actorArtifacts[0]?.id ?? '')
    const [localDecisions, setLocalDecisions] = useState<Record<string, LocalDecision>>({})
    const [relevanceMarks, setRelevanceMarks] = useState<Record<string, LocalRelevanceMark>>({})
    const [stagedHandoffs, setStagedHandoffs] = useState<Record<string, StagedHandoff>>({})
    const [notes] = useState<Record<string, string>>({})
    const [queueKindFilter, setQueueKindFilter] = useState<AnalystWorkItem['kind'] | 'all'>('all')
    const [queueSourceFilter, setQueueSourceFilter] = useState('all')
    const [queueConfidenceFilter, setQueueConfidenceFilter] = useState<'all' | 'high' | 'medium'>('all')
    const [queueSort] = useState<'priority' | 'confidence' | 'freshness'>('priority')
    const filteredWorkItems = useMemo(() => filteredAnalystWorkItems(workItems, {
        kind: queueKindFilter,
        source: queueSourceFilter,
        confidence: queueConfidenceFilter,
        sort: queueSort,
    }), [queueConfidenceFilter, queueKindFilter, queueSort, queueSourceFilter, workItems])
    const queueSourceCounts = useMemo(() => sourceCountsFor(filteredWorkItems), [filteredWorkItems])
    const selected = recentItems.find(item => item.id === selectedId) ?? recentItems[0]
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
    const selectedConsoleLinks = selected ? selectedConsoleLinksFor(result, selected, selectedWatchlistPlan, selectedCaseCreateRequest, selectedAlertPlan, selectedSourceDrilldown, selectedArtifactHandoffs) : null
    const selectedTriageBrief = selected ? selectedTriageBriefFor(result, selected, actionability, watchlist, alertPacket, selectedCaseDraft) : null
    const hasStableActorProfile = actorQuery && Boolean(actorIntel.attribution || actorIntel.motivation.length || victimObservations.length || actorIntel.sourceProvenance.length)
    const heroVictimContext = victimObservations
        .filter(item => /democratic national committee|solarwinds|microsoft|government and policy/i.test(item.victim))
        .map(item => `${item.victim} (${item.country})`)
        .slice(0, 4)
    const actorProfileSummary = hasStableActorProfile
        ? displayRequirementText([
            actorIntel.attribution,
            actorIntel.motivation.length ? `Motivation: ${actorIntel.motivation.slice(0, 2).join('; ')}.` : '',
            heroVictimContext.length ? `Victim context: ${heroVictimContext.join('; ')}.` : '',
        ].filter(Boolean).join(' '))
        : displayRequirementText(result.summary)
    const sourceRows = uniqueBy([
        ...sources.map(source => ({
            id: source.id,
            name: source.name,
            detail: source.url || source.provenance || source.type,
            href: source.url || linkFromText(source.provenance),
            meta: source.reportDate ? formatDate(source.reportDate) : sourceStatusLabel(source.parserStatus || source.type),
        })),
        ...(actorQuery ? actorIntel.provenanceRows : []).map(row => ({
            id: row.sourceId || `${row.sourceName}:${row.provenance}`,
            name: row.sourceName,
            detail: row.provenance,
            href: linkFromText(row.provenance),
            meta: row.reportDate ? formatDate(row.reportDate) : sourceBasisLabel(row.confidence),
        })),
        ...(selectedSourceDrilldown?.rows.map(row => ({
            id: row.sourceId || `${row.sourceName}:${row.provenance}`,
            name: row.sourceName,
            detail: row.provenance,
            href: row.href || linkFromText(row.provenance),
            meta: row.reportDate ? formatDate(row.reportDate) : sourceBasisLabel(row.confidence),
        })) ?? []),
    ], row => (row.href || row.detail || row.id).trim().toLowerCase()).slice(0, 12)
    useEffect(() => {
        if (!recentItems.length) return
        if (!recentItems.some(item => item.id === selectedId)) setSelectedId(recentItems[0]?.id ?? '')
    }, [recentItems, selectedId])

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
        <div className='grid gap-4'>
            <section data-ti-workspace='true' className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
                <div className={`grid gap-4 ${actorQuery ? 'xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]' : ''} xl:items-start`}>
                    <section data-ti-actor-info='true' className='grid gap-4'>
                        <div>
                            <h1 className='wrap-break-word text-3xl font-semibold tracking-normal text-ui-text dark:text-ui-text md:text-4xl'>{humanizeSlug(result.query)}</h1>
                            <p className='mt-3 max-w-3xl text-sm leading-6 text-ui-muted dark:text-ui-muted'>{actorProfileSummary}</p>
                        </div>
                        <div className='grid gap-3 sm:grid-cols-2'>
                            <EvidenceMetric label={actorQuery ? 'Attribution' : 'Query type'} value={actorQuery ? actorIntel.attribution || 'Public reporting' : formatLabel(result.queryKind || 'free_text')} />
                            <EvidenceMetric label={actorQuery ? 'Motivation' : 'Observed records'} value={actorQuery ? actorIntel.motivation.slice(0, 2).join('; ') || 'Reported activity' : `${result.recentActivity.length}`} />
                            <EvidenceMetric
                                label={actorQuery ? 'Aliases' : 'Sources'}
                                value={actorQuery ? result.aliases.slice(0, 3).join(', ') || humanizeSlug(result.query) : `${result.sources.length}`}
                            />
                            <EvidenceMetric label='Last seen' value={result.lastSeen ? formatDate(result.lastSeen) : 'Observation date unavailable'} />
                        </div>
                    </section>
                    {actorQuery ? <section data-ti-map='true' className='min-w-0'>
                        <ThreatActorMap actor={actorIntel} result={result} actionability={actionability} onSelectCountry={(country) => selectArtifactBy('country', country)} compact />
                    </section> : null}
                </div>

                {catalogIdentity?.catalogMatched ? <ActorIdentityPanel identity={catalogIdentity} /> : null}

                <EvidenceBoundaryStrip result={result} />

                {actorQuery ? (
                    <ActorBusinessModelEvidence
                        model={result.actorIntelligence?.businessModel}
                        sources={result.sources}
                        caseStudies={result.actorCaseStudies}
                        state={error ? 'error' : result.status === 'searching' || result.status === 'queued' ? 'loading' : 'ready'}
                        error={error}
                    />
                ) : null}

                <section id='ti-activity' data-ti-activity='true' className='grid gap-3 border-t border-ui-border pt-4 dark:border-ui-border'>
                    <div className='flex flex-wrap items-end justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text dark:text-ui-text'>Recent activity</h2>
                            <p className='mt-1 text-xs text-ui-muted dark:text-ui-muted'>{recentItems.length} recent result{recentItems.length === 1 ? '' : 's'}</p>
                        </div>
                    </div>
                    <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-3'>
                        {recentItems.slice(0, 9).map(item => {
                            const active = selected?.id === item.id
                            return (
                                <button
                                    key={item.id}
                                    type='button'
                                    onClick={() => setSelectedId(item.id)}
                                    className={`grid min-w-0 gap-2 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${active ? 'border-ui-primary/45 bg-ui-primary/10 dark:border-ui-primary/45 dark:bg-ui-primary/10' : 'border-ui-border bg-ui-panel hover:bg-ui-raised dark:border-ui-border dark:bg-ui-panel dark:hover:bg-ui-raised'}`}
                                >
                                    <div className='flex min-w-0 items-center justify-between gap-2'>
                                        <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${severityClass(item.severity)}`}>{item.severity}</span>
                                        <span className='truncate text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>{formatDate(item.timestamp)}</span>
                                    </div>
                                    <span className='wrap-break-word text-sm font-semibold leading-5 text-ui-text dark:text-ui-text'>{displayRequirementText(item.title)}</span>
                                    <span className='line-clamp-2 text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(item.detail)}</span>
                                    <span className='text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>{assertionKindLabel(item.assertionKind)} · {item.source} · {sourceBasisLabel(item.confidence)}</span>
                                </button>
                            )
                        })}
                        {!recentItems.length ? <p className='rounded-lg border border-dashed border-ui-border p-4 text-sm text-ui-muted dark:border-ui-border dark:text-ui-muted'>No reviewable activity is ready for this query.</p> : null}
                    </div>
                    {selected ? (
                        <section data-ti-selected-summary='true' className='rounded-lg border border-ui-border bg-ui-raised p-4 dark:border-ui-border dark:bg-ui-raised'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${severityClass(selected.severity)}`}>{selected.severity}</span>
                                <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{kindLabel(selected.kind)}</span>
                                <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{assertionKindLabel(selected.assertionKind)}</span>
                                {selected.reviewState ? <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{formatLabel(selected.reviewState)}</span> : null}
                                {selected.corroborationState ? <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{formatLabel(selected.corroborationState)}</span> : null}
                            </div>
                            <h3 className='mt-3 wrap-break-word text-2xl font-semibold text-ui-text dark:text-ui-text'>{displayRequirementText(selected.title)}</h3>
                            <p className='mt-2 text-sm leading-6 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selected.detail)}</p>
                            {selected.observationSummary ? <p className='mt-2 text-xs leading-5 text-ui-muted dark:text-ui-muted'><span className='font-semibold text-ui-text dark:text-ui-text'>Observed evidence:</span> {displayRequirementText(selected.observationSummary)}</p> : null}
                            {selectedTriageBrief ? <SelectedTriageBriefPanel brief={selectedTriageBrief} /> : null}
                        </section>
                    ) : null}
                </section>

                <section id='ti-sources' data-ti-sources='true' className='grid gap-3 border-t border-ui-border pt-4 dark:border-ui-border'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text dark:text-ui-text'>Sources</h2>
                        <p className='mt-1 text-xs text-ui-muted dark:text-ui-muted'>{sourceRows.length} references collected automatically from scraper output and actor provenance.</p>
                    </div>
                    <div className='grid gap-2 md:grid-cols-2'>
                        {sourceRows.map(row => (
                            <EvidenceBox key={row.id} href={row.href}>
                                <div className='flex min-w-0 items-start justify-between gap-3'>
                                    <div className='min-w-0'>
                                        <p className='wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{row.name}</p>
                                        <p className='mt-1 line-clamp-2 text-xs leading-5 text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.detail, row.name, result.query)}</p>
                                    </div>
                                    <span className='shrink-0 text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>{row.meta}</span>
                                </div>
                            </EvidenceBox>
                        ))}
                        {!sourceRows.length ? <p className='rounded-lg border border-dashed border-ui-border p-4 text-sm text-ui-muted dark:border-ui-border dark:text-ui-muted'>Sources are syncing from the scraper.</p> : null}
                    </div>
                </section>
            </section>
        </div>
    )

}

function ActorIdentityPanel({ identity }: { identity: NonNullable<TiSearchResponse['actorIdentity']> }) {
    const exact = !identity.ambiguous && identity.candidates.length === 1 && identity.candidates[0]?.matchKinds.includes('canonical')
    return (
        <section data-ti-actor-identity='true' className='min-w-0 border-y border-ui-border py-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>{exact ? 'Catalog identity' : 'Catalog candidates'}</p>
                </div>
                {identity.ambiguous ? <span className={sourceHealthChipClass('review')}>ambiguous label</span> : null}
            </div>
            <ul className='mt-3 grid min-w-0 gap-2'>
                {identity.candidates.map(candidate => (
                    <li key={`${candidate.catalogId}:${candidate.externalId}`} className='min-w-0 border-t border-ui-border pt-2 dark:border-ui-border'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{candidate.canonicalName} · {candidate.externalId}</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                                    {candidate.matchKinds.map(kind => kind === 'canonical' ? 'Canonical name' : 'Associated name').join(' · ')}
                                    {candidate.associatedNames.length ? ` · Also known as ${candidate.associatedNames.slice(0, 5).join(', ')}` : ''}
                                </p>
                            </div>
                            <div className='flex shrink-0 items-center gap-2'>
                                <span className={sourceHealthChipClass(candidate.status === 'current' ? 'ready' : 'review')}>{formatLabel(candidate.status)}</span>
                                <a href={candidate.sourceUrl} target='_blank' rel='noopener noreferrer' aria-label={`Open catalog record for ${candidate.canonicalName}`} title='Open catalog record' className='inline-flex h-8 w-8 items-center justify-center rounded-md border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:text-ui-muted dark:hover:bg-ui-raised dark:hover:text-ui-text'>
                                    <ExternalLink className='h-3.5 w-3.5' />
                                </a>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    )
}

function EvidenceBoundaryStrip({ result }: { result: TiSearchResponse }) {
    const assessment = result.evidenceAssessment
    const sourceCount = assessment?.sourceCount ?? new Set(result.sources.map(source => source.id)).size
    const captureCount = assessment?.captureCount ?? result.recentActivity.length
    const claims = result.claims ?? []
    const incidents = result.incidents ?? []
    const reviewCount = claims.filter(claim => ['unreviewed', 'needs_review'].includes(claim.reviewState)).length
        + incidents.filter(incident => incident.reviewState !== 'confirmed').length
    const reviewMeasured = Boolean(assessment || claims.length || incidents.length)
    const contradicted = assessment?.contradictedClaimCount ?? claims.filter(claim => claim.corroborationState === 'contradicted').length
    const rejected = assessment?.rejectedClaimCount ?? claims.filter(claim => claim.reviewState === 'rejected').length
    const stale = assessment?.staleClaimCount ?? 0
    const missing = assessment?.missingFields ?? result.actorIntelligence?.missingFields ?? []
    const facts = [
        { label: 'Observed evidence', value: `${captureCount} captured record${captureCount === 1 ? '' : 's'}` },
        { label: 'Source claims', value: `${claims.length} claim${claims.length === 1 ? '' : 's'}` },
        { label: 'Inferred incidents', value: `${incidents.length} candidate${incidents.length === 1 ? '' : 's'}` },
        { label: 'Independent sources', value: `${sourceCount} source${sourceCount === 1 ? '' : 's'}` },
        { label: 'Parser / review', value: [
            reviewCount ? `${reviewCount} need review` : reviewMeasured ? 'No open review' : 'Review state pending',
            rejected ? `${rejected} rejected` : '',
            stale ? `${stale} stale` : '',
        ].filter(Boolean).join(' · ') },
    ]

    return (
        <section data-ti-evidence-boundary='true' className='grid gap-3 border-y border-ui-border py-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>Evidence boundary</p>
                    <p className='mt-1 max-w-4xl text-xs leading-5 text-ui-muted dark:text-ui-muted'>Captured matches are observed evidence. Source statements remain claims. Incident records and profile conclusions are parser or analyst inferences until review and independent corroboration.</p>
                </div>
                <span className={sourceHealthChipClass(contradicted || rejected ? 'blocked' : assessment?.ready ? 'ready' : 'review')}>{contradicted ? `${contradicted} contradicted` : rejected ? `${rejected} rejected` : stale ? `${stale} stale` : assessment?.ready ? 'reviewed evidence' : 'partial evidence'}</span>
            </div>
            <div className='grid grid-cols-2 gap-3 md:grid-cols-5'>
                {facts.map(fact => (
                    <div key={fact.label} className='min-w-0 border-l border-ui-border pl-2 dark:border-ui-border'>
                        <p className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{fact.label}</p>
                        <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{fact.value}</p>
                    </div>
                ))}
            </div>
            {missing.length ? <p className='text-xs leading-5 text-ui-muted dark:text-ui-muted'><span className='font-semibold text-ui-text dark:text-ui-text'>Missing:</span> {missing.map(displayRequirementText).join(', ')}</p> : null}
        </section>
    )
}

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState<boolean | null>(null)

    useEffect(() => {
        const media = window.matchMedia(query)
        const update = () => setMatches(media.matches)
        update()
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [query])

    return matches
}

function SecondaryAnalysisToggle({ expanded, artifactCount, sourceCount, watchlistCount, gapCount, onToggle }: {
    expanded: boolean
    artifactCount: number
    sourceCount: number
    watchlistCount: number
    gapCount: number
    onToggle: () => void
}) {
    const summary = `${artifactCount} artifacts · ${sourceCount} sources · ${watchlistCount} watch terms · ${gapCount} source questions`
    return (
        <section id='ti-secondary-analysis' className='scroll-mt-24 border-y border-ui-border bg-ui-canvas px-3 py-2 dark:border-ui-border dark:bg-ui-canvas' data-ti-secondary-analysis-toggle='true'>
            <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Analysis workbenches</p>
                    <p className='mt-0.5 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {expanded ? 'Source, artifact, watchlist, and delivery workbenches are open.' : summary}
                    </p>
                </div>
                <button
                    type='button'
                    onClick={onToggle}
                    aria-expanded={expanded}
                    className='inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                >
                    {expanded ? 'Hide' : 'Show'}
                </button>
            </div>
        </section>
    )
}

type SecondaryAnalysisView = 'profile' | 'artifacts' | 'sources' | 'watchlist' | 'actions'

const secondaryAnalysisViews: { id: SecondaryAnalysisView; label: string; detail: string }[] = [
    { id: 'profile', label: 'Profile', detail: 'Actor timeline and dossier' },
    { id: 'artifacts', label: 'Artifacts', detail: 'IOCs and operations' },
    { id: 'sources', label: 'Sources', detail: 'Coverage and gaps' },
    { id: 'watchlist', label: 'Watchlist', detail: 'Customer term fit' },
    { id: 'actions', label: 'Actions', detail: 'Case and delivery staging' },
]

function SecondaryAnalysisTabs({ active, onSelect }: { active: SecondaryAnalysisView; onSelect: (view: SecondaryAnalysisView) => void }) {
    return (
        <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-canvas' data-ti-secondary-analysis-tabs='true'>
            <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-5' role='tablist' aria-label='Actor detail work areas'>
                {secondaryAnalysisViews.map(view => {
                    const selected = view.id === active
                    return (
                        <button
                            key={view.id}
                            type='button'
                            role='tab'
                            aria-selected={selected}
                            onClick={() => onSelect(view.id)}
                            className={`grid min-h-10 min-w-0 content-center rounded-md border px-2 py-1.5 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${selected ? 'border-ui-primary/35 bg-ui-primary/10 text-ui-text dark:border-ui-primary/40 dark:bg-ui-primary/15 dark:text-ui-text' : 'border-ui-border bg-ui-panel text-ui-muted hover:bg-ui-raised dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted dark:hover:bg-ui-raised'}`}
                        >
                            <span className='wrap-break-word font-semibold'>{view.label}</span>
                            <span className='hidden wrap-break-word text-[11px] md:block'>{view.detail}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function StripActionButton({ icon, children, onClick, href, disabled = false, iconOnly = false }: { icon: React.ReactNode; children: string; onClick: () => void; href?: string; disabled?: boolean; iconOnly?: boolean }) {
    const className = `inline-flex min-h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised dark:disabled:bg-ui-raised dark:disabled:text-ui-muted ${iconOnly ? 'px-1.5' : 'px-2.5'}`
    const label = iconOnly ? <span className='sr-only'>{children}</span> : children
    if (href && !disabled) {
        return (
            <a href={href} onClick={onClick} className={className} aria-label={iconOnly ? children : undefined} title={iconOnly ? children : undefined}>
                {icon}
                {label}
            </a>
        )
    }
    return (
        <button
            type='button'
            onClick={onClick}
            disabled={disabled}
            className={className}
            aria-label={iconOnly ? children : undefined}
            title={iconOnly ? children : undefined}
        >
            {icon}
            {label}
        </button>
    )
}

function ActorOperationsMatrix({
    result,
    actor,
    victimObservations,
    selectedArtifactId,
    onSelectArtifactBy,
    onEscalate,
    onReview,
}: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    victimObservations: ReturnType<typeof victimObservationsFor>
    selectedArtifactId?: string
    onSelectArtifactBy: (kind: ActorArtifactKind, value: string) => void
    onEscalate: () => void
    onReview: () => void
}) {
    const rows = useMemo(() => actorOperationsRowsFor(result, actor, victimObservations), [actor, result, victimObservations])
    const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id ?? '')
    const [showAllOperations, setShowAllOperations] = useState(false)
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const compactRows = rows.slice(0, TI_WORKBENCH_PREVIEW_ROWS)
    const visibleRows = showAllOperations
        ? rows
        : selectedRow && !compactRows.some(row => row.id === selectedRow.id)
            ? [...compactRows.slice(0, TI_WORKBENCH_PREVIEW_ROWS - 1), selectedRow]
            : compactRows
    const hiddenOperationCount = Math.max(0, rows.length - visibleRows.length)

    return (
        <section data-ti-actor-operations-matrix='true' className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Attack details</p>
                    <p className='mt-0.5 hidden wrap-break-word text-xs text-ui-muted dark:text-ui-muted md:block'>Methods, infrastructure, and targeting details with sources.</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{rows.length} details</span>
                    {selectedRow ? <CopyPayloadButton label='Copy detail' payload={selectedRow.payload} /> : null}
                </div>
            </div>
            <div className='grid min-w-0 lg:grid-cols-[minmax(0,1fr)_18rem]'>
                <div className='min-w-0 overflow-x-auto'>
                    <table className='min-w-170 w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Type</th>
                                <th className='px-3 py-2 font-semibold'>Name</th>
                                <th className='px-3 py-2 font-semibold'>Source</th>
                                <th className='px-3 py-2 font-semibold'>Freshness</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {visibleRows.map(row => {
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
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {hiddenOperationCount ? (
                        <button
                            type='button'
                            onClick={() => setShowAllOperations(true)}
                            className='m-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                        >
                            Show {hiddenOperationCount} more details
                        </button>
                    ) : showAllOperations && rows.length > compactRows.length ? (
                        <button
                            type='button'
                            onClick={() => setShowAllOperations(false)}
                            className='m-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                        >
                            Show key details only
                        </button>
                    ) : null}
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
                            <p className='wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                                {sourceBasisLabel(selectedRow.confidence)} · {selectedRow.source}
                            </p>
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
    const [showAllSources, setShowAllSources] = useState(false)
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const readyCount = rows.filter(row => row.state === 'ready').length
    const reviewCount = rows.filter(row => row.state === 'review').length
    const blockedCount = rows.filter(row => row.state === 'blocked').length
    const compactRows = rows.slice(0, TI_WORKBENCH_PREVIEW_ROWS)
    const visibleRows = showAllSources
        ? rows
        : selectedRow && !compactRows.some(row => row.id === selectedRow.id)
            ? [...compactRows.slice(0, TI_WORKBENCH_PREVIEW_ROWS - 1), selectedRow]
            : compactRows
    const hiddenSourceCount = Math.max(0, rows.length - visibleRows.length)

    return (
        <section data-ti-source-coverage-workbench='true' className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source review</p>
                    <p className='mt-0.5 hidden wrap-break-word text-xs text-ui-muted dark:text-ui-muted md:block'>Source coverage, newest mention, evidence basis, and review state.</p>
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
                    <table className='min-w-215 w-full border-collapse text-left text-xs'>
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
                        <tbody className='divide-y divide-ui-border'>
                            {visibleRows.map(row => {
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
                    {hiddenSourceCount ? (
                        <button
                            type='button'
                            onClick={() => setShowAllSources(true)}
                            className='m-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                        >
                            Show {hiddenSourceCount} more sources
                        </button>
                    ) : showAllSources && rows.length > compactRows.length ? (
                        <button
                            type='button'
                            onClick={() => setShowAllSources(false)}
                            className='m-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                        >
                            Show key sources only
                        </button>
                    ) : null}
                    {!rows.length ? <p className='p-4 text-sm text-ui-muted dark:text-ui-muted'>Add source coverage before reviewing this actor.</p> : null}
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised xl:border-l xl:border-t-0'>
                    {selectedRow ? (
                        <div className='grid gap-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected source</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.sourceName}</h3>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.provenance)}</p>
                            </div>
                            <p className='wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                                {formatLabel(selectedRow.family)} · {selectedRow.evidenceItems.length} results · capture {selectedRow.captureId ? 'attached' : 'missing'} · request {selectedRow.sourceRequestId ? 'queued' : 'not queued'}
                            </p>
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
        { label: 'Source status', value: captureCoverageLabel(actor.sourceCoverage) },
    ]

    return (
        <div data-ti-freshness-gate='true' className='mt-4 min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Evidence status</p>
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
                        {sourceBlockers.length ? sourceBlockers.slice(0, 2).map(blocker => (
                            <li key={`${blocker.code}-${blocker.field}`} className='wrap-break-word'>{readinessOwnerLabel(blocker.ownerLane)}: {displayRequirementText(blocker.handoff)}</li>
                        )) : actor.sourceCoverage.missing.length ? actor.sourceCoverage.missing.slice(0, 2).map(item => (
                            <li key={item} className='wrap-break-word'>Source collection: attach {coverageMissingLabel(item)}.</li>
                        )) : <li>Source evidence is sufficient for review.</li>}
                    </ul>
                </div>
                <div className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Review follow-up</p>
                    <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {workflowBlockers.length ? workflowBlockers.slice(0, 2).map(blocker => (
                            <li key={`${blocker.code}-${blocker.field}`} className='wrap-break-word'>{readinessOwnerLabel(blocker.ownerLane)}: {displayRequirementText(blocker.handoff)}</li>
                        )) : <li>Required review identifiers are present.</li>}
                    </ul>
                </div>
            </div>
            <p className='mt-3 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                {nextOwner ? `Next action: ${readinessOwnerLabel(nextOwner)}.` : 'No follow-up is assigned.'}
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
        queryKind: classifyPublicTiQuery(query),
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
        <nav data-ti-command-bar='true' className='grid min-w-0 gap-1.5 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-5' aria-label='Threat intelligence actions'>
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
                {rows.length ? rows.slice(0, TI_SOURCE_REFERENCE_ROWS).map(row => {
                    const href = linkFromText(row.provenance)
                    return (
                        <div key={`${row.sourceName}-${row.provenance}`} data-ti-provenance-artifact-export='true' className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                    <span className='shrink-0 text-[11px] text-ui-muted dark:text-ui-muted'>{row.reportDate ? formatDate(row.reportDate) : row.captureId ? 'capture linked' : sourceBasisLabel(row.confidence)}</span>
                                    <CopyPayloadButton label='Provenance artifact' payload={provenanceArtifactPayloadFor(row, actor, actionability, query)} />
                                    {href ? (
                                        <a href={href} target='_blank' rel='noopener noreferrer' className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                            <ExternalLink className='h-3.5 w-3.5' />
                                            Open
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.provenance)}</p>
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
        { label: 'Source status', value: captureCoverageLabel(coverage) },
        { label: 'Latest', value: coverage.latestReportDate ? formatDate(coverage.latestReportDate) : 'Not dated' },
    ]
    const coverageCopy = coverage.captureRows
        ? 'Replayable source captures are attached for analyst review.'
        : coverage.missing.includes('sourceProvenance[].captureId')
            ? 'Attach capture evidence before case replay or delivery review.'
            : coverage.stale ? 'Refresh source coverage before sending this to review.' : 'Evidence dates and source references are current.'
    return (
        <div data-ti-source-coverage='true' className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source coverage</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {coverageCopy}
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
                {coverage.sourceFamilies.length ? coverage.sourceFamilies.slice(0, TI_DOSSIER_SOURCE_FAMILY_ROWS).map(item => (
                    <span key={item.family} className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        {formatLabel(item.family)} · {item.count}
                    </span>
                )) : <span className='text-xs text-ui-muted dark:text-ui-muted'>Source family coverage is not mapped yet.</span>}
                {coverage.sourceFamilies.length > TI_DOSSIER_SOURCE_FAMILY_ROWS ? <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>+{coverage.sourceFamilies.length - TI_DOSSIER_SOURCE_FAMILY_ROWS} more</span> : null}
            </div>
            {coverage.missing.length ? (
                <div className='mt-3 rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                    Needs {coverage.missing.map(coverageMissingLabel).join(', ')}.
                </div>
            ) : null}
        </div>
    )
}

function captureCoverageLabel(coverage: TiActorIntelligenceProfile['sourceCoverage']) {
    if (coverage.captureRows) return `${coverage.captureRows} source row${coverage.captureRows === 1 ? '' : 's'} linked`
    if (coverage.missing.includes('sourceProvenance[].captureId')) return 'sources syncing'
    return 'source optional'
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
                                    {item.sourceIds.length ? `${item.sourceIds.length} source reference${item.sourceIds.length === 1 ? '' : 's'}` : 'Source reference needed'} · {item.captureIds.length ? `${item.captureIds.length} source row${item.captureIds.length === 1 ? '' : 's'}` : 'sources syncing'} · {item.missing.length ? `needs ${item.missing.map(coverageMissingLabel).join(', ')}` : 'case context ready'}
                                </p>
                                {item.provenanceRefs[0] ? <p className='wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(item.provenanceRefs[0])}</p> : null}
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
                                {item.provenanceRefs[0] ? <p className='wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(item.provenanceRefs[0])}</p> : null}
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
                }) : <span className='text-xs text-ui-muted dark:text-ui-muted'>Add observed values to compare.</span>}
            </div>
        </div>
    )
}

function ArtifactNavigator({ artifacts, selectedArtifactId, onSelectArtifact }: { artifacts: ActorArtifact[]; selectedArtifactId?: string; onSelectArtifact: (artifactId: string) => void }) {
    const [showAllArtifacts, setShowAllArtifacts] = useState(false)
    function move(direction: 'next' | 'previous' | 'first' | 'last') {
        const next = nextActorArtifactId(artifacts, selectedArtifactId, direction)
        if (next) onSelectArtifact(next)
    }
    const selectedArtifact = artifacts.find(artifact => artifact.id === selectedArtifactId) ?? artifacts[0]
    const readyCount = artifacts.filter(artifact => artifactStateFor(artifact) === 'ready').length
    const reviewCount = artifacts.filter(artifact => artifactStateFor(artifact) === 'review').length
    const blockedCount = artifacts.filter(artifact => artifactStateFor(artifact) === 'blocked').length
    const compactArtifacts = artifacts.slice(0, TI_WORKBENCH_PREVIEW_ROWS)
    const visibleArtifacts = showAllArtifacts
        ? artifacts
        : selectedArtifact && !compactArtifacts.some(artifact => artifact.id === selectedArtifact.id)
            ? [...compactArtifacts.slice(0, TI_WORKBENCH_PREVIEW_ROWS - 1), selectedArtifact]
            : compactArtifacts
    const hiddenArtifactCount = Math.max(0, artifacts.length - visibleArtifacts.length)

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
                    <p className='mt-0.5 hidden wrap-break-word text-xs text-ui-muted dark:text-ui-muted md:block'>Indicators, methods, tools, campaigns, and locations with sources.</p>
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
                    <table className='min-w-175 w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Detail</th>
                                <th className='px-3 py-2 font-semibold'>Results</th>
                                <th className='px-3 py-2 font-semibold'>Freshness</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Action state</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {visibleArtifacts.map(artifact => {
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
                                                {artifact.watchlistTerms.length} watch · {artifact.enrichmentTasks.length} source questions
                                            </p>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {hiddenArtifactCount ? (
                        <button
                            type='button'
                            onClick={() => setShowAllArtifacts(true)}
                            className='m-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                        >
                            Show {hiddenArtifactCount} more details
                        </button>
                    ) : showAllArtifacts && artifacts.length > compactArtifacts.length ? (
                        <button
                            type='button'
                            onClick={() => setShowAllArtifacts(false)}
                            className='m-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                        >
                            Show key details only
                        </button>
                    ) : null}
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised xl:border-l xl:border-t-0'>
                    {selectedArtifact ? (
                        <div className='grid gap-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected detail</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedArtifact.label}</h3>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{selectedArtifact.subtitle}</p>
                            </div>
                            <p className='wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                                {formatLabel(selectedArtifact.kind)} · {sourceBasisLabel(selectedArtifact.confidence)} · {selectedArtifact.watchlistTerms.length} watch · {selectedArtifact.enrichmentTasks.length} open questions
                            </p>
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
                                {!selectedArtifact.watchlistTerms.length ? <span className='text-xs text-ui-muted dark:text-ui-muted'>Attach watch term.</span> : null}
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
    const [showRoutingChecks, setShowRoutingChecks] = useState(false)
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
                        <EvidenceMetric label='Evidence strength' value={sourceBasisLabel(artifact.confidence)} />
                        <EvidenceMetric label='Action state' value={displayRequirementText(artifact.readiness.label)} />
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
                        {artifact.evidence.length ? artifact.evidence.slice(0, TI_SELECTED_DETAIL_LIST_ROWS).map(line => <li key={line}>{displayRequirementText(line)}</li>) : <li>Review source evidence before case work.</li>}
                    </EvidencePanel>
                    <EvidencePanel title='Source details'>
                        {artifact.provenance.length ? artifact.provenance.slice(0, TI_SELECTED_DETAIL_LIST_ROWS).map(line => <li key={line}>{displayRequirementText(line)}</li>) : <li>Source details are missing for this detail.</li>}
                    </EvidencePanel>
                    <EvidencePanel title='Watchlist relevance'>
                        {artifact.watchlistTerms.length ? artifact.watchlistTerms.slice(0, TI_SELECTED_DETAIL_LIST_ROWS).map(term => <li key={`${term.kind}-${term.value}`}>{term.kind}: {term.value}. {displayRequirementText(term.notes)}</li>) : <li>Attach customer watchlist term.</li>}
                        {artifact.watchlistTerms.length > TI_SELECTED_DETAIL_LIST_ROWS ? <li className='text-ui-muted'>+{artifact.watchlistTerms.length - TI_SELECTED_DETAIL_LIST_ROWS} more watch terms in workbenches</li> : null}
                    </EvidencePanel>
                    <EvidencePanel title='Open source questions'>
                        {artifact.enrichmentTasks.length ? artifact.enrichmentTasks.slice(0, TI_SELECTED_DETAIL_LIST_ROWS).map(task => <li key={task}>{displayRequirementText(task)}</li>) : <li>Source questions are clear.</li>}
                        {artifact.enrichmentTasks.length > TI_SELECTED_DETAIL_LIST_ROWS ? <li className='text-ui-muted'>+{artifact.enrichmentTasks.length - TI_SELECTED_DETAIL_LIST_ROWS} more source questions in workbenches</li> : null}
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
                            {bridge.payload.sourceRequests.length ? bridge.payload.sourceRequests.slice(0, TI_SELECTED_SOURCE_REQUEST_ROWS).map(request => (
                                <div key={`${request.sourceName}-${request.provenance}-${request.captureId ?? 'missing'}`} className='min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                    <div className='flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'>
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{request.sourceName}</p>
                                        <span className={sourceRequestCaptureClass(Boolean(request.captureId))}>
                                            {request.captureId ? 'source linked' : 'sources syncing'}
                                        </span>
                                    </div>
                                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{request.captureId ? 'source linked' : compactSourceReferenceLabel(request.provenance)}</p>
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
                                <p className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>Create a source request before customer review.</p>
                            )}
                        </div>
                        {bridge.missing.length ? (
                            <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-warning'>
                                {bridge.missing.slice(0, TI_SELECTED_SOURCE_REQUEST_ROWS).map(item => <li key={item}>{displayRequirementText(item)}</li>)}
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
                </div>
            </div>
            <div data-ti-artifact-workflow-readiness='true' className='mt-3 border-t border-ui-border pt-3 dark:border-ui-border'>
                <div className='flex flex-wrap items-center justify-between gap-2 text-xs'>
                    <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                        Console action links · {workflowRows.filter(row => !row.blocked).length}/{workflowRows.length} available · watchlist, alert, case, source
                    </p>
                    <p className='min-w-0 wrap-break-word text-[11px] font-medium text-ui-muted dark:text-ui-muted'>
                        {workflowRows
                            .map(row => row.readiness ? actionOwnerLabel(row.readiness.ownerLane) : '')
                            .filter((label, index, labels) => label && labels.indexOf(label) === index)
                            .slice(0, 3)
                            .join(' · ') || 'Console action owners'}
                    </p>
                    <button type='button' onClick={() => setShowRoutingChecks(value => !value)} className='inline-flex min-h-7 items-center justify-center border-l border-ui-border pl-2 text-[11px] font-semibold text-ui-text transition hover:text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:text-ui-text'>
                        {showRoutingChecks ? 'Hide action links' : 'Show action links'}
                    </button>
                </div>
                {showRoutingChecks ? (
                    <div className='mt-3 grid gap-2'>
                        {workflowRows.map(row => (
                            <PayloadHandoffRow key={`workflow-${row.id}`} label={row.label} detail={row.detail} payload={row.payload} route={row.route} blocked={row.blocked} />
                        ))}
                        <CopyPayloadButton label='Console action bundle' payload={bridge} />
                    </div>
                ) : null}
            </div>
        </section>
    )
}

function EvidencePriorityPanel({ priority }: { priority: NonNullable<AnalystWorkItem['priority']> }) {
    const ids = [
        priority.sourceIds.length ? `${priority.sourceIds.length} source reference${priority.sourceIds.length === 1 ? '' : 's'}` : '',
        priority.captureIds.length ? `${priority.captureIds.length} capture reference${priority.captureIds.length === 1 ? '' : 's'}` : '',
        priority.alertIds.length ? `${priority.alertIds.length} alert review${priority.alertIds.length === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
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
                        )) : <span className='text-xs text-ui-muted dark:text-ui-muted'>Link backed records before continuing.</span>}
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
    const rows = drilldown.rows.slice(0, TI_SELECTED_CONTEXT_ROWS)
    if (!rows.length) return null
    return (
        <div data-ti-selected-evidence-context='true' className='mt-4 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Sources</p>
                    <p className='mt-0.5 text-[11px] text-ui-muted dark:text-ui-muted'>{rows.length} source{rows.length === 1 ? '' : 's'} tied to the selected result</p>
                </div>
                <CopyPayloadButton label='Sources' payload={drilldown} />
            </div>
            <div className='grid gap-2 p-2 md:hidden'>
                {rows.map(row => (
                    <div key={`mobile-${row.rowId}`} className='rounded-lg border border-ui-border bg-white p-3 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.provenance)}</p>
                            </div>
                            <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? 'attached' : 'needed'}</span>
                        </div>
                        <div className='mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2'>
                            <EvidenceMetric label='Timestamp' value={row.reportDate ? formatDate(row.reportDate) : 'Not dated'} />
                            <EvidenceMetric label='Basis' value={sourceBasisLabel(row.confidence)} />
                        </div>
                        <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.handoff)}</p>
                    </div>
                ))}
            </div>
            <div className='overflow-x-auto max-md:hidden! md:block'>
                <table className='min-w-180 w-full border-collapse text-left text-xs max-md:hidden!'>
                    <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-panel dark:text-ui-muted'>
                        <tr>
                            <th className='px-3 py-2 font-semibold'>Source</th>
                            <th className='px-3 py-2 font-semibold'>Timestamp</th>
                            <th className='px-3 py-2 font-semibold'>Basis</th>
                            <th className='px-3 py-2 font-semibold'>Capture</th>
                            <th className='px-3 py-2 font-semibold'>Next action</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-ui-border'>
                        {rows.map(row => (
                            <tr key={row.rowId} className='bg-ui-panel align-top dark:bg-ui-raised'>
                                <td className='px-3 py-2'>
                                    <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.provenance)}</p>
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
                        Sources, source status, and follow-up for the selected result.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(state)}>{readyRows}/{drilldown.rows.length} linked</span>
                    <CopyPayloadButton label='Source details' payload={drilldown} />
                </div>
            </div>

            <div className='mt-3 grid min-w-0 gap-2 md:grid-cols-2'>
                {drilldown.rows.length ? drilldown.rows.slice(0, TI_SELECTED_CONTEXT_ROWS).map(row => (
                    <div key={row.rowId} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {[row.sourceId ? 'source linked' : '', row.reportDate ? formatDate(row.reportDate) : '', typeof row.confidence === 'number' ? sourceBasisLabel(row.confidence) : ''].filter(Boolean).join(' · ') || 'Source metadata incomplete'}
                                </p>
                            </div>
                            <span className={row.state === 'ready' ? decisionStepStatusClass('ready') : row.state === 'needs_capture' ? decisionStepStatusClass('review') : decisionStepStatusClass('blocked')}>
                                {row.state === 'ready' ? 'ready' : row.state === 'needs_capture' ? 'sources syncing' : 'source needed'}
                            </span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{row.captureId ? 'capture linked' : compactSourceReferenceLabel(row.provenance)}</p>
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
            timestamp: evidenceTimestamp(item.firstReportedAt, item.date),
            source: activitySourceLabel(item.sourceIds.length),
            provenance: item.publisherCount ? `${item.publisherCount} publisher${item.publisherCount === 1 ? '' : 's'}` : 'Activity result',
            confidence: item.confidence,
            assertionKind: item.assertionKind || 'source_claim',
            reviewState: item.reviewState,
            corroborationState: item.corroborationState,
            observationSummary: item.observationSummary,
            href,
            evidence: [
                item.title,
                item.impact || item.detail,
                item.affectedSectors?.length ? `Affected sectors: ${item.affectedSectors.join(', ')}` : 'Affected sector not stated.',
                item.countries?.length ? `Countries: ${item.countries.join(', ')}` : 'Country not stated.',
            ],
            nextActions: exposure
                ? ['Review sources before customer alerting.', 'Check whether the victim/domain is in a watched portfolio.', 'Escalate if the claim is fresh, corroborated, or customer-relevant.']
                : ['Review for relevance to the selected actor or company.', 'Open the source when available.', 'Close if it is duplicate background reporting.'],
            priority,
        }
    })

    const victimItems: AnalystWorkItem[] = victimObservations.map((item, index) => {
        const id = `victim-${index}-${item.victim}`.toLowerCase()
        return {
            id,
            kind: 'victim',
            severity: /microsoft|solarwinds|federal|government|diplomatic|political|election/i.test(`${item.victim} ${item.sector}`) ? 'high' : 'medium',
            status: 'profile evidence',
            title: item.victim,
            subtitle: `${item.country} · ${item.sector}`,
            detail: item.incident,
            timestamp: item.timeframe,
            source: item.source,
            provenance: 'Country-level actor profile evidence',
            confidence: 0.76,
            assertionKind: 'source_claim',
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
        timestamp: 'Observation date unavailable',
        source: 'Actor profile',
        provenance: item.attackId ? 'MITRE ATT&CK mapped profile field' : 'Profile tradecraft field',
        confidence: item.confidence,
        assertionKind: 'extracted',
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
        timestamp: evidenceTimestamp(item.claimedDate),
        source: item.sourceHash ? `source hash ${item.sourceHash}` : 'Sensitive-source review inbox',
        provenance: item.provenance || 'Sensitive-source review',
        confidence: item.confidence,
        assertionKind: 'source_claim',
        evidence: [
            item.affectedAccounts ? `Affected accounts: ${item.affectedAccounts}` : 'Affected accounts not stated.',
            item.accountSubjects ? `Account subjects: ${item.accountSubjects}` : 'Account subjects not stated.',
            item.datasetSize ? `Dataset size: ${item.datasetSize}` : 'Dataset size not stated.',
            item.actorStatement ? `Actor statement: ${item.actorStatement}` : 'Actor statement is not in the safe fields.',
        ],
        nextActions: item.allowedActions.map(action => formatLabel(action)),
    })) ?? []

    return [...reviewItems, ...activityItems, ...victimItems, ...tradecraftItems]
        .sort((a, b) => (b.priority?.score ?? 0) - (a.priority?.score ?? 0) || severityWeight(b.severity) - severityWeight(a.severity) || b.confidence - a.confidence)
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
                        {watchlist.domains.map(domain => <span key={domain} className='rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 text-xs font-semibold text-ui-text'>{domain}</span>)}
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
    const [showAllWatchlistRows, setShowAllWatchlistRows] = useState(false)
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const readyCount = rows.filter(row => row.state === 'ready').length
    const blockedCount = rows.filter(row => row.state === 'blocked').length
    const selectedArtifact = selectedRow?.artifactIds.find(id => id === selectedArtifactId) ?? selectedRow?.artifactIds[0]
    const selectedEvidence = selectedRow?.evidenceItems.find(item => item.id === selectedId) ?? selectedRow?.evidenceItems[0]
    const compactRows = rows.slice(0, TI_WORKBENCH_PREVIEW_ROWS)
    const visibleRows = showAllWatchlistRows
        ? rows
        : selectedRow && !compactRows.some(row => row.id === selectedRow.id)
            ? [...compactRows.slice(0, TI_WORKBENCH_PREVIEW_ROWS - 1), selectedRow]
            : compactRows
    const hiddenWatchlistCount = Math.max(0, rows.length - visibleRows.length)

    return (
        <section data-ti-watchlist-workbench='true' data-ti-watchlist-term-requests='true' className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Watchlist review</p>
                    <p className='mt-0.5 hidden wrap-break-word text-xs text-ui-muted dark:text-ui-muted md:block'>Watched terms, matching results, key details, and case links for organization review.</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className={sourceHealthChipClass('ready')}>{readyCount} matched</span>
                    <span className={sourceHealthChipClass(blockedCount ? 'blocked' : 'review')}>{blockedCount} syncing</span>
                    {selectedRow ? <CopyPayloadButton label='Copy watchlist match' payload={selectedRow.payload} /> : null}
                </div>
            </div>
            <div className='grid min-w-0 xl:grid-cols-[minmax(0,1fr)_19rem]'>
                <div className='min-w-0 overflow-x-auto'>
                    <table className='min-w-212.5 w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Term</th>
                                <th className='px-3 py-2 font-semibold'>Results</th>
                                <th className='px-3 py-2 font-semibold'>Newest</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Review link</th>
                                <th className='px-3 py-2 font-semibold'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {visibleRows.map(row => {
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
                    {hiddenWatchlistCount ? (
                        <button
                            type='button'
                            onClick={() => setShowAllWatchlistRows(true)}
                            className='m-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                        >
                            Show {hiddenWatchlistCount} more terms
                        </button>
                    ) : showAllWatchlistRows && rows.length > compactRows.length ? (
                        <button
                            type='button'
                            onClick={() => setShowAllWatchlistRows(false)}
                            className='m-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                        >
                            Show key terms only
                        </button>
                    ) : null}
                    {!rows.length ? <p className='p-4 text-sm text-ui-muted dark:text-ui-muted'>Link a watchlist term before opening this result for review.</p> : null}
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised xl:border-l xl:border-t-0'>
                    {selectedRow ? (
                        <div className='grid gap-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected term</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.kind}: {selectedRow.value}</h3>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.detail)}</p>
                            </div>
                            <p className='wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                                {selectedRow.evidenceItems.length} results · {selectedRow.artifactIds.length} details · {selectedRow.sourceCount} sources · {selectedRow.matched ? 'Matched' : publicStateLabel(selectedRow.state)}
                            </p>
                            <div className='grid grid-cols-2 gap-1.5'>
                                <button type='button' onClick={onMarkRelevant} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Watch</button>
                                {selectedEvidence ? <button type='button' onClick={() => onSelectEvidence(selectedEvidence.id)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Review result</button> : null}
                                {selectedArtifact ? <button type='button' onClick={() => onSelectArtifact(selectedArtifact)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>Open detail</button> : null}
                                <CopyPayloadButton label='Export' payload={selectedRow.payload} showLabel />
                            </div>
                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                {selectedRow.route ? <a href={selectedRow.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'><ExternalLink className='h-3.5 w-3.5' />Open action</a> : null}
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
                )) : <span className='text-xs text-ui-muted dark:text-ui-muted'>Add matching values before opening this result for review.</span>}
            </div>
        </div>
    )
}

function countLinkedLabel(count: number, label: string) {
    if (!count) return ''
    return `${count} ${label}${count === 1 ? '' : 's'} linked`
}

function HandoffEvidenceMatrix({ actionability }: { actionability: TiActionabilityModel }) {
    const [showReviewPaths, setShowReviewPaths] = useState(false)
    const rows = [
        {
            id: 'watchlist',
            label: 'Watchlist',
            state: actionability.actionPayloads.payloads.watchlistAdd.ready,
            route: actionability.actionPayloads.payloads.watchlistAdd.backedRoute ?? actionability.actionPayloads.payloads.watchlistAdd.route,
            ids: [
                countLinkedLabel(actionability.readiness.backedIds.organizationIds.length, 'organization'),
                countLinkedLabel(actionability.readiness.backedIds.watchlistItemIds.length, 'watch item'),
            ].filter(Boolean),
            provenance: actionability.actionPayloads.payloads.watchlistAdd.provenance,
            blocker: actionability.actionPayloads.payloads.watchlistAdd.blockedBy[0],
            missing: actionability.actionPayloads.payloads.watchlistAdd.blockedBy.map(blocker => blocker.handoff),
        },
        {
            id: 'alert',
            label: 'Alert rebuild',
            state: actionability.createAlertHandoff.ready,
            route: actionability.createAlertHandoff.backedRoute || actionability.createAlertHandoff.endpoint,
            ids: [countLinkedLabel(actionability.readiness.backedIds.alertIds.length, 'alert')].filter(Boolean),
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
                countLinkedLabel(actionability.readiness.backedIds.caseIds.length, 'case'),
                countLinkedLabel(actionability.readiness.backedIds.casePaths.length, 'case route'),
            ].filter(Boolean),
            provenance: actionability.actionPayloads.payloads.caseHandoff.provenance,
            blocker: actionability.actionPayloads.payloads.caseHandoff.blockedBy[0],
            missing: actionability.caseHandoff.missing,
        },
        {
            id: 'delivery',
            label: 'Delivery',
            state: actionability.webhookDeliveryHandoff.ready,
            route: actionability.webhookDeliveryHandoff.backedRoute || actionability.webhookDeliveryHandoff.endpoint,
            ids: [countLinkedLabel(actionability.readiness.backedIds.webhookDestinationIds.length, 'destination')].filter(Boolean),
            provenance: actionability.actionPayloads.payloads.webhookDelivery.provenance,
            blocker: actionability.actionPayloads.payloads.webhookDelivery.blockedBy[0],
            missing: actionability.webhookDeliveryHandoff.missing,
        },
        {
            id: 'source',
            label: 'Source review',
            state: actionability.actionPayloads.payloads.sourceEnrichment.ready,
            route: actionability.actionPayloads.payloads.sourceEnrichment.backedRoute ?? actionability.actionPayloads.payloads.sourceEnrichment.route,
            ids: [countLinkedLabel(actionability.readiness.backedIds.captureIds.length, 'capture')].filter(Boolean),
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
                        {readyCount} of {rows.length} review rows have source references, action links, and capture details for authenticated review.
                    </p>
                </div>
                <div className='flex min-w-0 flex-wrap items-center gap-2'>
                    <span className={readyCount === rows.length ? decisionStepStatusClass('ready') : readyCount ? decisionStepStatusClass('review') : decisionStepStatusClass('blocked')}>
                        {readyCount}/{rows.length} linked
                    </span>
                    <button type='button' onClick={() => setShowReviewPaths(value => !value)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                        {showReviewPaths ? 'Hide rows' : 'Show rows'}
                    </button>
                </div>
            </div>
            {showReviewPaths ? (
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
                                )) : <span className='rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>link needed</span>}
                                {row.provenance.slice(0, 2).map(item => (
                                    <span key={`${row.id}-source-${item.sourceName}-${item.provenance}`} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>{item.sourceName}</span>
                                ))}
                                {row.provenance.filter(item => item.captureId).slice(0, 2).map(item => (
                                    <span key={`${row.id}-capture-${item.captureId}`} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>capture linked</span>
                                ))}
                            </div>
                            {row.blocker ? (
                                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{readinessOwnerLabel(row.blocker.ownerLane)}: {displayRequirementText(row.blocker.handoff)}</p>
                            ) : row.missing.length ? (
                                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(row.missing.slice(0, 2))}</p>
                            ) : (
                                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Required links and source details are present.</p>
                            )}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

function AlertPacketPanel({ packet }: { packet: AlertPacket }) {
    return (
        <Panel title='Evidence' description='Alert and case context from the selected finding. Delivery stays in the authenticated console.' icon={<BellRing className='h-4 w-4' />}>
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
                        {!actionability.geographyHandoffs.length ? <p className='text-xs text-ui-muted dark:text-ui-muted'>Use country-specific sources before regional routing.</p> : null}
                    </div>
                </div>

                <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Sources</p>
                    <div className='mt-2 grid gap-2'>
                        {actionability.sourceClusters.slice(0, 4).map(item => (
                            <div key={`${item.sourceName}-${item.provenance}`} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.sourceName}</p>
                                    <span className={item.captureId ? 'shrink-0 text-[11px] text-ui-success' : 'shrink-0 text-[11px] text-ui-warning'}>{item.captureId ? 'source linked' : 'sources syncing'}</span>
                                </div>
                                <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(item.provenance)}</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{item.watchlistTerm ? `${item.watchlistTerm.kind}: ${item.watchlistTerm.value}` : item.enrichmentTask}</p>
                            </div>
                        ))}
                        {!actionability.sourceClusters.length ? <p className='text-xs text-ui-muted dark:text-ui-muted'>Add source details before review.</p> : null}
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
                        {records.length} linked record{records.length === 1 ? '' : 's'} · {actionability.caseReplayReadiness.summary.ready} replay path{actionability.caseReplayReadiness.summary.ready === 1 ? '' : 's'} · {actionability.webhookDeliveryHandoff.ready ? 'delivery available' : 'delivery syncing'}
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
                    {records.slice(0, 2).map(record => (
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
                            <p className='text-xs font-semibold uppercase text-ui-warning'>Case review</p>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-warning'>
                                {caseIntake.summary.total} candidate{caseIntake.summary.total === 1 ? '' : 's'} for {query} · {actionability.caseReplayReadiness.summary.ready} replay path{actionability.caseReplayReadiness.summary.ready === 1 ? '' : 's'} · {caseIntake.summary.captures} capture{caseIntake.summary.captures === 1 ? '' : 's'}
                            </p>
                        </div>
                        <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                            <CopyPayloadButton label='Case replay status' payload={actionability.caseReplayReadiness} />
                            <CopyPayloadButton label='Case review intake' payload={caseIntake} />
                        </div>
                    </div>
                    <div className='mt-2 grid min-w-0 gap-2'>
                        {caseIntake.items.slice(0, 2).map(item => (
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
                    <p className='mt-2 wrap-break-word text-xs leading-5 text-ui-warning'>Rebuild alerts after saving a matching watchlist term or attaching capture evidence.</p>
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
                                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{source.captureId ? 'capture linked' : compactSourceReferenceLabel(source.provenance)}</p>
                                </div>
                                {typeof source.confidence === 'number' ? <span className='shrink-0 text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>{sourceBasisLabel(source.confidence)}</span> : null}
                            </div>
                        </div>
                    )) : (
                        <p className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10'>Add source coverage before customer review.</p>
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
                                        {watchlistIntersectionActionLabel(item.recommendedAction)} · {item.organizationId ? 'organization linked' : 'organization needed'} · {item.watchlistItemId ? 'watchlist linked' : 'watchlist item needed'}
                                    </p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {item.sourceFamilies.map(formatLabel).join(', ') || 'source family needed'} · {item.captureIds.length ? `${item.captureIds.length} source row${item.captureIds.length === 1 ? '' : 's'}` : 'sources syncing'} · {item.alertIds.length ? `${item.alertIds.length} alert${item.alertIds.length === 1 ? '' : 's'}` : 'alert needed'}
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
                        <p className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10'>Connect an organization watchlist to activate review.</p>
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
                    <p className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10'>Link a sourced watchlist term to review this actor.</p>
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
                            row.evidence.sourceId ? 'source linked' : '',
                            row.evidence.captureId ? 'capture linked' : '',
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
                                                {[row.alertId ? 'alert linked' : '', row.watchlistItemId ? 'watchlist linked' : '', row.captureIds.length ? `${row.captureIds.length} capture${row.captureIds.length === 1 ? '' : 's'} linked` : ''].filter(Boolean).join(' · ')}
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
    const [showPayloadDetails, setShowPayloadDetails] = useState(false)
    const payloads = [
        actionability.actionPayloads.payloads.watchlistAdd,
        actionability.actionPayloads.payloads.caseHandoff,
        actionability.actionPayloads.payloads.webhookDelivery,
        actionability.actionPayloads.payloads.analystHandoffBundle,
        actionability.actionPayloads.payloads.sourceEnrichment,
    ]
    const readyPayloadCount = payloads.filter(payload => payload.ready).length

    return (
        <div data-public-ti-action-exports='true' className='min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Action packages</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>Action packages for authenticated review. Copying does not change customer state.</p>
                </div>
                <div className='flex min-w-0 flex-wrap items-center gap-2'>
                    <span className={readyPayloadCount === payloads.length ? decisionStepStatusClass('ready') : decisionStepStatusClass('review')}>
                        {readyPayloadCount}/{payloads.length} available
                    </span>
                    <button type='button' onClick={() => setShowPayloadDetails(value => !value)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                        {showPayloadDetails ? 'Hide action links' : 'Show action links'}
                    </button>
                    <CopyPayloadButton label='Action packages' payload={actionability.actionPayloads} />
                </div>
            </div>
            {showPayloadDetails ? (
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
                                            <p className='mt-1 text-[11px] leading-5 text-ui-success'>Required records and source details are present.</p>
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
            ) : null}
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
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'case_handoff') {
        return [
            `${actionability.caseReviewIntake.summary.total} case candidate${actionability.caseReviewIntake.summary.total === 1 ? '' : 's'}`,
            `${actionability.caseReviewIntake.summary.alerts} alert${actionability.caseReviewIntake.summary.alerts === 1 ? '' : 's'}`,
            `${actionability.caseReviewIntake.summary.captures} capture${actionability.caseReviewIntake.summary.captures === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'webhook_delivery') {
        return [
            `${actionability.readiness.backedIds.webhookDestinationIds.length} destination${actionability.readiness.backedIds.webhookDestinationIds.length === 1 ? '' : 's'}`,
            `${actionability.readiness.backedIds.captureIds.length} capture${actionability.readiness.backedIds.captureIds.length === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    if (payload.kind === 'analyst_handoff_bundle') {
        return [
            `${actionability.consumerReadiness.stages.length} console stage${actionability.consumerReadiness.stages.length === 1 ? '' : 's'}`,
            `${actionability.alertGenerationReadiness.candidateCount} alert candidate${actionability.alertGenerationReadiness.candidateCount === 1 ? '' : 's'}`,
            actionability.alertGenerationReadiness.generationEvidenceWindowReady ? 'evidence window ready' : 'evidence window pending',
            `${actionability.readiness.backedIds.alertIds.length} alert${actionability.readiness.backedIds.alertIds.length === 1 ? '' : 's'}`,
            `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
        ]
    }
    return [
        `${actionability.sourceEnrichmentIntake.summary.total} source item${actionability.sourceEnrichmentIntake.summary.total === 1 ? '' : 's'}`,
        `${actionability.sourceEnrichmentIntake.summary.sourceRequests} source request${actionability.sourceEnrichmentIntake.summary.sourceRequests === 1 ? '' : 's'}`,
        `${actionability.sourceEnrichmentIntake.summary.captures} capture${actionability.sourceEnrichmentIntake.summary.captures === 1 ? '' : 's'}`,
        `${payload.blockedBy.length} follow-up${payload.blockedBy.length === 1 ? '' : 's'}`,
    ]
}

function ReadinessBlockersPanel({ actionability }: { actionability: TiActionabilityModel }) {
    const [showFollowUps, setShowFollowUps] = useState(false)
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
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Linked records</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>Org records, follow-up fields, and next action for this result.</p>
                </div>
                <div className='flex min-w-0 flex-wrap items-center gap-2'>
                    <span className={actionability.readiness.state === 'ready' ? decisionStepStatusClass('ready') : actionability.readiness.state === 'blocked' ? decisionStepStatusClass('blocked') : decisionStepStatusClass('review')}>
                        {publicStateLabel(actionability.readiness.state)}
                    </span>
                    {actionability.readiness.blockers.length ? (
                        <button type='button' onClick={() => setShowFollowUps(value => !value)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                            {showFollowUps ? 'Hide follow-ups' : `${actionability.readiness.blockers.length} follow-up${actionability.readiness.blockers.length === 1 ? '' : 's'}`}
                        </button>
                    ) : null}
                </div>
            </div>
            <div className='mt-3 flex min-w-0 flex-wrap gap-1.5'>
                {backedRows.map(row => (
                    <span key={row.label} className='max-w-full rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-muted'>
                        {row.label}: <span className='text-ui-text dark:text-ui-text'>{row.value}</span>
                    </span>
                ))}
            </div>
            {showFollowUps && actionability.readiness.blockers.length ? (
                <div className='mt-3 grid gap-2'>
                    {actionability.readiness.blockers.slice(0, 3).map(blocker => (
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
            ) : !actionability.readiness.blockers.length ? (
                <p className='mt-3 text-xs leading-5 text-ui-success'>No action follow-ups are open.</p>
            ) : null}
        </div>
    )
}

function ConsumerReadinessPanel({ actionability }: { actionability: TiActionabilityModel }) {
    const [showStageDetails, setShowStageDetails] = useState(false)
    const readyStages = actionability.consumerReadiness.stages.filter(stage => stage.state === 'ready').length
    return (
        <div data-ti-consumer-readiness='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <div className='flex flex-wrap items-center justify-between gap-2 text-xs'>
                <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                    Console actions · {readyStages}/{actionability.consumerReadiness.stages.length} available
                </p>
                <div className='flex min-w-0 flex-wrap items-center gap-2'>
                    <button type='button' onClick={() => setShowStageDetails(value => !value)} className='inline-flex min-h-7 items-center justify-center border-l border-ui-border pl-2 text-[11px] font-semibold text-ui-text transition hover:text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:text-ui-text'>
                        {showStageDetails ? 'Hide stages' : 'Show stages'}
                    </button>
                    <CopyPayloadButton label='Console actions' payload={actionability.consumerReadiness.bundlePreview} />
                </div>
            </div>
            {showStageDetails ? (
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
                                            <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                                {consumerRequestActionLabel(stage.request.method, stage.request.path)}
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
            ) : null}
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
            { key: 'casePath', label: 'Case link', required: false },
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
    if (state === 'ready') return 'max-w-full wrap-break-word rounded-md border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (state === 'review') return 'max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'
    return 'max-w-full wrap-break-word rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}

function sourceHealthChipClass(state: SourceHealthRow['state']) {
    if (state === 'ready') return 'max-w-full wrap-break-word rounded-md border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (state === 'review') return 'max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'
    return 'max-w-full wrap-break-word rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}

function compactSourceReferenceLabel(value: string, sourceName?: string, query?: string) {
    const cleaned = displayRequirementText(value).trim()
    const fallback = sourceReferenceSummary(sourceName, query)
    if (!cleaned) return fallback
    if (/^https?:\/\//i.test(value) || /[/?=&]{2,}/.test(value)) return fallback
    if (/[{}[\]]/.test(value) || /\b[a-f0-9]{24,}\b/i.test(value)) return fallback
    if (cleaned.length > 96) return fallback
    return cleaned
}

function sourceReferenceSummary(sourceName?: string, query?: string) {
    const source = (sourceName || 'This source').trim()
    const actor = humanizeSlug(query || 'this actor')
    if (/malpedia/i.test(source)) return `Malpedia's actor summary for ${actor}.`
    if (/mitre/i.test(source)) return `MITRE ATT&CK's group profile for ${actor}.`
    if (/google cloud security/i.test(source)) return `Google Cloud Security's APT group directory entry for ${actor}.`
    if (/cisa/i.test(source)) return `CISA advisories used to cross-check public government reporting on ${actor}.`
    if (/live reporting query/i.test(source)) return `Live news search used to refresh recent reporting on ${actor}.`
    return `${source} reporting used for ${actor} context.`
}

function sourceHealthEvidenceLabel(row: SourceHealthRow) {
    if (row.captureId) return 'capture reference linked'
    const hasFieldPath = row.provenance.includes('[') || row.provenance.includes(']') || /sourceProvenance|relatedAlerts|handoffs|actorIntelligence/i.test(row.provenance)
    if (hasFieldPath) {
        return `${formatLabel(row.sourceFamily)} evidence request`
    }
    return compactSourceReferenceLabel(row.provenance)
}

function handoffMissingLabel(values: string[]) {
    return unique(values.map(value => {
        if (/sourceProvenance|capture|source request|source URL|source hash|url/i.test(value)) return sourceHealthFieldLabel(value)
        if (/organization|org|tenant/i.test(value)) return 'organization scope'
        if (/watchlist/i.test(value)) return 'watchlist item'
        if (/alert/i.test(value)) return 'alert review'
        if (/case/i.test(value)) return 'case link'
        if (/webhook|destination/i.test(value)) return 'webhook destination'
        if (/fresh|stale|after/i.test(value)) return 'fresh source evidence'
        return value
    })).join('; ')
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

function recommendedActionLabel(value: string) {
    return displayRequirementText(formatLabel(value))
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
                ? `${actionability.sourceProvenance.length} source reference${actionability.sourceProvenance.length === 1 ? '' : 's'} found; ${sourceMissing.length ? 'capture details still needed' : 'evidence is attached'}.`
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
            detail: actionability.caseHandoff.blocked ? 'Case creation needs alert review and org-scoped context.' : 'Ready to open from related alert context.',
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
    const feedback = state === 'copied' ? 'Copied' : state === 'failed' ? 'Unavailable' : ''
    const visibleLabel = feedback || (showLabel ? label : '')
    const className = `inline-flex min-h-8 ${visibleLabel ? 'min-w-16 px-2.5' : 'min-w-8 px-2'} max-w-full items-center justify-center gap-1.5 justify-self-start whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised`

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
        <button type='button' onClick={copyPayload} className={className} aria-label={`Copy ${label} payload`} title={`Copy ${label}`}>
            {state === 'copied' ? <CheckCircle2 className='h-3.5 w-3.5 text-ui-success' /> : <Copy className='h-3.5 w-3.5' />}
            {visibleLabel}
        </button>
    )
}

function EnrichmentTasksPanel({ tasks, intake }: { tasks: EnrichmentTask[]; intake: TiActionabilityModel['sourceEnrichmentIntake'] }) {
    return (
        <Panel title='Open source questions' description='Source, capture, and data work required before this result can support stronger alerts.' icon={<Database className='h-4 w-4' />}>
            <div className='mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                    <span className='font-semibold text-ui-text dark:text-ui-text'>Source review</span> · {intake.summary.total} item{intake.summary.total === 1 ? '' : 's'} · {intake.summary.sourceRequests} source request{intake.summary.sourceRequests === 1 ? '' : 's'} · {intake.summary.captures} capture{intake.summary.captures === 1 ? '' : 's'}
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
    const [showAllQuestions, setShowAllQuestions] = useState(false)
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const selectedEvidence = selectedRow?.evidenceItems.find(item => item.id === selectedId) ?? selectedRow?.evidenceItems[0]
    const selectedArtifact = selectedRow?.artifactIds.find(id => id === selectedArtifactId) ?? selectedRow?.artifactIds[0]
    const blockedCount = rows.filter(row => row.state === 'blocked').length
    const reviewCount = rows.filter(row => row.state === 'review').length
    const compactRows = rows.slice(0, TI_WORKBENCH_PREVIEW_ROWS)
    const visibleRows = showAllQuestions
        ? rows
        : selectedRow && !compactRows.some(row => row.id === selectedRow.id)
            ? [...compactRows.slice(0, TI_WORKBENCH_PREVIEW_ROWS - 1), selectedRow]
            : compactRows
    const hiddenQuestionCount = Math.max(0, rows.length - visibleRows.length)

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
                    <table className='min-w-170 w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Open question</th>
                                <th className='px-3 py-2 font-semibold'>Entity</th>
                                <th className='px-3 py-2 font-semibold'>Freshness</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {visibleRows.map(row => {
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
                {hiddenQuestionCount ? (
                    <button
                        type='button'
                        onClick={() => setShowAllQuestions(true)}
                        className='inline-flex min-h-9 w-fit items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                    >
                        Show {hiddenQuestionCount} more questions
                    </button>
                ) : showAllQuestions && rows.length > compactRows.length ? (
                    <button
                        type='button'
                        onClick={() => setShowAllQuestions(false)}
                        className='inline-flex min-h-9 w-fit items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                    >
                        Show key questions only
                    </button>
                ) : null}
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
                        <p className='mt-3 wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                            {selectedRow.source} · {selectedRow.evidenceItems.length} evidence · {selectedRow.artifactIds.length} details · {selectedRow.missing.length} missing
                        </p>
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
                            {selectedRow.route ? <a href={selectedRow.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'><ExternalLink className='h-3.5 w-3.5' />Open action</a> : null}
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
    const [showSourceDetails, setShowSourceDetails] = useState(false)
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
                        {(consumerReadiness.rows.length || rows.length) ? (
                            <button type='button' onClick={() => setShowSourceDetails(value => !value)} className='inline-flex min-h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                {showSourceDetails ? 'Hide source details' : 'Show source details'}
                            </button>
                        ) : null}
                    </div>
                </div>
                {showSourceDetails ? (
                    <>
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
                        {rows.length ? rows.slice(0, 3).map(row => (
                            <div key={row.id} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                            {formatLabel(row.sourceFamily)} · {formatDate(row.timestamp)} · {row.parserStatus}
                                        </p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                            {sourceHealthEvidenceLabel(row)}
                                        </p>
                                    </div>
                                    <span className={decisionStepStatusClass(row.state)}>{publicDecisionStatusLabel(row.state)}</span>
                                </div>
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {row.sourceId ? <span className={sourceHealthChipClass('review')}>source linked</span> : null}
                                    {row.sourceRequestId ? <span className={sourceHealthChipClass('review')}>request linked</span> : null}
                                    <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? 'source linked' : 'sources syncing'}</span>
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
                        )) : null}
                    </>
                ) : !rows.length ? (
                    <p className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>Use sources before sending this actor to a customer path.</p>
                ) : null}
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
    const [showWorkflowDetails, setShowWorkflowDetails] = useState(false)
    const readyForCase = Boolean(reviewHandoff?.caseHandoff.ready)
    const readyForAlert = Boolean(reviewHandoff?.alertHandoff.ready)
    const workflowDetailCount = [
        caseDraft,
        caseOwnership,
        caseCreateRequest,
        watchlistPlan,
        alertPlan,
        deliveryPlan,
        enrichmentTriage,
        caseActionTrail,
        reviewHandoff,
    ].filter(Boolean).length
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
                {workflowDetailCount ? (
                    <button type='button' onClick={() => setShowWorkflowDetails(value => !value)} className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                        {showWorkflowDetails ? 'Hide action detail' : `Show action detail (${workflowDetailCount})`}
                    </button>
                ) : null}
                {showWorkflowDetails ? (
                    <>
                        {caseDraft ? <SelectedCaseDraftPanel draft={caseDraft} /> : null}
                        {caseOwnership ? <SelectedCaseOwnershipPanel plan={caseOwnership} /> : null}
                        {caseCreateRequest ? <SelectedCaseCreateRequestPanel request={caseCreateRequest} /> : null}
                        {watchlistPlan ? <SelectedWatchlistPlanPanel plan={watchlistPlan} /> : null}
                        {alertPlan ? <SelectedAlertActionPlanPanel plan={alertPlan} /> : null}
                        {deliveryPlan ? <SelectedDeliveryReadinessPanel plan={deliveryPlan} /> : null}
                        {enrichmentTriage ? <SelectedEnrichmentTriagePanel triage={enrichmentTriage} /> : null}
                        {caseActionTrail ? <CaseActionTrailPanel trail={caseActionTrail} /> : null}
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
                    </>
                ) : null}
                <button
                    type='button'
                    onClick={onStage}
                    disabled={!reviewHandoff || !caseDraft || !caseOwnership || !caseCreateRequest || !watchlistPlan || !alertPlan || !deliveryPlan || !enrichmentTriage || !caseActionTrail}
                    className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised dark:disabled:bg-ui-raised dark:disabled:text-ui-muted'
                >
                    <ClipboardList className='h-3.5 w-3.5' />
                    Stage handoff
                </button>
            </div>
        </Panel>
    )
}

function SelectedCaseOwnershipPanel({ plan }: { plan: SelectedCaseOwnershipPlan }) {
    return (
        <div data-ti-selected-case-ownership='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs'>
                <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                    Case actions · {plan.summary.caseCandidates} candidates · {plan.summary.replayReady} replay-ready · {plan.summary.relatedAlerts} alerts · {plan.summary.captures} captures
                </p>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(plan.state)}>{decisionStepStatusLabel(plan.state)}</span>
                    <CopyPayloadButton label='Case ownership' payload={plan} />
                </div>
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
                            {caseReviewReferenceSummary(item)}
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
                            {row.caseId ? 'case linked' : row.blockerCodes.slice(0, 2).join(', ') || 'case link pending'}
                        </span>
                    ))}
                </div>
            ) : null}
            {plan.blockers.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(plan.blockers.slice(0, 4))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Case link, alert, capture, and source references are ready for authenticated review.</p>
            )}
        </div>
    )
}

function caseReviewReferenceSummary(item: SelectedCaseOwnershipPlan['caseReviewItems'][number]) {
    const parts = [
        item.alertIds.length ? `${item.alertIds.length} alert${item.alertIds.length === 1 ? '' : 's'} linked` : 'alert link pending',
        item.casePaths.length ? `${item.casePaths.length} case route${item.casePaths.length === 1 ? '' : 's'} linked` : '',
        item.captureIds.length ? `${item.captureIds.length} capture${item.captureIds.length === 1 ? '' : 's'} linked` : '',
    ].filter(Boolean)
    return parts.join(' · ')
}

function SelectedCaseCreateRequestPanel({ request }: { request: SelectedCaseCreateRequest }) {
    return (
        <div data-ti-selected-case-create-request='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs'>
                <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                    Case request · {request.refs.alertIds.length} alerts · {request.refs.captureIds.length} captures · {request.sourceRows.length} sources · {request.refs.watchTerms.length} terms
                </p>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(request.state)}>{decisionStepStatusLabel(request.state)}</span>
                    <CopyPayloadButton label='Case create request' payload={request} />
                </div>
            </div>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{consumerRequestPathLabel(request.request.path)} ready for authenticated review.</p>
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
                        {request.actionReplay.rows.filter(row => row.ready).length}/{request.actionReplay.rows.length} replay paths
                    </span>
                    {request.watchlistBasis.intersections.slice(0, 2).map(item => (
                        <span key={item.intersectionId} className={sourceHealthChipClass(item.state === 'ready' ? 'ready' : item.state === 'blocked' ? 'blocked' : 'review')}>
                            {item.watchlistItemId ? 'watchlist linked' : item.value}
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
                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}{row.sourceId ? ' · source linked' : ''}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.provenance)}</p>
                                </div>
                                <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? 'source linked' : 'sources syncing'}</span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                {row.reportDate ? formatDate(row.reportDate) : 'report date pending'}{typeof row.confidence === 'number' ? ` · ${sourceBasisLabel(row.confidence)}` : ''}{row.missing.length ? ` · needs ${handoffMissingLabel(row.missing)}` : ''}
                            </p>
                            <div data-ti-selected-case-provenance-fingerprints='true' className='mt-1 flex min-w-0 flex-wrap gap-1.5'>
                                <span className={sourceHealthChipClass('review')}>{row.provenanceRefs.length} source ref{row.provenanceRefs.length === 1 ? '' : 's'}</span>
                                <span className={sourceHealthChipClass(row.provenanceFingerprint ? 'ready' : 'blocked')}>
                                    {row.provenanceFingerprint ? 'fingerprint linked' : 'fingerprint pending'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {request.refs.alertIds.slice(0, 3).map(id => <span key={id} className={sourceHealthChipClass('ready')}>alert linked</span>)}
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
                                        {formatLabel(row.priority)} · {row.alertIds.length} alert review{row.alertIds.length === 1 ? '' : 's'} · {row.captureIds.length} capture reference{row.captureIds.length === 1 ? '' : 's'} · {readinessOwnerLabel(row.ownerLane)}
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
                                {row.sourceIds.slice(0, 3).map(sourceId => <span key={sourceId} className={sourceHealthChipClass('review')}>source linked</span>)}
                                {row.provenanceFingerprints.slice(0, 2).map(fingerprint => (
                                    <span key={fingerprint} className={sourceHealthChipClass('ready')}>
                                        fingerprint linked
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
        <div data-ti-selected-watchlist-plan='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs'>
                <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                    Watchlist actions · {plan.terms.length} terms · {plan.relevanceRows.filter(item => item.fit === 'matched').length} matches · {plan.sourceRefs.alertIds.length} alerts · {plan.sourceRefs.captureIds.length} captures
                </p>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(status)}>{decisionStepStatusLabel(status)}</span>
                    <CopyPayloadButton label='Watchlist plan' payload={plan} />
                </div>
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
                {!plan.terms.length ? <p className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-[11px] leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>Attach a watchlist term before opening this evidence for review.</p> : null}
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
                                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{source.sourceName}{source.sourceId ? ' · source linked' : ''}</p>
                                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                                        {source.sourceFamily ? formatLabel(source.sourceFamily) : 'source type pending'} · {source.reportDate ? formatDate(source.reportDate) : source.lastCollectedAt ? formatDate(source.lastCollectedAt) : 'date pending'} · {source.parserStatus ?? 'processing status pending'}
                                                    </p>
                                                </div>
                                                <span className={sourceHealthChipClass(source.captureId ? 'ready' : 'blocked')}>{source.captureId ? 'source linked' : 'sources syncing'}</span>
                                            </div>
                                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(source.provenance)}</p>
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
        <div data-ti-selected-enrichment-triage='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs'>
                <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                    Source actions · {triage.summary.sourceRows} sources · {triage.summary.intakeItems} work items · {triage.summary.sourceRequests} requests · {triage.summary.captures} captures
                </p>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(triage.state)}>{decisionStepStatusLabel(triage.state)}</span>
                    <CopyPayloadButton label='Review alert' payload={triage} />
                </div>
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
                            <span className={sourceHealthChipClass(row.matchingIntakeItemIds.length ? 'review' : 'blocked')}>{row.matchingIntakeItemIds.length} source item{row.matchingIntakeItemIds.length === 1 ? '' : 's'}</span>
                            {row.captureId ? <span className={sourceHealthChipClass('ready')}>source linked</span> : <span className={sourceHealthChipClass('blocked')}>sources syncing</span>}
                            {row.sourceRequestId ? <span className={sourceHealthChipClass('review')}>request {row.sourceRequestId}</span> : null}
                        </div>
                        <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.recommendedAction)}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{sourceRequestRouteLabel(row.remediationPath)} in the analyst console.</p>
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
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>Map this source to a customer action.</p>
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
        <div data-ti-selected-alert-action-plan='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs'>
                <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                    Alert actions · {plan.readiness.matchedCandidateCount}/{plan.readiness.candidateCount} matches · {plan.sourceRefs.captureIds.length} captures · {plan.readiness.generationEvidenceWindowReady ? 'evidence current' : 'evidence pending'}
                </p>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(status)}>{decisionStepStatusLabel(status)}</span>
                    <CopyPayloadButton label='Alert action plan' payload={plan} />
                </div>
            </div>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>
                {plan.handoff.route || plan.route ? 'Console action available.' : 'Console action pending.'}
            </p>
            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(plan.nextAction)}</p>
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {plan.watchlist.terms.slice(0, 4).map(term => (
                    <span key={term} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>{term}</span>
                ))}
                {!plan.watchlist.terms.length ? <span className='text-[11px] text-ui-muted dark:text-ui-muted'>Add watch term.</span> : null}
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
                                {row.captureIds.length ? <span className={sourceHealthChipClass('ready')}>{row.captureIds.length} source row{row.captureIds.length === 1 ? '' : 's'}</span> : <span className={sourceHealthChipClass('blocked')}>sources syncing</span>}
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                {row.route ? 'Source action available.' : 'Source action pending.'}
                            </p>
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
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Alert rebuild has the required watchlist and sources.</p>
            )}
        </div>
    )
}

function SelectedDeliveryReadinessPanel({ plan }: { plan: SelectedDeliveryReadinessPlan }) {
    return (
        <div data-ti-selected-delivery-readiness='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs'>
                <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                    Delivery actions · {plan.summary.alerts} alerts · {plan.summary.captures} captures · {plan.summary.destinations} destinations · {plan.summary.caseRoutes} case links
                </p>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(plan.state)}>{decisionStepStatusLabel(plan.state)}</span>
                    <CopyPayloadButton label='Delivery status' payload={plan} />
                </div>
            </div>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>
                {plan.handoff.route || plan.route ? 'Delivery action available.' : 'Delivery action pending.'}
            </p>
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
                            {alert.captureIds.length ? `${alert.captureIds.length} source row${alert.captureIds.length === 1 ? '' : 's'}` : 'sources syncing'}
                            {alert.destinationIds.length ? ` · ${alert.destinationIds.length} destination${alert.destinationIds.length === 1 ? '' : 's'}` : ' · destination needed'}
                            {alert.casePath ? ` · ${displayRequirementText(alert.casePath)}` : ' · case link pending'}
                        </p>
                        {alert.blockers.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(alert.blockers.slice(0, 3))}</p>
                        ) : null}
                    </div>
                ))}
                {!plan.alerts.length ? (
                    <p className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-[11px] leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>Generate an alert before opening a case.</p>
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
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Alert, capture, destination, and case link refs are ready for authenticated dry-run delivery.</p>
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
                        Source-safe trail for local decisions, selected evidence, and case replay state.
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
                            {eventProvenanceSummary(event.provenance)}
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

function eventProvenanceSummary(provenance: CaseActionTrailEvent['provenance']) {
    const parts = [
        provenance.sourceIds.length ? `${provenance.sourceIds.length} source${provenance.sourceIds.length === 1 ? '' : 's'} linked` : 'source link pending',
        provenance.captureIds.length ? `${provenance.captureIds.length} capture${provenance.captureIds.length === 1 ? '' : 's'} linked` : '',
        provenance.alertIds.length ? `${provenance.alertIds.length} alert${provenance.alertIds.length === 1 ? '' : 's'} linked` : '',
    ].filter(Boolean)
    return parts.join(' · ')
}

function SelectedCaseDraftPanel({ draft }: { draft: SelectedCaseDraft }) {
    return (
        <div data-ti-selected-case-draft='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs'>
                <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                    Case draft · {formatLabel(draft.caseIntent)} · {draft.sourceRows.length} source row{draft.sourceRows.length === 1 ? '' : 's'}
                </p>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={draft.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{draft.ready ? 'ready' : 'syncing'}</span>
                    <CopyPayloadButton label='Case draft' payload={draft} />
                </div>
            </div>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(draft.route || draft.endpoint)}</p>
            {draft.sourceRows.length ? (
                <div data-ti-selected-case-sources='true' className='mt-2 grid min-w-0 gap-2'>
                    {draft.sourceRows.slice(0, 2).map(row => (
                        <div key={`${row.sourceId ?? row.sourceName}:${row.provenance}:${row.captureId ?? 'missing'}`} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}{row.sourceId ? ' · source linked' : ''}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.provenance)}</p>
                                </div>
                                <span className={sourceHealthChipClass(row.state === 'ready' ? 'ready' : row.state === 'needs_capture' ? 'blocked' : 'review')}>
                                    {row.captureId ? 'source linked' : 'sources syncing'}
                                </span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                {typeof row.confidence === 'number' ? sourceBasisLabel(row.confidence) : 'evidence strength pending'}{row.missing.length ? ` · needs ${handoffMissingLabel(row.missing)}` : ''}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {draft.watchTerms.slice(0, 3).map(term => (
                    <span key={term} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>{term}</span>
                ))}
                {!draft.watchTerms.length ? <span className='text-[11px] text-ui-muted dark:text-ui-muted'>Add watch term.</span> : null}
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
        <Panel title='Saved drafts' description='Session-local review drafts. Open the authenticated console before submitting ownership or case changes.' icon={<ClipboardList className='h-4 w-4' />}>
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
                        {items.slice(0, 2).map(item => (
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
    const lowerLevelFollowUps = [
        actorReady ? 0 : 1,
        artifactReady ? 0 : item.selectedArtifact.readiness.blockers.length || item.selectedArtifact.readiness.missing.length || 1,
        item.caseCreateRequest.watchlistBasis.ready ? 0 : item.caseCreateRequest.watchlistBasis.blockers.length || 1,
        enrichmentReady ? 0 : item.enrichmentTriage.summary.blockers || 1,
        replayReady ? 0 : 1,
    ].reduce((total, count) => total + count, 0)
    return [
        { label: 'review', value: item.reviewHandoff.blockers.length ? `${item.reviewHandoff.blockers.length} follow-up${item.reviewHandoff.blockers.length === 1 ? '' : 's'}` : 'ready', ready: item.reviewHandoff.blockers.length === 0 },
        { label: 'source', value: sourceMissing.length ? `${sourceMissing.length} missing` : `${item.sourceDrilldown.rows.length} result${item.sourceDrilldown.rows.length === 1 ? '' : 's'}`, ready: sourceMissing.length === 0 },
        { label: 'case', value: item.caseDraft.missing.length ? `${item.caseDraft.missing.length} missing` : item.caseDraft.route ? 'case link ready' : 'draft ready', ready: item.caseDraft.missing.length === 0 },
        { label: 'owner', value: ownershipReady ? item.caseOwnership.owner.label : item.caseOwnership.blockers.length ? `${item.caseOwnership.blockers.length} follow-up${item.caseOwnership.blockers.length === 1 ? '' : 's'}` : 'review', ready: ownershipReady },
        { label: 'alert', value: alertReady ? `${item.alertPlan.readiness.matchedCandidateCount} matched` : item.alertPlan.blockers.length ? `${item.alertPlan.blockers.length} follow-up${item.alertPlan.blockers.length === 1 ? '' : 's'}` : 'review', ready: alertReady },
        { label: 'delivery', value: deliveryReady ? `${item.deliveryPlan.summary.destinations} destination${item.deliveryPlan.summary.destinations === 1 ? '' : 's'}` : item.deliveryPlan.blockers.length ? `${item.deliveryPlan.blockers.length} follow-up${item.deliveryPlan.blockers.length === 1 ? '' : 's'}` : 'review', ready: deliveryReady },
        { label: 'source review', value: enrichmentReady ? `${item.enrichmentTriage.summary.intakeItems} intake` : item.enrichmentTriage.summary.blockers ? `${item.enrichmentTriage.summary.blockers} follow-up${item.enrichmentTriage.summary.blockers === 1 ? '' : 's'}` : 'review', ready: enrichmentReady },
        { label: 'activity', value: trailReady ? `${item.caseActionTrail.summary.total} events` : item.caseActionTrail.summary.blocked ? `${item.caseActionTrail.summary.blocked} syncing` : 'review', ready: trailReady },
        ...(lowerLevelFollowUps ? [{ label: 'more', value: `${lowerLevelFollowUps} follow-up${lowerLevelFollowUps === 1 ? '' : 's'}`, ready: false }] : []),
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
            <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>Analyst brief</p>
            <BriefStep title='Summary' value={brief.whatHappened} />
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
    const motivation = actor.motivation.slice(0, 2).join(' · ') || 'Motivation not stated'
    const sourceMeta = `${sourceCountLabel(sourceCount)} · latest ${formatDate(latestDate)} · ${sourceBasisLabel(actor.confidence)}`
    const captureMeta = actor.sourceCoverage.captureRows
        ? `${actor.sourceCoverage.captureRows} captured page${actor.sourceCoverage.captureRows === 1 ? '' : 's'}`
        : actor.sourceCoverage.missing.length
            ? 'capture evidence needed'
            : 'capture optional'
    const workflowSummary = [
        `${sourceCountLabel(sourceCount)} linked`,
        actionability.watchlistRelevance.terms.length ? `${actionability.watchlistRelevance.terms.length} watch terms` : 'watch term needed',
        actionability.relatedAlerts.length ? `${actionability.relatedAlerts.length} linked alerts` : actionability.alertGenerationReadiness.candidateCount ? `${actionability.alertGenerationReadiness.candidateCount} alert candidates` : 'watchlist before alert',
        actionability.relatedCases.length ? `${actionability.relatedCases.length} linked cases` : actionability.caseReviewIntake.summary.total ? `${actionability.caseReviewIntake.summary.total} case candidates` : 'case source needed',
    ].join(' · ')
    const facts = [
        {
            icon: <ShieldAlert className='h-4 w-4' />,
            label: 'Actor type',
            value: actor.actorClass || 'Actor class not stated',
            meta: motivation,
        },
        {
            icon: <ShieldCheck className='h-4 w-4' />,
            label: 'Attribution',
            value: actor.attribution || 'Attribution not stated',
            meta: actor.confidenceReasoning[0] ? displayRequirementText(actor.confidenceReasoning[0]) : sourceBasisLabel(actor.confidence),
        },
        {
            icon: <Globe2 className='h-4 w-4' />,
            label: 'Targets',
            value: targets.length ? targets.join(' · ') : 'No target pattern yet',
            meta: actor.geographies.length ? `${actor.geographies.length} region${actor.geographies.length === 1 ? '' : 's'}` : `${actor.targetSectors.length} target pattern${actor.targetSectors.length === 1 ? '' : 's'}`,
        },
        {
            icon: <Activity className='h-4 w-4' />,
            label: 'Methods',
            value: methodNames.length ? methodNames.join(' · ') : 'No mapped method yet',
            meta: `${actor.techniqueCoverage.length} technique${actor.techniqueCoverage.length === 1 ? '' : 's'} mapped`,
        },
        {
            icon: <Database className='h-4 w-4' />,
            label: 'Source coverage',
            value: sourceMeta,
            meta: captureMeta,
        },
        {
            icon: <Clock3 className='h-4 w-4' />,
            label: 'Observed period',
            value: actor.firstSeen ? `${displayRequirementText(actor.firstSeen)} to ${formatDate(actor.lastSeen || latestDate)}` : `Updated ${formatDate(latestDate)}`,
            meta: actor.freshness.reason,
        },
    ] as const
    const review = {
        icon: <ClipboardList className='h-4 w-4' />,
        value: openGap ? displayRequirementText(openGap.title) : 'Profile has enough sources for review',
        meta: openGap ? sourceHealthFieldLabel(openGap.requestedFields[0] ?? 'source') : 'No open source question',
    }

    return (
        <section data-ti-actor-glance='true' data-ti-actor-highlights='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>Actor summary</p>
                    <h2 className='mt-1 wrap-break-word text-base font-semibold text-ui-text dark:text-ui-text'>{actor.actorClass || 'Actor profile'}</h2>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Aliases: {aliases.length ? aliases.join(' · ') : 'No aliases in this actor profile'}{result.aliases.length > aliases.length ? ` · +${result.aliases.length - aliases.length} more` : ''}
                    </p>
                </div>
                <span className={sourceHealthChipClass(actor.sourceCoverage.stale ? 'review' : 'ready')}>
                    {actor.sourceCoverage.stale ? 'refresh recommended' : 'current source set'}
                </span>
            </div>
            <div data-ti-actor-summary-grid='true' className='mt-3 grid min-w-0 gap-2 sm:grid-cols-2'>
                {facts.map(fact => (
                    <ActorSummaryFact key={fact.label} icon={fact.icon} label={fact.label} value={fact.value} meta={fact.meta} />
                ))}
            </div>
            <div className='mt-3 grid min-w-0 gap-2 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>
                            <span className='shrink-0 text-ui-primary dark:text-ui-primary'>{review.icon}</span>
                            Next review
                        </p>
                        <p className='mt-1 wrap-break-word text-sm font-semibold leading-5 text-ui-text dark:text-ui-text'>{review.value}</p>
                    </div>
                    <span className={sourceHealthChipClass(openGap ? 'review' : 'ready')}>{openGap ? 'review' : 'ready'}</span>
                </div>
                <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{review.meta} · {workflowSummary}</p>
            </div>
            {techniques.length ? (
                <div className='mt-3 flex min-w-0 flex-wrap items-center gap-1.5'>
                    <span className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>ATT&CK</span>
                    {techniques.map(item => item.attackId ? (
                        <TechniqueBadge key={`${item.attackId}:${item.name}`} attackId={item.attackId} name={item.name} tactic={item.tactic} detail={item.detail} />
                    ) : (
                        <span key={`${item.name}:${item.tactic}`} className={sourceHealthChipClass(item.freshness)}>{displayRequirementText(item.name)}</span>
                    ))}
                </div>
            ) : null}
            {actor.provenanceRows.length ? (
                <p className='mt-3 wrap-break-word border-t border-ui-border pt-3 text-xs leading-5 text-ui-muted dark:border-ui-border dark:text-ui-muted'>
                    Sources used: {actor.provenanceRows.slice(0, 4).map(row => `${row.sourceName}${row.reportDate ? ` (${formatDate(row.reportDate)})` : ''}`).join(' · ')}
                </p>
            ) : null}
            {actor.confidenceReasoning.length ? (
                <div className='mt-3 border-t border-ui-border pt-3 dark:border-ui-border'>
                    <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Confidence basis</p>
                    <ul className='mt-1 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {actor.confidenceReasoning.slice(0, TI_DOSSIER_REASON_ROWS).map(item => (
                            <li key={item} className='wrap-break-word'>{displayRequirementText(item)}</li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </section>
    )
}

function ActorSummaryFact({ icon, label, value, meta }: { icon: ReactNode; label: string; value: string; meta: string }) {
    return (
        <div className='min-w-0 border-l border-ui-border py-1 pl-2 dark:border-ui-border'>
            <p className='inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>
                <span className='shrink-0 text-ui-primary dark:text-ui-primary'>{icon}</span>
                <span className='truncate'>{label}</span>
            </p>
            <p className='mt-0.5 wrap-break-word text-sm font-semibold leading-5 text-ui-text dark:text-ui-text'>{value}</p>
            <p className='mt-0.5 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{meta}</p>
        </div>
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
        <div className='min-w-0 border-l border-ui-border py-1 pl-2 dark:border-ui-border'>
            <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{label}</p>
            <p className='mt-0.5 wrap-break-word text-sm font-semibold leading-5 text-ui-text dark:text-ui-text'>{value || 'Not stated'}</p>
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
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Evidence strength</span>
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
                        <option value='confidence'>Evidence strength</option>
                        <option value='freshness'>Freshness</option>
                    </select>
                </label>
            </div>
            {sourceCounts.length ? (
                <p data-ti-source-count-summary='true' className='line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                    {sourceCounts.slice(0, 3).map(item => `${item.source} ${item.count}`).join(' · ')}
                    {sourceCounts.length > 3 ? ` · +${sourceCounts.length - 3} more` : ''}
                </p>
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
    watchlistHref,
    caseHref,
    alertHref,
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
    watchlistHref?: string
    caseHref?: string
    alertHref?: string
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
                    <a href='#ti-selected-evidence' className='inline-flex min-h-6 items-center rounded-md px-1 text-ui-primary dark:text-ui-primary'>Detail</a>
                </div>
            </div>

            <div data-ti-mobile-filter-controls='true' className='grid min-w-0 grid-cols-3 gap-1.5'>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Type</span>
                    <select value={kind} onChange={event => onKindChange(event.target.value as AnalystWorkItem['kind'] | 'all')} className='h-8 min-w-0 rounded-md border border-ui-border bg-ui-panel px-1.5 text-[11px] font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        {kindOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                </label>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source</span>
                    <select value={source} onChange={event => onSourceChange(event.target.value)} className='h-8 min-w-0 rounded-md border border-ui-border bg-ui-panel px-1.5 text-[11px] font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='all'>All</option>
                        {sourceCounts.slice(0, TI_MOBILE_SOURCE_FILTER_OPTIONS).map(item => <option key={item.source} value={item.source}>{item.source} ({item.count})</option>)}
                    </select>
                </label>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Basis</span>
                    <select value={confidence} onChange={event => onConfidenceChange(event.target.value as 'all' | 'high' | 'medium')} className='h-8 min-w-0 rounded-md border border-ui-border bg-ui-panel px-1.5 text-[11px] font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='all'>Any</option>
                        <option value='high'>Strong</option>
                        <option value='medium'>Moderate</option>
                    </select>
                </label>
            </div>

            <div data-ti-mobile-console-links='true' className='grid grid-cols-4 gap-1.5'>
                <StripActionButton icon={<BellRing className='h-3 w-3' />} onClick={onWatchlist} href={watchlistHref} iconOnly>Watch</StripActionButton>
                <StripActionButton icon={<ClipboardList className='h-3 w-3' />} onClick={onCase} href={caseHref} disabled={!caseHref && !caseAvailable} iconOnly>Open case</StripActionButton>
                <StripActionButton icon={<Send className='h-3 w-3' />} onClick={onEscalate} href={alertHref} iconOnly>Escalate</StripActionButton>
                <StripActionButton icon={<CheckCircle2 className='h-3 w-3' />} onClick={onMarkReviewed} iconOnly>Review</StripActionButton>
            </div>
        </section>
    )
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
    const [showSearchHelp, setShowSearchHelp] = useState(false)
    const launchItems = [
        { label: 'acworth-ga.gov', href: '/ti/acworth-ga.gov', icon: <Building2 className='h-4 w-4' /> },
        { label: 'APT29', href: '/ti/APT29', icon: <ShieldCheck className='h-4 w-4' /> },
        { label: 'LockBit', href: '/ti/LockBit', icon: <ShieldAlert className='h-4 w-4' /> },
        { label: 'microsoft.com', href: '/ti/Microsoft', icon: <Building2 className='h-4 w-4' /> },
    ]
    const outcomeItems = [
        ['Recent evidence', 'Recent company, actor, domain, and detail results with evidence strength, last-seen age, source family, and review state.'],
        ['Sources', 'Linked source references and open questions so analysts can judge whether a result is useful.'],
        ['Watchlist fit', 'Company, supplier, domain, and portfolio terms are separated from broad actor background.'],
        ['Follow-up actions', 'Review, watch, escalate, export, or open the authenticated console when the result needs follow-up.'],
    ]

    return (
        <section data-ti-empty-workspace='true' className='grid justify-items-center gap-4 text-center'>
            <div className='flex flex-wrap justify-center gap-2'>
                {launchItems.map(item => (
                    <Link key={item.href} href={item.href} className='inline-flex h-9 items-center gap-2 rounded-full border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                        <span className='text-ui-primary dark:text-ui-primary'>{item.icon}</span>
                        {item.label}
                    </Link>
                ))}
                <button type='button' onClick={() => setShowSearchHelp(true)} className='inline-flex h-9 items-center gap-2 rounded-full border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised' aria-haspopup='dialog'>
                    <HelpCircle className='h-4 w-4 text-ui-primary dark:text-ui-primary' />
                    Search help
                </button>
                <Link href='/dashboard/dwm' className='inline-flex h-9 items-center gap-2 rounded-full border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-primary transition hover:border-ui-primary/35 hover:bg-ui-primary/10 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-primary dark:hover:bg-ui-raised'>
                    <BellRing className='h-4 w-4' />
                    Review recent monitoring alerts
                </Link>
            </div>
            {showSearchHelp ? (
                <div className='fixed inset-0 z-1100 grid place-items-center bg-black/45 px-4 py-6' role='dialog' aria-modal='true' aria-labelledby='ti-search-help-title'>
                    <div className='absolute inset-0' onClick={() => setShowSearchHelp(false)} aria-hidden='true' />
                    <div className='relative grid w-full max-w-2xl gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 text-left shadow-2xl dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <h2 id='ti-search-help-title' className='text-base font-semibold text-ui-text dark:text-ui-text'>Search examples</h2>
                                <p className='mt-2 text-sm leading-6 text-ui-muted dark:text-ui-muted'>
                                    Try an actor, company, domain, CVE, or malware name: Lazy Bear, APT29, LockBit, microsoft.com, CVE-2024-3094.
                                </p>
                            </div>
                            <button type='button' onClick={() => setShowSearchHelp(false)} className='grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:border-ui-primary hover:text-ui-primary' aria-label='Close search help'>
                                <XCircle className='h-4 w-4' />
                            </button>
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
                            Public results use reviewable metadata and sources. Customer notification, saved watchlists, and delivery destinations continue in the authenticated console.
                        </p>
                    </div>
                </div>
            ) : null}
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
        summary: 'Checking sources',
        confidence: 0.2,
        aliases: [],
        recentActivity: [],
        targets: [],
        ttps: [],
        datasets: [],
        sources: [],
        notes: []
    }
}

function classifyPublicTiQuery(query: string): NonNullable<TiSearchResponse['queryKind']> {
    const clean = query.trim()
    if (/^cve-\d{4}-\d{4,}$/i.test(clean)) return 'cve'
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(clean)) return 'domain'
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(clean) || /^(?:https?:\/\/|[a-f0-9]{32,128}$)/i.test(clean)) return 'indicator'
    if (/^(?:apt\d+|lockbit|akira|cozy bear|midnight blizzard)$/i.test(clean)) return 'actor'
    return clean.includes(' ') ? 'organization' : 'free_text'
}

function formatDate(value: string) {
    if (!value) return 'Date unavailable'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
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
        <Panel title='Source Activation' description='Source actions from collection policy. Analysts can stage review, but source changes require authenticated approval.' icon={<ShieldAlert className='h-4 w-4' />}>
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
                            {action.sourceId ? <p className='mt-1 text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>source reference linked</p> : null}
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
        <span className={`inline-flex min-w-0 flex-wrap items-center gap-1.5 border-l py-1 pl-2 text-xs ${dark ? 'border-ui-border text-ui-text' : 'border-ui-border text-ui-muted dark:border-ui-border dark:text-ui-muted'}`}>
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
                ? 'fill-ui-primary'
                : 'fill-ui-danger'
            : 'fill-ui-raised'
        const strokeClass = point ? 'stroke-ui-panel stroke-[0.9]' : 'stroke-ui-border stroke-[0.55]'

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
                className={`${fillClass} ${strokeClass} transition-colors ${point ? 'cursor-pointer hover:brightness-105 focus:outline-none' : 'hover:fill-ui-panel'}`}
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
                    <h2 className='text-sm font-semibold text-ui-text dark:text-ui-text'>Actor country map</h2>
                    <p className='mt-0.5 text-xs text-ui-muted dark:text-ui-muted'>
                        {hasPoints || hasRegionalAreas ? 'Reported operator origin and victim or target countries from linked sources.' : 'Country-level source coverage for this actor profile.'}
                    </p>
                </div>
                <span className='rounded-lg bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-primary dark:bg-ui-raised dark:text-ui-primary'>{hasPoints ? `${geo.points.length} countries` : hasRegionalAreas ? `${regionalAreas.length} region${regionalAreas.length === 1 ? '' : 's'}` : 'Source coverage'}</span>
            </div>
            <div className={`${hasPoints ? compact ? 'min-h-60' : 'min-h-80' : ''} relative overflow-hidden bg-ui-raised dark:bg-ui-canvas`}>
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
                            className={`${compact ? 'h-60' : 'h-80'} relative z-10 w-full cursor-grab bg-ui-panel active:cursor-grabbing dark:bg-ui-canvas`}
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
                            <rect x='0' y='0' width={MAP_WIDTH} height={MAP_HEIGHT} className='fill-ui-panel dark:fill-ui-canvas' />
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
                                        className='stroke-ui-danger'
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
                                const color = point.role === 'operator' ? 'var(--ui-primary)' : 'var(--ui-danger)'
                                const radius = point.role === 'operator' ? 5 : 4 + Math.min(5, point.count * 1.5)
                                return (
                                    <g key={`${point.role}-${point.code}`} onClick={() => focusCountry(point.code)} className='cursor-pointer'>
                                        <circle cx={x} cy={y} r={radius + 9} fill={color} opacity={active ? '0.16' : '0.08'} />
                                        <circle cx={x} cy={y} r={radius} fill={color} opacity='0.92' stroke='var(--ui-panel)' strokeWidth='1.5' />
                                        <circle cx={x} cy={y} r='2' fill='var(--ui-panel)' />
                                        <text x={x} y={y - radius - 7} textAnchor='middle' className='fill-ui-text text-[10px] font-bold' stroke='var(--ui-panel)' strokeWidth='3' paintOrder='stroke'>{point.code}</text>
                                    </g>
                                )
                            })}
                        </svg>
                    </>
                ) : (
                    <MapCoverageFallback regions={regionalAreas} actor={actor} actionability={actionability} compact={compact} />
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

function MapCoverageFallback({ regions, actor, actionability, compact = false }: { regions: string[]; actor: TiActorIntelligenceProfile; actionability: TiActionabilityModel; compact?: boolean }) {
    const families = actor.sourceCoverage.sourceFamilies.slice(0, compact ? 3 : 4)
    const gaps = actor.sourceCoverage.missing.slice(0, compact ? 1 : 3)
    const sourceRows = compact ? [] : actor.provenanceRows.slice(0, 3)
    return (
        <div data-ti-geo-coverage-fallback='true' className={`${compact ? 'gap-2 p-3' : 'gap-3 p-4'} grid bg-ui-panel dark:bg-ui-canvas`}>
            <div className={`grid gap-2 ${compact ? 'sm:grid-cols-3' : 'md:grid-cols-3'}`}>
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
                        <span className='wrap-break-word text-ui-muted dark:text-ui-muted'>{gaps[0] ? sourceHealthFieldLabel(gaps[0]) : 'Review sources'}</span>
                    </div>
                ))}
            </div>
            {!compact ? (
                <>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        {sourceRows.map(row => (
                            <div key={`${row.sourceName}-${row.provenance}`} className='rounded-lg border border-ui-border bg-ui-panel p-3 text-xs dark:border-ui-border dark:bg-ui-raised'>
                                <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.shownBecause)}</p>
                                <p className='mt-2 text-[11px] text-ui-muted dark:text-ui-muted'>{[row.reportDate ? formatDate(row.reportDate) : '', typeof row.confidence === 'number' ? sourceBasisLabel(row.confidence) : '', captureReferenceLabel(row.captureId)].filter(Boolean).join(' · ')}</p>
                            </div>
                        ))}
                        {!sourceRows.length ? (
                            <div className='rounded-lg border border-dashed border-ui-border bg-ui-panel p-3 text-xs text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-muted'>
                                Add source name, report date, and provenance before using geography for customer routing.
                            </div>
                        ) : null}
                    </div>
                    <div className='flex min-w-0 flex-wrap gap-2'>
                        <span className={sourceHealthChipClass(gaps.length ? 'review' : 'ready')}>{gaps.length ? `${gaps.length} source question${gaps.length === 1 ? '' : 's'}` : 'sources ready'}</span>
                        <span className={sourceHealthChipClass(actionability.watchlistRelevance.terms.length ? 'ready' : 'review')}>{actionability.watchlistRelevance.terms.length ? `${actionability.watchlistRelevance.terms.length} watch terms` : 'watch term needed'}</span>
                    </div>
                </>
            ) : null}
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
                                    {row.victim} · {row.reportDate ? formatDate(row.reportDate) : 'Observation date unavailable'} · {sourceBasisLabel(row.confidence)} · {sourceReferenceCountLabel(row.sourceIds, row.source)}
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
        enrichmentTask: handoff?.enrichmentTask ?? `Attach source evidence before reviewing ${point.label} in monitoring.`,
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
