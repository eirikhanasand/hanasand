'use client'

import { compactSourceReferenceLabel, formatDate, watchlistIntersectionPayloadFor } from '../pageClientShared'
import { decisionStepStatusClass, decisionStepStatusLabel, displayRequirementText, formatLabel, publicDecisionStatusLabel, readinessOwnerLabel, sourceBasisLabel, watchlistIntersectionActionLabel } from '../pageModel'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import CopyPayloadButton from './copy-payload-button'
import EvidenceMetric from './evidence-metric'

export default function OrgRelevancePanel({ actionability }: { actionability: TiActionabilityModel }) {
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
