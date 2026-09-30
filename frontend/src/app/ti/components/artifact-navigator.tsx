'use client'

import { TI_WORKBENCH_PREVIEW_ROWS, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { artifactStateFor, artifactStateLabel, artifactWorklistPayloadFor, displayRequirementText, formatLabel, sourceBasisLabel } from '../pageModel'
import { nextActorArtifactId, type ActorArtifact } from '@/utils/ti/actorWorkbench'
import { useState } from 'react'
import CopyPayloadButton from './copy-payload-button'

export default function ArtifactNavigator({ artifacts, selectedArtifactId, onSelectArtifact }: { artifacts: ActorArtifact[]; selectedArtifactId?: string; onSelectArtifact: (artifactId: string) => void }) {
    const [showAllArtifacts, setShowAllArtifacts] = useState(false)
    function move(direction: 'next' | 'previous' | 'first' | 'last') {
        const next = nextActorArtifactId(artifacts, selectedArtifactId, direction)
        if (next) onSelectArtifact(next)
    }
    const selectedArtifact = artifacts.find(artifact => artifact.id === selectedArtifactId) ?? artifacts[0]
    const readyCount = artifacts.filter(artifact => artifactStateFor(artifact) === 'ready').length
    const reviewCount = artifacts.filter(artifact => artifactStateFor(artifact) === 'review').length
    const blockedCount = artifacts.filter(artifact => artifactStateFor(artifact) === 'blocked').length
    const compactArtifacts = artifacts.slice(0, TI_WORKBENCH_PREVIEW_ROWS)
    const visibleArtifacts = showAllArtifacts
        ? artifacts
        : selectedArtifact && !compactArtifacts.some(artifact => artifact.id === selectedArtifact.id)
            ? [...compactArtifacts.slice(0, TI_WORKBENCH_PREVIEW_ROWS - 1), selectedArtifact]
            : compactArtifacts
    const hiddenArtifactCount = Math.max(0, artifacts.length - visibleArtifacts.length)

    return (
        <section
            data-ti-artifact-worklist='true'
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    event.preventDefault()
                    move('next')
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    event.preventDefault()
                    move('previous')
                } else if (event.key === 'Home') {
                    event.preventDefault()
                    move('first')
                } else if (event.key === 'End') {
                    event.preventDefault()
                    move('last')
                }
            }}
            className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel'
        >
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Key details</p>
                    <p className='mt-0.5 hidden wrap-break-word text-xs text-ui-muted dark:text-ui-muted md:block'>Indicators, methods, tools, campaigns, and locations with sources.</p>
                </div>
                <div className='flex min-w-0 flex-wrap gap-1.5'>
                    <span className={sourceHealthChipClass('ready')}>{readyCount} ready</span>
                    <span className={sourceHealthChipClass('review')}>{reviewCount} review</span>
                    <span className={sourceHealthChipClass(blockedCount ? 'blocked' : 'ready')}>{blockedCount} syncing</span>
                    {selectedArtifact ? <CopyPayloadButton label='Copy detail' payload={artifactWorklistPayloadFor(selectedArtifact)} /> : null}
                </div>
            </div>
            <div className='grid min-w-0 xl:grid-cols-[minmax(0,1fr)_18rem]'>
                <div className='min-w-0 overflow-x-auto'>
                    <table className='min-w-175 w-full border-collapse text-left text-xs'>
                        <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Detail</th>
                                <th className='px-3 py-2 font-semibold'>Results</th>
                                <th className='px-3 py-2 font-semibold'>Freshness</th>
                                <th className='px-3 py-2 font-semibold'>Basis</th>
                                <th className='px-3 py-2 font-semibold'>Action state</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {visibleArtifacts.map(artifact => {
                                const active = artifact.id === selectedArtifact?.id
                                const state = artifactStateFor(artifact)
                                return (
                                    <tr key={artifact.id} className={`${active ? 'bg-ui-primary/10 dark:bg-ui-primary/10' : 'bg-ui-panel dark:bg-ui-panel'} align-top`}>
                                        <td className='px-3 py-2'>
                                            <button type='button' onClick={() => onSelectArtifact(artifact.id)} className='grid min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                                                <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{artifact.label}</span>
                                                <span className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatLabel(artifact.kind)}</span>
                                            </button>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <p className='font-semibold text-ui-text dark:text-ui-text'>{artifact.evidence.length} results</p>
                                            <p className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{artifact.evidence[0] ? displayRequirementText(artifact.evidence[0]) : artifact.subtitle}</p>
                                        </td>
                                        <td className='px-3 py-2 text-ui-text dark:text-ui-text'>{formatDate(artifact.freshness)}</td>
                                        <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceBasisLabel(artifact.confidence)}</td>
                                        <td className='px-3 py-2'>
                                            <span className={sourceHealthChipClass(state)}>{artifactStateLabel(artifact)}</span>
                                            <p className='mt-1 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                                {artifact.watchlistTerms.length} watch · {artifact.enrichmentTasks.length} source questions
                                            </p>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {hiddenArtifactCount ? (
                        <button
                            type='button'
                            onClick={() => setShowAllArtifacts(true)}
                            className='ui-button ui-button-secondary m-2 min-h-9 px-3 text-xs'
                        >
                            Show {hiddenArtifactCount} more details
                        </button>
                    ) : showAllArtifacts && artifacts.length > compactArtifacts.length ? (
                        <button
                            type='button'
                            onClick={() => setShowAllArtifacts(false)}
                            className='ui-button ui-button-secondary m-2 min-h-9 px-3 text-xs'
                        >
                            Show key details only
                        </button>
                    ) : null}
                </div>
                <div className='min-w-0 border-t border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised xl:border-l xl:border-t-0'>
                    {selectedArtifact ? (
                        <div className='grid gap-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected detail</p>
                                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedArtifact.label}</h3>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{selectedArtifact.subtitle}</p>
                            </div>
                            <p className='wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                                {formatLabel(selectedArtifact.kind)} · {sourceBasisLabel(selectedArtifact.confidence)} · {selectedArtifact.watchlistTerms.length} watch · {selectedArtifact.enrichmentTasks.length} open questions
                            </p>
                            <div className='grid grid-cols-2 gap-1.5'>
                                <button type='button' onClick={() => onSelectArtifact(selectedArtifact.id)} className='ui-button ui-button-secondary min-h-8 px-2 text-xs'>Review</button>
                                <CopyPayloadButton label='Export' payload={artifactWorklistPayloadFor(selectedArtifact)} showLabel />
                            </div>
                            <div className='flex min-w-0 flex-wrap gap-1.5'>
                                {selectedArtifact.watchlistTerms.slice(0, 3).map(term => (
                                    <span key={`${term.kind}-${term.value}`} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                        {term.kind}: {term.value}
                                    </span>
                                ))}
                                {!selectedArtifact.watchlistTerms.length ? <span className='text-xs text-ui-muted dark:text-ui-muted'>Attach watch term.</span> : null}
                            </div>
                        </div>
                    ) : (
                        <p className='text-sm text-ui-muted dark:text-ui-muted'>Select a detail to inspect source and review context.</p>
                    )}
                </div>
            </div>
        </section>
    )
}
