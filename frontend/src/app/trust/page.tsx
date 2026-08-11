import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, ArrowRight, BellRing, BookOpenCheck, Database, Eye, FileCheck2, Gauge, LockKeyhole, Radio, Waypoints, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Trust Center',
    description: 'See how Hanasand turns public intelligence into evidence-backed alerts and customer-ready security work.',
    path: '/trust',
    keywords: ['hanasand trust center', 'hanasand security', 'threat intelligence', 'security operations'],
})

const capabilities = [
    {
        title: 'Monitor relevant public intelligence',
        detail: 'Governed collection across selected public sources gives teams a focused view of activity that matters to them.',
        icon: Database,
        href: '/coverage',
        link: 'View source coverage',
    },
    {
        title: 'Match activity to customer terms',
        detail: 'Customer-specific watchlists connect public activity to companies, domains, vendors, brands, and products.',
        icon: Eye,
        href: '/dwm',
        link: 'See monitoring workflow',
    },
    {
        title: 'Turn findings into evidence-backed work',
        detail: 'Matches retain source, timestamps, provenance, and evidence context so analysts can review the basis for an alert.',
        icon: FileCheck2,
        href: '/ti/apt29',
        link: 'Inspect intelligence evidence',
    },
    {
        title: 'Move from alert to action',
        detail: 'Relevant findings can be reviewed, assigned, linked to cases, and tracked through an operational workflow.',
        icon: Workflow,
        href: '/contact?intent=procurement',
        link: 'Request a workflow review',
    },
]

const workflowProof = [
    ['01', 'Watchlist match', 'A customer term is matched against collected public intelligence.'],
    ['02', 'Evidence record', 'The alert keeps source, collection time, provenance, and context.'],
    ['03', 'Alert review', 'Analysts assess relevance, confidence, severity, and recommended action.'],
    ['04', 'Case handoff', 'The finding can move into an assigned customer workflow.'],
]

const enterpriseFoundations: Array<[string, string, LucideIcon]> = [
    ['Tenant-scoped data', 'Customer monitoring, alerts, and evidence stay within the selected customer scope.', LockKeyhole],
    ['Customer-specific monitoring', 'Watchlists define the terms and entities that matter to each customer.', Eye],
    ['Evidence provenance', 'Source identity, timestamps, hashes, and collection context travel with the finding.', FileCheck2],
    ['Freshness visibility', 'Collection health and freshness make the state of monitoring visible to operators.', Gauge],
    ['Operational workflows', 'Alerts, assignments, notes, delivery, and cases support follow-through.', Waypoints],
    ['Governed source lifecycle', 'Source activation, health, lifecycle, and collection decisions are tracked explicitly.', BookOpenCheck],
]

const trustPractices = [
    ['Evidence-backed outputs', 'Customer-facing findings are grounded in retained evidence and structured alert records.'],
    ['Explicit source attribution', 'Reviewers can see where an observation came from and how it entered the monitoring workflow.'],
    ['Honest freshness indicators', 'Collection and observation timing remain visible so teams can judge how current a finding is.'],
    ['Collection health visibility', 'Operational status shows whether source collection is working and when it last succeeded.'],
    ['Governed collection policies', 'Source use, lifecycle, and transport are controlled as operational decisions.'],
    ['Customer-visible service status', 'Service health is available through a public status path for operational awareness.'],
    ['Auditable alert workflows', 'Review and delivery events create a clear path from match to customer action.'],
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
                            Hanasand collects public intelligence, connects it to customer watchlists, and turns relevant activity into evidence-backed alerts and cases.
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

                    <WorkflowPreview />
                </div>
            </section>

            <section id='operational-today' className='scroll-mt-24 border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-7 px-4 py-12 md:px-8'>
                    <SectionIntro eyebrow='Operational today' title='A direct path from public signal to customer action.' detail='The product is organized around useful outcomes: focused monitoring, understandable evidence, and work that can move through a security team.' />
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                        {capabilities.map((item) => <CapabilityCard key={item.title} {...item} />)}
                    </div>
                </div>
            </section>

            <section id='enterprise-workflows' className='scroll-mt-24 border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-7 px-4 py-12 md:px-8'>
                    <SectionIntro eyebrow='Built for enterprise workflows' title='Practical foundations for security teams.' detail='Hanasand keeps customer monitoring focused, attributable, and connected to the way analysts already review and act on findings.' />
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
                    <SectionIntro eyebrow='How trust works in practice' title='Confidence comes from seeing the work.' detail='The operational record is part of the product: teams can inspect what was collected, when it was observed, where it came from, and what happened next.' />
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
                        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-ui-primary'>Product evidence</p>
                        <h2 className='text-3xl font-semibold'>Review the workflow before the sales call.</h2>
                        <p className='max-w-2xl text-sm leading-6 text-ui-muted'>
                            Use the live product surfaces to inspect source coverage, intelligence evidence, monitoring workflows, and current service operation.
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
                                <p className='text-xs font-semibold uppercase tracking-[0.12em] text-ui-primary'>Workflow evidence</p>
                                <h3 className='mt-1 text-lg font-semibold'>From match to case</h3>
                            </div>
                            <BellRing className='h-5 w-5 text-ui-primary' />
                        </div>
                        <div className='divide-y divide-ui-border'>
                            {workflowProof.map(([number, title, detail]) => (
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
                        <h2 className='mt-2 max-w-3xl text-3xl font-semibold'>See how Hanasand turns public intelligence into customer-ready security work.</h2>
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

function WorkflowPreview() {
    return <aside className='rounded-xl border border-ui-border bg-ui-raised p-4 shadow-sm'>
        <div className='flex items-center justify-between border-b border-ui-border pb-3'>
            <div>
                <p className='text-xs font-semibold uppercase tracking-[0.12em] text-ui-primary'>Customer workflow</p>
                <p className='mt-1 text-sm font-semibold'>Evidence-backed monitoring</p>
            </div>
            <Radio className='h-5 w-5 text-ui-success' />
        </div>
        <div className='divide-y divide-ui-border'>
            {workflowProof.map(([number, title, detail]) => (
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
