import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Building2, CheckCircle2, Radar, ShieldCheck, Waypoints } from 'lucide-react'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'About Hanasand',
    description: 'Hanasand builds company exposure monitoring and ransomware actor intelligence from recent, reviewable records.',
    path: '/about',
    keywords: ['hanasand about', 'threat intelligence company', 'ransomware monitoring'],
})

const principles = [
    {
        title: 'Direct monitoring finds the mention',
        detail: 'Public indexes help corroborate coverage while direct source checks, freshness logic, and company watchlists create the alert value.',
        icon: Radar,
    },
    {
        title: 'Clean fields make alerts usable',
        detail: 'Every alert should tell the buyer the actor, company, data mentioned, timing, source, sector, country, review status, and delivery history.',
        icon: Waypoints,
    },
    {
        title: 'Alerts should be fast and usable',
        detail: 'The goal is notification packets a security team can route, review, and act on quickly.',
        icon: ShieldCheck,
    },
]

const focus = [
    'Recent ransomware attacks and leak-site changes',
    'Company, domain, brand, subsidiary, and supplier watchlists',
    'Actor overviews shaped for UI navigation and analyst review',
    'Separate password exposure checks where sensitive values should stay out of dashboards',
]

export default function AboutPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center'>
                    <div className='grid gap-5'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Company</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-6xl'>Hanasand monitors company exposure across leak sites and recent claims.</h1>
                        <p className='max-w-2xl text-lg leading-8 text-ui-muted'>
                            The product centers on high-speed, reviewable threat intelligence: recent mentions, actor context, company matching, and clean delivery.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/ti' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                                Open intelligence search
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/contact' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                Contact sales
                            </Link>
                            <Link href='/trust' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                Trust center
                            </Link>
                        </div>
                    </div>

                    <div className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4 shadow-md'>
                        <div className='rounded-lg border border-ui-border bg-ui-panel p-5'>
                            <div className='flex items-center gap-3'>
                                <span className='grid h-12 w-12 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                    <Building2 className='h-5 w-5' />
                                </span>
                                <div>
                                    <h2 className='text-lg font-semibold'>Current product focus</h2>
                                    <p className='text-sm text-ui-muted'>Monitoring workflows for buyers who need recent exposure activity.</p>
                                </div>
                            </div>
                            <div className='mt-5 grid gap-3'>
                                {focus.map((item) => (
                                    <div key={item} className='flex items-start gap-2 text-sm leading-6 text-ui-text'>
                                        <CheckCircle2 className='mt-1 h-4 w-4 shrink-0 text-ui-success' />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className='bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-4 px-4 py-12 md:px-8 lg:grid-cols-3'>
                    {principles.map((item) => {
                        const Icon = item.icon
                        return (
                            <article key={item.title} className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
                                <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                    <Icon className='h-5 w-5' />
                                </span>
                                <div className='grid gap-2'>
                                    <h2 className='text-lg font-semibold'>{item.title}</h2>
                                    <p className='text-sm leading-6 text-ui-muted'>{item.detail}</p>
                                </div>
                            </article>
                        )
                    })}
                </div>
            </section>
        </main>
    )
}
