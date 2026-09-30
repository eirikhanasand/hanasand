'use client'

import { campaignActivityPayloadFor, compactSourceReferenceLabel, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { coverageMissingLabel, decisionStepStatusClass, sourceBasisLabel } from '../pageModel'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import CopyPayloadButton from './copy-payload-button'

export default function CampaignTimelinePanel({ timeline }: { timeline: TiActorIntelligenceProfile['campaignTimeline'] }) {
    return (
        <div data-ti-campaign-timeline='true' className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Activity timeline</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {timeline.length ? `${timeline.length} dated campaign or activity item${timeline.length === 1 ? '' : 's'} with source references.` : 'Add dated campaign or activity evidence before trend review.'}
                    </p>
                </div>
                <span className={timeline.some(item => item.freshness === 'ready') ? decisionStepStatusClass('ready') : decisionStepStatusClass(timeline.length ? 'review' : 'blocked')}>
                    {timeline.some(item => item.freshness === 'ready') ? 'ready' : timeline.length ? 'review' : 'syncing'}
                </span>
            </div>
            <div className='mt-2 grid gap-2'>
                {timeline.length ? timeline.slice(0, 4).map(item => {
                    const payload = campaignActivityPayloadFor(item)
                    return (
                        <div key={`${item.firstReportedAt}-${item.title}`} data-ti-campaign-activity-export='true' className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.title}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                        {item.affectedSectors.slice(0, 2).join(', ') || 'Sector not mapped'} · {item.countries.slice(0, 2).join(', ') || 'Country not mapped'} · {sourceBasisLabel(item.confidence)}
                                    </p>
                                </div>
                                <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:shrink-0'>
                                    <span className={sourceHealthChipClass(item.freshness)}>{formatDate(item.firstReportedAt)}</span>
                                    <CopyPayloadButton label='Campaign activity' payload={payload} />
                                </div>
                            </div>
                            <div className='mt-2 grid gap-1 border-t border-ui-border pt-2 dark:border-ui-border'>
                                <p className='wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {item.sourceIds.length ? `${item.sourceIds.length} source reference${item.sourceIds.length === 1 ? '' : 's'}` : 'source reference needed'} · {item.provenanceRefs.length ? `${item.provenanceRefs.length} source detail${item.provenanceRefs.length === 1 ? '' : 's'}` : 'source detail needed'} · {item.missing.length ? `needs ${item.missing.map(coverageMissingLabel).join(', ')}` : 'case context ready'}
                                </p>
                                {item.provenanceRefs[0] ? <p className='wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(item.provenanceRefs[0])}</p> : null}
                            </div>
                        </div>
                    )
                }) : <p className='text-xs text-ui-muted dark:text-ui-muted'>Add campaign context before trend or case review.</p>}
            </div>
        </div>
    )
}
