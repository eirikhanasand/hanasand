'use client'

import { decisionStepStatusClass, displayRequirementText, formatLabel, publicStateLabel, readinessOwnerLabel } from '../pageModel'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { useState } from 'react'

export default function ReadinessBlockersPanel({ actionability }: { actionability: TiActionabilityModel }) {
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
                        <button type='button' onClick={() => setShowFollowUps(value => !value)} className='ui-button ui-button-secondary min-h-8 px-2.5 text-[11px]'>
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
