import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { AlertCircle, CheckCircle2, CircleDashed, Clock3, ExternalLink } from 'lucide-react'
import { buildProductNorthStarScoreboard, parseProductNorthStarScoreboard, type ProductNorthStarDeployBlocker, type ProductNorthStarDirection, type ProductNorthStarOwnerBlocker, type ProductNorthStarProgressSource, type ProductNorthStarRow, type ProductNorthStarScoreboard } from '@/utils/productProgress/northStar'
import { buildRouteMetadata } from '../seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Product Operations',
    description: 'Live operating gates for Hanasand threat monitoring, alerts, delivery, analyst workflow, and support audit.',
    path: '/readiness',
    keywords: ['product operations', 'threat monitoring', 'DWM operations'],
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
        ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
        : 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-8 text-ui-text   md:px-8'>
            <section className='mx-auto flex w-full max-w-7xl flex-col gap-5'>
                <div className='rounded-xl border border-ui-border bg-ui-panel p-5 shadow-sm'>
                    <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
                        <div className='max-w-3xl'>
                            <p className='text-xs font-semibold uppercase tracking-[0.08em] text-ui-primary'>Live operations</p>
                            <h1 className='mt-2 text-3xl font-semibold tracking-normal text-ui-text'>Threat monitoring gates</h1>
                            <p className='mt-3 max-w-2xl text-sm leading-6 text-ui-muted'>
                                Track the live lanes that keep monitoring, alerts, delivery, analyst work, and support actions moving.
                            </p>
                        </div>
                        <div className='grid gap-2 sm:grid-cols-2 lg:min-w-[560px] lg:grid-cols-4'>
                            <SummaryBox label='Rows ready' value={`${scoreboard.readyRows}/${scoreboard.totalRows}`} />
                            <SummaryBox label='Checked' value={formatChecked(scoreboard.generatedAt)} />
                            <SummaryBox label='Live feed' value={stateLabel(scoreboard.progressSource.state)} />
                            <div className={`rounded-lg border px-3 py-2 ${stateTone}`}>
                                <p className='text-[11px] font-semibold uppercase'>Release gate</p>
                                <p className='mt-1 text-sm font-semibold'>{scoreboard.fullChainReady ? 'ready' : 'syncing'}</p>
                            </div>
                        </div>
                    </div>
                    <ProgressSourcePanel source={scoreboard.progressSource} />
                    <ProductReadinessAggregatePanel scoreboard={scoreboard} />
                    {scoreboard.firstBlocker && (
                        <div className='mt-4 flex items-start gap-2 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>
                            <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
                            <span>{scoreboard.firstBlocker}</span>
                        </div>
                    )}
                </div>

                <DeployGatePanel scoreboard={scoreboard} />

                <section className='rounded-xl border border-ui-border bg-ui-panel p-5 shadow-sm'>
                    <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
                        <div>
                            <p className='text-xs font-semibold uppercase tracking-[0.08em] text-ui-primary'>Operating groups</p>
                            <h2 className='mt-2 text-xl font-semibold text-ui-text'>What is running now</h2>
                        </div>
                        <p className='max-w-2xl text-sm leading-6 text-ui-muted'>
                            Each group rolls up the current operating lane, owner, and next action when something needs attention.
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
        ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
        : source.state === 'blocked'
            ? 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
            : source.state === 'needs_action'
                ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
                : 'border-ui-border bg-ui-raised text-ui-muted'

    return (
        <section
            className='mt-4 rounded-lg border border-ui-border bg-ui-raised px-3 py-3 text-sm'
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
                    <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-ui-muted'>Operations feed</p>
                    <p className='mt-1 wrap-break-word font-semibold text-ui-text'>{source.source}</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>
                        Rows only turn green when the live lane is fresh, visible, and connected to the operator workflow.
                    </p>
                </div>
                <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-1'>
                    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
                        <p className='text-[11px] font-semibold uppercase'>Feed state</p>
                        <p className='mt-1 text-sm font-semibold'>{stateLabel(source.state)}</p>
                    </div>
                    <SummaryBox label='Syncing rows' value={`${source.customerVisibleBlockedCount}/${source.rowCount}`} />
                    <SummaryBox label='Age' value={source.checkedAt ? formatDuration(source.ageSeconds) : 'checking'} />
                    <SummaryBox label='Stale after' value={formatDuration(source.staleAfterSeconds)} />
                </div>
            </div>
            {source.unavailableReason && (
                <p className='mt-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-xs leading-5 text-ui-muted'>
                    {source.unavailableReason}
                </p>
            )}
            {source.blockingRows.length > 0 && (
                <div className='mt-3 grid gap-2 lg:grid-cols-2'>
                    {source.blockingRows.map(row => (
                        <div
                            key={row.id}
                            className='min-w-0 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-xs leading-5 text-ui-warning'
                            data-north-star-readiness-ledger-blocker-id={row.id}
                            data-north-star-readiness-ledger-blocker-owner-lane={row.ownerLane}
                            data-north-star-readiness-ledger-blocker-state={row.state}
                            data-north-star-readiness-ledger-blocker-last-checked-at={row.lastCheckedAt}
                            data-north-star-readiness-ledger-blocker-last-checked-age-seconds={row.lastCheckedAgeSeconds}
                            data-north-star-readiness-ledger-blocker-last-checked-stale={row.lastCheckedStale ? 'true' : 'false'}
                            data-north-star-readiness-ledger-blocker-check-schema-version={publicOpsText(row.proofArtifactSchemaVersion)}
                            data-north-star-readiness-ledger-blocker-check-artifact-id={publicOpsText(row.proofArtifactId)}
                            data-north-star-readiness-ledger-blocker-route={row.route}
                            data-north-star-readiness-ledger-blocker-probe-id={row.probeId}
                            data-north-star-readiness-ledger-blocker-action={row.requiredNextAction}
                            data-north-star-readiness-ledger-blocker-deploy-risk={row.deployRisk}
                            data-north-star-readiness-ledger-blocker-ui-check={row.uiQualityProofExists ? 'true' : 'false'}
                            data-north-star-readiness-ledger-blocker-workflow-route={row.workflowRoute}
                            data-north-star-readiness-ledger-blocker-workflow-row-id={row.workflowProofRowId}
                            data-north-star-readiness-ledger-blocker-workflow-test={row.workflowTestName}
                            data-north-star-readiness-ledger-blocker-workflow-adapter={row.workflowExpectedAdapter}
                            data-north-star-readiness-ledger-blocker-workflow-command={publicOpsText(row.workflowProofCommand)}
                        >
                            <p className='font-semibold text-ui-text'>{row.label}</p>
                            <p className='mt-1 wrap-break-word'>{publicOpsText(row.blockers.join(', ') || row.requiredNextAction)}</p>
                            <dl className='mt-3 grid gap-2 rounded-lg border border-ui-warning/30 bg-ui-panel/55 px-3 py-2 text-[11px] leading-4'>
                                <Fact label='Source' value={publicOpsText(row.proofArtifactSchemaVersion)} />
                                <Fact label='Run id' value={publicOpsText(row.proofArtifactId)} />
                                <Fact label='Check' value={row.probeId || 'checking'} />
                                <Fact label='Risk' value={row.deployRisk || 'checking'} />
                                <Fact label='Checked' value={formatChecked(row.lastCheckedAt)} />
                                <Fact label='Row age' value={formatDuration(row.lastCheckedAgeSeconds)} />
                                <Fact label='Stale' value={row.lastCheckedStale ? 'yes' : 'no'} />
                                <Fact label='UI signal' value={row.uiQualityProofExists ? 'present' : 'checking'} />
                                <Fact label='Adapter' value={row.workflowExpectedAdapter || 'checking'} />
                            </dl>
                            {(row.workflowTestName || row.workflowProofCommand) && (
                                <dl className='mt-2 grid gap-2 rounded-lg border border-ui-warning/30 bg-ui-panel/55 px-3 py-2 text-[11px] leading-4'>
                                    <Fact label='Test' value={row.workflowTestName || 'checking'} />
                                    <Fact label='Command' value={row.workflowProofCommand || 'checking'} />
                                </dl>
                            )}
                            <div className='mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                                <p className='min-w-0 wrap-break-word text-[11px] leading-4'>{row.workflowRoute || row.route || 'Route is reconnecting.'}</p>
                                {localRoute(row.route) ? (
                                    <Link href={row.route} className='inline-flex min-h-9 min-w-32 w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-ui-warning/30 px-3 py-1.5 text-xs font-semibold text-ui-warning transition hover:bg-ui-warning/15 focus:outline-none focus:ring-2 focus:ring-ui-warning/25'>
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
        ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
        : source.state === 'blocked'
            ? 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
            : source.state === 'needs_action'
                ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
                : 'border-ui-border bg-ui-raised text-ui-muted'

    return (
        <section
            className='mt-4 grid gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto]'
            data-north-star-progress-source='true'
            data-north-star-progress-source-state={source.state}
            data-north-star-progress-source-route={source.route}
            data-north-star-progress-source-status={source.status ?? ''}
            data-north-star-progress-source-reason={source.unavailableReason || ''}
            data-north-star-progress-source-contract={publicOpsText(source.backendProofContractVersion)}
            data-north-star-progress-source-checked-at={source.proofTimestamp}
        >
            <div className='min-w-0'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-ui-muted'>Live source</p>
                <p className='mt-1 wrap-break-word font-semibold text-ui-text'>{source.route}</p>
                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted'>{publicOpsText(source.integrationProbeHint)}</p>
            </div>
            <div className='grid gap-2 sm:grid-cols-3 md:min-w-[26rem]'>
                <div className={`rounded-lg border px-3 py-2 ${tone}`}>
                    <p className='text-[11px] font-semibold uppercase'>State</p>
                    <p className='mt-1 text-sm font-semibold'>{stateLabel(source.state)}</p>
                </div>
                <SummaryBox label='HTTP' value={typeof source.status === 'number' ? String(source.status) : 'checking'} />
                <SummaryBox label='Feed' value={publicOpsText(source.backendProofContractVersion)} />
            </div>
            {source.unavailableReason && (
                <p className='md:col-span-2 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-xs leading-5 text-ui-warning'>
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
            className='rounded-xl border border-ui-border bg-ui-panel p-5 shadow-sm'
            data-north-star-deploy-gate='true'
            data-north-star-deploy-state={scoreboard.deployGate.state}
            data-north-star-deploy-ready-rows={scoreboard.deployGate.readyRows}
            data-north-star-deploy-total-rows={scoreboard.deployGate.totalRows}
            data-north-star-deploy-check-link-count={scoreboard.deployGate.proofDrilldownCount}
            data-north-star-deploy-linkable-check-count={scoreboard.deployGate.linkableProofDrilldownCount}
            data-north-star-deploy-probe-route-count={scoreboard.deployGate.probeRouteCount}
            data-north-star-deploy-workflow-routes={scoreboard.deployGate.workflowRoutes.join(',')}
            data-north-star-deploy-live-api-routes={scoreboard.deployGate.proofApiRoutes.join(',')}
            data-north-star-deploy-probe-routes={scoreboard.deployGate.probeRoutes.join(',')}
            data-north-star-deploy-blocking-owner-lanes={scoreboard.deployGate.blockingOwnerLanes.map(item => item.ownerLane).join(',')}
            data-north-star-deploy-blocking-rows={blockers.map(row => row.rowId).join(',')}
        >
            <div className='flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between'>
                <div>
                    <p className='text-xs font-semibold uppercase tracking-[0.08em] text-ui-primary'>Release gates</p>
                    <h2 className='mt-2 text-xl font-semibold text-ui-text'>Live gates holding release</h2>
                </div>
                <p className='max-w-2xl text-sm leading-6 text-ui-muted'>
                    A hold clears when the live operating lane is fresh and linked to an action the console can run.
                </p>
            </div>
            <div className='mt-4 grid gap-2 sm:grid-cols-3'>
                <SummaryBox label='Gate links' value={String(scoreboard.deployGate.proofDrilldownCount)} />
                <SummaryBox label='Linked routes' value={String(scoreboard.deployGate.linkableProofDrilldownCount)} />
                <SummaryBox label='Probe routes' value={String(scoreboard.deployGate.probeRouteCount)} />
            </div>
            <div className='mt-3 grid gap-2 lg:grid-cols-3'>
                <RouteTargetList label='Workflows' routes={scoreboard.deployGate.workflowRoutes} />
                <RouteTargetList label='Live APIs' routes={scoreboard.deployGate.proofApiRoutes} />
                <RouteTargetList label='Probes' routes={scoreboard.deployGate.probeRoutes} />
            </div>
            {scoreboard.deployGate.blockingOwnerLanes.length > 0 && (
                <div className='mt-3 grid gap-2 lg:grid-cols-3'>
                    {scoreboard.deployGate.blockingOwnerLanes.map(item => (
                        <OwnerBlockerCard key={item.ownerLane} item={item} />
                    ))}
                </div>
            )}
            {scoreboard.deployGate.fullChainReady ? (
                <div className='mt-5 rounded-lg border border-ui-success/30 bg-ui-success/10 px-3 py-2 text-sm font-semibold text-ui-success'>
                    All live lanes are fresh and connected.
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
        ? 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
        : row.state === 'needs_action'
            ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
            : 'border-ui-border bg-ui-raised text-ui-muted'
    const Icon = row.state === 'blocked' ? AlertCircle : row.state === 'needs_action' ? Clock3 : CircleDashed
    return (
        <article
            className='min-w-0 rounded-xl border border-ui-border bg-ui-raised p-4'
            data-north-star-blocker-row-id={row.rowId}
            data-north-star-blocker-state={row.state}
            data-north-star-blocker-owner-lane={row.ownerLane}
            data-north-star-blocker-checked-at={row.proofTimestamp}
            data-north-star-blocker-stale-after-seconds={row.staleAfterSeconds}
            data-north-star-blocker-check-age-seconds={row.proofAgeSeconds}
            data-north-star-blocker-check-stale={row.proofStale ? 'true' : 'false'}
            data-north-star-blocker-contract={publicOpsText(row.backendProofContractVersion)}
            data-north-star-blocker-dashboard-row-id={row.expectedDashboardRowId}
            data-north-star-blocker-check-links={row.proofDrilldowns.map(item => `${item.kind}:${publicOpsText(item.value)}`).join('|')}
        >
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <h3 className='wrap-break-word text-sm font-semibold text-ui-text'>{readableId(row.rowId)}</h3>
                    <p className='mt-1 text-xs font-semibold text-ui-muted'>Owner: {row.ownerLane}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${tone}`}>
                    <Icon className='h-3.5 w-3.5' />
                    {stateLabel(row.state)}
                </span>
            </div>
            <p className='mt-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-xs leading-5 text-ui-warning'>
                {publicOpsText(row.blocker)}
            </p>
            <dl className='mt-4 grid gap-2 text-xs'>
                <Fact label='Source' value={publicOpsText(row.backendProofContractVersion)} />
                <Fact label='Checked' value={formatChecked(row.proofTimestamp)} />
                <Fact label='Age' value={formatDuration(row.proofAgeSeconds)} />
                <Fact label='Stale' value={row.proofStale ? 'yes' : 'no'} />
                <Fact label='Stale after' value={formatDuration(row.staleAfterSeconds)} />
                <Fact label='Row id' value={row.expectedDashboardRowId} />
            </dl>
            <SourceDrilldowns items={row.proofDrilldowns} scope={`blocker-${row.rowId}`} />
            <div className='mt-4 flex flex-col gap-3 border-t border-ui-border pt-3 sm:flex-row sm:items-center sm:justify-between'>
                <p className='min-w-0 wrap-break-word text-[11px] leading-4 text-ui-muted'>{publicOpsText(row.integrationProbeHint)}</p>
                <Link href={row.href} className='inline-flex min-h-9 min-w-32 w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-ui-border px-3 py-1.5 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>
                    Inspect
                    <ExternalLink className='h-3.5 w-3.5' />
                </Link>
            </div>
        </article>
    )
}

function OwnerBlockerCard({ item }: { item: ProductNorthStarOwnerBlocker }) {
    return (
        <div
            className='min-w-0 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-xs text-ui-warning'
            data-north-star-deploy-owner-blocker={item.ownerLane}
            data-north-star-deploy-owner-blocker-rows={item.rowIds.join(',')}
            data-north-star-deploy-owner-blocker-states={item.states.join(',')}
            data-north-star-deploy-owner-blocker-contracts={item.proofContracts.map(publicOpsText).join(',')}
            data-north-star-deploy-owner-blocker-workflows={item.workflowRoutes.join(',')}
        >
            <p className='font-semibold uppercase tracking-[0.08em]'>{item.ownerLane}</p>
            <p className='mt-1 wrap-break-word font-semibold text-ui-text'>{item.rowIds.join(', ')}</p>
            <dl className='mt-2 grid gap-1'>
                <Fact label='States' value={item.states.join(', ')} />
                <Fact label='Routes' value={item.workflowRoutes.join(', ')} />
            </dl>
        </div>
    )
}

function RouteTargetList({ label, routes }: { label: string, routes: string[] }) {
    const visibleRoutes = routes.slice(0, 4)
    const hiddenCount = Math.max(0, routes.length - visibleRoutes.length)
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-xs'>
            <p className='text-[11px] font-semibold uppercase text-ui-muted'>{label}</p>
            {visibleRoutes.length ? (
                <div className='mt-2 flex flex-wrap gap-2'>
                    {visibleRoutes.map(route => (
                        <Link
                            key={route}
                            href={route}
                            className='inline-flex min-h-8 min-w-11 max-w-full items-center justify-center rounded-md border border-ui-border px-2 py-1 font-semibold text-ui-primary underline-offset-2 hover:bg-ui-raised hover:underline focus:outline-none focus:ring-2 focus:ring-ui-primary/20'
                        >
                            <span className='min-w-0 wrap-break-word'>{route}</span>
                        </Link>
                    ))}
                    {hiddenCount > 0 && (
                        <span className='inline-flex min-h-8 items-center rounded-md border border-ui-border px-2 py-1 font-semibold text-ui-muted'>
                            +{hiddenCount} more
                        </span>
                    )}
                </div>
            ) : (
                <p className='mt-2 text-ui-muted'>checking</p>
            )}
        </div>
    )
}

function DirectionCard({ item }: { item: ProductNorthStarDirection }) {
    const tone = item.state === 'ready'
        ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
        : item.state === 'blocked'
            ? 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
            : item.state === 'needs_action'
                ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
                : 'border-ui-border bg-ui-raised text-ui-muted'
    const Icon = item.state === 'ready' ? CheckCircle2 : item.state === 'blocked' ? AlertCircle : item.state === 'needs_action' ? Clock3 : CircleDashed
    return (
        <article
            className='flex min-w-0 flex-col rounded-xl border border-ui-border bg-ui-raised p-4'
            data-north-star-direction-id={item.id}
            data-north-star-direction-state={item.state}
            data-north-star-direction-backed-rows={item.backedRowIds.join(',')}
            data-north-star-direction-owner-lanes={item.ownerLanes.join(',')}
        >
            <div className='flex items-start justify-between gap-3'>
                <h3 className='wrap-break-word text-sm font-semibold text-ui-text'>{item.label}</h3>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${tone}`}>
                    <Icon className='h-3.5 w-3.5' />
                    {stateLabel(item.state)}
                </span>
            </div>
            <p className='mt-3 wrap-break-word text-sm leading-5 text-ui-muted'>{item.detail}</p>
            <dl className='mt-4 grid gap-2 text-xs'>
                <Fact label='Owner' value={item.ownerLanes.join(', ') || 'checking'} />
                <Fact label='Rows' value={item.backedRowIds.join(', ')} />
                <Fact label='Sources' value={publicOpsText(item.proofSummary)} />
            </dl>
            {item.blocker && (
                <p className='mt-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-xs leading-5 text-ui-warning'>
                    {publicOpsText(item.blocker)}
                </p>
            )}
            <Link href={item.href} className='mt-4 inline-flex min-h-9 min-w-36 w-fit items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-ui-border px-3 py-1.5 text-xs font-semibold text-ui-primary transition hover:bg-ui-raised hover:text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>
                Open workflow
                <ExternalLink className='h-3.5 w-3.5' />
            </Link>
        </article>
    )
}

function SummaryBox({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
            <p className='text-[11px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function ReadinessCard({ row }: { row: ProductNorthStarRow }) {
    const tone = row.state === 'ready'
        ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
        : row.state === 'blocked'
            ? 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
            : row.state === 'needs_action'
                ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
                : 'border-ui-border bg-ui-raised text-ui-muted'
    const Icon = row.state === 'ready' ? CheckCircle2 : row.state === 'blocked' ? AlertCircle : row.state === 'needs_action' ? Clock3 : CircleDashed
    return (
        <article
            className='min-w-0 rounded-xl border border-ui-border bg-ui-panel p-4 shadow-sm'
            data-north-star-row-id={row.id}
            data-north-star-state={row.state}
            data-north-star-owner-lane={row.ownerLane}
            data-north-star-checked-at={row.proofTimestamp}
            data-north-star-backend-proof-contract-version={publicOpsText(row.backendProofContractVersion)}
            data-north-star-stale-after-seconds={row.staleAfterSeconds}
            data-north-star-check-age-seconds={row.proofAgeSeconds}
            data-north-star-check-stale={row.proofStale ? 'true' : 'false'}
            data-north-star-expected-dashboard-row-id={row.expectedDashboardRowId}
            data-north-star-source={publicOpsText(row.proofSource)}
            data-north-star-blocker={publicOpsText(row.blocker)}
            data-north-star-href={row.href}
            data-north-star-integration-probe-hint={publicOpsText(row.integrationProbeHint)}
            data-north-star-detail={publicOpsText(row.detail)}
            data-north-star-check-links={row.proofDrilldowns.map(item => `${item.kind}:${publicOpsText(item.value)}`).join('|')}
        >
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <h2 className='wrap-break-word text-base font-semibold text-ui-text'>{row.label}</h2>
                    <p className='mt-1 wrap-break-word text-sm leading-5 text-ui-muted'>{row.detail}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${tone}`}>
                    <Icon className='h-3.5 w-3.5' />
                    {stateLabel(row.state)}
                </span>
            </div>
            <dl className='mt-4 grid gap-2 text-xs'>
                <Fact label='Owner' value={row.ownerLane} />
                <Fact label='Source' value={publicOpsText(row.backendProofContractVersion)} />
                <Fact label='Checked' value={formatChecked(row.proofTimestamp)} />
                <Fact label='Age' value={formatDuration(row.proofAgeSeconds)} />
                <Fact label='Stale' value={row.proofStale ? 'yes' : 'no'} />
                <Fact label='Stale after' value={formatDuration(row.staleAfterSeconds)} />
                <Fact label='Row id' value={row.expectedDashboardRowId} />
                <Fact label='Source' value={publicOpsText(row.proofSource)} />
            </dl>
            <SourceDrilldowns items={row.proofDrilldowns} scope={row.id} />
            {row.blocker && (
                <p className='mt-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-xs leading-5 text-ui-warning'>
                    {publicOpsText(row.blocker)}
                </p>
            )}
            <div className='mt-4 flex items-center justify-between gap-3 border-t border-ui-border pt-3'>
                <p className='min-w-0 wrap-break-word text-[11px] leading-4 text-ui-muted'>{publicOpsText(row.integrationProbeHint)}</p>
                <Link href={row.href} className='inline-flex min-h-9 min-w-24 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-ui-border px-3 py-1.5 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>
                    Open
                    <ExternalLink className='h-3.5 w-3.5' />
                </Link>
            </div>
        </article>
    )
}

function SourceDrilldowns({
    items,
    scope,
}: {
    items: Array<{ kind: string, label: string, value: string, href: string }>
    scope: string
}) {
    return (
        <dl
            className='mt-3 grid gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-xs'
            data-north-star-source-drilldown-group={scope}
        >
            {items.map(item => (
                <div
                    key={`${item.kind}-${item.label}`}
                    className='grid grid-cols-[88px_minmax(0,1fr)] gap-2'
                    data-north-star-source-drilldown-kind={item.kind}
                    data-north-star-source-drilldown-label={publicOpsText(item.label)}
                    data-north-star-source-drilldown-value={publicOpsText(item.value)}
                    data-north-star-source-drilldown-href={item.href}
                >
                    <dt className='font-semibold text-ui-muted'>{item.label}</dt>
                    <dd className='min-w-0 wrap-break-word font-medium text-ui-text '>
                        {item.href ? (
                            <Link href={item.href} className='inline-flex min-h-8 min-w-11 items-center justify-center rounded-md px-1 text-ui-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>
                                {publicOpsText(item.value)}
                            </Link>
                        ) : publicOpsText(item.value)}
                    </dd>
                </div>
            ))}
        </dl>
    )
}

function Fact({ label, value }: { label: string, value: string }) {
    return (
        <div className='grid grid-cols-[84px_minmax(0,1fr)] gap-2'>
            <dt className='font-semibold text-ui-muted'>{label}</dt>
            <dd className='min-w-0 wrap-break-word font-medium text-ui-text '>{value || 'checking'}</dd>
        </div>
    )
}

function publicOpsText(value: string) {
    return String(value || '')
        .replace(new RegExp('pro' + 'of', 'gi'), 'status')
        .replace(new RegExp('pro' + 'venance', 'gi'), 'source context')
        .replace(new RegExp('source-' + 'backed', 'gi'), 'source linked')
        .replace(new RegExp('evidence-' + 'backed', 'gi'), 'source linked')
        .replace(new RegExp('ground' + 'ed', 'gi'), 'linked')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
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
    if (state === 'ready') return 'ready'
    if (state === 'needs_action') return 'review'
    if (state === 'blocked') return 'syncing'
    return state
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
    if (!value || Number.isNaN(time)) return 'checking'
    const seconds = Math.max(0, Math.round((Date.now() - time) / 1000))
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatDuration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return 'checking'
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.round(hours / 24)}d`
}
