'use client'

import { TI_WORKBENCH_PREVIEW_ROWS, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { CheckCircle2, ExternalLink, Send } from 'lucide-react'
import { displayRequirementText, formatLabel, publicStateLabel, sourceConfidenceLabel, sourceCoverageWorkbenchRowsFor, sourceHealthFieldLabel, type AnalystWorkItem } from '../pageModel'
import { TiSearchResponse } from '@/utils/ti/search'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { useEffect, useMemo, useState } from 'react'
import CopyPayloadButton from './copy-payload-button'
import StripActionButton from './strip-action-button'

export default function SourceCoverageWorkbench({
    actor,
    actionability,
    sources,
    sourcePosture,
    workItems,
    selectedId,
    sourceOptions,
    onSelectEvidence,
    onFilterSource,
    onEscalate,
    onReview,
}: {
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    sources: TiSearchResponse['sources']
    sourcePosture: NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture']
    workItems: AnalystWorkItem[]
    selectedId?: string
    sourceOptions: string[]
    onSelectEvidence: (id: string) => void
    onFilterSource: (source: string) => void
    onEscalate: () => void
    onReview: () => void
}) {
    const rows = useMemo(() => sourceCoverageWorkbenchRowsFor({ actor, actionability, sources, sourcePosture, workItems, sourceOptions }), [actor, actionability, sources, sourcePosture, workItems, sourceOptions])
    const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id ?? '')
    const [showAllSources, setShowAllSources] = useState(false)
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const readyCount = rows.filter(row => row.state === 'ready').length
    const reviewCount = rows.filter(row => row.state === 'review').length
    const blockedCount = rows.filter(row => row.state === 'blocked').length
    const compactRows = rows.slice(0, TI_WORKBENCH_PREVIEW_ROWS)
    const visibleRows = showAllSources
        ? rows
        : selectedRow && !compactRows.some(row => row.id === selectedRow.id)
            ? [...compactRows.slice(0, TI_WORKBENCH_PREVIEW_ROWS - 1), selectedRow]
            : compactRows
    const hiddenSourceCount = Math.max(0, rows.length - visibleRows.length)

    return (
        <section data-ti-source-coverage-workbench='true' className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source review</p>
                    <p className='mt-0.5 hidden wrap-break-word text-xs text-ui-muted dark:text-ui-muted md:block'>Source coverage, newest mention, evidence basis, and review state.</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className={sourceHealthChipClass('ready')}>{readyCount} ready</span>
                    <span className={sourceHealthChipClass('review')}>{reviewCount} review</span>
                    <span className={sourceHealthChipClass(blockedCount ? 'blocked' : 'ready')}>{blockedCount} syncing</span>
                    {selectedRow ? <CopyPayloadButton label='Copy source summary' payload={selectedRow.payload} /> : null}
                </div>
            </div>
            <div className='grid min-w-0 xl:grid-cols-[minmax(0,1fr)_19rem]'>
                <div className='min-w-0 overflow-x-auto'>
                    <table className='min-w-215 w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Source</th>
                                <th className='px-3 py-2 font-semibold'>Results</th>
                                <th className='px-3 py-2 font-semibold'>Newest</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Details</th>
                                <th className='px-3 py-2 font-semibold'>State</th>
                                <th className='px-3 py-2 font-semibold'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {visibleRows.map(row => {
                                const active = selectedRow?.id === row.id
                                const linkedSelected = row.evidenceItems.some(item => item.id === selectedId)
                                return (
                                    <tr key={row.id} className={`${active || linkedSelected ? 'bg-ui-primary/10 dark:bg-ui-primary/10' : 'bg-ui-panel dark:bg-ui-panel'} align-top`}>
                                        <td className='px-3 py-2'>
                                            <button type='button' onClick={() => setSelectedRowId(row.id)} className='grid min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                                                <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</span>
                                                <span className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatLabel(row.family)}</span>
                                            </button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <p className='font-semibold text-ui-text dark:text-ui-text'>{row.evidenceItems.length} results</p>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{row.evidenceItems[0]?.title ?? displayRequirementText(row.parserStatus)}</p>
                                        </td>
                                        <td className='px-3 py-2 text-ui-text dark:text-ui-text'>{row.newestAt ? formatDate(row.newestAt) : 'Not dated'}</td>
                                        <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceConfidenceLabel(row.confidenceValues)}</td>
                                        <td className='px-3 py-2'>
                                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                                {row.artifactTypes.length ? row.artifactTypes.slice(0, 4).map(type => (
                                                    <span key={`${row.id}-${type}`} className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{type}</span>
                                                )) : <span className='text-[11px] text-ui-muted dark:text-ui-muted'>Source only</span>}
                                            </div>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <span className={sourceHealthChipClass(row.state)}>{publicStateLabel(row.state)}</span>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.nextAction)}</p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                                {row.evidenceItems[0] ? (
                                                    <button type='button' onClick={() => onSelectEvidence(row.evidenceItems[0]!.id)} className='ui-button ui-button-secondary min-h-8 px-2 text-[11px]'>Open result</button>
                                                ) : null}
                                                {row.queueFilter ? (
                                                    <button type='button' onClick={() => onFilterSource(row.queueFilter!)} className='ui-button ui-button-secondary min-h-8 px-2 text-[11px]'>Filter</button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {hiddenSourceCount ? (
                        <button
                            type='button'
                            onClick={() => setShowAllSources(true)}
                            className='ui-button ui-button-secondary m-2 min-h-9 px-3 text-xs'
                        >
                            Show {hiddenSourceCount} more sources
                        </button>
                    ) : showAllSources && rows.length > compactRows.length ? (
                        <button
                            type='button'
                            onClick={() => setShowAllSources(false)}
                            className='ui-button ui-button-secondary m-2 min-h-9 px-3 text-xs'
                        >
                            Show key sources only
                        </button>
                    ) : null}
                    {!rows.length ? <p className='p-4 text-sm text-ui-muted dark:text-ui-muted'>Add source coverage before reviewing this actor.</p> : null}
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised xl:border-l xl:border-t-0'>
                    {selectedRow ? (
                        <div className='grid gap-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected source</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.sourceName}</h3>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.provenance)}</p>
                            </div>
                            <p className='wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                                {formatLabel(selectedRow.family)} · {selectedRow.evidenceItems.length} results · capture {selectedRow.captureId ? 'attached' : 'missing'} · request {selectedRow.sourceRequestId ? 'queued' : 'not queued'}
                            </p>
                            {selectedRow.missing.length ? (
                                <div className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                                    {selectedRow.missing.slice(0, 3).map(sourceHealthFieldLabel).join(', ')}
                                </div>
                            ) : null}
                            <div className='grid grid-cols-2 gap-1.5'>
                                <StripActionButton icon={<CheckCircle2 className='h-3.5 w-3.5' />} onClick={onReview}>Review</StripActionButton>
                                <StripActionButton icon={<Send className='h-3.5 w-3.5' />} onClick={onEscalate}>Escalate</StripActionButton>
                            </div>
                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                {selectedRow.href ? (
                                    <a href={selectedRow.href} target='_blank' rel='noopener noreferrer' className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                                        <ExternalLink className='h-3.5 w-3.5' />
                                        Open source
                                    </a>
                                ) : null}
                                <CopyPayloadButton label='Copy source' payload={selectedRow.payload} showLabel />
                            </div>
                        </div>
                    ) : (
                        <p className='text-sm text-ui-muted dark:text-ui-muted'>Select a source to inspect results and open questions.</p>
                    )}
                </div>
            </div>
        </section>
    )
}
