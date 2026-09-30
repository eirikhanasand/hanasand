'use client'

import { TI_SELECTED_CONTEXT_ROWS, compactSourceReferenceLabel, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { displayRequirementText, sourceBasisLabel, type SelectedSourceDrilldown } from '../pageModel'
import CopyPayloadButton from './copy-payload-button'
import EvidenceMetric from './evidence-metric'

export default function SelectedEvidenceContextTable({ drilldown }: { drilldown: SelectedSourceDrilldown }) {
    const rows = drilldown.rows.slice(0, TI_SELECTED_CONTEXT_ROWS)
    if (!rows.length) return null
    return (
        <div data-ti-selected-evidence-context='true' className='mt-4 overflow-hidden rounded-lg border border-ui-border bg-ui-panel dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Sources</p>
                    <p className='mt-0.5 text-[11px] text-ui-muted dark:text-ui-muted'>{rows.length} source{rows.length === 1 ? '' : 's'} tied to the selected result</p>
                </div>
                <CopyPayloadButton label='Sources' payload={drilldown} />
            </div>
            <div className='grid gap-2 p-2 md:hidden'>
                {rows.map(row => (
                    <div key={`mobile-${row.rowId}`} className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.provenance)}</p>
                            </div>
                            <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? 'attached' : 'needed'}</span>
                        </div>
                        <div className='mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2'>
                            <EvidenceMetric label='Timestamp' value={row.reportDate ? formatDate(row.reportDate) : 'Not dated'} />
                            <EvidenceMetric label='Basis' value={sourceBasisLabel(row.confidence)} />
                        </div>
                        <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.handoff)}</p>
                    </div>
                ))}
            </div>
            <div className='overflow-x-auto max-md:hidden! md:block'>
                <table className='min-w-180 w-full border-collapse text-left text-xs max-md:hidden!'>
                    <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-panel dark:text-ui-muted'>
                        <tr>
                            <th className='px-3 py-2 font-semibold'>Source</th>
                            <th className='px-3 py-2 font-semibold'>Timestamp</th>
                            <th className='px-3 py-2 font-semibold'>Basis</th>
                            <th className='px-3 py-2 font-semibold'>Capture</th>
                            <th className='px-3 py-2 font-semibold'>Next action</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-ui-border'>
                        {rows.map(row => (
                            <tr key={row.rowId} className='bg-ui-panel align-top dark:bg-ui-raised'>
                                <td className='px-3 py-2'>
                                    <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.provenance)}</p>
                                </td>
                                <td className='px-3 py-2 text-ui-muted dark:text-ui-muted'>{row.reportDate ? formatDate(row.reportDate) : 'Not dated'}</td>
                                <td className='px-3 py-2 text-ui-muted dark:text-ui-muted'>{sourceBasisLabel(row.confidence)}</td>
                                <td className='px-3 py-2'>
                                    <span className={sourceHealthChipClass(row.captureId ? 'ready' : 'blocked')}>{row.captureId ? 'attached' : 'needed'}</span>
                                </td>
                                <td className='px-3 py-2'>
                                    <p className='wrap-break-word text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.handoff)}</p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
