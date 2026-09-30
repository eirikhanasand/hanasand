'use client'

import { TI_WORKBENCH_PREVIEW_ROWS, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { ClipboardList, ExternalLink } from 'lucide-react'
import { displayRequirementList, displayRequirementText, formatLabel, publicStateLabel, sourceConfidenceLabel, watchlistWorkbenchRowsFor, type AnalystWorkItem, type WatchlistRelevance } from '../pageModel'
import { type ActorArtifact } from '@/utils/ti/actorWorkbench'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { useEffect, useMemo, useState } from 'react'
import CopyPayloadButton from './copy-payload-button'

export default function WatchlistRelevanceWorkbench({
    watchlist,
    actionability,
    query,
    workItems,
    artifacts,
    selectedId,
    selectedArtifactId,
    onSelectEvidence,
    onSelectArtifact,
    onMarkRelevant,
}: {
    watchlist: WatchlistRelevance
    actionability: TiActionabilityModel
    query: string
    workItems: AnalystWorkItem[]
    artifacts: ActorArtifact[]
    selectedId?: string
    selectedArtifactId?: string
    onSelectEvidence: (id: string) => void
    onSelectArtifact: (id: string) => void
    onMarkRelevant: () => void
}) {
    const rows = useMemo(() => watchlistWorkbenchRowsFor({ watchlist, actionability, query, workItems, artifacts }), [watchlist, actionability, query, workItems, artifacts])
    const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id ?? '')
    const [showAllWatchlistRows, setShowAllWatchlistRows] = useState(false)
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const readyCount = rows.filter(row => row.state === 'ready').length
    const blockedCount = rows.filter(row => row.state === 'blocked').length
    const selectedArtifact = selectedRow?.artifactIds.find(id => id === selectedArtifactId) ?? selectedRow?.artifactIds[0]
    const selectedEvidence = selectedRow?.evidenceItems.find(item => item.id === selectedId) ?? selectedRow?.evidenceItems[0]
    const compactRows = rows.slice(0, TI_WORKBENCH_PREVIEW_ROWS)
    const visibleRows = showAllWatchlistRows
        ? rows
        : selectedRow && !compactRows.some(row => row.id === selectedRow.id)
            ? [...compactRows.slice(0, TI_WORKBENCH_PREVIEW_ROWS - 1), selectedRow]
            : compactRows
    const hiddenWatchlistCount = Math.max(0, rows.length - visibleRows.length)

    return (
        <section data-ti-watchlist-workbench='true' data-ti-watchlist-term-requests='true' className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Watchlist review</p>
                    <p className='mt-0.5 hidden wrap-break-word text-xs text-ui-muted dark:text-ui-muted md:block'>Watched terms, matching results, key details, and case links for organization review.</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className={sourceHealthChipClass('ready')}>{readyCount} matched</span>
                    <span className={sourceHealthChipClass(blockedCount ? 'blocked' : 'review')}>{blockedCount} syncing</span>
                    {selectedRow ? <CopyPayloadButton label='Copy watchlist match' payload={selectedRow.payload} /> : null}
                </div>
            </div>
            <div className='grid min-w-0 xl:grid-cols-[minmax(0,1fr)_19rem]'>
                <div className='min-w-0 overflow-x-auto'>
                    <table className='min-w-212.5 w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Term</th>
                                <th className='px-3 py-2 font-semibold'>Results</th>
                                <th className='px-3 py-2 font-semibold'>Newest</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Review link</th>
                                <th className='px-3 py-2 font-semibold'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {visibleRows.map(row => {
                                const active = selectedRow?.id === row.id
                                return (
                                    <tr key={row.id} className={`${active ? 'bg-ui-primary/10 dark:bg-ui-primary/10' : 'bg-ui-panel dark:bg-ui-panel'} align-top`}>
                                        <td className='px-3 py-2'>
                                            <button type='button' onClick={() => setSelectedRowId(row.id)} className='grid min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                                                <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.value}</span>
                                                <span className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatLabel(row.kind)}</span>
                                            </button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <p className='font-semibold text-ui-text dark:text-ui-text'>{row.evidenceItems.length} results · {row.artifactIds.length} details</p>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{row.evidenceItems[0]?.title ?? row.detail}</p>
                                        </td>
                                        <td className='px-3 py-2 text-ui-text dark:text-ui-text'>{row.newestAt ? formatDate(row.newestAt) : 'Not dated'}</td>
                                        <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceConfidenceLabel(row.confidenceValues)}</td>
                                        <td className='px-3 py-2'>
                                            <span className={sourceHealthChipClass(row.state)}>{row.matched ? 'matched' : publicStateLabel(row.state)}</span>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.casePath || row.route || row.detail)}</p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                                {row.evidenceItems[0] ? <button type='button' onClick={() => onSelectEvidence(row.evidenceItems[0]!.id)} className='ui-button ui-button-secondary min-h-8 px-2 text-[11px]'>Open result</button> : null}
                                                {row.artifactIds[0] ? <button type='button' onClick={() => onSelectArtifact(row.artifactIds[0]!)} className='ui-button ui-button-secondary min-h-8 px-2 text-[11px]'>Detail</button> : null}
                                                <CopyPayloadButton label='Watchlist term request' payload={row.payload} />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {hiddenWatchlistCount ? (
                        <button
                            type='button'
                            onClick={() => setShowAllWatchlistRows(true)}
                            className='ui-button ui-button-secondary m-2 min-h-9 px-3 text-xs'
                        >
                            Show {hiddenWatchlistCount} more terms
                        </button>
                    ) : showAllWatchlistRows && rows.length > compactRows.length ? (
                        <button
                            type='button'
                            onClick={() => setShowAllWatchlistRows(false)}
                            className='ui-button ui-button-secondary m-2 min-h-9 px-3 text-xs'
                        >
                            Show key terms only
                        </button>
                    ) : null}
                    {!rows.length ? <p className='p-4 text-sm text-ui-muted dark:text-ui-muted'>Link a watchlist term before opening this result for review.</p> : null}
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised xl:border-l xl:border-t-0'>
                    {selectedRow ? (
                        <div className='grid gap-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected term</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.kind}: {selectedRow.value}</h3>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.detail)}</p>
                            </div>
                            <p className='wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                                {selectedRow.evidenceItems.length} results · {selectedRow.artifactIds.length} details · {selectedRow.sourceCount} sources · {selectedRow.matched ? 'Matched' : publicStateLabel(selectedRow.state)}
                            </p>
                            <div className='grid grid-cols-2 gap-1.5'>
                                <button type='button' onClick={onMarkRelevant} className='ui-button ui-button-secondary min-h-8 px-2 text-xs'>Watch</button>
                                {selectedEvidence ? <button type='button' onClick={() => onSelectEvidence(selectedEvidence.id)} className='ui-button ui-button-secondary min-h-8 px-2 text-xs'>Review result</button> : null}
                                {selectedArtifact ? <button type='button' onClick={() => onSelectArtifact(selectedArtifact)} className='ui-button ui-button-secondary min-h-8 px-2 text-xs'>Open detail</button> : null}
                                <CopyPayloadButton label='Export' payload={selectedRow.payload} showLabel />
                            </div>
                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                {selectedRow.route ? <a href={selectedRow.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'><ExternalLink className='h-3.5 w-3.5' />Open action</a> : null}
                                {selectedRow.casePath ? <a href={selectedRow.casePath} className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'><ClipboardList className='h-3.5 w-3.5' />Open case</a> : null}
                            </div>
                            {selectedRow.blockers.length ? (
                                <div className='rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                                    {displayRequirementList(selectedRow.blockers.slice(0, 3))}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <p className='text-sm text-ui-muted dark:text-ui-muted'>Select a watchlist term to inspect evidence and review context.</p>
                    )}
                </div>
            </div>
        </section>
    )
}
