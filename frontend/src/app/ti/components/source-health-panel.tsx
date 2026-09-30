'use client'

import { actorEnrichmentConsumerLabel, actorEnrichmentConsumerState, formatDate, sourceHealthChipClass, sourceHealthEvidenceLabel, sourceRefreshPayloadFor } from '../pageClientShared'
import { Database, ExternalLink } from 'lucide-react'
import { decisionStepStatusClass, displayRequirementText, formatLabel, publicDecisionStatusLabel, publicStateLabel, readinessOwnerLabel, sourceBasisLabel, sourceHealthFieldLabel } from '../pageModel'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { useState } from 'react'
import CopyPayloadButton from './copy-payload-button'
import Panel from './panel'

export default function SourceHealthPanel({ queue, intake, coverage, consumerReadiness, payload }: { queue: TiActionabilityModel['sourceHealthQueue']; intake: TiActionabilityModel['sourceEnrichmentIntake']; coverage: TiActionabilityModel['actorEnrichmentCoverage']; consumerReadiness: TiActionabilityModel['actorEnrichmentConsumerReadiness']; payload: TiActionabilityModel['exportPayloads']['enrichment'] }) {
    const [showSourceDetails, setShowSourceDetails] = useState(false)
    const rows = queue.rows

    return (
        <Panel title='Source health' description='Source type, time seen, processing status, and next review step.' icon={<Database className='h-4 w-4' />}>
            <div data-ti-source-health-queue='true' className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3'>
                <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                    <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {queue.summary.total} source detail{queue.summary.total === 1 ? '' : 's'} · {coverage.summary.coveredFieldCount}/{coverage.summary.fieldCount} covered · {coverage.summary.retryableFieldCount} retry
                    </p>
                    <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                        <span data-ti-enrichment-coverage-export='true' className='inline-flex'>
                            <CopyPayloadButton label='Coverage review' payload={coverage} />
                        </span>
                        <span data-ti-enrichment-consumer-readiness='true' className='inline-flex'>
                            <CopyPayloadButton label='Consumer status' payload={consumerReadiness} />
                        </span>
                        <CopyPayloadButton label='Source review' payload={{ ...queue, sourceEnrichmentIntake: intake, actorEnrichmentCoverage: coverage, actorEnrichmentConsumerReadiness: consumerReadiness, enrichmentPayload: payload }} />
                        {(consumerReadiness.rows.length || rows.length) ? (
                            <button type='button' onClick={() => setShowSourceDetails(value => !value)} className='ui-button ui-button-secondary min-h-8 px-2.5 text-[11px]'>
                                {showSourceDetails ? 'Hide source details' : 'Show source details'}
                            </button>
                        ) : null}
                    </div>
                </div>
                {showSourceDetails ? (
                    <>
                        <div data-ti-source-consumer-readiness='true' className='grid min-w-0 gap-2 sm:grid-cols-3'>
                            {consumerReadiness.rows.map(row => (
                                <div key={row.consumer} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                                    <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                        <div className='min-w-0'>
                                            <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{actorEnrichmentConsumerLabel(row.consumer)}</p>
                                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                                {row.coverageCounts.covered} covered · {row.coverageCounts.alertable} ready for review · {row.blockerCodes.length} follow-up{row.blockerCodes.length === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                        <span className={sourceHealthChipClass(actorEnrichmentConsumerState(row.state))}>{publicStateLabel(row.state)}</span>
                                    </div>
                                    <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                        {row.sourceFamilies.slice(0, 3).map(family => (
                                            <span key={family} className={sourceHealthChipClass('review')}>{formatLabel(family)}</span>
                                        ))}
                                        {row.retry.retryable ? <span className={sourceHealthChipClass('blocked')}>retry scheduled</span> : null}
                                    </div>
                                    <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.route)}</p>
                                </div>
                            ))}
                        </div>
                        {rows.length ? rows.slice(0, 3).map(row => (
                            <div key={row.id} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                            {formatLabel(row.sourceFamily)} · {formatDate(row.timestamp)} · {row.parserStatus}
                                        </p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                            {sourceHealthEvidenceLabel(row)}
                                        </p>
                                    </div>
                                    <span className={decisionStepStatusClass(row.state)}>{publicDecisionStatusLabel(row.state)}</span>
                                </div>
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {row.sourceId ? <span className={sourceHealthChipClass('review')}>source linked</span> : null}
                                    {row.sourceRequestId ? <span className={sourceHealthChipClass('review')}>request linked</span> : null}
                                    <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? 'source linked' : 'sources syncing'}</span>
                                    {typeof row.confidence === 'number' ? <span className={sourceHealthChipClass('review')}>{sourceBasisLabel(row.confidence)}</span> : null}
                                    <span className={sourceHealthChipClass(row.ownerLane === 'source' ? 'blocked' : row.state)}>{readinessOwnerLabel(row.ownerLane)}</span>
                                </div>
                                {row.requestedFields.length ? (
                                    <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>Needs: {row.requestedFields.slice(0, 4).map(sourceHealthFieldLabel).join(', ')}</p>
                                ) : null}
                                <div className='mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.nextAction)}</p>
                                    <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                        <span data-ti-source-refresh-export='true' className='inline-flex'>
                                            <CopyPayloadButton label='Source review request' payload={sourceRefreshPayloadFor(row, queue, intake, payload)} />
                                        </span>
                                        <a href={row.route} className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                            <ExternalLink className='h-3.5 w-3.5' />
                                            Open
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )) : null}
                    </>
                ) : !rows.length ? (
                    <p className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>Use sources before sending this actor to a customer path.</p>
                ) : null}
            </div>
        </Panel>
    )
}
