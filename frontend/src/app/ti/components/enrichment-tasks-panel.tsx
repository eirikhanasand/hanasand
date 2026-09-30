'use client'

import { collectionGapTaskPayloadFor, sourceHealthChipClass } from '../pageClientShared'
import { Database } from 'lucide-react'
import { displayRequirementText, formatLabel, readinessOwnerLabel, sourceHealthFieldLabel, sourceRequestRouteLabel, taskStatusClass, taskStatusLabel, type EnrichmentTask } from '../pageModel'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import CopyPayloadButton from './copy-payload-button'
import Panel from './panel'

export default function EnrichmentTasksPanel({ tasks, intake }: { tasks: EnrichmentTask[]; intake: TiActionabilityModel['sourceEnrichmentIntake'] }) {
    return (
        <Panel title='Open source questions' description='Source, capture, and data work required before this result can support stronger alerts.' icon={<Database className='h-4 w-4' />}>
            <div className='mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                    <span className='font-semibold text-ui-text dark:text-ui-text'>Source review</span> · {intake.summary.total} item{intake.summary.total === 1 ? '' : 's'} · {intake.summary.sourceRequests} source request{intake.summary.sourceRequests === 1 ? '' : 's'} · {intake.summary.captures} capture{intake.summary.captures === 1 ? '' : 's'}
                </p>
                <CopyPayloadButton label='Source enrichment intake' payload={intake} />
            </div>
            <div data-ti-collection-gap-intake='true' className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2'>
                {tasks.map(task => {
                    const payload = collectionGapTaskPayloadFor(task, intake)
                    return (
                        <div key={task.title} data-ti-collection-gap-task-export='true' className='min-w-0 max-w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{task.title}</p>
                                <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                    <span className={`${taskStatusClass(task.status)} shrink-0 whitespace-nowrap`}>{taskStatusLabel(task.status)}</span>
                                    <CopyPayloadButton label='Collection gap task' payload={payload} />
                                </div>
                            </div>
                            {(task.route || task.sourceFamily || task.requestedFields?.length || task.ownerLane) ? (
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {task.sourceFamily ? <span className={sourceHealthChipClass('review')}>{formatLabel(task.sourceFamily)}</span> : null}
                                    {task.ownerLane ? <span className={sourceHealthChipClass(task.status === 'needs_api' ? 'blocked' : 'review')}>{readinessOwnerLabel(task.ownerLane)}</span> : null}
                                    {task.route ? <span className={sourceHealthChipClass('review')}>{sourceRequestRouteLabel(task.route)}</span> : null}
                                    {task.requestedFields?.slice(0, 3).map(field => (
                                        <span key={`${task.title}-${field}`} className={sourceHealthChipClass('blocked')}>{sourceHealthFieldLabel(field)}</span>
                                    ))}
                                </div>
                            ) : null}
                            <p className='mt-2 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(task.detail)}</p>
                        </div>
                    )
                })}
            </div>
        </Panel>
    )
}
