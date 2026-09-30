'use client'

import { decisionStepStatusClass, decisionStepStatusLabel, displayRequirementText, type AnalystWorkItem } from '../pageModel'
import CopyPayloadButton from './copy-payload-button'
import EvidencePanel from './evidence-panel'

export default function EvidencePriorityPanel({ priority }: { priority: NonNullable<AnalystWorkItem['priority']> }) {
    const ids = [
        priority.sourceIds.length ? `${priority.sourceIds.length} source reference${priority.sourceIds.length === 1 ? '' : 's'}` : '',
        priority.captureIds.length ? `${priority.captureIds.length} capture reference${priority.captureIds.length === 1 ? '' : 's'}` : '',
        priority.alertIds.length ? `${priority.alertIds.length} alert review${priority.alertIds.length === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return (
        <div data-ti-evidence-priority='true' className='mt-4 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Evidence priority</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(priority.nextAction)}</p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={decisionStepStatusClass(priority.state)}>{decisionStepStatusLabel(priority.state)}</span>
                    <span className='rounded-md bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary'>{priority.score}/100</span>
                    <CopyPayloadButton label='Evidence priority' payload={priority} />
                </div>
            </div>
            <div className='mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]'>
                <EvidencePanel title='Priority basis'>
                    {priority.reasons.map(reason => <li key={reason}>{reason}</li>)}
                </EvidencePanel>
                <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Backed references</p>
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                        {ids.length ? ids.map(id => (
                            <span key={id} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-raised dark:text-ui-text'>{id}</span>
                        )) : <span className='text-xs text-ui-muted dark:text-ui-muted'>Link backed records before continuing.</span>}
                    </div>
                    {priority.blockers.length ? (
                        <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-warning dark:text-ui-warning'>
                            {priority.blockers.slice(0, 3).map(blocker => <li key={`${blocker.code}-${blocker.field}`}>{displayRequirementText(blocker.detail)}</li>)}
                        </ul>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
