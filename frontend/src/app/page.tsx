import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ArrowRight, Building2, ChevronRight, ExternalLink, Search, ShieldCheck, Waypoints } from 'lucide-react'
import LogoutClient from '@/components/logout/logoutClient'
import { buildRouteMetadata } from './seo'
import HomeExposureQueueClient from './homeExposureQueueClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Hanasand Threat Intelligence',
    description: 'Monitor recent ransomware attacks, actor infrastructure, and company exposure with live threat intelligence built for security teams.',
    path: '/',
    keywords: ['hanasand', 'threat intelligence', 'ransomware monitoring', 'dark web monitoring', 'company exposure alerts'],
})

const examples = [
    {
        title: 'Company exposure monitor',
        slug: 'Watches companies and suppliers',
        detail: 'Enter the companies, domains, vendors, brands, or executives you care about. Hanasand watches for new mentions and sends a short alert.',
        badge: 'Live alerts',
        action: 'Recent attacks',
        icon: Building2,
    },
    {
        title: 'Plain-English incident brief',
        slug: 'Explains what happened',
        detail: 'Each result says who posted the claim, which company was named, what data was mentioned, how confident the match is, and what to do next.',
        badge: 'Actor context',
        action: 'See the context',
        icon: Waypoints,
    },
    {
        title: 'Dark web exposure index',
        slug: 'Searches leak and extortion records',
        detail: 'Search company names, domains, vendor names, actor names, source notes, claims, and timing from monitored public records.',
        badge: 'Searchable records',
        action: 'Find a company or actor',
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
        title: 'Trust and Procurement',
        detail: 'Security review, DPA, subprocessors, SLA notes, and current certification boundaries.',
        href: '/trust',
    },
    {
        title: 'Shared Reports',
        detail: 'Package exposure findings into customer-ready review links and follow-up steps.',
        href: '/contact?intent=reports',
    },
]

const stats = [
    ['Alert target', 'Company, vendor, domain, and brand mentions'],
    ['What gets sent', 'Actor, company, data mentioned, source, time, review status'],
    ['Freshness basis', 'New and changed leak-site posts'],
    ['Where it goes', 'Webhook, API, and analyst console'],
]

const workflowShortcuts = [
    { label: 'Search actor intel', href: '/ti/apt29', detail: 'Evidence, sources, and action rows' },
    { label: 'Inspect DWM queue', href: '/dashboard/dwm', detail: 'Alerts, cases, delivery, and source context' },
    { label: 'Compare fit', href: '/pricing#competitive-fit', detail: 'Where Hanasand should and should not win' },
    { label: 'Start pilot', href: '/contact?plan=pilot', detail: 'Watchlist, delivery, and security review' },
]

const operatorPaths = [
    {
        label: 'Monitor companies',
        state: 'Watchlists',
        value: 'Create terms for companies, vendors, domains, executives, and brands.',
        href: '/organizations',
    },
    {
        label: 'Triage exposure',
        state: 'DWM queue',
        value: 'Review matched source claims with evidence, freshness, confidence, and case context.',
        href: '/dashboard/dwm',
    },
    {
        label: 'Search actor intel',
        state: 'Threat intel',
        value: 'Inspect actor activity, sources, artifacts, watchlist fit, and handoff actions.',
        href: '/ti/apt29',
    },
    {
        label: 'Route notifications',
        state: 'Delivery',
        value: 'Send reviewed alerts to configured webhooks, APIs, and the analyst console.',
        href: '/dashboard/automations?setup=dwm',
    },
]

const customerSteps = [
    {
        title: 'Tell us what to watch',
        detail: 'Add company names, domains, subsidiaries, vendors, brands, executives, or portfolio companies.',
    },
    {
        title: 'We monitor criminal exposure sources',
        detail: 'Hanasand checks leak and extortion sites, Telegram-like public channels, advisories, and source indexes.',
    },
    {
        title: 'You get a triage alert',
        detail: 'The alert explains the mention, source, severity, confidence, source context, and the next review step.',
    },
    {
        title: 'Route it to the right team',
        detail: 'Send the packet to email, API, webhook, Slack/Jira/SIEM flows, or the analyst console.',
    },
]

type ExposureQueueItem = {
    id: string
    actor: string
    company: string
    claimedData: string
    claimTime?: string
    collectedAt?: string
    status: string
    sourceName?: string
}

type ExposureQueue = {
    generatedAt: string
    status: 'live' | 'stale' | 'empty' | 'checking' | 'unavailable' | string
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
        total?: number
        needsReview?: number
        metadataOnly?: number
    }
    page?: {
        limit?: number
        offset?: number
        total?: number
        nextOffset?: number | null
        hasMore?: boolean
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
    const Headers = await headers()
    const generatedAt = new Date().toISOString()
    const exposureQueue = await loadExposureQueue(Headers) || emptyExposureQueue(generatedAt)

    return (
        <main className='min-h-full bg-ui-canvas text-ui-text'>
            <LogoutClient logoutServer={logout} />

            <section className='border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid w-full max-w-7xl content-start gap-10 px-4 pb-12 pt-16 md:px-8 md:pt-24 lg:pt-28'>
                    <div className='mx-auto grid max-w-5xl justify-items-center gap-6 text-center'>
                        <Link href='/ti' className='landing-primary-action inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm transition'>
                            <span className='landing-inner-pill rounded-full px-2 py-0.5 text-xs'>New</span>
                            Monitor a company or vendor
                            <ArrowRight className='h-4 w-4' />
                        </Link>

                        <div className='grid gap-4'>
                            <h1 className='text-5xl font-semibold tracking-normal text-ui-text md:text-7xl'>
                                Know when your company appears in leak and extortion sources
                            </h1>
                            <p className='mx-auto max-w-3xl text-lg leading-8 text-ui-muted md:text-xl'>
                                Give Hanasand the names and domains to watch. We return a clear alert with what happened, why it matters, source context, severity, and the next step.
                            </p>
                        </div>

                        <form action='/ti' className='landing-search-bar grid w-full max-w-3xl gap-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-0 shadow-md md:grid-cols-[1fr_auto]'>
                            <label className='landing-search-field flex min-w-0 items-center gap-3 px-4'>
                                <Search className='h-5 w-5 shrink-0 text-ui-muted' />
                                <input
                                    name='q'
                                    aria-label='Search threat intelligence'
                                    placeholder='Search a company, vendor, domain, or actor'
                                    className='landing-search-input h-14 min-w-0 flex-1 bg-transparent text-base font-medium text-ui-text outline-none placeholder:text-ui-muted'
                                />
                            </label>
                            <button type='submit' className='landing-search-button inline-flex h-14 items-center justify-center gap-2 px-5 text-sm font-semibold transition'>
                                Search intelligence
                                <ChevronRight className='h-4 w-4' />
                            </button>
                        </form>

                        <div className='grid w-full max-w-5xl gap-2 sm:grid-cols-2 lg:grid-cols-4' aria-label='Operator shortcuts'>
                            {workflowShortcuts.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className='landing-surface-border landing-surface-border-hover grid min-w-0 gap-1 rounded-lg border border-ui-border bg-ui-panel px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-ui-primary'
                                >
                                    <span className='flex min-w-0 items-center justify-between gap-2 text-sm font-semibold text-ui-text'>
                                        <span className='truncate'>{item.label}</span>
                                        <ArrowRight className='h-4 w-4 shrink-0 text-ui-primary' />
                                    </span>
                                    <span className='text-xs leading-5 text-ui-muted'>{item.detail}</span>
                                </Link>
                            ))}
                        </div>

                        <HomeOperatorStrip />
                    </div>

                    <div className='landing-surface-border grid overflow-hidden rounded-xl border border-ui-border bg-ui-panel shadow-sm' id='sample-alert' data-home-workflow-panel='true'>
                        <div className='landing-surface-divider grid gap-3 border-b p-5 md:grid-cols-[0.8fr_1.2fr] md:items-end' data-home-workflow-panel-header='true'>
                            <div>
                                <p className='text-sm font-semibold uppercase text-ui-primary'>Plain-English alert path</p>
                                <h2 className='mt-2 text-2xl font-semibold text-ui-text'>From watchlist to decision packet.</h2>
                            </div>
                            <p className='text-sm leading-6 text-ui-muted'>
                                A threat actor is a criminal group or seller. A source is where the mention appeared. A webhook is just an automatic delivery to your existing tools.
                            </p>
                        </div>
                        <div className='grid gap-0 md:grid-cols-4'>
                            {customerSteps.map((step, index) => (
                                <div key={step.title} className='landing-surface-divider grid gap-3 border-b p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0' data-home-workflow-step='true'>
                                    <span className='grid h-9 w-9 place-items-center rounded-full bg-ui-primary/10 text-sm font-semibold text-ui-primary'>{index + 1}</span>
                                    <h3 className='text-base font-semibold text-ui-text'>{step.title}</h3>
                                    <p className='text-sm leading-6 text-ui-muted'>{step.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='grid gap-4 lg:grid-cols-3'>
                        {examples.map((item) => {
                            const Icon = item.icon
                            return (
                                <Link key={item.slug} href='/ti' className='landing-surface-border landing-surface-border-hover group overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm transition hover:-translate-y-0.5 hover:border-ui-primary hover:shadow-md' data-home-example-card='true'>
                                    <div className='grid gap-4 p-5'>
                                        <div className='flex items-start justify-between gap-3'>
                                            <div className='grid h-12 w-12 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                                <Icon className='h-5 w-5' />
                                            </div>
                                            <span className='landing-status-pill rounded-full border px-2.5 py-1 text-xs font-semibold'>{item.badge}</span>
                                        </div>
                                        <div className='grid gap-1'>
                                            <h2 className='text-lg font-semibold text-ui-text'>{item.title}</h2>
                                            <p className='text-sm font-medium text-ui-muted'>{item.slug}</p>
                                        </div>
                                        <p className='min-h-16 text-sm leading-6 text-ui-muted'>{item.detail}</p>
                                    </div>
                                    <div className='landing-surface-divider flex items-center justify-between border-t bg-ui-raised px-5 py-3 text-sm' data-home-example-card-footer='true'>
                                        <span className='font-medium text-ui-text'>{item.action}</span>
                                        <span className='landing-text-action inline-flex items-center gap-1 font-semibold'>Open <ExternalLink className='landing-action-icon h-3.5 w-3.5' /></span>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>

                    <HomeOperatorPaths />
                </div>
            </section>

            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:py-18'>
                    <div className='grid content-start gap-5'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>How monitoring works</p>
                        <h2 className='text-3xl font-semibold text-ui-text md:text-4xl'>Find the company mention before it becomes a forwarded screenshot.</h2>
                        <p className='text-base leading-7 text-ui-muted'>
                            Each alert is built for the first triage decision: who posted it, which company was named, what data was mentioned, when it appeared, and what to review next.
                        </p>
                        <div className='grid gap-3'>
                            {stats.map(([label, value]) => (
                                <div key={label} className='grid grid-cols-[10rem_1fr] gap-4 border-b border-ui-border py-3 text-sm'>
                                    <span className='text-ui-muted'>{label}</span>
                                    <span className='font-semibold text-ui-text'>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <HomeExposureQueueClient initialQueue={exposureQueue} />
                </div>
            </section>

            <section className='bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
                        <div className='grid gap-2'>
                            <p className='text-sm font-semibold uppercase text-ui-primary'>Solutions</p>
                            <h2 className='text-3xl font-semibold text-ui-text'>Monitoring and secure response tools in one place.</h2>
                        </div>
                        <Link href='/dashboard/overview' className='landing-primary-action inline-flex w-fit items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition'>
                            Go to Console
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>

                    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                        {solutions.map((solution) => (
                            <Link key={solution.title} href={solution.href} className='landing-surface-border landing-surface-border-hover grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-ui-primary' data-home-solution-card='true'>
                                <div className='flex items-center justify-between gap-3'>
                                    <h3 className='text-base font-semibold text-ui-text'>{solution.title}</h3>
                                    <ArrowRight className='landing-action-icon h-4 w-4' />
                                </div>
                                <p className='text-sm leading-6 text-ui-muted'>{solution.detail}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    )
}

function HomeOperatorStrip() {
    return (
        <div
            className='landing-surface-border grid w-full max-w-6xl gap-3 rounded-xl border border-ui-border bg-ui-panel/90 p-3 text-left shadow-sm backdrop-blur sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.95fr_1.5fr_auto]'
            data-home-product-status='true'
        >
            <HomeOperatorFact label='Product' value='Company exposure monitoring for security teams' />
            <HomeOperatorFact label='Coverage' value='Companies, vendors, domains, actors, and sources' />
            <HomeOperatorFact label='Alert packet' value='Source, evidence, confidence, freshness, and next action' />
            <HomeOperatorFact label='Delivery' value='Webhook, API, and analyst console routing' />
            <HomeOperatorFact label='Setup path' value='Create an organization, add watchlists, route reviewed alerts' />
            <Link
                href='/dashboard'
                className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm font-semibold text-ui-primary transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20'
            >
                Open console
                <ArrowRight className='h-4 w-4' />
            </Link>
        </div>
    )
}

function HomeOperatorFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='landing-surface-border min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 py-2' data-home-status-fact='true'>
            <p className='text-[11px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 line-clamp-2 text-sm font-semibold leading-5 text-ui-text'>{value}</p>
        </div>
    )
}

function HomeOperatorPaths() {
    return (
        <section
            className='landing-surface-border overflow-hidden rounded-xl border border-ui-border bg-ui-panel/95 shadow-sm backdrop-blur'
            data-home-operator-paths='true'
        >
            <div className='landing-surface-divider grid gap-2 border-b px-4 py-4 md:grid-cols-[1fr_auto] md:items-end' data-home-operator-paths-header='true'>
                <div>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>Operator paths</p>
                    <h2 className='mt-1 text-xl font-semibold text-ui-text'>Core DWM actions in the console</h2>
                </div>
                <Link
                    href='/dashboard'
                    className='inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm font-semibold text-ui-primary transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20'
                >
                    Inspect console
                    <ArrowRight className='h-4 w-4' />
                </Link>
            </div>
            <div>
                <div className='landing-surface-divider hidden grid-cols-[1.1fr_8rem_1.5fr_8rem] gap-3 border-b px-4 py-2 text-[0.68rem] font-semibold uppercase text-ui-muted md:grid' data-home-workflow-coverage-table-header='true'>
                    <span>Use case</span>
                    <span>State</span>
                    <span>Customer value</span>
                    <span className='text-right'>Action</span>
                </div>
                <div className='divide-y landing-surface-divider'>
                    {operatorPaths.map(item => (
                        <div
                            key={item.href}
                            className='grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.1fr_8rem_1.5fr_8rem] md:items-center md:py-3'
                            data-home-operator-path={item.href}
                        >
                            <div className='min-w-0'>
                                <p className='wrap-break-word font-semibold text-ui-text'>{item.label}</p>
                                <p className='mt-1 wrap-break-word text-xs text-ui-muted'>{item.state}</p>
                            </div>
                            <span className='w-fit rounded-full border border-ui-primary/30 bg-ui-primary/10 px-2.5 py-1 text-xs font-semibold text-ui-primary'>
                                Open
                            </span>
                            <p className='min-w-0 wrap-break-word text-ui-muted'>{item.value}</p>
                            <Link href={item.href} className='inline-flex min-h-9 min-w-20 w-fit items-center justify-center px-3 py-2 text-sm font-semibold text-ui-primary hover:text-ui-text focus:outline-none focus:ring-2 focus:ring-ui-primary/20 md:justify-self-end'>
                                Open
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

async function loadExposureQueue(requestHeaders: Headers): Promise<ExposureQueue | null> {
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
    if (!host) return null
    const proto = requestHeaders.get('x-forwarded-proto') || 'http'
    const target = new URL('/api/dwm/exposure-queue', `${proto}://${host}`)
    target.searchParams.set('limit', '10')
    target.searchParams.set('offset', '0')

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
            claimedData: String(item.claimedData || 'new company mention'),
            claimTime: typeof item.claimTime === 'string' ? item.claimTime : undefined,
            collectedAt: typeof item.collectedAt === 'string' ? item.collectedAt : undefined,
            status: String(item.status || 'parsed'),
            sourceName: typeof item.sourceName === 'string' ? item.sourceName : undefined,
        }
    }) : []
    const freshnessRecord = isRecord(record.freshness) ? record.freshness : {}
    const schedulerRecord = isRecord(record.scheduler) ? record.scheduler : {}
    const countsRecord = isRecord(record.counts) ? record.counts : {}
    return {
        generatedAt,
        status: String(record.status || (items.length ? 'stale' : 'checking')),
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
            total: typeof countsRecord.total === 'number' ? countsRecord.total : undefined,
            needsReview: typeof countsRecord.needsReview === 'number' ? countsRecord.needsReview : undefined,
            metadataOnly: typeof countsRecord.metadataOnly === 'number' ? countsRecord.metadataOnly : undefined,
        },
        page: (() => {
            const pageRecord = isRecord(record.page) ? record.page : {}
            return {
                limit: typeof pageRecord.limit === 'number' ? pageRecord.limit : undefined,
                offset: typeof pageRecord.offset === 'number' ? pageRecord.offset : undefined,
                total: typeof pageRecord.total === 'number' ? pageRecord.total : undefined,
                nextOffset: typeof pageRecord.nextOffset === 'number' || pageRecord.nextOffset === null ? pageRecord.nextOffset : undefined,
                hasMore: typeof pageRecord.hasMore === 'boolean' ? pageRecord.hasMore : undefined,
            }
        })(),
        items,
    }
}

function emptyExposureQueue(generatedAt: string): ExposureQueue {
    return {
        generatedAt,
        status: 'checking',
        freshness: { latestClaimAt: null, ageMinutes: null, maxLiveAgeMinutes: 60 },
        scheduler: { state: 'due', cadenceSeconds: 300 },
        counts: { visible: 0, needsReview: 0, metadataOnly: 0 },
        page: { limit: 10, offset: 0, total: 0, nextOffset: null, hasMore: false },
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

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || undefined
    return value
}
