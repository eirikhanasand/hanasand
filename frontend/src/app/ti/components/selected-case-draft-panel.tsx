'use client'

import { compactSourceReferenceLabel, handoffMissingLabel, sourceHealthChipClass } from '../pageClientShared'
import { decisionStepStatusClass, displayRequirementList, displayRequirementText, formatLabel, sourceBasisLabel, type SelectedCaseDraft } from '../pageModel'
import CopyPayloadButton from './copy-payload-button'

export default function SelectedCaseDraftPanel({ draft }: { draft: SelectedCaseDraft }) {
    return (
        <div data-ti-selected-case-draft='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs'>
                <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                    Case draft · {formatLabel(draft.caseIntent)} · {draft.sourceRows.length} source row{draft.sourceRows.length === 1 ? '' : 's'}
                </p>
                <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                    <span className={draft.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{draft.ready ? 'ready' : 'syncing'}</span>
                    <CopyPayloadButton label='Case draft' payload={draft} />
                </div>
            </div>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(draft.route || draft.endpoint)}</p>
            {draft.sourceRows.length ? (
                <div data-ti-selected-case-sources='true' className='mt-2 grid min-w-0 gap-2'>
                    {draft.sourceRows.slice(0, 2).map(row => (
                        <div key={`${row.sourceId ?? row.sourceName}:${row.provenance}:${row.captureId ?? 'missing'}`} className='rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}{row.sourceId ? ' · source linked' : ''}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.provenance)}</p>
                                </div>
                                <span className={sourceHealthChipClass(row.state === 'ready' ? 'ready' : row.state === 'needs_capture' ? 'blocked' : 'review')}>
                                    {row.captureId ? 'source linked' : 'sources syncing'}
                                </span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                {typeof row.confidence === 'number' ? sourceBasisLabel(row.confidence) : 'evidence strength pending'}{row.missing.length ? ` · needs ${handoffMissingLabel(row.missing)}` : ''}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                {draft.watchTerms.slice(0, 3).map(term => (
                    <span key={term} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>{term}</span>
                ))}
                {!draft.watchTerms.length ? <span className='text-[11px] text-ui-muted dark:text-ui-muted'>Add watch term.</span> : null}
            </div>
            {draft.missing.length ? (
                <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(draft.missing.slice(0, 3))}</p>
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Required case identifiers and evidence context are present.</p>
            )}
        </div>
    )
}
