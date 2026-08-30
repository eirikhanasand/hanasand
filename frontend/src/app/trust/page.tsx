import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, ArrowRight, BellRing, BookOpenCheck, Database, Eye, FileCheck2, Gauge, LockKeyhole, Radio, Waypoints, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Trust Center',
    description: 'See how Hanasand turns public intelligence into alerts your team can review and use.',
    path: '/trust',
    keywords: ['hanasand trust center', 'hanasand security', 'threat intelligence', 'security operations'],
})

const capabilities = [
    {
        title: 'Monitor useful public sources',
        detail: 'We check selected public sources and show the activity that matters to your team.',
        icon: Database,
        href: '/coverage',
        link: 'View source coverage',
    },
    {
        title: 'Watch the names that matter',
        detail: 'Add companies, domains, vendors, brands, and products to your watchlist.',
        icon: Eye,
        href: '/dwm',
        link: 'See monitoring workflow',
    },
    {
        title: 'See why an alert was raised',
        detail: 'Every alert includes the source, time, and details behind the match.',
        icon: FileCheck2,
        href: '/ti/apt29',
        link: 'Inspect intelligence evidence',
    },
    {
        title: 'Take action on alerts',
        detail: 'Review alerts, assign them, add notes, and send them to your existing tools.',
        icon: Workflow,
        href: '/contact?intent=procurement',
        link: 'Request a workflow review',
    },
]

const alertPath = [
    ['01', 'Watchlist match', 'A name on your watchlist appears in a public source.'],
    ['02', 'Alert details', 'The alert shows the source, time, and matching text.'],
    ['03', 'Review', 'Your team checks the details and decides what to do.'],
    ['04', 'Next step', 'Send the alert to the right person or tool.'],
]

const enterpriseFoundations: Array<[string, string, LucideIcon]> = [
    ['Separate customer data', 'Each customer sees only their own watchlists and alerts.', LockKeyhole],
    ['Your watchlists', 'Choose the companies, domains, vendors, and brands to monitor.', Eye],
    ['Traceable alerts', 'Alerts include the source, time, and details used to create them.', FileCheck2],
    ['Current information', 'See when a source was last checked and when an alert was found.', Gauge],
    ['Useful follow-up', 'Assign alerts, add notes, and send them where your team works.', Waypoints],
    ['Managed sources', 'Sources are monitored and their status is tracked.', BookOpenCheck],
]

const trustPractices = [
    ['Clear alerts', 'Findings include the details your team needs to review them.'],
    ['Source shown', 'See where each finding came from.'],
    ['Honest freshness indicators', 'Collection and observation timing remain visible so teams can judge how current a finding is.'],
    ['Collection status', 'See whether sources are being checked and when the last check succeeded.'],
    ['Source controls', 'Sources can be enabled, disabled, and reviewed.'],
    ['Public status', 'Check the current status of the service.'],
    ['Alert history', 'Review what happened from the first match to the alert.'],
]

export default function TrustPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(25rem,0.72fr)] lg:items-center'>
                    <div className='grid gap-5'>
                        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-ui-primary'>Trust center</p>
                        <h1 className='max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl'>Threat intelligence your team can act on.</h1>
                        <p className='max-w-3xl text-lg leading-8 text-ui-muted'>
                            Hanasand checks public sources against your watchlists and sends alerts when it finds a match.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/dwm' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                                See Hanasand in action
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/contact?intent=procurement' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                Request a security review
                            </Link>
                        </div>
                    </div>

                    <AlertPathPreview />
                </div>
            </section>

            <section id='operational-today' className='scroll-mt-24 border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-7 px-4 py-12 md:px-8'>
                    <SectionIntro eyebrow='How it works' title='From a public mention to a useful alert.' detail='Monitor the sources you care about, review what we find, and send alerts to your team.' />
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                        {capabilities.map((item) => <CapabilityCard key={item.title} {...item} />)}
                    </div>
                </div>
            </section>

            <section id='enterprise-workflows' className='scroll-mt-24 border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-7 px-4 py-12 md:px-8'>
                    <SectionIntro eyebrow='For security teams' title='The details stay with the alert.' detail='Hanasand keeps monitoring focused and gives your team the information needed to review each finding.' />
                    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                        {enterpriseFoundations.map(([title, detail, Icon]) => (
                            <div key={title} className='rounded-lg border border-ui-border bg-ui-canvas p-4'>
                                <Icon className='h-5 w-5 text-ui-primary' />
                                <h3 className='mt-4 text-base font-semibold'>{title}</h3>
                                <p className='mt-2 text-sm leading-6 text-ui-muted'>{detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id='trust-in-practice' className='scroll-mt-24 border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-7 px-4 py-12 md:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start'>
                    <SectionIntro eyebrow='How we build trust' title='You can see what happened.' detail='Check what we found, when we found it, where it came from, and what happened next.' />
                    <div className='grid gap-3 sm:grid-cols-2'>
                        {trustPractices.map(([title, detail]) => (
                            <div key={title} className='flex gap-3 rounded-lg border border-ui-border bg-ui-panel p-4'>
                                <span className='mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-ui-success shadow-[0_0_14px_rgba(49,196,141,0.55)]' />
                                <div>
                                    <h3 className='text-sm font-semibold'>{title}</h3>
                                    <p className='mt-1 text-sm leading-6 text-ui-muted'>{detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id='product-evidence' className='scroll-mt-24 border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-7 px-4 py-12 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center'>
                    <div className='grid gap-4'>
                        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-ui-primary'>See it for yourself</p>
                        <h2 className='text-3xl font-semibold'>Review the product before you buy.</h2>
                        <p className='max-w-2xl text-sm leading-6 text-ui-muted'>
                            Open the product to check source coverage, alerts, monitoring, and service status.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/coverage' className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold transition hover:border-ui-primary'>
                                Source coverage <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/status' className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold transition hover:border-ui-primary'>
                                Service status <Activity className='h-4 w-4' />
                            </Link>
                        </div>
                    </div>
                    <div className='rounded-xl border border-ui-border bg-ui-canvas p-4 shadow-sm'>
                        <div className='flex items-center justify-between border-b border-ui-border pb-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase tracking-[0.12em] text-ui-primary'>Alert process</p>
                                <h3 className='mt-1 text-lg font-semibold'>From match to case</h3>
                            </div>
                            <BellRing className='h-5 w-5 text-ui-primary' />
                        </div>
                        <div className='divide-y divide-ui-border'>
                            {alertPath.map(([number, title, detail]) => (
                                <div key={number} className='grid grid-cols-[2.25rem_1fr] gap-3 py-4'>
                                    <span className='grid h-8 w-8 place-items-center rounded-md border border-ui-border bg-ui-raised text-xs font-semibold text-ui-primary'>{number}</span>
                                    <div>
                                        <h4 className='text-sm font-semibold'>{title}</h4>
                                        <p className='mt-1 text-sm leading-6 text-ui-muted'>{detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className='bg-ui-canvas'>
                <div className='mx-auto flex max-w-7xl flex-col gap-5 px-4 py-12 md:px-8 lg:flex-row lg:items-center lg:justify-between'>
                    <div>
                        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-ui-primary'>Security review</p>
                        <h2 className='mt-2 max-w-3xl text-3xl font-semibold'>See how Hanasand turns public intelligence into useful alerts.</h2>
                    </div>
                    <div className='flex flex-wrap gap-3 lg:justify-end'>
                        <Link href='/dwm' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                            See Hanasand in action
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                        <Link href='/contact?intent=procurement' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold transition hover:border-ui-primary'>
                            Request a security review
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    )
}

function AlertPathPreview() {
    return <aside className='rounded-xl border border-ui-border bg-ui-raised p-4 shadow-sm'>
        <div className='flex items-center justify-between border-b border-ui-border pb-3'>
            <div>
        <p className='text-xs font-semibold uppercase tracking-[0.12em] text-ui-primary'>Monitoring</p>
                <p className='mt-1 text-sm font-semibold'>A clear path from match to alert</p>
            </div>
            <Radio className='h-5 w-5 text-ui-success' />
        </div>
        <div className='divide-y divide-ui-border'>
            {alertPath.map(([number, title, detail]) => (
                <div key={number} className='grid grid-cols-[2.25rem_1fr] gap-3 py-4 last:pb-1'>
                    <span className='grid h-8 w-8 place-items-center rounded-md border border-ui-border bg-ui-panel text-xs font-semibold text-ui-primary'>{number}</span>
                    <div>
                        <p className='text-sm font-semibold'>{title}</p>
                        <p className='mt-1 text-xs leading-5 text-ui-muted'>{detail}</p>
                    </div>
                </div>
            ))}
        </div>
    </aside>
}

function CapabilityCard({ title, detail, icon: Icon, href, link }: { title: string; detail: string; icon: LucideIcon; href: string; link: string }) {
    return <Link href={href} className='group grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm transition hover:border-ui-primary'>
        <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'><Icon className='h-5 w-5' /></span>
        <div>
            <h3 className='text-lg font-semibold'>{title}</h3>
            <p className='mt-2 text-sm leading-6 text-ui-muted'>{detail}</p>
        </div>
        <span className='inline-flex items-center gap-2 text-sm font-semibold text-ui-primary'>{link}<ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' /></span>
    </Link>
}

function SectionIntro({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
    return <div className='grid content-start gap-3'>
        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-ui-primary'>{eyebrow}</p>
        <h2 className='max-w-3xl text-3xl font-semibold'>{title}</h2>
        <p className='max-w-3xl text-sm leading-6 text-ui-muted'>{detail}</p>
    </div>
}
