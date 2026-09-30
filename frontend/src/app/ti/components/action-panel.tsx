'use client'

import { formatDate } from '../pageClientShared'
import { BellRing, CheckCircle2, ClipboardList, Database, Eye, Send, ShieldAlert, UserPlus, XCircle } from 'lucide-react'
import { decisionLabel, decisionStepStatusClass, displayRequirementList, relevanceLabel, type CaseActionTrailPayload, type LocalDecision, type LocalRelevanceMark, type SelectedAlertActionPlan, type SelectedCaseCreateRequest, type SelectedCaseDraft, type SelectedCaseOwnershipPlan, type SelectedDeliveryReadinessPlan, type SelectedEnrichmentTriage, type SelectedReviewHandoff, type SelectedWatchlistPlan } from '../pageModel'
import { useState } from 'react'
import ActionButton from './action-button'
import CaseActionTrailPanel from './case-action-trail-panel'
import CopyPayloadButton from './copy-payload-button'
import Panel from './panel'
import SelectedAlertActionPlanPanel from './selected-alert-action-plan-panel'
import SelectedCaseCreateRequestPanel from './selected-case-create-request-panel'
import SelectedCaseDraftPanel from './selected-case-draft-panel'
import SelectedCaseOwnershipPanel from './selected-case-ownership-panel'
import SelectedDeliveryReadinessPanel from './selected-delivery-readiness-panel'
import SelectedEnrichmentTriagePanel from './selected-enrichment-triage-panel'
import SelectedWatchlistPlanPanel from './selected-watchlist-plan-panel'

export default function ActionPanel({ note, decision, relevance, reviewHandoff, caseDraft, caseActionTrail, caseOwnership, caseCreateRequest, watchlistPlan, alertPlan, deliveryPlan, enrichmentTriage, onNoteChange, onDecision, onRelevance, onStage }: {
    note: string
    decision?: LocalDecision
    relevance?: LocalRelevanceMark
    reviewHandoff: SelectedReviewHandoff | null
    caseDraft: SelectedCaseDraft | null
    caseActionTrail: CaseActionTrailPayload | null
    caseOwnership: SelectedCaseOwnershipPlan | null
    caseCreateRequest: SelectedCaseCreateRequest | null
    watchlistPlan: SelectedWatchlistPlan | null
    alertPlan: SelectedAlertActionPlan | null
    deliveryPlan: SelectedDeliveryReadinessPlan | null
    enrichmentTriage: SelectedEnrichmentTriage | null
    onNoteChange: (value: string) => void
    onDecision: (status: LocalDecision['status']) => void
    onRelevance: (state: LocalRelevanceMark['state']) => void
    onStage: () => void
}) {
    const [showWorkflowDetails, setShowWorkflowDetails] = useState(false)
    const readyForCase = Boolean(reviewHandoff?.caseHandoff.ready)
    const readyForAlert = Boolean(reviewHandoff?.alertHandoff.ready)
    const workflowDetailCount = [
        caseDraft,
        caseOwnership,
        caseCreateRequest,
        watchlistPlan,
        alertPlan,
        deliveryPlan,
        enrichmentTriage,
        caseActionTrail,
        reviewHandoff,
    ].filter(Boolean).length
    return (
        <Panel title='Session Notes' description='These controls are local to this browser session. Use them for scratch triage only; persisted ownership, delivery, and audit history live in the authenticated console.' icon={<ClipboardList className='h-4 w-4' />}>
            <div className='grid gap-3'>
                {decision ? (
                    <div className='rounded-lg border border-ui-success/35 bg-ui-success/10 p-3 text-xs leading-5 text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'>
                        {decisionLabel(decision.status)} recorded at {formatDate(decision.decidedAt)}. Rationale: {decision.reason}
                    </div>
                ) : (
                    <div className='rounded-lg border border-ui-border bg-ui-raised p-3 text-xs leading-5 text-ui-muted'>
                        No local scratch decision recorded yet.
                    </div>
                )}
                <textarea
                    value={note}
                    onChange={event => onNoteChange(event.target.value)}
                    placeholder='Scratch rationale, proposed owner, or next evidence to collect...'
                    className='min-h-24 resize-y rounded-lg border border-ui-border bg-ui-panel p-3 text-sm leading-6 text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
                />
                <div className='grid grid-cols-2 gap-2'>
                    <ActionButton icon={<Eye className='h-3.5 w-3.5' />} onClick={() => onDecision('reviewing')}>Review</ActionButton>
                    <ActionButton icon={<UserPlus className='h-3.5 w-3.5' />} onClick={() => onDecision('assigned')}>Assign</ActionButton>
                    <ActionButton icon={<Send className='h-3.5 w-3.5' />} onClick={() => onDecision('escalated')}>Escalate</ActionButton>
                    <ActionButton icon={<ShieldAlert className='h-3.5 w-3.5' />} onClick={() => onDecision('suppressed')}>Suppress</ActionButton>
                    <ActionButton icon={<CheckCircle2 className='h-3.5 w-3.5' />} onClick={() => onDecision('closed')}>Close</ActionButton>
                    <ActionButton icon={<XCircle className='h-3.5 w-3.5' />} onClick={() => onDecision('reopened')}>Reopen</ActionButton>
                </div>
                <div data-ti-local-relevance='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                    <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                        <div className='min-w-0'>
                            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Relevance mark</p>
                            <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                                Session-local mark for watchlist, source review, or case preparation.
                            </p>
                        </div>
                        <span className={relevance ? decisionStepStatusClass(relevance.state === 'not_relevant' ? 'blocked' : relevance.state === 'needs_source' ? 'review' : 'ready') : decisionStepStatusClass('review')}>
                            {relevance ? relevanceLabel(relevance.state) : 'unmarked'}
                        </span>
                    </div>
                    {relevance ? (
                        <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                            {relevance.rationale} {relevance.watchTerms.length ? `Terms: ${relevance.watchTerms.slice(0, 3).join(', ')}.` : ''}
                        </p>
                    ) : null}
                    <div className='mt-3 grid grid-cols-2 gap-2'>
                        <ActionButton icon={<BellRing className='h-3.5 w-3.5' />} onClick={() => onRelevance('customer_relevant')}>Customer</ActionButton>
                        <ActionButton icon={<ClipboardList className='h-3.5 w-3.5' />} onClick={() => onRelevance('context_only')}>Context</ActionButton>
                        <ActionButton icon={<Database className='h-3.5 w-3.5' />} onClick={() => onRelevance('needs_source')}>Source</ActionButton>
                        <ActionButton icon={<XCircle className='h-3.5 w-3.5' />} onClick={() => onRelevance('not_relevant')}>Not relevant</ActionButton>
                    </div>
                </div>
                {workflowDetailCount ? (
                    <button type='button' onClick={() => setShowWorkflowDetails(value => !value)} className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
                        {showWorkflowDetails ? 'Hide action detail' : `Show action detail (${workflowDetailCount})`}
                    </button>
                ) : null}
                {showWorkflowDetails ? (
                    <>
                        {caseDraft ? <SelectedCaseDraftPanel draft={caseDraft} /> : null}
                        {caseOwnership ? <SelectedCaseOwnershipPanel plan={caseOwnership} /> : null}
                        {caseCreateRequest ? <SelectedCaseCreateRequestPanel request={caseCreateRequest} /> : null}
                        {watchlistPlan ? <SelectedWatchlistPlanPanel plan={watchlistPlan} /> : null}
                        {alertPlan ? <SelectedAlertActionPlanPanel plan={alertPlan} /> : null}
                        {deliveryPlan ? <SelectedDeliveryReadinessPanel plan={deliveryPlan} /> : null}
                        {enrichmentTriage ? <SelectedEnrichmentTriagePanel triage={enrichmentTriage} /> : null}
                        {caseActionTrail ? <CaseActionTrailPanel trail={caseActionTrail} /> : null}
                        {reviewHandoff ? (
                            <div data-ti-selected-review-handoff='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                    <div className='min-w-0'>
                                        <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected review package</p>
                                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                                            Copyable evidence, rationale, and review state for authenticated case review. This does not save public-page notes.
                                        </p>
                                    </div>
                                    <CopyPayloadButton label='Selected review package' payload={reviewHandoff} />
                                </div>
                                <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
                                    <span className={readyForAlert ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                        alert {readyForAlert ? 'ready' : 'syncing'}
                                    </span>
                                    <span className={readyForCase ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>
                                        case {readyForCase ? 'ready' : 'syncing'}
                                    </span>
                                    <span className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                                        {reviewHandoff.evidenceBasis.length} evidence item{reviewHandoff.evidenceBasis.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                {reviewHandoff.blockers.length ? (
                                    <p className='mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>{displayRequirementList(reviewHandoff.blockers.slice(0, 2))}</p>
                                ) : null}
                            </div>
                        ) : null}
                    </>
                ) : null}
                <button
                    type='button'
                    onClick={onStage}
                    disabled={!reviewHandoff || !caseDraft || !caseOwnership || !caseCreateRequest || !watchlistPlan || !alertPlan || !deliveryPlan || !enrichmentTriage || !caseActionTrail}
                    className='inline-flex min-h-9 w-fit max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised dark:disabled:bg-ui-raised dark:disabled:text-ui-muted'
                >
                    <ClipboardList className='h-3.5 w-3.5' />
                    Stage handoff
                </button>
            </div>
        </Panel>
    )
}
