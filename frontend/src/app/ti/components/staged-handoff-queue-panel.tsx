'use client'

import { sourceHealthChipClass, stagedReadinessChips } from '../pageClientShared'
import { ClipboardList } from 'lucide-react'
import { decisionStepStatusClass, displayRequirementList, formatLabel, relevanceLabelForStaged, type StagedHandoff } from '../pageModel'
import CopyPayloadButton from './copy-payload-button'
import Panel from './panel'

export default function StagedHandoffQueuePanel({ items, onClear }: { items: StagedHandoff[]; onClear: () => void }) {
    const readyCount = items.filter(item => item.ready).length
    const bundle = {
        schemaVersion: 'ti.public_actor.staged_handoff_bundle.v1',
        source: 'public-ti',
        sessionLocal: true,
        generatedAt: new Date().toISOString(),
        count: items.length,
        readyCount,
        items,
    }
    return (
        <Panel title='Saved drafts' description='Session-local review drafts. Open the authenticated console before submitting ownership or case changes.' icon={<ClipboardList className='h-4 w-4' />}>
            <div data-ti-staged-handoff-queue='true' className='grid gap-3'>
                <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            {items.length ? `${items.length} staged handoff${items.length === 1 ? '' : 's'} · ${readyCount} ready` : 'No handoffs staged in this browser session.'}
                        </p>
                    </div>
                    <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>
                        <CopyPayloadButton label='Saved drafts' payload={bundle} />
                        <button
                            type='button'
                            onClick={onClear}
                            disabled={!items.length}
                            className='inline-flex min-h-8 w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised dark:disabled:bg-ui-raised dark:disabled:text-ui-muted'
                        >
                            Clear
                        </button>
                    </div>
                </div>
                {items.length ? (
                    <div className='grid gap-2'>
                        {items.slice(0, 2).map(item => (
                            <div key={item.id} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.title}</p>
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                            {formatLabel(item.caseIntent)} · {relevanceLabelForStaged(item.relevanceState)} · {item.selectedArtifact.artifact.kind}: {item.selectedArtifact.artifact.label} · {item.sourceDrilldown.rows.length} source result{item.sourceDrilldown.rows.length === 1 ? '' : 's'} · {item.caseCreateRequest.actorContext.techniques.length} method{item.caseCreateRequest.actorContext.techniques.length === 1 ? '' : 's'} · {item.caseActionTrail.summary.total} trail event{item.caseActionTrail.summary.total === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                    <span className={item.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{item.ready ? 'ready' : 'syncing'}</span>
                                </div>
                                <div data-ti-staged-handoff-readiness='true' className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {stagedReadinessChips(item).map(chip => (
                                        <span key={chip.label} className={sourceHealthChipClass(chip.ready ? 'ready' : 'blocked')}>{chip.label}: {chip.value}</span>
                                    ))}
                                </div>
                                {item.blockers.length ? (
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(item.blockers.slice(0, 2))}</p>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </Panel>
    )
}
