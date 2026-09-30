/* eslint-disable @typescript-eslint/no-unused-vars -- Dormant TI workbench controls remain while the simplified public result view ships. */
'use client'

import { analystWorkItemsFor, citationNames, formatDate } from '../pageClientShared'
import { alertPacketFor, assertionKindLabel, defaultDecisionReason, displayRequirementText, filteredAnalystWorkItems, formatLabel, kindLabel, linkFromText, selectedAlertActionPlanFor, selectedArtifactPayloadFor, selectedCaseActionTrailFor, selectedCaseCreateRequestFor, selectedCaseDraftFor, selectedCaseOwnershipFor, selectedConsoleLinksFor, selectedDeliveryReadinessPlanFor, selectedEnrichmentTriageFor, selectedReviewHandoffFor, selectedSourceDrilldownFor, selectedWatchlistPlanFor, severityClass, sourceBasisLabel, sourceCountsFor, stagedHandoffFor, watchlistRelevanceFor, type AnalystWorkItem, type LocalDecision, type LocalRelevanceMark, type StagedHandoff } from '../pageModel'
import { buildActorArtifactHandoffs, buildActorArtifacts, type ActorArtifactKind } from '@/utils/ti/actorWorkbench'
import { buildActorIntelligence } from '@/utils/ti/actorIntelligence'
import { buildTiActionability } from '@/utils/ti/actionability'
import { humanizeSlug } from '../../seo'
import { TiSearchResponse } from '@/utils/ti/search'
import { useEffect, useMemo, useState } from 'react'
import { usefulActorSummary } from '@/utils/ti/actorSummary'
import { victimObservationsFor } from '@/utils/ti/actorProfile'
import ActorProfileHeader from './actor-profile-header'
import ActorProfileSections from './actor-profile-sections'
import ActorReferences from './actor-references'
import EvidenceBoundaryStrip from './evidence-boundary-strip'
import ThreatActorMap from './threat-actor-map'

export default function EvidenceResults({ result, error }: { result: TiSearchResponse; error: string }) {
    const sourceUrlById = useMemo(() => new Map(result.sources.map(source => [source.id, source.url || linkFromText(source.provenance)])), [result.sources])
    const sources = result.sources
    const actorQuery = result.queryKind === 'actor'
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
    const showActorActivity = !actorQuery || !result.actorIdentity || result.actorIdentity.activityEvidenceAvailable
    const hasStableActorProfile = actorQuery && Boolean(actorIntel.attribution || actorIntel.motivation.length || victimObservations.length || actorIntel.sourceProvenance.length)
    const heroVictimContext = victimObservations
        .slice(0, 4)
        .map(item => `${item.victim} (${item.country})`)
    const catalogDescription = result.actorIdentity?.candidates.length === 1 ? result.actorIdentity.candidates[0]?.description : undefined
    const actorProfileSummary = usefulActorSummary(catalogDescription) || (hasStableActorProfile
        ? displayRequirementText([
            actorIntel.attribution,
            actorIntel.motivation.length ? `Motivation: ${actorIntel.motivation.slice(0, 2).join('; ')}.` : '',
            heroVictimContext.length ? `Victim context: ${heroVictimContext.join('; ')}.` : '',
        ].filter(Boolean).join(' '))
        : displayRequirementText(result.summary))
    const actorReferences = result.actorIdentity?.candidates.length === 1 ? result.actorIdentity.candidates[0]?.referenceSources : undefined
    const citations = citationNames(actorProfileSummary)
    const [activeCitation, setActiveCitation] = useState<number | null>(null)
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
                    <div className='grid gap-4'>
                        <ActorProfileHeader result={result} title={humanizeSlug(result.query)} actor={actorIntel} aliases={result.aliases} summary={actorProfileSummary} references={actorReferences} actorQuery={actorQuery} activeCitation={activeCitation} onCitationClick={setActiveCitation} />
                    </div>
                    {actorQuery ? <section data-ti-map='true' className='min-w-0'>
                        <ThreatActorMap actor={actorIntel} result={result} onSelectCountry={(country) => selectArtifactBy('country', country)} compact />
                    </section> : null}
                </div>

                {actorQuery ? <ActorProfileSections result={result} actor={actorIntel} victims={victimObservations} /> : <EvidenceBoundaryStrip result={result} />}

                {showActorActivity ? <section id='ti-activity' data-ti-activity='true' className='grid gap-3 border-t border-ui-border pt-4 dark:border-ui-border'>
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
                        </section>
                    ) : null}
                </section> : null}
                {actorQuery ? <ActorReferences citations={citations} references={actorReferences} activeCitation={activeCitation} /> : null}
            </section>
        </div>
    )

}
