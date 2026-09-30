'use client'

import { decisionStepStatusClass, decisionStepStatusLabel, displayRequirementList, displayRequirementText, formatLabel, type DecisionStep } from '../pageModel'
import { ExternalLink } from 'lucide-react'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import CopyPayloadButton from './copy-payload-button'

export default function DecisionFlow({ steps, disposition, shouldAlert, rationale }: { steps: DecisionStep[]; disposition: TiActionabilityModel['alertDisposition']; shouldAlert: boolean; rationale: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Decision flow</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{rationale}</p>
                </div>
                <span className={shouldAlert ? 'shrink-0 rounded-lg bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success' : 'shrink-0 rounded-lg bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning'}>
                    {formatLabel(disposition)}
                </span>
            </div>
            <div className='mt-3 grid gap-2'>
                {steps.map(step => (
                    <div key={step.id} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                        <div className='flex flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{step.label}</p>
                                    <span className={decisionStepStatusClass(step.status)}>{decisionStepStatusLabel(step.status)}</span>
                                </div>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(step.detail)}</p>
                                {step.missing.length ? (
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning'>{displayRequirementList(step.missing.slice(0, 2))}</p>
                                ) : null}
                            </div>
                            <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                {step.route ? (
                                    <a href={step.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                        <ExternalLink className='h-3.5 w-3.5' />
                                        Open
                                    </a>
                                ) : null}
                                <CopyPayloadButton label={step.label} payload={step.payload} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
