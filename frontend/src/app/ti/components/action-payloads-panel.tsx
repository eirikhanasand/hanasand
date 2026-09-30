'use client'

import { actionPayloadSummaryLines, sourceHealthChipClass } from '../pageClientShared'
import { decisionStepStatusClass, displayRequirementText, readinessOwnerLabel } from '../pageModel'
import { ExternalLink } from 'lucide-react'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { useState } from 'react'
import CopyPayloadButton from './copy-payload-button'

export default function ActionPayloadsPanel({ actionability }: { actionability: TiActionabilityModel }) {
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
                    <button type='button' onClick={() => setShowPayloadDetails(value => !value)} className='ui-button ui-button-secondary min-h-8 px-2.5 text-[11px]'>
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
