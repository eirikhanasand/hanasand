import type { TiActorCaseStudyCatalog, TiBusinessModelAssessment, TiBusinessModelObservation, TiSearchResponse } from '@/utils/ti/search'

type EvidenceState = 'loading' | 'error' | 'ready'

export function ActorBusinessModelEvidence({ model, sources, caseStudies, state = 'ready', error }: {
    model?: TiBusinessModelAssessment
    sources: TiSearchResponse['sources']
    caseStudies?: TiActorCaseStudyCatalog
    state?: EvidenceState
    error?: string
}) {
    const sourceById = new Map(sources.map(source => [source.id, source]))
    const groups = [
        { label: 'Operating model', rows: [...(model?.extortionModels ?? []), ...(model?.monetizationPaths ?? []), ...(model?.advertisedProducts ?? []), ...(model?.advertisedData ?? [])] },
        { label: 'Pricing', rows: model?.pricingClaims ?? [] },
        { label: 'Negotiation', rows: model?.negotiationClaims ?? [] },
        { label: 'Payment', rows: model?.paymentClaims ?? [] },
        { label: 'Revenue and profitability evidence', rows: [...(model?.revenueClaims ?? []), ...(model?.profitabilitySignals ?? [])] },
        { label: 'Affiliate and revenue-share terms', rows: model?.revenueShareClaims ?? [] },
        { label: 'Communication channels', rows: model?.communicationChannels ?? [] },
        { label: 'Buyer or victim communication', rows: model?.buyerSellerCommunications ?? [] },
        { label: 'Intermediary communication', rows: model?.intermediaryCommunications ?? [] },
        { label: 'Publicity and pressure', rows: [...(model?.publicationStrategies ?? []), ...(model?.publicityTactics ?? []), ...(model?.publicityEvents ?? []), ...(model?.pressureTactics ?? [])] },
    ].filter(group => group.rows.length)
    const observationCount = groups.reduce((count, group) => count + group.rows.length, 0)
    const pendingFindings = model?.pendingFindings ?? []

    return (
        <section data-ti-business-model='true' data-state={state} className='min-w-0 border-t border-ui-border pt-4 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <h2 className='text-base font-semibold text-ui-text dark:text-ui-text'>Business model and communication</h2>
                    <p className='mt-1 max-w-3xl text-xs leading-5 text-ui-muted dark:text-ui-muted'>Current reviewed findings linked to an exact retained claim and evidence chain.</p>
                </div>
                <span className='text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                    {state === 'loading' ? 'Checking evidence' : state === 'error' ? 'Unavailable' : `${observationCount} reviewed finding${observationCount === 1 ? '' : 's'}`}
                </span>
            </div>

            {state === 'loading' ? (
                <p className='mt-3 border-l-2 border-ui-primary pl-3 text-sm text-ui-muted dark:text-ui-muted'>Searching retained claims and evidence.</p>
            ) : state === 'error' ? (
                <p role='alert' className='mt-3 border-l-2 border-ui-danger pl-3 text-sm text-ui-danger'>{error || 'Business-model evidence is temporarily unavailable.'}</p>
            ) : observationCount ? (
                <>
                    <div className='mt-4 grid min-w-0 gap-x-6 gap-y-5 lg:grid-cols-2'>
                        {groups.map(group => (
                            <section key={group.label} className='min-w-0'>
                                <h3 className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>{group.label}</h3>
                                <div className='mt-2 grid min-w-0 gap-3'>
                                    {group.rows.map((row, index) => (
                                        <BusinessEvidenceRow key={`${group.label}:${row.value}:${index}`} row={row} sourceById={sourceById} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </>
            ) : (
                <div className='mt-3 min-w-0 border-l-2 border-ui-border pl-3'>
                    <p className='text-sm font-semibold text-ui-text dark:text-ui-text'>No reviewed business-model or communication finding.</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>Unsupported lanes remain unknown. Pending findings below are not case-study evidence.</p>
                </div>
            )}

            {state === 'ready' && model ? <ProfitabilitySummary model={model} /> : null}
            {state === 'ready' && pendingFindings.length ? (
                <section className='mt-5 min-w-0 border-t border-ui-border pt-4 dark:border-ui-border'>
                    <h3 className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Pending findings — not case-study evidence</h3>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>These actor-scoped findings still require current confirming review.</p>
                    <div className='mt-2 grid min-w-0 gap-3 lg:grid-cols-2'>
                        {pendingFindings.map((row, index) => <BusinessEvidenceRow key={`pending:${row.value}:${index}`} row={row} sourceById={sourceById} />)}
                    </div>
                </section>
            ) : null}

            {state === 'ready' && model ? (
                <div className='mt-4 grid min-w-0 gap-2 border-t border-ui-border pt-3 text-xs leading-5 text-ui-muted dark:border-ui-border dark:text-ui-muted'>
                    <p className='wrap-break-word'>{model.evidenceBoundary}</p>
                    {model.missingEvidence.length ? <p className='wrap-break-word'><span className='font-semibold text-ui-text dark:text-ui-text'>Still unknown:</span> {model.missingEvidence.join('; ')}.</p> : null}
                </div>
            ) : null}

            {caseStudies ? <ActorCaseStudyIndex catalog={caseStudies} /> : null}
        </section>
    )
}

function BusinessEvidenceRow({ row, sourceById }: {
    row: TiBusinessModelObservation
    sourceById: Map<string, TiSearchResponse['sources'][number]>
}) {
    const evidence = row.evidence ?? []
    const sourceCount = row.sourceCount ?? row.sourceIds.length
    const evidenceCount = row.evidenceCount ?? evidence.length
    return (
        <article className='min-w-0 border-t border-ui-border pt-3 dark:border-ui-border'>
            <p className='wrap-break-word text-sm font-semibold leading-5 text-ui-text dark:text-ui-text'>{row.value}</p>
            <div className='mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>
                <span>{evidenceKindLabel(row.evidenceKind || row.assertionKind)}</span>
                <span>{reviewStateLabel(row.reviewState)}</span>
                <span>{row.reviewState === 'confirmed'
                    ? `${sourceCount} independent source${sourceCount === 1 ? '' : 's'}`
                    : `${row.sourceIds.length} source record${row.sourceIds.length === 1 ? '' : 's'}`}</span>
                <span>{evidenceCount} evidence record{evidenceCount === 1 ? '' : 's'}</span>
                {row.lastPublishedAt ? <span>Last published {formatDate(row.lastPublishedAt)}</span> : null}
                {row.lastCollectedAt ? <span>Last collected {formatDate(row.lastCollectedAt)}</span> : null}
            </div>
            {evidence.map((item, index) => {
                const source = sourceById.get(item.sourceId)
                const href = safeHref(item.url || source?.url)
                return (
                    <blockquote key={`${item.captureId}:${index}`} className='mt-2 min-w-0 border-l-2 border-ui-primary/45 pl-3'>
                        <p className='wrap-break-word text-xs leading-5 text-ui-text dark:text-ui-text'>&quot;{item.excerpt}&quot;</p>
                        <footer className='mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ui-muted dark:text-ui-muted'>
                            {href ? <a href={href} target='_blank' rel='noopener noreferrer' className='wrap-break-word font-semibold text-ui-primary hover:underline'>{source?.name || 'Open source'}</a> : <span>{source?.name || item.sourceId}</span>}
                            {item.publishedAt ? <span>Published {formatDate(item.publishedAt)}</span> : null}
                            {item.collectedAt ? <span>Collected {formatDate(item.collectedAt)}</span> : null}
                            <span className='wrap-break-word'>Capture {item.captureId}</span>
                            {item.claimId ? <span className='wrap-break-word'>Claim {item.claimId}</span> : null}
                        </footer>
                    </blockquote>
                )
            })}
            {!evidence.length ? <p className='mt-2 text-xs text-ui-warning dark:text-ui-warning'>The persisted claim has no displayable source excerpt.</p> : null}
        </article>
    )
}

function ProfitabilitySummary({ model }: { model: TiBusinessModelAssessment }) {
    const conclusion = model.profitabilityConclusion
    return (
        <section className='mt-5 min-w-0 border-t border-ui-border pt-4 dark:border-ui-border'>
            <h3 className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Profitability</h3>
            <p className='mt-2 text-sm font-semibold text-ui-text dark:text-ui-text'>{conclusion?.status === 'profitability_reported' ? 'Reported profitability statement' : conclusion?.status === 'revenue_reported' ? 'Reported revenue, profit unknown' : 'Profitability unknown'}</p>
            <p className='mt-1 max-w-3xl text-xs leading-5 text-ui-muted dark:text-ui-muted'>{conclusion?.summary || 'No source evidence establishes realized revenue or profit.'}</p>
        </section>
    )
}

function ActorCaseStudyIndex({ catalog }: { catalog: TiActorCaseStudyCatalog }) {
    const currentCase = catalog.cases[0]
    return (
        <section data-ti-actor-case-studies='true' className='mt-5 min-w-0 border-t border-ui-border pt-4 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-end justify-between gap-3'>
                <div className='min-w-0'>
                    <h3 className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Reviewed actor case</h3>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Corpus-wide: {catalog.caseStudyCount} reviewed multi-category case stud{catalog.caseStudyCount === 1 ? 'y' : 'ies'} across {catalog.supportedActorCount} actors. {catalog.pendingFindingCount ?? 0} findings remain pending and are not counted.
                    </p>
                </div>
                <span className='text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>
                    {catalog.actorClassCounts.ransomwareOrExtortion} ransomware/extortion · {catalog.actorClassCounts.aptOrIntrusionSet} APT/intrusion-set
                </span>
            </div>
            {currentCase ? (
                <div className='mt-3 min-w-0 border-t border-ui-border py-3 dark:border-ui-border'>
                    <div className='flex min-w-0 items-center justify-between gap-2'>
                        <span className='truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{currentCase.actor}</span>
                        <span className='shrink-0 text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>{currentCase.findingCount} reviewed findings</span>
                    </div>
                    <div className='mt-2 flex min-w-0 flex-wrap gap-1'>
                        {currentCase.categories.map(category => <span key={category} className='rounded-md bg-ui-raised px-1.5 py-0.5 text-[10px] font-semibold text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>{caseCategoryLabel(category)}</span>)}
                    </div>
                    <p className='mt-2 text-[11px] text-ui-muted dark:text-ui-muted'>
                        {currentCase.sourceCount} independent source{currentCase.sourceCount === 1 ? '' : 's'} · {currentCase.evidenceCount} exact reviewed evidence record{currentCase.evidenceCount === 1 ? '' : 's'}
                        {currentCase.lastPublishedAt ? ` · last published ${formatDate(currentCase.lastPublishedAt)}` : ''}
                        {currentCase.lastCollectedAt ? ` · last collected ${formatDate(currentCase.lastCollectedAt)}` : ''}
                    </p>
                </div>
            ) : <p className='mt-3 text-sm text-ui-muted dark:text-ui-muted'>This actor has no current reviewed evidence in two separate analysis categories.</p>}
            <p className='mt-3 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{catalog.qualification}</p>
            {catalog.missingContexts.length ? <p className='mt-1 text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>Not represented by current retained evidence: {catalog.missingContexts.join('; ')}.</p> : null}
        </section>
    )
}

function caseCategoryLabel(value: string) {
    return ({
        advertised_offering: 'Advertised offering',
        buyer_victim_communication: 'Buyer/victim communication',
        communication_channel: 'Communication channel',
        economic_outcome: 'Revenue/profitability',
        intermediary_communication: 'Intermediary',
        negotiation: 'Negotiation',
        operating_model: 'Operating model',
        payment: 'Payment',
        pricing: 'Pricing',
        publicity: 'Publicity',
    } as Record<string, string>)[value] ?? value.replaceAll('_', ' ')
}

function evidenceKindLabel(value: string) {
    if (value === 'third_party_report') return 'Third-party report'
    if (value === 'actor_claim') return 'Source statement'
    if (value === 'analytical_inference' || value === 'inferred') return 'Analytical inference'
    return 'Observed evidence'
}

function reviewStateLabel(value: string) {
    return value === 'needs_review' ? 'Needs review' : value.replaceAll('_', ' ')
}

function formatDate(value: string) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10)
}

function safeHref(value?: string) {
    if (!value) return undefined
    try {
        const parsed = new URL(value)
        const host = parsed.hostname.toLowerCase()
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return undefined
        if (host === 'localhost' || host.endsWith('.local') || /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)) return undefined
        if (['t.me', 'telegram.me', 'telegram.dog'].includes(host)) return undefined
        return parsed.toString()
    } catch {
        return undefined
    }
}
