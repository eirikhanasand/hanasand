'use client'

import { eventProvenanceSummary, formatDate } from '../pageClientShared'
import { decisionStepStatusClass, displayRequirementList, displayRequirementText, publicStateLabel, type CaseActionTrailPayload } from '../pageModel'
import CopyPayloadButton from './copy-payload-button'

export default function CaseActionTrailPanel({ trail }: { trail: CaseActionTrailPayload }) {
    return (
        <div data-ti-case-action-trail='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Case action trail</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Source-safe trail for local decisions, selected evidence, and case replay state.
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={trail.summary.replayable ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                        {trail.summary.replayable ? 'replay ready' : 'replay syncing'}
                    </span>
                    <CopyPayloadButton label='Case action trail' payload={trail} />
                </div>
            </div>
            <div className='mt-3 grid gap-2'>
                {trail.events.slice(0, 4).map(event => (
                    <div key={event.id} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{event.label}</p>
                                <p className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatDate(event.at)}</p>
                            </div>
                            <span className={decisionStepStatusClass(event.state === 'local' ? 'review' : event.state)}>{publicStateLabel(event.state)}</span>
                        </div>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(event.detail)}</p>
                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                            {eventProvenanceSummary(event.provenance)}
                        </p>
                        {event.blockers.length ? (
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(event.blockers.slice(0, 3))}</p>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    )
}
