import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BellRing, Building2, CheckCircle2, ClipboardCheck, FileText, Gauge, KeyRound, ShieldCheck } from 'lucide-react'
import { buildRouteMetadata } from '../seo'
import { commercialAccessPlans } from '@/utils/commercialAccess'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Pricing',
    description: 'Evaluation and sales-scoped access for Hanasand threat monitoring and company exposure alerts.',
    path: '/pricing',
    keywords: ['hanasand pricing', 'threat monitoring pricing', 'ransomware monitoring pricing'],
})

const planIcons = { evaluation: BellRing, monitoring: ShieldCheck, integration: Building2 }

const buyerScenarios = [
    {
        title: 'Brand and domain monitoring',
        buyer: 'Security or IT lead',
        detail: 'Watch your company, product names, domains, executive names, and known aliases. Use the alert to decide whether incident response, legal, or communications should review.',
    },
    {
        title: 'Vendor and supplier exposure',
        buyer: 'Vendor-risk or procurement team',
        detail: 'Watch suppliers, portfolio companies, acquisition targets, and managed-service providers. Route only the claims that include enough source context to review.',
    },
    {
        title: 'Analyst triage alert',
        buyer: 'SOC or threat-intel team',
        detail: 'Give analysts the matched term, source, timing, confidence, claim summary, source context, and recommended next action instead of a raw feed.',
    },
]

const competitiveFitRows = [
    {
        label: 'Best Hanasand fit',
        value: 'Focused company, supplier, executive, domain, and portfolio monitoring where the buyer wants reviewable evidence and direct webhook/API delivery.',
    },
    {
        label: 'Best larger-platform fit',
        value: 'Global credential-intelligence programs that require established analyst services, takedown operations, third-party reviews, broad identity remediation, or a mature vendor-risk procurement trail before evaluation.',
    },
    {
        label: 'Current evidence boundary',
        value: 'Live public TI search and DWM alert workflows show recent source metadata and safe alert fields. Enterprise certificates, SSO/SCIM, and formal analyst-service coverage should be scoped before purchase.',
    },
]

const pilotSteps = [
    ['1', 'Load the watchlist', 'Add companies, domains, suppliers, brands, executives, and acquisition targets.'],
    ['2', 'Choose delivery', 'Connect webhook or scoped API delivery to the SOC, vendor-risk, or case workflow.'],
    ['3', 'Review first matches', 'Inspect source, timing, matched term, confidence, evidence summary, and recommended owner.'],
    ['4', 'Confirm commercial scope', 'Record watchlist size, destinations, API budgets, retention, support, and price in the order form before activation.'],
]

const enterpriseReadiness = [
    {
        title: 'Security review',
        detail: 'Security overview, metadata-first data handling, incident-response path, and current SOC 2 / ISO gap stated plainly.',
        href: '/trust/security-overview',
        icon: ShieldCheck,
    },
    {
        title: 'Procurement review',
        detail: 'DPA, order-form notes, subprocessor details, SLA/support targets, and questionnaire responses can be packaged for review.',
        href: '/trust/dpa-and-data',
        icon: FileText,
    },
    {
        title: 'Identity requirements',
        detail: 'Roles and organization administration exist today; SSO/SAML/OIDC/SCIM should be scoped before an enterprise rollout.',
        href: '/trust/sla-onboarding',
        icon: KeyRound,
    },
]

export default function PricingPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8 md:py-20'>
                    <div className='mx-auto grid max-w-3xl justify-items-center gap-4 text-center'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Pricing</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-6xl'>Evaluate the product, then scope monitored coverage.</h1>
                        <p className='text-lg leading-8 text-ui-muted'>
                            Console evaluation is self-serve. Monitoring and integration are sales-provisioned so watchlist size, delivery, API budgets, retention, support, and price are written into the order form.
                        </p>
                        <div className='flex flex-wrap justify-center gap-3 pt-2'>
                            <Link href='#competitive-fit' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                Compare fit
                            </Link>
                            <Link href='#pilot-path' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                Pilot path
                            </Link>
                        </div>
                    </div>

                    <div className='grid gap-4 lg:grid-cols-3'>
                        {commercialAccessPlans.map((plan) => {
                            const Icon = planIcons[plan.id]
                            return (
                                <article key={plan.name} className={`grid gap-5 rounded-lg border bg-ui-panel p-6 shadow-sm ${plan.id === 'monitoring' ? 'border-ui-primary shadow-md' : 'border-ui-border'}`}>
                                    <div className='flex items-start justify-between gap-4'>
                                        <span className='grid h-12 w-12 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                            <Icon className='h-5 w-5' />
                                        </span>
                                        {plan.id === 'monitoring' ? <span className='rounded-full border border-ui-primary bg-ui-primary/10 px-2.5 py-1 text-xs font-semibold text-ui-primary'>Operational fit</span> : null}
                                    </div>
                                    <div className='grid gap-2'>
                                        <h2 className='text-xl font-semibold'>{plan.name}</h2>
                                        <p className='min-h-14 text-sm leading-6 text-ui-muted'>{plan.bestFor}</p>
                                    </div>
                                    <div className='grid gap-1'>
                                        <span className='text-2xl font-semibold'>{plan.priceLabel}</span>
                                        <span className='text-sm font-medium text-ui-muted'>{plan.access}</span>
                                    </div>
                                    <Link href={plan.href} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${plan.id === 'monitoring' ? 'bg-ui-primary text-ui-canvas hover:opacity-90' : 'border border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary'}`}>
                                        {plan.cta}
                                        <ArrowRight className='h-4 w-4' />
                                    </Link>
                                    <div className='grid gap-3 border-t border-ui-border pt-5'>
                                        {plan.features.map((feature) => (
                                            <div key={feature} className='flex items-start gap-2 text-sm leading-6 text-ui-text'>
                                                <CheckCircle2 className='mt-1 h-4 w-4 shrink-0 text-ui-success' />
                                                <span>{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section id='competitive-fit' className='scroll-mt-24 border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8 lg:grid-cols-[0.76fr_1.24fr]'>
                    <div className='grid content-start gap-4'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Competitive fit</p>
                        <h2 className='text-3xl font-semibold'>Use Hanasand when direct, reviewable alerts matter more than a heavyweight CTI suite.</h2>
                        <p className='text-sm leading-6 text-ui-muted'>
                            The positioning is intentionally narrower than the largest dark-web platforms. Hanasand fits teams that need a fast watchlist, clear source context, and delivery into an existing workflow.
                        </p>
                        <Link href='/dwm' className='inline-flex h-11 w-fit items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                            Open monitoring
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>
                    <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                        <div className='grid grid-cols-[12rem_1fr] gap-3 border-b border-ui-border px-4 py-3 text-xs font-semibold uppercase text-ui-muted'>
                            <span>Decision</span>
                            <span>What it means for buyers</span>
                        </div>
                        <div className='divide-y divide-ui-border'>
                            {competitiveFitRows.map(row => (
                                <div key={row.label} className='grid gap-3 px-4 py-4 text-sm md:grid-cols-[12rem_1fr]'>
                                    <span className='font-semibold text-ui-text'>{row.label}</span>
                                    <span className='leading-6 text-ui-muted'>{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section id='pilot-path' className='scroll-mt-24 border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
                        <div>
                            <p className='text-sm font-semibold uppercase text-ui-primary'>Pilot path</p>
                            <h2 className='mt-2 max-w-3xl text-3xl font-semibold'>A buyer should know what happens after starting.</h2>
                            <p className='mt-2 max-w-3xl text-sm leading-6 text-ui-muted'>
                                Start narrow, connect one delivery path, and judge the first real matches before expanding scope.
                            </p>
                        </div>
                        <Link href='/register?path=/organizations' className='inline-flex h-11 w-fit items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                            Start evaluation
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                        {pilotSteps.map(([step, title, detail]) => (
                            <article key={title} className='grid gap-4 rounded-lg border border-ui-border bg-ui-canvas p-5 shadow-sm'>
                                <span className='grid h-10 w-10 place-items-center rounded-lg bg-ui-text text-sm font-semibold text-ui-canvas'>{step}</span>
                                <div>
                                    <h3 className='text-lg font-semibold text-ui-text'>{title}</h3>
                                    <p className='mt-2 text-sm leading-6 text-ui-muted'>{detail}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className='border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8 lg:grid-cols-[0.74fr_1.26fr]'>
                    <div className='grid content-start gap-4'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Enterprise review</p>
                        <h2 className='text-3xl font-semibold'>Need procurement, security, or SSO review before a pilot?</h2>
                        <p className='text-sm leading-6 text-ui-muted'>
                            Self-serve access is for product evaluation. Monitoring customers should review security, data handling, contract terms, and identity requirements before activation.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/trust' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                                Open trust center
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/contact?intent=procurement' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                Request review
                                <ClipboardCheck className='h-4 w-4 text-ui-primary' />
                            </Link>
                        </div>
                    </div>
                    <div className='grid gap-4 md:grid-cols-3'>
                        {enterpriseReadiness.map((item) => {
                            const Icon = item.icon
                            return (
                                <Link key={item.title} href={item.href} className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm transition hover:border-ui-primary'>
                                    <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                        <Icon className='h-5 w-5' />
                                    </span>
                                    <div>
                                        <h3 className='text-lg font-semibold text-ui-text'>{item.title}</h3>
                                        <p className='mt-2 text-sm leading-6 text-ui-muted'>{item.detail}</p>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className='bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Common buying scenarios</p>
                        <h2 className='mt-2 max-w-3xl text-3xl font-semibold'>Scope access by what needs monitoring and who owns the alert.</h2>
                    </div>
                    <div className='grid gap-4 lg:grid-cols-3'>
                        {buyerScenarios.map((scenario) => (
                            <article key={scenario.title} className='grid gap-5 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
                                <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                    <CheckCircle2 className='h-5 w-5' />
                                </span>
                                <div>
                                    <h3 className='text-lg font-semibold text-ui-text'>{scenario.title}</h3>
                                    <p className='mt-1 text-xs font-semibold uppercase text-ui-muted'>{scenario.buyer}</p>
                                </div>
                                <p className='text-sm leading-6 text-ui-text'>{scenario.detail}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className='border-t border-ui-border bg-ui-panel'>
                <div className='mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8'>
                    <div className='max-w-3xl'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Utility tool</p>
                        <h2 className='mt-1 text-xl font-semibold text-ui-text'>Need permitted endpoint checks instead?</h2>
                        <p className='mt-2 text-sm leading-6 text-ui-muted'>
                            Service checks remain available for URLs you control, but they are separate from the company exposure monitoring plans above.
                        </p>
                    </div>
                    <Link href='/test' className='inline-flex h-11 w-fit items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                        Open service checks
                        <Gauge className='h-4 w-4 text-ui-primary' />
                    </Link>
                </div>
            </section>
        </main>
    )
}
