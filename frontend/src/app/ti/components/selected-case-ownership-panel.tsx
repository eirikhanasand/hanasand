'use client'

import { caseReviewReferenceSummary, recommendedActionLabel, sourceHealthChipClass } from '../pageClientShared'
import { decisionStepStatusClass, decisionStepStatusLabel, displayRequirementList, displayRequirementText, formatLabel, publicStateLabel, type SelectedCaseOwnershipPlan } from '../pageModel'
import CopyPayloadButton from './copy-payload-button'

export default function SelectedCaseOwnershipPanel({ plan }: { plan: SelectedCaseOwnershipPlan }) {
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
