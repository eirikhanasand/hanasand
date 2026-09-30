'use client'

import { compactSourceReferenceLabel, sourceHealthChipClass, techniqueCoveragePayloadFor } from '../pageClientShared'
import { coverageMissingLabel, decisionStepStatusClass, displayRequirementText, sourceBasisLabel } from '../pageModel'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import CopyPayloadButton from './copy-payload-button'
import TechniqueBadge from './technique-badge'

export default function TechniqueCoveragePanel({ techniques }: { techniques: TiActorIntelligenceProfile['techniqueCoverage'] }) {
    return (
        <div data-ti-technique-coverage='true' className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Techniques</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {techniques.length ? `${techniques.length} mapped technique${techniques.length === 1 ? '' : 's'} with source coverage.` : 'Add ATT&CK mapping before detection review.'}
                    </p>
                </div>
                <span className={techniques.some(item => item.freshness === 'ready') ? decisionStepStatusClass('ready') : decisionStepStatusClass(techniques.length ? 'review' : 'blocked')}>
                    {techniques.some(item => item.freshness === 'ready') ? 'ready' : techniques.length ? 'review' : 'syncing'}
                </span>
            </div>
            <div className='mt-2 grid gap-2'>
                {techniques.length ? techniques.slice(0, 4).map(item => {
                    const payload = techniqueCoveragePayloadFor(item)
                    return (
                        <div key={`${item.attackId ?? item.name}-${item.tactic}`} data-ti-technique-coverage-export='true' className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.name}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{item.tactic} · {sourceBasisLabel(item.confidence)}</p>
                                </div>
                                <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:shrink-0'>
                                    <span className={sourceHealthChipClass(item.freshness)}>{item.freshness}</span>
                                    {item.attackId ? <TechniqueBadge attackId={item.attackId} name={item.name} tactic={item.tactic} detail={item.detail} /> : null}
                                    <CopyPayloadButton label='Technique coverage' payload={payload} />
                                </div>
                            </div>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(item.detail)}</p>
                            <div className='mt-2 grid gap-1 border-t border-ui-border pt-2 dark:border-ui-border'>
                                <p className='wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                    {item.sourceIds.length ? `${item.sourceIds.length} source reference${item.sourceIds.length === 1 ? '' : 's'}` : 'Source reference needed'} · {item.captureIds.length ? `${item.captureIds.length} source row${item.captureIds.length === 1 ? '' : 's'}` : 'sources syncing'} · {item.missing.length ? `needs ${item.missing.map(coverageMissingLabel).join(', ')}` : 'case context ready'}
                                </p>
                                {item.provenanceRefs[0] ? <p className='wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(item.provenanceRefs[0])}</p> : null}
                            </div>
                        </div>
                    )
                }) : <p className='text-xs text-ui-muted dark:text-ui-muted'>Add technique context before detection or case review.</p>}
            </div>
        </div>
    )
}
