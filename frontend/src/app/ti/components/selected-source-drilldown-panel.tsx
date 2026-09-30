'use client'

import { TI_SELECTED_CONTEXT_ROWS, compactSourceReferenceLabel, formatDate, sourceEvidenceRequestPayloadFor } from '../pageClientShared'
import { decisionStepStatusClass, displayRequirementList, displayRequirementText, readinessOwnerLabel, sourceBasisLabel, sourceRequestRouteLabel, type DecisionStep, type SelectedSourceDrilldown } from '../pageModel'
import { ExternalLink } from 'lucide-react'
import CopyPayloadButton from './copy-payload-button'
import SourceDrilldownHandoff from './source-drilldown-handoff'

export default function SelectedSourceDrilldownPanel({ drilldown }: { drilldown: SelectedSourceDrilldown }) {
    const readyRows = drilldown.rows.filter(row => row.state === 'ready').length
    const state: DecisionStep['status'] = readyRows === drilldown.rows.length && drilldown.rows.length ? 'ready' : drilldown.rows.length ? 'review' : 'blocked'
    return (
        <div data-ti-selected-source-drilldown='true' className='mt-4 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source details</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Sources, source status, and follow-up for the selected result.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(state)}>{readyRows}/{drilldown.rows.length} linked</span>
                    <CopyPayloadButton label='Source details' payload={drilldown} />
                </div>
            </div>

            <div className='mt-3 grid min-w-0 gap-2 md:grid-cols-2'>
                {drilldown.rows.length ? drilldown.rows.slice(0, TI_SELECTED_CONTEXT_ROWS).map(row => (
                    <div key={row.rowId} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {[row.sourceId ? 'source linked' : '', row.reportDate ? formatDate(row.reportDate) : '', typeof row.confidence === 'number' ? sourceBasisLabel(row.confidence) : ''].filter(Boolean).join(' · ') || 'Source metadata incomplete'}
                                </p>
                            </div>
                            <span className={row.state === 'ready' ? decisionStepStatusClass('ready') : row.state === 'needs_capture' ? decisionStepStatusClass('review') : decisionStepStatusClass('blocked')}>
                                {row.state === 'ready' ? 'ready' : row.state === 'needs_capture' ? 'sources syncing' : 'source needed'}
                            </span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{row.captureId ? 'capture linked' : compactSourceReferenceLabel(row.provenance)}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.handoff)}</p>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-raised dark:text-ui-text'>
                                {readinessOwnerLabel(row.ownerLane === 'public-ti' ? 'public-ti' : row.ownerLane)}
                            </span>
                            <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-raised dark:text-ui-text'>
                                {sourceRequestRouteLabel(row.route)}
                            </span>
                            <CopyPayloadButton label='Source evidence request' payload={sourceEvidenceRequestPayloadFor(row, drilldown)} />
                            {row.href ? (
                                <a href={row.href} target='_blank' rel='noopener noreferrer' className='inline-flex min-h-7 max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                    <ExternalLink className='h-3 w-3' />
                                    Open source
                                </a>
                            ) : null}
                        </div>
                        {row.missing.length ? (
                            <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(row.missing.slice(0, 2))}</p>
                        ) : null}
                    </div>
                )) : (
                    <div className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                        No sources are attached to this result yet.
                    </div>
                )}
            </div>

            <div className='mt-3 grid gap-2 md:grid-cols-2'>
                <SourceDrilldownHandoff label='alert delivery' ready={drilldown.alertHandoff.ready} endpoint={drilldown.alertHandoff.route || drilldown.alertHandoff.endpoint} missing={drilldown.alertHandoff.missing} />
                <SourceDrilldownHandoff label='case delivery' ready={drilldown.caseHandoff.ready} endpoint={drilldown.caseHandoff.route || drilldown.caseHandoff.endpoint} missing={drilldown.caseHandoff.missing} />
            </div>
            {drilldown.blockers.length ? (
                <p className='mt-3 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(drilldown.blockers.slice(0, 3))}</p>
            ) : null}
        </div>
    )
}
