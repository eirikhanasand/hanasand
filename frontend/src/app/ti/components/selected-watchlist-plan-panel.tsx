'use client'

import { compactSourceReferenceLabel, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { decisionStepStatusClass, decisionStepStatusLabel, displayRequirementList, displayRequirementText, formatLabel, readinessOwnerLabel, type DecisionStep, type SelectedWatchlistPlan } from '../pageModel'
import CopyPayloadButton from './copy-payload-button'

export default function SelectedWatchlistPlanPanel({ plan }: { plan: SelectedWatchlistPlan }) {
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
