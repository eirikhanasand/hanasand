'use client'

import { consumerFieldClass, consumerRequestFields } from '../pageClientShared'
import { consumerRequestActionLabel, decisionStepStatusClass, displayRequirementList, displayRequirementText, publicStateLabel } from '../pageModel'
import { ExternalLink } from 'lucide-react'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { useState } from 'react'
import CopyPayloadButton from './copy-payload-button'

export default function ConsumerReadinessPanel({ actionability }: { actionability: TiActionabilityModel }) {
    const [showStageDetails, setShowStageDetails] = useState(false)
    const readyStages = actionability.consumerReadiness.stages.filter(stage => stage.state === 'ready').length
    return (
        <div data-ti-consumer-readiness='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <div className='flex flex-wrap items-center justify-between gap-2 text-xs'>
                <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                    Console actions · {readyStages}/{actionability.consumerReadiness.stages.length} available
                </p>
                <div className='flex min-w-0 flex-wrap items-center gap-2'>
                    <button type='button' onClick={() => setShowStageDetails(value => !value)} className='inline-flex min-h-7 items-center justify-center border-l border-ui-border pl-2 text-[11px] font-semibold text-ui-text transition hover:text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:text-ui-text'>
                        {showStageDetails ? 'Hide stages' : 'Show stages'}
                    </button>
                    <CopyPayloadButton label='Console actions' payload={actionability.consumerReadiness.bundlePreview} />
                </div>
            </div>
            {showStageDetails ? (
                <div className='mt-3 grid gap-2'>
                    {actionability.consumerReadiness.stages.map(stage => (
                        <div key={stage.id} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{stage.label}</p>
                                        <span className={decisionStepStatusClass(stage.state)}>{publicStateLabel(stage.state)}</span>
                                    </div>
                                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(stage.detail)}</p>
                                    <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                        {stage.request ? (
                                            <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                                {consumerRequestActionLabel(stage.request.method, stage.request.path)}
                                            </span>
                                        ) : null}
                                        <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                            {stage.payload.provenance.length} source reference{stage.payload.provenance.length === 1 ? '' : 's'}
                                        </span>
                                        {stage.missing.length ? (
                                            <span className='max-w-full wrap-break-word rounded-md border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                                                {stage.missing.length} follow-up{stage.missing.length === 1 ? '' : 's'}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div data-ti-consumer-field-readiness='true' className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                        {consumerRequestFields(stage).map(field => (
                                            <span key={`${stage.id}-${field.label}`} className={consumerFieldClass(field.state)}>
                                                {field.label}: {displayRequirementText(field.value)}
                                            </span>
                                        ))}
                                    </div>
                                    {stage.missing.length ? (
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning'>{displayRequirementList(stage.missing.slice(0, 2))}</p>
                                    ) : null}
                                </div>
                                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                    {stage.route ? (
                                        <a href={stage.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                            <ExternalLink className='h-3.5 w-3.5' />
                                            Open
                                        </a>
                                    ) : null}
                                    <CopyPayloadButton label={`${stage.label} request`} payload={stage.request ?? stage.payload} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    )
}
