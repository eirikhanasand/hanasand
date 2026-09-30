'use client'

import { TI_WORKBENCH_PREVIEW_ROWS, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { actorOperationsRowsFor, displayRequirementText, sourceBasisLabel } from '../pageModel'
import { Eye, Send } from 'lucide-react'
import { TiSearchResponse } from '@/utils/ti/search'
import { type ActorArtifactKind } from '@/utils/ti/actorWorkbench'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { useEffect, useMemo, useState } from 'react'
import { victimObservationsFor } from '@/utils/ti/actorProfile'
import CopyPayloadButton from './copy-payload-button'
import StripActionButton from './strip-action-button'

export default function ActorOperationsMatrix({
    result,
    actor,
    victimObservations,
    selectedArtifactId,
    onSelectArtifactBy,
    onEscalate,
    onReview,
}: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    victimObservations: ReturnType<typeof victimObservationsFor>
    selectedArtifactId?: string
    onSelectArtifactBy: (kind: ActorArtifactKind, value: string) => void
    onEscalate: () => void
    onReview: () => void
}) {
    const rows = useMemo(() => actorOperationsRowsFor(result, actor, victimObservations), [actor, result, victimObservations])
    const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id ?? '')
    const [showAllOperations, setShowAllOperations] = useState(false)
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const compactRows = rows.slice(0, TI_WORKBENCH_PREVIEW_ROWS)
    const visibleRows = showAllOperations
        ? rows
        : selectedRow && !compactRows.some(row => row.id === selectedRow.id)
            ? [...compactRows.slice(0, TI_WORKBENCH_PREVIEW_ROWS - 1), selectedRow]
            : compactRows
    const hiddenOperationCount = Math.max(0, rows.length - visibleRows.length)

    return (
        <section data-ti-actor-operations-matrix='true' className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Attack details</p>
                    <p className='mt-0.5 hidden wrap-break-word text-xs text-ui-muted dark:text-ui-muted md:block'>Methods, infrastructure, and targeting details with sources.</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{rows.length} details</span>
                    {selectedRow ? <CopyPayloadButton label='Copy detail' payload={selectedRow.payload} /> : null}
                </div>
            </div>
            <div className='grid min-w-0 lg:grid-cols-[minmax(0,1fr)_18rem]'>
                <div className='min-w-0 overflow-x-auto'>
                    <table className='min-w-170 w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Type</th>
                                <th className='px-3 py-2 font-semibold'>Name</th>
                                <th className='px-3 py-2 font-semibold'>Source</th>
                                <th className='px-3 py-2 font-semibold'>Freshness</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {visibleRows.map(row => {
                                const active = selectedRow?.id === row.id || (row.artifactLookup && selectedArtifactId?.includes(row.artifactLookup.toLowerCase().replace(/[^a-z0-9]+/g, '-')))
                                return (
                                    <tr key={row.id} className={`${active ? 'bg-ui-primary/10 dark:bg-ui-primary/10' : 'bg-ui-panel dark:bg-ui-panel'} align-top`}>
                                        <td className='px-3 py-2'>
                                            <button type='button' onClick={() => setSelectedRowId(row.id)} className='rounded-md bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:bg-ui-raised dark:text-ui-muted'>{row.type}</button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <button
                                                type='button'
                                                onClick={() => {
                                                    setSelectedRowId(row.id)
                                                    if (row.artifactKind && row.artifactLookup) onSelectArtifactBy(row.artifactKind, row.artifactLookup)
                                                }}
                                                className='grid min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'
                                            >
                                                <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.label}</span>
                                                <span className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.detail)}</span>
                                            </button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.source}</p>
                                            <p className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{row.sourceFamily}</p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <span className={sourceHealthChipClass(row.freshness)}>{row.freshness}</span>
                                            <p className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatDate(row.timestamp)}</p>
                                        </td>
                                        <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceBasisLabel(row.confidence)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {hiddenOperationCount ? (
                        <button
                            type='button'
                            onClick={() => setShowAllOperations(true)}
                            className='ui-button ui-button-secondary m-2 min-h-9 px-3 text-xs'
                        >
                            Show {hiddenOperationCount} more details
                        </button>
                    ) : showAllOperations && rows.length > compactRows.length ? (
                        <button
                            type='button'
                            onClick={() => setShowAllOperations(false)}
                            className='ui-button ui-button-secondary m-2 min-h-9 px-3 text-xs'
                        >
                            Show key details only
                        </button>
                    ) : null}
                    {!rows.length ? <p className='p-4 text-sm text-ui-muted dark:text-ui-muted'>Add technique, infrastructure, or victim context before case review.</p> : null}
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised lg:border-l lg:border-t-0'>
                    {selectedRow ? (
                        <div className='grid gap-2'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected detail</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.label}</h3>
                                <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.detail)}</p>
                            </div>
                            <p className='wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                                {sourceBasisLabel(selectedRow.confidence)} · {selectedRow.source}
                            </p>
                            <div className='grid grid-cols-2 gap-1.5'>
                                <StripActionButton icon={<Eye className='h-3.5 w-3.5' />} onClick={onReview}>Review</StripActionButton>
                                <StripActionButton icon={<Send className='h-3.5 w-3.5' />} onClick={onEscalate}>Escalate</StripActionButton>
                            </div>
                            {selectedRow.artifactKind && selectedRow.artifactLookup ? (
                                <button type='button' onClick={() => onSelectArtifactBy(selectedRow.artifactKind!, selectedRow.artifactLookup!)} className='ui-button ui-button-secondary min-h-8 px-2 text-xs'>
                                    Open detail
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <p className='text-sm text-ui-muted dark:text-ui-muted'>Select a detail to inspect.</p>
                    )}
                </div>
            </div>
        </section>
    )
}
