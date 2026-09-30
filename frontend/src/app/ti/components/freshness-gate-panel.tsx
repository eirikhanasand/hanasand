'use client'

import { captureCoverageLabel, formatDate, freshnessReviewPayloadFor } from '../pageClientShared'
import { coverageMissingLabel, decisionStepStatusClass, decisionStepStatusLabel, displayRequirementText, readinessOwnerLabel, type DecisionStep } from '../pageModel'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import CopyPayloadButton from './copy-payload-button'

export default function FreshnessGatePanel({ actor, actionability, query }: { actor: TiActorIntelligenceProfile; actionability: TiActionabilityModel; query: string }) {
    const sourceBlockers = actionability.readiness.blockers.filter(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
    const workflowBlockers = actionability.readiness.blockers.filter(blocker => blocker.ownerLane === 'org' || blocker.ownerLane === 'alert' || blocker.ownerLane === 'case' || blocker.ownerLane === 'webhook' || blocker.ownerLane === 'entitlement')
    const sourceState: DecisionStep['status'] = actor.freshness.stale || sourceBlockers.length || actor.sourceCoverage.missing.length ? 'review' : 'ready'
    const handoffState: DecisionStep['status'] = actionability.readiness.state === 'ready' ? 'ready' : workflowBlockers.length ? 'blocked' : 'review'
    const nextOwner = actionability.readiness.blockers[0]?.ownerLane ?? (actor.sourceCoverage.missing.length ? 'source' : undefined)
    const summary = actor.freshness.stale
        ? actor.freshness.reason
        : sourceState === 'review'
            ? 'Evidence dates are usable, but source coverage still needs capture or source references before stronger review.'
            : 'Evidence dates and source coverage are current enough for review.'
    const rows = [
        { label: 'Newest evidence', value: actor.sourceCoverage.latestReportDate ? formatDate(actor.sourceCoverage.latestReportDate) : 'Not dated' },
        { label: 'Generated', value: formatDate(actor.freshness.generatedAt) },
        { label: 'Source results', value: String(actor.sourceCoverage.totalRows) },
        { label: 'Source status', value: captureCoverageLabel(actor.sourceCoverage) },
    ]

    return (
        <div data-ti-freshness-gate='true' className='mt-4 min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Evidence status</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {displayRequirementText(summary)}
                    </p>
                </div>
                <div className='flex flex-wrap items-center gap-1.5'>
                    <span className={decisionStepStatusClass(sourceState)}>sources {decisionStepStatusLabel(sourceState)}</span>
                    <span className={decisionStepStatusClass(handoffState)}>review {decisionStepStatusLabel(handoffState)}</span>
                    <span data-ti-freshness-review-export='true' className='inline-flex'>
                        <CopyPayloadButton label='Freshness review' payload={freshnessReviewPayloadFor(actor, actionability, query, { sourceState, handoffState })} />
                    </span>
                </div>
            </div>
            <div className='mt-3 grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4'>
                {rows.map(row => (
                    <div key={row.label} className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{row.label}</p>
                        <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{row.value}</p>
                    </div>
                ))}
            </div>
            <div className='mt-3 grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
                <div className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source follow-up</p>
                    <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {sourceBlockers.length ? sourceBlockers.slice(0, 2).map(blocker => (
                            <li key={`${blocker.code}-${blocker.field}`} className='wrap-break-word'>{readinessOwnerLabel(blocker.ownerLane)}: {displayRequirementText(blocker.handoff)}</li>
                        )) : actor.sourceCoverage.missing.length ? actor.sourceCoverage.missing.slice(0, 2).map(item => (
                            <li key={item} className='wrap-break-word'>Source collection: attach {coverageMissingLabel(item)}.</li>
                        )) : <li>Source evidence is sufficient for review.</li>}
                    </ul>
                </div>
                <div className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                    <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Review follow-up</p>
                    <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {workflowBlockers.length ? workflowBlockers.slice(0, 2).map(blocker => (
                            <li key={`${blocker.code}-${blocker.field}`} className='wrap-break-word'>{readinessOwnerLabel(blocker.ownerLane)}: {displayRequirementText(blocker.handoff)}</li>
                        )) : <li>Required review identifiers are present.</li>}
                    </ul>
                </div>
            </div>
            <p className='mt-3 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                {nextOwner ? `Next action: ${readinessOwnerLabel(nextOwner)}.` : 'No follow-up is assigned.'}
            </p>
        </div>
    )
}
