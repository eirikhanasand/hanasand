import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Building2, ChevronRight, ExternalLink, Search, ShieldCheck, Waypoints } from 'lucide-react'
import LogoutClient from '@/components/logout/logoutClient'
import { buildRouteMetadata } from './seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Hanasand Threat Intelligence',
    description: 'Monitor ransomware victim claims, actor infrastructure, and company exposure with high-speed threat intelligence.',
    path: '/',
    keywords: ['hanasand', 'threat intelligence', 'ransomware monitoring', 'dark web monitoring', 'company exposure alerts'],
})

const examples = [
    {
        title: 'Company exposure monitor',
        slug: 'hanasand/company-exposure-monitor',
        detail: 'Watch company names, domains, suppliers, brands, and portfolio companies across recent victim-claim activity.',
        badge: 'Live alerts',
        signal: '12 min median refresh',
        icon: Building2,
    },
    {
        title: 'Ransomware actor overview',
        slug: 'hanasand/actor-overview',
        detail: 'Map actors to victims, claimed data, infrastructure changes, sectors, timelines, and review state.',
        badge: 'Graph ready',
        signal: 'Actor and victim pivots',
        icon: Waypoints,
    },
    {
        title: 'Dark web exposure index',
        slug: 'hanasand/darkweb-exposure-index',
        detail: 'Normalized actor, company, URL, note, claim, and timing fields from leak and extortion infrastructure.',
        badge: 'Indexed feeds',
        signal: 'Company and actor pivots',
        icon: ShieldCheck,
    },
]

const solutions = [
    {
        title: 'Threat Monitoring',
        detail: 'High-speed ransomware and exposure notifications for watched companies and vendors.',
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
    ['Refresh signal', 'New and changed actor-page claims'],
    ['Buyer workflow', 'Webhook, API, and console review queue'],
]

const feedRows = [
    { actor: 'Akira', company: 'Ntd Apparel', data: '62 GB claimed', claimedAt: '2026-06-27 10:42 UTC', status: 'current' },
    { actor: 'Aurora', company: 'Aerospace & Advanced Composites GmbH', data: '123 GB claimed', claimedAt: '2026-06-27 09:18 UTC', status: 'current' },
    { actor: 'RansomHouse', company: 'Irec Sas', data: 'new victim claim', claimedAt: '2026-06-26 22:31 UTC', status: 'recent' },
    { actor: 'Qilin', company: 'Supplier watchlist match', data: 'under review', claimedAt: '2026-06-26 18:05 UTC', status: 'review' },
]

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const logout = Boolean(Array.isArray(params.logout) ? params.logout[0] : params.logout) || false

    return (
        <main className='min-h-full bg-[#f7f8fb] text-[#16181d]'>
            <LogoutClient logoutServer={logout} />

            <section className='border-b border-[#e3e7ee] bg-[radial-gradient(circle_at_1px_1px,rgba(24,32,52,0.09)_1px,transparent_0)] bg-[length:22px_22px]'>
                <div className='mx-auto grid w-full max-w-7xl content-start gap-10 px-4 pb-12 pt-16 md:px-8 md:pt-24 lg:pt-28'>
                    <div className='mx-auto grid max-w-5xl justify-items-center gap-6 text-center'>
                        <Link href='/ti' className='landing-primary-action inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm transition'>
                            <span className='landing-inner-pill rounded-full px-2 py-0.5 text-xs'>New</span>
                            Direct actor-page monitoring for company exposure
                            <ArrowRight className='h-4 w-4' />
                        </Link>

                        <div className='grid gap-4'>
                            <h1 className='text-5xl font-semibold tracking-normal text-[#111318] md:text-7xl'>
                                Hanasand Threat Intelligence
                            </h1>
                            <p className='mx-auto max-w-3xl text-lg leading-8 text-[#596170] md:text-xl'>
                                High-speed company exposure alerts and actor overviews built from watched sources, fresh claim changes, and review-ready context.
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
                    </div>

                    <div className='grid gap-4 lg:grid-cols-3'>
                        {examples.map((item) => {
                            const Icon = item.icon
                            return (
                                <Link key={item.slug} href='/ti' className='group overflow-hidden rounded-lg border border-[#e0e5ed] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#c9d2df] hover:shadow-[0_18px_50px_rgba(26,35,55,0.12)]'>
                                    <div className='grid gap-4 p-5'>
                                        <div className='flex items-start justify-between gap-3'>
                                            <div className='grid h-12 w-12 place-items-center rounded-lg border border-[#dfe6f1] bg-[#f7f9fc] text-[#3056d3]'>
                                                <Icon className='h-5 w-5' />
                                            </div>
                                            <span className='landing-status-pill rounded-full border px-2.5 py-1 text-xs font-semibold'>{item.badge}</span>
                                        </div>
                                        <div className='grid gap-1'>
                                            <h2 className='text-lg font-semibold text-[#171a21]'>{item.title}</h2>
                                            <p className='font-mono text-sm text-[#737c8c]'>{item.slug}</p>
                                        </div>
                                        <p className='min-h-16 text-sm leading-6 text-[#596170]'>{item.detail}</p>
                                    </div>
                                    <div className='flex items-center justify-between border-t border-[#eef1f5] bg-[#f8fafc] px-5 py-3 text-sm'>
                                        <span className='font-medium text-[#2b3340]'>{item.signal}</span>
                                        <span className='landing-text-action inline-flex items-center gap-1 font-semibold'>Open <ExternalLink className='landing-action-icon h-3.5 w-3.5' /></span>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
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

                    <div className='overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-[0_20px_70px_rgba(26,35,55,0.10)]'>
                        <div className='flex items-center justify-between gap-4 border-b border-[#eef1f5] px-4 py-3'>
                            <div className='min-w-0'>
                                <h3 className='text-sm font-semibold text-[#171a21]'>Exposure queue</h3>
                                <p className='truncate text-xs text-[#737c8c]'>Recent actor claims matched to watchlist terms</p>
                            </div>
                            <span className='landing-live-pill shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold'>Live</span>
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
                                    {feedRows.map(({ actor, company, data, claimedAt, status }) => (
                                        <div key={`${actor}-${company}`} className='grid min-w-0 grid-cols-[6.5rem_minmax(12rem,1fr)_9rem_10.5rem_5rem] items-center gap-3 px-4 py-3 text-sm'>
                                            <span className='truncate font-semibold text-[#171a21]'>{actor}</span>
                                            <span className='truncate text-[#3d4656]'>{company}</span>
                                            <span className='truncate whitespace-nowrap text-[#596170]'>{data}</span>
                                            <time dateTime={claimedAt.replace(' UTC', 'Z').replace(' ', 'T')} className='truncate whitespace-nowrap font-mono text-xs text-[#596170]'>{claimedAt}</time>
                                            <span className='landing-status-pill justify-self-end whitespace-nowrap rounded-full border px-2 py-1 text-xs font-medium'>{status}</span>
                                        </div>
                                    ))}
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
