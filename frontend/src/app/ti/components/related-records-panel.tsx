'use client'

import { type RelatedRecordRow, caseReplayCandidatePayloadFor, caseReviewCandidatePayloadFor, recommendedActionLabel, relatedRecordHandoffPayloadFor, sourceHealthChipClass } from '../pageClientShared'
import { displayRequirementText, publicDecisionStatusLabel } from '../pageModel'
import { ExternalLink } from 'lucide-react'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import CopyPayloadButton from './copy-payload-button'

export default function RelatedRecordsPanel({ actionability, query }: { actionability: TiActionabilityModel; query: string }) {
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
