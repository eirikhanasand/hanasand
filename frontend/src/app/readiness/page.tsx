import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { AlertCircle, CheckCircle2, CircleDashed, Clock3, ExternalLink } from 'lucide-react'
import { buildProductNorthStarScoreboard, parseProductNorthStarScoreboard, type ProductNorthStarDirection, type ProductNorthStarRow, type ProductNorthStarScoreboard } from '@/utils/productProgress/northStar'
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
                        <div className='grid gap-2 sm:grid-cols-3 lg:min-w-[460px]'>
                            <SummaryBox label='Rows ready' value={`${scoreboard.readyRows}/${scoreboard.totalRows}`} />
                            <SummaryBox label='Checked' value={formatChecked(scoreboard.generatedAt)} />
                            <div className={`rounded-lg border px-3 py-2 ${stateTone}`}>
                                <p className='text-[11px] font-semibold uppercase'>Release gate</p>
                                <p className='mt-1 text-sm font-semibold'>{scoreboard.fullChainReady ? 'ready' : 'blocked'}</p>
                            </div>
                        </div>
                    </div>
                    {scoreboard.firstBlocker && (
                        <div className='mt-4 flex items-start gap-2 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-sm text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'>
                            <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
                            <span>{scoreboard.firstBlocker}</span>
                        </div>
                    )}
                </div>

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
            <Link href={item.href} className='mt-4 inline-flex min-h-9 w-fit items-center gap-1 rounded-lg border border-[#d9e2ef] px-2.5 py-1.5 text-xs font-semibold text-[#3056d3] transition hover:bg-[#f2f5f9] hover:text-[#1d3fb0] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] dark:border-[#34445f] dark:text-[#9db6ff] dark:hover:bg-[#162238] dark:hover:text-white'>
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
            data-north-star-expected-dashboard-row-id={row.expectedDashboardRowId}
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
                <Fact label='Stale after' value={formatDuration(row.staleAfterSeconds)} />
                <Fact label='Row id' value={row.expectedDashboardRowId} />
                <Fact label='Source' value={row.proofSource} />
            </dl>
            {row.blocker && (
                <p className='mt-3 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs leading-5 text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'>
                    {row.blocker}
                </p>
            )}
            <div className='mt-4 flex items-center justify-between gap-3 border-t border-[#e4eaf2] pt-3 dark:border-[#26364f]'>
                <p className='min-w-0 wrap-break-word text-[11px] leading-4 text-[#667085] dark:text-[#97a6bd]'>{row.integrationProbeHint}</p>
                <Link href={row.href} className='inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-[#d9e2ef] px-2.5 py-1.5 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] dark:border-[#34445f] dark:text-[#d8e0ee] dark:hover:bg-[#162238]'>
                    Open
                    <ExternalLink className='h-3.5 w-3.5' />
                </Link>
            </div>
        </article>
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
