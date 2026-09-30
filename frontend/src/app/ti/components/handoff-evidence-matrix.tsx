'use client'

import { countLinkedLabel } from '../pageClientShared'
import { decisionStepStatusClass, displayRequirementList, displayRequirementText, readinessOwnerLabel } from '../pageModel'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { useState } from 'react'

export default function HandoffEvidenceMatrix({ actionability }: { actionability: TiActionabilityModel }) {
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
                    <button type='button' onClick={() => setShowReviewPaths(value => !value)} className='ui-button ui-button-secondary min-h-8 px-2.5 text-[11px]'>
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
