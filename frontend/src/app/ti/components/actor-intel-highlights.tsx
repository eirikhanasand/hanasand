'use client'

import { TI_DOSSIER_REASON_ROWS, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { Activity, ClipboardList, Clock3, Database, Globe2, ShieldAlert } from 'lucide-react'
import { displayRequirementText, sourceBasisLabel, sourceCountLabel, sourceHealthFieldLabel } from '../pageModel'
import { TiSearchResponse } from '@/utils/ti/search'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import ActorSummaryFact from './actor-summary-fact'
import TechniqueBadge from './technique-badge'

export default function ActorIntelHighlights({ actor, result, actionability }: { actor: TiActorIntelligenceProfile; result: TiSearchResponse; actionability: TiActionabilityModel }) {
    const targets = [
        ...actor.targetSectors.slice(0, 2),
        ...actor.geographies.slice(0, 2),
    ].filter(Boolean).slice(0, 4)
    const aliases = result.aliases.slice(0, 5)
    const techniques = actor.techniqueCoverage.slice(0, 3)
    const latestDate = actor.sourceCoverage.latestReportDate || result.lastSeen || ''
    const openGap = actionability.enrichmentGapQueue[0]
    const sourceCount = actor.provenanceRows.length || actor.sourceCoverage.totalRows || result.sources.length
    const methodNames = techniques.map(item => item.attackId || item.name).filter(Boolean)
    const motivation = actor.motivation.slice(0, 2).join(' · ') || 'Motivation not stated'
    const sourceMeta = `${sourceCountLabel(sourceCount)} · latest ${formatDate(latestDate)} · ${sourceBasisLabel(actor.confidence)}`
    const captureMeta = actor.sourceCoverage.captureRows
        ? `${actor.sourceCoverage.captureRows} captured page${actor.sourceCoverage.captureRows === 1 ? '' : 's'}`
        : actor.sourceCoverage.missing.length
            ? 'capture evidence needed'
            : 'capture optional'
    const workflowSummary = [
        `${sourceCountLabel(sourceCount)} linked`,
        actionability.watchlistRelevance.terms.length ? `${actionability.watchlistRelevance.terms.length} watch terms` : 'watch term needed',
        actionability.relatedAlerts.length ? `${actionability.relatedAlerts.length} linked alerts` : actionability.alertGenerationReadiness.candidateCount ? `${actionability.alertGenerationReadiness.candidateCount} alert candidates` : 'watchlist before alert',
        actionability.relatedCases.length ? `${actionability.relatedCases.length} linked cases` : actionability.caseReviewIntake.summary.total ? `${actionability.caseReviewIntake.summary.total} case candidates` : 'case source needed',
    ].join(' · ')
    const facts = [
        {
            icon: <ShieldAlert className='h-4 w-4' />,
            label: 'Actor type',
            value: actor.actorClass || 'Actor class not stated',
            meta: motivation,
        },
        {
            icon: <Globe2 className='h-4 w-4' />,
            label: 'Targets',
            value: targets.length ? targets.join(' · ') : 'No target pattern yet',
            meta: actor.geographies.length ? `${actor.geographies.length} region${actor.geographies.length === 1 ? '' : 's'}` : `${actor.targetSectors.length} target pattern${actor.targetSectors.length === 1 ? '' : 's'}`,
        },
        {
            icon: <Activity className='h-4 w-4' />,
            label: 'Methods',
            value: methodNames.length ? methodNames.join(' · ') : 'No mapped method yet',
            meta: `${actor.techniqueCoverage.length} technique${actor.techniqueCoverage.length === 1 ? '' : 's'} mapped`,
        },
        {
            icon: <Database className='h-4 w-4' />,
            label: 'Source coverage',
            value: sourceMeta,
            meta: captureMeta,
        },
        {
            icon: <Clock3 className='h-4 w-4' />,
            label: 'Observed period',
            value: actor.firstSeen ? `${displayRequirementText(actor.firstSeen)} to ${formatDate(actor.lastSeen || latestDate)}` : `Updated ${formatDate(latestDate)}`,
            meta: actor.freshness.reason,
        },
    ] as const
    const review = {
        icon: <ClipboardList className='h-4 w-4' />,
        value: openGap ? displayRequirementText(openGap.title) : 'Profile has enough sources for review',
        meta: openGap ? sourceHealthFieldLabel(openGap.requestedFields[0] ?? 'source') : 'No open source question',
    }

    return (
        <section data-ti-actor-glance='true' data-ti-actor-highlights='true' className='rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>Actor summary</p>
                    <h2 className='mt-1 wrap-break-word text-base font-semibold text-ui-text dark:text-ui-text'>{actor.actorClass || 'Actor profile'}</h2>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Aliases: {aliases.length ? aliases.join(' · ') : 'No aliases in this actor profile'}{result.aliases.length > aliases.length ? ` · +${result.aliases.length - aliases.length} more` : ''}
                    </p>
                </div>
                <span className={sourceHealthChipClass(actor.sourceCoverage.stale ? 'review' : 'ready')}>
                    {actor.sourceCoverage.stale ? 'refresh recommended' : 'current source set'}
                </span>
            </div>
            <div data-ti-actor-summary-grid='true' className='mt-3 grid min-w-0 gap-2 sm:grid-cols-2'>
                {facts.map(fact => (
                    <ActorSummaryFact key={fact.label} icon={fact.icon} label={fact.label} value={fact.value} meta={fact.meta} />
                ))}
            </div>
            <div className='mt-3 grid min-w-0 gap-2 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>
                            <span className='shrink-0 text-ui-primary dark:text-ui-primary'>{review.icon}</span>
                            Next review
                        </p>
                        <p className='mt-1 wrap-break-word text-sm font-semibold leading-5 text-ui-text dark:text-ui-text'>{review.value}</p>
                    </div>
                    <span className={sourceHealthChipClass(openGap ? 'review' : 'ready')}>{openGap ? 'review' : 'ready'}</span>
                </div>
                <p className='wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{review.meta} · {workflowSummary}</p>
            </div>
            {techniques.length ? (
                <div className='mt-3 flex min-w-0 flex-wrap items-center gap-1.5'>
                    <span className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>ATT&CK</span>
                    {techniques.map(item => item.attackId ? (
                        <TechniqueBadge key={`${item.attackId}:${item.name}`} attackId={item.attackId} name={item.name} tactic={item.tactic} detail={item.detail} />
                    ) : (
                        <span key={`${item.name}:${item.tactic}`} className={sourceHealthChipClass(item.freshness)}>{displayRequirementText(item.name)}</span>
                    ))}
                </div>
            ) : null}
            {actor.provenanceRows.length ? (
                <p className='mt-3 wrap-break-word border-t border-ui-border pt-3 text-xs leading-5 text-ui-muted dark:border-ui-border dark:text-ui-muted'>
                    Sources used: {actor.provenanceRows.slice(0, 4).map(row => `${row.sourceName}${row.reportDate ? ` (${formatDate(row.reportDate)})` : ''}`).join(' · ')}
                </p>
            ) : null}
            {actor.confidenceReasoning.length ? (
                <div className='mt-3 border-t border-ui-border pt-3 dark:border-ui-border'>
                    <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Confidence basis</p>
                    <ul className='mt-1 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {actor.confidenceReasoning.slice(0, TI_DOSSIER_REASON_ROWS).map(item => (
                            <li key={item} className='wrap-break-word'>{displayRequirementText(item)}</li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </section>
    )
}
