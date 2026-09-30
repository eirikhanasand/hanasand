'use client'

import { TI_SELECTED_DETAIL_LIST_ROWS, TI_SELECTED_SOURCE_REQUEST_ROWS, artifactReferenceChips, compactSourceReferenceLabel, formatDate, handoffMissingLabel, sourceHealthChipClass, sourceRequestCaptureClass, sourceRequestFamilyLabel } from '../pageClientShared'
import { actionOwnerLabel, displayRequirementText, formatLabel, publicStateLabel, selectedArtifactPayloadFor, sourceBasisLabel, sourceRequestRouteLabel } from '../pageModel'
import { PUBLIC_TI_HANDOFF_ACTIONS, type ActorArtifact, type ActorArtifactHandoffs } from '@/utils/ti/actorWorkbench'
import { useState } from 'react'
import CopyPayloadButton from './copy-payload-button'
import EvidenceMetric from './evidence-metric'
import EvidencePanel from './evidence-panel'
import PayloadHandoffRow from './payload-handoff-row'

export default function ActorArtifactWorkbench({ artifact, handoffs }: { artifact: ActorArtifact; handoffs: ActorArtifactHandoffs }) {
    const [showRoutingChecks, setShowRoutingChecks] = useState(false)
    const bridge = handoffs.authBridge
    const selectedArtifactPayload = selectedArtifactPayloadFor(artifact, handoffs)
    const payloadRows = [
        { id: 'watchlist', label: 'Watchlist package', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist], route: bridge.links.watchlist.href, blocked: handoffs.watchlist.blocked, detail: handoffs.watchlist.missing.length ? handoffMissingLabel(handoffs.watchlist.missing) : `${artifact.watchlistTerms.length} watch term${artifact.watchlistTerms.length === 1 ? '' : 's'}` },
        { id: 'alert', label: 'Alert rebuild', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild], route: bridge.links.alertRebuild.href, blocked: handoffs.alertRebuild.blocked, detail: handoffs.alertRebuild.missing.length ? handoffMissingLabel(handoffs.alertRebuild.missing) : 'Ready to rebuild from this selected record.' },
        { id: 'case', label: 'Case package', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case], route: bridge.links.case.href, blocked: handoffs.case.blocked, detail: handoffs.case.missing.length ? handoffMissingLabel(handoffs.case.missing) : 'Ready to open with this selected record.' },
        { id: 'enrichment', label: 'Source review item', payload: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.enrichment], route: bridge.links.enrichment.href, blocked: handoffs.enrichment.blocked, detail: handoffs.enrichment.missing.length ? handoffMissingLabel(handoffs.enrichment.missing) : `${artifact.enrichmentTasks.length} source review task${artifact.enrichmentTasks.length === 1 ? '' : 's'}` },
    ]
    const workflowRows = payloadRows.map(row => ({
        ...row,
        readiness: row.payload.actionReadiness.find(item => item.action === row.payload.action),
        missing: row.payload.missing,
        endpoint: row.payload.selectedPayload.endpoint ?? row.payload.selectedPayload.backedRoute ?? row.route,
    }))

    return (
        <section data-ti-selected-artifact='true' className='max-w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-3 sm:p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>Selected detail</p>
                    <h2 className='mt-1 wrap-break-word text-xl font-semibold text-ui-text'>{artifact.label}</h2>
                    <p className='mt-1 text-sm leading-6 text-ui-muted'>{formatLabel(artifact.kind)} · {artifact.subtitle}</p>
                </div>
                <div data-ti-selected-artifact-export='true' className='grid w-full min-w-0 basis-full gap-2 sm:min-w-72 lg:w-auto lg:basis-auto'>
                    <div className='grid grid-cols-3 gap-2 text-center text-xs'>
                        <EvidenceMetric label='Freshness' value={formatDate(artifact.freshness)} />
                        <EvidenceMetric label='Evidence strength' value={sourceBasisLabel(artifact.confidence)} />
                        <EvidenceMetric label='Action state' value={displayRequirementText(artifact.readiness.label)} />
                    </div>
                    <div className='flex min-w-0 flex-wrap items-center justify-start gap-1.5 lg:justify-end'>
                        <span className={sourceHealthChipClass(artifact.readiness.state === 'ready_for_org_handoff' ? 'ready' : artifact.readiness.state === 'needs_source' || artifact.readiness.state === 'needs_watchlist_term' ? 'blocked' : 'review')}>{publicStateLabel(artifact.readiness.state)}</span>
                        <CopyPayloadButton label='Selected detail' payload={selectedArtifactPayload} />
                    </div>
                </div>
            </div>
            <div className='mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]'>
                <div className='grid gap-3 md:grid-cols-2'>
                    <EvidencePanel title='Evidence'>
                        {artifact.evidence.length ? artifact.evidence.slice(0, TI_SELECTED_DETAIL_LIST_ROWS).map(line => <li key={line}>{displayRequirementText(line)}</li>) : <li>Review source evidence before case work.</li>}
                    </EvidencePanel>
                    <EvidencePanel title='Source details'>
                        {artifact.provenance.length ? artifact.provenance.slice(0, TI_SELECTED_DETAIL_LIST_ROWS).map(line => <li key={line}>{displayRequirementText(line)}</li>) : <li>Source details are missing for this detail.</li>}
                    </EvidencePanel>
                    <EvidencePanel title='Watchlist relevance'>
                        {artifact.watchlistTerms.length ? artifact.watchlistTerms.slice(0, TI_SELECTED_DETAIL_LIST_ROWS).map(term => <li key={`${term.kind}-${term.value}`}>{term.kind}: {term.value}. {displayRequirementText(term.notes)}</li>) : <li>Attach customer watchlist term.</li>}
                        {artifact.watchlistTerms.length > TI_SELECTED_DETAIL_LIST_ROWS ? <li className='text-ui-muted'>+{artifact.watchlistTerms.length - TI_SELECTED_DETAIL_LIST_ROWS} more watch terms in workbenches</li> : null}
                    </EvidencePanel>
                    <EvidencePanel title='Open source questions'>
                        {artifact.enrichmentTasks.length ? artifact.enrichmentTasks.slice(0, TI_SELECTED_DETAIL_LIST_ROWS).map(task => <li key={task}>{displayRequirementText(task)}</li>) : <li>Source questions are clear.</li>}
                        {artifact.enrichmentTasks.length > TI_SELECTED_DETAIL_LIST_ROWS ? <li className='text-ui-muted'>+{artifact.enrichmentTasks.length - TI_SELECTED_DETAIL_LIST_ROWS} more source questions in workbenches</li> : null}
                    </EvidencePanel>
                </div>
                <div className='grid min-w-0 max-w-full content-start gap-2 overflow-hidden'>
                    <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                        <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Console actions</p>
                        <p className='mt-2 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            This view prepares links and payloads for organization-scoped review. Saving watchlists, rebuilding alerts, creating cases, and source review require console access.
                        </p>
                        <div className='mt-2 flex flex-wrap gap-1.5'>
                            <span className={bridge.orgRequired ? 'rounded-md bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning' : 'rounded-md bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'}>
                                {bridge.orgRequired ? 'org required' : 'org scoped'}
                            </span>
                            <span className={bridge.sourceRequired ? 'rounded-md bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning' : 'rounded-md bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'}>
                                {bridge.sourceRequired ? 'source required' : 'source attached'}
                            </span>
                            <span className={bridge.stale ? 'rounded-md bg-ui-raised/10 px-2 py-1 text-[11px] font-semibold text-ui-text dark:bg-ui-raised/10 dark:text-ui-text' : 'rounded-md bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'}>
                                {bridge.stale ? 'stale' : 'fresh enough'}
                            </span>
                        </div>
                        <div data-ti-artifact-source-requests='true' className='mt-3 grid min-w-0 w-full max-w-[calc(100vw-7rem)] gap-2 overflow-hidden sm:max-w-full'>
                            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source requests</p>
                            {bridge.payload.sourceRequests.length ? bridge.payload.sourceRequests.slice(0, TI_SELECTED_SOURCE_REQUEST_ROWS).map(request => (
                                <div key={`${request.sourceName}-${request.provenance}-${request.captureId ?? 'missing'}`} className='min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                    <div className='flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'>
                                        <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{request.sourceName}</p>
                                        <span className={sourceRequestCaptureClass(Boolean(request.captureId))}>
                                            {request.captureId ? 'source linked' : 'sources syncing'}
                                        </span>
                                    </div>
                                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{request.captureId ? 'source linked' : compactSourceReferenceLabel(request.provenance)}</p>
                                    {request.missing.length || typeof request.confidence === 'number' ? (
                                        <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                            {[typeof request.confidence === 'number' ? sourceBasisLabel(request.confidence) : '', ...request.missing.map(displayRequirementText)].filter(Boolean).join(' · ')}
                                        </p>
                                    ) : null}
                                    <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                        <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                            {sourceRequestFamilyLabel(request.sourceFamily ?? 'source_capture')}
                                        </span>
                                        <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                            {sourceRequestRouteLabel(request.route ?? '/ti/profiles')}
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <p className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>Create a source request before customer review.</p>
                            )}
                        </div>
                        {bridge.missing.length ? (
                            <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-warning'>
                                {bridge.missing.slice(0, TI_SELECTED_SOURCE_REQUEST_ROWS).map(item => <li key={item}>{displayRequirementText(item)}</li>)}
                            </ul>
                        ) : null}
                        {bridge.payload.evidenceRefs ? (
                            <div data-ti-artifact-reference-summary='true' className='mt-3 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Reference summary</p>
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    {artifactReferenceChips(bridge.payload.evidenceRefs).map(item => (
                                        <span key={item.label} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                            {item.value} {item.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
            <div data-ti-artifact-workflow-readiness='true' className='mt-3 border-t border-ui-border pt-3 dark:border-ui-border'>
                <div className='flex flex-wrap items-center justify-between gap-2 text-xs'>
                    <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>
                        Console action links · {workflowRows.filter(row => !row.blocked).length}/{workflowRows.length} available · watchlist, alert, case, source
                    </p>
                    <p className='min-w-0 wrap-break-word text-[11px] font-medium text-ui-muted dark:text-ui-muted'>
                        {workflowRows
                            .map(row => row.readiness ? actionOwnerLabel(row.readiness.ownerLane) : '')
                            .filter((label, index, labels) => label && labels.indexOf(label) === index)
                            .slice(0, 3)
                            .join(' · ') || 'Console action owners'}
                    </p>
                    <button type='button' onClick={() => setShowRoutingChecks(value => !value)} className='inline-flex min-h-7 items-center justify-center border-l border-ui-border pl-2 text-[11px] font-semibold text-ui-text transition hover:text-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:text-ui-text'>
                        {showRoutingChecks ? 'Hide action links' : 'Show action links'}
                    </button>
                </div>
                {showRoutingChecks ? (
                    <div className='mt-3 grid gap-2'>
                        {workflowRows.map(row => (
                            <PayloadHandoffRow key={`workflow-${row.id}`} label={row.label} detail={row.detail} payload={row.payload} route={row.route} blocked={row.blocked} />
                        ))}
                        <CopyPayloadButton label='Console action bundle' payload={bridge} />
                    </div>
                ) : null}
            </div>
        </section>
    )
}
