import type { TiBusinessModelAssessment, TiBusinessModelObservation, TiSearchResponse } from '@/utils/ti/search'

type EvidenceState = 'loading' | 'error' | 'ready'

export function ActorBusinessModelEvidence({ model, sources, state = 'ready', error }: {
    model?: TiBusinessModelAssessment
    sources: TiSearchResponse['sources']
    state?: EvidenceState
    error?: string
}) {
    const sourceById = new Map(sources.map(source => [source.id, source]))
    const groups = [
        { label: 'Operating model', rows: [...(model?.extortionModels ?? []), ...(model?.monetizationPaths ?? []), ...(model?.advertisedProducts ?? []), ...(model?.advertisedData ?? [])] },
        { label: 'Pricing, payment and revenue', rows: [...(model?.pricingClaims ?? []), ...(model?.paymentClaims ?? []), ...(model?.revenueClaims ?? []), ...(model?.revenueShareClaims ?? [])] },
        { label: 'Communication channels and intermediary activity', rows: [...(model?.buyerSellerCommunications ?? []), ...(model?.intermediaryCommunications ?? []), ...(model?.communicationChannels ?? [])] },
        { label: 'Publicity and pressure', rows: [...(model?.publicationStrategies ?? []), ...(model?.publicityTactics ?? []), ...(model?.publicityEvents ?? []), ...(model?.pressureTactics ?? [])] },
    ].filter(group => group.rows.length)
    const observationCount = groups.reduce((count, group) => count + group.rows.length, 0)

    return (
        <section data-ti-business-model='true' data-state={state} className='min-w-0 border-t border-ui-border pt-4 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <h2 className='text-base font-semibold text-ui-text dark:text-ui-text'>Business model and communication</h2>
                    <p className='mt-1 max-w-3xl text-xs leading-5 text-ui-muted dark:text-ui-muted'>Explicit public reporting linked to stored claims and source evidence.</p>
                </div>
                <span className='text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                    {state === 'loading' ? 'Checking evidence' : state === 'error' ? 'Unavailable' : `${observationCount} finding${observationCount === 1 ? '' : 's'}`}
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
                    {model ? <ProfitabilitySummary model={model} sourceById={sourceById} /> : null}
                </>
            ) : (
                <div className='mt-3 min-w-0 border-l-2 border-ui-border pl-3'>
                    <p className='text-sm font-semibold text-ui-text dark:text-ui-text'>No explicit business-model or communication evidence found.</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>Pricing, payment, buyer communication, intermediary activity, and realized profit remain unknown until source evidence is collected.</p>
                </div>
            )}

            {state === 'ready' && model ? (
                <div className='mt-4 grid min-w-0 gap-2 border-t border-ui-border pt-3 text-xs leading-5 text-ui-muted dark:border-ui-border dark:text-ui-muted'>
                    <p className='wrap-break-word'>{model.evidenceBoundary}</p>
                    {model.missingEvidence.length ? <p className='wrap-break-word'><span className='font-semibold text-ui-text dark:text-ui-text'>Still unknown:</span> {model.missingEvidence.join('; ')}.</p> : null}
                </div>
            ) : null}
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
                <span>{sourceCount} source{sourceCount === 1 ? '' : 's'}</span>
                <span>{evidenceCount} evidence record{evidenceCount === 1 ? '' : 's'}</span>
                {row.lastSeenAt ? <span>Updated {formatDate(row.lastSeenAt)}</span> : null}
            </div>
            {evidence.map((item, index) => {
                const source = sourceById.get(item.sourceId)
                const href = safeHref(item.url || source?.url)
                return (
                    <blockquote key={`${item.captureId}:${index}`} className='mt-2 min-w-0 border-l-2 border-ui-primary/45 pl-3'>
                        <p className='wrap-break-word text-xs leading-5 text-ui-text dark:text-ui-text'>&quot;{item.excerpt}&quot;</p>
                        <footer className='mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ui-muted dark:text-ui-muted'>
                            {href ? <a href={href} target='_blank' rel='noopener noreferrer' className='wrap-break-word font-semibold text-ui-primary hover:underline'>{source?.name || 'Open source'}</a> : <span>{source?.name || item.sourceId}</span>}
                            {item.collectedAt ? <span>Collected {formatDate(item.collectedAt)}</span> : null}
                            <span className='wrap-break-word'>Capture {item.captureId}</span>
                        </footer>
                    </blockquote>
                )
            })}
            {!evidence.length ? <p className='mt-2 text-xs text-ui-warning dark:text-ui-warning'>The persisted claim has no displayable source excerpt.</p> : null}
        </article>
    )
}

function ProfitabilitySummary({ model, sourceById }: {
    model: TiBusinessModelAssessment
    sourceById: Map<string, TiSearchResponse['sources'][number]>
}) {
    const conclusion = model.profitabilityConclusion
    return (
        <section className='mt-5 min-w-0 border-t border-ui-border pt-4 dark:border-ui-border'>
            <h3 className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Profitability</h3>
            <p className='mt-2 text-sm font-semibold text-ui-text dark:text-ui-text'>{conclusion?.status === 'profitability_reported' ? 'Reported profitability statement' : conclusion?.status === 'revenue_reported' ? 'Reported revenue, profit unknown' : 'Profitability unknown'}</p>
            <p className='mt-1 max-w-3xl text-xs leading-5 text-ui-muted dark:text-ui-muted'>{conclusion?.summary || 'No source evidence establishes realized revenue or profit.'}</p>
            {model.profitabilitySignals.length ? <div className='mt-3 grid min-w-0 gap-3 lg:grid-cols-2'>{model.profitabilitySignals.map((row, index) => <BusinessEvidenceRow key={`${row.value}:${index}`} row={row} sourceById={sourceById} />)}</div> : null}
        </section>
    )
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
    return value && /^https?:\/\//i.test(value) ? value : undefined
}
