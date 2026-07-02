import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ArrowRight, Building2, ChevronRight, ExternalLink, Search, ShieldCheck, Waypoints } from 'lucide-react'
import LogoutClient from '@/components/logout/logoutClient'
import { buildProductNorthStarScoreboard, parseProductNorthStarScoreboard, type ProductNorthStarScoreboard } from '@/utils/productProgress/northStar'
import { buildRouteMetadata } from './seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Hanasand Threat Intelligence',
    description: 'Monitor ransomware victim claims, actor infrastructure, and company exposure with source-backed threat intelligence.',
    path: '/',
    keywords: ['hanasand', 'threat intelligence', 'ransomware monitoring', 'dark web monitoring', 'company exposure alerts'],
})

const examples = [
    {
        title: 'Company exposure monitor',
        slug: 'hanasand/company-exposure-monitor',
        detail: 'Watch company names, domains, suppliers, brands, and portfolio companies across recent victim-claim activity.',
        badge: 'Live alerts',
        proof: '12 min median refresh',
        icon: Building2,
    },
    {
        title: 'Ransomware actor overview',
        slug: 'hanasand/actor-overview',
        detail: 'Map actors to victims, claimed data, infrastructure changes, sectors, timelines, and review state.',
        badge: 'Graph ready',
        proof: 'Actor and victim pivots',
        icon: Waypoints,
    },
    {
        title: 'Dark web exposure index',
        slug: 'hanasand/darkweb-exposure-index',
        detail: 'Normalized actor, company, URL, note, claim, and timing fields from leak and extortion infrastructure.',
        badge: 'Indexed feeds',
        proof: 'Company and actor pivots',
        icon: ShieldCheck,
    },
]

const solutions = [
    {
        title: 'Threat Monitoring',
        detail: 'Ransomware and exposure notifications for watched companies and vendors.',
        href: '/ti',
    },
    {
        title: 'Onion Sessions',
        detail: 'Short-lived isolated onion workspaces with remote controls, notes, and source tracking.',
        href: '/solutions/onion-session',
    },
    {
        title: 'Bloom Filter',
        detail: 'Private breach and password-exposure checks without turning sensitive material into a dashboard.',
        href: '/pwned',
    },
    {
        title: 'Shared Reports',
        detail: 'Package exposure findings into customer-ready review links and follow-up workflows.',
        href: '/contact?intent=reports',
    },
]

const stats = [
    ['Alert target', 'Company, vendor, domain, and brand mentions'],
    ['What gets sent', 'Actor, company, claimed data, source, time, status'],
    ['Freshness basis', 'New and changed actor-page claims'],
    ['Review workflow', 'Webhook, API, and console review queue'],
]

type ExposureQueueItem = {
    id: string
    actor: string
    company: string
    claimedData: string
    claimTime?: string
    collectedAt?: string
    status: string
    confidence?: number
    sourceName?: string
}

type ExposureQueue = {
    generatedAt: string
    status: 'live' | 'stale' | 'waiting_for_collection' | string
    freshness?: {
        latestClaimAt?: string | null
        ageMinutes?: number | null
        maxLiveAgeMinutes?: number
    }
    scheduler?: {
        state?: string
        cadenceSeconds?: number
    }
    counts?: {
        visible?: number
        needsReview?: number
        metadataOnly?: number
    }
    items: ExposureQueueItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const logout = Boolean(firstParam(params.logout)) || false
    const query = firstParam(params.q) || 'watchlist terms'
    const Headers = await headers()
    const generatedAt = new Date().toISOString()
    const scoreboard = await loadProductReadiness(Headers, query) || buildProductNorthStarScoreboard(null, { generatedAt, query })
    const exposureQueue = await loadExposureQueue(Headers) || emptyExposureQueue(generatedAt)

    return (
        <main className='min-h-full bg-[#f7f8fb] text-[#16181d] dark:bg-[#08111f] dark:text-[#f5f7fb]'>
            <LogoutClient logoutServer={logout} />

            <section className='border-b border-[#e3e7ee] bg-[radial-gradient(circle_at_1px_1px,rgba(24,32,52,0.09)_1px,transparent_0)] bg-[length:22px_22px] dark:border-[#26364f] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(157,182,255,0.18)_1px,transparent_0)]'>
                <div className='mx-auto grid w-full max-w-7xl content-start gap-10 px-4 pb-12 pt-16 md:px-8 md:pt-24 lg:pt-28'>
                    <div className='mx-auto grid max-w-5xl justify-items-center gap-6 text-center'>
                        <Link href='/ti' className='landing-primary-action inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm transition'>
                            <span className='landing-inner-pill rounded-full px-2 py-0.5 text-xs'>Proof</span>
                            Source-backed monitoring for company exposure
                            <ArrowRight className='h-4 w-4' />
                        </Link>

                        <div className='grid gap-4'>
                            <h1 className='text-5xl font-semibold tracking-normal text-[#111318] dark:text-white md:text-7xl'>
                                Company Exposure Monitoring
                            </h1>
                            <p className='mx-auto max-w-3xl text-lg leading-8 text-[#596170] dark:text-[#b9c4d6] md:text-xl'>
                                Search watched sources, threat actors, companies, domains, and CVEs; route source-backed alerts to the API, webhooks, and analyst console.
                            </p>
                        </div>

                        <form action='/ti' className='landing-search-bar grid w-full max-w-3xl gap-0 overflow-hidden rounded-lg border p-0 shadow-[0_20px_60px_rgba(28,38,61,0.10)] md:grid-cols-[1fr_auto]'>
                            <label className='landing-search-field flex min-w-0 items-center gap-3 px-4'>
                                <Search className='h-5 w-5 shrink-0 text-[#697386]' />
                                <input
                                    name='q'
                                    aria-label='Search threat intelligence'
                                    placeholder='Search company, actor, domain, CVE'
                                    className='landing-search-input h-14 min-w-0 flex-1 bg-transparent text-base font-medium text-[#171a21] outline-none placeholder:text-[#8c95a5]'
                                />
                            </label>
                            <button type='submit' className='landing-search-button inline-flex h-14 items-center justify-center gap-2 px-5 text-sm font-semibold transition'>
                                Search intelligence
                                <ChevronRight className='h-4 w-4' />
                            </button>
                        </form>

                        <HomeReadinessStrip scoreboard={scoreboard} />
                    </div>

                    <div className='grid gap-4 lg:grid-cols-3'>
                        {examples.map((item) => {
                            const Icon = item.icon
                            return (
                                <Link key={item.slug} href='/ti' className='group overflow-hidden rounded-lg border border-[#e0e5ed] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#c9d2df] hover:shadow-[0_18px_50px_rgba(26,35,55,0.12)] dark:border-[#26364f] dark:bg-[#101927] dark:hover:border-[#405579]'>
                                    <div className='grid gap-4 p-5'>
                                        <div className='flex items-start justify-between gap-3'>
                                            <div className='grid h-12 w-12 place-items-center rounded-lg border border-[#dfe6f1] bg-[#f7f9fc] text-[#3056d3] dark:border-[#34445f] dark:bg-[#0b1422] dark:text-[#9db6ff]'>
                                                <Icon className='h-5 w-5' />
                                            </div>
                                            <span className='landing-status-pill rounded-full border px-2.5 py-1 text-xs font-semibold'>{item.badge}</span>
                                        </div>
                                        <div className='grid gap-1'>
                                            <h2 className='text-lg font-semibold text-[#171a21] dark:text-white'>{item.title}</h2>
                                            <p className='font-mono text-sm text-[#737c8c] dark:text-[#97a6bd]'>{item.slug}</p>
                                        </div>
                                        <p className='min-h-16 text-sm leading-6 text-[#596170] dark:text-[#b9c4d6]'>{item.detail}</p>
                                    </div>
                                    <div className='flex items-center justify-between border-t border-[#eef1f5] bg-[#f8fafc] px-5 py-3 text-sm dark:border-[#26364f] dark:bg-[#0b1422]'>
                                        <span className='font-medium text-[#2b3340] dark:text-[#d8e0ee]'>{item.proof}</span>
                                        <span className='landing-text-action inline-flex items-center gap-1 font-semibold'>Open <ExternalLink className='landing-action-icon h-3.5 w-3.5' /></span>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>

                    <HomeWorkflowProof scoreboard={scoreboard} />
                </div>
            </section>

            <section className='border-b border-[#e3e7ee] bg-white'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:py-18'>
                    <div className='grid content-start gap-5'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Monitoring workflow</p>
                        <h2 className='text-3xl font-semibold text-[#171a21] md:text-4xl'>Find the company mention before it becomes a forwarded screenshot.</h2>
                        <p className='text-base leading-7 text-[#596170]'>
                            Each alert is built for the first triage decision: who posted it, which company was named, what data was claimed, when it appeared, and whether it needs action.
                        </p>
                        <div className='grid gap-3'>
                            {stats.map(([label, value]) => (
                                <div key={label} className='grid grid-cols-[10rem_1fr] gap-4 border-b border-[#eef1f5] py-3 text-sm'>
                                    <span className='text-[#737c8c]'>{label}</span>
                                    <span className='font-semibold text-[#171a21]'>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-[0_20px_70px_rgba(26,35,55,0.10)]' data-exposure-queue-source='api'>
                        <div className='flex items-center justify-between gap-4 border-b border-[#eef1f5] px-4 py-3'>
                            <div className='min-w-0'>
                                <h3 className='text-sm font-semibold text-[#171a21]'>Exposure queue</h3>
                                <p className='truncate text-xs text-[#737c8c]'>{exposureQueueSubtitle(exposureQueue)}</p>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${exposureQueueTone(exposureQueue.status)}`}>{exposureQueueLabel(exposureQueue.status)}</span>
                        </div>
                        <div className='min-w-0 overflow-x-auto'>
                            <div className='min-w-[48rem]'>
                                <div className='grid grid-cols-[6.5rem_minmax(12rem,1fr)_9rem_10.5rem_5rem] gap-3 border-b border-[#eef1f5] px-4 py-2 text-[0.68rem] font-semibold uppercase text-[#737c8c]'>
                                    <span>Actor</span>
                                    <span>Company</span>
                                    <span>Claimed data</span>
                                    <span>Claim time</span>
                                    <span className='text-right'>Status</span>
                                </div>
                                <div className='divide-y divide-[#eef1f5]'>
                                    {exposureQueue.items.length ? exposureQueue.items.slice(0, 6).map(({ id, actor, company, claimedData, claimTime, collectedAt, status }) => (
                                        <div key={id} className='grid min-w-0 grid-cols-[6.5rem_minmax(12rem,1fr)_9rem_10.5rem_5rem] items-center gap-3 px-4 py-3 text-sm'>
                                            <span className='truncate font-semibold text-[#171a21]'>{actor}</span>
                                            <span className='truncate text-[#3d4656]'>{company}</span>
                                            <span className='truncate whitespace-nowrap text-[#596170]'>{claimedData}</span>
                                            <time dateTime={claimTime || collectedAt || exposureQueue.generatedAt} className='truncate whitespace-nowrap font-mono text-xs text-[#596170]'>{formatClaimTime(claimTime || collectedAt)}</time>
                                            <span className='landing-status-pill justify-self-end whitespace-nowrap rounded-full border px-2 py-1 text-xs font-medium'>{status}</span>
                                        </div>
                                    )) : (
                                        <div className='grid min-w-0 gap-2 px-4 py-8 text-sm'>
                                            <p className='font-semibold text-[#171a21]'>Waiting for the next exposure collection cycle</p>
                                            <p className='max-w-2xl text-[#596170]'>Actor-page, public-channel, and news findings will appear here after the scraper posts metadata to the Hanasand AI parser.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className='bg-[#f7f8fb]'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
                        <div className='grid gap-2'>
                            <p className='text-sm font-semibold uppercase text-[#3056d3]'>Solutions</p>
                            <h2 className='text-3xl font-semibold text-[#171a21]'>Monitoring and secure workflow tools in one place.</h2>
                        </div>
                        <Link href='/dashboard/overview' className='landing-primary-action inline-flex w-fit items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition'>
                            Go to Console
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>

                    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                        {solutions.map((solution) => (
                            <Link key={solution.title} href={solution.href} className='grid gap-4 rounded-lg border border-[#e0e5ed] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c9d2df]'>
                                <div className='flex items-center justify-between gap-3'>
                                    <h3 className='text-base font-semibold text-[#171a21]'>{solution.title}</h3>
                                    <ArrowRight className='landing-action-icon h-4 w-4' />
                                </div>
                                <p className='text-sm leading-6 text-[#596170]'>{solution.detail}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    )
}

function HomeReadinessStrip({ scoreboard }: { scoreboard: ProductNorthStarScoreboard }) {
    const stateLabel = scoreboard.fullChainReady ? 'ready' : 'needs action'
    const firstMissingRow = scoreboard.rows.find(row => row.state !== 'ready')
    const ledger = scoreboard.productReadinessAggregate
    const ledgerValue = ledger.state === 'unavailable'
        ? 'setup needed'
        : `${homeStateLabel(ledger.state)}; ${ledger.customerVisibleBlockedCount}/${ledger.rowCount} needs action`
    const nextStep = scoreboard.fullChainReady
        ? 'Source, alert, delivery, and analyst workflow are connected.'
        : formatOperatorText(scoreboard.firstBlocker || 'Connect the next workflow data source.')

    return (
        <div
            className='grid w-full max-w-6xl gap-3 rounded-xl border border-[#d9e2ef] bg-white/90 p-3 text-left shadow-sm backdrop-blur dark:border-[#26364f] dark:bg-[#101927]/90 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.95fr_1.5fr_auto]'
            data-home-product-readiness='true'
            data-home-readiness-state={stateLabel}
            data-home-readiness-ready-rows={scoreboard.readyRows}
            data-home-readiness-total-rows={scoreboard.totalRows}
            data-home-readiness-query={scoreboard.query}
            data-home-readiness-deploy-state={scoreboard.deployGate.state}
            data-home-readiness-ledger-state={ledger.state}
            data-home-readiness-ledger-source={ledger.source}
            data-home-readiness-ledger-blocked-count={ledger.customerVisibleBlockedCount}
            data-home-readiness-ledger-row-count={ledger.rowCount}
            data-home-readiness-ledger-deploy-risk={ledger.deployRisk}
            data-home-first-blocker-row={firstMissingRow?.id || ''}
            data-home-first-blocker-owner={firstMissingRow?.ownerLane || ''}
            data-home-first-blocker-contract={firstMissingRow?.backendProofContractVersion || ''}
            data-home-first-blocker-raw={scoreboard.firstBlocker || ''}
        >
            <HomeReadinessFact label='Product category' value='Company exposure monitoring API and analyst console' />
            <HomeReadinessFact label='Workflow state' value={`${scoreboard.readyRows}/${scoreboard.totalRows} checks connected`} />
            <HomeReadinessFact label='Checked' value={formatChecked(scoreboard.generatedAt)} />
            <HomeReadinessFact label='Ledger' value={ledgerValue} />
            <HomeReadinessFact label={scoreboard.fullChainReady ? 'Workflow path' : 'Next action'} value={nextStep} />
            <Link
                href={`/dashboard?q=${encodeURIComponent(scoreboard.query)}`}
                className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d9e2ef] px-3 py-2 text-sm font-semibold text-[#3056d3] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] dark:border-[#34445f] dark:text-[#9db6ff] dark:hover:bg-[#162238]'
            >
                Open console
                <ArrowRight className='h-4 w-4' />
            </Link>
        </div>
    )
}

function HomeReadinessFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] px-3 py-2 dark:border-[#26364f] dark:bg-[#0b1422]'>
            <p className='text-[11px] font-semibold uppercase text-[#667085] dark:text-[#97a6bd]'>{label}</p>
            <p className='mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[#171a21] dark:text-white'>{value}</p>
        </div>
    )
}

function HomeWorkflowProof({ scoreboard }: { scoreboard: ProductNorthStarScoreboard }) {
    return (
        <section
            className='overflow-hidden rounded-xl border border-[#d9e2ef] bg-white/95 shadow-sm backdrop-blur dark:border-[#26364f] dark:bg-[#101927]/95'
            data-home-workflow-coverage='true'
            data-home-workflow-coverage-ready-rows={scoreboard.readyRows}
            data-home-workflow-coverage-total-rows={scoreboard.totalRows}
        >
            <div className='grid gap-2 border-b border-[#eef1f5] px-4 py-4 dark:border-[#26364f] md:grid-cols-[1fr_auto] md:items-end'>
                <div>
                    <p className='text-xs font-semibold uppercase text-[#3056d3] dark:text-[#9db6ff]'>Customer workflow coverage</p>
                    <h2 className='mt-1 text-xl font-semibold text-[#171a21] dark:text-white'>What an analyst can act on now</h2>
                </div>
                <Link
                    href={`/dashboard?q=${encodeURIComponent(scoreboard.query)}`}
                    className='inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-[#d9e2ef] px-3 py-2 text-sm font-semibold text-[#3056d3] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] dark:border-[#34445f] dark:text-[#9db6ff] dark:hover:bg-[#162238]'
                >
                    Inspect console
                    <ArrowRight className='h-4 w-4' />
                </Link>
            </div>
            <div>
                <div className='hidden grid-cols-[1.1fr_8rem_1.5fr_8rem] gap-3 border-b border-[#eef1f5] px-4 py-2 text-[0.68rem] font-semibold uppercase text-[#667085] dark:border-[#26364f] dark:text-[#97a6bd] md:grid'>
                    <span>Workflow</span>
                    <span>State</span>
                    <span>Evidence</span>
                    <span className='text-right'>Action</span>
                </div>
                <div className='divide-y divide-[#eef1f5] dark:divide-[#26364f]'>
                    {scoreboard.direction.map(item => (
                        <div
                            key={item.id}
                            className='grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.1fr_8rem_1.5fr_8rem] md:items-center md:py-3'
                            data-home-direction-id={item.id}
                            data-home-direction-state={item.state}
                            data-home-direction-backed-rows={item.backedRowIds.join(',')}
                            data-home-direction-owner-lanes={item.ownerLanes.join(',')}
                            data-home-direction-href={item.href}
                        >
                            <div className='min-w-0'>
                                <p className='wrap-break-word font-semibold text-[#171a21] dark:text-white'>{item.label}</p>
                                <p className='mt-1 wrap-break-word text-xs text-[#667085] dark:text-[#97a6bd]'>{formatLaneList(item.ownerLanes)}</p>
                            </div>
                            <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${homeStateTone(item.state)}`}>
                                {homeStateLabel(item.state)}
                            </span>
                            <p className='min-w-0 wrap-break-word text-[#596170] dark:text-[#b9c4d6]' title={item.blocker || item.proofSummary}>
                                {item.state === 'ready' ? formatEvidenceSummary(item.proofSummary) : formatOperatorText(item.blocker || item.detail)}
                            </p>
                            <Link href={item.href} className='inline-flex min-h-9 min-w-20 w-fit items-center justify-center px-3 py-2 text-sm font-semibold text-[#3056d3] hover:text-[#1d3fb0] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] dark:text-[#9db6ff] dark:hover:text-white md:justify-self-end'>
                                Open
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function homeStateTone(state: ProductNorthStarScoreboard['rows'][number]['state']) {
    if (state === 'ready') return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] dark:border-[#246b42] dark:bg-[#10251b] dark:text-[#a7f3d0]'
    if (state === 'blocked') return 'border-[#fecaca] bg-[#fff1f2] text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#2a1114] dark:text-[#fca5a5]'
    if (state === 'needs_action') return 'border-[#fed7aa] bg-[#fff7ed] text-[#9a3412] dark:border-[#7c3b16] dark:bg-[#2b170b] dark:text-[#fdba74]'
    return 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] dark:border-[#25456f] dark:bg-[#0b1b30] dark:text-[#93c5fd]'
}

function homeStateLabel(state: ProductNorthStarScoreboard['rows'][number]['state']) {
    if (state === 'ready') return 'ready'
    if (state === 'blocked') return 'blocked'
    if (state === 'needs_action') return 'needs action'
    return 'setup needed'
}

function formatOperatorText(value: string) {
    const normalized = value
        .replace(/\bmissing_dwm_entitlement_readiness_api\b/g, 'Connect organization access policy for alert routing.')
        .replace(/\bmissing_org_alert_export_readiness_api\b/g, 'Connect active organization watchlist terms for alert routing.')
        .replace(/\bmissing_source_proxy_worker_readiness\b/g, 'Run the TI source worker and refresh source coverage.')
        .replace(/\bmissing_dashboard_alert\b/gi, 'Generate a dashboard-visible alert for the selected customer.')
        .replace(/\bmissing_alert_generation_readiness\b/gi, 'Connect alert generation status.')
        .replace(/\bMissing dashboard alert evidence\b/gi, 'Generate a dashboard-visible alert for the selected customer.')
        .replace(/\bDashboard-visible alert proof is not loaded\b/g, 'Generate a dashboard-visible alert for the selected customer.')
        .replace(/\bmissing_webhook_lifecycle_health_api\b/g, 'Connect webhook destination health and delivery history.')
        .replace(/\bmissing_helpdesk_audit_readiness_api\b/g, 'Connect support audit history.')
        .replace(/\bmissing_live_deploy_probe\b/g, 'Run the latest live deploy check.')
        .replace(/\bmissing_public_ti_provenance_readiness_api\b/g, 'Attach public TI source provenance and freshness.')
        .replace(/\bDWM entitlement readiness endpoint is not wired into product progress yet\b/gi, 'Organization access policy is not connected to this console view yet')
        .replace(/\bEntitlement owner must expose policy, role, and allowed-action readiness before this can become ready\b/gi, 'Connect policy, role, and allowed alert actions before customer routing')
        .replace(/\breadiness proof\b/gi, 'workflow data')
        .replace(/\bproof is not loaded\b/gi, 'data is not connected')
        .replace(/\bis not loaded\b/gi, 'is not connected')
        .replace(/\bnot loaded\b/gi, 'not connected')
        .replace(/\bunavailable\b/gi, 'setup needed')
        .replace(/\breadiness\b/gi, 'status')
        .replace(/\bproof\b/gi, 'evidence')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : 'Connect the next workflow data source.'
}

function formatEvidenceSummary(value: string) {
    return formatOperatorText(value)
        .replace(/\bbackend contract version\b/gi, 'source')
        .replace(/\bcontract\b/gi, 'source')
}

function formatLaneList(lanes: string[]) {
    return lanes.length ? lanes.join(', ') : 'operator workflow'
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

async function loadExposureQueue(requestHeaders: Headers): Promise<ExposureQueue | null> {
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
    if (!host) return null
    const proto = requestHeaders.get('x-forwarded-proto') || 'http'
    const target = new URL('/api/dwm/exposure-queue', `${proto}://${host}`)
    target.searchParams.set('limit', '6')

    try {
        const response = await fetch(target, {
            cache: 'no-store',
            headers: forwardedHeaders(requestHeaders),
            signal: AbortSignal.timeout(3500),
        })
        if (!response.ok && response.status !== 202) return null
        return normalizeExposureQueue(await response.json())
    } catch {
        return null
    }
}

function normalizeExposureQueue(value: unknown): ExposureQueue {
    const record = isRecord(value) ? value : {}
    const generatedAt = typeof record.generatedAt === 'string' ? record.generatedAt : new Date().toISOString()
    const items = Array.isArray(record.items) ? record.items.map((rawItem, index) => {
        const item = isRecord(rawItem) ? rawItem : {}
        return {
            id: String(item.id || `exposure-${index}`),
            actor: String(item.actor || 'Unknown actor'),
            company: String(item.company || 'Unknown company'),
            claimedData: String(item.claimedData || 'new victim claim'),
            claimTime: typeof item.claimTime === 'string' ? item.claimTime : undefined,
            collectedAt: typeof item.collectedAt === 'string' ? item.collectedAt : undefined,
            status: String(item.status || 'parsed'),
            confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
            sourceName: typeof item.sourceName === 'string' ? item.sourceName : undefined,
        }
    }) : []
    const freshnessRecord = isRecord(record.freshness) ? record.freshness : {}
    const schedulerRecord = isRecord(record.scheduler) ? record.scheduler : {}
    const countsRecord = isRecord(record.counts) ? record.counts : {}
    return {
        generatedAt,
        status: String(record.status || (items.length ? 'stale' : 'waiting_for_collection')),
        freshness: {
            latestClaimAt: typeof freshnessRecord.latestClaimAt === 'string' || freshnessRecord.latestClaimAt === null ? freshnessRecord.latestClaimAt : undefined,
            ageMinutes: typeof freshnessRecord.ageMinutes === 'number' || freshnessRecord.ageMinutes === null ? freshnessRecord.ageMinutes : undefined,
            maxLiveAgeMinutes: typeof freshnessRecord.maxLiveAgeMinutes === 'number' ? freshnessRecord.maxLiveAgeMinutes : undefined,
        },
        scheduler: {
            state: typeof schedulerRecord.state === 'string' ? schedulerRecord.state : undefined,
            cadenceSeconds: typeof schedulerRecord.cadenceSeconds === 'number' ? schedulerRecord.cadenceSeconds : undefined,
        },
        counts: {
            visible: typeof countsRecord.visible === 'number' ? countsRecord.visible : undefined,
            needsReview: typeof countsRecord.needsReview === 'number' ? countsRecord.needsReview : undefined,
            metadataOnly: typeof countsRecord.metadataOnly === 'number' ? countsRecord.metadataOnly : undefined,
        },
        items,
    }
}

function emptyExposureQueue(generatedAt: string): ExposureQueue {
    return {
        generatedAt,
        status: 'waiting_for_collection',
        freshness: { latestClaimAt: null, ageMinutes: null, maxLiveAgeMinutes: 60 },
        scheduler: { state: 'due', cadenceSeconds: 300 },
        counts: { visible: 0, needsReview: 0, metadataOnly: 0 },
        items: [],
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

function exposureQueueLabel(status: string) {
    if (status === 'live') return 'Live'
    if (status === 'stale') return 'Stale'
    return 'Collecting'
}

function exposureQueueTone(status: string) {
    if (status === 'live') return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'
    if (status === 'stale') return 'border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]'
    return 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]'
}

function exposureQueueSubtitle(queue: ExposureQueue) {
    if (queue.status === 'live' && typeof queue.freshness?.ageMinutes === 'number') {
        return `Recent actor claims matched to watchlist terms; latest ${queue.freshness.ageMinutes}m ago`
    }
    if (queue.items.length) {
        return `Latest parsed claim ${formatClaimTime(queue.freshness?.latestClaimAt || queue.items[0]?.claimTime)}; collection ${queue.scheduler?.state || 'due'}`
    }
    return 'Awaiting scraper findings and Hanasand AI parser output'
}

function formatClaimTime(value?: string | null) {
    if (!value) return 'pending'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    }).format(date)
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || undefined
    return value
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
