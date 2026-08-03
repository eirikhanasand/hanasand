import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, BellRing, Code2, Database, Gauge, Globe2, LockKeyhole, Network, Radar, ShieldCheck, Waypoints } from 'lucide-react'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Solutions',
    description: 'Security monitoring, exposure intelligence, and safe investigation workflows from Hanasand.',
    path: '/solutions',
    keywords: ['onion session workspace', 'dark web monitoring', 'ransomware monitoring', 'company exposure alerts', 'threat intelligence API'],
})

const primarySolutions = [
    {
        title: 'Security Monitoring',
        eyebrow: 'DETECTION & RESPONSE',
        detail: 'Turn security activity into investigations your team can act on. Hanasand connects suspicious behavior with the evidence, context, and next steps needed to decide what matters.',
        href: '/solutions/mill',
        icon: AlertTriangle,
        points: ['Surface suspicious authentication and account activity', 'Review evidence in one analyst workspace', 'Route findings into your existing response process'],
        price: 'Prioritize real threats',
    },
    {
        title: 'Dark Web Monitoring',
        eyebrow: 'EXPOSURE INTELLIGENCE',
        detail: 'Know when your company, people, brands, or suppliers appear in places where attackers operate—before an exposure becomes an incident.',
        href: '/dwm',
        icon: ShieldCheck,
        points: ['Monitor the assets and relationships that matter', 'Track changes across relevant threat sources', 'Give analysts the context to validate and respond'],
        price: 'Detect exposure earlier',
    },
    {
        title: 'Browser',
        eyebrow: 'SAFE INVESTIGATION',
        detail: 'Investigate suspicious websites and links without putting your analysts or devices in the line of fire. Preserve the evidence and keep the investigation moving.',
        href: '/browser',
        icon: Globe2,
        points: ['Examine regular-web and onion destinations safely', 'Capture redirects, screenshots, and supporting evidence', 'Keep triage work organized in one investigation flow'],
        price: 'Investigate without exposure',
    },
    {
        title: 'Threat Intelligence Search',
        eyebrow: 'INVESTIGATOR CONSOLE',
        detail: 'Move from a name, domain, actor, or vulnerability to an informed answer. Connect related evidence and understand what deserves attention now.',
        href: '/ti',
        icon: Radar,
        points: ['Investigate actors, companies, vulnerabilities, and infrastructure', 'Connect exposure to the entities it affects', 'Preserve context as findings move into review'],
        price: 'Turn intelligence into decisions',
    },
]

const utilitySolutions = [
    {
        title: 'Bloom Hash Exposure Lookup',
        eyebrow: 'EXPOSURE CHECK',
        detail: 'Check a sensitive value for known exposure without uploading the underlying data or turning it into a public record.',
        href: '/pwned',
        icon: LockKeyhole,
        points: ['Privacy-conscious lookup flow', 'Clear match or no-match result', 'Designed for quick analyst verification'],
        price: 'Verify exposure privately',
    },
    {
        title: 'Endpoint Checks',
        eyebrow: 'SERVICE CHECKS',
        detail: 'Run a permitted check against a URL you control, share the result with your team, and keep launch or incident work moving.',
        href: '/test',
        icon: Gauge,
        points: ['Start with a small evaluation allowance', 'Check permitted targets on demand', 'Share results with the people who need them'],
        price: 'Check what matters',
    },
]

const platformItems = [
    { title: 'Relevant coverage', detail: 'Monitor the sources, assets, and relationships that matter to your organization.', icon: Network },
    { title: 'Built for your stack', detail: 'Deliver findings into the systems your team already uses.', icon: Code2 },
    { title: 'Investigation context', detail: 'Connect actors, companies, infrastructure, vulnerabilities, and evidence in one workflow.', icon: Waypoints },
    { title: 'Actionable alerts', detail: 'See what changed, why it matters, and what should happen next.', icon: BellRing },
    { title: 'Privacy-conscious intelligence', detail: 'Work from structured exposure records without turning sensitive material into a public data store.', icon: Database },
]

export default function SolutionsPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-8 md:py-22'>
                    <div className='grid max-w-4xl gap-5'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Solutions</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-6xl'>Find what puts your business at risk. Know what to do next.</h1>
                        <p className='max-w-3xl text-lg leading-8 text-ui-muted'>
                            Hanasand brings security monitoring, exposure intelligence, and safe investigation into one focused workspace—so your team can move from scattered alerts to clear, defensible decisions.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/dwm' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                                Explore the platform
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
                                        Explore {solution.title}
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
                        <p className='text-sm font-semibold uppercase text-ui-primary'>One workspace</p>
                        <h2 className='text-3xl font-semibold'>From first alert to informed action.</h2>
                        <p className='text-sm leading-6 text-ui-muted'>Hanasand keeps the evidence, relationships, and decisions around a security event together—so analysts spend less time assembling context and more time responding.</p>
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
                        <p className='text-sm font-semibold uppercase text-ui-muted'>Additional tools</p>
                        <h2 className='mt-2 text-2xl font-semibold text-ui-text'>Verify exposure and investigate services when you need to.</h2>
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
                                        Explore {solution.title}
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
