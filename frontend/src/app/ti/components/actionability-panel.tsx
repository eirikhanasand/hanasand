'use client'

import { compactSourceReferenceLabel, decisionStepsFor } from '../pageClientShared'
import { ClipboardList, ExternalLink, ShieldCheck } from 'lucide-react'
import { displayRequirementList } from '../pageModel'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import ActionPayloadsPanel from './action-payloads-panel'
import ConsumerReadinessPanel from './consumer-readiness-panel'
import DecisionFlow from './decision-flow'
import HandoffEvidenceMatrix from './handoff-evidence-matrix'
import Link from 'next/link'
import OrgRelevancePanel from './org-relevance-panel'
import Panel from './panel'
import PayloadHandoffRow from './payload-handoff-row'
import ReadinessBlockersPanel from './readiness-blockers-panel'
import RelatedRecordsPanel from './related-records-panel'

export default function ActionabilityPanel({ actionability, query }: { actionability: TiActionabilityModel; query: string }) {
    const casePath = actionability.relatedCases[0]?.path || actionability.relatedAlerts[0]?.casePath
    const decisionSteps = decisionStepsFor(actionability)

    return (
        <Panel title='Actions' description='Operational state for watchlists, alerts, cases, delivery, and source collection.' icon={<ShieldCheck className='h-4 w-4' />}>
            <div className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3'>
                <DecisionFlow steps={decisionSteps} disposition={actionability.alertDisposition} shouldAlert={actionability.shouldAlert} rationale={actionability.rationale} />
                <HandoffEvidenceMatrix actionability={actionability} />
                <ConsumerReadinessPanel actionability={actionability} />
                <ReadinessBlockersPanel actionability={actionability} />
                <ActionPayloadsPanel actionability={actionability} />

                <OrgRelevancePanel actionability={actionability} />

                <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Geography</p>
                    <div className='mt-2 grid gap-2'>
                        {actionability.geographyHandoffs.slice(0, 4).map(item => (
                            <div key={`${item.role}-${item.code}`} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.country}</p>
                                    <span className='shrink-0 text-[11px] text-ui-muted dark:text-ui-muted'>{item.role === 'operator' ? 'attribution' : `${item.observationCount} observation${item.observationCount === 1 ? '' : 's'}`}</span>
                                </div>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{item.watchlistTerm ? `${item.watchlistTerm.kind}: ${item.watchlistTerm.value}` : item.enrichmentTask}</p>
                            </div>
                        ))}
                        {!actionability.geographyHandoffs.length ? <p className='text-xs text-ui-muted dark:text-ui-muted'>Use country-specific sources before regional routing.</p> : null}
                    </div>
                </div>

                <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Sources</p>
                    <div className='mt-2 grid gap-2'>
                        {actionability.sourceClusters.slice(0, 4).map(item => (
                            <div key={`${item.sourceName}-${item.provenance}`} className='rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='min-w-0 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.sourceName}</p>
                                    <span className={item.captureId ? 'shrink-0 text-[11px] text-ui-success' : 'shrink-0 text-[11px] text-ui-warning'}>{item.captureId ? 'source linked' : 'sources syncing'}</span>
                                </div>
                                <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(item.provenance)}</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{item.watchlistTerm ? `${item.watchlistTerm.kind}: ${item.watchlistTerm.value}` : item.enrichmentTask}</p>
                            </div>
                        ))}
                        {!actionability.sourceClusters.length ? <p className='text-xs text-ui-muted dark:text-ui-muted'>Add source details before review.</p> : null}
                    </div>
                </div>

                <div className='grid min-w-0 gap-2'>
                    <Link href='/findings' className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                        <ExternalLink className='h-3.5 w-3.5' />
                        Open console
                    </Link>
                    {casePath ? (
                        <a href={casePath} className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                            <ExternalLink className='h-3.5 w-3.5' />
                            Open related case
                        </a>
                    ) : (
                        <button type='button' disabled title={displayRequirementList(actionability.handoffs.caseBlockers)} className='inline-flex min-h-9 w-fit max-w-full cursor-not-allowed items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-muted'>
                            <ClipboardList className='h-3.5 w-3.5' />
                            Create case
                        </button>
                    )}
                </div>

                {!casePath && actionability.handoffs.casePayload ? (
                    <PayloadHandoffRow
                        label='case delivery'
                        detail={actionability.caseHandoff.blocked ? `Waiting on ${displayRequirementList(actionability.caseHandoff.missing.slice(0, 2))}.` : 'Case request is prepared for authenticated review.'}
                        payload={actionability.exportPayloads.case.body}
                        route={actionability.caseHandoff.backedRoute}
                        blocked={actionability.caseHandoff.blocked}
                    />
                ) : null}

                <RelatedRecordsPanel actionability={actionability} query={query} />
            </div>
        </Panel>
    )
}
