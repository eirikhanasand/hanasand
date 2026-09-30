'use client'

import { sourceHealthChipClass } from '../pageClientShared'
import { decisionStepStatusClass, decisionStepStatusLabel, displayRequirementList, displayRequirementText, formatLabel, publicDecisionStatusLabel, readinessOwnerLabel, type SelectedAlertActionPlan } from '../pageModel'
import CopyPayloadButton from './copy-payload-button'

export default function SelectedAlertActionPlanPanel({ plan }: { plan: SelectedAlertActionPlan }) {
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
