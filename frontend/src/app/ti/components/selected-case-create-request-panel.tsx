'use client'

import { compactSourceReferenceLabel, formatDate, handoffMissingLabel, sourceHealthChipClass } from '../pageClientShared'
import { consumerRequestPathLabel, decisionStepStatusClass, decisionStepStatusLabel, displayRequirementList, displayRequirementText, formatLabel, publicDecisionStatusLabel, readinessOwnerLabel, sourceBasisLabel, sourceRequestRouteLabel, type SelectedCaseCreateRequest } from '../pageModel'
import CopyPayloadButton from './copy-payload-button'
import EvidenceMetric from './evidence-metric'

export default function SelectedCaseCreateRequestPanel({ request }: { request: SelectedCaseCreateRequest }) {
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
