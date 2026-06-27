import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BellRing, Code2, Database, Gauge, LockKeyhole, Radar, ShieldCheck, Waypoints } from 'lucide-react'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Solutions',
    description: 'Threat monitoring, dark web monitoring, and private exposure-checking solutions from Hanasand.',
    path: '/solutions',
    keywords: ['dark web monitoring', 'ransomware monitoring', 'company exposure alerts', 'threat intelligence API'],
})

const primarySolutions = [
    {
        title: 'Dark Web Monitoring',
        eyebrow: 'Buyer-ready',
        detail: 'Monitor company, vendor, domain, and brand mentions across ransomware and extortion infrastructure with webhook-ready notification packets.',
        href: '/solutions/dwm',
        icon: ShieldCheck,
        points: ['Company and vendor watchlists', 'Actor and claim context', 'Webhook delivery examples'],
    },
    {
        title: 'Threat Intelligence Search',
        eyebrow: 'Console',
        detail: 'Search actors, companies, CVEs, and monitored claims from one clean UI while preserving review state and alert context.',
        href: '/ti',
        icon: Radar,
        points: ['Actor overviews', 'Company exposure search', 'Alert context'],
    },
    {
        title: 'Bloom Filter Exposure Checks',
        eyebrow: 'Privacy-first',
        detail: 'Check sensitive values without turning password or breach material into a public dashboard.',
        href: '/pwned',
        icon: LockKeyhole,
        points: ['Private matching', 'Low-friction checks', 'Clean customer workflow'],
    },
    {
        title: 'Load Testing',
        eyebrow: '5 free tries',
        detail: 'Run permitted endpoint checks against URLs you control, keep result links, and upgrade into monthly check tiers when launch work gets serious.',
        href: '/test',
        icon: Gauge,
        points: ['5 checks before payment', 'Starter and team tiers', 'Shareable result links'],
    },
]

const platformItems = [
    { title: 'API delivery', detail: 'Structured fields for actor, company, source, date, claim summary, and recommended action.', icon: Code2 },
    { title: 'Graph pivots', detail: 'Actor, victim, sector, country, source, and CVE pivots that fit analyst workflows.', icon: Waypoints },
    { title: 'Notification pipeline', detail: 'Webhook-shaped packets designed for Slack, incident queues, and vendor-risk workflows.', icon: BellRing },
    { title: 'Exposure index', detail: 'Searchable company and actor records without exposing raw leaked material.', icon: Database },
]

export default function SolutionsPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] text-[#171a21]'>
            <section className='border-b border-[#e3e7ee] bg-white'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-8 md:py-22'>
                    <div className='grid max-w-4xl gap-5'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Solutions</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-6xl'>Fast company exposure monitoring, packaged for teams that need answers now.</h1>
                        <p className='max-w-3xl text-lg leading-8 text-[#596170]'>
                            Hanasand turns actor pages, public indexes, and watched sources into alerts and API records that tell a buyer who was mentioned, what was claimed, when it changed, and what to review next.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/solutions/dwm' className='inline-flex h-11 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                                Explore dark web monitoring
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/contact' className='inline-flex h-11 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#171a21] transition hover:border-[#bdc7d5]'>
                                Contact sales
                            </Link>
                        </div>
                    </div>

                    <div className='grid gap-4 lg:grid-cols-3'>
                        {primarySolutions.map((solution) => {
                            const Icon = solution.icon
                            return (
                                <Link key={solution.title} href={solution.href} className='group grid gap-5 rounded-lg border border-[#e0e5ed] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c9d2df] hover:shadow-[0_18px_50px_rgba(26,35,55,0.12)]'>
                                    <div className='flex items-start justify-between gap-3'>
                                        <span className='grid h-12 w-12 place-items-center rounded-lg border border-[#dfe6f1] bg-[#f7f9fc] text-[#3056d3]'>
                                            <Icon className='h-5 w-5' />
                                        </span>
                                        <span className='rounded-full bg-[#eef3ff] px-2.5 py-1 text-xs font-semibold text-[#3056d3]'>{solution.eyebrow}</span>
                                    </div>
                                    <div className='grid gap-2'>
                                        <h2 className='text-xl font-semibold text-[#171a21]'>{solution.title}</h2>
                                        <p className='text-sm leading-6 text-[#596170]'>{solution.detail}</p>
                                    </div>
                                    <div className='grid gap-2 border-t border-[#eef1f5] pt-4'>
                                        {solution.points.map(point => <span key={point} className='text-sm text-[#3d4656]'>{point}</span>)}
                                    </div>
                                    <span className='inline-flex items-center gap-2 text-sm font-semibold text-[#3056d3]'>
                                        Open solution
                                        <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                    </span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className='bg-[#f7f8fb]'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-14 md:px-8 lg:grid-cols-[0.72fr_1.28fr]'>
                    <div className='grid content-start gap-3'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Platform fit</p>
                        <h2 className='text-3xl font-semibold'>Built for notification and review workflows, not data dumps.</h2>
                    </div>
                    <div className='grid gap-4 md:grid-cols-2'>
                        {platformItems.map((item) => {
                            const Icon = item.icon
                            return (
                                <article key={item.title} className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-white p-4 shadow-sm'>
                                    <div className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                                        <span className='text-[#3056d3]'><Icon className='h-4 w-4' /></span>
                                        {item.title}
                                    </div>
                                    <p className='text-sm leading-6 text-[#596170]'>{item.detail}</p>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </section>
        </main>
    )
}
