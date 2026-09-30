'use client'

import { sourceHealthChipClass } from '../pageClientShared'
import { displayRequirementText } from '../pageModel'
import { TiSearchResponse } from '@/utils/ti/search'

export default function EvidenceBoundaryStrip({ result }: { result: TiSearchResponse }) {
    const assessment = result.evidenceAssessment
    const sourceCount = assessment?.sourceCount ?? new Set(result.sources.map(source => source.id)).size
    const captureCount = assessment?.captureCount ?? result.recentActivity.length
    const claims = result.claims ?? []
    const incidents = result.incidents ?? []
    const reviewCount = claims.filter(claim => ['unreviewed', 'needs_review'].includes(claim.reviewState)).length
        + incidents.filter(incident => incident.reviewState !== 'confirmed').length
    const reviewMeasured = Boolean(assessment || claims.length || incidents.length)
    const contradicted = assessment?.contradictedClaimCount ?? claims.filter(claim => claim.corroborationState === 'contradicted').length
    const rejected = assessment?.rejectedClaimCount ?? claims.filter(claim => claim.reviewState === 'rejected').length
    const stale = assessment?.staleClaimCount ?? 0
    const missing = assessment?.missingFields ?? result.actorIntelligence?.missingFields ?? []
    const facts = [
        { label: 'Observed evidence', value: `${captureCount} captured record${captureCount === 1 ? '' : 's'}` },
        { label: 'Source claims', value: `${claims.length} claim${claims.length === 1 ? '' : 's'}` },
        { label: 'Inferred incidents', value: `${incidents.length} candidate${incidents.length === 1 ? '' : 's'}` },
        { label: 'Independent sources', value: `${sourceCount} source${sourceCount === 1 ? '' : 's'}` },
        { label: 'Parser / review', value: [
            reviewCount ? `${reviewCount} need review` : reviewMeasured ? 'No open review' : 'Review state pending',
            rejected ? `${rejected} rejected` : '',
            stale ? `${stale} stale` : '',
        ].filter(Boolean).join(' · ') },
    ]

    return (
        <section data-ti-evidence-boundary='true' className='grid gap-3 border-y border-ui-border py-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>Evidence boundary</p>
                    <p className='mt-1 max-w-4xl text-xs leading-5 text-ui-muted dark:text-ui-muted'>Captured matches are observed evidence. Source statements remain claims. Incident records and profile conclusions are parser or analyst inferences until review and independent corroboration.</p>
                </div>
                <span className={sourceHealthChipClass(contradicted || rejected ? 'blocked' : assessment?.ready ? 'ready' : 'review')}>{contradicted ? `${contradicted} contradicted` : rejected ? `${rejected} rejected` : stale ? `${stale} stale` : assessment?.ready ? 'reviewed evidence' : 'partial evidence'}</span>
            </div>
            <div className='grid grid-cols-2 gap-3 md:grid-cols-5'>
                {facts.map(fact => (
                    <div key={fact.label} className='min-w-0 border-l border-ui-border pl-2 dark:border-ui-border'>
                        <p className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{fact.label}</p>
                        <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{fact.value}</p>
                    </div>
                ))}
            </div>
            {missing.length ? <p className='text-xs leading-5 text-ui-muted dark:text-ui-muted'><span className='font-semibold text-ui-text dark:text-ui-text'>Missing:</span> {missing.map(displayRequirementText).join(', ')}</p> : null}
        </section>
    )
}
