'use client'

import { TI_SOURCE_REFERENCE_ROWS, compactSourceReferenceLabel, formatDate, provenanceArtifactPayloadFor } from '../pageClientShared'
import { ExternalLink } from 'lucide-react'
import { linkFromText, sourceBasisLabel } from '../pageModel'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import CopyPayloadButton from './copy-payload-button'

export default function StructuredProvenancePanel({ rows, actor, actionability, query }: { rows: TiActorIntelligenceProfile['provenanceRows']; actor: TiActorIntelligenceProfile; actionability: TiActionabilityModel; query: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source references</p>
            <div className='mt-2 grid gap-2'>
                {rows.length ? rows.slice(0, TI_SOURCE_REFERENCE_ROWS).map(row => {
                    const href = linkFromText(row.provenance)
                    return (
                        <div key={`${row.sourceName}-${row.provenance}`} data-ti-provenance-artifact-export='true' className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <div className='flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                                    <span className='shrink-0 text-[11px] text-ui-muted dark:text-ui-muted'>{row.reportDate ? formatDate(row.reportDate) : row.captureId ? 'capture linked' : sourceBasisLabel(row.confidence)}</span>
                                    <CopyPayloadButton label='Provenance artifact' payload={provenanceArtifactPayloadFor(row, actor, actionability, query)} />
                                    {href ? (
                                        <a href={href} target='_blank' rel='noopener noreferrer' className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                            <ExternalLink className='h-3.5 w-3.5' />
                                            Open
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.provenance)}</p>
                            <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>{row.shownBecause}</p>
                        </div>
                    )
                }) : <p className='text-sm text-ui-muted dark:text-ui-muted'>Attach source references before case or watchlist routing.</p>}
            </div>
        </div>
    )
}
