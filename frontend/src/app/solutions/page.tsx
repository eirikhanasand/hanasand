import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BellRing, Code2, Database, Gauge, Globe2, LockKeyhole, Network, Radar, ShieldCheck, Waypoints } from 'lucide-react'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Solutions',
    description: 'Threat monitoring, browser sandbox workspaces, dark web monitoring, and private exposure-checking solutions from Hanasand.',
    path: '/solutions',
    keywords: ['onion session workspace', 'dark web monitoring', 'ransomware monitoring', 'company exposure alerts', 'threat intelligence API'],
})

const primarySolutions = [
    {
        title: 'Dark Web Monitoring',
        eyebrow: 'Monitoring',
        detail: 'Watch companies, domains, executives, brands, and vendors across leak-site updates, public indexes, advisories, and approved source records.',
        href: '/solutions/dwm',
        icon: ShieldCheck,
        points: ['Mapped source coverage with active health checks', 'Company, vendor, actor, and criminal-group claims', 'Alert packet with confidence, source context, and next action'],
        price: 'From $49/mo',
    },
    {
        title: 'Browser',
        eyebrow: 'URL analysis',
        detail: 'Open untrusted regular-web and onion URLs in one isolated browser workspace with automatic routing, redirect capture, and saved SOC triage profiles.',
        href: '/solutions/browser',
        icon: Globe2,
        points: ['Regular and Tor modes under one queue', 'Saved VirusTotal, urlquery, and WebCrack profiles', 'Screenshot timeline with analyst summary'],
        price: 'Bundled with monitoring',
    },
    {
        title: 'Threat Intelligence Search',
        eyebrow: 'Console',
        detail: 'Search criminal groups, companies, CVEs, and monitored claims from one clean UI while preserving review state and alert context.',
        href: '/ti',
        icon: Radar,
        points: ['Criminal-group overviews', 'Company exposure search', 'Alert context'],
        price: 'Console',
    },
]

const utilitySolutions = [
    {
        title: 'Bloom Hash Exposure Lookup',
        eyebrow: 'Separate utility',
        detail: 'Check exposure from a SHA-1 hash through the standalone prefix lookup. This stays separate from company exposure monitoring.',
        href: '/pwned',
        icon: LockKeyhole,
        points: ['Hash-only utility flow', 'Exact-match result', 'Prefix-only range request'],
        price: 'Utility',
    },
    {
        title: 'Endpoint Checks',
        eyebrow: 'Separate utility',
        detail: 'Run permitted checks against URLs you control. This is a service-checking utility, separate from company exposure monitoring.',
        href: '/test',
        icon: Gauge,
        points: ['5 checks before payment', 'Starter and team tiers', 'Shareable result links'],
        price: 'Free trial',
    },
]

const platformItems = [
    { title: 'Short-span access', detail: 'Session controls for short-lived onion review, with source safety boundaries built into the workspace.', icon: Network },
    { title: 'API delivery', detail: 'Structured fields for criminal group, company, source, date, claim summary, and recommended action.', icon: Code2 },
    { title: 'Investigation pivots', detail: 'Jump between group, named company, sector, country, source, and CVE context without losing the alert.', icon: Waypoints },
    { title: 'Notification pipeline', detail: 'Small alert packets designed for Slack, incident queues, and vendor-risk workflows.', icon: BellRing },
    { title: 'Exposure index', detail: 'Searchable company and criminal-group records without exposing raw leaked material.', icon: Database },
]

export default function SolutionsPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-8 md:py-22'>
                    <div className='grid max-w-4xl gap-5'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Solutions</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-6xl'>Fast company exposure monitoring, packaged for teams that need answers now.</h1>
                        <p className='max-w-3xl text-lg leading-8 text-ui-muted'>
                            Hanasand turns leak sites, public indexes, and watched sources into alerts and API records that show your team who was mentioned, what data was listed, when it changed, and what to review next.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/solutions/dwm' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                                View dark web monitoring
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/contact' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                Contact sales
                            </Link>
                        </div>
                    </div>

                    <div className='grid gap-4 lg:grid-cols-3'>
                        {primarySolutions.map((solution) => {
                            const Icon = solution.icon
                            return (
                                <Link key={solution.title} href={solution.href} className='group grid gap-5 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-ui-primary hover:shadow-md'>
                                    <div className='flex items-start justify-between gap-3'>
                                        <span className='grid h-12 w-12 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                            <Icon className='h-5 w-5' />
                                        </span>
                                        <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-primary'>{solution.eyebrow}</span>
                                    </div>
                                    <div className='grid gap-2'>
                                        <h2 className='text-xl font-semibold text-ui-text'>{solution.title}</h2>
                                        <p className='text-sm leading-6 text-ui-muted'>{solution.detail}</p>
                                    </div>
                                    <div className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-text'>
                                        {solution.price}
                                    </div>
                                    <div className='grid gap-2 border-t border-ui-border pt-4'>
                                        {solution.points.map(point => (
                                            <span key={point} className='flex items-start gap-2 text-sm leading-6 text-ui-text'>
                                                <span className='mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ui-primary' />
                                                {point}
                                            </span>
                                        ))}
                                    </div>
                                    <span className='inline-flex items-center gap-2 text-sm font-semibold text-ui-primary'>
                                        Open solution
                                        <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                    </span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className='bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-14 md:px-8 lg:grid-cols-[0.72fr_1.28fr]'>
                    <div className='grid content-start gap-3'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Platform fit</p>
                        <h2 className='text-3xl font-semibold'>Built for notification and review workflows, not data dumps.</h2>
                    </div>
                    <div className='grid gap-4 md:grid-cols-2'>
                        {platformItems.map((item) => {
                            const Icon = item.icon
                            return (
                                <article key={item.title} className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                                    <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                                        <span className='text-ui-primary'><Icon className='h-4 w-4' /></span>
                                        {item.title}
                                    </div>
                                    <p className='text-sm leading-6 text-ui-muted'>{item.detail}</p>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className='border-t border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-4 px-4 py-10 md:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-ui-muted'>Also available</p>
                        <h2 className='mt-2 text-2xl font-semibold text-ui-text'>Utilities stay separate from the monitoring buyer journey.</h2>
                    </div>
                    <div className='grid gap-4 md:grid-cols-2'>
                        {utilitySolutions.map((solution) => {
                            const Icon = solution.icon
                            return (
                                <Link key={solution.title} href={solution.href} className='group grid gap-3 rounded-lg border border-ui-border bg-ui-canvas p-4 transition hover:border-ui-primary hover:bg-ui-panel'>
                                    <div className='flex items-start justify-between gap-3'>
                                        <span className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                            <Icon className='h-4 w-4' />
                                        </span>
                                        <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-muted'>{solution.eyebrow}</span>
                                    </div>
                                    <h3 className='text-lg font-semibold text-ui-text'>{solution.title}</h3>
                                    <p className='text-sm leading-6 text-ui-muted'>{solution.detail}</p>
                                    <span className='inline-flex items-center gap-2 text-sm font-semibold text-ui-primary'>
                                        Open utility
                                        <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                    </span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </section>
        </main>
    )
}
