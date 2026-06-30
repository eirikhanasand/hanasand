import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { AlertCircle, CheckCircle2, CircleDashed, Clock3, ExternalLink } from 'lucide-react'
import { buildProductNorthStarScoreboard, parseProductNorthStarScoreboard, type ProductNorthStarDeployBlocker, type ProductNorthStarDirection, type ProductNorthStarProgressSource, type ProductNorthStarRow, type ProductNorthStarScoreboard } from '@/utils/productProgress/northStar'
import { buildRouteMetadata } from '../seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Product Readiness',
    description: 'Operational readiness for Hanasand threat monitoring, alerts, delivery, analyst workflow, and support audit.',
    path: '/readiness',
    keywords: ['product readiness', 'threat monitoring readiness', 'DWM readiness'],
})

export default async function Page({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const query = firstParam(params?.q) || 'watchlist terms'
    const Headers = await headers()
    const generatedAt = new Date().toISOString()
    const scoreboard = await loadProductReadiness(Headers, query) || buildProductNorthStarScoreboard(null, { generatedAt, query })
    const stateTone = scoreboard.fullChainReady
        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] dark:border-[#246b42] dark:bg-[#10251b] dark:text-[#a7f3d0]'
        : 'border-[#fed7aa] bg-[#fff7ed] text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] px-4 py-8 text-[#171a21] dark:bg-[#08111f] dark:text-[#f5f7fb] md:px-8'>
            <section className='mx-auto flex w-full max-w-7xl flex-col gap-5'>
                <div className='rounded-xl border border-[#d9e2ef] bg-white p-5 shadow-sm dark:border-[#26364f] dark:bg-[#101927]'>
                    <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
                        <div className='max-w-3xl'>
                            <p className='text-xs font-semibold uppercase tracking-[0.08em] text-[#3056d3] dark:text-[#9db6ff]'>Product readiness</p>
                            <h1 className='mt-2 text-3xl font-semibold tracking-normal text-[#171a21] dark:text-white'>Threat monitoring readiness</h1>
                            <p className='mt-3 max-w-2xl text-sm leading-6 text-[#596170] dark:text-[#b9c4d6]'>
                                This page reads the same readiness contract used by the console. A row stays non-ready until the named backend contract is loaded, fresh, and tied to a workflow.
                            </p>
                        </div>
                        <div className='grid gap-2 sm:grid-cols-2 lg:min-w-[560px] lg:grid-cols-4'>
                            <SummaryBox label='Rows ready' value={`${scoreboard.readyRows}/${scoreboard.totalRows}`} />
                            <SummaryBox label='Checked' value={formatChecked(scoreboard.generatedAt)} />
                            <SummaryBox label='Proof source' value={stateLabel(scoreboard.progressSource.state)} />
                            <div className={`rounded-lg border px-3 py-2 ${stateTone}`}>
                                <p className='text-[11px] font-semibold uppercase'>Release gate</p>
                                <p className='mt-1 text-sm font-semibold'>{scoreboard.fullChainReady ? 'ready' : 'blocked'}</p>
                            </div>
                        </div>
                    </div>
                    <ProgressSourcePanel source={scoreboard.progressSource} />
                    <ProductReadinessAggregatePanel scoreboard={scoreboard} />
                    {scoreboard.firstBlocker && (
                        <div className='mt-4 flex items-start gap-2 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-sm text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'>
                            <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
                            <span>{scoreboard.firstBlocker}</span>
                        </div>
                    )}
                </div>

                <DeployGatePanel scoreboard={scoreboard} />

                <section className='rounded-xl border border-[#d9e2ef] bg-white p-5 shadow-sm dark:border-[#26364f] dark:bg-[#101927]'>
                    <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
                        <div>
                            <p className='text-xs font-semibold uppercase tracking-[0.08em] text-[#3056d3] dark:text-[#9db6ff]'>Readiness groups</p>
                            <h2 className='mt-2 text-xl font-semibold text-[#171a21] dark:text-white'>Operational evidence</h2>
                        </div>
                        <p className='max-w-2xl text-sm leading-6 text-[#596170] dark:text-[#b9c4d6]'>
                            Each group is derived from readiness rows. Missing evidence shows the owner, blocker, and contract instead of a ready state.
                        </p>
                    </div>
                    <div className='mt-5 grid gap-3 lg:grid-cols-5'>
                        {scoreboard.direction.map(item => (
                            <DirectionCard key={item.id} item={item} />
                        ))}
                    </div>
                </section>

                <div className='grid gap-3 lg:grid-cols-3'>
                    {scoreboard.rows.map(row => (
                        <ReadinessCard key={row.id} row={row} />
                    ))}
                </div>
            </section>
        </main>
    )
}

function ProductReadinessAggregatePanel({ scoreboard }: { scoreboard: ProductNorthStarScoreboard }) {
    const source = scoreboard.productReadinessAggregate
    const tone = source.state === 'ready'
        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] dark:border-[#246b42] dark:bg-[#10251b] dark:text-[#a7f3d0]'
        : source.state === 'blocked'
            ? 'border-[#fecaca] bg-[#fff1f2] text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#2a1114] dark:text-[#fca5a5]'
            : source.state === 'needs_action'
                ? 'border-[#fed7aa] bg-[#fff7ed] text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'
                : 'border-[#d9e2ef] bg-[#f8fafc] text-[#475467] dark:border-[#26364f] dark:bg-[#0b1422] dark:text-[#b9c4d6]'

    return (
        <section
            className='mt-4 rounded-lg border border-[#e4eaf2] bg-[#fbfcfe] px-3 py-3 text-sm dark:border-[#26364f] dark:bg-[#0b1422]'
            data-north-star-readiness-ledger='true'
            data-north-star-readiness-ledger-state={source.state}
            data-north-star-readiness-ledger-source={source.source}
            data-north-star-readiness-ledger-schema-version={source.schemaVersion}
            data-north-star-readiness-ledger-checked-at={source.checkedAt}
            data-north-star-readiness-ledger-row-count={source.rowCount}
            data-north-star-readiness-ledger-customer-visible-blocked-count={source.customerVisibleBlockedCount}
            data-north-star-readiness-ledger-deploy-risk={source.deployRisk}
            data-north-star-readiness-ledger-stale={source.stale ? 'true' : 'false'}
            data-north-star-readiness-ledger-age-seconds={source.ageSeconds}
            data-north-star-readiness-ledger-stale-after-seconds={source.staleAfterSeconds}
            data-north-star-readiness-ledger-unavailable-reason={source.unavailableReason || ''}
        >
            <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]'>
                <div className='min-w-0'>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085] dark:text-[#97a6bd]'>Product readiness ledger</p>
                    <p className='mt-1 wrap-break-word font-semibold text-[#171a21] dark:text-white'>{source.source}</p>
                    <p className='mt-1 text-xs leading-5 text-[#596170] dark:text-[#b9c4d6]'>
                        This optional aggregate reads the hanasand.product_readiness.v1 artifact. It does not make rows ready unless their backend proof rows are loaded.
                    </p>
                </div>
                <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-1'>
                    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
                        <p className='text-[11px] font-semibold uppercase'>Ledger state</p>
                        <p className='mt-1 text-sm font-semibold'>{stateLabel(source.state)}</p>
                    </div>
                    <SummaryBox label='Blocked rows' value={`${source.customerVisibleBlockedCount}/${source.rowCount}`} />
                    <SummaryBox label='Age' value={source.checkedAt ? formatDuration(source.ageSeconds) : 'not loaded'} />
                    <SummaryBox label='Stale after' value={formatDuration(source.staleAfterSeconds)} />
                </div>
            </div>
            {source.unavailableReason && (
                <p className='mt-3 rounded-lg border border-[#d9e2ef] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#475467] dark:border-[#26364f] dark:bg-[#0b1422] dark:text-[#b9c4d6]'>
                    {source.unavailableReason}
                </p>
            )}
            {source.blockingRows.length > 0 && (
                <div className='mt-3 grid gap-2 lg:grid-cols-2'>
                    {source.blockingRows.map(row => (
                        <div
                            key={row.id}
                            className='min-w-0 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs leading-5 text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'
                            data-north-star-readiness-ledger-blocker-id={row.id}
                            data-north-star-readiness-ledger-blocker-owner-lane={row.ownerLane}
                            data-north-star-readiness-ledger-blocker-state={row.state}
                            data-north-star-readiness-ledger-blocker-last-checked-at={row.lastCheckedAt}
                            data-north-star-readiness-ledger-blocker-last-checked-age-seconds={row.lastCheckedAgeSeconds}
                            data-north-star-readiness-ledger-blocker-last-checked-stale={row.lastCheckedStale ? 'true' : 'false'}
                            data-north-star-readiness-ledger-blocker-proof-schema-version={row.proofArtifactSchemaVersion}
                            data-north-star-readiness-ledger-blocker-proof-artifact-id={row.proofArtifactId}
                            data-north-star-readiness-ledger-blocker-route={row.route}
                            data-north-star-readiness-ledger-blocker-probe-id={row.probeId}
                            data-north-star-readiness-ledger-blocker-action={row.requiredNextAction}
                            data-north-star-readiness-ledger-blocker-deploy-risk={row.deployRisk}
                            data-north-star-readiness-ledger-blocker-ui-proof={row.uiQualityProofExists ? 'true' : 'false'}
                            data-north-star-readiness-ledger-blocker-workflow-route={row.workflowRoute}
                            data-north-star-readiness-ledger-blocker-workflow-proof-row-id={row.workflowProofRowId}
                            data-north-star-readiness-ledger-blocker-workflow-test={row.workflowTestName}
                            data-north-star-readiness-ledger-blocker-workflow-adapter={row.workflowExpectedAdapter}
                            data-north-star-readiness-ledger-blocker-workflow-command={row.workflowProofCommand}
                        >
                            <p className='font-semibold text-[#171a21] dark:text-white'>{row.label}</p>
                            <p className='mt-1 wrap-break-word'>{row.blockers.join(', ') || row.requiredNextAction}</p>
                            <dl className='mt-3 grid gap-2 rounded-lg border border-[#fed7aa] bg-white/55 px-3 py-2 text-[11px] leading-4 dark:border-[#7c3b16] dark:bg-black/10'>
                                <Fact label='Contract' value={row.proofArtifactSchemaVersion} />
                                <Fact label='Artifact' value={row.proofArtifactId} />
                                <Fact label='Probe' value={row.probeId || 'not loaded'} />
                                <Fact label='Risk' value={row.deployRisk || 'not loaded'} />
                                <Fact label='Checked' value={formatChecked(row.lastCheckedAt)} />
                                <Fact label='Row age' value={formatDuration(row.lastCheckedAgeSeconds)} />
                                <Fact label='Stale' value={row.lastCheckedStale ? 'yes' : 'no'} />
                                <Fact label='UI proof' value={row.uiQualityProofExists ? 'present' : 'not loaded'} />
                                <Fact label='Adapter' value={row.workflowExpectedAdapter || 'not loaded'} />
                            </dl>
                            {(row.workflowTestName || row.workflowProofCommand) && (
                                <dl className='mt-2 grid gap-2 rounded-lg border border-[#fed7aa] bg-white/55 px-3 py-2 text-[11px] leading-4 dark:border-[#7c3b16] dark:bg-black/10'>
                                    <Fact label='Test' value={row.workflowTestName || 'not loaded'} />
                                    <Fact label='Command' value={row.workflowProofCommand || 'not loaded'} />
                                </dl>
                            )}
                            <div className='mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                                <p className='min-w-0 wrap-break-word text-[11px] leading-4'>{row.workflowRoute || row.route || 'No backed route returned.'}</p>
                                {localRoute(row.route) ? (
                                    <Link href={row.route} className='inline-flex min-h-9 min-w-32 w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-[#fed7aa] px-3 py-1.5 text-xs font-semibold text-[#9a3412] transition hover:bg-[#ffedd5] focus:outline-none focus:ring-2 focus:ring-[#fdba74] dark:border-[#7c3b16] dark:text-[#fdba74] dark:hover:bg-[#3a1d0c]'>
                                        Open route
                                        <ExternalLink className='h-3.5 w-3.5' />
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}

function ProgressSourcePanel({ source }: { source: ProductNorthStarProgressSource }) {
    const tone = source.state === 'ready'
        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] dark:border-[#246b42] dark:bg-[#10251b] dark:text-[#a7f3d0]'
        : source.state === 'blocked'
            ? 'border-[#fecaca] bg-[#fff1f2] text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#2a1114] dark:text-[#fca5a5]'
            : source.state === 'needs_action'
                ? 'border-[#fed7aa] bg-[#fff7ed] text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'
                : 'border-[#d9e2ef] bg-[#f8fafc] text-[#475467] dark:border-[#26364f] dark:bg-[#0b1422] dark:text-[#b9c4d6]'

    return (
        <section
            className='mt-4 grid gap-3 rounded-lg border border-[#e4eaf2] bg-[#fbfcfe] px-3 py-3 text-sm dark:border-[#26364f] dark:bg-[#0b1422] md:grid-cols-[minmax(0,1fr)_auto]'
            data-north-star-progress-source='true'
            data-north-star-progress-source-state={source.state}
            data-north-star-progress-source-route={source.route}
            data-north-star-progress-source-status={source.status ?? ''}
            data-north-star-progress-source-reason={source.unavailableReason || ''}
            data-north-star-progress-source-contract={source.backendProofContractVersion}
            data-north-star-progress-source-timestamp={source.proofTimestamp}
        >
            <div className='min-w-0'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085] dark:text-[#97a6bd]'>Readiness source</p>
                <p className='mt-1 wrap-break-word font-semibold text-[#171a21] dark:text-white'>{source.route}</p>
                <p className='mt-1 wrap-break-word text-xs leading-5 text-[#596170] dark:text-[#b9c4d6]'>{source.integrationProbeHint}</p>
            </div>
            <div className='grid gap-2 sm:grid-cols-3 md:min-w-[26rem]'>
                <div className={`rounded-lg border px-3 py-2 ${tone}`}>
                    <p className='text-[11px] font-semibold uppercase'>State</p>
                    <p className='mt-1 text-sm font-semibold'>{stateLabel(source.state)}</p>
                </div>
                <SummaryBox label='HTTP' value={typeof source.status === 'number' ? String(source.status) : 'not loaded'} />
                <SummaryBox label='Contract' value={source.backendProofContractVersion} />
            </div>
            {source.unavailableReason && (
                <p className='md:col-span-2 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs leading-5 text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'>
                    {source.unavailableReason}
                </p>
            )}
        </section>
    )
}

function DeployGatePanel({ scoreboard }: { scoreboard: ProductNorthStarScoreboard }) {
    const blockers = scoreboard.deployGate.blockingProofRows
    return (
        <section
            className='rounded-xl border border-[#d9e2ef] bg-white p-5 shadow-sm dark:border-[#26364f] dark:bg-[#101927]'
            data-north-star-deploy-gate='true'
            data-north-star-deploy-state={scoreboard.deployGate.state}
            data-north-star-deploy-ready-rows={scoreboard.deployGate.readyRows}
            data-north-star-deploy-total-rows={scoreboard.deployGate.totalRows}
            data-north-star-deploy-blocking-rows={blockers.map(row => row.rowId).join(',')}
        >
            <div className='flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between'>
                <div>
                    <p className='text-xs font-semibold uppercase tracking-[0.08em] text-[#3056d3] dark:text-[#9db6ff]'>Release blockers</p>
                    <h2 className='mt-2 text-xl font-semibold text-[#171a21] dark:text-white'>What still needs proof</h2>
                </div>
                <p className='max-w-2xl text-sm leading-6 text-[#596170] dark:text-[#b9c4d6]'>
                    The release gate is derived from backend contracts. A blocker disappears only when the linked proof row becomes ready.
                </p>
            </div>
            {scoreboard.deployGate.fullChainReady ? (
                <div className='mt-5 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm font-semibold text-[#166534] dark:border-[#246b42] dark:bg-[#10251b] dark:text-[#a7f3d0]'>
                    All readiness rows are backed by fresh proof.
                </div>
            ) : (
                <div className='mt-5 grid gap-3 lg:grid-cols-2'>
                    {blockers.map(row => (
                        <DeployBlockerCard key={row.rowId} row={row} />
                    ))}
                </div>
            )}
        </section>
    )
}

function DeployBlockerCard({ row }: { row: ProductNorthStarDeployBlocker }) {
    const tone = row.state === 'blocked'
        ? 'border-[#fecaca] bg-[#fff1f2] text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#2a1114] dark:text-[#fca5a5]'
        : row.state === 'needs_action'
            ? 'border-[#fed7aa] bg-[#fff7ed] text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'
            : 'border-[#d9e2ef] bg-[#f8fafc] text-[#475467] dark:border-[#26364f] dark:bg-[#0b1422] dark:text-[#b9c4d6]'
    const Icon = row.state === 'blocked' ? AlertCircle : row.state === 'needs_action' ? Clock3 : CircleDashed
    return (
        <article
            className='min-w-0 rounded-xl border border-[#d9e2ef] bg-[#fbfcfe] p-4 dark:border-[#26364f] dark:bg-[#0b1422]'
            data-north-star-blocker-row-id={row.rowId}
            data-north-star-blocker-state={row.state}
            data-north-star-blocker-owner-lane={row.ownerLane}
            data-north-star-blocker-proof-timestamp={row.proofTimestamp}
            data-north-star-blocker-stale-after-seconds={row.staleAfterSeconds}
            data-north-star-blocker-proof-age-seconds={row.proofAgeSeconds}
            data-north-star-blocker-proof-stale={row.proofStale ? 'true' : 'false'}
            data-north-star-blocker-contract={row.backendProofContractVersion}
            data-north-star-blocker-dashboard-row-id={row.expectedDashboardRowId}
            data-north-star-blocker-proof-drilldowns={row.proofDrilldowns.map(item => `${item.kind}:${item.value}`).join('|')}
        >
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <h3 className='wrap-break-word text-sm font-semibold text-[#171a21] dark:text-white'>{readableId(row.rowId)}</h3>
                    <p className='mt-1 text-xs font-semibold text-[#667085] dark:text-[#97a6bd]'>Owner: {row.ownerLane}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${tone}`}>
                    <Icon className='h-3.5 w-3.5' />
                    {stateLabel(row.state)}
                </span>
            </div>
            <p className='mt-3 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs leading-5 text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'>
                {row.blocker}
            </p>
            <dl className='mt-4 grid gap-2 text-xs'>
                <Fact label='Contract' value={row.backendProofContractVersion} />
                <Fact label='Checked' value={formatChecked(row.proofTimestamp)} />
                <Fact label='Age' value={formatDuration(row.proofAgeSeconds)} />
                <Fact label='Stale' value={row.proofStale ? 'yes' : 'no'} />
                <Fact label='Stale after' value={formatDuration(row.staleAfterSeconds)} />
                <Fact label='Row id' value={row.expectedDashboardRowId} />
            </dl>
            <ProofDrilldowns items={row.proofDrilldowns} scope={`blocker-${row.rowId}`} />
            <div className='mt-4 flex flex-col gap-3 border-t border-[#e4eaf2] pt-3 dark:border-[#26364f] sm:flex-row sm:items-center sm:justify-between'>
                <p className='min-w-0 wrap-break-word text-[11px] leading-4 text-[#667085] dark:text-[#97a6bd]'>{row.integrationProbeHint}</p>
                <Link href={row.href} className='inline-flex min-h-9 min-w-32 w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-[#d9e2ef] px-3 py-1.5 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] dark:border-[#34445f] dark:text-[#d8e0ee] dark:hover:bg-[#162238]'>
                    Inspect
                    <ExternalLink className='h-3.5 w-3.5' />
                </Link>
            </div>
        </article>
    )
}

function DirectionCard({ item }: { item: ProductNorthStarDirection }) {
    const tone = item.state === 'ready'
        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] dark:border-[#246b42] dark:bg-[#10251b] dark:text-[#a7f3d0]'
        : item.state === 'blocked'
            ? 'border-[#fecaca] bg-[#fff1f2] text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#2a1114] dark:text-[#fca5a5]'
            : item.state === 'needs_action'
                ? 'border-[#fed7aa] bg-[#fff7ed] text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'
                : 'border-[#d9e2ef] bg-[#f8fafc] text-[#475467] dark:border-[#26364f] dark:bg-[#0b1422] dark:text-[#b9c4d6]'
    const Icon = item.state === 'ready' ? CheckCircle2 : item.state === 'blocked' ? AlertCircle : item.state === 'needs_action' ? Clock3 : CircleDashed
    return (
        <article
            className='flex min-w-0 flex-col rounded-xl border border-[#d9e2ef] bg-[#fbfcfe] p-4 dark:border-[#26364f] dark:bg-[#0b1422]'
            data-north-star-direction-id={item.id}
            data-north-star-direction-state={item.state}
            data-north-star-direction-backed-rows={item.backedRowIds.join(',')}
            data-north-star-direction-owner-lanes={item.ownerLanes.join(',')}
        >
            <div className='flex items-start justify-between gap-3'>
                <h3 className='wrap-break-word text-sm font-semibold text-[#171a21] dark:text-white'>{item.label}</h3>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${tone}`}>
                    <Icon className='h-3.5 w-3.5' />
                    {stateLabel(item.state)}
                </span>
            </div>
            <p className='mt-3 wrap-break-word text-sm leading-5 text-[#596170] dark:text-[#b9c4d6]'>{item.detail}</p>
            <dl className='mt-4 grid gap-2 text-xs'>
                <Fact label='Owner' value={item.ownerLanes.join(', ') || 'not loaded'} />
                <Fact label='Rows' value={item.backedRowIds.join(', ')} />
                <Fact label='Contracts' value={item.proofSummary} />
            </dl>
            {item.blocker && (
                <p className='mt-3 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs leading-5 text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'>
                    {item.blocker}
                </p>
            )}
            <Link href={item.href} className='mt-4 inline-flex min-h-9 min-w-36 w-fit items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-[#d9e2ef] px-3 py-1.5 text-xs font-semibold text-[#3056d3] transition hover:bg-[#f2f5f9] hover:text-[#1d3fb0] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] dark:border-[#34445f] dark:text-[#9db6ff] dark:hover:bg-[#162238] dark:hover:text-white'>
                Open workflow
                <ExternalLink className='h-3.5 w-3.5' />
            </Link>
        </article>
    )
}

function SummaryBox({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#d9e2ef] bg-[#fbfcfe] px-3 py-2 dark:border-[#26364f] dark:bg-[#0b1422]'>
            <p className='text-[11px] font-semibold uppercase text-[#667085] dark:text-[#97a6bd]'>{label}</p>
            <p className='mt-1 text-sm font-semibold text-[#171a21] dark:text-white'>{value}</p>
        </div>
    )
}

function ReadinessCard({ row }: { row: ProductNorthStarRow }) {
    const tone = row.state === 'ready'
        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] dark:border-[#246b42] dark:bg-[#10251b] dark:text-[#a7f3d0]'
        : row.state === 'blocked'
            ? 'border-[#fecaca] bg-[#fff1f2] text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#2a1114] dark:text-[#fca5a5]'
            : row.state === 'needs_action'
                ? 'border-[#fed7aa] bg-[#fff7ed] text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'
                : 'border-[#d9e2ef] bg-[#f8fafc] text-[#475467] dark:border-[#26364f] dark:bg-[#0b1422] dark:text-[#b9c4d6]'
    const Icon = row.state === 'ready' ? CheckCircle2 : row.state === 'blocked' ? AlertCircle : row.state === 'needs_action' ? Clock3 : CircleDashed
    return (
        <article
            className='min-w-0 rounded-xl border border-[#d9e2ef] bg-white p-4 shadow-sm dark:border-[#26364f] dark:bg-[#101927]'
            data-north-star-row-id={row.id}
            data-north-star-state={row.state}
            data-north-star-owner-lane={row.ownerLane}
            data-north-star-proof-timestamp={row.proofTimestamp}
            data-north-star-backend-proof-contract-version={row.backendProofContractVersion}
            data-north-star-stale-after-seconds={row.staleAfterSeconds}
            data-north-star-proof-age-seconds={row.proofAgeSeconds}
            data-north-star-proof-stale={row.proofStale ? 'true' : 'false'}
            data-north-star-expected-dashboard-row-id={row.expectedDashboardRowId}
            data-north-star-proof-source={row.proofSource}
            data-north-star-blocker={row.blocker}
            data-north-star-href={row.href}
            data-north-star-integration-probe-hint={row.integrationProbeHint}
            data-north-star-detail={row.detail}
            data-north-star-proof-drilldowns={row.proofDrilldowns.map(item => `${item.kind}:${item.value}`).join('|')}
        >
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <h2 className='wrap-break-word text-base font-semibold text-[#171a21] dark:text-white'>{row.label}</h2>
                    <p className='mt-1 wrap-break-word text-sm leading-5 text-[#596170] dark:text-[#b9c4d6]'>{row.detail}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${tone}`}>
                    <Icon className='h-3.5 w-3.5' />
                    {stateLabel(row.state)}
                </span>
            </div>
            <dl className='mt-4 grid gap-2 text-xs'>
                <Fact label='Owner' value={row.ownerLane} />
                <Fact label='Contract' value={row.backendProofContractVersion} />
                <Fact label='Checked' value={formatChecked(row.proofTimestamp)} />
                <Fact label='Age' value={formatDuration(row.proofAgeSeconds)} />
                <Fact label='Stale' value={row.proofStale ? 'yes' : 'no'} />
                <Fact label='Stale after' value={formatDuration(row.staleAfterSeconds)} />
                <Fact label='Row id' value={row.expectedDashboardRowId} />
                <Fact label='Source' value={row.proofSource} />
            </dl>
            <ProofDrilldowns items={row.proofDrilldowns} scope={row.id} />
            {row.blocker && (
                <p className='mt-3 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs leading-5 text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'>
                    {row.blocker}
                </p>
            )}
            <div className='mt-4 flex items-center justify-between gap-3 border-t border-[#e4eaf2] pt-3 dark:border-[#26364f]'>
                <p className='min-w-0 wrap-break-word text-[11px] leading-4 text-[#667085] dark:text-[#97a6bd]'>{row.integrationProbeHint}</p>
                <Link href={row.href} className='inline-flex min-h-9 min-w-24 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-[#d9e2ef] px-3 py-1.5 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] dark:border-[#34445f] dark:text-[#d8e0ee] dark:hover:bg-[#162238]'>
                    Open
                    <ExternalLink className='h-3.5 w-3.5' />
                </Link>
            </div>
        </article>
    )
}

function ProofDrilldowns({
    items,
    scope,
}: {
    items: Array<{ kind: string, label: string, value: string, href: string }>
    scope: string
}) {
    return (
        <dl
            className='mt-3 grid gap-2 rounded-lg border border-[#e4eaf2] bg-[#fbfcfe] px-3 py-2 text-xs dark:border-[#26364f] dark:bg-[#0b1422]'
            data-north-star-proof-drilldown-group={scope}
        >
            {items.map(item => (
                <div
                    key={`${item.kind}-${item.label}`}
                    className='grid grid-cols-[88px_minmax(0,1fr)] gap-2'
                    data-north-star-proof-drilldown-kind={item.kind}
                    data-north-star-proof-drilldown-label={item.label}
                    data-north-star-proof-drilldown-value={item.value}
                    data-north-star-proof-drilldown-href={item.href}
                >
                    <dt className='font-semibold text-[#667085] dark:text-[#97a6bd]'>{item.label}</dt>
                    <dd className='min-w-0 wrap-break-word font-medium text-[#171a21] dark:text-[#f5f7fb]'>
                        {item.href ? (
                            <Link href={item.href} className='inline-flex min-h-8 min-w-9 items-center rounded-md px-1 text-[#3056d3] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] dark:text-[#9db6ff]'>
                                {item.value}
                            </Link>
                        ) : item.value}
                    </dd>
                </div>
            ))}
        </dl>
    )
}

function Fact({ label, value }: { label: string, value: string }) {
    return (
        <div className='grid grid-cols-[84px_minmax(0,1fr)] gap-2'>
            <dt className='font-semibold text-[#667085] dark:text-[#97a6bd]'>{label}</dt>
            <dd className='min-w-0 wrap-break-word font-medium text-[#171a21] dark:text-[#f5f7fb]'>{value || 'not loaded'}</dd>
        </div>
    )
}

async function loadProductReadiness(requestHeaders: Headers, query: string): Promise<ProductNorthStarScoreboard | null> {
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
    if (!host) return null
    const proto = requestHeaders.get('x-forwarded-proto') || 'http'
    const target = new URL('/api/product-readiness', `${proto}://${host}`)
    target.searchParams.set('q', query)
    try {
        const response = await fetch(target, {
            cache: 'no-store',
            headers: forwardedHeaders(requestHeaders),
            signal: AbortSignal.timeout(3500),
        })
        if (!response.ok) return null
        return parseProductNorthStarScoreboard(await response.json())
    } catch {
        return null
    }
}

function forwardedHeaders(requestHeaders: Headers) {
    const next = new Headers()
    const cookie = requestHeaders.get('cookie')
    if (cookie) next.set('cookie', cookie)
    for (const name of ['authorization', 'x-tenant-id', 'x-organization-id', 'x-user-id', 'x-user-email', 'x-actor-id']) {
        const value = requestHeaders.get(name)
        if (value) next.set(name, value)
    }
    return next
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || undefined
    return value
}

function stateLabel(state: ProductNorthStarRow['state']) {
    return state === 'needs_action' ? 'needs action' : state
}

function readableId(value: string) {
    return value.replaceAll('_', ' ')
}

function localRoute(value: string) {
    return value.startsWith('/api/')
        || value.startsWith('/dashboard')
        || value.startsWith('/ti')
        || value.startsWith('/status')
}

function formatChecked(value: string) {
    const time = new Date(value).getTime()
    if (!value || Number.isNaN(time)) return 'not loaded'
    const seconds = Math.max(0, Math.round((Date.now() - time) / 1000))
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatDuration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return 'not loaded'
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.round(hours / 24)}d`
}
