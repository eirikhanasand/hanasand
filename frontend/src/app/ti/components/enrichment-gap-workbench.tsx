'use client'

import { TI_WORKBENCH_PREVIEW_ROWS, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { Database, ExternalLink } from 'lucide-react'
import { displayRequirementList, displayRequirementText, enrichmentGapWorkbenchRowsFor, formatLabel, publicStateLabel, sourceConfidenceLabel, type AnalystWorkItem, type EnrichmentTask } from '../pageModel'
import { TiSearchResponse } from '@/utils/ti/search'
import { type ActorArtifact } from '@/utils/ti/actorWorkbench'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { useEffect, useMemo, useState } from 'react'
import CopyPayloadButton from './copy-payload-button'
import Panel from './panel'

export default function EnrichmentGapWorkbench({
    tasks,
    result,
    actor,
    actionability,
    workItems,
    artifacts,
    selectedId,
    selectedArtifactId,
    onSelectEvidence,
    onSelectArtifact,
    onReview,
    onEscalate,
}: {
    tasks: EnrichmentTask[]
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    workItems: AnalystWorkItem[]
    artifacts: ActorArtifact[]
    selectedId?: string
    selectedArtifactId?: string
    onSelectEvidence: (id: string) => void
    onSelectArtifact: (id: string) => void
    onReview: () => void
    onEscalate: () => void
}) {
    const rows = useMemo(() => enrichmentGapWorkbenchRowsFor({ tasks, result, actor, actionability, workItems, artifacts }), [tasks, result, actor, actionability, workItems, artifacts])
    const [selectedRowId, setSelectedRowId] = useState(rows[0]?.id ?? '')
    const [showAllQuestions, setShowAllQuestions] = useState(false)
    useEffect(() => {
        if (!rows.length) return
        if (!rows.some(row => row.id === selectedRowId)) setSelectedRowId(rows[0]?.id ?? '')
    }, [rows, selectedRowId])
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0]
    const selectedEvidence = selectedRow?.evidenceItems.find(item => item.id === selectedId) ?? selectedRow?.evidenceItems[0]
    const selectedArtifact = selectedRow?.artifactIds.find(id => id === selectedArtifactId) ?? selectedRow?.artifactIds[0]
    const blockedCount = rows.filter(row => row.state === 'blocked').length
    const reviewCount = rows.filter(row => row.state === 'review').length
    const compactRows = rows.slice(0, TI_WORKBENCH_PREVIEW_ROWS)
    const visibleRows = showAllQuestions
        ? rows
        : selectedRow && !compactRows.some(row => row.id === selectedRow.id)
            ? [...compactRows.slice(0, TI_WORKBENCH_PREVIEW_ROWS - 1), selectedRow]
            : compactRows
    const hiddenQuestionCount = Math.max(0, rows.length - visibleRows.length)

    return (
        <Panel title='Source review' description='Open data questions tied to evidence, key details, sources, and case review.' icon={<Database className='h-4 w-4' />}>
            <div data-ti-enrichment-gap-workbench='true' className='grid min-w-0 gap-3'>
                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            {rows.length} question{rows.length === 1 ? '' : 's'} · {blockedCount} syncing · {reviewCount} review
                        </p>
                    </div>
                    {selectedRow ? <CopyPayloadButton label='Source review question' payload={selectedRow.payload} /> : null}
                </div>
                <div className='max-h-96 min-w-0 overflow-auto rounded-lg border border-ui-border dark:border-ui-border'>
                    <table className='min-w-170 w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Open question</th>
                                <th className='px-3 py-2 font-semibold'>Entity</th>
                                <th className='px-3 py-2 font-semibold'>Freshness</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
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
                                                <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.label}</span>
                                                <span className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatLabel(row.type)}</span>
                                            </button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.entity}</p>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.impact)}</p>
                                        </td>
                                        <td className='px-3 py-2 text-ui-text dark:text-ui-text'>{row.newestAt ? formatDate(row.newestAt) : 'Not dated'}</td>
                                        <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceConfidenceLabel(row.confidenceValues)}</td>
                                        <td className='px-3 py-2'>
                                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                                <span className={sourceHealthChipClass(row.state)}>{publicStateLabel(row.state)}</span>
                                                {row.evidenceItems[0] ? <button type='button' onClick={() => onSelectEvidence(row.evidenceItems[0]!.id)} className='ui-button ui-button-secondary min-h-8 px-2 text-[11px]'>Open result</button> : null}
                                                {row.artifactIds[0] ? <button type='button' onClick={() => onSelectArtifact(row.artifactIds[0]!)} className='ui-button ui-button-secondary min-h-8 px-2 text-[11px]'>Detail</button> : null}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                {hiddenQuestionCount ? (
                    <button
                        type='button'
                        onClick={() => setShowAllQuestions(true)}
                        className='inline-flex min-h-9 w-fit items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                    >
                        Show {hiddenQuestionCount} more questions
                    </button>
                ) : showAllQuestions && rows.length > compactRows.length ? (
                    <button
                        type='button'
                        onClick={() => setShowAllQuestions(false)}
                        className='inline-flex min-h-9 w-fit items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                    >
                        Show key questions only
                    </button>
                ) : null}
                {selectedRow ? (
                    <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected question</p>
                                <p className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.label}</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.impact)}</p>
                            </div>
                            <span className={sourceHealthChipClass(selectedRow.state)}>{publicStateLabel(selectedRow.state)}</span>
                        </div>
                        <p className='mt-3 wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                            {selectedRow.source} · {selectedRow.evidenceItems.length} evidence · {selectedRow.artifactIds.length} details · {selectedRow.missing.length} missing
                        </p>
                        {selectedRow.missing.length ? (
                            <div className='mt-3 rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                                {displayRequirementList(selectedRow.missing.slice(0, 3))}
                            </div>
                        ) : null}
                        <div className='mt-3 grid grid-cols-2 gap-1.5'>
                            <button type='button' onClick={onReview} className='ui-button ui-button-secondary min-h-8 px-2 text-xs'>Review</button>
                            <button type='button' onClick={onEscalate} className='ui-button ui-button-secondary min-h-8 px-2 text-xs'>Escalate</button>
                            {selectedEvidence ? <button type='button' onClick={() => onSelectEvidence(selectedEvidence.id)} className='ui-button ui-button-secondary min-h-8 px-2 text-xs'>Open result</button> : null}
                            {selectedArtifact ? <button type='button' onClick={() => onSelectArtifact(selectedArtifact)} className='ui-button ui-button-secondary min-h-8 px-2 text-xs'>Open detail</button> : null}
                        </div>
                        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                            {selectedRow.route ? <a href={selectedRow.route} className='inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'><ExternalLink className='h-3.5 w-3.5' />Open action</a> : null}
                            <CopyPayloadButton label='Export gap' payload={selectedRow.payload} showLabel />
                        </div>
                    </div>
                ) : null}
            </div>
        </Panel>
    )
}
